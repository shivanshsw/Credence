import { NextRequest, NextResponse } from 'next/server';
import { NotionSyncService } from '@/lib/notion-sync-service';

const notionSyncService = new NotionSyncService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    let result;

    switch (action) {
      case 'setup_integration':
        result = await notionSyncService.setupNotionIntegration();
        break;
      case 'full_sync':
        result = await notionSyncService.performFullSync();
        break;
      case 'get_status':
        result = await notionSyncService.getSyncStatus();
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
    console.error('Notion setup error:', error);
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
    const status = await notionSyncService.getSyncStatus();
    
    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error getting Notion setup status:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
