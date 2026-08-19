
import { useState, useEffect } from 'react';

export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'night' | 'stormy';

interface WeatherData {
  condition: WeatherCondition;
  temp: number;
  location: string;
}

export const useWeather = () => {
  const [weather, setWeather] = useState<WeatherData>({
    condition: 'sunny',
    temp: 20,
    location: 'Unknown'
  });

  useEffect(() => {
    const fetchWeather = async (lat: number, lon: number) => {
      try {
        // Check cache
        const cached = localStorage.getItem('lumina_weather_v2');
        const cacheTime = localStorage.getItem('lumina_weather_v2_time');
        const now = Date.now();

        if (cached && cacheTime && now - parseInt(cacheTime) < 15 * 60 * 1000) { // 15 mins cache
          setWeather(JSON.parse(cached));
          return;
        }

        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
        );
        const data = await response.json();
        const code = data.current_weather.weathercode;
        const temp = data.current_weather.temperature;

        let condition: WeatherCondition = 'sunny';
        // WMO Weather interpretation codes (WW)
        if (code === 0) condition = 'sunny';
        else if (code <= 3) condition = 'cloudy';
        else if (code >= 51 && code <= 67) condition = 'rainy';
        else if (code >= 71 && code <= 77) condition = 'snowy';
        else if (code >= 80 && code <= 82) condition = 'rainy';
        else if (code >= 95) condition = 'stormy';

        // Check if it's night
        const hour = new Date().getHours();
        if ((hour >= 20 || hour < 5) && condition === 'sunny') {
          condition = 'night';
        }

        const info: WeatherData = { condition, temp, location: 'Local Area' };
        setWeather(info);
        
        // Save to cache
        localStorage.setItem('lumina_weather_v2', JSON.stringify(info));
        localStorage.setItem('lumina_weather_v2_time', now.toString());
      } catch (error) {
        console.error('Weather fetch error:', error);
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        () => {
          // Fallback if geo fails
          const hour = new Date().getHours();
          const isNight = hour >= 20 || hour < 5;
          setWeather(prev => ({ ...prev, condition: isNight ? 'night' : 'sunny' }));
        }
      );
    }
  }, []);

  return weather;
};
