import { LocationData, WeatherData, HourlyForecast } from './types';

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache
const WEATHER_CACHE_KEY = 'heatshield_weather_cache_';

export const DEFAULT_LOCATIONS: LocationData[] = [
  { name: 'Chennai', locality: 'Tamil Nadu, India', latitude: 13.0827, longitude: 80.2707, country: 'India' },
  { name: 'New Delhi', locality: 'Delhi, India', latitude: 28.6139, longitude: 77.2090, country: 'India' },
  { name: 'Mumbai', locality: 'Maharashtra, India', latitude: 19.0760, longitude: 72.8777, country: 'India' },
  { name: 'Bengaluru', locality: 'Karnataka, India', latitude: 12.9716, longitude: 77.5946, country: 'India' },
  { name: 'Phoenix', locality: 'Arizona, USA', latitude: 33.4484, longitude: -112.0740, country: 'United States' },
  { name: 'London', locality: 'England, UK', latitude: 51.5074, longitude: -0.1278, country: 'United Kingdom' },
];

export async function fetchWeatherData(
  lat: number,
  lon: number,
  locationName: string = 'Current Location'
): Promise<WeatherData> {
  const cacheKey = `${WEATHER_CACHE_KEY}${lat.toFixed(2)}_${lon.toFixed(2)}`;

  // Try cache first (within 15-min TTL)
  if (typeof window !== 'undefined') {
    const cachedStr = localStorage.getItem(cacheKey);
    if (cachedStr) {
      try {
        const cachedObj = JSON.parse(cachedStr) as { data: WeatherData; timestamp: number };
        if (Date.now() - cachedObj.timestamp < CACHE_TTL_MS) {
          const ageMs = Date.now() - cachedObj.timestamp;
          const ageMins = Math.floor(ageMs / 60000);
          return {
            ...cachedObj.data,
            is_cached: true,  // Served from localStorage cache (not live API)
            cache_timestamp: ageMins === 0 ? 'Just now' : `${ageMins} min ago`,
          };
        }
      } catch (e) {
        console.warn('Failed to parse weather cache', e);
      }
    }
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,surface_pressure,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&forecast_days=2&timezone=auto`;

    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) {
      throw new Error(`Open-Meteo API returned status ${response.status}`);
    }

    const data = await response.json();
    const current = data.current || {};
    const hourly = data.hourly || {};

    const hourlyForecasts: HourlyForecast[] = [];
    if (hourly.time && Array.isArray(hourly.time)) {
      const nowIdx = hourly.time.findIndex((t: string) => new Date(t) >= new Date()) || 0;
      const forecastSlice = hourly.time.slice(nowIdx, nowIdx + 24);

      forecastSlice.forEach((t: string, idx: number) => {
        const actualIdx = nowIdx + idx;
        hourlyForecasts.push({
          time: t,
          temperature: hourly.temperature_2m?.[actualIdx] ?? 32,
          relative_humidity: hourly.relative_humidity_2m?.[actualIdx] ?? 60,
          apparent_temperature: hourly.apparent_temperature?.[actualIdx] ?? 35,
          wind_speed: hourly.wind_speed_10m?.[actualIdx] ?? 12,
          weather_code: hourly.weather_code?.[actualIdx] ?? 0,
        });
      });
    }

    const weatherObj: WeatherData = {
      temperature: Math.round((current.temperature_2m ?? 33) * 10) / 10,
      relative_humidity: Math.round(current.relative_humidity_2m ?? 65),
      apparent_temperature: Math.round((current.apparent_temperature ?? 37) * 10) / 10,
      wind_speed: Math.round((current.wind_speed_10m ?? 14) * 10) / 10,
      pressure: Math.round(current.surface_pressure ?? 1010),
      weather_code: current.weather_code ?? 0,
      timestamp: new Date().toISOString(),
      is_cached: false,
      location: {
        name: locationName,
        latitude: lat,
        longitude: lon,
      },
      hourly_forecast: hourlyForecasts,
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ data: weatherObj, timestamp: Date.now() })
      );
    }

    return weatherObj;
  } catch (err) {
    console.warn('Weather API request failed, checking for stale cache or fallback', err);

    // Check for stale cache if fetch fails
    if (typeof window !== 'undefined') {
      const cachedStr = localStorage.getItem(cacheKey);
      if (cachedStr) {
        try {
          const cachedObj = JSON.parse(cachedStr) as { data: WeatherData; timestamp: number };
          return {
            ...cachedObj.data,
            is_cached: true,
            cache_timestamp: new Date(cachedObj.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
        } catch (e) {
          // Fall through
        }
      }
    }

    // Emergency fallback: no API and no cache available
    return {
      temperature: 34.5,
      relative_humidity: 68,
      apparent_temperature: 41.2,
      wind_speed: 12.5,
      pressure: 1008,
      weather_code: 1,
      timestamp: new Date().toISOString(),
      is_cached: true,
      is_fallback: true,   // Hardcoded emergency data — not a real observation
      cache_timestamp: 'Unavailable',
      location: {
        name: locationName,
        latitude: lat,
        longitude: lon,
      },
      hourly_forecast: generateFallbackHourly(34.5, 68),
    };
  }
}

export async function searchLocations(query: string): Promise<LocationData[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return DEFAULT_LOCATIONS.filter(l => l.name.toLowerCase().includes(query.toLowerCase()));

    const data = await response.json();
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results.map((r: any) => ({
      name: r.name,
      locality: [r.admin1, r.country].filter(Boolean).join(', '),
      latitude: r.latitude,
      longitude: r.longitude,
      country: r.country,
    }));
  } catch (err) {
    console.warn('Geocoding search failed', err);
    return DEFAULT_LOCATIONS.filter(l => l.name.toLowerCase().includes(query.toLowerCase()));
  }
}

function generateFallbackHourly(baseTemp: number, baseHumidity: number): HourlyForecast[] {
  const forecasts: HourlyForecast[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const hourTime = new Date(now.getTime() + i * 3600 * 1000);
    const hourOfDay = hourTime.getHours();
    
    // Diurnal variation peak at 14:00
    const tempVar = Math.sin((hourOfDay - 8) * (Math.PI / 12)) * 4;
    const temp = Math.round((baseTemp + tempVar) * 10) / 10;
    const hum = Math.max(30, Math.min(95, Math.round(baseHumidity - tempVar * 2)));

    forecasts.push({
      time: hourTime.toISOString(),
      temperature: temp,
      relative_humidity: hum,
      apparent_temperature: Math.round((temp + (hum / 100) * 5) * 10) / 10,
      wind_speed: Math.round((10 + Math.random() * 8) * 10) / 10,
      weather_code: 0,
    });
  }
  return forecasts;
}
