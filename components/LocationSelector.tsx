'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, Navigation, Search, Check, Lock, Building2, Loader2 } from 'lucide-react';
import { LocationData } from '@/lib/types';
import { LocationSource, KARE_CAMPUS, INSTITUTION_NAME } from '@/lib/constants';
import { searchLocations, DEFAULT_LOCATIONS } from '@/lib/weather-api';
import { getSavedLocations } from '@/lib/store';

interface LocationSelectorProps {
  currentLocation: LocationData;
  currentSource: LocationSource;
  onSelect: (location: LocationData, source: LocationSource) => void;
  onClose: () => void;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  currentLocation,
  currentSource,
  onSelect,
  onClose,
}) => {
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'denied' | 'success'>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationData[]>([]);
  const [searching, setSearching] = useState(false);
  const [savedLocations] = useState<LocationData[]>(getSavedLocations);
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus search input on open
  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 100);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }
    setGpsStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsStatus('success');
        const loc: LocationData = {
          name: 'My Location',
          locality: 'Detected via GPS',
          latitude: Math.round(pos.coords.latitude * 100) / 100,   // ~1km precision for privacy
          longitude: Math.round(pos.coords.longitude * 100) / 100,
          country: '',
          // Store actual accuracy from browser — never fabricate this value
          gps_accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : undefined,
        };
        onSelect(loc, 'GPS');
        onClose();
      },
      () => {
        setGpsStatus('denied');
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  const handleCampus = () => {
    onSelect(KARE_CAMPUS, 'CAMPUS');
    onClose();
  };

  const handleManual = (loc: LocationData) => {
    onSelect(loc, 'MANUAL');
    onClose();
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    const res = await searchLocations(searchQuery);
    setSearchResults(res.length > 0 ? res : []);
    setSearching(false);
  };

  const listToShow = searchResults.length > 0 ? searchResults : DEFAULT_LOCATIONS;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Select Location"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-slate-900 text-sm">Select Location</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close location selector"
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* GPS Option */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Automatic</p>
            <button
              onClick={handleGps}
              disabled={gpsStatus === 'requesting'}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition ${
                gpsStatus === 'denied'
                  ? 'bg-red-50 border-red-200 text-red-700 cursor-not-allowed'
                  : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800'
              }`}
            >
              {gpsStatus === 'requesting' ? (
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              ) : (
                <Navigation className="w-4 h-4 flex-shrink-0" />
              )}
              <div className="text-left">
                <div className="font-semibold">
                  {gpsStatus === 'requesting' ? 'Detecting location...' :
                   gpsStatus === 'denied' ? 'Location access denied' :
                   'Use my current GPS location'}
                </div>
                {gpsStatus === 'denied' && (
                  <div className="text-xs mt-0.5 text-red-600">
                    Please select a location manually below.
                  </div>
                )}
                {gpsStatus === 'idle' && (
                  <div className="text-xs text-emerald-600 mt-0.5">
                    Detects your location to fetch real-time local weather.
                  </div>
                )}
              </div>
            </button>
          </div>

          {/* Campus Option */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Institutional Reference</p>
            <button
              onClick={handleCampus}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition ${
                currentSource === 'CAMPUS'
                  ? 'bg-teal-100 border-teal-400 text-teal-900'
                  : 'bg-teal-50 hover:bg-teal-100 border-teal-200 text-teal-800'
              }`}
            >
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <div className="text-left flex-1">
                <div className="font-semibold">KARE Campus</div>
                <div className="text-xs text-teal-600 mt-0.5">{INSTITUTION_NAME}</div>
              </div>
              {currentSource === 'CAMPUS' && <Check className="w-4 h-4 text-teal-700 flex-shrink-0" />}
            </button>
          </div>

          {/* Saved Locations */}
          {savedLocations.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Saved Locations</p>
              <div className="space-y-1.5">
                {savedLocations.slice(0, 3).map((loc, i) => (
                  <button
                    key={i}
                    onClick={() => handleManual(loc)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-xs font-medium transition text-left ${
                      currentLocation.name === loc.name
                        ? 'bg-purple-50 border-purple-300 text-purple-800'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="font-semibold">{loc.name}</span>
                      {loc.locality && <span className="text-slate-500 ml-1">({loc.locality})</span>}
                    </div>
                    {currentLocation.name === loc.name && (
                      <Check className="w-3.5 h-3.5 text-purple-600 flex-shrink-0 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Search Any City</p>
            <form onSubmit={handleSearch} className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="e.g. Madurai, Phoenix, London..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 text-slate-800"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition disabled:opacity-50"
              >
                {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
              </button>
            </form>

            <div className="space-y-1 max-h-36 overflow-y-auto">
              {listToShow.map((loc, i) => (
                <button
                  key={i}
                  onClick={() => handleManual(loc)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium text-left transition ${
                    currentLocation.name === loc.name
                      ? 'bg-blue-50 border-blue-300 text-blue-800'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-100 text-slate-700'
                  }`}
                >
                  <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <span className="font-semibold truncate">{loc.name}</span>
                  {loc.locality && (
                    <span className="text-slate-400 truncate hidden sm:inline">({loc.locality})</span>
                  )}
                  {currentLocation.name === loc.name && (
                    <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 ml-auto" />
                  )}
                </button>
              ))}
              {searchResults.length === 0 && searchQuery && !searching && (
                <p className="text-xs text-slate-400 text-center py-2">No results found. Try a different city name.</p>
              )}
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Your location is used only to retrieve local weather conditions and calculate your heat-risk assessment. It is never shared publicly or used for tracking.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
