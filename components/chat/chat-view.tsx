"use client"

import {
    ChatMessage,
    ToolOutput,
    TypingIndicator,
} from "@/components/chat/chat-message"
import { ChatInput } from "@/components/chat/chat-input"
import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/components/auth-context"
import { Button } from "@/components/ui/button" // Import the Button component

type Msg =
    | { kind: "msg"; role: "user" | "assistant"; content: string }
    | { kind: "tool"; title: string; body: string }

// This component contains the entire chat UI
export function ChatView() {
    // Get the selected group and the function to deselect it from the auth context
    const { loggedIn, selectedGroup, selectGroup } = useAuth()
    const [messages, setMessages] = useState<Msg[]>([
        { kind: "msg", role: "assistant", content: `MCP Agent online. How can I assist you in ${selectedGroup?.name || 'this group'}?` },
        {
            kind: "tool",
            title: "Invoice Summary",
            body: "Last 30 days: 42 invoices · $184,220 total · 3 overdue.",
        },
    ])

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
        // Here you would call your AI/backend, but we'll use a mock for now
        setTimeout(() => {
            setMessages((prev) => [...prev, { kind: "msg", role: "assistant", content: "Acknowledged." }])
            setTyping(false)
        }, 900)
    }

    return (
        <section
            aria-labelledby="chat-title"
            className="relative flex h-[calc(100vh-120px)] flex-col rounded-md border border-neutral-800 bg-neutral-950/50"
        >
            <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
                {/* --- FIX: Display the group name and the Switch Group button --- */}
                <div className="flex items-center gap-4">
                    <h1 id="chat-title" className="text-pretty text-sm font-semibold">
                        {selectedGroup?.name || "Current Group"}
                    </h1>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => selectGroup(null)} // This takes the user back to the group list
                        className="border-neutral-700 text-xs text-neutral-300 hover:bg-neutral-800 bg-transparent"
                    >
                        Switch Group
                    </Button>
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-teal-500" aria-hidden="true" />
                    Online
                </div>
            </header>
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
                <div
                    ref={listRef}
                    className="flex-1 min-h-0 overflow-y-auto rounded-md border border-neutral-900 bg-black p-3"
                >
                    <div className="space-y-3">
                        {messages.map((m, i) => {
                            if (m.kind === "msg") return <ChatMessage key={i} role={m.role}>{m.content}</ChatMessage>;
                            if (m.kind === "tool") return <ToolOutput key={i} title={m.title}>{m.body}</ToolOutput>;
                            return null
                        })}
                        {loggedIn && typing ? <TypingIndicator className="mt-1" /> : null}
                    </div>
                </div>
                <div className={!loggedIn ? "pointer-events-none opacity-70 [filter:blur(1.5px)]" : ""}>
                    <ChatInput onSend={addUserText} />
                </div>
            </div>
        </section>
    )
}
