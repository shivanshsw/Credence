"use client"

import AppShell from "@/components/app-shell"
import {
  ChatMessage,
  ManagerApproval,
  PermissionRequest,
  ToolOutput,
  TypingIndicator,
} from "@/components/chat/chat-message"
import { ChatInput } from "@/components/chat/chat-input"
import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/components/auth-context"
import { useSearchParams, useRouter } from "next/navigation" // 1. Import useRouter
import SecurityPanel from "@/components/security-panel"
import SettingsPanel from "@/components/settings-panel"
import GroupGate from "@/components/groups/group-gate"

type Msg =
    | { kind: "msg"; role: "user" | "assistant"; content: string }
    | { kind: "tool"; title: string; body: string }
    | { kind: "perm"; state: "ask" | "manager" | "granted" }

export default function Page() {
  const [messages, setMessages] = useState<Msg[]>([
    { kind: "msg", role: "assistant", content: "MCP Agent online. How can I assist you?" },
    {
      kind: "tool",
      title: "Invoice Summary",
      body: "Last 30 days: 42 invoices · $184,220 total · 3 overdue.",
    },
    { kind: "msg", role: "user", content: "Open cashflow analyzer." },
    { kind: "perm", state: "ask" },
  ])

  // 2. The mock 'login' function is no longer needed from the context
  const { loggedIn, loading, selectedGroupId } = useAuth()
  const search = useSearchParams()
  const router = useRouter() // 3. Get the router instance
  const view = search.get("view")

  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])

  const listRef = useRef<HTMLDivElement | null>(null)
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages.length, typing])

  function addUserText(text: string) {
    setMessages((prev) => [...prev, { kind: "msg", role: "user", content: text }])
    setTyping(true)
    const reply = mockReplyFor(text)
    setTimeout(() => {
      setMessages((prev) => [...prev, { kind: "msg", role: "assistant", content: reply }])
      setTyping(false)
    }, 900)
  }

  function triggerManagerFlow() {
    setMessages((prev) => prev.map((m) => (m.kind === "perm" ? { ...m, state: "manager" } : m)))
  }

  function grantPermission() {
    setMessages((prev) => prev.map((m) => (m.kind === "perm" ? { ...m, state: "granted" } : m)))
  }

  function denyPermission() {
    setMessages((prev) => prev.filter((m) => m.kind !== "perm"))
  }

  function mockReplyFor(input: string): string {
    const t = input.toLowerCase()
    if (t.includes("invoice")) {
      return "Here’s a quick invoice summary for the last 30 days: 42 invoices · $184,220 total · 3 overdue."
    }
    if (t.includes("access")) {
      return "You don’t currently have access to this tool. I can request access from your manager."
    }
    if (t.includes("cashflow")) {
      return "Opening cashflow analyzer… Let me know if you want a trend breakdown or anomalies."
    }
    if (t.startsWith("assign")) {
      return "Task created and assigned. Would you like me to set a due date and priority?"
    }
    return "Acknowledged. I’m on it. I’ll follow up with details shortly."
  }


  // This check ensures we don't try to render client-side logic on the server
  if (!isClient) {
    return null; // Or a loading skeleton
  }

  // Once the client has mounted, we can render the correct UI
  return (
      <AppShell>
        {loggedIn && !selectedGroupId ? (
            <GroupGate />
        ) : view === "security" ? (
            <SecurityPanel />
        ) : view === "settings" ? (
            <SettingsPanel />
        ) : (
            <section
                aria-labelledby="chat-title"
                className="relative flex h-[calc(100vh-120px)] flex-col rounded-md border border-neutral-800 bg-neutral-950/50"
            >
              <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
                <h1 id="chat-title" className="text-pretty text-sm font-semibold">MCP Agent</h1>
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-teal-500" aria-hidden="true" />
                  Online
                </div>
              </header>
              <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
                <div
                    ref={listRef}
                    className={
                        "flex-1 min-h-0 overflow-y-auto rounded-md border border-neutral-900 bg-black p-3 " +
                        (!loggedIn ? "pointer-events-none select-none opacity-70 [filter:blur(2px)]" : "")
                    }
                >
                  <div className="space-y-3">
                    {messages.map((m, i) => {
                      if (m.kind === "msg") return <ChatMessage key={i} role={m.role}>{m.content}</ChatMessage>;
                      if (m.kind === "tool") return <ToolOutput key={i} title={m.title}>{m.body}</ToolOutput>;
                      if (m.kind === "perm") {
                        if (m.state === "ask") return <PermissionRequest key={i} onRequest={triggerManagerFlow} />;
                        if (m.state === "manager") return <ManagerApproval key={i} employee="kranson" tool="cashflow" onGrant={grantPermission} onDeny={denyPermission}/>;
                        return <ChatMessage key={i} role="assistant">Access granted for cashflow. Try: “open cashflow analyzer dashboard”.</ChatMessage>;
                      }
                      return null
                    })}
                    {loggedIn && typing ? <TypingIndicator className="mt-1" /> : null}
                  </div>
                </div>
                <div className={!loggedIn ? "pointer-events-none opacity-70 [filter:blur(1.5px)]" : ""}>
                  <ChatInput onSend={addUserText} />
                </div>
              </div>
              {!loggedIn && (
                  <div aria-live="polite" className="absolute inset-0 z-10 grid place-items-center bg-black/60 backdrop-blur-sm">
                    <div className="rounded-md border border-neutral-800 bg-neutral-950 p-6 text-center shadow">
                      <p className="text-sm text-neutral-300">Welcome to FINCORP MCP</p>
                      <h2 className="mt-1 text-pretty text-lg font-semibold">Sign in to start chatting</h2>
                      {/* 4. This now correctly navigates to your dedicated sign-in page */}
                      <button type="button" onClick={() => router.push('/sign-in')} className="mt-4 inline-flex items-center justify-center rounded-md bg-teal-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-60" disabled={loading}>
                        {loading ? "Loading..." : "Sign In / Sign Up"}
                      </button>
                    </div>
                  </div>
              )}
            </section>
        )}
      </AppShell>
  )
}

