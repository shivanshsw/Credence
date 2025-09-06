// app/api/admin/permissions/route.ts
import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';
import { rbacService } from '@/lib/rbac';

const sql = neon(process.env.DATABASE_URL!);

// GET: Get all roles and permissions
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

    const [roles, permissions] = await Promise.all([
      rbacService.getAllRoles(),
      rbacService.getAllPermissions()
    ]);

    return NextResponse.json({ roles, permissions });

  } catch (error) {
    console.error('Permissions GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Update role permissions
export async function POST(request: Request) {
  const sessionInfo = await session();
  
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { role, permissions } = await request.json();
    
    if (!role || !Array.isArray(permissions)) {
      return NextResponse.json({ error: 'Role and permissions array are required' }, { status: 400 });
    }

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

    await rbacService.updateRolePermissions(role, permissions);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Permissions POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
