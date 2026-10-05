import { NextResponse } from 'next/server';
import {
  getGmailRefreshToken,
  getStoredOAuthAccountEmail,
  getStoredSenderEmail,
  clearTokenCacheForTesting,
} from '@/lib/email-providers/token-store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { getDeliveryStats } from '@/lib/email-service';

export const dynamic = 'force-dynamic';

function maskEmail(email?: string | null): string {
  if (!email || !email.includes('@')) return 'Not configured';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

/**
 * GET /api/email/google/status
 *
 * Admin-only authoritative, safe endpoint to check whether Gmail OAuth sender is connected.
 * Strictly requires admin privileges. Normal users receive 403 Forbidden.
 * NEVER exposes secret tokens or refresh tokens to the browser.
 * NEVER launches or triggers OAuth flow automatically.
 */
export async function GET(request: Request) {
  // Authoritatively verify admin authorization server-side
  const adminAuth = await verifyAdminRequest(request);
  if (!adminAuth.authorized) {
    return NextResponse.json(
      {
        success: false,
        error: adminAuth.error || 'Forbidden: Administrator privileges required to access sender configuration.',
      },
      { status: adminAuth.status }
    );
  }

  try {
    const refreshToken = await getGmailRefreshToken();
    const authorizedEmail = getStoredOAuthAccountEmail();
    const senderEmail = process.env.GMAIL_SENDER_EMAIL || getStoredSenderEmail() || authorizedEmail;

    const isConnected = Boolean(refreshToken && refreshToken.trim().length > 10);
    const stats = getDeliveryStats();

    let senderStatus: 'CONNECTED' | 'NOT CONFIGURED' | 'ERROR' = 'NOT CONFIGURED';
    if (isConnected) {
      senderStatus = 'CONNECTED';
    } else if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      senderStatus = 'NOT CONFIGURED';
    } else {
      senderStatus = 'NOT CONFIGURED';
    }

    return NextResponse.json(
      {
        connected: isConnected,
        senderStatus,
        provider: 'Gmail API',
        email: isConnected ? (authorizedEmail || senderEmail || null) : null,
        sender: senderEmail || null,
        senderAddress: isConnected ? maskEmail(authorizedEmail || senderEmail) : 'Not configured',
        rawSenderAddress: isConnected ? (authorizedEmail || senderEmail || null) : null,
        scopes: isConnected ? ['https://www.googleapis.com/auth/gmail.send'] : [],
        status: isConnected ? 'connected' : 'disconnected',
        lastSuccessfulDelivery: stats.lastSuccessfulDelivery,
        lastDeliveryFailure: stats.lastDeliveryFailure ? stats.lastDeliveryFailure.error : null,
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
        senderStatus: 'ERROR',
        provider: 'Gmail API',
        email: null,
        sender: null,
        senderAddress: 'Not configured',
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
 * Allows disconnecting the Gmail OAuth system sender integration explicitly.
 * Strictly requires admin privileges. Normal users receive 403 Forbidden.
 */
export async function DELETE(request: Request) {
  const adminAuth = await verifyAdminRequest(request);
  if (!adminAuth.authorized) {
    return NextResponse.json(
      {
        success: false,
        error: adminAuth.error || 'Forbidden: Administrator privileges required to disconnect system sender.',
      },
      { status: adminAuth.status }
    );
  }

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
      senderStatus: 'NOT CONFIGURED',
      message: 'Gmail OAuth system sender disconnected successfully.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to disconnect Gmail OAuth system sender' },
      { status: 500 }
    );
  }
}
