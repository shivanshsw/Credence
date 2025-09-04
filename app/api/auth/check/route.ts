// app/api/auth/check/route.ts

import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';

export async function GET() {
    const sessionInfo = await session();
    return NextResponse.json(sessionInfo);
}