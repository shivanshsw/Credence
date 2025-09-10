// lib/gemini.ts
import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "apikey";


const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

console.log("Gemini API Key loaded?", !!GEMINI_API_KEY);

export interface UserPermissions {
  role: string;
  permissions: string[];
  groupPermissions?: string[];
  customPermissionText?: string;
}

export interface ChatContext {
  groupId: string;
  groupName: string;
  userPermissions: UserPermissions;
  recentMessages?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  tasks?: Array<{
    title: string;
    dueDate: string | null;
    groupName: string;
    status: string;
  }>;
  files?: Array<{
    file_name: string;
    mime_type: string | null;
    created_at: string;
  }>;
  ragSnippets?: Array<{
    fileName: string;
    snippet: string;
  }>;
  ragFileUris?: Array<{
    fileName: string;
    uri: string;
    mimeType: string;
  }>;
}

export interface TaskAssignment {
  title: string;
  description: string;
  assignedTo: string[]; // usernames or emails or special keywords
  assignToAllMembers?: boolean;
  assignToRole?: string; // e.g., 'manager', 'member'
  dueDate: string;
  priority: "low" | "medium" | "high";
  groupId: string;
}

export class GeminiService {
  async generateChatResponse(
      userMessage: string,
      context: ChatContext
  ): Promise<{
    response: string;
    isCommand: boolean;
    taskAssignment?: TaskAssignment;
    requiresPermission?: string;
  }> {
    const systemPrompt = this.buildSystemPrompt(context);

    try {
      const combinedPrompt = `${systemPrompt}\n\nUser: ${userMessage}`;

      let result;
      if (context.ragFileUris && context.ragFileUris.length > 0) {
        
        const parts: any[] = [{ text: combinedPrompt }];
        for (const f of context.ragFileUris.slice(0, 5)) {
          parts.push({ fileData: { fileUri: f.uri, mimeType: f.mimeType } });
        }
        result = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts,
            },
          ],
        });
      } else {
        // Fallback to plain text prompt
        result = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: combinedPrompt,
        });
      }

      const text = result.text;

      return this.parseResponse(text, context);
    } catch (error: any) {
      console.error("Gemini API error:", error?.message || error);

      return {
        response:
            "I'm sorry, I'm having trouble connecting to the AI service. Please try again later.",
        isCommand: false,
      };
    }
  }

  private buildSystemPrompt(context: ChatContext): string {
    const permissionsList = context.userPermissions.permissions.join(", ");
    const groupPermissionsList = context.userPermissions.groupPermissions?.join(", ") || "";
    
    // Build the base prompt
    let prompt = `You are an AI assistant for the Credence MCP platform. You help users with their work tasks while respecting their role-based permissions.

USER CONTEXT:
- Current Group: ${context.groupName}
- User Role: ${context.userPermissions.role}
- User Permissions: ${permissionsList}`;

    // Add group-specific permissions if they exist
    if (groupPermissionsList) {
      prompt += `\n- Group-Specific Permissions: ${groupPermissionsList}`;
    }

    
    if (context.userPermissions.customPermissionText) {
      prompt += `\n\n🚨 HIGH PRIORITY - CUSTOM GROUP PERMISSIONS (OVERRIDES ALL OTHER RESTRICTIONS):
${context.userPermissions.customPermissionText}

IMPORTANT: The above custom permissions text has HIGHEST PRIORITY and can override standard permission restrictions. Follow these custom permissions even if they conflict with standard permissions.`;
    }

    prompt += `\n\nPERMISSION RULES:
- Only provide information or perform actions that the user's permissions allow
- If a user requests something they don't have permission for, explain what permission they need
- Always be helpful but security-conscious
- CUSTOM GROUP PERMISSIONS (if provided above) have HIGHEST PRIORITY and override standard restrictions

AVAILABLE COMMANDS AND CAPABILITIES:
1. Task Assignment: 
   - "Assign [task] to [users] by [date]"
   - "assign:[task_name] to role:[role_name] for date <date>"
   - "assign task: [task_name] to all role: [role_name] for [date]"
   - "assign: [task_name] to role: [role_name] for [date]"
   - Any variation with "assign", "task:", "role:", "date" keywords
2. Calendar Management: "Schedule [event] for [date/time]"
3. Notes: "Create note about [topic]", "Share note with [user]"
4. Data Access: "Show [data type]" (based on permissions)
5. File Reading: When file text is provided in FILE CONTEXT or when the user uses "file: <name>", you CAN read, summarize, extract, and answer questions directly from that content. Do not claim a lack of a specific command.

RESPONSE FORMAT:
- For regular chat: Respond naturally
- For commands: Start with "COMMAND:" followed by JSON
- For permission denials: Start with "PERMISSION_DENIED:" followed by explanation
 - For file access requests: If file text is provided in FILE CONTEXT, quote, summarize, and extract as needed. If only a signed link is provided, acknowledge the link and avoid claiming you cannot access files.

FORMATTING RULES:
- Use **double asterisks** for bold text (example: **bold**)
- Use *single asterisk* for italics (example: *italic*)
- Use \n for new lines
- You may include 1-3 relevant emoji to enhance clarity (e.g., ✅📌📅), but keep them tasteful and relevant to the answer length.

TASK ASSIGNMENT DETECTION:
When users mention task assignment, look for these patterns and respond with COMMAND: JSON:
- "assign: [task_name] to role: [role_name] for date [date]"
- "assign task: [task_name] to all role: [role_name] for [date]"
- "assign: [task_name] to role: [role_name] for [date]"
- "task: [task_name] to role: [role_name] for date [date]"
- "assign [task_name] to role [role_name] for date [date]"
- "assign [task_name] to all role [role_name] for date [date]"

EXTRACTION RULES:
- Extract task name from after "assign:" or "assign task:" or "task:"
- Extract role from after "role:" (e.g., "members", "managers", "admin", "employee")
- Extract date from after "for date", "for [date]", "by [date]", or similar patterns
- If role is specified, set assignToRole to that role
- If "all" is mentioned with a role, set assignToAllMembers to true
- Default priority to "medium" if not specified
- Default description to "Task assigned via chat" if not provided

RESPONSE FORMAT:
When you detect a task assignment pattern, respond with:
COMMAND: {"type": "task_assignment", "title": "[extracted_task_name]", "description": "Task assigned via chat", "assignToRole": "[extracted_role]", "dueDate": "[parsed_date]", "priority": "medium", "groupId": "${context.groupId}"}

Example command responses:
COMMAND: {"type": "task_assignment", "title": "Q3 Report", "description": "Complete quarterly report", "assignedTo": ["user1@email.com", "user2@email.com"], "dueDate": "2024-01-15", "priority": "high", "groupId": "${context.groupId}"}

COMMAND: {"type": "task_assignment", "title": "Complete documentation", "description": "Task assigned via chat", "assignToRole": "members", "dueDate": "2024-01-15", "priority": "medium", "groupId": "${context.groupId}"}

Example permission denial:
PERMISSION_DENIED: You need 'finance_data:read' permission to access financial reports. Please contact your manager to request this access.

Remember: Always respect the user's current permissions and role. CUSTOM GROUP PERMISSIONS have HIGHEST PRIORITY.`;

    // Add a compact snapshot of the user's tasks (or all tasks for admins)
    if (context.tasks && context.tasks.length > 0) {
      const taskLines = context.tasks.slice(0, 20).map(t => `- [${t.status}] ${t.title} (${t.groupName}) ${t.dueDate ? `due ${t.dueDate}` : ''}`);
      prompt += `\n\nTASKS SNAPSHOT (for context):\n${taskLines.join("\n")}`;
    }

    // Add a compact snapshot of available group files
    if (context.files && context.files.length > 0) {
      const fileLines = context.files.slice(0, 10).map(f => `- ${f.file_name} (${f.mime_type || 'file'}) uploaded ${f.created_at}`);
      prompt += `\n\nGROUP FILES SNAPSHOT (for context):\n${fileLines.join("\n")}`;
    }

    // Include file-derived snippets or links
    if (context.ragSnippets && context.ragSnippets.length > 0) {
      const snippetLines = context.ragSnippets
        .slice(0, 5)
        .map(s => `---\nFILE: ${s.fileName}\nCONTENT:\n${s.snippet}`)
        .join("\n\n");

      prompt += `\n\nWHEN FILE CONTEXT PROVIDED:\n- The following file-derived snippets or links may be included to help you answer.\n- If a snippet contains actual text content, prioritize answering directly from it.\n- If only a signed URL is provided, do NOT claim to have read the file. Instead, answer based on filename and available metadata.\n- When text is present, you may summarize, extract facts, compute, or answer questions directly from that text.\n- Summarize long content in 5-8 bullet points with key figures and dates when asked; always cite the source filename.\n- IMPORTANT: If file snippets are provided, DO NOT say you cannot access the file. You HAVE the file text provided above; use it.\n- If the user asks to "summarize", "quote", "extract", or "show" content from a file and FILE CONTEXT is available, comply directly using that text.\n\nFILE CONTEXT:\n${snippetLines}`;
    }

    return prompt;
  }

  private parseResponse(
      text: string | undefined,
      context: ChatContext
  ): { response: string; isCommand: boolean; taskAssignment?: TaskAssignment; requiresPermission?: string } {
    if (!text) {
      return { response: "", isCommand: false };
    }

    const trimmed = text.trim();

    if (trimmed.startsWith("COMMAND:")) {
      try {
        const jsonStr = trimmed.replace("COMMAND:", "").trim();
        const commandData = JSON.parse(jsonStr);
        if (commandData.type === "task_assignment") {
          return {
            response: `I'll assign the task "${commandData.title}" to the specified users.`,
            isCommand: true,
            taskAssignment: {
              title: commandData.title,
              description: commandData.description,
              assignedTo: commandData.assignedTo || [],
              assignToAllMembers: commandData.assignToAllMembers || false,
              assignToRole: commandData.assignToRole || undefined,
              dueDate: commandData.dueDate,
              priority: commandData.priority,
              groupId: context.groupId,
            },
          };
        }
      } catch (error) {
        console.error("Error parsing command:", error);
      }
    }

    // Enhanced task assignment detection for natural language patterns
    const taskAssignment = this.detectTaskAssignment(trimmed, context);
    if (taskAssignment) {
      return {
        response: `I'll assign the task "${taskAssignment.title}" to the specified users.`,
        isCommand: true,
        taskAssignment: taskAssignment,
      };
    }

    if (trimmed.startsWith("PERMISSION_DENIED:")) {
      return {
        response: trimmed.replace("PERMISSION_DENIED:", "").trim(),
        isCommand: false,
        requiresPermission: "permission_denied",
      };
    }

    return {
      response: trimmed,
      isCommand: false,
    };
  }

  private detectTaskAssignment(text: string, context: ChatContext): TaskAssignment | null {
    // Enhanced patterns for task assignment detection
    const patterns = [
      // Pattern 1: assign:task_name to role:role_name for date <date>
      /assign:\s*([^:]+?)\s+to\s+role:\s*([^\s]+?)(?:\s+for\s+date\s+([^\s]+))?/i,
      // Pattern 2: assign task: task_name to all role: role_name for date <date>
      /assign\s+task:\s*([^:]+?)\s+to\s+all\s+role:\s*([^\s]+?)(?:\s+for\s+date\s+([^\s]+))?/i,
      // Pattern 3: assign: task_name to role: role_name for [date]
      /assign:\s*([^:]+?)\s+to\s+role:\s*([^\s]+?)(?:\s+for\s+([^\s]+))?/i,
      // Pattern 4: task: task_name to role: role_name for date <date>
      /task:\s*([^:]+?)\s+to\s+role:\s*([^\s]+?)(?:\s+for\s+date\s+([^\s]+))?/i,
      // Pattern 5: assign task_name to role role_name for date <date>
      /assign\s+([^:]+?)\s+to\s+role\s+([^\s]+?)(?:\s+for\s+date\s+([^\s]+))?/i,
      // Pattern 6: assign task_name to all role role_name for date <date>
      /assign\s+([^:]+?)\s+to\s+all\s+role\s+([^\s]+?)(?:\s+for\s+date\s+([^\s]+))?/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const taskName = match[1].trim();
        const roleName = match[2].trim();
        const dateStr = match[3]?.trim();

        // Normalize role names
        const normalizedRole = this.normalizeRoleName(roleName);
        
        // Parse date if provided
        let dueDate = null;
        if (dateStr) {
          dueDate = this.parseDate(dateStr);
        }

        return {
          title: taskName,
          description: "Task assigned via chat",
          assignedTo: [],
          assignToAllMembers: text.toLowerCase().includes('all'),
          assignToRole: normalizedRole,
          dueDate: dueDate,
          priority: "medium",
          groupId: context.groupId,
        };
      }
    }

    return null;
  }

  private normalizeRoleName(roleName: string): string {
    const roleMap: { [key: string]: string } = {
      'member': 'member',
      'members': 'member',
      'manager': 'manager',
      'managers': 'manager',
      'admin': 'admin',
      'admins': 'admin',
      'employee': 'employee',
      'employees': 'employee',
      'tech-lead': 'tech-lead',
      'techlead': 'tech-lead',
      'finance-manager': 'finance-manager',
      'financemanager': 'finance-manager',
    };

    return roleMap[roleName.toLowerCase()] || roleName.toLowerCase();
  }

  private parseDate(dateStr: string): string | null {
    try {
      // Handle various date formats
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date.toISOString();
    } catch {
      return null;
    }
  }

  async uploadFileToGemini(params: {
    data: Buffer;
    mimeType: string;
    displayName: string;
  }): Promise<{ uri: string; mimeType: string; fileName: string }> {
    const uploaded = await ai.files.upload({
      file: { data: params.data, mimeType: params.mimeType, displayName: params.displayName },
    } as any);
    const uri = (uploaded as any)?.file?.uri ?? (uploaded as any)?.uri ?? '';
    if (!uri) throw new Error('Failed to upload file to Gemini');
    return { uri, mimeType: params.mimeType, fileName: params.displayName };
  }

  async generateNotesSummary(
      notes: Array<{ title: string; content: string; author: string }>
  ): Promise<string> {
    const prompt = `Summarize these notes in a helpful way:\n\n${notes
        .map(
            (n) =>
                `Title: ${n.title}\nAuthor: ${n.author}\nContent: ${n.content}\n---`
        )
        .join("\n")}`;

    try {
      // ✅ New SDK call
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      return  result.text ?? "".replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // bold
          .replace(/\*(.*?)\*/g, "<em>$1</em>")             // italics
          .replace(/\n/g, "<br>");                          // line breaks;
    } catch (error) {
      console.error("Gemini API error:", error);
      return "Unable to generate summary at this time.";
    }
  }

  async summarizeLongText(rawText: string, options?: { title?: string; targetTokens?: number }): Promise<string> {
    const title = options?.title || "Document";
    const truncated = rawText.slice(0, 220 * 1024);
    const prompt = `You are given a document titled "${title}". Produce a concise summary capturing:
- Key objectives, decisions, deadlines, owners, figures, and dates
- Any risks, blockers, and next steps
- Keep it under 15 bullet points total
Use plain text with bullets (- ). If content appears tabular, flatten key cells.
\n\nDOCUMENT (truncated):\n${truncated}`;
    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      return (result.text || "").trim();
    } catch (e) {
      return "";
    }
  }
}

export const geminiService = new GeminiService();
