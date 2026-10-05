/**
 * HeatShield AI — Server-Side Admin Authorization & RBAC Engine
 *
 * IMPORTANT SECURITY RULES:
 * 1. Admin authorization MUST strictly be evaluated server-side.
 * 2. Never trust client-side localStorage, React state, or URL parameters.
 * 3. Supports secure bootstrap via ADMIN_BOOTSTRAP_EMAIL environment variable.
 * 4. Supports persistent database roles in Supabase `profiles.role IN ('admin', 'super_admin')`.
 */

import { resolveAuthSession } from '@/lib/firebase/admin';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const ADMIN_ROLES = ['admin', 'super_admin'];

/**
 * Normalizes email strings for comparison.
 */
function normalizeEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Checks if a given email is listed in ADMIN_BOOTSTRAP_EMAIL or ADMIN_EMAILS env vars.
 */
export function isBootstrapAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const target = normalizeEmail(email);

  const bootstrapEmail = normalizeEmail(process.env.ADMIN_BOOTSTRAP_EMAIL);
  if (bootstrapEmail && target === bootstrapEmail) {
    return true;
  }

  const adminList = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);

  return adminList.includes(target);
}

/**
 * Evaluates whether an authenticated UID and email possess administrative privileges.
 * Automatically bootstraps admin role in Supabase if the user matches ADMIN_BOOTSTRAP_EMAIL.
 */
export async function checkIsAdmin(
  uid: string,
  email?: string
): Promise<{ isAdmin: boolean; role: string }> {
  // 1. Check bootstrap environment variable
  if (isBootstrapAdminEmail(email)) {
    // Upsert or promote in database if Supabase is active
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('profiles')
          .update({ role: 'admin', updated_at: new Date().toISOString() })
          .eq('id', uid);
      } catch (err) {
        console.warn('[AdminAuth] Bootstrap DB update warning:', err);
      }
    }
    return { isAdmin: true, role: 'admin' };
  }

  // 2. Query persistent profile role from Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .maybeSingle();

      if (!error && data?.role && ADMIN_ROLES.includes(data.role)) {
        return { isAdmin: true, role: data.role };
      }
    } catch (err) {
      console.warn('[AdminAuth] Supabase role lookup error:', err);
    }
  }

  return { isAdmin: false, role: 'user' };
}

export interface AdminAuthResult {
  authorized: boolean;
  uid?: string;
  email?: string;
  name?: string;
  role?: string;
  error?: string;
  status: number;
}

/**
 * Enforces admin authorization for API endpoints.
 * Resolves session from Bearer token or hs_session HTTP cookie.
 * Returns 401 if unauthenticated, 403 if unauthorized.
 */
export async function verifyAdminRequest(request: Request): Promise<AdminAuthResult> {
  const session = await resolveAuthSession(request);

  if (!session || !session.uid) {
    return {
      authorized: false,
      error: 'Authentication required. Please sign in to access admin capabilities.',
      status: 401,
    };
  }

  const { isAdmin, role } = await checkIsAdmin(session.uid, session.email);

  if (!isAdmin) {
    return {
      authorized: false,
      uid: session.uid,
      email: session.email,
      role,
      error: 'Forbidden: Administrator privileges required to access this resource.',
      status: 403,
    };
  }

  return {
    authorized: true,
    uid: session.uid,
    email: session.email,
    name: session.name,
    role,
    status: 200,
  };
}
