
export interface TranscriptionEntry {
  id: string;
  role: 'user' | 'lumina';
  text: string;
  timestamp: number;
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export type ThemeName = 'Calm Ocean' | 'Warm Sunset' | 'Midnight Serenity';

export interface ThemeConfig {
  name: ThemeName;
  backgroundClass: string;
  accentColor: string;
  visualizerUserColor: string; // hsl components: "h, s%, l%"
  visualizerModelColor: string; // hsl components: "h, s%, l%"
  buttonClass: string;
}
