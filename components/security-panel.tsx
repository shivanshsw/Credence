"use client"

import Link from "next/link"

export default function SecurityPanel() {
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
          {/* Authentication */}
          <div className="rounded-lg border border-white/10 bg-neutral-950 p-4">
            <h2 className="mb-2 text-sm font-medium text-neutral-200">Authentication</h2>
            <div className="space-y-3 text-sm text-neutral-400">
              <div className="flex items-center justify-between">
                <span>Password</span>
                <button className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5">Change</button>
              </div>
              <div className="flex items-center justify-between">
                <span>Two‑Factor Auth</span>
                <span className="rounded-md border border-emerald-500/30 px-2 py-1 text-xs text-emerald-400">
                  Enabled
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>SSO</span>
                <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-neutral-400">Not linked</span>
              </div>
            </div>
          </div>

          {/* Devices & Sessions */}
          <div className="rounded-lg border border-white/10 bg-neutral-950 p-4">
            <h2 className="mb-2 text-sm font-medium text-neutral-200">Devices & Sessions</h2>
            <div className="space-y-2 text-sm text-neutral-400">
              {[
                { title: "macOS · Chrome", meta: "SF, USA · Last seen 2m ago" },
                { title: "iOS App", meta: "NY, USA · Last seen 3h ago" },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2">
                  <div>
                    <div className="text-neutral-200">{s.title}</div>
                    <div className="text-xs text-neutral-500">{s.meta}</div>
                  </div>
                  <button className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5">
                    Sign out
                  </button>
                </div>
              ))}
              <button className="mt-2 w-full rounded-md border border-white/10 px-3 py-2 text-xs text-neutral-300 hover:bg-white/5">
                Sign out all sessions
              </button>
            </div>
          </div>

          {/* Access & Permissions */}
          <div id="pending-requests" className="rounded-lg border border-white/10 bg-neutral-950 p-4">
            <h2 className="mb-2 text-sm font-medium text-neutral-200">Access & Permissions</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2">
                <div className="text-neutral-400">
                  Role: <span className="text-neutral-200">Finance Manager</span>
                </div>
                <span className="rounded-md border border-teal-500/30 px-2 py-1 text-xs text-teal-400">
                  Scopes: read, approve
                </span>
              </div>
              <div className="rounded-md border border-white/10">
                <div className="border-b border-white/10 px-3 py-2 text-xs text-neutral-400">Pending Requests</div>
                <div className="divide-y divide-white/10">
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="text-sm text-neutral-300">
                      Cashflow Analyzer — Request write access
                      <div className="text-xs text-neutral-500">Requested by: You · 2m ago</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5">
                        Deny
                      </button>
                      <button className="rounded-md border border-emerald-500/30 px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-500/10">
                        Approve
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <Link
                href="/?view=security#audit-log"
                className="text-xs text-teal-400 underline decoration-teal-500/30 underline-offset-2"
              >
                View approval history in Audit Log
              </Link>
            </div>
          </div>

          {/* Audit Log */}
          <div id="audit-log" className="rounded-lg border border-white/10 bg-neutral-950 p-4">
            <h2 className="mb-2 text-sm font-medium text-neutral-200">Audit Log</h2>
            <div className="max-h-64 overflow-y-auto rounded-md border border-white/10">
              <ul className="divide-y divide-white/10 text-sm">
                {[
                  "Login successful · 10:21",
                  "2FA verified · 10:21",
                  "Permission requested: Cashflow Analyzer write · 10:23",
                  "Notification viewed · 10:24",
                ].map((item, i) => (
                  <li key={i} className="px-3 py-2 text-neutral-400">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
