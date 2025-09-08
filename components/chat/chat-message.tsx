"use client"

import type React from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function ChatMessage({
  role,
  children,
  isCommand,
  requiresPermission,
}: {
  role: "user" | "assistant"
  children: React.ReactNode
  isCommand?: boolean
  requiresPermission?: string
}) {
  const isUser = role === "user"
  const initials = isUser ? "KR" : "AI"
  
  return (
    <div className={cn("flex items-start gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <Avatar className="h-7 w-7">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "max-w-[75%] rounded-md border px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "border-teal-500/30 bg-teal-500/10 text-teal-100"
            : requiresPermission === 'permission_denied'
            ? "border-red-500/30 bg-red-500/10 text-red-100"
            : isCommand
            ? "border-green-500/30 bg-green-500/10 text-green-100"
            : "border-neutral-800 bg-neutral-950 text-neutral-200",
        )}
      >
        {isCommand && !isUser && (
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-medium text-green-400">✓ Command Executed</span>
          </div>
        )}
        {requiresPermission === 'permission_denied' && !isUser && (
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-medium text-red-400">⚠ Permission Required</span>
          </div>
        )}
        {typeof children === 'string' ? (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{children as string}</ReactMarkdown>
          </div>
        ) : (
          children
        )}
        {requiresPermission === 'permission_denied' && !isUser && (
          <div className="mt-3">
            <button
              className="inline-flex items-center rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-black hover:bg-teal-500"
              onClick={() => {
                // Placeholder action: would notify group admin
                console.log('Request Access clicked');
                try { alert('Access request sent to group admin (placeholder).'); } catch {}
              }}
            >
              Request Access
            </button>
          </div>
        )}
      </div>
      {isUser && (
        <Avatar className="h-7 w-7">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}

export function ToolOutput({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Card className="max-w-[75%] border-cyan-400/30 bg-neutral-950">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-cyan-400">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-neutral-300">{children}</CardContent>
    </Card>
  )
}

export function PermissionRequest({
  onRequest,
}: {
  onRequest: () => void
}) {
  return (
    <div className="max-w-[75%] rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm">
      <p className="text-neutral-200">
        You don’t currently have access to this tool. I can request access from your manager.
      </p>
      <button
        className="mt-2 inline-flex items-center rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-black hover:bg-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        onClick={onRequest}
      >
        Request access
      </button>
    </div>
  )
}

export function ManagerApproval({
  employee,
  tool,
  onGrant,
  onDeny,
}: {
  employee: string
  tool: string
  onGrant: () => void
  onDeny: () => void
}) {
  return (
    <Card className="max-w-[75%] border-teal-500/40 bg-neutral-950">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Permission Request</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-neutral-300">
        <p className="mb-2">
          <span className="text-neutral-100 font-medium">@{employee}</span> is requesting access to{" "}
          <span className="text-neutral-100 font-medium">{tool}</span>.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onGrant}
            className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-black hover:bg-teal-500"
            aria-label="Grant permission"
          >
            Grant
          </button>
          <button
            onClick={onDeny}
            className="rounded-md border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900"
            aria-label="Deny permission"
          >
            Deny
          </button>
        </div>
        <p className="mt-2 text-[11px] text-neutral-500">
          Tip: type ‘grant @{employee} for {tool}’
        </p>
      </CardContent>
    </Card>
  )
}

export function TypingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn("contents", className)}>
      <ChatMessage role="assistant">
        <span role="status" aria-live="polite" className="inline-flex items-center gap-1">
          <span className="sr-only">Assistant is typing</span>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: "0ms" }} />
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400"
            style={{ animationDelay: "300ms" }}
          />
        </span>
      </ChatMessage>
    </div>
  )
}
