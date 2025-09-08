"use client"

import React from "react"
import AppShell from "@/components/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { CheckSquare, Clock, Calendar } from "lucide-react"
import { useAuth } from "@/components/auth-context"
import { LoadingSpinner, LoadingDots } from "@/components/ui/loading-spinner"

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default function CalendarPage() {
  const [view, setView] = useState<"Month" | "Week" | "Day">("Month")
  const { selectedGroupId } = useAuth()
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  useEffect(() => {
    fetchTasks()
  }, [selectedGroupId])

  async function fetchTasks() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedGroupId) params.set('groupId', selectedGroupId)
      if (showAll && isAdmin) params.set('scope', 'all')
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

  // Light admin probe without triggering 403 noise
  useEffect(() => {
    const probe = async () => {
      try {
        const res = await fetch('/api/security/access', { credentials: 'include' })
        setIsAdmin(!!res.ok)
      } catch {
        setIsAdmin(false)
      }
    }
    probe()
  }, [])

  // Remove Google Calendar integration

  const ordered = useMemo(() => {
    const ranked = [...tasks]
    ranked.sort((a: any, b: any) => {
      const ar = (a.status === 'completed' || a.status === 'cancelled') ? 1 : 0
      const br = (b.status === 'completed' || b.status === 'cancelled') ? 1 : 0
      if (ar !== br) return ar - br
      const aTime = a.dueDate ? Date.parse(a.dueDate) : Date.parse(a.createdAt)
      const bTime = b.dueDate ? Date.parse(b.dueDate) : Date.parse(b.createdAt)
      return bTime - aTime
    })
    return ranked
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
        <section className="lg:col-span-2 rounded-lg border border-neutral-800 bg-gradient-to-br from-neutral-950 to-neutral-900 shadow-lg">
          <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20">
                <Calendar className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">
                  {(() => {
                    const now = new Date()
                    return now.toLocaleString(undefined, { month: 'long', year: 'numeric' })
                  })()}
                </h1>
                <p className="text-sm text-neutral-400">Manage your schedule and tasks</p>
              </div>
            </div>
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
            {/* Month grid */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs text-neutral-400">
              {days.map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            {(() => {
              const now = new Date()
              const year = now.getFullYear()
              const month = now.getMonth()
              const firstDay = new Date(year, month, 1)
              const startWeekday = firstDay.getDay()
              const daysInMonth = new Date(year, month + 1, 0).getDate()
              const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7

              const byDateKey = new Map<string, { dueCount: number, createdCount: number, totalCount: number }>()
              
              for (const t of tasks) {
                // Process due date
                if (t.dueDate) {
                  const dueDate = new Date(t.dueDate)
                  if (dueDate && !isNaN(dueDate.getTime()) && dueDate.getMonth() === month && dueDate.getFullYear() === year) {
                    const dueYear = dueDate.getFullYear()
                    const dueMonthStr = String(dueDate.getMonth() + 1).padStart(2, '0')
                    const dueDayStr = String(dueDate.getDate()).padStart(2, '0')
                    const dueKey = `${dueYear}-${dueMonthStr}-${dueDayStr}`
                    
                    const existing = byDateKey.get(dueKey) || { dueCount: 0, createdCount: 0, totalCount: 0 }
                    existing.dueCount += 1
                    existing.totalCount += 1
                    byDateKey.set(dueKey, existing)
                    
                    console.log('Calendar: Due date processed', {
                      taskTitle: t.title,
                      dueDate: t.dueDate,
                      dueKey: dueKey,
                      month: month,
                      year: year
                    })
                  }
                }
                
                // Process creation date
                if (t.createdAt) {
                  const createdDate = new Date(t.createdAt)
                  if (createdDate && !isNaN(createdDate.getTime()) && createdDate.getMonth() === month && createdDate.getFullYear() === year) {
                    const createdYear = createdDate.getFullYear()
                    const createdMonthStr = String(createdDate.getMonth() + 1).padStart(2, '0')
                    const createdDayStr = String(createdDate.getDate()).padStart(2, '0')
                    const createdKey = `${createdYear}-${createdMonthStr}-${createdDayStr}`
                    
                    const existing = byDateKey.get(createdKey) || { dueCount: 0, createdCount: 0, totalCount: 0 }
                    existing.createdCount += 1
                    existing.totalCount += 1
                    byDateKey.set(createdKey, existing)
                    
                    console.log('Calendar: Created date processed', {
                      taskTitle: t.title,
                      createdAt: t.createdAt,
                      createdKey: createdKey,
                      month: month,
                      year: year
                    })
                  }
                }
              }
              
              console.log('Calendar: Final byDateKey map', Array.from(byDateKey.entries()))

              const cells = [] as React.ReactElement[]
              for (let i = 0; i < totalCells; i++) {
                const dayNum = i - startWeekday + 1
                const inMonth = dayNum >= 1 && dayNum <= daysInMonth
                const cellDate = inMonth ? new Date(year, month, dayNum) : null
                
                // Create consistent date key for cell
                let key = ''
                if (cellDate) {
                  const cellYear = cellDate.getFullYear()
                  const cellMonthStr = String(cellDate.getMonth() + 1).padStart(2, '0')
                  const cellDayStr = String(cellDate.getDate()).padStart(2, '0')
                  key = `${cellYear}-${cellMonthStr}-${cellDayStr}`
                }
                
                const dateInfo = key ? byDateKey.get(key) : null
                const hasTasks = dateInfo && dateInfo.totalCount > 0
                const hasBothDueAndCreated = dateInfo && dateInfo.dueCount > 0 && dateInfo.createdCount > 0
                
                if (hasTasks) {
                  console.log('Calendar: Cell has tasks', {
                    dayNum,
                    key,
                    dateInfo,
                    hasBothDueAndCreated
                  })
                }
                
                cells.push(
                  <div
                    key={i}
                    className={`group aspect-square rounded-md border border-neutral-800 p-1 text-xs transition ${inMonth ? 'bg-black text-neutral-400 hover:bg-neutral-900 cursor-pointer' : 'bg-neutral-950 text-neutral-700'}`}
                    onClick={() => inMonth && setSelectedDate(cellDate)}
                    aria-hidden={!inMonth}
                  >
                    <span className="inline-block rounded-sm bg-neutral-900 px-1">{inMonth ? dayNum : ''}</span>
                    {hasTasks && (
                      <div className="mt-1 flex justify-center gap-0.5">
                        {dateInfo.dueCount > 0 && (
                          <div 
                            className={`rounded-full bg-green-500/80 shadow-[0_0_6px_theme(colors.green.500/60)] ${hasBothDueAndCreated ? 'h-2 w-2' : 'h-1.5 w-1.5'}`}
                            title={`${dateInfo.dueCount} task(s) due on this date`}
                          />
                        )}
                        {dateInfo.createdCount > 0 && (
                          <div 
                            className={`rounded-full bg-blue-500/80 shadow-[0_0_6px_theme(colors.blue.500/60)] ${hasBothDueAndCreated ? 'h-2 w-2' : 'h-1.5 w-1.5'}`}
                            title={`${dateInfo.createdCount} task(s) created on this date`}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )
              }
              return <div className="mt-2 grid grid-cols-7 gap-2">{cells}</div>
            })()}
          </div>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-gradient-to-br from-neutral-950 to-neutral-900 shadow-lg">
          <header className="border-b border-neutral-800 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <CheckSquare className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {selectedDate ? `Tasks on ${selectedDate.toLocaleDateString()}` : 'Upcoming Events & Tasks'}
                  </h2>
                  <p className="text-sm text-neutral-400">Track your progress and deadlines</p>
                </div>
              </div>
              {selectedDate && (
                <Button variant="outline" size="sm" onClick={() => setSelectedDate(null)} className="border-neutral-800">
                  ✕
                </Button>
              )}
            </div>
          </header>
          <div className="p-4 space-y-3">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="flex flex-col items-center space-y-2">
                  <LoadingDots />
                  <p className="text-xs text-neutral-500">Loading tasks...</p>
                </div>
              </div>
            )}
            {!loading && (selectedDate ? ordered.filter(t => {
              const selectedYear = selectedDate.getFullYear()
              const selectedMonth = selectedDate.getMonth()
              const selectedDay = selectedDate.getDate()
              
              // Check if task is due on selected date
              if (t.dueDate) {
                const dueDate = new Date(t.dueDate)
                if (dueDate && !isNaN(dueDate.getTime())) {
                  const dueYear = dueDate.getFullYear()
                  const dueMonth = dueDate.getMonth()
                  const dueDay = dueDate.getDate()
                  
                  if (dueYear === selectedYear && dueMonth === selectedMonth && dueDay === selectedDay) {
                    return true
                  }
                }
              }
              
              // Check if task was created on selected date
              if (t.createdAt) {
                const createdDate = new Date(t.createdAt)
                if (createdDate && !isNaN(createdDate.getTime())) {
                  const createdYear = createdDate.getFullYear()
                  const createdMonth = createdDate.getMonth()
                  const createdDay = createdDate.getDate()
                  
                  if (createdYear === selectedYear && createdMonth === selectedMonth && createdDay === selectedDay) {
                    return true
                  }
                }
              }
              
              return false
            }) : ordered).map((t) => (
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
                  <div className="flex flex-col gap-1">
                    {t.dueDate && (
                      <span className="text-green-400 font-semibold">📅 Due: {new Date(t.dueDate).toLocaleDateString()}</span>
                    )}
                    <span className="text-blue-400">📝 Created: {new Date(t.createdAt).toLocaleDateString()}</span>
                  </div>
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
