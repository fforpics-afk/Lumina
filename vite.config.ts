import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';

// Simple bridge logic for Vite dev server
const bridgePlugin = (apiKeyFromConfig: string) => ({
  name: 'lumina-bridge',
  configureServer(server) {
    const wss = new WebSocketServer({ noServer: true });

    server.httpServer?.on('upgrade', (request, socket, head) => {
      const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
      if (pathname === '/api/live') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          console.log('Vite Bridge: Client connected');
          
          let session: any = null;

          ws.on('message', async (data) => {
            try {
              const payload = JSON.parse(data.toString());
              if (payload.type === 'setup') {
                const { voice, history, timeOfDay } = payload;
                if (session) {
                  try { session.close(); } catch (e) {}
                  session = null;
                }
                
                // Final aggressive key retrieval
                const getBestKey = () => {
                  const keys = [
                    apiKeyFromConfig,
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
                
                if (!apiKey) {
                  ws.send(JSON.stringify({ 
                    type: 'error', 
                    error: 'Bridge Key Error: No valid API Key found. Please ensure GEMINI_API_KEY is set in AI Studio and refresh.' 
                  }));
                  return;
                }

                const ai = new GoogleGenAI({ 
                  apiKey,
                  httpOptions: {
                    headers: { 'User-Agent': 'aistudio-build' }
                  }
                });
                session = await ai.live.connect({
                  model: 'gemini-3.1-flash-live-preview',
                  config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                      voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || 'Kore' } },
                    },
                    systemInstruction: `You are Lumina, a warm companion. Concise & supportive. ${history || ""}`,
                  },
                  callbacks: {
                    onopen: () => {
                      ws.send(JSON.stringify({ type: 'open' }));
                      if (session) {
                        session.send({ text: `Connection started. It's ${timeOfDay || 'today'}. Greet me warmly.` });
                      }
                    },
                    onmessage: (message: any) => {
                      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'message', message }));
                    },
                    onerror: (e: any) => ws.send(JSON.stringify({ type: 'error', error: e.message })),
                    onclose: (e: any) => ws.send(JSON.stringify({ type: 'close', reason: e.reason }))
                  }
                });
              } else if (payload.type === 'audio' && session) {
                session.sendRealtimeInput({ audio: { data: payload.data, mimeType: 'audio/pcm;rate=16000' } });
              }
            } catch (err) { console.error('Vite Bridge Error:', err); }
          });

          ws.on('close', () => {
            if (session) {
              try { session.close(); } catch (e) {}
              session = null;
            }
          });
        });
      }
    });
  }
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), bridgePlugin(apiKey)],
      define: {
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
        'process.env.GOOGLE_API_KEY': JSON.stringify(apiKey),
        'process.env.VITE_GEMINI_API_KEY': JSON.stringify(apiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
