// lib/gemini.ts
import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "apikey";

// Client will pick from GEMINI_API_KEY automatically if set
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

console.log("Gemini API Key loaded?", !!GEMINI_API_KEY);

export interface UserPermissions {
  role: string;
  permissions: string[];
}

export interface ChatContext {
  groupId: string;
  groupName: string;
  userPermissions: UserPermissions;
  recentMessages?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export interface TaskAssignment {
  title: string;
  description: string;
  assignedTo: string[];
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

      // ✅ New SDK call
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: combinedPrompt,
      });

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

    return `You are an AI assistant for the Credence MCP platform. You help users with their work tasks while respecting their role-based permissions.

USER CONTEXT:
- Current Group: ${context.groupName}
- User Role: ${context.userPermissions.role}
- User Permissions: ${permissionsList}

PERMISSION RULES:
- Only provide information or perform actions that the user's permissions allow
- If a user requests something they don't have permission for, explain what permission they need
- Always be helpful but security-conscious

AVAILABLE COMMANDS:
1. Task Assignment: "Assign [task] to [users] by [date]"
2. Calendar Management: "Schedule [event] for [date/time]"
3. Notes: "Create note about [topic]", "Share note with [user]"
4. Data Access: "Show [data type]" (based on permissions)

RESPONSE FORMAT:
- For regular chat: Respond naturally
- For commands: Start with "COMMAND:" followed by JSON
- For permission denials: Start with "PERMISSION_DENIED:" followed by explanation

FORMATTING RULES:
- Use **double asterisks** for bold text (example: **bold**)
- Use *single asterisk* for italics (example: *italic*)
- Use \\n for new lines
- Do not use any other markdown or formatting styles
Example command response:
COMMAND: {"type": "task_assignment", "title": "Q3 Report", "description": "Complete quarterly report", "assignedTo": ["user1@email.com", "user2@email.com"], "dueDate": "2024-01-15", "priority": "high", "groupId": "${context.groupId}"}

Example permission denial:
PERMISSION_DENIED: You need 'finance_data:read' permission to access financial reports. Please contact your manager to request this access.

Remember: Always respect the user's current permissions and role.`;
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
              assignedTo: commandData.assignedTo,
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
}

export const geminiService = new GeminiService();
