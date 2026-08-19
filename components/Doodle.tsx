import React, { useMemo, useEffect, useState } from 'react';

interface DoodleProps {
  mood: 'neutral' | 'happy' | 'thinking' | 'calm' | 'gentle' | 'excited' | 'sad';
  climate: 'sunny' | 'cloudy' | 'night' | 'rainy' | 'snowy' | 'stormy';
  isActive: boolean;
  intensity?: number;
}

export const Doodle: React.FC<DoodleProps> = ({ mood, climate, isActive, intensity = 1 }) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    let animationId: number;
    const animate = () => {
      setFrame(f => f + 1);
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, []);

  const doodlePath = useMemo(() => {
    // Hand-drawn effect: slightly shaky lines
    const wobble = (val: number, amp = 1) => val + (Math.sin(frame * 0.1) * amp * intensity);
    
    // Background Climate
    let background = null;
    if (climate === 'sunny') {
      // Remove big sun from doodle to avoid clutter since it's on the mic now
      background = null;
    } else if (climate === 'night') {
      const moonHue = 210 + Math.sin(frame * 0.05) * 10;
      background = (
        <g stroke={`hsl(${moonHue}, 60%, 70%)`} fill="none" strokeWidth="1.5" strokeLinecap="round" opacity="0.3">
          <path d="M85,10 a8,8 0 1,0 0,16 a6,6 0 0,1 0,-16" strokeWidth="2" />
          {[75, 95, 60].map((x, i) => {
            const flicker = 0.4 + Math.sin(frame * 0.1 + i) * 0.6;
            return (
              <g key={i} style={{ opacity: flicker }}>
                <path d={`M${x},${8 + i*8} l1.5,1.5 m-1.5,0 l1.5,-1.5`} strokeWidth="1" />
              </g>
            );
          })}
        </g>
      );
    } else if (climate === 'rainy' || climate === 'stormy') {
      background = (
        <g stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" opacity="0.4">
          <path d="M75,10 q5,-5 10,0 t10,0 q5,5 0,5 h-20 q-5,0 0,-5" />
          {[0, 5, 10, 15].map(i => (
            <line 
              key={i} 
              x1={78 + i} y1={18} 
              x2={76 + i} y2={25} 
              strokeDasharray="1 3"
              style={{ transform: `translateY(${(frame * 0.5 + i * 2) % 10}px)` }}
            />
          ))}
        </g>
      );
    }

    // Mic Decorator (Removed from doodle, now a badge on mic)
    let decorator = null;

    // Mood Avatar (The Wisp)
    let avatar = null;
    const centerX = 50;
    const centerY = 20;
    const baseRadius = 12;
    const points = 12;
    const path = [];
    
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      let r = baseRadius;
      
      // Animate radius based on mood
      if (mood === 'thinking') {
        r += Math.sin(frame * 0.2 + i) * 3;
      } else if (mood === 'excited') {
        r += Math.abs(Math.sin(frame * 0.3 + i * 2)) * 6;
      } else if (mood === 'sad') {
        r -= 2 + Math.sin(frame * 0.05 + i) * 1;
      } else if (mood === 'calm' || mood === 'gentle') {
        r += Math.sin(frame * 0.08 + i * 0.5) * 1.5;
      } else if (isActive) {
        r += Math.sin(frame * 0.15 + i) * 2;
      }

      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;
      path.push(`${i === 0 ? 'M' : 'L'}${x},${y}`);
    }
    path.push('Z');

    const avatarStroke = mood === 'excited' ? '#fbbf24' : 
                         mood === 'sad' ? '#93c5fd' : 
                         mood === 'thinking' ? '#c084fc' : 
                         mood === 'gentle' ? '#f472b6' : 'currentColor';

    avatar = (
      <g>
        {/* Glow effect */}
        <path 
          d={path.join(' ')} 
          stroke={avatarStroke} 
          fill="none" 
          strokeWidth="4" 
          opacity="0.15" 
          className="transition-all duration-700"
        />
        {/* Main line */}
        <path 
          d={path.join(' ')} 
          stroke={avatarStroke} 
          fill="none" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="transition-all duration-700"
        />
        
        {/* Face/Eyes based on mood */}
        <g stroke={avatarStroke} strokeWidth="1.5" strokeLinecap="round">
          {mood === 'thinking' ? (
            <>
              <line x1={centerX - 4} y1={centerY - 1} x2={centerX - 2} y2={centerY - 1} />
              <line x1={centerX + 2} y1={centerY - 1} x2={centerX + 4} y2={centerY - 1} />
              <path d={`M${centerX-2},${centerY+3} q2,1 4,0`} />
            </>
          ) : mood === 'excited' ? (
            <>
              <path d={`M${centerX-5},${centerY-2} l2,-2 l2,2`} />
              <path d={`M${centerX+1},${centerY-2} l2,-2 l2,2`} />
              <path d={`M${centerX-3},${centerY+3} q3,3 6,0`} />
            </>
          ) : mood === 'sad' ? (
            <>
              <path d={`M${centerX-4},${centerY} q2,-1 4,0`} opacity="0.6" />
              <path d={`M${centerX+1},${centerY} q2,-1 4,0`} opacity="0.6" />
              <path d={`M${centerX-2},${centerY+4} q2,-2 4,0`} />
            </>
          ) : (
            <>
              <circle cx={centerX - 4} cy={centerY - 1} r="0.5" fill={avatarStroke} />
              <circle cx={centerX + 4} cy={centerY - 1} r="0.5" fill={avatarStroke} />
              <path d={`M${centerX-3},${centerY+3} q3,2 6,0`} />
            </>
          )}
        </g>
      </g>
    );

    return (
      <g>
        {background}
        {decorator}
        {avatar}
      </g>
    );
  }, [frame, climate, mood, isActive, intensity]);

  return (
    <div className="h-20 flex items-center justify-center overflow-hidden pointer-events-none mb-2">
      <svg width="120" height="60" viewBox="0 0 100 40" className="drop-shadow-2xl">
        {doodlePath}
      </svg>
    </div>
  );
};

