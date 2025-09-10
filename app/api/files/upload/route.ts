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

    
    if (!title || !groupId) {
      return NextResponse.json({ error: 'title and group_id are required' }, { status: 400 });
    }
    if (!(file instanceof Blob) && (!description || !description.trim())) {
      return NextResponse.json({ error: 'Provide a file or non-empty description for inline content' }, { status: 400 });
    }

    
    const users = await sql`
      SELECT id FROM users WHERE descope_user_id = ${sessionInfo.token.sub}
    `;
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const uploaderId = users[0].id as string;

    
    const membership = await sql`
      SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${uploaderId}
    `;
    if (membership.length === 0) {
      return NextResponse.json({ error: 'Forbidden: not a member of this group' }, { status: 403 });
    }

    
    if (file instanceof Blob) {
      const originalName = (file as any).name || 'upload';
      const contentType = (file as Blob).type || 'application/octet-stream';
      const destinationPath = `group-${groupId}/${Date.now()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;


      let { error: upErr } = await supabaseAdmin.storage.from(GROUP_FILES_BUCKET).upload(destinationPath, file as Blob, {
        contentType,
        upsert: false,
      });
      if (upErr) {
        try {
        
          await supabaseAdmin.storage.createBucket(GROUP_FILES_BUCKET, { public: false }).catch(() => {});
          const retry = await supabaseAdmin.storage.from(GROUP_FILES_BUCKET).upload(destinationPath, file as Blob, {
            contentType,
            upsert: false,
          });
          upErr = retry.error;
        } catch {}
      }
      if (upErr) {
        return NextResponse.json({ error: `Upload failed: ${upErr.message || 'unknown error'}`, detail: upErr.message }, { status: 500 });
      }

      let inserted;
      try {
        inserted = await sql`
          INSERT INTO uploaded_files (group_id, uploader_id, title, description, file_url, storage_path, mime_type, is_inline_content, content_text)
          VALUES (${groupId}, ${uploaderId}, ${title}, ${description}, ${destinationPath}, ${destinationPath}, ${contentType}, false, NULL)
          RETURNING file_id, file_url
        `;
      } catch (error) {
        console.log('[upload] storage_path or mime_type column not found, using file_url only');
        inserted = await sql`
          INSERT INTO uploaded_files (group_id, uploader_id, title, description, file_url, is_inline_content)
          VALUES (${groupId}, ${uploaderId}, ${title}, ${description}, ${destinationPath}, false)
          RETURNING file_id, file_url
        `;
      }

      let publicUrl = '';
      try {
        const { data: signed } = await supabaseAdmin.storage.from(GROUP_FILES_BUCKET).createSignedUrl(destinationPath, 60 * 60);
        publicUrl = signed?.signedUrl || '';
      } catch {}

      // audit
      try {
        await sql`
          INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, metadata)
          VALUES (${uploaderId}, 'file.upload', 'group', ${groupId}, ${JSON.stringify({ title, fileUrl: publicUrl })})
        `;
      } catch {}

      return NextResponse.json({
        file_id: inserted[0].file_id,
        file_url: publicUrl, 
      });
    } else {
   
      let insertedInline;
      try {
        insertedInline = await sql`
          INSERT INTO uploaded_files (group_id, uploader_id, title, description, is_inline_content, content_text, mime_type)
          VALUES (${groupId}, ${uploaderId}, ${title}, ${description}, true, ${description}, 'text/plain')
          RETURNING file_id
        `;
      } catch (e1) {
        try {
          insertedInline = await sql`
            INSERT INTO uploaded_files (group_id, uploader_id, title, description, is_inline_content, content_text)
            VALUES (${groupId}, ${uploaderId}, ${title}, ${description}, true, ${description})
            RETURNING file_id
          `;
        } catch (e2) {
          console.error('[upload:inline] failed to insert inline content', e1, e2);
          return NextResponse.json({ error: 'Failed to save inline content' }, { status: 500 });
        }
      }

      // audit
      try {
        await sql`
          INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, metadata)
          VALUES (${uploaderId}, 'file.inline_create', 'group', ${groupId}, ${JSON.stringify({ title, inline: true })})
        `;
      } catch {}

      return NextResponse.json({
        file_id: insertedInline[0].file_id,
        file_url: '',
      });
    }
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}





