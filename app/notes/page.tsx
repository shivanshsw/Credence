"use client"

import AppShell from "@/components/app-shell"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Lock, Users } from "lucide-react"

type Note = {
  id: number
  title: string
  body: string
  sharedWith: string[]
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([
    { id: 1, title: "Policy Update - Draft", body: "Summarize key takeaways...", sharedWith: [] },
    { id: 2, title: "Incident Response EMEA", body: "Draft incident response steps...", sharedWith: ["@ananya"] },
  ])
  const [activeId, setActiveId] = useState<number>(notes[0]?.id ?? 1)
  const active = useMemo(() => notes.find((n) => n.id === activeId)!, [notes, activeId])

  function updateBody(v: string) {
    setNotes((prev) => prev.map((n) => (n.id === active.id ? { ...n, body: v } : n)))
  }

  function shareWith(user: string) {
    const u = user.trim()
    if (!u) return
    setNotes((prev) =>
      prev.map((n) => (n.id === active.id ? { ...n, sharedWith: Array.from(new Set([...n.sharedWith, u])) } : n)),
    )
  }

  function revoke(user: string) {
    setNotes((prev) =>
      prev.map((n) => (n.id === active.id ? { ...n, sharedWith: n.sharedWith.filter((x) => x !== user) } : n)),
    )
  }

  function newNote() {
    const id = Math.max(0, ...notes.map((n) => n.id)) + 1
    const nn: Note = { id, title: `New Note ${id}`, body: "", sharedWith: [] }
    setNotes((prev) => [nn, ...prev])
    setActiveId(id)
  }

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Notes list */}
        <section className="rounded-md border border-neutral-800 bg-neutral-950">
          <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
            <h1 className="text-sm font-semibold">Your Notes</h1>
            <Button onClick={newNote} className="bg-teal-600 text-black hover:bg-teal-500">
              New Note
            </Button>
          </header>
          <div className="p-2">
            <ul className="space-y-1">
              {notes.map((n) => {
                const shared = n.sharedWith.length > 0
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => setActiveId(n.id)}
                      className={
                        "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition " +
                        (n.id === activeId
                          ? "bg-neutral-900 text-neutral-100"
                          : "text-neutral-300 hover:bg-neutral-900 hover:text-neutral-100")
                      }
                      aria-current={n.id === activeId ? "true" : undefined}
                    >
                      <span className="truncate">{n.title}</span>
                      {shared ? (
                        <Users className="h-4 w-4 text-teal-400" />
                      ) : (
                        <Lock className="h-4 w-4 text-neutral-500" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        {/* Editor + Sharing */}
        <section className="lg:col-span-2 rounded-md border border-neutral-800 bg-neutral-950">
          <header className="border-b border-neutral-800 px-4 py-3">
            <h2 className="text-sm font-semibold">{active.title}</h2>
          </header>
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-neutral-800 text-xs text-neutral-300 hover:bg-neutral-900 bg-transparent"
                onClick={() => updateBody(active.body + "**bold** ")}
              >
                Bold
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-neutral-800 text-xs text-neutral-300 hover:bg-neutral-900 bg-transparent"
                onClick={() => updateBody(active.body + "_italic_ ")}
              >
                Italic
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-neutral-800 text-xs text-neutral-300 hover:bg-neutral-900 bg-transparent"
                onClick={() => updateBody(active.body + "- bullet\n")}
              >
                Bullet
              </Button>
            </div>
            <Textarea
              value={active.body}
              onChange={(e) => updateBody(e.target.value)}
              placeholder="Write your note…"
              className="min-h-64 border-neutral-800 bg-black text-sm focus-visible:ring-cyan-400"
              aria-label="Note editor"
            />

            <Card className="border-neutral-800 bg-black">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Share Note</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Type @username"
                    className="h-8 border-neutral-800 bg-neutral-950 text-xs focus-visible:ring-cyan-400"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        const v = (e.target as HTMLInputElement).value
                        shareWith(v)
                        ;(e.target as HTMLInputElement).value = ""
                      }
                    }}
                    aria-label="Share with user"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-neutral-800 text-[11px] text-neutral-300 hover:bg-neutral-900 bg-transparent"
                    onClick={() => {
                      const el = document.querySelector<HTMLInputElement>('input[aria-label="Share with user"]')
                      if (el && el.value.trim()) {
                        shareWith(el.value)
                        el.value = ""
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                {active.sharedWith.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {active.sharedWith.map((u) => (
                      <span key={u} className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-2 py-1">
                        <span className="text-neutral-300">{u}</span>
                        <button
                          className="text-xs text-cyan-400 hover:underline"
                          onClick={() => revoke(u)}
                          aria-label={`Revoke ${u}`}
                        >
                          revoke
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-neutral-500">Not shared.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
