import React, { useState, useEffect } from 'react';

interface BreathingExerciseProps {
  isVisible: boolean;
  onClose: () => void;
}

export const BreathingExercise: React.FC<BreathingExerciseProps> = ({ isVisible, onClose }) => {
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale' | 'prepare'>('prepare');
  const [timer, setTimer] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (phase === 'prepare') {
            if (prev >= 3) {
              setPhase('inhale');
              return 0;
            }
          } else if (phase === 'inhale') {
            if (prev >= 4) {
              setPhase('hold');
              return 0;
            }
          } else if (phase === 'hold') {
            if (prev >= 7) {
              setPhase('exhale');
              return 0;
            }
          } else if (phase === 'exhale') {
            if (prev >= 8) {
              setPhase('inhale');
              return 0;
            }
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, phase]);

  if (!isVisible) return null;

  const startExercise = () => {
    setIsActive(true);
    setPhase('prepare');
    setTimer(0);
  };

  const getPhaseText = () => {
    switch (phase) {
      case 'prepare': return 'Get ready...';
      case 'inhale': return 'Breathe in...';
      case 'hold': return 'Hold...';
      case 'exhale': return 'Breathe out...';
    }
  };

  const getCircleScale = () => {
    if (!isActive || phase === 'prepare') return 'scale-100';
    if (phase === 'inhale') return 'scale-[1.8] duration-[4000ms]';
    if (phase === 'hold') return 'scale-[1.8]';
    if (phase === 'exhale') return 'scale-100 duration-[8000ms]';
    return 'scale-100';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-500">
      <div className="relative bg-white/5 border border-white/10 rounded-[3rem] p-8 max-w-sm w-full flex flex-col items-center shadow-2xl">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"
        >
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>

        <h2 className="text-xl font-light text-white/90 mb-2 tracking-tight">Pause & Breathe</h2>
        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-12">4-7-8 Technique</p>

        <div className="relative flex items-center justify-center w-48 h-48 mb-12">
          {/* Outer glow */}
          <div className={`absolute inset-0 bg-rose-500/20 rounded-full blur-3xl transition-transform ease-in-out ${getCircleScale()}`}></div>
          
          {/* Main circle */}
          <div className={`w-32 h-32 bg-gradient-to-br from-rose-400/80 to-rose-600/80 rounded-full flex items-center justify-center transition-transform ease-in-out shadow-lg ${getCircleScale()}`}>
            <div className="w-28 h-28 border-2 border-white/20 rounded-full flex items-center justify-center">
              <span className="text-white text-3xl font-light">{isActive ? (phase === 'prepare' ? 3 - timer : timer || (phase === 'inhale' ? 4 : phase === 'hold' ? 7 : 8)) : ''}</span>
            </div>
          </div>
        </div>

        <p className="text-lg font-light text-white/80 h-8 mb-8">
          {isActive ? getPhaseText() : "Lumina noticed you might need a moment."}
        </p>

        {!isActive ? (
          <button 
            onClick={startExercise}
            className="px-8 py-3 bg-white text-black rounded-full text-xs uppercase tracking-widest font-semibold hover:bg-rose-100 transition-all shadow-xl"
          >
            Start Breathing
          </button>
        ) : (
          <button 
            onClick={() => setIsActive(false)}
            className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition-colors"
          >
            End Session
          </button>
        )}
        
        <p className="mt-8 text-center text-[10px] text-white/30 leading-relaxed max-w-[200px]">
          Inhale for 4, hold for 7, and exhale completely for 8.
        </p>
      </div>
    </div>
  );
};
