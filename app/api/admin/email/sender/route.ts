import { NextResponse } from 'next/server';
import { GET as getGoogleStatus, DELETE as deleteGoogleStatus } from '@/app/api/email/google/status/route';

export const dynamic = 'force-dynamic';

/**
 * /api/admin/email/sender
 * Dedicated Admin route for system email sender configuration.
 * Strictly requires server-side admin authorization.
 */
export async function GET(request: Request) {
  return getGoogleStatus(request);
}

export async function DELETE(request: Request) {
  return deleteGoogleStatus(request);
}
