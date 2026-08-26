import { NextResponse } from 'next/server';
import { getEmailServiceStatus } from '@/lib/email-service';

export const dynamic = 'force-dynamic';

/**
 * Public/Safe endpoint to query email delivery mode (SANDBOX vs PRODUCTION).
 * NEVER exposes API keys, tokens, or secret credentials.
 */
export async function GET() {
  const status = await getEmailServiceStatus();
  return NextResponse.json(status, { status: 200 });
}
