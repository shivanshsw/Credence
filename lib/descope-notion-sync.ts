import { NotionIntegration } from './notion-integration';
import { NotionSyncConfig, NotionSyncResult } from './types/notion-types';

export class DescopeNotionSync {
  private notionIntegration: NotionIntegration;
  private config: NotionSyncConfig;

  constructor(config: NotionSyncConfig) {
    this.config = config;
    this.notionIntegration = new NotionIntegration(config);
  }

  async syncTaskToNotion(taskData: any): Promise<NotionSyncResult> {
    try {
      const notionResponse = await this.notionIntegration.createTaskInNotion(taskData);
      
      return {
        success: true,
        data: notionResponse,
        notionPageId: notionResponse.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async syncNoteToNotion(noteData: any): Promise<NotionSyncResult> {
    try {
      const notionResponse = await this.notionIntegration.createNoteInNotion(noteData);
      
      return {
        success: true,
        data: notionResponse,
        notionPageId: notionResponse.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updateTaskInNotion(taskId: string, updates: any): Promise<NotionSyncResult> {
    try {
      const notionResponse = await this.notionIntegration.updateTaskInNotion(taskId, updates);
      
      return {
        success: true,
        data: notionResponse,
        notionPageId: notionResponse.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updateNoteInNotion(noteId: string, updates: any): Promise<NotionSyncResult> {
    try {
      const notionResponse = await this.notionIntegration.updateNoteInNotion(noteId, updates);
      
      return {
        success: true,
        data: notionResponse,
        notionPageId: notionResponse.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async deleteFromNotion(pageId: string): Promise<NotionSyncResult> {
    try {
      const notionResponse = await this.notionIntegration.deleteFromNotion(pageId);
      
      return {
        success: true,
        data: notionResponse,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async performFullSync(): Promise<{
    tasks: NotionSyncResult;
    notes: NotionSyncResult;
  }> {
    try {
      const [tasksResult, notesResult] = await Promise.all([
        this.notionIntegration.syncTasksFromNotion(),
        this.notionIntegration.syncNotesFromNotion(),
      ]);

      return {
        tasks: {
          success: true,
          data: tasksResult,
        },
        notes: {
          success: true,
          data: notesResult,
        },
      };
    } catch (error) {
      return {
        tasks: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        notes: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async handleNotionWebhook(payload: any): Promise<NotionSyncResult> {
    try {
      // Process webhook payload from Notion
      const { object, entry } = payload;
      
      if (object === 'page') {
        // Handle page updates from Notion
        for (const change of entry) {
          const pageId = change.id;
          const changes = change.changes;
          
          // Process each change
          for (const changeItem of changes) {
            // Update local database based on Notion changes
            console.log(`Processing change for page ${pageId}:`, changeItem);
          }
        }
      }

      return {
        success: true,
        data: { processed: true },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
