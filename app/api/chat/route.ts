// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';
import { geminiService, ChatContext } from '@/lib/gemini';
import { supabaseAdmin, GROUP_FILES_BUCKET } from '@/lib/supabase';
import { rbacService } from '@/lib/rbac';
import { tasksService } from '@/lib/tasks';
// Heavy parsers are dynamically imported only when needed

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  const sessionInfo = await session();
  
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { message, groupId } = await request.json();
    
    if (!message || !groupId) {
      return NextResponse.json({ error: 'Message and groupId are required' }, { status: 400 });
    }

    // Get user ID from database
    const users = await sql`
      SELECT id FROM users WHERE descope_user_id = ${sessionInfo.token.sub}
    `;
    
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userId = users[0].id;

    // Get user permissions
    const userPermissions = await rbacService.getUserPermissions(userId);
    
    // Get group-specific permissions
    const groupPermissions = await rbacService.getUserGroupPermissions(userId, groupId);
    
    // Combine permissions
    const combinedPermissions = {
      ...userPermissions,
      groupPermissions: groupPermissions.groupPermissions,
      customPermissionText: groupPermissions.customPermissionText
    };

    // Get group name
    const groups = await sql`
      SELECT name FROM groups WHERE id = ${groupId}
    `;
    
    if (groups.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Get recent chat messages for context
    let recentMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    try {
      recentMessages = await sql`
        SELECT 
          CASE 
            WHEN cm.user_id = ${userId} THEN 'user'
            ELSE 'assistant'
          END as role,
          cm.content
        FROM chat_messages cm
        WHERE cm.group_id = ${groupId}
        ORDER BY cm.created_at DESC
        LIMIT 10
      ` as Array<{ role: 'user' | 'assistant'; content: string }>;
    } catch (error) {
      console.warn('Chat messages table not found, using empty context:', error);
      recentMessages = [];
    }

    // Fetch tasks snapshot for context (self by default; admin can see all)
    let tasksForContext: any[] = [];
    try {
      const isAdmin = await rbacService.userHasRole(userId, 'admin');
      tasksForContext = isAdmin ? await tasksService.getAllTasks() : await tasksService.getTasksForUser(userId);
    } catch (e) {
      tasksForContext = [];
    }

    // Fetch uploaded files metadata for context (titles)
    let filesForContext: any[] = [];
    try {
      filesForContext = await sql`
        SELECT title as file_name, NULL as mime_type, uploaded_at as created_at
        FROM uploaded_files
        WHERE group_id = ${groupId}
        ORDER BY uploaded_at DESC
        LIMIT 10
      `;
    } catch (e) {
      filesForContext = [];
    }

    // Helpers
    const downloadFile = async (path: string) => {
      console.log('[chat] downloadFile: attempting to download file from path:', path);
      const { data, error } = await supabaseAdmin.storage
        .from(GROUP_FILES_BUCKET)
        .download(path);
      if (error) {
        console.error('[chat] downloadFile: error downloading file:', error);
        return null;
      }
      if (!data) {
        console.error('[chat] downloadFile: no data returned');
        return null;
      }
      console.log('[chat] downloadFile: success, file downloaded');
      return data;
    };

    const chunkText = (text: string, maxBytes = 200 * 1024) => {
      const chunks: string[] = [];
      let start = 0;
      while (start < text.length && chunks.length < 5) {
        const end = Math.min(start + maxBytes, text.length);
        chunks.push(text.slice(start, end));
        start = end;
      }
      return chunks;
    };

    const extractText = async (fileBlob: Blob, fallbackPath: string) => {
      console.log('[chat] extractText: processing file blob, size:', fileBlob.size);
      
      const lowerPath = (fallbackPath || '').toLowerCase();
      const contentType = fileBlob.type || '';

      try {
        // Text files (including JSON)
        if (contentType.startsWith('text/') || contentType.startsWith('application/json') || 
            lowerPath.endsWith('.txt') || lowerPath.endsWith('.json') || lowerPath.endsWith('.md')) {
          console.log('[chat] extractText: processing as text file');
          const text = await fileBlob.text();
          return text;
        }

        // PDF
        if (contentType === 'application/pdf' || lowerPath.endsWith('.pdf')) {
          console.log('[chat] extractText: processing as PDF');
          const arrayBuffer = await fileBlob.arrayBuffer();
          const buf = Buffer.from(arrayBuffer);
          const { default: pdfParse } = await import('pdf-parse');
          const result = await pdfParse(buf as any);
          return result.text || null;
        }

        // DOCX
        if (contentType.includes('officedocument.wordprocessingml.document') || lowerPath.endsWith('.docx')) {
          console.log('[chat] extractText: processing as DOCX');
          const arrayBuffer = await fileBlob.arrayBuffer();
          const buf = Buffer.from(arrayBuffer);
          const mammoth = await import('mammoth');
          const { value } = await mammoth.extractRawText({ buffer: buf });
          return value || null;
        }

        // XLS/XLSX/CSV
        if (
          contentType.includes('spreadsheetml') ||
          contentType === 'application/vnd.ms-excel' ||
          lowerPath.endsWith('.xlsx') ||
          lowerPath.endsWith('.xls') ||
          lowerPath.endsWith('.csv')
        ) {
          console.log('[chat] extractText: processing as spreadsheet');
          const arrayBuffer = await fileBlob.arrayBuffer();
          const buf = Buffer.from(arrayBuffer);
          const XLSX = await import('xlsx');
          const wb = XLSX.read(buf, { type: 'buffer' } as any);
          const texts: string[] = [];
          for (const sheetName of wb.SheetNames.slice(0, 5)) {
            const ws = wb.Sheets[sheetName];
            if (!ws) continue;
            const csv = XLSX.utils.sheet_to_csv(ws as any);
            texts.push(`# Sheet: ${sheetName}\n${csv}`);
          }
          return texts.join('\n\n');
        }

        // Fallback: try to read as text for unknown types
        console.log('[chat] extractText: trying fallback text extraction');
        const text = await fileBlob.text();
        return text;
      } catch (error) {
        console.error('[chat] extractText: error processing file:', error);
        return null;
      }
    };

    // Build base context (no automatic RAG). We'll only inject summaries for explicit filename intents below.
    const context: ChatContext = {
      groupId,
      groupName: groups[0].name,
      userPermissions: combinedPermissions,
      recentMessages: recentMessages.reverse(),
      tasks: tasksForContext.map(t => ({ title: t.title, dueDate: t.dueDate || null, groupName: t.groupName, status: t.status })),
      files: filesForContext,
      ragSnippets: []
    };

    // Handle explicit command: file: <filename> (summarize & inject summary)
    let finalMessage = message;
    let augmentedContext = { ...context } as ChatContext;
    const fileCmdMatch = /^\s*file:\s*(.+)$/i.exec(message);
    if (fileCmdMatch) {
      const requested = fileCmdMatch[1].trim();
      console.log('[chat] file: command detected', { requested });

      // Try with storage_path first, fallback to file_url if column doesn't exist
      let candidates: { title: string; storage_path: string }[];
      try {
        candidates = await sql`
          (
            SELECT title, storage_path FROM uploaded_files 
            WHERE group_id = ${groupId} AND title = ${requested}
          )
          UNION ALL
          (
            SELECT title, storage_path FROM uploaded_files 
            WHERE group_id = ${groupId} AND title ILIKE ${'%' + requested + '%'}
            ORDER BY uploaded_at DESC
            LIMIT 5
          )
        ` as { title: string; storage_path: string }[];
      } catch (error) {
        console.log('[chat] storage_path column not found, using file_url fallback');
        // If storage_path doesn't exist, we need to reconstruct the path from the stored file_url
        // The file_url should contain the storage path, not a signed URL
        const fallbackCandidates = await sql`
          (
            SELECT title, file_url as storage_path FROM uploaded_files 
            WHERE group_id = ${groupId} AND title = ${requested}
          )
          UNION ALL
          (
            SELECT title, file_url as storage_path FROM uploaded_files 
            WHERE group_id = ${groupId} AND title ILIKE ${'%' + requested + '%'}
            ORDER BY uploaded_at DESC
            LIMIT 5
          )
        ` as { title: string; storage_path: string }[];
        candidates = fallbackCandidates;
      }
      console.log('[chat] file: candidates found', { count: candidates.length });

      if (!candidates.length) {
        return NextResponse.json({ response: 'No similar file found.', isCommand: false });
      }

      const chosen = candidates[0];
      console.log('[chat] file: chosen', { title: chosen.title, path: chosen.storage_path });

      const fileBlob = await downloadFile(chosen.storage_path);
      console.log('[chat] file: download result', { success: fileBlob ? 'SUCCESS' : 'FAILED' });
      if (!fileBlob) {
        console.warn('[chat] file: failed to download file');
        return NextResponse.json({ response: 'Failed to access file.', isCommand: false });
      }
      console.log('[chat] file: file downloaded successfully');

      const text = await extractText(fileBlob, chosen.storage_path);
      console.log('[chat] file: extracted text length', { length: text?.length || 0 });

      if (!text || !text.trim()) {
        augmentedContext = { ...augmentedContext, ragSnippets: [{ fileName: `${chosen.title} (summary)`, snippet: 'No readable text could be extracted from this file.' }] };
        finalMessage = message;
      } else {
        const summary = await geminiService.summarizeLongText(text, { title: chosen.title });
        console.log('[chat] file: summary length', { length: summary?.length || 0 });
        augmentedContext = { ...augmentedContext, ragSnippets: [{ fileName: `${chosen.title} (summary)`, snippet: summary }] };
        finalMessage = message;
      }
    }

    // Auto-detect filename intent like: summarize "name", read name.pdf, show test_file, etc. (summarize & inject summary)
    if (finalMessage === message) {
      const quoted = /(?:summarize|read|open|show|analy(?:se|ze)|review)\s+"([^"]{1,200})"/i.exec(message);
      const withExt = /\b([\w\- .]{1,160}\.(?:txt|pdf|docx|xlsx|xls|csv|json|md))\b/i.exec(message);
      const candidateName = (quoted?.[1] || withExt?.[1] || '').trim();
      if (candidateName) {
        console.log('[chat] autodetect: candidate name', { candidateName });
        // Try with storage_path first, fallback to file_url if column doesn't exist
        let candidates: { title: string; storage_path: string }[];
        try {
          candidates = await sql`
            (
              SELECT title, storage_path FROM uploaded_files 
              WHERE group_id = ${groupId} AND title = ${candidateName}
            )
            UNION ALL
            (
              SELECT title, storage_path FROM uploaded_files 
              WHERE group_id = ${groupId} AND title ILIKE ${'%' + candidateName + '%'}
              ORDER BY uploaded_at DESC
              LIMIT 5
            )
          ` as { title: string; storage_path: string }[];
        } catch (error) {
          console.log('[chat] autodetect: storage_path column not found, using file_url fallback');
          const fallbackCandidates = await sql`
            (
              SELECT title, file_url as storage_path FROM uploaded_files 
              WHERE group_id = ${groupId} AND title = ${candidateName}
            )
            UNION ALL
            (
              SELECT title, file_url as storage_path FROM uploaded_files 
              WHERE group_id = ${groupId} AND title ILIKE ${'%' + candidateName + '%'}
              ORDER BY uploaded_at DESC
              LIMIT 5
            )
          ` as { title: string; storage_path: string }[];
          candidates = fallbackCandidates;
        }

        console.log('[chat] autodetect: candidates found', { count: candidates.length });
        if (candidates.length) {
          const chosen = candidates[0];
          console.log('[chat] autodetect: chosen', { title: chosen.title, path: chosen.storage_path });

          const fileBlob = await downloadFile(chosen.storage_path);
          console.log('[chat] autodetect: download result', { success: fileBlob ? 'SUCCESS' : 'FAILED' });
          if (!fileBlob) {
            console.warn('[chat] autodetect: failed to download file');
            return NextResponse.json({ response: 'Failed to access file.', isCommand: false });
          }
          console.log('[chat] autodetect: file downloaded successfully');

          const text = await extractText(fileBlob, chosen.storage_path);
          console.log('[chat] autodetect: extracted text length', { length: text?.length || 0 });

          if (!text || !text.trim()) {
            augmentedContext = { ...augmentedContext, ragSnippets: [{ fileName: `${chosen.title} (summary)`, snippet: 'No readable text could be extracted from this file.' }] };
            finalMessage = message;
          } else {
            const summary = await geminiService.summarizeLongText(text, { title: chosen.title });
            console.log('[chat] autodetect: summary length', { length: summary?.length || 0 });
            augmentedContext = { ...augmentedContext, ragSnippets: [{ fileName: `${chosen.title} (summary)`, snippet: summary }] };
            finalMessage = message;
          }
        }
      }
    }

    // Generate AI response
    const aiResponse = await geminiService.generateChatResponse(finalMessage, augmentedContext);

    // Save user message to database
    try {
      await sql`
        INSERT INTO chat_messages (group_id, user_id, content, message_type)
        VALUES (${groupId}, ${userId}, ${message}, 'text')
      `;
    } catch (error) {
      console.warn('Failed to save user message:', error);
    }

    // Save AI response to database
    try {
      await sql`
        INSERT INTO chat_messages (group_id, user_id, content, message_type, metadata)
        VALUES (${groupId}, ${userId}, ${aiResponse.response}, 'text', ${JSON.stringify({
          isCommand: aiResponse.isCommand,
          requiresPermission: aiResponse.requiresPermission
        })})
      `;
    } catch (error) {
      console.warn('Failed to save AI response:', error);
    }

    // Handle task assignment if it's a command
    if (aiResponse.isCommand && aiResponse.taskAssignment) {
      try {
        // Permission check: admins bypass; otherwise need task_assignment:create
        let canAssign = false;
        try {
          const isAdmin = await rbacService.userHasRole(userId, 'admin');
          canAssign = isAdmin || await rbacService.hasPermission(userId, 'task_assignment:create');
        } catch (_) { canAssign = false; }
        if (!canAssign) {
          return NextResponse.json({ error: 'You do not have permission to assign tasks.' }, { status: 403 });
        }

        const assignedUserIds: string[] = [];

        // Assign to all group members
        if (aiResponse.taskAssignment.assignToAllMembers) {
          const members = await sql`
            SELECT user_id FROM group_members WHERE group_id = ${aiResponse.taskAssignment.groupId}
          ` as { user_id: string }[];
          assignedUserIds.push(...members.map(m => m.user_id));
        }

        // Assign to role within group (e.g., manager)
        if (aiResponse.taskAssignment.assignToRole) {
          const roleMembers = await sql`
            SELECT user_id FROM group_members WHERE group_id = ${aiResponse.taskAssignment.groupId} AND role = ${aiResponse.taskAssignment.assignToRole}
          ` as { user_id: string }[];
          assignedUserIds.push(...roleMembers.map(m => m.user_id));
        }

        // Resolve assignedTo items by username or email
        for (const ident of aiResponse.taskAssignment.assignedTo) {
          const userResult = await sql`
            SELECT id FROM users WHERE email = ${ident} OR username = ${ident}
          ` as { id: string }[];
          if (userResult.length > 0) {
            assignedUserIds.push(userResult[0].id);
          }
        }

        // De-duplicate
        const uniqueUserIds = Array.from(new Set(assignedUserIds.filter(Boolean)));

        // Create tasks for each assigned user
        for (const assignedUserId of uniqueUserIds) {
          await tasksService.createTask({
            title: aiResponse.taskAssignment.title,
            description: aiResponse.taskAssignment.description,
            assignedToUserId: assignedUserId,
            assignedByUserId: userId,
            groupId: aiResponse.taskAssignment.groupId,
            dueDate: aiResponse.taskAssignment.dueDate,
            priority: aiResponse.taskAssignment.priority
          });
        }

        // Update the AI response to reflect successful task creation
        aiResponse.response = `✅ Task "${aiResponse.taskAssignment.title}" has been assigned to ${uniqueUserIds.length} user(s).`;
      } catch (error) {
        console.error('Error creating tasks:', error);
        aiResponse.response = `❌ Error creating tasks: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }

    return NextResponse.json({
      response: aiResponse.response,
      isCommand: aiResponse.isCommand,
      requiresPermission: aiResponse.requiresPermission
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
