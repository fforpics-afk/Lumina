import { ThemeConfig } from '../types';

export const THEMES: ThemeConfig[] = [
  {
    name: 'Midnight Serenity',
    backgroundClass: 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950',
    accentColor: '#6366f1', // indigo-500
    visualizerUserColor: '180, 80%, 70%',
    visualizerModelColor: '260, 80%, 70%',
    buttonClass: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20',
  },
  {
    name: 'Calm Ocean',
    backgroundClass: 'bg-gradient-to-br from-cyan-950 via-teal-900 to-emerald-950',
    accentColor: '#14b8a6', // teal-500
    visualizerUserColor: '160, 80%, 60%',
    visualizerModelColor: '190, 80%, 60%',
    buttonClass: 'bg-teal-600 hover:bg-teal-500 shadow-teal-500/20',
  },
  {
    name: 'Warm Sunset',
    backgroundClass: 'bg-gradient-to-br from-orange-950 via-rose-900 to-purple-950',
    accentColor: '#f43f5e', // rose-500
    visualizerUserColor: '30, 90%, 60%',
    visualizerModelColor: '330, 80%, 60%',
    buttonClass: 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20',
  }
];
