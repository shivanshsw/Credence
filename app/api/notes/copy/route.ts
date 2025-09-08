import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// POST: Copy a note to a new private note owned by current user
// Input: { note_id }
export async function POST(request: Request) {
  const sessionInfo = await session();
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { note_id } = await request.json();
    if (!note_id) return NextResponse.json({ error: 'note_id required' }, { status: 400 });

    const users = await sql`SELECT id FROM users WHERE descope_user_id = ${sessionInfo.token.sub}`;
    if (!users.length) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const userId = users[0].id as string;

    // Fetch source if accessible to user (owner or shared)
    const src = await sql`
      SELECT n.title, n.content
      FROM notes n
      WHERE n.id = ${note_id} AND (
        n.author_id = ${userId} OR EXISTS (
          SELECT 1 FROM note_shares ns WHERE ns.note_id = n.id AND ns.shared_with_user_id = ${userId}
        )
      )
    `;
    if (!src.length) return NextResponse.json({ error: 'Note not found or not accessible' }, { status: 404 });

    const title = src[0].title + ' (Copy)';
    const content = src[0].content;
    const inserted = await sql`
      INSERT INTO notes (title, content, author_id, is_private)
      VALUES (${title}, ${content}, ${userId}, true)
      RETURNING id
    `;
    // audit
    try {
      await sql`
        INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, metadata)
        VALUES (${userId}, 'note.copy', 'note', ${note_id}, ${JSON.stringify({ newId: inserted[0].id })})
      `;
    } catch {}

    const full = await sql`
      SELECT n.id, n.title, n.content, n.author_id, n.is_private, n.created_at, n.updated_at, u.name as author_name
      FROM notes n JOIN users u ON n.author_id = u.id WHERE n.id = ${inserted[0].id}
    ` as any[];
    return NextResponse.json({
      id: full[0].id,
      title: full[0].title,
      content: full[0].content,
      authorId: full[0].author_id,
      authorName: full[0].author_name,
      isPrivate: full[0].is_private,
      createdAt: full[0].created_at,
      updatedAt: full[0].updated_at
    }, { status: 201 });
  } catch (error) {
    console.error('Copy note error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// (duplicate removed)
