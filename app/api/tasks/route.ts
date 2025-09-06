// app/api/tasks/route.ts
import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';
import { tasksService } from '@/lib/tasks';
import { rbacService } from '@/lib/rbac';

const sql = neon(process.env.DATABASE_URL!);

// GET: Fetch user's tasks
export async function GET(request: Request) {
  const sessionInfo = await session();
  
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

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

    let tasks = [];
    
    if (groupId) {
      tasks = await tasksService.getTasksForGroup(groupId);
    } else {
      tasks = await tasksService.getTasksForUser(userId);
    }

    return NextResponse.json(tasks);

  } catch (error) {
    console.error('Tasks GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new task
export async function POST(request: Request) {
  const sessionInfo = await session();
  
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, description, assignedToUserId, groupId, dueDate, priority } = await request.json();
    
    if (!title || !description || !assignedToUserId || !groupId) {
      return NextResponse.json({ error: 'Title, description, assignedToUserId, and groupId are required' }, { status: 400 });
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
    const hasCreatePermission = await rbacService.hasPermission(userId, 'task_assignment:create');
    if (!hasCreatePermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const task = await tasksService.createTask({
      title,
      description,
      assignedToUserId,
      assignedByUserId: userId,
      groupId,
      dueDate,
      priority
    });

    return NextResponse.json(task, { status: 201 });

  } catch (error) {
    console.error('Tasks POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
