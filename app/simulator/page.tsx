'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { fetchWeatherData } from '@/lib/weather-api';
import { evaluateHeatRisk } from '@/lib/risk-engine';
import { getSavedLocations, getUserProfile } from '@/lib/store';
import { compareScenarios, MANDATORY_SIMULATOR_LABEL, ScenarioComparison } from '@/lib/simulator-engine';
import { ActivityLevel, AgeGroup, CoolingAccess, ExposureDuration, LocationData, RiskAssessment, WeatherData } from '@/lib/types';
import { Sliders, RefreshCw, AlertTriangle, ArrowRight, ShieldCheck, MapPin, CheckCircle2, RotateCcw } from 'lucide-react';

export default function SimulatorPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Baseline State
  const [profile, setProfile] = useState(getUserProfile());
  const [baselineWeather, setBaselineWeather] = useState<WeatherData | null>(null);
  const [baselineRisk, setBaselineRisk] = useState<RiskAssessment | null>(null);
  const [loadingBaseline, setLoadingBaseline] = useState(true);

  // Scenario State
  const [simLocation, setSimLocation] = useState<LocationData>(
    profile.location || { name: 'Chennai', latitude: 13.0827, longitude: 80.2707 }
  );
  const [simWeather, setSimWeather] = useState<WeatherData | null>(null);
  const [loadingSimWeather, setLoadingSimWeather] = useState(false);

  const [simActivity, setSimActivity] = useState<ActivityLevel>('high');
  const [simDuration, setSimDuration] = useState<ExposureDuration>('long');
  const [simCooling, setSimCooling] = useState<CoolingAccess>('limited');
  const [simAgeGroup, setSimAgeGroup] = useState<AgeGroup>('adult');

  const savedLocations = getSavedLocations();

  // Load Baseline Weather & Risk on Mount
  useEffect(() => {
    const p = getUserProfile();
    setProfile(p);

    // Initial controls derived from profile
    setSimActivity(p.activity_level);
    setSimDuration(p.exposure_duration);
    setSimCooling(p.cooling_access);
    setSimAgeGroup(p.age_group);

    const initialLoc = p.location || { name: 'Chennai', latitude: 13.0827, longitude: 80.2707 };
    setSimLocation(initialLoc);

    setLoadingBaseline(true);
    fetchWeatherData(initialLoc.latitude, initialLoc.longitude, initialLoc.name).then((w) => {
      setBaselineWeather(w);
      setSimWeather(w);
      const r = evaluateHeatRisk(w, {
        activity: p.activity_level,
        duration: p.exposure_duration,
        cooling: p.cooling_access,
        age_group: p.age_group,
      });
      setBaselineRisk(r);
      setLoadingBaseline(false);
    }).catch(() => {
      setLoadingBaseline(false);
    });
  }, []);

  // Handle Location Switcher in Simulator
  const handleLocationChange = async (loc: LocationData) => {
    setSimLocation(loc);
    setLoadingSimWeather(true);
    try {
      const w = await fetchWeatherData(loc.latitude, loc.longitude, loc.name);
      setSimWeather(w);
    } catch (e) {
      setSimWeather(null);
    } finally {
      setLoadingSimWeather(false);
    }
  };

  // Reset Scenario to Baseline
  const handleResetScenario = () => {
    const p = getUserProfile();
    const defaultLoc = p.location || { name: 'Chennai', latitude: 13.0827, longitude: 80.2707 };
    setSimActivity(p.activity_level);
    setSimDuration(p.exposure_duration);
    setSimCooling(p.cooling_access);
    setSimAgeGroup(p.age_group);
    setSimLocation(defaultLoc);
    setSimWeather(baselineWeather);
  };

  // Compute Scenario Comparison
  const comparison: ScenarioComparison = compareScenarios(
    { weather: baselineWeather, risk: baselineRisk },
    {
      location: simLocation,
      weather: simWeather,
      activity: simActivity,
      duration: simDuration,
      cooling: simCooling,
      age_group: simAgeGroup,
    }
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 text-emerald-400">
                <Sliders className="w-5 h-5" />
                <h1 className="text-xl font-bold text-slate-100">HEATSHIELD RISK SCENARIO SIMULATOR</h1>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Explore how workload, duration, cooling access, & microclimate changes impact heat-risk
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono font-extrabold px-3 py-1 bg-amber-950/60 text-amber-300 rounded border border-amber-800/80">
                {MANDATORY_SIMULATOR_LABEL}
              </span>
              <button
                onClick={handleResetScenario}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Baseline</span>
              </button>
            </div>
          </div>

          {/* Safety Disclaimer Banner */}
          <div className="p-3.5 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-start gap-2.5 text-xs text-amber-200 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <strong className="block font-mono text-[11px] uppercase text-amber-300">DECISION-SUPPORT SCENARIO ESTIMATE NOTICE</strong>
              <span className="text-slate-300">
                Simulated outputs represent estimated environmental heat-risk under hypothetical conditions. They do <strong>NOT</strong> constitute medical diagnosis, predict illness, or guarantee health outcomes.
              </span>
            </div>
          </div>

          {/* Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (5 cols): Baseline Card & Scenario Controls */}
            <div className="lg:col-span-5 space-y-6">
              {/* Baseline Summary Card */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-bold font-mono text-slate-400 uppercase">LIVE CURRENT BASELINE</h3>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      baselineWeather?.is_cached
                        ? 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                        : baselineWeather
                        ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                        : 'bg-rose-950/60 text-rose-400 border-rose-800/60'
                    }`}
                  >
                    STATUS: {baselineWeather ? (baselineWeather.is_cached ? 'CACHED' : 'LIVE') : 'UNAVAILABLE'}
                  </span>
                </div>

                {loadingBaseline || !baselineWeather || !baselineRisk ? (
                  <div className="p-4 text-center font-mono text-xs text-slate-400 animate-pulse">
                    Loading live baseline observations...
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span>{baselineWeather.location?.name}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-100">
                        {baselineWeather.temperature}°C (Feels {baselineWeather.apparent_temperature}°C)
                      </span>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-mono text-slate-400">CURRENT BASELINE SCORE</div>
                        <div className="text-xl font-bold font-mono text-slate-100">
                          {baselineRisk.risk_score} <span className="text-xs text-slate-400 font-sans">/ 100</span>
                        </div>
                      </div>
                      <span
                        className={`font-bold px-2.5 py-1 text-xs rounded uppercase ${
                          baselineRisk.risk_level === 'EXTREME'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : baselineRisk.risk_level === 'HIGH'
                            ? 'bg-orange-950 text-orange-300 border border-orange-800'
                            : baselineRisk.risk_level === 'MODERATE'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {baselineRisk.risk_level}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Scenario Control Panel */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xs space-y-5">
                <h3 className="text-xs font-bold font-mono text-slate-400 uppercase pb-2 border-b border-slate-800">
                  SCENARIO CONTROLS
                </h3>

                {/* Location Switcher */}
                <div>
                  <label className="block text-xs font-bold font-mono text-slate-300 uppercase mb-1.5">
                    Location Scenario
                  </label>
                  <select
                    value={simLocation.name}
                    onChange={(e) => {
                      const selected = savedLocations.find((l) => l.name === e.target.value) || {
                        name: e.target.value,
                        latitude: e.target.value === 'New Delhi' ? 28.6139 : 13.0827,
                        longitude: e.target.value === 'New Delhi' ? 77.209 : 80.2707,
                      };
                      handleLocationChange(selected);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-lg p-2.5 font-medium focus:outline-none focus:border-emerald-500"
                  >
                    <option value={profile.location?.name || 'Chennai'}>
                      {profile.location?.name || 'Chennai'} (Current)
                    </option>
                    <option value="New Delhi">New Delhi, India</option>
                    <option value="Chennai">Chennai, India</option>
                    {savedLocations.map((l, idx) => (
                      <option key={idx} value={l.name}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  {loadingSimWeather && (
                    <span className="text-[11px] font-mono text-slate-400 mt-1 block animate-pulse">
                      Fetching live Open-Meteo weather for scenario location...
                    </span>
                  )}
                </div>

                {/* Activity Level Toggle */}
                <div>
                  <label className="block text-xs font-bold font-mono text-slate-300 uppercase mb-1.5">
                    Physical Activity Workload
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'low', label: 'Low' },
                      { id: 'moderate', label: 'Moderate' },
                      { id: 'high', label: 'High Physical' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setSimActivity(opt.id as ActivityLevel)}
                        className={`p-2.5 rounded-lg text-xs font-semibold border transition ${
                          simActivity === opt.id
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exposure Duration Toggle */}
                <div>
                  <label className="block text-xs font-bold font-mono text-slate-300 uppercase mb-1.5">
                    Continuous Sun / Outdoor Exposure
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'short', label: 'Short (<1h)' },
                      { id: 'moderate', label: 'Moderate (1-3h)' },
                      { id: 'long', label: 'Long (>3h)' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setSimDuration(opt.id as ExposureDuration)}
                        className={`p-2.5 rounded-lg text-xs font-semibold border transition ${
                          simDuration === opt.id
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cooling Infrastructure Toggle */}
                <div>
                  <label className="block text-xs font-bold font-mono text-slate-300 uppercase mb-1.5">
                    Cooling Access & Rest Option
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'good', label: 'Good AC/Shade' },
                      { id: 'limited', label: 'Limited Shade' },
                      { id: 'prefer_not_to_say', label: 'No Cooling' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setSimCooling(opt.id as CoolingAccess)}
                        className={`p-2.5 rounded-lg text-xs font-semibold border transition ${
                          simCooling === opt.id
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Age Group Vulnerability Toggle */}
                <div>
                  <label className="block text-xs font-bold font-mono text-slate-300 uppercase mb-1.5">
                    Vulnerability Age Category
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'child', label: 'Child (<12)' },
                      { id: 'adult', label: 'Adult (12-64)' },
                      { id: 'older_adult', label: 'Older Adult (65+)' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setSimAgeGroup(opt.id as AgeGroup)}
                        className={`p-2.5 rounded-lg text-xs font-semibold border transition ${
                          simAgeGroup === opt.id
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (7 cols): Scenario Comparison & Outcomes */}
            <div className="lg:col-span-7 space-y-6">
              {/* Scenario Assessment Outcome Header */}
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-slate-400 uppercase">SIMULATED SCENARIO RESULT</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded border border-amber-800/80">
                    {comparison.label}
                  </span>
                </div>

                {/* Score Comparison Display */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Baseline Outcome */}
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="text-[11px] font-mono text-slate-400 uppercase mb-1">BASELINE RISK SCORE</div>
                    <div className="text-3xl font-extrabold font-mono text-slate-100">
                      {comparison.baselineScore} <span className="text-xs text-slate-400 font-sans">/ 100</span>
                    </div>
                    <div className="mt-2 text-xs font-bold uppercase font-mono text-slate-300">
                      TIER: {comparison.baselineLevel}
                    </div>
                  </div>

                  {/* Scenario Outcome */}
                  <div className="p-4 bg-slate-950 text-white rounded-xl border border-slate-800 shadow-md relative overflow-hidden">
                    <div className="text-[11px] font-mono text-slate-400 uppercase mb-1">SCENARIO ESTIMATED SCORE</div>
                    <div className="text-3xl font-extrabold font-mono text-emerald-400">
                      {comparison.scenarioScore} <span className="text-xs text-slate-400 font-sans">/ 100</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase font-mono text-emerald-300">
                        TIER: {comparison.scenarioLevel}
                      </span>
                      {comparison.scoreDiff !== 0 && (
                        <span
                          className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded ${
                            comparison.scoreDiff > 0
                              ? 'bg-rose-500 text-white'
                              : 'bg-emerald-500 text-slate-950'
                          }`}
                        >
                          {comparison.scoreDiff > 0 ? `+${comparison.scoreDiff} PTS` : `${comparison.scoreDiff} PTS`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ML Inference & Calculation Attribution Notice */}
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400">
                  <span>{comparison.mlInferenceNotice}</span>
                </div>
              </div>

              {/* Major Changed Risk Drivers */}
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-4">
                <h3 className="text-xs font-bold font-mono text-slate-400 uppercase pb-2 border-b border-slate-800">
                  MAJOR CHANGED RISK DRIVERS
                </h3>

                {comparison.changedFactors.length === 0 ? (
                  <div className="p-4 bg-slate-950 rounded-lg text-xs font-mono text-slate-400 text-center border border-slate-800">
                    No contextual parameter changes from baseline. Modify controls on the left to simulate risk shifts.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {comparison.changedFactors.map((chg, idx) => (
                      <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                        <div className="flex items-center justify-between font-bold text-slate-200 mb-1">
                          <span>{chg.factorName}</span>
                          <span className="font-mono text-emerald-400 text-[11px]">{chg.impactDeltaText}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                          <span className="line-through text-slate-500">{chg.baselineValue}</span>
                          <ArrowRight className="w-3 h-3 text-slate-500" />
                          <span className="font-bold text-slate-200">{chg.scenarioValue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recommended Preventive Actions */}
              {comparison.scenarioAssessment && (
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-4">
                  <h3 className="text-xs font-bold font-mono text-slate-400 uppercase pb-2 border-b border-slate-800">
                    SCENARIO PREVENTIVE GUIDANCE
                  </h3>

                  <div className="space-y-3">
                    {comparison.scenarioAssessment.recommendations.map((rec) => (
                      <div key={rec.id} className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-slate-100">{rec.title}</h4>
                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{rec.technical_text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
