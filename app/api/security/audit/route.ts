import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  const sessionInfo = await session();
  if (!sessionInfo?.token?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');
    const users = await sql`SELECT id FROM users WHERE descope_user_id = ${sessionInfo.token.sub}` as { id: string }[];
    if (!users.length) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const userId = users[0].id;

    let rows: any[] = [];
    if (scope === 'all') {
      // Require admin
      const isAdmin = await sql`SELECT 1 FROM group_members WHERE user_id = ${userId} AND role = 'admin' LIMIT 1` as any[];
      if (!isAdmin.length) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      rows = await sql`SELECT id, user_id, event_type, details, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 100`;
    } else {
      rows = await sql`SELECT id, user_id, event_type, details, created_at FROM audit_logs WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 100`;
    }

    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    console.error('security/audit error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


