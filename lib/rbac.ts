// lib/rbac.ts
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export interface UserPermissions {
  role: string;
  permissions: string[];
  groupPermissions?: string[];
  customPermissionText?: string;
}

export class RBACService {
  async getUserPermissions(userId: string): Promise<UserPermissions> {
    try {
      // Get user role
      const userResult = await sql`
        SELECT role FROM users WHERE id = ${userId}
      `;
      
      if (userResult.length === 0) {
        console.warn('User not found, using default permissions');
        return {
          role: 'employee',
          permissions: ['notes:create', 'notes:read', 'task_assignment:read', 'calendar:read']
        };
      }

      const role = userResult[0].role || 'employee';

      // Get permissions for the role
      const permissionsResult = await sql`
        SELECT p.name 
        FROM permissions p
        JOIN role_permissions rp ON p.name = rp.permission_name
        WHERE rp.role = ${role}
      `;

      const permissions = permissionsResult.map(p => p.name);

      return {
        role,
        permissions
      };
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      
      // Check if it's a column not found error
      if (error instanceof Error && error.message.includes('column "role" does not exist')) {
        console.warn('Role column does not exist, running migration...');
        // Try to run migration
        try {
          await fetch('/api/migrate', { method: 'POST' });
          console.log('Migration completed, retrying...');
          // Retry after migration
          return this.getUserPermissions(userId);
        } catch (migrationError) {
          console.error('Migration failed:', migrationError);
        }
      }
      
      // Return default employee permissions on error
      return {
        role: 'employee',
        permissions: ['notes:create', 'notes:read', 'task_assignment:read', 'calendar:read']
      };
    }
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(userId);
      return userPermissions.permissions.includes(permission);
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  async userHasRole(userId: string, role: string): Promise<boolean> {
    try {
      const result = await sql`
        SELECT 1 FROM users WHERE id = ${userId} AND role = ${role}
      `;
      return result.length > 0;
    } catch (error) {
      console.error('Error checking user role:', error);
      return false;
    }
  }

  async userHasGroupRole(userId: string, groupId: string, role: string): Promise<boolean> {
    try {
      const result = await sql`
        SELECT 1 FROM group_members WHERE user_id = ${userId} AND group_id = ${groupId} AND role = ${role}
      `;
      return result.length > 0;
    } catch (error) {
      console.error('Error checking group role:', error);
      return false;
    }
  }

  async getAllRoles(): Promise<Array<{ role: string; count: number }>> {
    try {
      const result = await sql`
        SELECT role, COUNT(*) as count
        FROM users 
        WHERE role IS NOT NULL
        GROUP BY role
        ORDER BY role
      `;
      return result as { role: string; count: number }[];
    } catch (error) {
      console.error('Error fetching roles:', error);
      return [];
    }
  }

  async getRolePermissions(role: string): Promise<string[]> {
    try {
      const result = await sql`
        SELECT p.name 
        FROM permissions p
        JOIN role_permissions rp ON p.name = rp.permission_name
        WHERE rp.role = ${role}
        ORDER BY p.name
      `;
      return result.map(r => r.name);
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      return [];
    }
  }

  async updateRolePermissions(role: string, permissions: string[]): Promise<void> {
    try {
      // Remove existing permissions for this role
      await sql`
        DELETE FROM role_permissions WHERE role = ${role}
      `;

      // Add new permissions
      if (permissions.length > 0) {
        const values = permissions.map(permission => `('${role}', '${permission}')`).join(',');
        await sql`
          INSERT INTO role_permissions (role, permission_name) 
          VALUES ${sql.unsafe(values)}
        `;
      }
    } catch (error) {
      console.error('Error updating role permissions:', error);
      throw error;
    }
  }

  async getAllPermissions(): Promise<Array<{ name: string; description: string }>> {
    try {
      const result = await sql`
        SELECT name, description 
        FROM permissions 
        ORDER BY name
      `;
      return result as { name: string; description: string }[];
    } catch (error) {
      console.error('Error fetching permissions:', error);
      return [];
    }
  }

  async updateUserRole(userId: string, role: string): Promise<void> {
    try {
      await sql`
        UPDATE users SET role = ${role} WHERE id = ${userId}
      `;
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }

  async getUserGroupPermissions(userId: string, groupId: string): Promise<{
    groupPermissions: string[];
    customPermissionText: string;
  }> {
    try {
      // Get user's role in the group
      const groupRole = await sql`
        SELECT role FROM group_members 
        WHERE group_id = ${groupId} AND user_id = ${userId}
      ` as { role: string }[];

      if (groupRole.length === 0) {
        return { groupPermissions: [], customPermissionText: '' };
      }

      const role = groupRole[0].role;

      // Get group-specific permissions for this role
      const groupPermissions = await sql`
        SELECT permission_name 
        FROM group_role_permissions 
        WHERE group_id = ${groupId} AND role = ${role}
      ` as { permission_name: string }[];

      // Get custom permission text for this role
      const customPermission = await sql`
        SELECT custom_permission_text 
        FROM group_custom_permissions 
        WHERE group_id = ${groupId} AND role = ${role}
      ` as { custom_permission_text: string }[];

      return {
        groupPermissions: groupPermissions.map(p => p.permission_name),
        customPermissionText: customPermission[0]?.custom_permission_text || ''
      };
    } catch (error) {
      console.error('Error fetching group permissions:', error);
      return { groupPermissions: [], customPermissionText: '' };
    }
  }
}

export const rbacService = new RBACService();
