import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  const sessionInfo = await session();
  if (!sessionInfo?.token?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const users = await sql`SELECT id FROM users WHERE descope_user_id = ${sessionInfo.token.sub}` as { id: string }[];
    if (!users.length) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const userId = users[0].id;

    const groups = await sql`
      SELECT g.id, g.name, gm.role
      FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      WHERE gm.user_id = ${userId}
      ORDER BY g.name ASC
    `;

    return NextResponse.json({ success: true, data: groups });
  } catch (e) {
    console.error('security/access error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


