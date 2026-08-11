'use client';


import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Check, MapPin, Search, ArrowRight, Lock } from 'lucide-react';
import { saveUserProfile, getUserProfile } from '@/lib/store';
import { ActivityLevel, AgeGroup, CoolingAccess, ExposureDuration, ExposureType, Language, LocationData } from '@/lib/types';
import { DEFAULT_LOCATIONS, searchLocations } from '@/lib/weather-api';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Form State
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('adult');
  const [exposure, setExposure] = useState<ExposureType>('occasional');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [exposureDuration, setExposureDuration] = useState<ExposureDuration>('moderate');
  const [coolingAccess, setCoolingAccess] = useState<CoolingAccess>('good');
  const [language, setLanguage] = useState<Language>('en');
  const [location, setLocation] = useState<LocationData>(DEFAULT_LOCATIONS[0]);

  // Location search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationData[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    const res = await searchLocations(searchQuery);
    setSearchResults(res);
    setSearching(false);
  };

  const handleDetectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: LocationData = {
            name: 'Detected Location',
            locality: 'Browser Coordinates',
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          setLocation(loc);
        },
        (err) => {
          alert('Unable to retrieve location. Please search manually.');
        }
      );
    }
  };

  const handleComplete = () => {
    saveUserProfile({
      age_group: ageGroup,
      exposure,
      activity_level: activityLevel,
      exposure_duration: exposureDuration,
      cooling_access: coolingAccess,
      language,
      location,
    });
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 font-sans">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
        {/* Wizard Step Progress */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-8">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm text-white font-mono">HEAT PROFILE ONBOARDING</span>
          </div>
          <span className="text-xs font-mono text-emerald-400">Step {step} of 3</span>
        </div>

        {/* STEP 1: Context & Exposure */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Activity & Heat Exposure Context</h2>
              <p className="text-xs text-slate-400">Select your typical daily work and environmental patterns.</p>
            </div>

            {/* Age Group */}
            <div>
              <label className="block text-xs font-bold font-mono text-slate-300 uppercase mb-2">Age Group</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'adult', label: 'Adult (18-64)' },
                  { id: 'older_adult', label: 'Older Adult (65+)' },
                  { id: 'child', label: 'Child / Youth' },
                  { id: 'prefer_not_to_say', label: 'Prefer not to say' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAgeGroup(opt.id as AgeGroup)}
                    className={`p-3 rounded-lg text-xs font-semibold text-left border transition ${
                      ageGroup === opt.id ? 'bg-emerald-900/60 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Exposure Pattern */}
            <div>
              <label className="block text-xs font-bold font-mono text-slate-300 uppercase mb-2">Primary Exposure</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'indoors', label: 'Mostly Indoors' },
                  { id: 'occasional', label: 'Outdoor Occasionally' },
                  { id: 'work', label: 'Outdoor Work / Labor' },
                  { id: 'physical', label: 'High Physical Exercise' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setExposure(opt.id as ExposureType)}
                    className={`p-3 rounded-lg text-xs font-semibold text-left border transition ${
                      exposure === opt.id ? 'bg-emerald-900/60 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow transition"
            >
              <span>Continue to Recovery & Language</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: Cooling & Language */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Cooling Access & Preferences</h2>
              <p className="text-xs text-slate-400">How do you manage thermal recovery during high heat?</p>
            </div>

            {/* Cooling Availability */}
            <div>
              <label className="block text-xs font-bold font-mono text-slate-300 uppercase mb-2">Cooling Availability</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'good', label: 'Good (AC / Shade)' },
                  { id: 'limited', label: 'Limited / Restricted' },
                  { id: 'prefer_not_to_say', label: 'Not Specified' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCoolingAccess(opt.id as CoolingAccess)}
                    className={`p-3 rounded-lg text-xs font-semibold text-left border transition ${
                      coolingAccess === opt.id ? 'bg-emerald-900/60 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preferred Language */}
            <div>
              <label className="block text-xs font-bold font-mono text-slate-300 uppercase mb-2">Interface Language</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'en', label: 'English' },
                  { id: 'ta', label: 'à®¤à®®à®¿à®´à¯ (Tamil)' },
                  { id: 'hi', label: 'à¤¹à¤¿à¤¨à¥à¤¦à¥€ (Hindi)' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLanguage(opt.id as Language)}
                    className={`p-3 rounded-lg text-xs font-semibold text-center border transition ${
                      language === opt.id ? 'bg-emerald-900/60 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="w-1/3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="w-2/3 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow transition"
              >
                <span>Continue to Location</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Location Selection */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Set Primary Location</h2>
              <p className="text-xs text-slate-400">Used to fetch real-time environmental Open-Meteo weather data.</p>
            </div>

            {/* Browser Geolocation Button */}
            <button
              type="button"
              onClick={handleDetectLocation}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition"
            >
              <MapPin className="w-4 h-4" />
              <span>Use Current Browser Location</span>
            </button>

            {/* Manual Location Search */}
            <form onSubmit={handleSearch} className="space-y-2">
              <label className="block text-xs font-bold font-mono text-slate-300 uppercase">Or Search City / Region</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Chennai, Delhi, Phoenix..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-slate-800 text-white text-xs rounded-lg border border-slate-700 px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg border border-slate-700"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>
            </form>

            {/* Search Results / Default Presets */}
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-slate-400">SELECTED / QUICK SELECTION:</span>
              <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
                {(searchResults.length > 0 ? searchResults : DEFAULT_LOCATIONS).map((loc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLocation(loc)}
                    className={`p-2.5 rounded-lg text-xs font-medium text-left border flex items-center justify-between transition ${
                      location.name === loc.name ? 'bg-emerald-900/60 border-emerald-500 text-white' : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <span className="font-bold">{loc.name}</span>
                      {loc.locality && <span className="text-[11px] text-slate-400 ml-1.5">({loc.locality})</span>}
                    </div>
                    {location.name === loc.name && <Check className="w-4 h-4 text-emerald-400" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Privacy Explanation Notice */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center gap-2 text-[11px] text-slate-400 font-mono">
              <Lock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>We never publicly expose your exact location or private health records.</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="w-1/3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition"
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                className="w-2/3 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow transition"
              >
                <span>Save Profile & Launch Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
