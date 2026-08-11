'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CommunityCluster, CommunityReport, LocationData, VerifiedCoolingLocation } from '@/lib/types';
import { validateCoordinates } from '@/lib/community-moderation';

interface LeafletMapProps {
  center: LocationData;
  reports?: CommunityReport[];
  clusters?: CommunityCluster[];
  coolingLocations?: VerifiedCoolingLocation[];
  onSelectReport?: (report: CommunityReport) => void;
  height?: string;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  center,
  reports = [],
  clusters = [],
  coolingLocations = [],
  onSelectReport,
  height = '550px',
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    // Validate center coordinates fallback
    const validLat = validateCoordinates(center?.latitude, center?.longitude) ? center.latitude : 13.0827;
    const validLng = validateCoordinates(center?.latitude, center?.longitude) ? center.longitude : 80.2707;

    let isMounted = true;

    // Dynamically import Leaflet safely
    import('leaflet')
      .then((L) => {
        if (!isMounted) return;

        try {
          // Fix default Leaflet icon assets
          delete (L.Icon.Default.prototype as any)._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          });

          if (!leafletInstance.current) {
            if (!mapRef.current) return;
            const map = L.map(mapRef.current).setView([validLat, validLng], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
              maxZoom: 19,
            }).addTo(map);

            leafletInstance.current = map;
          } else {
            leafletInstance.current.setView([validLat, validLng], 13);
          }

          const map = leafletInstance.current;

          // Clear existing markers and circle overlays
          map.eachLayer((layer: any) => {
            if (layer instanceof L.Marker || layer instanceof L.Circle) {
              map.removeLayer(layer);
            }
          });

          // 1. Render Cluster Circles (Red)
          clusters.forEach((cls) => {
            if (!validateCoordinates(cls.center_latitude, cls.center_longitude)) return;

            const circle = L.circle([cls.center_latitude, cls.center_longitude], {
              color: '#dc2626',
              fillColor: '#ef4444',
              fillOpacity: 0.25,
              radius: cls.radius_km * 500,
            }).addTo(map);

            circle.bindPopup(`
              <div style="font-family: sans-serif; font-size: 12px; padding: 4px; max-width: 240px;">
                <div style="background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; margin-bottom: 4px; display: inline-block;">
                  ⚠️ ${cls.status_label}
                </div>
                <div style="font-weight: bold; color: #1e293b; margin-bottom: 2px;">
                  Category: ${cls.category.replace('_', ' ').toUpperCase()}
                </div>
                <div style="color: #475569; margin-bottom: 4px;">
                  Reports in Cluster: <strong>${cls.report_count}</strong>
                </div>
                <small style="color: #64748b; display: block; line-height: 1.3;">
                  Multiple nearby reports indicate potential community heat hazard requiring verification.
                </small>
              </div>
            `);
          });

          // 2. Render Verified Public Cooling Locations (Emerald / Teal Markers)
          coolingLocations.forEach((loc) => {
            if (!validateCoordinates(loc.location.latitude, loc.location.longitude)) return;

            const marker = L.marker([loc.location.latitude, loc.location.longitude]).addTo(map);

            marker.bindPopup(`
              <div style="font-family: sans-serif; font-size: 12px; max-width: 240px;">
                <div style="background: #d1fae5; color: #065f46; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-bottom: 4px; display: inline-block;">
                  ✓ VERIFIED / PUBLIC LOCATION
                </div>
                <div style="font-weight: bold; color: #0f172a; font-size: 13px; margin-bottom: 2px;">
                  ${loc.name}
                </div>
                <p style="margin: 0 0 4px 0; color: #334155; font-size: 11px;">📍 ${loc.address}</p>
                <div style="color: #047857; font-size: 11px; font-weight: 500;">
                  🕒 ${loc.operating_hours || 'Open to public'}
                </div>
                ${loc.contact_phone ? `<div style="color: #64748b; font-size: 10px; margin-top: 2px;">📞 ${loc.contact_phone}</div>` : ''}
              </div>
            `);
          });

          // 3. Render User Community Reports (Blue / Amber / Green Markers)
          reports.forEach((rep) => {
            if (!validateCoordinates(rep.location.latitude, rep.location.longitude)) return;

            const markerColor =
              rep.status === 'VERIFIED' || rep.status === 'RESOLVED'
                ? '#059669'
                : rep.status === 'UNDER_REVIEW' || rep.status === 'REVIEWED'
                ? '#d97706'
                : '#2563eb';

            const marker = L.marker([rep.location.latitude, rep.location.longitude]).addTo(map);

            const submittedTime = new Date(rep.timestamp).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            marker.bindPopup(`
              <div style="font-family: sans-serif; font-size: 12px; max-width: 240px;">
                <div style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-bottom: 4px; display: inline-block;">
                  📣 COMMUNITY REPORT (User Generated)
                </div>
                <div style="font-weight: bold; color: #1e293b; margin-bottom: 4px; text-transform: uppercase;">
                  ${rep.category.replace('_', ' ')}
                </div>
                <p style="margin: 0 0 6px 0; color: #475569; font-size: 12px; line-height: 1.4;">${rep.description}</p>
                <div style="color: #64748b; font-size: 10px; margin-bottom: 6px;">
                  📍 ${rep.location.name} • Submitted ${submittedTime}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 4px; margin-top: 4px;">
                  <span style="background: ${markerColor}; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">
                    ${rep.status}
                  </span>
                  <span style="color: #64748b; font-size: 11px;">👍 ${rep.votes_count || 1}</span>
                </div>
                <div style="font-size: 9px; color: #94a3b8; margin-top: 6px; font-style: italic;">
                  Note: Community observations are user-reported and not automatically verified.
                </div>
              </div>
            `);

            if (onSelectReport) {
              marker.on('click', () => onSelectReport(rep));
            }
          });
        } catch (err: any) {
          console.error('Leaflet initialization error:', err);
          setMapError('Interactive map rendering unavailable.');
        }
      })
      .catch((err) => {
        console.error('Failed to load Leaflet library:', err);
        setMapError('Leaflet map dependencies failed to load.');
      });

    return () => {
      isMounted = false;
    };
  }, [center, reports, clusters, coolingLocations, onSelectReport]);

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
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/leaflet.css"
      />
      <div ref={mapRef} className="w-full h-full z-10" />
    </div>
  );
};
