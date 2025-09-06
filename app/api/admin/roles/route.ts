// app/api/admin/roles/route.ts
import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';
import { rbacService } from '@/lib/rbac';

const sql = neon(process.env.DATABASE_URL!);

// GET: Get all users with their roles
export async function GET() {
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

    // Check admin permissions
    const hasAdminPermission = await rbacService.hasPermission(userId, 'admin:permissions');
    if (!hasAdminPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const allUsers = await sql`
      SELECT id, name, email, role, created_at
      FROM users
      ORDER BY created_at DESC
    `;

    return NextResponse.json(allUsers);

  } catch (error) {
    console.error('Roles GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Update user role
export async function PUT(request: Request) {
  const sessionInfo = await session();
  
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId, role } = await request.json();
    
    if (!userId || !role) {
      return NextResponse.json({ error: 'UserId and role are required' }, { status: 400 });
    }

    // Get current user ID
    const users = await sql`
      SELECT id FROM users WHERE descope_user_id = ${sessionInfo.token.sub}
    `;
    
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const currentUserId = users[0].id;

    // Check admin permissions
    const hasAdminPermission = await rbacService.hasPermission(currentUserId, 'admin:permissions');
    if (!hasAdminPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await rbacService.updateUserRole(userId, role);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Roles PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
