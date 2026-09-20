/**
 * HeatShield AI — Unified Authenticated Client Fetcher
 *
 * Ensures every protected API call:
 * 1. Obtains the current, fresh Firebase ID token immediately before dispatch.
 * 2. Attaches Authorization: Bearer <token>.
 * 3. Keeps hs_session cookie synchronized with the fresh JWT.
 * 4. UX Auto-Recovery: On 401 response, automatically force-refreshes the Firebase token,
 *    updates the session cookie, and retries the request ONCE.
 */

import { firebaseAuth } from '@/lib/firebase/client';
import { getSessionCookie, setSessionCookie } from '@/lib/store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export interface AuthenticatedFetchOptions extends RequestInit {
  retryOn401?: boolean;
}

/**
 * Retrieves the most up-to-date valid authentication JWT from the client.
 * Force-refreshes Firebase ID token to prevent stale/expired tokens.
 */
export async function getFreshAuthToken(): Promise<string | null> {
  // 1. Prioritize active Firebase user (force refresh)
  if (firebaseAuth) {
    if (!firebaseAuth.currentUser && typeof firebaseAuth.authStateReady === 'function') {
      try {
        await firebaseAuth.authStateReady();
      } catch {
        // Non-blocking fallback
      }
    }

    const user = firebaseAuth.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken(true);
        if (token && token.split('.').length === 3) {
          setSessionCookie(token);
          return token;
        }
      } catch (err) {
        console.warn('[HeatShield Client Auth] Firebase token refresh failed:', err);
      }
    }
  }

  // 2. Supabase auth session token fallback
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token && token.split('.').length === 3) {
        return token;
      }
    } catch {
      // Supabase not active
    }
  }

  // 3. Fallback to valid hs_session cookie if it contains a verified JWT shape
  const cookieToken = getSessionCookie();
  if (cookieToken && cookieToken.split('.').length === 3) {
    return cookieToken;
  }

  return null;
}

/**
 * Wrapper around standard fetch that injects the current Authorization header
 * and performs an automatic single retry on 401 using a fresh token.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: AuthenticatedFetchOptions
): Promise<Response> {
  const retryOn401 = init?.retryOn401 !== false;
  const token = await getFreshAuthToken();

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  const options: RequestInit = {
    ...init,
    headers,
    // CRITICAL: credentials: 'include' ensures the hs_session cookie travels
    // alongside the Authorization header for maximum server-side compatibility.
    credentials: 'include',
  };

  const response = await fetch(input, options);

  // Auto-recovery UX: if 401 and Firebase user is present, refresh token and retry ONCE
  if (response.status === 401 && retryOn401 && firebaseAuth?.currentUser) {
    try {
      const refreshedToken = await firebaseAuth.currentUser.getIdToken(true);
      if (refreshedToken && refreshedToken.split('.').length === 3) {
        setSessionCookie(refreshedToken);
        const retryHeaders = new Headers(init?.headers);
        retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);
        if (!retryHeaders.has('Content-Type') && init?.body) {
          retryHeaders.set('Content-Type', 'application/json');
        }

        return await fetch(input, {
          ...init,
          headers: retryHeaders,
          credentials: 'include',
        });
      }
    } catch (retryErr) {
      console.warn('[HeatShield Client Auth] 401 Auto-recovery retry failed:', retryErr);
    }
  }

  return response;
}
