import { NextResponse } from 'next/server';
// Gmail connect route - force redeploy
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

/**
 * GET /api/email/google/connect
 * Initiates the Google OAuth2 consent flow for Gmail background email sending.
 * Strictly requests ONLY the 'https://www.googleapis.com/auth/gmail.send' scope.
 */
export async function GET(request: Request) {
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

  // Generate OAuth consent URL requesting offline access to acquire refresh token
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // Forces refresh token issuance
    scope: ['https://www.googleapis.com/auth/gmail.send'],
    include_granted_scopes: false,
    state: Buffer.from(JSON.stringify({ initiatedAt: Date.now() })).toString('base64url'),
  });

  return NextResponse.redirect(authUrl);
}
