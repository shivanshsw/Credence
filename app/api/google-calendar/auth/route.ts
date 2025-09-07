import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';

// For now, we check for an access token in env or future Descope token store
// Replace with Descope Outbound App token retrieval when configured

export async function GET() {
  const sessionInfo = await session();
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tokenPresent = !!process.env.GCAL_ACCESS_TOKEN;

  // If not connected, return a placeholder URL (to be replaced with Descope OAuth URL)
  if (!tokenPresent) {
    return NextResponse.json({ connected: false, authorizeUrl: '/settings/connect-google' });
  }

  return NextResponse.json({ connected: true });
}


