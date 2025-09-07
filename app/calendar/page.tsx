"use client"

import AppShell from "@/components/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { CheckSquare, Clock } from "lucide-react"
import { useAuth } from "@/components/auth-context"

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default function CalendarPage() {
  const [view, setView] = useState<"Month" | "Week" | "Day">("Month")
  const { selectedGroupId } = useAuth()
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [gcalConnected, setGcalConnected] = useState<boolean | null>(null)

  useEffect(() => {
    fetchTasks()
    checkGoogleCalendar()
  }, [selectedGroupId])

  async function fetchTasks() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedGroupId) params.set('groupId', selectedGroupId)
      if (showAll) params.set('scope', 'all')
      const qs = params.toString() ? `?${params.toString()}` : ''
      const res = await fetch(`/api/tasks${qs}`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setTasks(Array.isArray(data) ? data : [])
      // If we successfully fetched with scope=all, mark admin
      if (showAll) setIsAdmin(true)
    } finally {
      setLoading(false)
    }
  }

  // Probe admin capability once
  useEffect(() => {
    const probe = async () => {
      try {
        const res = await fetch('/api/tasks?scope=all', { credentials: 'include' })
        setIsAdmin(res.ok)
      } catch {
        setIsAdmin(false)
      }
    }
    probe()
  }, [])

  async function checkGoogleCalendar() {
    try {
      const res = await fetch('/api/google-calendar/auth', { credentials: 'include' })
      if (!res.ok) {
        setGcalConnected(false)
        return
      }
      const data = await res.json()
      setGcalConnected(!!data.connected)
      if (!data.connected && data.authorizeUrl) {
        // Optionally redirect user to connect page
      }
    } catch {
      setGcalConnected(false)
    }
  }

  async function connectGoogleCalendar() {
    await checkGoogleCalendar()
  }

  const ordered = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aTime = a.dueDate ? Date.parse(a.dueDate) : Date.parse(a.createdAt)
      const bTime = b.dueDate ? Date.parse(b.dueDate) : Date.parse(b.createdAt)
      return bTime - aTime
    })
  }, [tasks])

  async function markDone(taskId: string, next: boolean) {
    const res = await fetch('/api/tasks/complete', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ task_id: taskId, is_completed: next })
    })
    if (res.ok) fetchTasks()
  }

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-md border border-neutral-800 bg-neutral-950">
          <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
            <h1 className="text-sm font-semibold">Your Schedule</h1>
            <div className="inline-flex gap-2">
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowAll(s => !s); fetchTasks() }}
                  className={showAll ? "border-cyan-600/40 bg-cyan-900/20 text-cyan-200" : "border-neutral-800 text-neutral-300 hover:bg-neutral-900"}
                  title="Toggle view all users' tasks"
                >
                  {showAll ? 'Showing All Tasks' : 'Show All Tasks'}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={connectGoogleCalendar}
                className={gcalConnected ? "border-green-600/40 bg-green-900/20 text-green-200" : "border-neutral-800 text-neutral-300 hover:bg-neutral-900"}
                title={gcalConnected ? "Connected to Google Calendar" : "Connect to Google Calendar"}
              >
                {gcalConnected ? 'Google Calendar Connected' : 'Connect Google Calendar'}
              </Button>
              {(["Month", "Week", "Day"] as const).map((v) => (
                <Button
                  key={v}
                  variant="outline"
                  size="sm"
                  onClick={() => setView(v)}
                  className={
                    view === v
                      ? "border-teal-500/40 bg-teal-500/10 text-teal-100"
                      : "border-neutral-800 text-neutral-300 hover:bg-neutral-900"
                  }
                >
                  {v}
                </Button>
              ))}
            </div>
          </header>
          <div className="p-4">
            {/* Month grid for demo */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs text-neutral-400">
              {days.map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <div
                  key={i}
                  className="group aspect-square rounded-md border border-neutral-800 bg-black p-1 text-xs text-neutral-400 transition hover:bg-neutral-900"
                >
                  <span className="inline-block rounded-sm bg-neutral-900 px-1">{i + 1}</span>
                  {i % 5 === 0 && (
                    <div className="mt-1 h-1.5 w-1.5 rounded-full bg-teal-500/80 shadow-[0_0_6px_theme(colors.teal.500/60)]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-md border border-neutral-800 bg-neutral-950">
          <header className="border-b border-neutral-800 px-4 py-3">
            <h2 className="text-sm font-semibold">Upcoming Events & Tasks</h2>
          </header>
          <div className="p-4 space-y-3">
            {loading && <p className="text-xs text-neutral-500">Loading...</p>}
            {!loading && ordered.map((t) => (
              <Card key={t.id} className="border-neutral-800 bg-black transition data-[done=true]:opacity-50" data-done={t.status === 'completed'}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span>{t.title}</span>
                    <Badge variant="outline" className="text-[10px]">{t.groupName || 'Group'}</Badge>
                  </CardTitle>
                  {t.status === 'completed' ? (
                    <CheckSquare className="h-4 w-4 text-teal-400" />
                  ) : (
                    <Clock className="h-4 w-4 text-cyan-400" />
                  )}
                </CardHeader>
                <CardContent className="flex items-center justify-between text-xs text-neutral-400">
                  <span>{t.dueDate ? new Date(t.dueDate).toLocaleString() : new Date(t.createdAt).toLocaleString()}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-neutral-800 text-[11px] text-neutral-300 hover:bg-neutral-900 bg-transparent"
                    onClick={() => markDone(t.id, t.status !== 'completed')}
                  >
                    {t.status === 'completed' ? 'Mark pending' : 'Mark done'}
                  </Button>
                </CardContent>
              </Card>
            ))}
            {!loading && ordered.length === 0 && (
              <p className="py-8 text-center text-xs text-neutral-500">Nothing upcoming.</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
