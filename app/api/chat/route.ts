// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';
import { geminiService, ChatContext } from '@/lib/gemini';
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

    // Get group name
    const groups = await sql`
      SELECT name FROM groups WHERE id = ${groupId}
    `;
    
    if (groups.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Get recent chat messages for context
    let recentMessages = [];
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
      `;
    } catch (error) {
      console.warn('Chat messages table not found, using empty context:', error);
      recentMessages = [];
    }

    const context: ChatContext = {
      groupId,
      groupName: groups[0].name,
      userPermissions,
      recentMessages: recentMessages.reverse()
    };

    // Generate AI response
    const aiResponse = await geminiService.generateChatResponse(message, context);

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
        // Get user IDs for the assigned emails
        const assignedUserIds = [];
        for (const email of aiResponse.taskAssignment.assignedTo) {
          const userResult = await sql`
            SELECT id FROM users WHERE email = ${email}
          `;
          if (userResult.length > 0) {
            assignedUserIds.push(userResult[0].id);
          }
        }

        // Create tasks for each assigned user
        for (const assignedUserId of assignedUserIds) {
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
        aiResponse.response = `✅ Task "${aiResponse.taskAssignment.title}" has been assigned to ${assignedUserIds.length} user(s).`;
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
