// app/api/notes/[id]/share/route.ts
import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';
import { notesService } from '@/lib/notes';
import { rbacService } from '@/lib/rbac';

const sql = neon(process.env.DATABASE_URL!);

// POST: Share a note with another user
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
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ error: 'Provide recipient or recipients[] (username or email)' }, { status: 400 });
    }

    // Get user ID
    const users = await sql`
      SELECT id FROM users WHERE descope_user_id = ${sessionInfo.token.sub}
    `;
    
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userId = users[0].id;

    // Check permissions
    const hasSharePermission = await rbacService.hasPermission(userId, 'notes:share');
    if (!hasSharePermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Resolve emails to user ids
    const ids: string[] = [];
    const notFound: string[] = [];
    for (const token of tokens) {
      // allow username or email
      const rs = await sql`SELECT id FROM users WHERE email = ${token} OR username = ${token}` as { id: string }[];
      if (rs.length) ids.push(rs[0].id); else notFound.push(token);
    }
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No users found for provided emails', notFound }, { status: 404 });
    }

    // Enforce same-group membership: resolve note group and ensure target users are members
    // Share with all and mark note as shared (is_private=false). No group restriction.
    for (const sharedWithUserId of ids) {
      await notesService.shareNote({ noteId: id, sharedWithUserId, sharedByUserId: userId });
    }
    await sql`UPDATE notes SET is_private = false, updated_at = NOW() WHERE id = ${id}`;

    // audit
    try {
      await sql`
        INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, metadata)
        VALUES (${userId}, 'note.share', 'note', ${id}, ${JSON.stringify({ recipients: ids.length })})
      `;
    } catch {}

    return NextResponse.json({ success: true, sharedCount: ids.length, notFound });

  } catch (error) {
    console.error('Note share error:', error);
    if (error instanceof Error && error.message.includes('You can only share')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
