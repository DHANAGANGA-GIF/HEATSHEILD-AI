import { NextResponse } from 'next/server';
import { broadcastLiveAlertsToAllRecipients } from '@/lib/broadcast-service';
import { RiskLevel } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      targetEmail,
      sendToAll = true,
      minRiskLevel,
      customSubject,
      customMessage,
      clientLocation,
    } = body as {
      targetEmail?: string;
      sendToAll?: boolean;
      minRiskLevel?: RiskLevel;
      customSubject?: string;
      customMessage?: string;
      clientLocation?: {
        latitude: number;
        longitude: number;
        location_name?: string;
        location_source?: 'LIVE_GPS' | 'SAVED_LOCATION' | 'MANUAL_LOCATION' | 'UNAVAILABLE';
        gps_accuracy?: number;
      };
    };

    const broadcastResponse = await broadcastLiveAlertsToAllRecipients({
      targetEmail,
      sendToAll,
      minRiskLevel,
      customSubject,
      customMessage,
      clientLocation,
    });

    return NextResponse.json(broadcastResponse, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Server error during live broadcast dispatch',
      },
      { status: 500 }
    );
  }
}
