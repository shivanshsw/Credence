import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function PATCH(request: Request) {
  const sessionInfo = await session();
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { task_id, is_completed } = await request.json();
    if (!task_id || typeof is_completed !== 'boolean') {
      return NextResponse.json({ error: 'task_id and is_completed are required' }, { status: 400 });
    }

    const users = await sql`
      SELECT id FROM users WHERE descope_user_id = ${sessionInfo.token.sub}
    ` as { id: string }[];
    if (!users.length) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const userId = users[0].id;

    // Only assigned_to or assigned_by can toggle completion
    const owning = await sql`
      SELECT assigned_to_user_id, assigned_by_user_id FROM tasks WHERE id = ${task_id}
    ` as { assigned_to_user_id: string; assigned_by_user_id: string }[];
    if (!owning.length) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (owning[0].assigned_to_user_id !== userId && owning[0].assigned_by_user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await sql`
      UPDATE tasks SET status = ${is_completed ? 'completed' : 'pending'}, updated_at = NOW() WHERE id = ${task_id}
    `;

    // audit
    try {
      await sql`
        INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, metadata)
        VALUES (${userId}, 'task.complete', 'task', ${task_id}, ${JSON.stringify({ completed: is_completed })})
      `;
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/tasks/complete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


