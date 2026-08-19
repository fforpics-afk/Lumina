
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

// Polyfill WebSocket for Node environment if needed by the SDK
if (!global.WebSocket) {
  (global as any).WebSocket = WebSocket;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/api/live' });

const API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error('ERROR: GEMINI_API_KEY is not set in environment variables.');
}

const ai = new GoogleGenAI({ 
  apiKey: API_KEY || '',
  httpOptions: {
    headers: { 'User-Agent': 'aistudio-build' }
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

wss.on('connection', async (ws) => {
  console.log('Client connected to bridge');

  let session: any = null;
  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000);

  ws.on('message', async (data) => {
    try {
      const payload = JSON.parse(data.toString());

      if (payload.type === 'setup') {
        const { voice, history, timeOfDay, systemInstruction } = payload;
        
        const getBestKey = () => {
          const keys = [
            process.env.GEMINI_API_KEY,
            process.env.GOOGLE_API_KEY,
            process.env.VITE_GEMINI_API_KEY,
            process.env.API_KEY
          ];
          for (const key of keys) {
            if (key && key.length > 10 && key !== 'undefined' && key !== 'null') return key;
          }
          return '';
        };

        const apiKey = getBestKey();
        console.log(`Setting up Gemini session for time: ${timeOfDay}. Key found: ${apiKey ? 'Yes' : 'No'}`);
        
        if (session) {
          try { await session.close(); } catch (e) {}
        }

        try {
          const ai = new GoogleGenAI({ 
            apiKey,
            httpOptions: {
              headers: { 'User-Agent': 'aistudio-build' }
            }
          });
          
          console.log('Connecting to Gemini 2.0 Flash...');
          session = await ai.live.connect({
            model: 'gemini-2.0-flash',
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || 'Kore' } },
              },
              systemInstruction: systemInstruction || "You are Lumina, a kind companion.",
              inputAudioTranscription: {},
              outputAudioTranscription: {},
            },
            callbacks: {
              onopen: () => {
                console.log('Gemini 2.0 Flash Exp session opened');
                ws.send(JSON.stringify({ type: 'open' }));
                
                // Trigger initial warm greeting
                if (session) {
                  session.sendRealtimeInput([{ text: "Please provide a very warm, soulful, and concise greeting as Lumina." }]);
                }
              },
              onmessage: (message: any) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'message', message }));
                }
              },
              onerror: (e: any) => {
                console.error('Gemini Session Error:', e);
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'error', error: e.message || 'Gemini error' }));
                }
              },
              onclose: (e: any) => {
                console.log('Gemini Session Closed:', e);
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'close', reason: e.reason }));
                }
              }
            }
          });
        } catch (connErr: any) {
          console.error('Failed to establish Gemini connection:', connErr);
          ws.send(JSON.stringify({ type: 'error', error: `Handshake Failed: ${connErr.message}` }));
        }

      } else if (payload.type === 'audio' && payload.data) {
        if (session) {
          session.sendRealtimeInput({
            audio: {
              data: payload.data,
              mimeType: 'audio/pcm;rate=16000'
            }
          });
        }
      }
    } catch (err) {
      console.error('Error processing client message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected from bridge');
    clearInterval(heartbeat);
    if (session) {
      try {
        session.close();
      } catch (e) {
        console.warn('Error closing session:', e);
      }
      session = null;
    }
  });
});

// Serve static files from the Vite build
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
