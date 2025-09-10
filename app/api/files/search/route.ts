import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  const sessionInfo = await session();
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('query') || '').trim();
    const groupId = (searchParams.get('group_id') || '').trim();

    if (!groupId) {
      return NextResponse.json({ error: 'group_id is required' }, { status: 400 });
    }

    // Resolve user and verify membershipa
    const users = await sql`SELECT id FROM users WHERE descope_user_id = ${sessionInfo.token.sub}`;
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userId = users[0].id as string;
    const membership = await sql`SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}`;
    if (membership.length === 0) {
      return NextResponse.json({ error: 'Forbidden: not a member of this group' }, { status: 403 });
    }

    if (!query) {
      const recent = await sql`
        SELECT file_id, title, description, file_url, uploaded_at
        FROM uploaded_files
        WHERE group_id = ${groupId}
        ORDER BY uploaded_at DESC
        LIMIT 20
      `;
      return NextResponse.json({ files: recent });
    }

    const results = await sql`
      SELECT file_id, title, description, file_url, uploaded_at
      FROM uploaded_files
      WHERE group_id = ${groupId}
      AND to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')) @@ plainto_tsquery('english', ${query})
      ORDER BY uploaded_at DESC
      LIMIT 20
    `;

    return NextResponse.json({ files: results });
  } catch (error) {
    console.error('Search failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


