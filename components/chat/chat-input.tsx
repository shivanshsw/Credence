"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

export function ChatInput({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("")
  const suggestions = useMemo(() => {
    const t = text.toLowerCase()
    const out: string[] = []
    if (t.includes("assign")) out.push("assign task to Ananya", "set deadline", "set priority high")
    if (t.startsWith("invoice")) out.push("invoice status ACME", "invoice summary last 30 days")
    if (t.includes("access")) out.push("request access for cashflow", "notify manager")
    return out.slice(0, 3)
  }, [text])

  function send() {
    if (!text.trim()) return
    onSend(text.trim())
    setText("")
  }

  return (
    <div className="space-y-2">
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {suggestions.map((s, i) => (
            <Badge
              key={i}
              variant="outline"
              className="cursor-pointer border-neutral-800 text-[11px] text-neutral-300 hover:bg-neutral-900"
              onClick={() => setText(s)}
            >
              {s}
            </Badge>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-black p-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your command or question..."
          className="border-none bg-transparent text-sm placeholder:text-neutral-500 focus-visible:ring-cyan-400"
          aria-label="Message input"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <Button onClick={send} disabled={!text.trim()} className="bg-teal-600 text-black hover:bg-teal-500">
          Send
        </Button>
      </div>
    </div>
  )
}
