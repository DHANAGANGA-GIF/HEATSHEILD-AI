'use client';

/**
 * HeatShield AI — Firebase Authentication Context
 *
 * Provides a React context + `useAuth()` hook for the entire application.
 * Supports email/password login, logout, session persistence, and loading states.
 *
 * When Firebase is not configured (NEXT_PUBLIC_FIREBASE_* env vars missing),
 * falls back gracefully — isFirebaseReady is false, and the application
 * continues to use Supabase Auth only.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
  AuthError,
  updateProfile,
} from 'firebase/auth';
import { firebaseAuth, isFirebaseConfigured } from './client';
import { getUserProfile, saveUserProfile, clearUserProfile, setSessionCookie, clearSessionCookie } from '@/lib/store';
import { UserProfile } from '@/lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type HeatShieldRole = 'user' | 'school' | 'worksite' | 'ngo' | 'admin' | 'super_admin';

export interface AuthState {
  /** Firebase User object — null when signed out or loading */
  firebaseUser: User | null;
  /** HeatShield application profile (merged with Firebase identity) */
  appProfile: UserProfile | null;
  /** True while Firebase is restoring auth state from persistence */
  loading: boolean;
  /** True while a sign-in / sign-out action is in progress */
  actionLoading: boolean;
  /** Last auth error message */
  error: string | null;
  /** Whether Firebase SDK is properly configured */
  isFirebaseReady: boolean;
  /** Convenience: whether there is an authenticated user */
  isAuthenticated: boolean;
  /** Convenience: whether the current user has admin-level role */
  isAdmin: boolean;
  /** Firebase ID token — refreshed automatically */
  idToken: string | null;
}

export interface AuthActions {
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  sendVerificationEmail: () => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<(AuthState & AuthActions) | null>(null);

// ─── Error Message Normalizer ─────────────────────────────────────────────────

function normalizeAuthError(err: AuthError | Error | unknown): string {
  const code = (err as AuthError)?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please check your credentials.';
    case 'auth/email-already-in-use':
      return 'This email is already registered. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Your account has been temporarily locked. Reset your password or try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/requires-recent-login':
      return 'For security, please sign out and sign in again to complete this action.';
    default:
      return (err as Error)?.message || 'Authentication error. Please try again.';
  }
}

// ─── Role Helpers ─────────────────────────────────────────────────────────────

function isAdminRole(role?: string): boolean {
  return role === 'admin' || role === 'super_admin';
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appProfile, setAppProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(isFirebaseConfigured); // Only show loading if Firebase is active
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);

  // ── Restore and sync app profile from Firebase user ──────────────────────
  const syncAppProfile = useCallback((user: User | null) => {
    if (!user) {
      setAppProfile(null);
      clearSessionCookie();
      return;
    }
    const stored = getUserProfile();
    const merged: UserProfile = {
      ...stored,
      id: user.uid,
      firebase_uid: user.uid,
      email: user.email || stored.email,
      name: user.displayName || stored.name,
      authenticated: true,
      onboarded: stored.onboarded ?? true,
    };
    // Persist so rest of app sees consistent profile and edge middleware cookie is set
    saveUserProfile(merged);
    setSessionCookie(user.uid);
    setAppProfile(merged);
  }, []);

  // ── Firebase auth state listener ──────────────────────────────────────────
  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      setLoading(false);
      return;
    }

    // Set persistence to LOCAL (survives browser restarts)
    setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {});

    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      async (user) => {
        setFirebaseUser(user);
        syncAppProfile(user);

        if (user) {
          try {
            const token = await user.getIdToken();
            setIdToken(token);
            setSessionCookie(token || user.uid);
            // Update last_login_at
            saveUserProfile({ last_login_at: new Date().toISOString() } as any);
          } catch {
            setIdToken(null);
            setSessionCookie(user.uid);
          }
        } else {
          setIdToken(null);
          clearSessionCookie();
        }

        setLoading(false);
      },
      (err) => {
        console.warn('[HeatShield] Firebase auth state error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [syncAppProfile]);

  // ── Token refresh (every 55 min to beat 60-min expiry) ────────────────────
  useEffect(() => {
    if (!firebaseUser) return;
    const interval = setInterval(async () => {
      try {
        const token = await firebaseUser.getIdToken(true /* force refresh */);
        setIdToken(token);
      } catch {
        setIdToken(null);
      }
    }, 55 * 60 * 1000);
    return () => clearInterval(interval);
  }, [firebaseUser]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const signIn = useCallback(async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      return { success: false, error: 'Firebase Authentication is not configured.' };
    }
    setActionLoading(true);
    setError(null);
    try {
      const { user } = await signInWithEmailAndPassword(firebaseAuth, email, password);
      let token: string | null = null;
      try {
        token = await user.getIdToken();
      } catch {
        token = null;
      }
      setIdToken(token);
      setSessionCookie(token || user.uid);
      syncAppProfile(user);
      // Persist last login
      saveUserProfile({ last_login_at: new Date().toISOString() } as any);
      return { success: true };
    } catch (err) {
      const msg = normalizeAuthError(err);
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setActionLoading(false);
    }
  }, [syncAppProfile]);

  const signUp = useCallback(async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      return { success: false, error: 'Firebase Authentication is not configured.' };
    }
    setActionLoading(true);
    setError(null);
    try {
      const { user } = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      if (displayName) {
        await updateProfile(user, { displayName });
      }
      // Send verification email (non-blocking)
      sendEmailVerification(user).catch(() => {});
      let token: string | null = null;
      try {
        token = await user.getIdToken();
      } catch {
        token = null;
      }
      setIdToken(token);
      setSessionCookie(token || user.uid);
      syncAppProfile(user);
      return { success: true };
    } catch (err) {
      const msg = normalizeAuthError(err);
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setActionLoading(false);
    }
  }, [syncAppProfile]);

  const signOut = useCallback(async (): Promise<void> => {
    setActionLoading(true);
    setError(null);
    try {
      // 1. Sign out from Firebase
      if (isFirebaseConfigured && firebaseAuth) {
        await firebaseSignOut(firebaseAuth);
      }
    } catch (err) {
      console.warn('[HeatShield] Firebase sign-out error (non-critical):', err);
    } finally {
      // 2. Clear session cookie immediately
      clearSessionCookie();
      // 3. Clear application state regardless of Firebase success
      setFirebaseUser(null);
      setAppProfile(null);
      setIdToken(null);
      // 4. Clear localStorage profile and cached location/weather
      clearUserProfile();
      if (typeof window !== 'undefined') {
        // Clear weather cache on logout (prevents stale data for next user)
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('heatshield_weather_cache_') || key === 'heatshield_user_profile')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      }
      setActionLoading(false);
    }
  }, []);

  const sendPasswordReset = useCallback(async (
    email: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      return { success: false, error: 'Firebase Authentication is not configured.' };
    }
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      return { success: true };
    } catch (err) {
      return { success: false, error: normalizeAuthError(err) };
    }
  }, []);

  const sendVerificationEmail = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!firebaseUser) return { success: false, error: 'Not signed in.' };
    try {
      await sendEmailVerification(firebaseUser);
      return { success: true };
    } catch (err) {
      return { success: false, error: normalizeAuthError(err) };
    }
  }, [firebaseUser]);

  const clearError = useCallback(() => setError(null), []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!firebaseUser) return null;
    try {
      return await firebaseUser.getIdToken();
    } catch {
      return null;
    }
  }, [firebaseUser]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const role = appProfile?.role;
  const isAuthenticated = Boolean(firebaseUser) || Boolean(appProfile?.authenticated);
  const isAdmin = isAdminRole(role);

  const value: AuthState & AuthActions = {
    firebaseUser,
    appProfile,
    loading,
    actionLoading,
    error,
    isFirebaseReady: isFirebaseConfigured,
    isAuthenticated,
    isAdmin,
    idToken,
    signIn,
    signUp,
    signOut,
    sendPasswordReset,
    sendVerificationEmail,
    clearError,
    getIdToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthState & AuthActions {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be used inside <FirebaseAuthProvider>');
  }
  return ctx;
}

/**
 * Returns true if the current authenticated user has admin-level access.
 * Does NOT trust any client-sent role value — reads from app profile
 * that was synced from the server-verified Firebase token.
 */
export function useIsAdmin(): boolean {
  const { isAdmin } = useAuth();
  return isAdmin;
}
