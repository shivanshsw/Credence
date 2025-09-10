import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);


export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const sessionInfo = await session();
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const tokens: string[] = Array.isArray(body?.recipients)
      ? body.recipients
      : (body?.recipient ? [body.recipient] : []);

    // 
    const users = await sql`SELECT id FROM users WHERE descope_user_id = ${sessionInfo.token.sub}`;
    if (users.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const userId = users[0].id as string;

    // 
    const note = await sql`SELECT author_id FROM notes WHERE id = ${id}`;
    if (!note.length) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    if (note[0].author_id !== userId) return NextResponse.json({ error: 'Only author can manage sharing' }, { status: 403 });

    // Resolve tokens to user ids
    const ids: string[] = [];
    for (const token of tokens) {
      const rs = await sql`SELECT id FROM users WHERE email = ${token} OR username = ${token}` as { id: string }[];
      if (rs.length) ids.push(rs[0].id);
    }

    if (ids.length > 0) {
      await sql`DELETE FROM note_shares WHERE note_id = ${id} AND shared_with_user_id = ANY(${ids})`;
    }

    // If no more shares, make private again
    const remaining = await sql`SELECT 1 FROM note_shares WHERE note_id = ${id} LIMIT 1`;
    if (remaining.length === 0) {
      await sql`UPDATE notes SET is_private = true, updated_at = NOW() WHERE id = ${id}`;
    }

    // audit
    try {
      await sql`
        INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, metadata)
        VALUES (${userId}, 'note.unshare', 'note', ${id}, ${JSON.stringify({ removed: ids.length })})
      `;
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unshare error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const sessionInfo = await session();
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { emails } = await request.json();
    if (!Array.isArray(emails)) {
      return NextResponse.json({ error: 'emails array required' }, { status: 400 });
    }

    const users = await sql`SELECT id FROM users WHERE descope_user_id = ${sessionInfo.token.sub}` as { id: string }[];
    if (!users.length) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const userId = users[0].id;

    // Only note owner can unshare
    const own = await sql`SELECT author_id FROM notes WHERE id = ${params.id}` as { author_id: string }[];
    if (!own.length) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    if (own[0].author_id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Remove access for listed emails
    for (const email of emails) {
      const rs = await sql`SELECT id FROM users WHERE email = ${email}` as { id: string }[];
      if (rs.length) {
        await sql`DELETE FROM note_shares WHERE note_id = ${params.id} AND shared_with_user_id = ${rs[0].id}`;
      }
    }

    // If no more shares, mark as private
    const remaining = await sql`SELECT 1 FROM note_shares WHERE note_id = ${params.id} LIMIT 1` as any[];
    if (!remaining.length) {
      await sql`UPDATE notes SET is_private = true, updated_at = NOW() WHERE id = ${params.id}`;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unshare note error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


