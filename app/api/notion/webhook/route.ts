import { NextRequest, NextResponse } from 'next/server';
import { DescopeNotionSync } from '@/lib/descope-notion-sync';
import { NotionSyncConfig } from '@/lib/types/notion-types';
import crypto from 'crypto';

const notionConfig: NotionSyncConfig = {
  notionToken: process.env.NOTION_TOKEN || '',
  tasksDatabaseId: process.env.NOTION_TASKS_DATABASE_ID || '',
  notesDatabaseId: process.env.NOTION_NOTES_DATABASE_ID || '',
  workspaceId: process.env.NOTION_WORKSPACE_ID || '',
};

const notionSync = new DescopeNotionSync(notionConfig);

function verifyNotionSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-notion-signature') || '';
    const secret = process.env.NOTION_WEBHOOK_SECRET || '';

    // Verify webhook signature
    if (!verifyNotionSignature(body, signature, secret)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const payload = JSON.parse(body);
    
    // Process the webhook payload
    const result = await notionSync.handleNotionWebhook(payload);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Webhook processed successfully',
      });
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Notion webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Notion webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
