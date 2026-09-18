import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { saveGmailRefreshToken } from '@/lib/email-providers/token-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/email/google/callback
 * Handles the Google OAuth2 redirect, exchanges authorization code for tokens,
 * and securely persists the encrypted refresh token in server-side storage.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head><title>HeatShield AI — OAuth Authorization Error</title></head>
        <body style="font-family: sans-serif; background: #0b1324; color: #f8fafc; padding: 40px; text-align: center;">
          <div style="max-width: 500px; margin: 0 auto; background: #131c2e; padding: 30px; border-radius: 12px; border: 1px solid #dc2626;">
            <h2 style="color: #ef4444;">Google Authorization Cancelled or Failed</h2>
            <p style="color: #94a3b8; font-size: 14px;">Error returned from Google: <code>${error}</code></p>
            <a href="/profile" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">Return to HeatShield AI</a>
          </div>
        </body>
      </html>`,
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  if (!code) {
    return NextResponse.json(
      { success: false, error: 'Missing authorization code in OAuth callback.' },
      { status: 400 }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || `${url.origin}/api/email/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { success: false, error: 'Server environment missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.' },
      { status: 500 }
    );
  }

  try {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      // If prompt: consent was not forced or token already granted without revoke
      console.warn('[HeatShield OAuth] No refresh_token returned by Google. Access token granted.');
    } else {
      await saveGmailRefreshToken(tokens.refresh_token);
      console.log('[HeatShield OAuth] Encrypted Gmail OAuth refresh token securely persisted.');
    }

    return new Response(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>HeatShield AI — Gmail Integration Connected</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090d16; color: #f8fafc; padding: 40px; text-align: center; }
            .card { max-width: 540px; margin: 0 auto; background: #131c2e; padding: 36px; border-radius: 16px; border: 1px solid #10b981; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            h2 { color: #10b981; margin-top: 0; }
            p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
            .badge { display: inline-block; padding: 6px 14px; background: #064e3b; color: #6ee7b7; border-radius: 9999px; font-weight: bold; font-size: 12px; margin-bottom: 20px; }
            .btn { display: inline-block; margin-top: 24px; padding: 12px 24px; background: #10b981; color: #022c22; font-weight: bold; text-decoration: none; border-radius: 8px; font-size: 14px; }
            .btn:hover { background: #34d399; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">OAUTH AUTHORIZATION CERTIFIED</div>
            <h2>Gmail Background Dispatch Connected!</h2>
            <p>
              Your Google authorization code was exchanged successfully. The offline refresh token has been securely encrypted with AES-256-GCM and stored for autonomous hourly heat risk dispatching.
            </p>
            <p style="font-size: 12px; color: #64748b;">
              Required scope: <code>https://www.googleapis.com/auth/gmail.send</code>
            </p>
            <a href="/" class="btn">Return to HeatShield Dashboard</a>
          </div>
        </body>
      </html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (err: any) {
    console.error('[HeatShield OAuth] Token exchange error:', err?.message);
    return NextResponse.json(
      {
        success: false,
        error: `OAuth token exchange failed: ${err?.message || 'Unknown exception'}`,
      },
      { status: 500 }
    );
  }
}
