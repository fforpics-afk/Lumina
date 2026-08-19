
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { decode, encode, decodeAudioData, createPcmBlob } from './services/audioUtils';
import { ConnectionStatus, TranscriptionEntry, ThemeConfig } from './types';
import Visualizer from './components/Visualizer';
import { THEMES } from './constants/themes';
import { Doodle } from './components/Doodle';
import { AmbientPlayer } from './components/AmbientPlayer';
import { useWeather } from './hooks/useWeather';
import { WeatherOverlay } from './components/WeatherOverlay';
import { MicDecorator } from './components/MicDecorator';
import { BreathingExercise } from './components/BreathingExercise';

const SYSTEM_INSTRUCTION = `
You are Lumina, an exceptionally kind, warm, and empathetic companion. 
Your goal is to ease loneliness. Listen deeply. 

Pay close attention to the user's vocal tone and emotional state in real-time. 
Adjust your response style accordingly: 
- If the user sounds energetic, excited, or happy, match their energy with warmth and enthusiasm.
- If the user sounds sad, tired, or gentle, respond with a softer, more calming, and comforting tone.

Validate the user's feelings. 
Share wisdom, poetry, or small comforting observations about the world when appropriate. 
Be a friend who never judges and is always there to listen. 
Keep responses conversational and not overly robotic or long-winded.

You have access to real-time information through local weather sensors. 
If it's raining, snowing, or very sunny for the user, feel free to mention it warmly in your conversation.
Provide accurate and timely information while maintaining your warm and comforting persona.
`;

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const statusRef = useRef<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLuminaThinking, setIsLuminaThinking] = useState(false);
  const [showBreathing, setShowBreathing] = useState(false);
  const [isBreatheSuggested, setIsBreatheSuggested] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>(() => {
    const saved = localStorage.getItem('lumina_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [memory, setMemory] = useState<string[]>(() => {
    const saved = localStorage.getItem('lumina_memory');
    return saved ? JSON.parse(saved) : [];
  });
  
  useEffect(() => {
    localStorage.setItem('lumina_history', JSON.stringify(transcriptions));
  }, [transcriptions]);

  useEffect(() => {
    localStorage.setItem('lumina_memory', JSON.stringify(memory));
  }, [memory]);

  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(THEMES[0]);
  const weather = useWeather();
  
  // Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [voiceVolume, setVoiceVolume] = useState(1.5);
  
  const DEFAULT_DEPLOYMENT_URL = 'https://ais-dev-2uyclbn7m2v2ugixq4z5ms-809796202203.asia-east1.run.app';

  const [backendUrl, setBackendUrl] = useState(() => {
    const saved = localStorage.getItem('lumina_backend_url');
    if (saved) return saved;
    
    // Auto-detect if we're in a native environment/Capacitor
    const isCapacitor = window.location.protocol.includes('capacitor') || window.location.hostname === 'localhost';
    if (isCapacitor) {
      return DEFAULT_DEPLOYMENT_URL;
    }
    return window.location.origin;
  });

  useEffect(() => {
    // FORCE RESET: If we are on mobile/Capacitor and the saved URL is localhost, 
    // it's a leftover from a previous version. Reset it to production.
    const isNative = window.location.protocol.includes('capacitor') || (window as any).Capacitor?.isNative;
    if (isNative && backendUrl.includes('localhost')) {
      console.log('Mobile device detected with localhost backend. Resetting to production URL.');
      setBackendUrl(DEFAULT_DEPLOYMENT_URL);
    }
  }, [backendUrl]);

  const resetBackendToDefault = () => {
    const isCapacitor = window.location.protocol.includes('capacitor') || window.location.hostname === 'localhost';
    const target = isCapacitor ? DEFAULT_DEPLOYMENT_URL : window.location.origin;
    setBackendUrl(target);
    setTestResult({ success: true, message: "Settings reset to defaults." });
  };

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const testConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);
    try {
      const baseUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        setTestResult({ success: true, message: "Server is reachable!" });
      } else {
        setTestResult({ success: false, message: `Server responded with status ${response.status}` });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: "Could not reach server. Check the URL and your internet." });
    } finally {
      setIsTestingConnection(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('lumina_backend_url', backendUrl);
  }, [backendUrl]);

  const voices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

  // Audio State Refs
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const bridgeWsRef = useRef<WebSocket | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const micStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Buffer for transcriptions
  const currentInputTransRef = useRef('');
  const currentOutputTransRef = useRef('');

  const [isVoiceWakeEnabled, setIsVoiceWakeEnabled] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!isVoiceWakeEnabled || status !== ConnectionStatus.DISCONNECTED) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.toLowerCase();
      
      if (transcript.includes('lumina')) {
        console.log('Wake word detected!');
        startSession();
      }
    };

    recognition.onend = () => {
      // Restart if still in disconnected state and enabled
      if (statusRef.current === ConnectionStatus.DISCONNECTED && isVoiceWakeEnabled) {
        try { recognition.start(); } catch(e) {}
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setIsVoiceWakeEnabled(false);
        setErrorMessage("Microphone permission denied for Voice Wake.");
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch(e) {}

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isVoiceWakeEnabled, status]);

  const APP_VERSION = '1.3.5';

  const getClimate = () => {
    return weather.condition;
  };

  const getMood = () => {
    if (isLuminaThinking) return 'thinking';
    if (status !== ConnectionStatus.CONNECTED) return 'neutral';
    
    const lastEntry = transcriptions[transcriptions.length - 1];
    if (!lastEntry) return 'calm';

    const text = lastEntry.text.toLowerCase();
    if (text.includes('happy') || text.includes('excited') || text.includes('great') || text.includes('wonderful')) return 'excited';
    if (text.includes('sad') || text.includes('lonely') || text.includes('hurt') || text.includes('cry')) return 'sad';
    if (text.includes('stress') || text.includes('anxious') || text.includes('panic') || text.includes('worried') || text.includes('overwhelmed')) return 'stressed';
    if (text.includes('thank') || text.includes('soft') || text.includes('gentle')) return 'gentle';
    
    return 'calm';
  };

  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualStopRef = useRef(false);

  const clearHistory = () => {
    setTranscriptions([]);
    setIsBreatheSuggested(false);
    localStorage.setItem('lumina_history', '[]');
    setShowClearConfirm(false);
  };

  const stopSession = useCallback(() => {
    isManualStopRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (sessionRef.current) {
      try {
        const closeResult = sessionRef.current.close();
        if (closeResult && typeof closeResult.catch === 'function') {
          closeResult.catch((e: any) => console.warn('Error closing session promise:', e));
        }
      } catch (e) {
        console.warn('Error calling session.close():', e);
      }
      sessionRef.current = null;
    }

    if (bridgeWsRef.current) {
      bridgeWsRef.current.close(1000);
      bridgeWsRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.onaudioprocess = null;
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    setStatus(ConnectionStatus.DISCONNECTED);
    setIsLuminaThinking(false);
  }, []);

  const startSession = async () => {
    setErrorMessage(null);
    isManualStopRef.current = false;
    try {
      setStatus(ConnectionStatus.CONNECTING);
      
      // Initialize Audio Contexts
      try {
        if (!audioContextInRef.current) {
          audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        }
        if (!audioContextOutRef.current) {
          audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }

        if (!gainNodeRef.current) {
          gainNodeRef.current = audioContextOutRef.current.createGain();
          gainNodeRef.current.gain.value = voiceVolume;
        }

        if (!analyserRef.current) {
          analyserRef.current = audioContextOutRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          gainNodeRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextOutRef.current.destination);
        }

        gainNodeRef.current.gain.value = voiceVolume;

        await audioContextInRef.current.resume();
        await audioContextOutRef.current.resume();
      } catch (audioErr) {
        throw new Error("Could not initialize audio hardware.");
      }

      // Microphone Access
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
      } catch (micErr: any) {
        throw new Error("Microphone access was denied.");
      }

      const baseUrl = backendUrl.replace(/\/$/, '');
      const wsUrl = baseUrl.startsWith('http') 
        ? baseUrl.replace(/^http/, 'ws') + '/api/live'
        : baseUrl.replace(/^capacitor/, 'ws') + '/api/live'; // Fallback for Capacitor

      console.log('Connecting to bridge:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      bridgeWsRef.current = ws;

      // Add a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (statusRef.current === ConnectionStatus.CONNECTING) {
          setErrorMessage("Connection timed out. The server might be starting up or unreachable.");
          stopSession();
        }
      }, 30000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('Bridge connection opened');
        
        // Reset audio timing
        nextStartTimeRef.current = audioContextOutRef.current!.currentTime;
        
        // Send setup configuration
        const hour = new Date().getHours();
        let timeContext = "Evening";
        if (hour >= 5 && hour < 12) timeContext = "Morning";
        else if (hour >= 12 && hour < 17) timeContext = "Afternoon";

        const historyContext = transcriptions.length > 0 
          ? `\n\nRecent Conversation History:\n${
              transcriptions.slice(-6).map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n')
            }`
          : '';

        const memoryContext = memory.length > 0
          ? `\n\nThings you remember about this friend:\n${memory.map(m => `- ${m}`).join('\n')}`
          : '';
        
        ws.send(JSON.stringify({
          type: 'setup',
          voice: selectedVoice,
          history: `${memoryContext}${historyContext}`,
          timeOfDay: timeContext,
          systemInstruction: SYSTEM_INSTRUCTION
        }));

        const source = audioContextInRef.current!.createMediaStreamSource(stream);
        const scriptProcessor = audioContextInRef.current!.createScriptProcessor(2048, 1, 1);
        
        micSourceRef.current = source;
        scriptProcessorRef.current = scriptProcessor;

        scriptProcessor.onaudioprocess = (e) => {
          if (statusRef.current !== ConnectionStatus.CONNECTED || isMuted) return;
          const inputData = e.inputBuffer.getChannelData(0);

          // Simple client-side VAD (Volume threshold)
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          
          // Use 0.008 threshold for better noise rejection and stability
          if (rms > 0.008 || isVoiceWakeEnabled) {
            const base64 = createPcmBlob(inputData, audioContextInRef.current!.sampleRate).data;
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'audio', data: base64 }));
            }
          }
        };

        source.connect(scriptProcessor);
        scriptProcessor.connect(audioContextInRef.current!.destination);
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log('Bridge message:', data.type);
        
        if (data.type === 'open') {
          setStatus(ConnectionStatus.CONNECTED);
        }

        if (data.type === 'message') {
          const message = data.message;
          
          try {
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts && parts.length > 0) {
              for (const part of parts) {
                const base64Audio = part.inlineData?.data;
                if (base64Audio) {
                  const outCtx = audioContextOutRef.current!;
                  nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
                  const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
                  const source = outCtx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(gainNodeRef.current!);
                  source.addEventListener('ended', () => {
                    sourcesRef.current.delete(source);
                    if (sourcesRef.current.size === 0) setIsLuminaThinking(false);
                  });
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
                  sourcesRef.current.add(source);
                  setIsLuminaThinking(true);
                }
              }
            }
          } catch (playbackErr) {
            console.error('Error during audio playback:', playbackErr);
          }

          if (message.serverContent?.interrupted) {
            sourcesRef.current.forEach(s => s.stop());
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
            setIsLuminaThinking(false);
          }

          if (message.serverContent?.inputTranscription) {
            currentInputTransRef.current += message.serverContent.inputTranscription.text;
          }
          if (message.serverContent?.outputTranscription) {
            currentOutputTransRef.current += message.serverContent.outputTranscription.text;
          }

          if (message.serverContent?.turnComplete) {
            const input = currentInputTransRef.current;
            const output = currentOutputTransRef.current;
            if (input) {
              setTranscriptions(prev => [...prev, { id: Date.now() + '-u', role: 'user', text: input, timestamp: Date.now() }]);
            }
            if (output) setTranscriptions(prev => [...prev, { id: Date.now() + '-l', role: 'lumina', text: output, timestamp: Date.now() }]);
            
            // Trigger breathing exercise if output implies stress or sadness
            const outputLow = output.toLowerCase();
            if (outputLow.includes('sad') || outputLow.includes('lonely') || outputLow.includes('stressed') || outputLow.includes('anxious') || outputLow.includes('breathe') || outputLow.includes('relax')) {
              setIsBreatheSuggested(true);
              setTimeout(() => setShowBreathing(true), 2000);
            }

            currentInputTransRef.current = '';
            currentOutputTransRef.current = '';
          }
        } else if (data.type === 'error') {
          setErrorMessage(`Bridge Error: ${data.error}`);
          stopSession();
        } else if (data.type === 'close') {
          console.log('Bridge closed Gemini session:', data.reason);
          setErrorMessage(`Gemini disconnected: ${data.reason}`);
          stopSession();
        }
      };

      ws.onerror = (e) => {
        console.error('Bridge connection error:', e);
        if (backendUrl.includes('localhost') && window.location.protocol.includes('capacitor')) {
          setErrorMessage("Connection failed. Since you are on mobile, please ensure the 'Backend URL' in settings is set to your Lumina server address (not localhost).");
        } else {
          setErrorMessage("Lumina is taking a nap... or maybe the internet is? I'll keep trying to wake her up! 😴");
        }
        setStatus(ConnectionStatus.ERROR);
        stopSession();
      };

      ws.onclose = (e) => {
        console.log('Bridge WebSocket closed:', e.code, e.reason);
        setStatus(ConnectionStatus.DISCONNECTED);
        
        // If it wasn't a clean close and we were connected, and not manually stopped
        if (e.code !== 1000 && e.code !== 1001 && !isManualStopRef.current) {
          const delay = Math.min(Math.pow(2, reconnectAttempts) * 1000, 30000);
          setReconnectAttempts(prev => prev + 1);
          console.log(`Reconnecting in ${delay}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            startSession();
          }, delay);
        } else {
          setReconnectAttempts(0);
          stopSession();
        }
      };

    } catch (err: any) {
      console.error('Failed to start session:', err);
      setErrorMessage(err.message || "An unexpected error occurred.");
      setStatus(ConnectionStatus.ERROR);
      stopSession();
    }
  };

  const downloadHistory = () => {
    if (transcriptions.length === 0) return;
    
    const content = transcriptions.map(t => {
      const time = new Date(t.timestamp).toLocaleString();
      return `[${time}] ${t.role.toUpperCase()}: ${t.text}`;
    }).join('\n\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lumina-conversation-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleConnection = () => {
    if (status === ConnectionStatus.CONNECTED) {
      stopSession();
    } else {
      startSession();
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-1000 ${currentTheme.backgroundClass}`}>
      <WeatherOverlay condition={weather.condition} />
      <BreathingExercise isVisible={showBreathing} onClose={() => setShowBreathing(false)} />
      <div className="flex flex-col p-4 md:p-8 items-center max-w-4xl mx-auto min-h-screen">
        {/* Header */}
        <header className="w-full text-center mb-8 relative">
          <div className="absolute right-0 top-0 flex gap-2">
            <button 
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="text-white/40 hover:text-white transition-colors p-2 bg-white/5 rounded-full"
            >
              <i className="fa-solid fa-sliders text-lg"></i>
            </button>
          </div>

          <h1 className="text-4xl md:text-5xl font-extralight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            Lumina
          </h1>
        </header>

        {/* Error Display */}
        {errorMessage && (
          <div className="w-full max-w-lg mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <i className="fa-solid fa-circle-exclamation text-rose-400"></i>
              <div>
                <p className="text-xs text-rose-200 font-medium">Something went wrong</p>
                <p className="text-[10px] text-rose-200/60 leading-tight">
                  {errorMessage.includes('Microphone') ? 'Microphone access is required. Please check your browser permissions.' : errorMessage}
                </p>
              </div>
            </div>
            <button 
              onClick={() => setErrorMessage(null)}
              className="text-white/20 hover:text-white transition-colors"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {/* Settings Panel */}
        {isSettingsOpen && (
          <div className="w-full mb-8 p-6 bg-black/30 backdrop-blur-xl border border-white/10 rounded-3xl animate-in fade-in slide-in-from-top-4 shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className="mb-6">
                  <label className="text-xs uppercase tracking-widest text-white/50 block mb-3">Lumina's Voice</label>
                  <div className="flex flex-wrap gap-2">
                    {voices.map(v => (
                      <button
                        key={v}
                        onClick={() => setSelectedVoice(v)}
                        className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest transition-all ${
                          selectedVoice === v 
                            ? 'bg-white text-black font-bold' 
                            : 'bg-white/5 text-white/40 hover:bg-white/10 border border-white/5'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="text-xs uppercase tracking-widest text-white/50 block mb-3">Theme</label>
                <div className="flex gap-3 mb-6">
                  {THEMES.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => setCurrentTheme(t)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        currentTheme.name === t.name ? 'scale-125 border-white' : 'border-white/10 opacity-60 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: t.accentColor }}
                    />
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-xs uppercase tracking-widest text-white/50 block mb-3">Audio & Presence</label>
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] text-white/30 uppercase tracking-widest mb-2 block">Voice Volume</label>
                    <input 
                      type="range" min="0.5" max="4.0" step="0.1" value={voiceVolume}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setVoiceVolume(val);
                        if (gainNodeRef.current) gainNodeRef.current.gain.value = val;
                      }}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-rose-500"
                    />
                  </div>


                  <div className="pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs uppercase tracking-widest text-white/50 block">Voice Wake</label>
                        <p className="text-[10px] text-white/30 italic">Say "Lumina" to wake her up</p>
                      </div>
                      <button 
                        onClick={() => setIsVoiceWakeEnabled(!isVoiceWakeEnabled)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${isVoiceWakeEnabled ? 'bg-rose-500' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${isVoiceWakeEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>

                  <AmbientPlayer />

                  <div className="pt-4 border-t border-white/5">
                    <label className="text-[10px] text-white/30 uppercase tracking-widest mb-2 block">Backend URL (APK only)</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={backendUrl}
                        onChange={(e) => setBackendUrl(e.target.value)}
                        placeholder="https://your-app-url.com"
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/60 focus:border-rose-500/50 outline-none transition-all"
                      />
                      <button
                        onClick={testConnection}
                        disabled={isTestingConnection}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white/60 hover:bg-white/10 transition-all uppercase tracking-widest disabled:opacity-50"
                      >
                        {isTestingConnection ? <i className="fa-solid fa-spinner animate-spin"></i> : 'Test'}
                      </button>
                    </div>
                    {testResult && (
                      <p className={`text-[8px] mt-1 italic ${testResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {testResult.message}
                      </p>
                    )}
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-[8px] text-white/20 italic leading-tight max-w-[150px]">
                        This is where the APK connects. We've auto-set this to your production server.
                      </p>
                      <button 
                        onClick={resetBackendToDefault}
                        className="text-[8px] uppercase tracking-widest text-rose-400/60 hover:text-rose-400 transition-colors"
                      >
                        Reset to Defaults
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Interaction Area */}
        <main className="w-full flex-1 flex flex-col items-center">
          <div className="w-full flex flex-col gap-6 items-center py-4">
            <div className="relative flex items-center justify-center gap-6">
              {/* Manual Breathing Trigger (On Demand Only) */}
              {isBreatheSuggested && (
                <div className="flex flex-col items-center gap-1 animate-in fade-in zoom-in duration-500">
                  <button
                    onClick={() => setShowBreathing(true)}
                    className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-rose-400 hover:border-rose-400/30 transition-all hover:scale-110 active:scale-95 group"
                    title="Breathing Moment"
                  >
                    <i className="fa-solid fa-wind group-hover:animate-pulse"></i>
                  </button>
                  <span className="text-[8px] uppercase tracking-tighter text-white/20 font-bold">Breathe</span>
                </div>
              )}

              <div className="relative w-32 h-32">
                <MicDecorator condition={weather.condition} />
                <button
                  onClick={toggleConnection}
                  disabled={status === ConnectionStatus.CONNECTING}
                  className={`w-full h-full rounded-full flex items-center justify-center text-3xl transition-all duration-500 shadow-2xl overflow-hidden ${
                    status === ConnectionStatus.CONNECTED 
                      ? 'bg-rose-500/80 hover:bg-rose-600 scale-105' 
                      : status === ConnectionStatus.CONNECTING
                        ? 'bg-slate-700 animate-pulse cursor-wait'
                        : `${currentTheme.buttonClass} hover:scale-105 active:scale-95`
                  }`}
                >
                  {status === ConnectionStatus.CONNECTED ? (
                    <i className="fa-solid fa-phone-slash"></i>
                  ) : status === ConnectionStatus.CONNECTING ? (
                    <i className="fa-solid fa-spinner animate-spin"></i>
                  ) : (
                    <i className="fa-solid fa-microphone"></i>
                  )}
                </button>
              </div>

              {/* Mic Mute Toggle */}
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  disabled={status !== ConnectionStatus.CONNECTED}
                  className={`w-12 h-12 rounded-full border transition-all hover:scale-110 active:scale-95 flex items-center justify-center ${
                    status !== ConnectionStatus.CONNECTED 
                      ? 'bg-white/5 border-white/5 text-white/10 opacity-50 cursor-not-allowed'
                      : isMuted
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                        : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                  }`}
                  title={isMuted ? "Unmute Mic" : "Mute Mic"}
                >
                  <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                </button>
                <span className="text-[8px] uppercase tracking-tighter text-white/20 font-bold">{isMuted ? 'Muted' : 'Voice'}</span>
              </div>
            </div>

            <div className="mt-4 mb-4 flex flex-col items-center gap-2">
              <p className="text-sm uppercase tracking-widest text-white/40 font-medium">
                {status === ConnectionStatus.CONNECTED ? 'Tap to disconnect' : status === ConnectionStatus.CONNECTING ? 'Connecting...' : 'Tap to Start'}
              </p>
              {status === ConnectionStatus.DISCONNECTED && isVoiceWakeEnabled && (
                <p className="text-[10px] uppercase tracking-[0.2em] text-rose-400/60 animate-pulse">
                  <i className="fa-solid fa-ear-listen mr-2"></i> Listening for "Lumina"...
                </p>
              )}
            </div>

            <div className="w-full max-w-lg mb-4">
              <Visualizer 
                isActive={status === ConnectionStatus.CONNECTED} 
                isModelThinking={isLuminaThinking} 
                theme={currentTheme}
                analyserRef={analyserRef}
              />
            </div>
          </div>

          {/* Conversation Log */}
          <div className="w-full flex flex-col gap-4 mt-auto">
            <div className="bg-black/10 backdrop-blur-md border border-white/5 rounded-3xl p-6 overflow-y-auto max-h-[250px] scroll-smooth shadow-inner relative group/log min-h-[100px]">
              <div className="space-y-6">
                {transcriptions.length === 0 ? (
                  <div className="h-20 flex items-center justify-center text-white/20 italic font-light text-center px-4 text-xs">
                    "Loneliness is the craving for companionship. <br/>Speak, I am here to listen."
                  </div>
                ) : (
                  transcriptions.map((t) => (
                    <div key={t.id} className={`flex flex-col animate-bubble-in ${t.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                        t.role === 'user' 
                          ? 'bg-white/10 text-white border border-white/5 rounded-tr-none' 
                          : 'bg-black/20 text-white/90 border border-white/5 rounded-tl-none'
                      }`}
                      style={t.role === 'user' ? { borderLeft: `2px solid ${currentTheme.accentColor}` } : {}}
                      >
                        {t.text}
                      </div>
                      <span className="text-[10px] text-white/20 mt-1 uppercase tracking-tighter">
                        {t.role === 'user' ? 'You' : 'Lumina'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Conversation Controls (Outside Container) */}
            {transcriptions.length > 0 && (
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  {showClearConfirm ? (
                    <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-300">
                      <button 
                        onClick={clearHistory}
                        className="px-4 py-2 rounded-full bg-rose-500/80 text-[10px] uppercase tracking-widest text-white hover:bg-rose-600 transition-all font-bold"
                      >
                        Confirm
                      </button>
                      <button 
                        onClick={() => setShowClearConfirm(false)}
                        className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest text-white/30 hover:text-white transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowClearConfirm(true)}
                      className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest text-white/30 hover:text-rose-400 hover:border-rose-500/20 transition-all flex items-center gap-2"
                    >
                      <i className="fa-solid fa-trash-can text-[8px]"></i> Clear Chat
                    </button>
                  )}
                </div>

                <button 
                  onClick={downloadHistory}
                  className="px-6 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
                >
                  <i className="fa-solid fa-download"></i> Save Journal
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Footer Info */}
        <footer className="w-full mt-8 flex justify-between items-center text-white/20 text-[10px] uppercase tracking-widest pt-4 border-t border-white/5">
          <div className="flex items-center gap-3">
            <span>v{APP_VERSION}</span>
            <span className="opacity-50">|</span>
            <span className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${
                status === ConnectionStatus.CONNECTED ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                status === ConnectionStatus.CONNECTING ? 'bg-amber-500 animate-pulse' : 
                status === ConnectionStatus.ERROR ? 'bg-rose-500' :
                'bg-white/20'
              }`}></div>
              {status === ConnectionStatus.CONNECTED ? 'Live' : 
               status === ConnectionStatus.CONNECTING ? 'Syncing' : 
               status === ConnectionStatus.ERROR ? 'Offline' : 'Standby'}
            </span>
          </div>
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><i className="fa-solid fa-lock text-[8px]"></i> Encrypted</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
