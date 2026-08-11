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
