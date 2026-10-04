/**
 * HeatShield AI — Firebase Client SDK (Browser-safe)
 *
 * Initialized with NEXT_PUBLIC_ environment variables only.
 * Never import firebase-admin here — it is server-only.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

/**
 * True only if all required Firebase public config keys are provided.
 * When false, Firebase Auth is disabled and the app falls back to Supabase Auth only.
 */
export const isFirebaseConfigured: boolean = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  !firebaseConfig.apiKey.includes('your-') &&
  !firebaseConfig.projectId.includes('your-')
);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let firestoreDb: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    firestoreDb = getFirestore(app);
  } catch (err) {
    console.warn('[HeatShield] Firebase client initialization failed:', err);
  }
}

/**
 * Creates and configures a GoogleAuthProvider for Firebase Authentication.
 * Requests user identity scopes only: 'email', 'profile'.
 * 
 * IMPORTANT: NEVER add Gmail scopes here. Gmail background sending uses a dedicated,
 * server-side OAuth flow via /api/email/google/connect.
 */
export function getGoogleAuthProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  return provider;
}

export { app as firebaseApp, authInstance as firebaseAuth, firestoreDb };

