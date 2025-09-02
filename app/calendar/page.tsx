"use client"

import AppShell from "@/components/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { CheckSquare, Clock } from "lucide-react"

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default function CalendarPage() {
  const [view, setView] = useState<"Month" | "Week" | "Day">("Month")
  const [upcoming, setUpcoming] = useState([
    { id: 1, type: "meeting" as const, title: "Quarterly Review", time: "Tue 10:00" },
    { id: 2, type: "task" as const, title: "Prepare Cashflow Report", time: "Wed 15:00" },
    { id: 3, type: "meeting" as const, title: "MFA Rollout Sync", time: "Thu 14:30" },
  ])

  function complete(id: number) {
    setUpcoming((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-md border border-neutral-800 bg-neutral-950">
          <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
            <h1 className="text-sm font-semibold">Your Schedule</h1>
            <div className="inline-flex gap-2">
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
            {upcoming.map((u) => (
              <Card key={u.id} className="border-neutral-800 bg-black transition data-[done=true]:opacity-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">{u.title}</CardTitle>
                  {u.type === "meeting" ? (
                    <Clock className="h-4 w-4 text-cyan-400" />
                  ) : (
                    <CheckSquare className="h-4 w-4 text-teal-400" />
                  )}
                </CardHeader>
                <CardContent className="flex items-center justify-between text-xs text-neutral-400">
                  <span>{u.time}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-neutral-800 text-[11px] text-neutral-300 hover:bg-neutral-900 bg-transparent"
                    onClick={() => complete(u.id)}
                  >
                    Mark done
                  </Button>
                </CardContent>
              </Card>
            ))}
            {upcoming.length === 0 && <p className="py-8 text-center text-xs text-neutral-500">Nothing upcoming.</p>}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
