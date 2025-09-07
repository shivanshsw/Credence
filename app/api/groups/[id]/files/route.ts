import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// GET: List files for a group (basic pagination)
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const sessionInfo = await session();

  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const groupId = id;
    const descopeUserId = sessionInfo.token.sub;

    // Ensure requester is a member of the group
    const users = await sql`
      SELECT id FROM users WHERE descope_user_id = ${descopeUserId}
    ` as { id: string }[];
    if (!users?.length) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const userId = users[0].id;

    const membership = await sql`
      SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}
    ` as { '?column?': number }[];
    if (!membership?.length) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const files = await sql`
      SELECT id, file_name, mime_type, size_bytes, storage_url, created_at
      FROM group_files
      WHERE group_id = ${groupId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    ` as { id: string; file_name: string; mime_type: string | null; size_bytes: number | null; storage_url: string; created_at: string }[];

    return NextResponse.json({ success: true, data: files });
  } catch (error) {
    console.error('GET group files error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Upload a file (multipart/form-data). Stores metadata + a temporary storage URL.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const sessionInfo = await session();

  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const groupId = id;
    const descopeUserId = sessionInfo.token.sub;

    const users = await sql`
      SELECT id FROM users WHERE descope_user_id = ${descopeUserId}
    ` as { id: string }[];
    if (!users?.length) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const userId = users[0].id;

    const membership = await sql`
      SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}
    ` as { '?column?': number }[];
    if (!membership?.length) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as unknown as File | null;
    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 });

    // For now, we do not persist binary; we create a temporary blob URL using arrayBuffer
    // In production, upload to S3/GCS and save the remote URL here.
    const arrayBuffer = await file.arrayBuffer();
    const sizeBytes = arrayBuffer.byteLength;
    const fileName = (formData.get('file_name') as string) || (file as any).name || 'upload';
    const mimeType = (file as any).type || 'application/octet-stream';

    // Temporary storage URL placeholder (not persistent). Replace with S3 later.
    const storageUrl = `blob:temporary:${crypto.randomUUID()}`;

    const inserted = await sql`
      INSERT INTO group_files (group_id, uploader_user_id, file_name, mime_type, size_bytes, storage_url)
      VALUES (${groupId}, ${userId}, ${fileName}, ${mimeType}, ${sizeBytes}, ${storageUrl})
      RETURNING id, file_name, mime_type, size_bytes, storage_url, created_at
    ` as { id: string; file_name: string; mime_type: string | null; size_bytes: number | null; storage_url: string; created_at: string }[];

    return NextResponse.json({ success: true, data: inserted[0] }, { status: 201 });
  } catch (error) {
    console.error('POST group files error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


