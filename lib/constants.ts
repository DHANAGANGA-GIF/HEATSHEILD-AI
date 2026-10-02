/**
 * HeatShield AI — Shared Application Constants
 *
 * This file defines institutional reference data and shared application
 * constants. The KARE campus location is an INSTITUTIONAL REFERENCE ONLY.
 * It must never be confused with or substituted for the current user's
 * personal location.
 */

import { LocationData } from './types';

// ─── Institutional Reference Location ─────────────────────────────────────────

/**
 * KARE Campus — Kalasalingam Academy of Research and Education
 * Krishnankoil, Srivilliputtur, Virudhunagar District, Tamil Nadu, India
 *
 * This is the institutional reference location for HeatShield AI.
 * It is used as a campus context marker on the map and for Campus View.
 * It is NOT a user location and must never be displayed as such.
 */
export const KARE_CAMPUS: LocationData = {
  name: 'KARE Campus',
  locality: 'Kalasalingam Academy of Research and Education, Virudhunagar, Tamil Nadu',
  latitude: 9.3582,
  longitude: 77.8166,
  country: 'India',
};

// ─── Location Source ──────────────────────────────────────────────────────────

/**
 * Describes how the current user location was determined.
 * Must be accurately reflected in the UI — never misrepresent GPS as
 * manual or vice versa.
 */
export type LocationSource = 'GPS' | 'MANUAL' | 'CAMPUS' | 'SAVED' | 'DEFAULT';

/** All valid LocationSource values — useful for test assertions. */
export const LOCATION_SOURCE_VALUES: LocationSource[] = ['GPS', 'MANUAL', 'CAMPUS', 'SAVED', 'DEFAULT'];

// ─── App-wide Display Constants ────────────────────────────────────────────────

export const APP_NAME = 'HeatShield AI';
export const APP_TAGLINE = 'Environmental Heat Risk Decision Support';
export const INSTITUTION_NAME = 'Kalasalingam Academy of Research and Education';
export const INSTITUTION_SHORT = 'KARE';

// ─── Privacy Rules ─────────────────────────────────────────────────────────────

/**
 * Decimal places to round coordinates before displaying in UI.
 * Rounding to 2dp gives ~1.1km precision — sufficient for locality display
 * without exposing exact home/office address.
 */
export const DISPLAY_COORD_PRECISION = 2;

// ─── Pilot / Org Contact ───────────────────────────────────────────────────────

/**
 * URL for organisations to request a HeatShield AI pilot deployment.
 * Set NEXT_PUBLIC_PILOT_URL in environment variables when a real URL is available.
 * If null, the UI renders the button as visually unavailable (not broken).
 */
export const PILOT_REQUEST_URL: string | null =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_PILOT_URL) || null;

// ─── Emergency Contact Numbers ─────────────────────────────────────────────────

/**
 * Returns the primary emergency services number for a given country name.
 *
 * This helper ONLY returns numbers that are well-documented public emergency
 * service contacts. It NEVER invents numbers. When a country is unknown,
 * it instructs the user to contact local emergency services.
 *
 * @param country - Country name as returned by Open-Meteo geocoding or Nominatim.
 *                  Case-insensitive. May be undefined if location lookup failed.
 */
export function emergencyNumber(country?: string): string {
  const c = (country || '').toLowerCase().trim();
  if (!c) return 'Local emergency services';

  if (c.includes('india')) return '108 / 112';
  if (c.includes('australia') || c.includes('new zealand')) return (c.includes('new zealand') ? '111' : '000');
  if (c.includes('united states') || c === 'usa' || c === 'us') return '911';
  if (c.includes('united kingdom') || c.includes('england') || c.includes('scotland') || c.includes('wales')) return '999';
  if (c.includes('canada')) return '911';
  if (c.includes('germany') || c.includes('deutschland')) return '112';
  if (c.includes('france')) return '15 / 112';
  if (c.includes('japan')) return '119';
  if (c.includes('china')) return '120';
  if (c.includes('brazil') || c.includes('brasil')) return '192';
  if (c.includes('south africa')) return '10177';
  if (c.includes('pakistan')) return '1122';
  if (c.includes('bangladesh')) return '999';
  if (c.includes('sri lanka')) return '1990';
  if (c.includes('nepal')) return '102';
  if (c.includes('singapore')) return '995';
  // EU general medical emergency
  if (c.includes('europe') || c.includes('european')) return '112';


  return 'Local emergency services';
}

// ─── Data Freshness ────────────────────────────────────────────────────────────

export type FreshnessStatus = 'fresh' | 'aging' | 'stale' | 'unknown';

/**
 * Determines data freshness from an ISO timestamp.
 *
 * Thresholds:
 *   fresh  < 15 minutes  → data is current
 *   aging  15–60 minutes → data is usable but may be behind
 *   stale  > 60 minutes  → warn user; refresh recommended
 *   unknown              → timestamp missing or unparseable
 *
 * IMPORTANT: Never show "LIVE" unless the caller confirms freshness === 'fresh'.
 */
export function freshnessFor(isoTimestamp: string | undefined | null): {
  status: FreshnessStatus;
  ageMinutes: number;
  label: string;
} {
  if (!isoTimestamp) return { status: 'unknown', ageMinutes: -1, label: 'Unknown' };

  const ts = new Date(isoTimestamp).getTime();
  if (isNaN(ts)) return { status: 'unknown', ageMinutes: -1, label: 'Unknown' };

  const ageMs = Date.now() - ts;
  const ageMinutes = Math.floor(ageMs / 60000);

  if (ageMinutes < 15) return { status: 'fresh', ageMinutes, label: 'Fresh' };
  if (ageMinutes < 60) return { status: 'aging', ageMinutes, label: 'Aging' };
  return { status: 'stale', ageMinutes, label: 'Stale' };
}

/**
 * Formats a weather timestamp as "As of H:MM AM/PM local time"
 * using the Intl.DateTimeFormat API (locale-aware, no external dependency).
 */
export function formatAsOf(isoTimestamp: string | undefined | null): string {
  if (!isoTimestamp) return '';
  const d = new Date(isoTimestamp);
  if (isNaN(d.getTime())) return '';
  return `As of ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

