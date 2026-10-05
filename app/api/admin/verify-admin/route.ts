import { NextResponse } from 'next/server';
import { resolveAuthSession, extractBearerToken, verifyFirebaseToken } from '@/lib/firebase/admin';
import { checkIsAdmin, verifyAdminRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * GET & POST /api/admin/verify-admin
 *
 * Verifies the caller's authenticated session server-side and determines
 * if the user holds an administrative role ('admin' or 'super_admin') or matches
 * the ADMIN_BOOTSTRAP_EMAIL environment variable.
 *
 * Never trusts any client-supplied role or claim.
 */
export async function GET(request: Request) {
  try {
    const session = await resolveAuthSession(request);
    if (!session || !session.uid) {
      return NextResponse.json(
        { isAdmin: false, role: 'anonymous', error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const { isAdmin, role } = await checkIsAdmin(session.uid, session.email);

    return NextResponse.json({
      isAdmin,
      role,
      uid: session.uid,
      email: session.email,
      name: session.name,
    });
  } catch (err: any) {
    return NextResponse.json(
      { isAdmin: false, error: err?.message || 'Server error during admin verification.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    let session = await resolveAuthSession(request);

    // Also support { idToken: string } in body for explicit client verifications
    if (!session) {
      try {
        const body = await request.json();
        if (body?.idToken && typeof body.idToken === 'string') {
          session = await verifyFirebaseToken(body.idToken.trim());
        }
      } catch {
        // Body may not be JSON
      }
    }

    if (!session || !session.uid) {
      return NextResponse.json(
        { isAdmin: false, role: 'anonymous', error: 'Authorization token or valid session required.' },
        { status: 401 }
      );
    }

    const { isAdmin, role } = await checkIsAdmin(session.uid, session.email);

    return NextResponse.json({
      isAdmin,
      role,
      uid: session.uid,
      email: session.email,
      name: session.name,
    });
  } catch (err: any) {
    return NextResponse.json(
      { isAdmin: false, error: err?.message || 'Server error during admin verification.' },
      { status: 500 }
    );
  }
}
