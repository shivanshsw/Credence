import { Client } from '@notionhq/client';
import { NotionSyncConfig } from './types/notion-types';

export class NotionIntegration {
  private notion: Client;
  private config: NotionSyncConfig;

  constructor(config: NotionSyncConfig) {
    this.config = config;
    this.notion = new Client({
      auth: config.notionToken,
    });
  }

  async createTaskInNotion(task: any) {
    try {
      const response = await this.notion.pages.create({
        parent: {
          database_id: this.config.tasksDatabaseId,
        },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: task.title,
                },
              },
            ],
          },
          status: {
            select: {
              name: task.status || 'Not Started',
            },
          },
          priority: {
            select: {
              name: task.priority || 'Medium',
            },
          },
          due_date: {
            date: task.dueDate ? { start: task.dueDate } : null,
          },
          description: {
            rich_text: [
              {
                text: {
                  content: task.description || '',
                },
              },
            ],
          },
        },
      });
      return response;
    } catch (error) {
      console.error('Error creating task in Notion:', error);
      throw error;
    }
  }

  async createNoteInNotion(note: any) {
    try {
      const response = await this.notion.pages.create({
        parent: {
          database_id: this.config.notesDatabaseId,
        },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: note.title,
                },
              },
            ],
          },
          content: {
            rich_text: [
              {
                text: {
                  content: note.content || '',
                },
              },
            ],
          },
          tags: {
            multi_select: note.tags?.map((tag: string) => ({ name: tag })) || [],
          },
          created_at: {
            date: { start: new Date().toISOString() },
          },
        },
      });
      return response;
    } catch (error) {
      console.error('Error creating note in Notion:', error);
      throw error;
    }
  }

  async updateTaskInNotion(taskId: string, updates: any) {
    try {
      const response = await this.notion.pages.update({
        page_id: taskId,
        properties: updates,
      });
      return response;
    } catch (error) {
      console.error('Error updating task in Notion:', error);
      throw error;
    }
  }

  async updateNoteInNotion(noteId: string, updates: any) {
    try {
      const response = await this.notion.pages.update({
        page_id: noteId,
        properties: updates,
      });
      return response;
    } catch (error) {
      console.error('Error updating note in Notion:', error);
      throw error;
    }
  }

  async deleteFromNotion(pageId: string) {
    try {
      const response = await this.notion.pages.update({
        page_id: pageId,
        archived: true,
      });
      return response;
    } catch (error) {
      console.error('Error deleting from Notion:', error);
      throw error;
    }
  }

  async syncTasksFromNotion() {
    try {
      const response = await this.notion.databases.query({
        database_id: this.config.tasksDatabaseId,
      });
      return response.results;
    } catch (error) {
      console.error('Error syncing tasks from Notion:', error);
      throw error;
    }
  }

  async syncNotesFromNotion() {
    try {
      const response = await this.notion.databases.query({
        database_id: this.config.notesDatabaseId,
      });
      return response.results;
    } catch (error) {
      console.error('Error syncing notes from Notion:', error);
      throw error;
    }
  }
}
