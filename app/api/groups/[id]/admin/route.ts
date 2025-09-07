// app/api/groups/[id]/admin/route.ts
import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';
import { rbacService } from '@/lib/rbac';

const sql = neon(process.env.DATABASE_URL!);

// GET: Get group admin data (permissions, roles, custom permissions)
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const sessionInfo = await session();
  
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const groupId = id;
    const descopeUserId = sessionInfo.token.sub;

    // Get user's internal ID
    const users = await sql`
      SELECT id FROM users WHERE descope_user_id = ${descopeUserId}
    ` as { id: string }[];

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userId = users[0].id;

    // Check if user is admin of this group
    const membership = await sql`
      SELECT role FROM group_members 
      WHERE group_id = ${groupId} AND user_id = ${userId}
    ` as { role: string }[];

    if (!membership || membership.length === 0 || membership[0].role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all available permissions
    const permissions = await rbacService.getAllPermissions();

    // Get group-specific role permissions
    const groupRolePermissions = await sql`
      SELECT role, permission_name 
      FROM group_role_permissions 
      WHERE group_id = ${groupId}
    ` as { role: string; permission_name: string }[];

    // Get group-specific custom permission text
    const customPermissions = await sql`
      SELECT role, custom_permission_text 
      FROM group_custom_permissions 
      WHERE group_id = ${groupId}
    ` as { role: string; custom_permission_text: string }[];

    // Get group members with their roles
    const groupMembers = await sql`
      SELECT u.id, u.name, u.email, gm.role
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ${groupId}
    ` as { id: string; name: string; email: string; role: string }[];

    // Organize role permissions by role
    const rolePermissionsMap: Record<string, string[]> = {};
    groupRolePermissions.forEach(gp => {
      if (!rolePermissionsMap[gp.role]) {
        rolePermissionsMap[gp.role] = [];
      }
      rolePermissionsMap[gp.role].push(gp.permission_name);
    });

    // Organize custom permissions by role
    const customPermissionsMap: Record<string, string> = {};
    customPermissions.forEach(cp => {
      customPermissionsMap[cp.role] = cp.custom_permission_text;
    });

    return NextResponse.json({
      permissions,
      groupMembers,
      rolePermissions: rolePermissionsMap,
      customPermissions: customPermissionsMap
    });

  } catch (error) {
    console.error('Group admin GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Update group role permissions and custom permission text
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const sessionInfo = await session();
  
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const groupId = id;
    const descopeUserId = sessionInfo.token.sub;
    const { role, permissions, customPermissionText } = await request.json();

    if (!role) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 });
    }

    // Get user's internal ID
    const users = await sql`
      SELECT id FROM users WHERE descope_user_id = ${descopeUserId}
    ` as { id: string }[];

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userId = users[0].id;

    // Check if user is admin of this group
    const membership = await sql`
      SELECT role FROM group_members 
      WHERE group_id = ${groupId} AND user_id = ${userId}
    ` as { role: string }[];

    if (!membership || membership.length === 0 || membership[0].role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Update group role permissions
    if (Array.isArray(permissions)) {
      // Delete existing permissions for this role in this group
      await sql`
        DELETE FROM group_role_permissions 
        WHERE group_id = ${groupId} AND role = ${role}
      `;

      // Insert new permissions
      if (permissions.length > 0) {
        const permissionInserts = permissions.map(permission => 
          sql`INSERT INTO group_role_permissions (group_id, role, permission_name) VALUES (${groupId}, ${role}, ${permission})`
        );
        await Promise.all(permissionInserts);
      }
    }

    // Update custom permission text
    if (customPermissionText !== undefined) {
      await sql`
        INSERT INTO group_custom_permissions (group_id, role, custom_permission_text)
        VALUES (${groupId}, ${role}, ${customPermissionText})
        ON CONFLICT (group_id, role)
        DO UPDATE SET 
          custom_permission_text = EXCLUDED.custom_permission_text,
          updated_at = NOW()
      `;
    }

    return NextResponse.json({ success: true, message: 'Group permissions updated successfully' });

  } catch (error) {
    console.error('Group admin POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
