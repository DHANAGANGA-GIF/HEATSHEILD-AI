import { NextResponse } from 'next/server';
import { verifyFirebaseToken, extractBearerToken, isAdminSDKConfigured } from '@/lib/firebase/admin';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['admin', 'super_admin'];

/**
 * POST /api/admin/verify-admin
 *
 * Verifies a Firebase ID token and checks server-side if the user has an admin role.
 *
 * NEVER trusts any role value sent from the client.
 * Role is verified by:
 *   1. Decoding the Firebase ID token to get the stable uid
 *   2. Looking up the user's role in Supabase by uid
 *   3. Checking the role against the allowed admin roles
 *
 * Body: { idToken: string }
 * Returns: { isAdmin: boolean, role: string, uid: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get('authorization');
    const bearerToken = extractBearerToken(authHeader);
    const idToken: string | undefined = bearerToken || body?.idToken;

    if (!idToken) {
      return NextResponse.json(
        { error: 'Authorization token required.' },
        { status: 401 }
      );
    }

    // If Firebase Admin SDK is not configured, fall back to Supabase session check
    if (!isAdminSDKConfigured) {
      // Graceful fallback: rely on Supabase session + local profile role
      // Note: this is less secure than Firebase token verification.
      // Users should configure FIREBASE_SERVICE_ACCOUNT_JSON for full security.
      return NextResponse.json({
        isAdmin: false,
        role: 'user',
        uid: null,
        warning: 'Firebase Admin SDK not configured — cannot verify admin role server-side.',
      });
    }

    // Verify Firebase ID token
    const decoded = await verifyFirebaseToken(idToken);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired authentication token.' },
        { status: 401 }
      );
    }

    const { uid, email } = decoded;

    // Look up role in Supabase (never trust client-sent role)
    let serverRole = 'user';
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('firebase_uid', uid)
          .single();

        if (data?.role) {
          serverRole = data.role;
        }
      } catch {
        // Table may not exist yet — graceful fallback
      }
    }

    const isAdmin = ADMIN_ROLES.includes(serverRole);

    return NextResponse.json({
      isAdmin,
      role: serverRole,
      uid,
      email,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Server error during admin verification.' },
      { status: 500 }
    );
  }
}
