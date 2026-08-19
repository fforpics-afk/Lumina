
import React, { useEffect, useRef } from 'react';
import { ThemeConfig } from '../types';

interface VisualizerProps {
  isActive: boolean;
  isModelThinking?: boolean;
  theme: ThemeConfig;
  analyserRef: React.RefObject<AnalyserNode | null>;
  intensity?: number;
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, isModelThinking, theme, analyserRef, intensity = 1.0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let frame = 0;

    const render = () => {
      frame++;
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      if (!isActive) {
        animationId = requestAnimationFrame(render);
        return;
      }

      // Get current volume from analyser
      let volume = 0;
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteTimeDomainData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        volume = Math.sqrt(sum / dataArray.length);
      }

      const centerY = height / 2;
      const waves = [
        { hueOffset: 0, opacity: 0.8, phase: 0, speed: 1 },
        { hueOffset: 30, opacity: 0.5, phase: 2, speed: 0.7 },
        { hueOffset: -30, opacity: 0.3, phase: 4, speed: 1.3 }
      ];

      waves.forEach((wave, index) => {
        const colorComponents = isModelThinking 
          ? theme.visualizerModelColor
          : theme.visualizerUserColor;
        
        const baseHue = parseInt(colorComponents.split(',')[0]);
        const color = `hsla(${baseHue + wave.hueOffset}, 80%, 60%, ${wave.opacity})`;

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = index === 0 ? 3 : 1.5;
        ctx.lineCap = 'round';

        for (let x = 0; x <= width; x += 5) {
          const distFromCenter = Math.abs(x - width / 2) / (width / 2);
          const factor = isModelThinking ? (0.5 + volume * 2.5) : (0.4 + volume * 1.5);
          const amplitude = factor * intensity * (25 * (1 - distFromCenter));
          
          const speedFactor = isModelThinking ? 0.08 : 0.04;
          const y = centerY + Math.sin(x * 0.02 + frame * speedFactor * wave.speed + wave.phase) * amplitude;
          
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [isActive, isModelThinking, theme, analyserRef, intensity]);

  return (
    <div className="relative w-full h-20 flex items-center justify-center bg-black/20 rounded-3xl overflow-hidden border border-white/5 backdrop-blur-sm">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={80} 
        className="w-full h-full"
      />
      {isActive && (
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{ background: `linear-gradient(to top, ${theme.accentColor}, transparent)` }}
        ></div>
      )}
    </div>
  );
};

export default Visualizer;
