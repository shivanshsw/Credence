// app/api/tasks/[id]/route.ts
import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';
import { tasksService } from '@/lib/tasks';
import { rbacService } from '@/lib/rbac';

const sql = neon(process.env.DATABASE_URL!);


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
    const hasReadPermission = await rbacService.hasPermission(userId, 'task_assignment:read');
    if (!hasReadPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const task = await tasksService.getTaskById(params.id, userId);
    
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(task);

  } catch (error) {
    console.error('Task GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Update a task
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const sessionInfo = await session();
  
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, description, dueDate, priority, status } = await request.json();

    // Get user ID
    const users = await sql`
      SELECT id FROM users WHERE descope_user_id = ${sessionInfo.token.sub}
    `;
    
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userId = users[0].id;

    // Check permissions
    const hasUpdatePermission = await rbacService.hasPermission(userId, 'task_assignment:update');
    if (!hasUpdatePermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const task = await tasksService.updateTask(params.id, userId, {
      title,
      description,
      dueDate,
      priority,
      status
    });

    return NextResponse.json(task);

  } catch (error) {
    console.error('Task PUT error:', error);
    if (error instanceof Error && error.message.includes('You can only update')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


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
    const hasUpdatePermission = await rbacService.hasPermission(userId, 'task_assignment:update');
    if (!hasUpdatePermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await tasksService.deleteTask(params.id, userId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Task DELETE error:', error);
    if (error instanceof Error && error.message.includes('You can only delete')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
