'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CommunityCluster, CommunityReport, LocationData, VerifiedCoolingLocation } from '@/lib/types';
import { validateCoordinates } from '@/lib/community-moderation';
import { KARE_CAMPUS } from '@/lib/constants';
import { Building2, Navigation, Layers } from 'lucide-react';

interface LeafletMapProps {
  center: LocationData;
  userLocation?: LocationData | null;       // User's personal location (optional)
  showCampusMarker?: boolean;               // Show KARE campus institutional reference
  reports?: CommunityReport[];
  clusters?: CommunityCluster[];
  coolingLocations?: VerifiedCoolingLocation[];
  onSelectReport?: (report: CommunityReport) => void;
  height?: string;
}

// Custom icon factory using SVG so we avoid CDN icon paths per marker type
function makeIconSvg(color: string, label: string): string {
  return `
    <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="38" rx="6" ry="2" fill="rgba(0,0,0,0.15)"/>
      <path d="M16 0 C7.16 0 0 7.16 0 16 C0 27 16 40 16 40 C16 40 32 27 32 16 C32 7.16 24.84 0 16 0Z" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="16" y="19" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="bold" fill="white" font-family="sans-serif">${label}</text>
    </svg>
  `;
}

function svgToDataUrl(svg: string): string {
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  center,
  userLocation = null,
  showCampusMarker = true,
  reports = [],
  clusters = [],
  coolingLocations = [],
  onSelectReport,
  height = '550px',
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  // Refs for center functions
  const centerOnUserRef = useRef<(() => void) | null>(null);
  const centerOnCampusRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    const validCenter = validateCoordinates(center?.latitude, center?.longitude)
      ? { lat: center.latitude, lng: center.longitude }
      : { lat: 13.0827, lng: 80.2707 };

    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted) return;

      try {
        // Fix default marker icon issue
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        if (!leafletInstance.current) {
          if (!mapRef.current) return;
          const map = L.map(mapRef.current).setView([validCenter.lat, validCenter.lng], 13);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          }).addTo(map);
          leafletInstance.current = map;
        } else {
          leafletInstance.current.setView([validCenter.lat, validCenter.lng], 13);
        }

        const map = leafletInstance.current;

        // Clear all markers/circles (but keep tile layer)
        map.eachLayer((layer: any) => {
          if (layer instanceof L.Marker || layer instanceof L.Circle) {
            map.removeLayer(layer);
          }
        });

        // ── Helper: create DivIcon from SVG ────────────────────────────────
        const makeIcon = (color: string, emoji: string) =>
          L.divIcon({
            html: `<div style="width:30px;height:36px;background:${color};border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);">
              <span style="transform:rotate(45deg);font-size:14px;line-height:1;">${emoji}</span>
            </div>`,
            iconSize: [30, 36],
            iconAnchor: [15, 36],
            popupAnchor: [0, -36],
            className: '',
          });

        // ── 1. Cluster Circles (Red) ────────────────────────────────────────
        clusters.forEach((cls) => {
          if (!validateCoordinates(cls.center_latitude, cls.center_longitude)) return;
          const circle = L.circle([cls.center_latitude, cls.center_longitude], {
            color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.2, radius: cls.radius_km * 500,
          }).addTo(map);
          circle.bindPopup(`
            <div style="font-family:sans-serif;font-size:12px;padding:4px;max-width:220px;">
              <div style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:10px;margin-bottom:4px;display:inline-block;">⚠️ ${cls.status_label}</div>
              <div style="font-weight:bold;color:#1e293b;margin-bottom:2px;">${cls.category.replace('_', ' ').toUpperCase()}</div>
              <div style="color:#475569;">Reports: <strong>${cls.report_count}</strong></div>
            </div>`);
        });

        // ── 2. Verified Cooling Locations (Green/Teal) ──────────────────────
        coolingLocations.forEach((loc) => {
          if (!validateCoordinates(loc.location.latitude, loc.location.longitude)) return;
          const marker = L.marker([loc.location.latitude, loc.location.longitude], {
            icon: makeIcon('#059669', '💧'),
          }).addTo(map);
          marker.bindPopup(`
            <div style="font-family:sans-serif;font-size:12px;max-width:220px;">
              <div style="background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:10px;margin-bottom:4px;display:inline-block;">✓ VERIFIED COOLING LOCATION</div>
              <div style="font-weight:bold;color:#0f172a;font-size:13px;margin-bottom:2px;">${loc.name}</div>
              <p style="margin:0 0 4px 0;color:#334155;font-size:11px;">📍 ${loc.address}</p>
              <div style="color:#047857;font-size:11px;">🕒 ${loc.operating_hours || 'Open to public'}</div>
              ${loc.contact_phone ? `<div style="color:#64748b;font-size:10px;margin-top:2px;">📞 ${loc.contact_phone}</div>` : ''}
            </div>`);
        });

        // ── 3. Community Reports (Blue/Amber/Green) ─────────────────────────
        reports.forEach((rep) => {
          if (!validateCoordinates(rep.location.latitude, rep.location.longitude)) return;
          const emoji = rep.status === 'VERIFIED' || rep.status === 'RESOLVED' ? '✅'
            : rep.status === 'UNDER_REVIEW' ? '🔍' : '📣';
          const marker = L.marker([rep.location.latitude, rep.location.longitude], {
            icon: makeIcon('#2563eb', emoji),
          }).addTo(map);
          const submittedTime = new Date(rep.timestamp).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          });
          marker.bindPopup(`
            <div style="font-family:sans-serif;font-size:12px;max-width:220px;">
              <div style="background:#e0f2fe;color:#0369a1;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:10px;margin-bottom:4px;display:inline-block;">📣 COMMUNITY REPORT</div>
              <div style="font-weight:bold;color:#1e293b;margin-bottom:4px;text-transform:uppercase;">${rep.category.replace('_', ' ')}</div>
              <p style="margin:0 0 6px 0;color:#475569;font-size:11px;line-height:1.4;">${rep.description}</p>
              <div style="color:#64748b;font-size:10px;">📍 ${rep.location.name} · ${submittedTime}</div>
              <div style="margin-top:4px;border-top:1px solid #e2e8f0;padding-top:4px;display:flex;justify-content:space-between;">
                <span style="background:#2563eb;color:white;padding:2px 6px;border-radius:4px;font-size:10px;">${rep.status}</span>
                <span style="color:#64748b;font-size:11px;">👍 ${rep.votes_count || 1}</span>
              </div>
              <div style="font-size:9px;color:#94a3b8;margin-top:4px;font-style:italic;">Community reports are user-generated and not automatically verified.</div>
            </div>`);
          if (onSelectReport) marker.on('click', () => onSelectReport(rep));
        });

        // ── 4. KARE Campus Marker (Teal — Institutional Reference) ─────────
        if (showCampusMarker) {
          const campusMarker = L.marker([KARE_CAMPUS.latitude, KARE_CAMPUS.longitude], {
            icon: makeIcon('#0d9488', '🏫'),
          }).addTo(map);
          campusMarker.bindPopup(`
            <div style="font-family:sans-serif;font-size:12px;max-width:240px;">
              <div style="background:#ccfbf1;color:#0f766e;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:10px;margin-bottom:6px;display:inline-block;">🏫 INSTITUTIONAL REFERENCE</div>
              <div style="font-weight:bold;color:#0f172a;font-size:13px;margin-bottom:2px;">KARE Campus</div>
              <div style="color:#334155;font-size:11px;margin-bottom:4px;">Kalasalingam Academy of Research and Education</div>
              <div style="color:#64748b;font-size:10px;">Krishnankoil, Virudhunagar District, Tamil Nadu</div>
              <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:4px;padding:4px 6px;margin-top:6px;font-size:10px;color:#0f766e;">
                This is the project's institutional reference location. It is not your personal location.
              </div>
            </div>`);

          centerOnCampusRef.current = () => map.setView([KARE_CAMPUS.latitude, KARE_CAMPUS.longitude], 14);
        }

        // ── 5. User's Personal Location Marker (Orange) ─────────────────────
        if (userLocation && validateCoordinates(userLocation.latitude, userLocation.longitude)) {
          const userMarker = L.marker([userLocation.latitude, userLocation.longitude], {
            icon: makeIcon('#ea580c', '📍'),
          }).addTo(map);
          userMarker.bindPopup(`
            <div style="font-family:sans-serif;font-size:12px;max-width:200px;">
              <div style="background:#ffedd5;color:#9a3412;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:10px;margin-bottom:6px;display:inline-block;">📍 YOUR LOCATION</div>
              <div style="font-weight:bold;color:#0f172a;font-size:13px;">${userLocation.name}</div>
              ${userLocation.locality ? `<div style="color:#64748b;font-size:11px;">${userLocation.locality}</div>` : ''}
              <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:4px;padding:4px 6px;margin-top:6px;font-size:10px;color:#9a3412;">
                This is your current location for heat risk assessment.
              </div>
            </div>`);

          centerOnUserRef.current = () => map.setView([userLocation.latitude, userLocation.longitude], 14);

          // Draw GPS accuracy circle when accuracy is known (Phase 24)
          // Uses the actual accuracy value from the browser — never fabricated
          if (userLocation.gps_accuracy && userLocation.gps_accuracy > 0) {
            L.circle([userLocation.latitude, userLocation.longitude], {
              radius: userLocation.gps_accuracy, // metres from browser Geolocation API
              color: '#ea580c',
              fillColor: '#ea580c',
              fillOpacity: 0.08,
              weight: 1,
              dashArray: '4 4',
            }).addTo(map).bindTooltip(
              `GPS Accuracy: ±${userLocation.gps_accuracy < 1000
                ? `${userLocation.gps_accuracy}m`
                : `${(userLocation.gps_accuracy / 1000).toFixed(1)}km`}`,
              { permanent: false, direction: 'top' }
            );
          }
        }

      } catch (err: any) {
        console.error('Leaflet initialization error:', err);
        setMapError('Interactive map rendering unavailable.');
      }
    }).catch((err) => {
      console.error('Failed to load Leaflet library:', err);
      setMapError('Map dependencies failed to load.');
    });

    return () => { isMounted = false; };
  }, [center, userLocation, showCampusMarker, reports, clusters, coolingLocations, onSelectReport]);

  if (mapError) {
    return (
      <div className="relative w-full rounded-xl bg-slate-50 border border-slate-200 p-6 flex flex-col items-center justify-center text-center space-y-2" style={{ height }}>
        <span className="text-sm font-bold text-slate-700">Map Rendering Unavailable</span>
        <p className="text-xs text-slate-500 max-w-md">{mapError} Community reports and verified locations remain accessible in list view.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 shadow-xs" style={{ height }}>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/leaflet.css" />
      <div ref={mapRef} className="w-full h-full z-10" />

      {/* Map Control Buttons */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
        {centerOnUserRef.current && (
          <button
            onClick={() => centerOnUserRef.current?.()}
            title="Center on my location"
            className="flex items-center gap-1.5 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-md transition"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Center on Me</span>
          </button>
        )}
        {showCampusMarker && (
          <button
            onClick={() => centerOnCampusRef.current?.()}
            title="Center on KARE campus"
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-md transition"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Center on Campus</span>
          </button>
        )}
        <button
          onClick={() => setShowLegend(!showLegend)}
          title="Toggle legend"
          className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-md border border-slate-200 transition"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Legend</span>
        </button>
      </div>

      {/* Map Legend Panel */}
      {showLegend && (
        <div className="absolute bottom-4 left-4 z-20 bg-white border border-slate-200 rounded-xl shadow-xl p-4 min-w-[180px]">
          <p className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider">Map Legend</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="text-base">📍</span>
              <span>Your Location</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="text-base">🏫</span>
              <span>KARE Campus (Institutional)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="text-base">💧</span>
              <span>Verified Cooling Location</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="text-base">📣</span>
              <span>Community Report</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <div className="w-4 h-4 rounded-full bg-red-400 opacity-50 border border-red-500" />
              <span>Hazard Cluster</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
