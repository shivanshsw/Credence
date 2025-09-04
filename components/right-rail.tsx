"use client"

import { useEffect, useState } from "react"
import { CreditCard, AlertCircle, Cloud, Clock } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import InvitesPanel from "@/components/invites/invites-panel" // Import the new component

function DigitalClock() {
    const [time, setTime] = useState("")
    const [date, setDate] = useState("")

    useEffect(() => {
        const timerId = setInterval(() => {
            const now = new Date()
            setTime(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }))
            setDate(now.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Kolkata" }))
        }, 1000)
        return () => clearInterval(timerId)
    }, [])

    if (!time) {
        return (
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4 shadow">
                <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-cyan-400" />
                    <div className="h-5 w-20 animate-pulse rounded-md bg-neutral-800" />
                </div>
                <div className="mt-1 h-4 w-28 animate-pulse rounded-md bg-neutral-800" />
            </div>
        )
    }

    return (
        <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4 shadow">
            <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-cyan-400" aria-hidden="true" />
                <div className="text-sm font-semibold tracking-wide text-neutral-100">{time}</div>
            </div>
            <div className="mt-1 text-xs text-neutral-400">{date}</div>
        </div>
    )
}

function Weather() {
    const [weather, setWeather] = useState<{ temp: number; city: string; desc: string } | null>(null)

    useEffect(() => {
        const mockFetchWeather = () => {
            setTimeout(() => {
                setWeather({ temp: 28, city: "Delhi", desc: "Clear" })
            }, 1500)
        }
        mockFetchWeather()
    }, [])

    if (!weather) {
        return (
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4 shadow">
                <div className="flex items-center gap-3">
                    <Cloud className="h-5 w-5 text-teal-400" />
                    <div className="h-5 w-24 animate-pulse rounded-md bg-neutral-800" />
                </div>
                <div className="mt-1 h-4 w-16 animate-pulse rounded-md bg-neutral-800" />
            </div>
        )
    }

    return (
        <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4 shadow">
            <div className="flex items-center gap-3">
                <Cloud className="h-5 w-5 text-teal-400" aria-hidden="true" />
                <div className="text-sm font-medium">{weather.temp}°C, {weather.city}</div>
            </div>
            <div className="mt-1 text-xs text-neutral-400">{weather.desc}</div>
        </div>
    )
}

type Note = { id: number; icon: "payment" | "alert"; title: string; desc: string; ts: string }

const seed: Note[] = [
    { id: 1, icon: "payment", title: "PAYMENT RECEIVED", desc: "Stripe payment for XYZ processed.", ts: "1 hr ago" },
    { id: 2, icon: "alert", title: "SYSTEM UPDATE", desc: "Policy update deployed to prod.", ts: "2 hrs ago" },
    { id: 3, icon: "payment", title: "INVOICE SENT", desc: "Invoice #1042 delivered to ACME.", ts: "5 hrs ago" },
]

export default function RightRail({ onClearAll }: { onClearAll?: () => void }) {
    const [notes, setNotes] = useState<Note[]>(seed)
    function clearAll() {
        setNotes([])
        onClearAll?.()
    }

    return (
        <div className="flex h-full flex-col">
            <div className="px-4 py-4">
                <div className="grid grid-cols-1 gap-3">
                    <DigitalClock />
                    <Weather />
                </div>
            </div>

            <Separator className="bg-neutral-800" />

            {/* Add the Invites Panel */}
            <div className="px-4 py-3">
                <InvitesPanel />
            </div>

            <Separator className="bg-neutral-800" />

            <div className="flex h-0 min-h-0 flex-1 flex-col">
                <div className="flex items-center justify-between px-4 py-3">
                    <h2 className="text-sm font-semibold tracking-wide">NOTIFICATIONS</h2>
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-neutral-800 text-xs text-neutral-300 hover:bg-neutral-900 bg-transparent"
                        onClick={clearAll}
                    >
                        CLEAR ALL
                    </Button>
                </div>
                <ScrollArea className="h-[calc(100vh-500px)] px-4">
                    <ul className="space-y-2">
                        {notes.map((n) => (
                            <li
                                key={n.id}
                                className="group rounded-md border border-neutral-800 bg-neutral-950 p-3 transition hover:bg-neutral-900"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5">
                                        {n.icon === "payment" ? (
                                            <CreditCard className="h-4 w-4 text-teal-400" aria-hidden="true" />
                                        ) : (
                                            <AlertCircle className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium">{n.title}</p>
                                            <Badge variant="outline" className="border-neutral-800 text-[10px] text-neutral-400">
                                                {n.ts}
                                            </Badge>
                                        </div>
                                        <p className="mt-1 text-xs text-neutral-400">{n.desc}</p>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                    {notes.length > 0 ? (
                        <div className="mt-3 text-right">
                            <a href="#" className="text-xs text-teal-400 hover:underline">
                                SHOW ALL
                            </a>
                        </div>
                    ) : (
                        <p className="mt-6 text-center text-xs text-neutral-500">All caught up.</p>
                    )}
                </ScrollArea>
            </div>
        </div>
    )
}