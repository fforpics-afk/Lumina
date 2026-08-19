
import React, { useEffect, useRef } from 'react';
import { WeatherCondition } from '../hooks/useWeather';

interface WeatherOverlayProps {
  condition: WeatherCondition;
}

export const WeatherOverlay: React.FC<WeatherOverlayProps> = ({ condition }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (condition !== 'rainy' && condition !== 'snowy' && condition !== 'stormy') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const particles: any[] = [];
    const particleCount = condition === 'stormy' ? 150 : 100;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        length: Math.random() * 20 + 10,
        speed: Math.random() * 10 + 5,
        opacity: Math.random() * 0.5 + 0.2
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (condition === 'rainy' || condition === 'stormy') {
        ctx.strokeStyle = 'rgba(174, 194, 224, 0.5)';
        ctx.lineWidth = 1;
        particles.forEach(p => {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + (condition === 'stormy' ? 2 : 0), p.y + p.length);
          ctx.stroke();

          p.y += p.speed;
          if (p.y > canvas.height) {
            p.y = -p.length;
            p.x = Math.random() * canvas.width;
          }
        });
      } else if (condition === 'snowy') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        particles.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.random() * 3 + 1, 0, Math.PI * 2);
          ctx.fill();

          p.y += p.speed * 0.3;
          p.x += Math.sin(p.y * 0.01) * 1;
          if (p.y > canvas.height) {
            p.y = -5;
            p.x = Math.random() * canvas.width;
          }
        });
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [condition]);

  if (condition !== 'rainy' && condition !== 'snowy' && condition !== 'stormy') return null;

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
  );
};
