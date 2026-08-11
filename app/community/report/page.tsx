'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { createCommunityReportInSupabase, getUserProfile } from '@/lib/store';
import { CommunityCategory, LocationData, ReportSeverity } from '@/lib/types';
import { validateCoordinates } from '@/lib/community-moderation';
import { AlertCircle, Send, CheckCircle2, MapPin, ShieldAlert, Navigation } from 'lucide-react';

export default function ReportPage() {
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profile] = useState(getUserProfile());

  const [category, setCategory] = useState<CommunityCategory>('water_access');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<ReportSeverity>('info');
  const [locationMode, setLocationMode] = useState<'profile' | 'manual'>('profile');

  // Manual location fields
  const [manualName, setManualName] = useState('');
  const [manualLat, setManualLat] = useState<string>('');
  const [manualLng, setManualLng] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let targetLoc: LocationData;

    if (locationMode === 'profile') {
      targetLoc = profile.location || {
        name: 'Chennai Central',
        locality: 'Tamil Nadu',
        latitude: 13.0827,
        longitude: 80.2707,
      };
    } else {
      const parsedLat = parseFloat(manualLat);
      const parsedLng = parseFloat(manualLng);

      if (!manualName.trim()) {
        setError('Please enter a location name.');
        return;
      }

      if (!validateCoordinates(parsedLat, parsedLng)) {
        setError('Invalid latitude/longitude coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180.');
        return;
      }

      targetLoc = {
        name: manualName.trim(),
        latitude: parsedLat,
        longitude: parsedLng,
      };
    }

    setSubmitting(true);

    const res = await createCommunityReportInSupabase({
      user_id: profile.id,
      category,
      description,
      location: targetLoc,
      severity,
    });

    setSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Failed to submit report. Please check input parameters.');
      return;
    }

    setSubmitted(true);
    setTimeout(() => {
      router.push('/community/map');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <h1 className="text-xl font-bold text-slate-900">SUBMIT COMMUNITY HEAT REPORT</h1>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Report public water access issues, missing shade canopies, or extreme asphalt heat hazards
            </p>
          </div>

          {submitted ? (
            <div className="bg-white p-8 rounded-xl border border-emerald-300 shadow-xs text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h2 className="text-lg font-bold text-slate-900">Report Successfully Submitted!</h2>
              <p className="text-xs text-slate-600 font-mono">Status: SUBMITTED → UNDER REVIEW</p>
              <p className="text-xs text-slate-500">Redirecting to Interactive Community Map...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex items-center gap-2 text-rose-900 text-xs font-mono">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Category */}
              <div>
                <label className="block text-xs font-bold font-mono text-slate-700 uppercase mb-2">
                  Issue Category *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'water_access', label: 'Water Access' },
                    { id: 'shade_cooling', label: 'Shade / Cooling' },
                    { id: 'outdoor_heat', label: 'Extreme Heat' },
                    { id: 'cooling_facility', label: 'Cooling Facility' },
                    { id: 'unsafe_condition', label: 'Unsafe Condition' },
                    { id: 'infrastructure', label: 'Infrastructure' },
                    { id: 'public_space', label: 'Public Space' },
                    { id: 'other', label: 'Other Hazard' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCategory(opt.id as CommunityCategory)}
                      className={`p-3 rounded-lg text-xs font-semibold text-left border transition ${
                        category === opt.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold font-mono text-slate-700 uppercase">
                    Issue Description *
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">{description.length}/1000</span>
                </div>
                <textarea
                  rows={4}
                  required
                  maxLength={1000}
                  placeholder="Describe the heat safety observation (e.g., broken water fountain near metro exit, bus stop shelter removed)..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-lg border border-slate-300 p-3 focus:outline-none focus:border-emerald-600 font-sans"
                />
              </div>

              {/* Severity Selection */}
              <div>
                <label className="block text-xs font-bold font-mono text-slate-700 uppercase mb-2">
                  Observed Severity Level
                </label>
                <div className="flex gap-2">
                  {[
                    { id: 'info', label: 'Info / Minor', style: 'border-blue-300 text-blue-800 bg-blue-50' },
                    { id: 'warning', label: 'Warning / Moderate', style: 'border-amber-300 text-amber-800 bg-amber-50' },
                    { id: 'critical', label: 'Critical / Urgent', style: 'border-rose-300 text-rose-800 bg-rose-50' },
                  ].map((sev) => (
                    <button
                      key={sev.id}
                      type="button"
                      onClick={() => setSeverity(sev.id as ReportSeverity)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold font-mono border flex-1 transition ${
                        severity === sev.id ? 'ring-2 ring-slate-900 ' + sev.style : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {sev.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location Mode Toggle */}
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <label className="block text-xs font-bold font-mono text-slate-700 uppercase">
                  Location Attachment
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLocationMode('profile')}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition ${
                      locationMode === 'profile'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Use Profile / Current Location</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLocationMode('manual')}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition ${
                      locationMode === 'manual'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Specify Coordinates Manually</span>
                  </button>
                </div>

                {locationMode === 'profile' ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs font-mono text-slate-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span>{profile.location?.name || 'Chennai Central'}</span>
                    </div>
                    <span>
                      ({(profile.location?.latitude || 13.0827).toFixed(3)}°,{' '}
                      {(profile.location?.longitude || 80.2707).toFixed(3)}°)
                    </span>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs font-mono">
                    <div>
                      <label className="block text-slate-600 mb-1">Location Name / Landmark *</label>
                      <input
                        type="text"
                        placeholder="e.g. Park Town Bus Station"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        className="w-full bg-white text-slate-900 p-2.5 rounded-lg border border-slate-300 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-600 mb-1">Latitude (-90 to 90) *</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="e.g. 13.0815"
                          value={manualLat}
                          onChange={(e) => setManualLat(e.target.value)}
                          className="w-full bg-white text-slate-900 p-2.5 rounded-lg border border-slate-300 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Longitude (-180 to 180) *</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="e.g. 80.2725"
                          value={manualLng}
                          onChange={(e) => setManualLng(e.target.value)}
                          className="w-full bg-white text-slate-900 p-2.5 rounded-lg border border-slate-300 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Privacy Warning */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] font-mono text-amber-900 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Privacy Disclosure: Reports will be publicly visible to other community members on the Interactive Map. Do not include private home addresses, medical details, or personally identifying info.
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white font-semibold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Submitting Report...' : 'Submit Report to Community Registry'}</span>
              </button>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
