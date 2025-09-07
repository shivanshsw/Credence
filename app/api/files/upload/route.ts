import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';
import { supabaseAdmin, GROUP_FILES_BUCKET } from '@/lib/supabase';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  const sessionInfo = await session();
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    const title = (form.get('title') as string) || '';
    const description = (form.get('description') as string) || '';
    const groupId = (form.get('group_id') as string) || '';

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!title || !groupId) {
      return NextResponse.json({ error: 'title and group_id are required' }, { status: 400 });
    }

    // Resolve uploader user id from descope id
    const users = await sql`
      SELECT id FROM users WHERE descope_user_id = ${sessionInfo.token.sub}
    `;
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const uploaderId = users[0].id as string;

    // Verify membership in group
    const membership = await sql`
      SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${uploaderId}
    `;
    if (membership.length === 0) {
      return NextResponse.json({ error: 'Forbidden: not a member of this group' }, { status: 403 });
    }

    const buffer = Buffer.from(await (file as Blob).arrayBuffer());
    const originalName = (file as any).name || 'upload';
    const contentType = (file as Blob).type || 'application/octet-stream';
    const destinationPath = `group-${groupId}/${Date.now()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const { error: upErr } = await supabaseAdmin.storage.from(GROUP_FILES_BUCKET).upload(destinationPath, buffer, {
      contentType,
      upsert: false,
    });
    if (upErr) {
      return NextResponse.json({ error: 'Upload failed', detail: upErr.message }, { status: 500 });
    }

    // Store the storage path in both columns for consistency
    // We can generate signed URLs on-demand when needed for frontend display
    let inserted;
    try {
      inserted = await sql`
        INSERT INTO uploaded_files (group_id, uploader_id, title, description, file_url, storage_path)
        VALUES (${groupId}, ${uploaderId}, ${title}, ${description}, ${destinationPath}, ${destinationPath})
        RETURNING file_id, file_url
      `;
    } catch (error) {
      console.log('[upload] storage_path column not found, using file_url only');
      inserted = await sql`
        INSERT INTO uploaded_files (group_id, uploader_id, title, description, file_url)
        VALUES (${groupId}, ${uploaderId}, ${title}, ${description}, ${destinationPath})
        RETURNING file_id, file_url
      `;
    }

    // Generate signed URL for the response (frontend display)
    const { data: signed } = await supabaseAdmin.storage.from(GROUP_FILES_BUCKET).createSignedUrl(destinationPath, 60 * 60);
    const publicUrl = signed?.signedUrl || '';

    // audit
    try {
      await sql`
        INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, metadata)
        VALUES (${uploaderId}, 'file.upload', 'group', ${groupId}, ${JSON.stringify({ title, fileUrl: publicUrl })})
      `;
    } catch {}

    return NextResponse.json({
      file_id: inserted[0].file_id,
      file_url: publicUrl, // Return signed URL for frontend
    });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const extractStoragePathFromUrl = (url: string): string => {
  // If it's already a storage path (doesn't start with http), return as-is
  if (!url.startsWith('http')) {
    return url;
  }
  
  // Extract storage path from signed URL
  // Format: https://xyz.supabase.co/storage/v1/object/sign/bucket-name/path?token=...
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const signIndex = pathParts.indexOf('sign');
    if (signIndex !== -1 && pathParts.length > signIndex + 2) {
      // Skip 'sign' and bucket name, get the rest
      return pathParts.slice(signIndex + 2).join('/');
    }
  } catch (e) {
    console.warn('[chat] Failed to extract storage path from URL:', url);
  }
  
  // Fallback: return the original URL and hope it works
  return url;
};


