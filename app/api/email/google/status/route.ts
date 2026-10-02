import { NextResponse } from 'next/server';
import {
  getGmailRefreshToken,
  getStoredOAuthAccountEmail,
  getStoredSenderEmail,
  clearTokenCacheForTesting,
} from '@/lib/email-providers/token-store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/email/google/status
 *
 * Authoritative, safe endpoint to check whether Gmail OAuth is connected.
 * NEVER exposes secret tokens or refresh tokens to the browser.
 * NEVER launches or triggers OAuth flow automatically.
 */
export async function GET() {
  try {
    const refreshToken = await getGmailRefreshToken();
    const authorizedEmail = getStoredOAuthAccountEmail();
    const senderEmail = getStoredSenderEmail();

    const isConnected = Boolean(refreshToken && refreshToken.trim().length > 10);

    return NextResponse.json(
      {
        connected: isConnected,
        email: isConnected ? (authorizedEmail || senderEmail || null) : null,
        sender: senderEmail || null,
        scopes: isConnected ? ['https://www.googleapis.com/auth/gmail.send'] : [],
        status: isConnected ? 'connected' : 'disconnected',
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (err: any) {
    console.error('[HeatShield Gmail Status] Error inspecting connection state:', err?.message);
    return NextResponse.json(
      {
        connected: false,
        email: null,
        sender: null,
        scopes: [],
        status: 'error',
        error: 'Failed to inspect Gmail OAuth connection state.',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/email/google/status
 *
 * Allows disconnecting the Gmail OAuth integration explicitly.
 */
export async function DELETE() {
  try {
    clearTokenCacheForTesting();

    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('oauth_tokens')
        .delete()
        .eq('provider', 'google');
    }

    return NextResponse.json({
      connected: false,
      message: 'Gmail OAuth connection disconnected successfully.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to disconnect Gmail OAuth' },
      { status: 500 }
    );
  }
}
