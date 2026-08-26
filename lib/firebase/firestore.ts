/**
 * HeatShield AI — Firestore Client (Browser-safe)
 *
 * Provides per-user Firestore read/write operations.
 * Each user's data is isolated by their Firebase UID.
 *
 * Collections:
 *   users/{uid}     — User profile and preferences
 *   locations/{uid} — User's live GPS location
 *
 * Security: Firestore rules enforce that only the authenticated user
 * can read/write their own documents (request.auth.uid === uid).
 *
 * NEVER import firebase-admin here — this is client-only.
 */

import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Firestore,
  Unsubscribe,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from './client';

function getFirestoreDb(): Firestore | null {
  if (!isFirebaseConfigured || !firestoreDb) return null;
  return firestoreDb;
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface FirestoreUserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role?: string;
  age_group?: string;
  activity_level?: string;
  exposure_duration?: string;
  cooling_access?: string;
  sms_phone?: string;
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Write (merge) user profile into Firestore users/{uid}.
 * Uses merge so only provided fields are updated — existing fields are preserved.
 */
export async function writeUserProfile(
  uid: string,
  profile: Partial<FirestoreUserProfile>
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) {
    console.warn('[HeatShield] Firestore not available — profile write skipped.');
    return;
  }
  if (!uid) return;

  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        ...profile,
        uid,
        updatedAt: serverTimestamp(),
      },
      { merge: true } // Only update provided fields
    );
  } catch (err: any) {
    // Non-fatal: don't break the UI if Firestore write fails
    console.warn('[HeatShield] Firestore profile write failed:', err?.message);
  }
}

/**
 * Read user profile from Firestore users/{uid}.
 * Returns null if the document doesn't exist or Firestore is unavailable.
 */
export async function readUserProfile(uid: string): Promise<FirestoreUserProfile | null> {
  const db = getFirestoreDb();
  if (!db || !uid) return null;

  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data() as FirestoreUserProfile;
    }
    return null;
  } catch (err: any) {
    console.warn('[HeatShield] Firestore profile read failed:', err?.message);
    return null;
  }
}

/**
 * Subscribe to real-time changes to users/{uid}.
 * Returns an unsubscribe function.
 */
export function subscribeToUserProfile(
  uid: string,
  callback: (profile: FirestoreUserProfile | null) => void
): Unsubscribe {
  const db = getFirestoreDb();
  if (!db || !uid) {
    callback(null);
    return () => {};
  }

  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as FirestoreUserProfile);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.warn('[HeatShield] Firestore profile subscription error:', err?.message);
      callback(null);
    }
  );
}

// ─── User Location ────────────────────────────────────────────────────────────

export interface FirestoreUserLocation {
  uid: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  locationName?: string;
  locationLocality?: string;
  locationSource: 'LIVE_GPS' | 'SAVED_LOCATION' | 'MANUAL_LOCATION' | 'UNAVAILABLE';
  updatedAt?: any;
}

/**
 * Write the authenticated user's live GPS location to Firestore locations/{uid}.
 * Each user can only write their own location (enforced by Firestore rules).
 */
export async function writeUserLocation(
  uid: string,
  location: Omit<FirestoreUserLocation, 'uid' | 'updatedAt'>
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  if (!uid) return;

  try {
    await setDoc(
      doc(db, 'locations', uid),
      {
        ...location,
        uid,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err: any) {
    console.warn('[HeatShield] Firestore location write failed:', err?.message);
  }
}

/**
 * Subscribe to real-time location changes for a specific user.
 * Used for authorized viewers (e.g., admin map, community features).
 */
export function subscribeToUserLocation(
  uid: string,
  callback: (location: FirestoreUserLocation | null) => void
): Unsubscribe {
  const db = getFirestoreDb();
  if (!db || !uid) {
    callback(null);
    return () => {};
  }

  return onSnapshot(
    doc(db, 'locations', uid),
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as FirestoreUserLocation);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.warn('[HeatShield] Firestore location subscription error:', err?.message);
      callback(null);
    }
  );
}
