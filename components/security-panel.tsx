"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

export default function SecurityPanel() {
  const [access, setAccess] = useState<Array<{ id: string; name: string; role: string }>>([])
  const [audit, setAudit] = useState<Array<{ id: string; event_type: string; created_at: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [a, l] = await Promise.all([
          fetch('/api/security/access', { credentials: 'include' }),
          fetch('/api/security/audit', { credentials: 'include' })
        ])
        if (a.ok) {
          const j = await a.json()
          setAccess(j.data || [])
        }
        if (l.ok) {
          const j = await l.json()
          setAudit(j.data || [])
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])
  return (
    <section
      aria-labelledby="security-title"
      className="relative flex h-[calc(100vh-120px)] flex-col rounded-md border border-neutral-800 bg-neutral-950/50"
    >
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <h1 id="security-title" className="text-pretty text-sm font-semibold">
          Security
        </h1>
        <span className="rounded-full border border-teal-500/40 px-3 py-1 text-xs text-teal-400">Status: Good</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto rounded-md border border-neutral-900 bg-black p-3 lg:grid-cols-2">
          {/* Access & Permissions */}
          <div id="pending-requests" className="rounded-lg border border-white/10 bg-neutral-950 p-4">
            <h2 className="mb-2 text-sm font-medium text-neutral-200">Access & Permissions</h2>
            <div className="space-y-3 text-sm">
              {loading && <div className="text-xs text-neutral-500">Loading...</div>}
              {!loading && access.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2">
                  <div className="text-neutral-200">{g.name}</div>
                  <div className="text-xs text-neutral-400">Role: <span className="text-neutral-200">{g.role}</span></div>
                </div>
              ))}
              {!loading && access.length === 0 && (
                <div className="text-xs text-neutral-500">No groups.</div>
              )}
            </div>
          </div>

          {/* Audit Log */}
          <div id="audit-log" className="rounded-lg border border-white/10 bg-neutral-950 p-4">
            <h2 className="mb-2 text-sm font-medium text-neutral-200">Audit Log</h2>
            <div className="max-h-64 overflow-y-auto rounded-md border border-white/10">
              <ul className="divide-y divide-white/10 text-sm">
                {audit.map((item) => (
                  <li key={item.id} className="px-3 py-2 text-neutral-400">
                    {item.event_type} · {new Date(item.created_at).toLocaleString()}
                  </li>
                ))}
                {audit.length === 0 && (
                  <li className="px-3 py-2 text-neutral-500 text-xs">No logs.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
