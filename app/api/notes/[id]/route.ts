// app/api/notes/[id]/route.ts
import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';
import { notesService } from '@/lib/notes';
import { rbacService } from '@/lib/rbac';

const sql = neon(process.env.DATABASE_URL!);

// GET: Get a specific note
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const sessionInfo = await session();
  
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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

    const note = await notesService.getNoteById(params.id, userId);
    
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json(note);

  } catch (error) {
    console.error('Note GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Update a note
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const sessionInfo = await session();
  
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, content, isPrivate } = await request.json();

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

    const note = await notesService.updateNote(params.id, userId, {
      title,
      content,
      isPrivate
    });

    return NextResponse.json(note);

  } catch (error) {
    console.error('Note PUT error:', error);
    if (error instanceof Error && error.message.includes('You can only update')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Delete a note
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const sessionInfo = await session();
  
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user ID
    const users = await sql`
      SELECT id FROM users WHERE descope_user_id = ${sessionInfo.token.sub}
    `;
    
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userId = users[0].id;

    // Check permissions
    const hasDeletePermission = await rbacService.hasPermission(userId, 'notes:delete');
    if (!hasDeletePermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await notesService.deleteNote(params.id, userId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Note DELETE error:', error);
    if (error instanceof Error && error.message.includes('You can only delete')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
