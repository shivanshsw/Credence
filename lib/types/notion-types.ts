export interface NotionSyncConfig {
  notionToken: string;
  tasksDatabaseId: string;
  notesDatabaseId: string;
  workspaceId: string;
}

export interface NotionTask {
  id: string;
  title: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  priority: 'Low' | 'Medium' | 'High';
  dueDate?: string;
  description?: string;
  notionPageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotionNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  notionPageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotionDatabaseSchema {
  tasks: {
    title: string;
    status: string;
    priority: string;
    due_date: string;
    description: string;
  };
  notes: {
    title: string;
    content: string;
    tags: string[];
    created_at: string;
  };
}

export interface NotionSyncResult {
  success: boolean;
  data?: any;
  error?: string;
  notionPageId?: string;
}

export interface NotionWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    changes: Array<{
      value: any;
      field: string;
    }>;
  }>;
}
