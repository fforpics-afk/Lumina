import React, { useState, useEffect, useRef } from 'react';

const SOUNDSCAPES = [
  { id: 'none', name: 'Silent', icon: 'fa-volume-mute', url: '' },
  { id: 'rain', name: 'Rain', icon: 'fa-cloud-showers-heavy', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' }, // Using placeholders for now
  { id: 'forest', name: 'Forest', icon: 'fa-tree', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 'waves', name: 'Waves', icon: 'fa-water', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: 'fire', name: 'Fireplace', icon: 'fa-fire', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
];

// Real royalty-free ambient loops (low-volume, soothing)
const REAL_SOUNDS: Record<string, string> = {
  rain: 'https://assets.mixkit.co/sfx/preview/mixkit-light-rain-loop-2393.mp3',
  forest: 'https://assets.mixkit.co/sfx/preview/mixkit-forest-birds-and-crickets-ambience-1210.mp3',
  waves: 'https://assets.mixkit.co/sfx/preview/mixkit-sea-waves-loop-1196.mp3',
  fire: 'https://assets.mixkit.co/sfx/preview/mixkit-fireplace-crackling-loop-3039.mp3',
};

export const AmbientPlayer: React.FC = () => {
  const [activeSound, setActiveSound] = useState('none');
  const [volume, setVolume] = useState(0.2);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (activeSound === 'none') {
      audioRef.current?.pause();
    } else {
      if (audioRef.current) {
        audioRef.current.src = REAL_SOUNDS[activeSound];
        audioRef.current.loop = true;
        audioRef.current.volume = volume;
        audioRef.current.play().catch(e => console.log('Audio play blocked:', e));
      }
    }
  }, [activeSound]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  return (
    <div className="mt-8 pt-8 border-t border-white/10 w-full">
      <label className="text-[10px] uppercase tracking-widest text-white/50 block mb-4">Ambient Soundscape</label>
      <div className="flex flex-wrap gap-3 justify-center">
        {SOUNDSCAPES.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSound(s.id)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              activeSound === s.id 
                ? 'bg-white text-black shadow-lg scale-110' 
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
            title={s.name}
          >
            <i className={`fa-solid ${s.icon} text-sm`}></i>
          </button>
        ))}
      </div>
      
      {activeSound !== 'none' && (
        <div className="mt-4 px-4">
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
          />
          <div className="flex justify-between text-[8px] text-white/20 mt-1 uppercase tracking-tighter">
            <span>Mute</span>
            <span>Ambience Volume</span>
            <span>Max</span>
          </div>
        </div>
      )}
      <audio ref={audioRef} />
    </div>
  );
};
