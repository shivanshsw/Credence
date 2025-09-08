// lib/tasks.ts
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedToUserId: string;
  assignedToUserName: string;
  assignedByUserId: string;
  assignedByUserName: string;
  groupId: string;
  groupName: string;
  dueDate: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  // derived from status or explicit
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskData {
  title: string;
  description: string;
  assignedToUserId: string;
  assignedByUserId: string;
  groupId: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export class TasksService {
  async createTask(data: CreateTaskData): Promise<Task> {
    try {
      const result = await sql`
        INSERT INTO tasks (title, description, assigned_to_user_id, assigned_by_user_id, group_id, due_date, priority)
        VALUES (${data.title}, ${data.description}, ${data.assignedToUserId}, ${data.assignedByUserId}, ${data.groupId}, ${data.dueDate || null}, ${data.priority || 'medium'})
        RETURNING id, title, description, assigned_to_user_id, assigned_by_user_id, group_id, due_date, priority, status, created_at, updated_at
      `;

      const task = result[0];
      
      // Get user and group names
      const [assignedToUser, assignedByUser, group] = await Promise.all([
        sql`SELECT name FROM users WHERE id = ${data.assignedToUserId}`,
        sql`SELECT name FROM users WHERE id = ${data.assignedByUserId}`,
        sql`SELECT name FROM groups WHERE id = ${data.groupId}`
      ]);

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        assignedToUserId: task.assigned_to_user_id,
        assignedToUserName: assignedToUser[0]?.name || 'Unknown',
        assignedByUserId: task.assigned_by_user_id,
        assignedByUserName: assignedByUser[0]?.name || 'Unknown',
        groupId: task.group_id,
        groupName: group[0]?.name || 'Unknown',
        dueDate: task.due_date,
        priority: task.priority,
        status: task.status,
        createdAt: task.created_at,
        updatedAt: task.updated_at
      };
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  async getTasksForUser(userId: string): Promise<Task[]> {
    try {
      const result = await sql`
        SELECT 
          t.id, t.title, t.description, t.assigned_to_user_id, t.assigned_by_user_id, 
          t.group_id, t.due_date, t.priority, t.status, t.created_at, t.updated_at,
          u1.name as assigned_to_name,
          u2.name as assigned_by_name,
          g.name as group_name
        FROM tasks t
        JOIN users u1 ON t.assigned_to_user_id = u1.id
        JOIN users u2 ON t.assigned_by_user_id = u2.id
        JOIN groups g ON t.group_id = g.id
        WHERE t.assigned_to_user_id = ${userId}
        ORDER BY t.created_at DESC
      `;

      const mapped = result.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        assignedToUserId: task.assigned_to_user_id,
        assignedToUserName: task.assigned_to_name,
        assignedByUserId: task.assigned_by_user_id,
        assignedByUserName: task.assigned_by_name,
        groupId: task.group_id,
        groupName: task.group_name,
        dueDate: task.due_date,
        priority: task.priority,
        status: task.status,
        createdAt: task.created_at,
        updatedAt: task.updated_at
      }));
      // Incomplete first, then completed/cancelled, and within groups by due/created desc
      return mapped.sort((a: any, b: any) => {
        const ar = (a.status === 'completed' || a.status === 'cancelled') ? 1 : 0
        const br = (b.status === 'completed' || b.status === 'cancelled') ? 1 : 0
        if (ar !== br) return ar - br
        const at = a.dueDate ? Date.parse(a.dueDate) : Date.parse(a.createdAt)
        const bt = b.dueDate ? Date.parse(b.dueDate) : Date.parse(b.createdAt)
        return bt - at
      });
    } catch (error) {
      console.error('Error fetching user tasks:', error);
      throw error;
    }
  }

  async getTasksForGroup(groupId: string): Promise<Task[]> {
    try {
      const result = await sql`
        SELECT 
          t.id, t.title, t.description, t.assigned_to_user_id, t.assigned_by_user_id, 
          t.group_id, t.due_date, t.priority, t.status, t.created_at, t.updated_at,
          u1.name as assigned_to_name,
          u2.name as assigned_by_name,
          g.name as group_name
        FROM tasks t
        JOIN users u1 ON t.assigned_to_user_id = u1.id
        JOIN users u2 ON t.assigned_by_user_id = u2.id
        JOIN groups g ON t.group_id = g.id
        WHERE t.group_id = ${groupId}
        ORDER BY t.created_at DESC
      `;

      return result.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        assignedToUserId: task.assigned_to_user_id,
        assignedToUserName: task.assigned_to_name,
        assignedByUserId: task.assigned_by_user_id,
        assignedByUserName: task.assigned_by_name,
        groupId: task.group_id,
        groupName: task.group_name,
        dueDate: task.due_date,
        priority: task.priority,
        status: task.status,
        createdAt: task.created_at,
        updatedAt: task.updated_at
      }));
    } catch (error) {
      console.error('Error fetching group tasks:', error);
      throw error;
    }
  }

  async getAllTasks(): Promise<Task[]> {
    try {
      const result = await sql`
        SELECT 
          t.id, t.title, t.description, t.assigned_to_user_id, t.assigned_by_user_id, 
          t.group_id, t.due_date, t.priority, t.status, t.created_at, t.updated_at,
          u1.name as assigned_to_name,
          u2.name as assigned_by_name,
          g.name as group_name
        FROM tasks t
        JOIN users u1 ON t.assigned_to_user_id = u1.id
        JOIN users u2 ON t.assigned_by_user_id = u2.id
        JOIN groups g ON t.group_id = g.id
        ORDER BY t.created_at DESC
      `;

      return result.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        assignedToUserId: task.assigned_to_user_id,
        assignedToUserName: task.assigned_to_name,
        assignedByUserId: task.assigned_by_user_id,
        assignedByUserName: task.assigned_by_name,
        groupId: task.group_id,
        groupName: task.group_name,
        dueDate: task.due_date,
        priority: task.priority,
        status: task.status,
        createdAt: task.created_at,
        updatedAt: task.updated_at
      }));
    } catch (error) {
      console.error('Error fetching all tasks:', error);
      throw error;
    }
  }

  async updateTask(taskId: string, userId: string, updates: UpdateTaskData): Promise<Task> {
    try {
      // Check if user can update the task (either assigned to them or they assigned it)
      const taskResult = await sql`
        SELECT assigned_to_user_id, assigned_by_user_id FROM tasks WHERE id = ${taskId}
      `;

      if (taskResult.length === 0) {
        throw new Error('Task not found');
      }

      const task = taskResult[0];
      if (task.assigned_to_user_id !== userId && task.assigned_by_user_id !== userId) {
        throw new Error('You can only update tasks assigned to you or that you assigned');
      }

      // Update the task
      const updateFields = [];
      const values = [];

      if (updates.title !== undefined) {
        updateFields.push('title = $' + (values.length + 1));
        values.push(updates.title);
      }
      if (updates.description !== undefined) {
        updateFields.push('description = $' + (values.length + 1));
        values.push(updates.description);
      }
      if (updates.dueDate !== undefined) {
        updateFields.push('due_date = $' + (values.length + 1));
        values.push(updates.dueDate);
      }
      if (updates.priority !== undefined) {
        updateFields.push('priority = $' + (values.length + 1));
        values.push(updates.priority);
      }
      if (updates.status !== undefined) {
        updateFields.push('status = $' + (values.length + 1));
        values.push(updates.status);
      }

      updateFields.push('updated_at = NOW()');
      values.push(taskId);

      const query = `
        UPDATE tasks 
        SET ${updateFields.join(', ')}
        WHERE id = $${values.length}
        RETURNING id, title, description, assigned_to_user_id, assigned_by_user_id, group_id, due_date, priority, status, created_at, updated_at
      `;

      const result = await sql.unsafe(query, values);
      const updatedTask = result[0];

      // Get user and group names
      const [assignedToUser, assignedByUser, group] = await Promise.all([
        sql`SELECT name FROM users WHERE id = ${updatedTask.assigned_to_user_id}`,
        sql`SELECT name FROM users WHERE id = ${updatedTask.assigned_by_user_id}`,
        sql`SELECT name FROM groups WHERE id = ${updatedTask.group_id}`
      ]);

      return {
        id: updatedTask.id,
        title: updatedTask.title,
        description: updatedTask.description,
        assignedToUserId: updatedTask.assigned_to_user_id,
        assignedToUserName: assignedToUser[0]?.name || 'Unknown',
        assignedByUserId: updatedTask.assigned_by_user_id,
        assignedByUserName: assignedByUser[0]?.name || 'Unknown',
        groupId: updatedTask.group_id,
        groupName: group[0]?.name || 'Unknown',
        dueDate: updatedTask.due_date,
        priority: updatedTask.priority,
        status: updatedTask.status,
        createdAt: updatedTask.created_at,
        updatedAt: updatedTask.updated_at
      };
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  async deleteTask(taskId: string, userId: string): Promise<void> {
    try {
      // Check if user can delete the task (only the person who assigned it)
      const taskResult = await sql`
        SELECT assigned_by_user_id FROM tasks WHERE id = ${taskId}
      `;

      if (taskResult.length === 0) {
        throw new Error('Task not found');
      }

      if (taskResult[0].assigned_by_user_id !== userId) {
        throw new Error('You can only delete tasks you assigned');
      }

      await sql`
        DELETE FROM tasks WHERE id = ${taskId}
      `;
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }

  async getTaskById(taskId: string, userId: string): Promise<Task | null> {
    try {
      const result = await sql`
        SELECT 
          t.id, t.title, t.description, t.assigned_to_user_id, t.assigned_by_user_id, 
          t.group_id, t.due_date, t.priority, t.status, t.created_at, t.updated_at,
          u1.name as assigned_to_name,
          u2.name as assigned_by_name,
          g.name as group_name
        FROM tasks t
        JOIN users u1 ON t.assigned_to_user_id = u1.id
        JOIN users u2 ON t.assigned_by_user_id = u2.id
        JOIN groups g ON t.group_id = g.id
        WHERE t.id = ${taskId}
        AND (t.assigned_to_user_id = ${userId} OR t.assigned_by_user_id = ${userId})
      `;

      if (result.length === 0) {
        return null;
      }

      const task = result[0];
      return {
        id: task.id,
        title: task.title,
        description: task.description,
        assignedToUserId: task.assigned_to_user_id,
        assignedToUserName: task.assigned_to_name,
        assignedByUserId: task.assigned_by_user_id,
        assignedByUserName: task.assigned_by_name,
        groupId: task.group_id,
        groupName: task.group_name,
        dueDate: task.due_date,
        priority: task.priority,
        status: task.status,
        createdAt: task.created_at,
        updatedAt: task.updated_at
      };
    } catch (error) {
      console.error('Error fetching task:', error);
      throw error;
    }
  }
}

export const tasksService = new TasksService();
