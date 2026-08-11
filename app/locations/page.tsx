'use client';


import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { getSavedLocations, toggleSaveLocation, saveUserProfile, getUserProfile } from '@/lib/store';
import { DEFAULT_LOCATIONS, searchLocations, fetchWeatherData } from '@/lib/weather-api';
import { LocationData, WeatherData } from '@/lib/types';
import { Bookmark, MapPin, Search, Plus, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LocationsPage() {
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [savedLocations, setSavedLocations] = useState<LocationData[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationData[]>([]);
  const [searching, setSearching] = useState(false);
  const [weatherMap, setWeatherMap] = useState<Record<string, WeatherData>>({});

  useEffect(() => {
    const saved = getSavedLocations();
    setSavedLocations(saved);
    fetchSavedWeather(saved);
  }, []);

  const fetchSavedWeather = async (locs: LocationData[]) => {
    const map: Record<string, WeatherData> = {};
    for (const loc of locs) {
      try {
        const w = await fetchWeatherData(loc.latitude, loc.longitude, loc.name);
        map[loc.name] = w;
      } catch (e) {}
    }
    setWeatherMap(map);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    const res = await searchLocations(query);
    setResults(res);
    setSearching(false);
  };

  const handleSelectActive = (loc: LocationData) => {
    saveUserProfile({ location: loc });
    router.push('/dashboard');
  };

  const handleToggleSave = (loc: LocationData) => {
    const updated = toggleSaveLocation(loc);
    setSavedLocations(updated);
    fetchSavedWeather(updated);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <h1 className="text-xl font-bold text-slate-900">LOCATION SYSTEM</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              Search global weather streams, save places, & switch active heat monitoring context
            </p>

            <form onSubmit={handleSearch} className="mt-4 flex gap-2">
              <input
                type="text"
                placeholder="Search city, town or region..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-lg px-3 py-2"
              />
              <button
                type="submit"
                disabled={searching}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{searching ? 'Searching...' : 'Search'}</span>
              </button>
            </form>
          </div>

          {/* Search Results */}
          {results.length > 0 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="text-xs font-bold font-mono text-slate-500 uppercase mb-3">Search Results</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.map((loc, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold">{loc.name}</div>
                      <div className="text-xs text-slate-500">{loc.locality}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleSave(loc)}
                        className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 text-xs font-medium"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleSelectActive(loc)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded"
                      >
                        Set Active
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saved Locations */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="text-xs font-bold font-mono text-slate-500 uppercase mb-4">Saved Places & Monitoring Cards</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {savedLocations.map((loc, idx) => {
                const w = weatherMap[loc.name];
                return (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-slate-900">{loc.name}</div>
                        <div className="text-xs text-slate-500">{loc.locality}</div>
                      </div>
                      <button
                        onClick={() => handleToggleSave(loc)}
                        className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                      >
                        Remove
                      </button>
                    </div>

                    {w ? (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 font-mono text-xs">
                        <div>
                          <span className="text-slate-500">Temp: </span>
                          <span className="font-bold text-slate-900">{w.temperature}Â°C</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Feels: </span>
                          <span className="font-bold text-amber-700">{w.apparent_temperature}Â°C</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Humidity: </span>
                          <span className="font-bold text-blue-700">{w.relative_humidity}%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] font-mono text-slate-400">Loading conditions...</div>
                    )}

                    <button
                      onClick={() => handleSelectActive(loc)}
                      className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded text-center"
                    >
                      Select for Dashboard
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
