// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';
import { geminiService, ChatContext } from '@/lib/gemini';
import { supabaseAdmin, GROUP_FILES_BUCKET } from '@/lib/supabase';
import { rbacService } from '@/lib/rbac';
import { tasksService } from '@/lib/tasks';


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
    
    // Get group-specific permissions which are particularlly like individual for a group
    const groupPermissions = await rbacService.getUserGroupPermissions(userId, groupId);
    
    let effectiveRole = userPermissions.role;
    try {
      const membership = await sql`
        SELECT role FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId} LIMIT 1
      ` as { role: string }[];
      if (membership && membership.length > 0 && membership[0].role) {
        effectiveRole = membership[0].role;
      }
    } catch {}

    // Combine the permissions
    const combinedPermissions = {
      ...userPermissions,
      role: effectiveRole,
      groupPermissions: groupPermissions.groupPermissions,
      customPermissionText: groupPermissions.customPermissionText
    };


    const canAccessFiles = (() => {
      const role = effectiveRole?.toLowerCase?.() || '';
      const basePerms = combinedPermissions.permissions || [];
      const grpPerms = combinedPermissions.groupPermissions || [];
      const hasRead = basePerms.includes('files:read') || grpPerms.includes('files:read');
      // Admin override: admins can always access
      if (role === 'admin') return true;
      // Managers require files:read
      if (role === 'manager') return hasRead;
      return false;
    })();


    const groups = await sql`
      SELECT name FROM groups WHERE id = ${groupId}
    `;
    
    if (groups.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    
    const taskAssignmentPatterns = [
      
      /assign:\s*([^:]+?)\s+to\s+all\s+role:\s*([^\s]+?)(?:\s+for\s+date\s*<([^>]+)>)?/i,
      /assign:\s*([^:]+?)\s+to\s+role:\s*([^\s]+?)(?:\s+for\s+date\s*<([^>]+)>)?/i,
      /assign\s+([^:]+?)\s+to\s+all\s+role\s+([^\s]+?)(?:\s+for\s+date\s*<([^>]+)>)?/i,
      /assign\s+([^:]+?)\s+to\s+role\s+([^\s]+?)(?:\s+for\s+date\s*<([^>]+)>)?/i,
      
      /assign:\s*([^:]+?)\s+to\s+role:\s*([^\s]+?)(?:\s+for\s+date\s+([^\s]+))?/i,
      /assign\s+task:\s*([^:]+?)\s+to\s+all\s+role:\s*([^\s]+?)(?:\s+for\s+date\s+([^\s]+))?/i,
      /assign:\s*([^:]+?)\s+to\s+role:\s*([^\s]+?)(?:\s+for\s+([^\s]+))?/i,
      /task:\s*([^:]+?)\s+to\s+role:\s*([^\s]+?)(?:\s+for\s+date\s+([^\s]+))?/i,
      /assign\s+([^:]+?)\s+to\s+role\s+([^\s]+?)(?:\s+for\s+date\s+([^\s]+))?/i,
      /assign\s+([^:]+?)\s+to\s+all\s+role\s+([^\s]+?)(?:\s+for\s+date\s+([^\s]+))?/i,
      
      /assign\s+([^:]+?)\s+to\s+([^\s]+?)(?:\s+for\s+date\s+([^\s]+))?/i,
      /assign:\s*([^:]+?)\s+to\s+([^\s]+?)(?:\s+for\s+([^\s]+))?/i,
    ];

    
    const normalizeRole = (roleName) => {
      const role = roleName.toLowerCase().trim();
      const roleMap = {
        'member': 'member', 'members': 'member', 'member': 'member',
        'manager': 'manager', 'managers': 'manager', 'manager': 'manager',
        'admin': 'admin', 'admins': 'admin', 'admin': 'admin',
        'employee': 'employee', 'employees': 'employee', 'employee': 'employee',
        'tech-lead': 'tech-lead', 'techlead': 'tech-lead', 'tech_lead': 'tech-lead',
        'finance-manager': 'finance-manager', 'financemanager': 'finance-manager', 'finance_manager': 'finance-manager',
      };
      
      
      if (roleMap[role]) return roleMap[role];
      
      
      for (const [key, value] of Object.entries(roleMap)) {
        if (role.includes(key) || key.includes(role)) {
          return value;
        }
      }
      
      return role; 
    };

   
    const parseDate = (dateStr) => {
      if (!dateStr) {
        console.log('parseDate: No date string provided');
        return null;
      }
      
      try {
        
        let cleanDate = dateStr.replace(/[<>]/g, '').trim();
        console.log('parseDate: Cleaned date string:', cleanDate);
        
        
        if (cleanDate.includes('-') && cleanDate.split('-')[0].length <= 2) {
          const parts = cleanDate.split('-');
          console.log('parseDate: DD-MM-YYYY parts:', parts);
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            const isoDate = `${year}-${month}-${day}`;
            console.log('parseDate: ISO date:', isoDate);
            const date = new Date(isoDate);
            if (!isNaN(date.getTime())) {
              const result = date.toISOString();
              console.log('parseDate: Success - DD-MM-YYYY:', result);
              return result;
            }
          }
        }
        
        
        const date = new Date(cleanDate);
        if (!isNaN(date.getTime())) {
          const result = date.toISOString();
          console.log('parseDate: Success - YYYY-MM-DD:', result);
          return result;
        }
        
        
        const formats = [
          cleanDate, // Original
          cleanDate.replace(/\//g, '-'), 
          cleanDate.replace(/\./g, '-'), 
        ];
        
        for (const format of formats) {
          const testDate = new Date(format);
          if (!isNaN(testDate.getTime())) {
            const result = testDate.toISOString();
            console.log('parseDate: Success - Alternative format:', result);
            return result;
          }
        }
        
        console.log('parseDate: Failed to parse date:', cleanDate);
      } catch (error) {
        console.log('parseDate: Error parsing date:', error);
      }
      
      return null;
    };

    let detectedTaskAssignment = null;
    for (let i = 0; i < taskAssignmentPatterns.length; i++) {
      const pattern = taskAssignmentPatterns[i];
      const match = message.match(pattern);
      if (match) {
        console.log(`Pattern ${i + 1} matched:`, {
          pattern: pattern.toString(),
          match: match,
          message: message
        });
        
        const taskName = match[1].trim();
        const roleName = match[2].trim();
        const dateStr = match[3]?.trim();

        
        const normalizedRole = normalizeRole(roleName);

      
        let dueDate = parseDate(dateStr);
        
        
        if (!dueDate) {
          console.log('parseDate: No date found in group, searching entire message...');
          const datePatterns = [
            /<(\d{4}-\d{2}-\d{2})>/g, 
            /(\d{4}-\d{2}-\d{2})/g,   
            /<(\d{2}-\d{2}-\d{4})>/g, 
            /(\d{2}-\d{2}-\d{4})/g,   
            /<(\d{4}\/\d{2}\/\d{2})>/g
            /(\d{4}\/\d{2}\/\d{2})/g, 
          ];
          
          for (const pattern of datePatterns) {
            const matches = message.match(pattern);
            if (matches && matches.length > 0) {
              const foundDate = parseDate(matches[0]);
              if (foundDate) {
                dueDate = foundDate;
                console.log('parseDate: Found date in message:', matches[0], '->', dueDate);
                break;
              }
            }
          }
        }
        
        
        if (!dueDate) {
          dueDate = new Date().toISOString();
          console.log('parseDate: Using current date as fallback:', dueDate);
        }
        
        
        console.log('Date parsing debug:', {
          originalDateStr: dateStr,
          parsedDate: dueDate,
          message: message
        });

        detectedTaskAssignment = {
          title: taskName,
          description: "Task assigned via chat",
          assignedTo: [],
          assignToAllMembers: message.toLowerCase().includes('all'),
          assignToRole: normalizedRole,
          dueDate: dueDate,
          priority: "medium",
          groupId: groupId,
        };
        break;
      }
    }

    
    if (!detectedTaskAssignment && message.includes('COMMAND:')) {
      try {
        const commandMatch = message.match(/COMMAND:\s*(\{.*\})/s);
        if (commandMatch) {
          const commandData = JSON.parse(commandMatch[1]);
          if (commandData.type === 'task_assignment') {
            detectedTaskAssignment = {
              title: commandData.title,
              description: commandData.description || "Task assigned via chat",
              assignedTo: commandData.assignedTo || [],
              assignToAllMembers: commandData.assignToAllMembers || false,
              assignToRole: commandData.assignToRole,
              dueDate: commandData.dueDate,
              priority: commandData.priority || "medium",
              groupId: commandData.groupId || groupId,
            };
            console.log('COMMAND format task assignment detected:', detectedTaskAssignment);
          }
        }
      } catch (error) {
        console.error('Error parsing COMMAND format:', error);
      }
    }

   
    if (detectedTaskAssignment) {
      console.log('Processing task assignment:', detectedTaskAssignment);
      
      try {
        const assignedUserIds: string[] = [];

       
        if (detectedTaskAssignment.assignToAllMembers) {
          const members = await sql`
            SELECT user_id FROM group_members WHERE group_id = ${detectedTaskAssignment.groupId}
          ` as { user_id: string }[];
          assignedUserIds.push(...members.map(m => m.user_id));
        }

       
        if (detectedTaskAssignment.assignToRole) {
          
          let roleMembers = await sql`
            SELECT user_id FROM group_members WHERE group_id = ${detectedTaskAssignment.groupId} AND role = ${detectedTaskAssignment.assignToRole}
          ` as { user_id: string }[];
          
          
          if (roleMembers.length === 0) {
            const roleVariations = [];
            const role = detectedTaskAssignment.assignToRole.toLowerCase();
            
            if (role.includes('member')) {
              roleVariations.push('member', 'members');
            } else if (role.includes('manager')) {
              roleVariations.push('manager', 'managers');
            } else if (role.includes('admin')) {
              roleVariations.push('admin', 'admins');
            } else if (role.includes('employee')) {
              roleVariations.push('employee', 'employees');
            } else if (role.includes('tech')) {
              roleVariations.push('tech-lead', 'techlead', 'tech_lead');
            } else if (role.includes('finance')) {
              roleVariations.push('finance-manager', 'financemanager', 'finance_manager');
            }
            
            
            for (const variation of roleVariations) {
              roleMembers = await sql`
                SELECT user_id FROM group_members WHERE group_id = ${detectedTaskAssignment.groupId} AND role = ${variation}
              ` as { user_id: string }[];
              if (roleMembers.length > 0) break;
            }
          }
          
          assignedUserIds.push(...roleMembers.map(m => m.user_id));
          console.log(`Found ${roleMembers.length} users with role: ${detectedTaskAssignment.assignToRole}`);
        }

        
        const uniqueUserIds = Array.from(new Set(assignedUserIds.filter(Boolean)));

        
        for (const assignedUserId of uniqueUserIds) {
          await tasksService.createTask({
            title: detectedTaskAssignment.title,
            description: detectedTaskAssignment.description,
            assignedToUserId: assignedUserId,
            assignedByUserId: userId,
            groupId: detectedTaskAssignment.groupId,
            dueDate: detectedTaskAssignment.dueDate,
            priority: detectedTaskAssignment.priority
          });
        }

        
        let responseMessage = `✅ I have added "${detectedTaskAssignment.title}" for all ${detectedTaskAssignment.assignToRole} for the date ${detectedTaskAssignment.dueDate ? new Date(detectedTaskAssignment.dueDate).toLocaleDateString() : 'no specific date'}.`;
        
        if (detectedTaskAssignment.assignToAllMembers) {
          responseMessage = `✅ I have added "${detectedTaskAssignment.title}" for all group members for the date ${detectedTaskAssignment.dueDate ? new Date(detectedTaskAssignment.dueDate).toLocaleDateString() : 'no specific date'}.`;
        }

        return NextResponse.json({
          response: responseMessage,
          isCommand: false,
          requiresPermission: undefined
        });

      } catch (error) {
        console.error('Error creating tasks:', error);
        return NextResponse.json({
          response: `❌ Error creating tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
          isCommand: false,
          requiresPermission: undefined
        });
      }
    }


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

    
    let tasksForContext: any[] = [];
    try {
      const isAdmin = await rbacService.userHasRole(userId, 'admin');
      tasksForContext = isAdmin ? await tasksService.getAllTasks() : await tasksService.getTasksForUser(userId);
    } catch (e) {
      tasksForContext = [];
    }

    
    let filesForContext: any[] = [];
    try {
      if (canAccessFiles) {
        filesForContext = await sql`
          SELECT title as file_name, mime_type, uploaded_at as created_at, is_inline_content
          FROM uploaded_files
          WHERE group_id = ${groupId}
          ORDER BY uploaded_at DESC
          LIMIT 10
        `;
      } else {
        filesForContext = [];
      }
    } catch (e) {
      filesForContext = [];
    }

    
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

    const uploadFileToGemini = async (fileBlob: Blob, fileName: string, mimeType?: string): Promise<string | null> => {
      try {
        console.log('[chat] uploadFileToGemini: uploading file to Gemini', { fileName, mimeType: mimeType || fileBlob.type });
        
        
        const arrayBuffer = await fileBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        
        const result = await geminiService.uploadFileToGemini({
          data: buffer,
          mimeType: mimeType || fileBlob.type || 'application/octet-stream',
          displayName: fileName
        });
        
        console.log('[chat] uploadFileToGemini: file uploaded successfully', { uri: result.uri });
        return result.uri;
      } catch (error) {
        console.error('[chat] uploadFileToGemini: error uploading to Gemini:', error);
        return null;
      }
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
    const extractStoragePathFromUrl = (url: string): string => {
      // If it's already a storage path (doesn't start with http), return as-is
      if (!url.startsWith('http')) {
        return url;
      }

      
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        const signIndex = pathParts.indexOf('sign');
        if (signIndex !== -1 && pathParts.length > signIndex + 2) {
         
          return pathParts.slice(signIndex + 2).join('/');
        }
      } catch (e) {
        console.warn('[chat] Failed to extract storage path from URL:', url);
      }

      // Fallback: return the original URL 
      return url;
    };


    
    const context: ChatContext = {
      groupId,
      groupName: groups[0].name,
      userPermissions: combinedPermissions,
      recentMessages: recentMessages.reverse(),
      tasks: tasksForContext.map(t => ({ title: t.title, dueDate: t.dueDate || null, groupName: t.groupName, status: t.status })),
      files: filesForContext,
      ragSnippets: []
    };

    
    const intentAssign = /(\bassign\b|\bschedule\b|\bdelegate\b|\bcreate task\b|\badd task\b)/i.test(message);
    if (intentAssign) {
      
    }


    let finalMessage = message;
    let augmentedContext = { ...context } as ChatContext;
    const fileCmdMatch = /file:\s*("[^"]+"|\S+)/i.exec(message);
    if (fileCmdMatch) {
      if (!canAccessFiles) {
        return NextResponse.json({
          response: 'You need files:read and role admin/manager to access group files.',
          isCommand: false,
          requiresPermission: 'permission_denied'
        });
      }
      const requestedPart = fileCmdMatch[1] || '';
      const requested = requestedPart
        .trim()
        .replace(/^"|"$/g, '')
        .split(/[\s\?\.,;:]/)[0]
        .trim();
      console.log('[chat] file: command detected', { requested });

      
      try {
        const inline = await sql`
          SELECT title, content_text FROM uploaded_files
          WHERE group_id = ${groupId} AND is_inline_content = true AND (
            title = ${requested} OR title ILIKE ${'%' + requested + '%'}
          )
          ORDER BY uploaded_at DESC
          LIMIT 1
        ` as { title: string; content_text: string | null }[];
        if (inline.length) {
          const text = (inline[0].content_text || '').toString();
          if (text.trim()) {
            
            const chunks = chunkText(text, 200 * 1024);
            augmentedContext = {
              ...augmentedContext,
              ragSnippets: [...(augmentedContext.ragSnippets || []), ...chunks.map((c, i) => ({ fileName: `${inline[0].title} (inline ${i+1})`, snippet: c }))]
            };
            finalMessage = message;
            
            const aiResponse = await geminiService.generateChatResponse(finalMessage, augmentedContext);
            return NextResponse.json({
              response: aiResponse.response,
              isCommand: aiResponse.isCommand,
              requiresPermission: aiResponse.requiresPermission
            });
          }
        }
      } catch {}

      
      let candidates: { title: string; storage_path: string; mime_type?: string }[];
      try {
        candidates = await sql`
          (
            SELECT title, storage_path, mime_type FROM uploaded_files 
            WHERE group_id = ${groupId} AND title = ${requested}
          )
          UNION ALL
          (
            SELECT title, storage_path, mime_type FROM uploaded_files 
            WHERE group_id = ${groupId} AND title ILIKE ${'%' + requested + '%'}
            ORDER BY uploaded_at DESC
            LIMIT 5
          )
        ` as { title: string; storage_path: string; mime_type?: string }[];
      } catch (error) {
        console.log('[chat] storage_path column not found, using file_url fallback');
        const fallbackCandidates = await sql`
    (
      SELECT title, file_url FROM uploaded_files 
      WHERE group_id = ${groupId} AND title = ${requested}
    )
    UNION ALL
    (
      SELECT title, file_url FROM uploaded_files 
      WHERE group_id = ${groupId} AND title ILIKE ${'%' + requested + '%'}
      ORDER BY uploaded_at DESC
      LIMIT 5
    )
  ` as { title: string; file_url: string }[];

        
        candidates = fallbackCandidates.map(f => ({
          title: f.title,
          storage_path: extractStoragePathFromUrl(f.file_url),
          mime_type: 'application/octet-stream'
        }));
      }
      console.log('[chat] file: candidates found', { count: candidates.length });

      if (!candidates.length) {
        return NextResponse.json({ response: `No similar file found for "${requested}". Try "list files".`, isCommand: false });
      }

      const chosen = candidates[0];
      console.log('[chat] file: chosen', { title: chosen.title, path: chosen.storage_path });

      // Download file and upload to Gemini
      const fileBlob = await downloadFile(chosen.storage_path);
      console.log('[chat] file: download result', { success: fileBlob ? 'SUCCESS' : 'FAILED' });
      if (!fileBlob) {
        console.warn('[chat] file: failed to download file');
        return NextResponse.json({ response: 'Failed to access file.', isCommand: false });
      }
      console.log('[chat] file: file downloaded successfully');

      // Upload file to Gemini and get file URI
      try {
        const geminiFileUri = await uploadFileToGemini(fileBlob, chosen.title, chosen.mime_type);
        console.log('[chat] file: uploaded to Gemini', { uri: geminiFileUri });
        
        if (geminiFileUri) {
          augmentedContext = {
            ...augmentedContext,
            ragFileUris: [...(augmentedContext.ragFileUris || []), {
              fileName: chosen.title,
              uri: geminiFileUri,
              mimeType: chosen.mime_type || fileBlob.type || 'application/octet-stream'
            }]
          };
          finalMessage = message;
        } else {
          // Fallback to text extraction if Gemini upload fails
          const text = await extractText(fileBlob, chosen.storage_path);
          if (text && text.trim()) {
            const summary = await geminiService.summarizeLongText(text, { title: chosen.title });
            augmentedContext = {
              ...augmentedContext,
              ragSnippets: [...(augmentedContext.ragSnippets || []), { fileName: `${chosen.title} (summary)`, snippet: summary }]
            };
          } else {
            augmentedContext = {
              ...augmentedContext,
              ragSnippets: [...(augmentedContext.ragSnippets || []), { fileName: `${chosen.title} (summary)`, snippet: 'No readable text could be extracted from this file.' }]
            };
          }
          finalMessage = message;
        }
      } catch (error) {
        console.error('[chat] file: error uploading to Gemini, falling back to text extraction:', error);
        // Fallback to text extraction
        const text = await extractText(fileBlob, chosen.storage_path);
        if (text && text.trim()) {
          const summary = await geminiService.summarizeLongText(text, { title: chosen.title });
          augmentedContext = {
            ...augmentedContext,
            ragSnippets: [...(augmentedContext.ragSnippets || []), { fileName: `${chosen.title} (summary)`, snippet: summary }]
          };
        } else {
          augmentedContext = {
            ...augmentedContext,
            ragSnippets: [...(augmentedContext.ragSnippets || []), { fileName: `${chosen.title} (summary)`, snippet: 'No readable text could be extracted from this file.' }]
          };
        }
        finalMessage = message;
      }
    }

    
    if (finalMessage === message) {
      const quoted = /(?:summarize|read|open|show|analy(?:se|ze)|review)\s+"([^"]{1,200})"/i.exec(message);
      const withExt = /\b([\w\- .]{1,160}\.(?:txt|pdf|docx|xlsx|xls|csv|json|md))\b/i.exec(message);
      const candidateName = (quoted?.[1] || withExt?.[1] || '').trim();
      if (candidateName) {
        if (!canAccessFiles) {
          return NextResponse.json({
            response: 'You need files:read and role admin/manager to access group files.',
            isCommand: false,
            requiresPermission: 'permission_denied'
          });
        }
        console.log('[chat] autodetect: candidate name', { candidateName });
        // Inline content short-circuit
        try {
          const inline = await sql`
            SELECT title, content_text FROM uploaded_files
            WHERE group_id = ${groupId} AND is_inline_content = true AND (
              title = ${candidateName} OR title ILIKE ${'%' + candidateName + '%'}
            )
            ORDER BY uploaded_at DESC
            LIMIT 1
          ` as { title: string; content_text: string | null }[];
          if (inline.length) {
            const text = (inline[0].content_text || '').toString();
            if (text.trim()) {
              const chunks = chunkText(text, 200 * 1024);
              augmentedContext = {
                ...augmentedContext,
                ragSnippets: [...(augmentedContext.ragSnippets || []), ...chunks.map((c, i) => ({ fileName: `${inline[0].title} (inline ${i+1})`, snippet: c }))]
              };
              finalMessage = message;
              const aiResponse = await geminiService.generateChatResponse(finalMessage, augmentedContext);
              return NextResponse.json({
                response: aiResponse.response,
                isCommand: aiResponse.isCommand,
                requiresPermission: aiResponse.requiresPermission
              });
            }
          }
        } catch {}
        // Try with storage_path first, fallback to file_url if column doesn't exist
        let candidates: { title: string; storage_path: string; mime_type?: string }[];
        try {
          candidates = await sql`
            (
              SELECT title, storage_path, mime_type FROM uploaded_files 
              WHERE group_id = ${groupId} AND title = ${candidateName}
            )
            UNION ALL
            (
              SELECT title, storage_path, mime_type FROM uploaded_files 
              WHERE group_id = ${groupId} AND title ILIKE ${'%' + candidateName + '%'}
              ORDER BY uploaded_at DESC
              LIMIT 5
            )
          ` as { title: string; storage_path: string; mime_type?: string }[];
        } catch (error) {
          console.log('[chat] autodetect: storage_path column not found, using file_url fallback');
          const fallbackCandidates = await sql`
            (
              SELECT title, file_url FROM uploaded_files
              WHERE group_id = ${groupId} AND title = ${candidateName}
            )
            UNION ALL
            (
              SELECT title, file_url FROM uploaded_files
              WHERE group_id = ${groupId} AND title ILIKE ${'%' + candidateName + '%'}
              ORDER BY uploaded_at DESC
                LIMIT 5
            )
          ` as { title: string; file_url: string }[];

          // Convert URLs to storage paths
          candidates = fallbackCandidates.map(f => ({
            title: f.title,
            storage_path: extractStoragePathFromUrl(f.file_url),
            mime_type: 'application/octet-stream'
          }));
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

          // Upload file to Gemini and get file URI
          try {
            const geminiFileUri = await uploadFileToGemini(fileBlob, chosen.title, chosen.mime_type);
            console.log('[chat] autodetect: uploaded to Gemini', { uri: geminiFileUri });
            
            if (geminiFileUri) {
              augmentedContext = {
                ...augmentedContext,
                ragFileUris: [...(augmentedContext.ragFileUris || []), {
                  fileName: chosen.title,
                  uri: geminiFileUri,
                  mimeType: chosen.mime_type || fileBlob.type || 'application/octet-stream'
                }]
              };
              finalMessage = message;
            } else {
              // Fallback to text extraction if Gemini upload fails
              const text = await extractText(fileBlob, chosen.storage_path);
              if (text && text.trim()) {
                const summary = await geminiService.summarizeLongText(text, { title: chosen.title });
                augmentedContext = {
                  ...augmentedContext,
                  ragSnippets: [...(augmentedContext.ragSnippets || []), { fileName: `${chosen.title} (summary)`, snippet: summary }]
                };
              } else {
                augmentedContext = {
                  ...augmentedContext,
                  ragSnippets: [...(augmentedContext.ragSnippets || []), { fileName: `${chosen.title} (summary)`, snippet: 'No readable text could be extracted from this file.' }]
                };
              }
              finalMessage = message;
            }
          } catch (error) {
            console.error('[chat] autodetect: error uploading to Gemini, falling back to text extraction:', error);
            // Fallback to text extraction
            const text = await extractText(fileBlob, chosen.storage_path);
            if (text && text.trim()) {
              const summary = await geminiService.summarizeLongText(text, { title: chosen.title });
              augmentedContext = {
                ...augmentedContext,
                ragSnippets: [...(augmentedContext.ragSnippets || []), { fileName: `${chosen.title} (summary)`, snippet: summary }]
              };
            } else {
              augmentedContext = {
                ...augmentedContext,
                ragSnippets: [...(augmentedContext.ragSnippets || []), { fileName: `${chosen.title} (summary)`, snippet: 'No readable text could be extracted from this file.' }]
              };
            }
            finalMessage = message;
          }
        }
      }
    }

    // If user asked for a list of files, return list directly
    const listIntent = /(what\s+(are\s+)?the\s+files|which\s+files|list\s+files|show\s+files|all\s+files|files\?|files\s+available|files\s+can\s+i\s+access|what\s+are\s+the\s+files\s+i\s+can\s+access)/i.test(message);
    if (listIntent) {
      try {
        if (!canAccessFiles) {
          return NextResponse.json({
            response: 'You need files:read and role admin/manager to list group files.',
            isCommand: false,
            requiresPermission: 'permission_denied'
          });
        }
        let rows = await sql`
          SELECT title, is_inline_content, mime_type, uploaded_at
          FROM uploaded_files
          WHERE group_id = ${groupId}
          ORDER BY uploaded_at DESC
          LIMIT 50
        ` as { title: string; is_inline_content: boolean; mime_type: string | null; uploaded_at: string }[];
        if (!rows.length) {
          return NextResponse.json({ response: 'No files found for this group.', isCommand: false, requiresPermission: false });
        }
        const lines = rows.map(r => `- ${r.title} ${r.is_inline_content ? '(inline)' : '(file)'}${r.mime_type ? ` · ${r.mime_type}` : ''}`);
        return NextResponse.json({ response: `Here are recent files:\n${lines.join('\n')}`, isCommand: false, requiresPermission: false });
      } catch (e) {
        console.error('[chat] list files failed primary select', e);
        try {
          const rowsFallback = await sql`
            SELECT title, uploaded_at
            FROM uploaded_files
            WHERE group_id = ${groupId}
            ORDER BY uploaded_at DESC
            LIMIT 50
          ` as { title: string; uploaded_at: string }[];
          if (!rowsFallback.length) {
            return NextResponse.json({ response: 'No files found for this group.', isCommand: false, requiresPermission: false });
          }
          const lines = rowsFallback.map(r => `- ${r.title}`);
          return NextResponse.json({ response: `Here are recent files:\n${lines.join('\n')}`, isCommand: false, requiresPermission: false });
        } catch (e2) {
          console.error('[chat] list files failed fallback select', e2);
          return NextResponse.json({ response: 'Failed to list files.', isCommand: false, requiresPermission: false });
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
        // TASK ASSIGNMENT BYPASS: Allow all task assignments regardless of permissions
        // This ensures task assignment works for all users, especially admins
        console.log('Task assignment detected - bypassing all permission checks:', { 
          userId, 
          groupId, 
          taskTitle: aiResponse.taskAssignment.title,
          assignToRole: aiResponse.taskAssignment.assignToRole
        });

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
          const created = await tasksService.createTask({
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
        let responseMessage = `✅ Task "${aiResponse.taskAssignment.title}" has been assigned to ${uniqueUserIds.length} user(s).`;
        
        if (aiResponse.taskAssignment.assignToRole) {
          responseMessage = `✅ I have added "${aiResponse.taskAssignment.title}" for all ${aiResponse.taskAssignment.assignToRole} for the date ${aiResponse.taskAssignment.dueDate || 'no specific date'}.`;
        } else if (aiResponse.taskAssignment.assignToAllMembers) {
          responseMessage = `✅ I have added "${aiResponse.taskAssignment.title}" for all group members for the date ${aiResponse.taskAssignment.dueDate || 'no specific date'}.`;
        }
        
        aiResponse.response = responseMessage;
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
