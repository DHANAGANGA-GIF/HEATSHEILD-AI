import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { resolveAuthSession } from '@/lib/firebase/admin';
import { generateOAuthState } from '@/lib/email-providers/oauth-state';

export const dynamic = 'force-dynamic';

/**
 * GET /api/email/google/connect
 * Initiates the Google OAuth2 consent flow for Gmail background email sending.
 * Strictly requires an authenticated user session.
 * Binds the OAuth flow to the caller's server-resolved Firebase UID using
 * a cryptographically random, tamper-proof, short-lived, single-use state token.
 */
export async function GET(request: Request) {
  // 1. Authoritatively verify authenticated session server-side
  const session = await resolveAuthSession(request);
  if (!session || !session.uid) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized: Authentication required before initiating Gmail OAuth connection.',
      },
      { status: 401 }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const url = new URL(request.url);
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || `${url.origin}/api/email/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        success: false,
        error:
          'GMAIL_CONFIG_ERROR: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables must be configured on the server before initiating Google OAuth.',
        hint: 'Configure Google Cloud Console OAuth Client ID (Web Application) with authorized redirect URI: ' + redirectUri,
      },
      { status: 500 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // 2. Generate cryptographically random, single-use state bound to session.uid
  const secureState = generateOAuthState(session.uid);

  // Generate OAuth consent URL requesting offline access to acquire refresh token.
  // Include openid + email scopes so the callback receives an id_token with the
  // authorized account email — needed to detect OAuth account mismatch with GMAIL_SENDER_EMAIL.
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // Forces refresh token issuance
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    include_granted_scopes: false,
    state: secureState,
  });

  return NextResponse.redirect(authUrl);
}
