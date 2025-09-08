import { NextRequest, NextResponse } from 'next/server';
import { DescopeOutboundManager, descopeConfig } from '@/lib/descope-outbound-config';

const descopeManager = new DescopeOutboundManager(descopeConfig);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data, action } = body;

    let result;

    switch (action) {
      case 'trigger_sync':
        result = await descopeManager.triggerNotionSync(type, data);
        break;
      case 'setup_webhook':
        result = await descopeManager.setupNotionWebhook();
        break;
      case 'get_status':
        result = await descopeManager.getOutboundFlowStatus();
        break;
      case 'update_settings':
        result = await descopeManager.updateNotionSyncSettings(data);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Descope Notion sync error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const status = await descopeManager.getOutboundFlowStatus();
    
    return NextResponse.json({
      success: true,
      data: {
        status,
        config: {
          notionIntegration: descopeConfig.notionIntegration,
          webhooks: descopeConfig.webhooks,
        },
      },
    });
  } catch (error) {
    console.error('Error getting Descope status:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
