// lib/notes.ts
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export interface Note {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  sharedWith?: Array<{
    userId: string;
    userName: string;
    sharedAt: string;
  }>;
}

export interface CreateNoteData {
  title: string;
  content: string;
  isPrivate: boolean;
  authorId: string;
}

export interface ShareNoteData {
  noteId: string;
  sharedWithUserId: string;
  sharedByUserId: string;
}

export class NotesService {
  async createNote(data: CreateNoteData): Promise<Note> {
    try {
      const result = await sql`
        INSERT INTO notes (title, content, author_id, is_private)
        VALUES (${data.title}, ${data.content}, ${data.authorId}, ${data.isPrivate})
        RETURNING id, title, content, author_id, is_private, created_at, updated_at
      `;

      const note = result[0];
      
      // Get author name
      const authorResult = await sql`
        SELECT name FROM users WHERE id = ${data.authorId}
      `;

      return {
        id: note.id,
        title: note.title,
        content: note.content,
        authorId: note.author_id,
        authorName: authorResult[0]?.name || 'Unknown',
        isPrivate: note.is_private,
        createdAt: note.created_at,
        updatedAt: note.updated_at
      };
    } catch (error) {
      console.error('Error creating note:', error);
      throw error;
    }
  }

  async getNotesForUser(userId: string): Promise<Note[]> {
    try {
      const result = await sql`
        SELECT 
          n.id, n.title, n.content, n.author_id, n.is_private, n.created_at, n.updated_at,
          u.name as author_name
        FROM notes n
        JOIN users u ON n.author_id = u.id
        WHERE n.author_id = ${userId}
        ORDER BY n.updated_at DESC
      `;

      return result.map(note => ({
        id: note.id,
        title: note.title,
        content: note.content,
        authorId: note.author_id,
        authorName: note.author_name,
        isPrivate: note.is_private,
        createdAt: note.created_at,
        updatedAt: note.updated_at
      }));
    } catch (error) {
      console.error('Error fetching user notes:', error);
      throw error;
    }
  }

  async getSharedNotesForUser(userId: string): Promise<Note[]> {
    try {
      const result = await sql`
        SELECT 
          n.id, n.title, n.content, n.author_id, n.is_private, n.created_at, n.updated_at,
          u.name as author_name,
          ns.created_at as shared_at
        FROM notes n
        JOIN note_shares ns ON n.id = ns.note_id
        JOIN users u ON n.author_id = u.id
        WHERE ns.shared_with_user_id = ${userId}
        ORDER BY ns.created_at DESC
      `;

      return result.map(note => ({
        id: note.id,
        title: note.title,
        content: note.content,
        authorId: note.author_id,
        authorName: note.author_name,
        isPrivate: note.is_private,
        createdAt: note.created_at,
        updatedAt: note.updated_at
      }));
    } catch (error) {
      console.error('Error fetching shared notes:', error);
      throw error;
    }
  }

  async shareNote(data: ShareNoteData): Promise<void> {
    try {
      // Check if note exists and user has permission to share it
      const noteResult = await sql`
        SELECT author_id FROM notes WHERE id = ${data.noteId}
      `;

      if (noteResult.length === 0) {
        throw new Error('Note not found');
      }

      if (noteResult[0].author_id !== data.sharedByUserId) {
        throw new Error('You can only share notes you created');
      }

      // Check if user exists
      const userResult = await sql`
        SELECT id FROM users WHERE id = ${data.sharedWithUserId}
      `;

      if (userResult.length === 0) {
        throw new Error('User not found');
      }

      // Share the note
      await sql`
        INSERT INTO note_shares (note_id, shared_with_user_id, shared_by_user_id)
        VALUES (${data.noteId}, ${data.sharedWithUserId}, ${data.sharedByUserId})
        ON CONFLICT (note_id, shared_with_user_id) DO NOTHING
      `;
    } catch (error) {
      console.error('Error sharing note:', error);
      throw error;
    }
  }

  async updateNote(noteId: string, userId: string, updates: { title?: string; content?: string; isPrivate?: boolean }): Promise<Note> {
    try {
      // Check if user owns the note
      const noteResult = await sql`
        SELECT author_id FROM notes WHERE id = ${noteId}
      `;

      if (noteResult.length === 0) {
        throw new Error('Note not found');
      }

      if (noteResult[0].author_id !== userId) {
        throw new Error('You can only update notes you created');
      }

      // Update the note
      const updateFields = [];
      const values = [];

      if (updates.title !== undefined) {
        updateFields.push('title = $' + (values.length + 1));
        values.push(updates.title);
      }
      if (updates.content !== undefined) {
        updateFields.push('content = $' + (values.length + 1));
        values.push(updates.content);
      }
      if (updates.isPrivate !== undefined) {
        updateFields.push('is_private = $' + (values.length + 1));
        values.push(updates.isPrivate);
      }

      updateFields.push('updated_at = NOW()');
      values.push(noteId);

      const query = `
        UPDATE notes 
        SET ${updateFields.join(', ')}
        WHERE id = $${values.length}
        RETURNING id, title, content, author_id, is_private, created_at, updated_at
      `;

      const result = await sql.unsafe(query, values);
      const note = result[0];

      // Get author name
      const authorResult = await sql`
        SELECT name FROM users WHERE id = ${note.author_id}
      `;

      return {
        id: note.id,
        title: note.title,
        content: note.content,
        authorId: note.author_id,
        authorName: authorResult[0]?.name || 'Unknown',
        isPrivate: note.is_private,
        createdAt: note.created_at,
        updatedAt: note.updated_at
      };
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  }

  async deleteNote(noteId: string, userId: string): Promise<void> {
    try {
      // Check if user owns the note
      const noteResult = await sql`
        SELECT author_id FROM notes WHERE id = ${noteId}
      `;

      if (noteResult.length === 0) {
        throw new Error('Note not found');
      }

      if (noteResult[0].author_id !== userId) {
        throw new Error('You can only delete notes you created');
      }

      // Delete the note (cascade will handle note_shares)
      await sql`
        DELETE FROM notes WHERE id = ${noteId}
      `;
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  }

  async getNoteById(noteId: string, userId: string): Promise<Note | null> {
    try {
      const result = await sql`
        SELECT 
          n.id, n.title, n.content, n.author_id, n.is_private, n.created_at, n.updated_at,
          u.name as author_name
        FROM notes n
        JOIN users u ON n.author_id = u.id
        WHERE n.id = ${noteId}
        AND (n.author_id = ${userId} OR EXISTS (
          SELECT 1 FROM note_shares ns 
          WHERE ns.note_id = n.id AND ns.shared_with_user_id = ${userId}
        ))
      `;

      if (result.length === 0) {
        return null;
      }

      const note = result[0];
      return {
        id: note.id,
        title: note.title,
        content: note.content,
        authorId: note.author_id,
        authorName: note.author_name,
        isPrivate: note.is_private,
        createdAt: note.created_at,
        updatedAt: note.updated_at
      };
    } catch (error) {
      console.error('Error fetching note:', error);
      throw error;
    }
  }
}

export const notesService = new NotesService();
