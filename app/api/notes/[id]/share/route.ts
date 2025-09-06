// app/api/notes/[id]/share/route.ts
import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';
import { notesService } from '@/lib/notes';
import { rbacService } from '@/lib/rbac';

const sql = neon(process.env.DATABASE_URL!);

// POST: Share a note with another user
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const sessionInfo = await session();
  
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
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

    // Find the user to share with
    const sharedWithUser = await sql`
      SELECT id FROM users WHERE email = ${email}
    `;
    
    if (sharedWithUser.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await notesService.shareNote({
      noteId: params.id,
      sharedWithUserId: sharedWithUser[0].id,
      sharedByUserId: userId
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Note share error:', error);
    if (error instanceof Error && error.message.includes('You can only share')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
