// app/api/notes/route.ts
import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';
import { notesService } from '@/lib/notes';
import { rbacService } from '@/lib/rbac';

const sql = neon(process.env.DATABASE_URL!);

// GET: Fetch user's notes
export async function GET(request: Request) {
  const sessionInfo = await session();
  
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // 'all', 'private', 'shared'

    // Get user ID
    const users = await sql`
      SELECT id FROM users WHERE descope_user_id = ${sessionInfo.token.sub}
    `;
    
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userId = users[0].id;

    // Check permissions
    const hasReadPermission = await rbacService.hasPermission(userId, 'notes:read');
    if (!hasReadPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    let notes = [];
    if (type === 'all') {
      const [privateNotes, sharedNotes] = await Promise.all([
        notesService.getNotesForUser(userId),
        notesService.getSharedNotesForUser(userId)
      ]);
      notes = [...privateNotes, ...sharedNotes];
    } else if (type === 'private') {
      notes = await notesService.getNotesForUser(userId);
    } else if (type === 'shared') {
      notes = await notesService.getSharedNotesForUser(userId);
    }

    return NextResponse.json(notes);

  } catch (error) {
    console.error('Notes GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new note
export async function POST(request: Request) {
  const sessionInfo = await session();
  
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, content, isPrivate = true } = await request.json();
    
    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
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
    const hasCreatePermission = await rbacService.hasPermission(userId, 'notes:create');
    if (!hasCreatePermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const note = await notesService.createNote({
      title,
      content,
      isPrivate,
      authorId: userId
    });

    return NextResponse.json(note, { status: 201 });

  } catch (error) {
    console.error('Notes POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
