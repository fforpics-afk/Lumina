
import React from 'react';
import { WeatherCondition } from '../hooks/useWeather';

interface MicDecoratorProps {
  condition: WeatherCondition;
}

export const MicDecorator: React.FC<MicDecoratorProps> = ({ condition }) => {
  const isSunday = new Date().getDay() === 0;

  // We'll position these icons as "badges" on the microphone button
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Weather Badge - Top Right */}
      <div className="absolute -top-1 -right-1 animate-bounce-slow">
        {condition === 'rainy' || condition === 'stormy' ? (
          <div className="text-rose-400 text-xl drop-shadow-[0_0_8px_rgba(251,113,133,0.4)] bg-black/20 rounded-full p-1 backdrop-blur-sm border border-white/5">
            <i className="fa-solid fa-umbrella"></i>
          </div>
        ) : condition === 'snowy' ? (
          <div className="text-blue-200 text-xl drop-shadow-[0_0_8px_rgba(191,219,254,0.4)] bg-black/20 rounded-full p-1 backdrop-blur-sm border border-white/5">
            <i className="fa-solid fa-snowflake"></i>
          </div>
        ) : condition === 'clear' || condition === 'sunny' ? (
          <div className="text-amber-400 text-lg drop-shadow-[0_0_12px_rgba(251,191,36,0.6)] bg-black/40 rounded-full p-1.5 backdrop-blur-md border border-white/10">
            <i className="fa-solid fa-sun animate-spin-slow"></i>
          </div>
        ) : null}
      </div>

      {/* Sunday Badge - Bottom Left */}
      {isSunday && (
        <div className="absolute -bottom-1 -left-1 animate-pulse">
          <div className="text-indigo-400 text-lg drop-shadow-[0_0_8px_rgba(129,140,248,0.4)] bg-black/20 rounded-full p-1.5 backdrop-blur-sm border border-white/5">
            <i className="fa-solid fa-mug-hot"></i>
          </div>
        </div>
      )}
    </div>
  );
};
