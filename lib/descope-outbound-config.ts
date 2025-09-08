export interface DescopeOutboundConfig {
  projectId: string;
  flowId: string;
  baseUrl: string;
  apiKey: string;
  notionIntegration: {
    enabled: boolean;
    webhookUrl: string;
    syncInterval: number;
    autoSync: boolean;
  };
  webhooks: {
    notion: {
      url: string;
      events: string[];
      secret: string;
    };
  };
}

export const descopeConfig: DescopeOutboundConfig = {
  projectId: process.env.DESCOPE_PROJECT_ID || '',
  flowId: process.env.DESCOPE_FLOW_ID || '',
  baseUrl: process.env.DESCOPE_BASE_URL || 'https://api.descope.com',
  apiKey: process.env.DESCOPE_API_KEY || '',
  notionIntegration: {
    enabled: process.env.NOTION_INTEGRATION_ENABLED === 'true',
    webhookUrl: process.env.NOTION_WEBHOOK_URL || '',
    syncInterval: parseInt(process.env.NOTION_SYNC_INTERVAL || '300000'), // 5 minutes
    autoSync: process.env.NOTION_AUTO_SYNC === 'true',
  },
  webhooks: {
    notion: {
      url: process.env.NOTION_WEBHOOK_URL || '',
      events: ['page.created', 'page.updated', 'page.deleted'],
      secret: process.env.NOTION_WEBHOOK_SECRET || '',
    },
  },
};

export class DescopeOutboundManager {
  private config: DescopeOutboundConfig;

  constructor(config: DescopeOutboundConfig) {
    this.config = config;
  }

  async triggerNotionSync(type: 'task' | 'note', data: any) {
    try {
      const response = await fetch(`${this.config.baseUrl}/v1/flows/${this.config.flowId}/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flowId: this.config.flowId,
          input: {
            type,
            data,
            notionConfig: {
              enabled: this.config.notionIntegration.enabled,
              webhookUrl: this.config.notionIntegration.webhookUrl,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Descope API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error triggering Descope outbound flow:', error);
      throw error;
    }
  }

  async setupNotionWebhook() {
    try {
      const response = await fetch(`${this.config.baseUrl}/v1/webhooks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: this.config.webhooks.notion.url,
          events: this.config.webhooks.notion.events,
          secret: this.config.webhooks.notion.secret,
          active: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to setup webhook: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error setting up Notion webhook:', error);
      throw error;
    }
  }

  async getOutboundFlowStatus() {
    try {
      const response = await fetch(`${this.config.baseUrl}/v1/flows/${this.config.flowId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get flow status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting flow status:', error);
      throw error;
    }
  }

  async updateNotionSyncSettings(settings: Partial<DescopeOutboundConfig['notionIntegration']>) {
    try {
      const updatedConfig = {
        ...this.config,
        notionIntegration: {
          ...this.config.notionIntegration,
          ...settings,
        },
      };

      const response = await fetch(`${this.config.baseUrl}/v1/flows/${this.config.flowId}/config`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notionIntegration: updatedConfig.notionIntegration,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update sync settings: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating Notion sync settings:', error);
      throw error;
    }
  }
}
