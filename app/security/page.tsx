"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Shield, KeyRound, Fingerprint, History, Check, X, LinkIcon } from "lucide-react"

type AccessRequest = {
  id: string
  requester: string
  tool: string
  status: "pending" | "approved" | "denied"
  requestedAt: string
}

const mockRequests: AccessRequest[] = [
  { id: "req-1", requester: "Ananya", tool: "Financial Analytics", status: "pending", requestedAt: "2025-08-27 10:14" },
  { id: "req-2", requester: "Dev", tool: "Cashflow Analyzer", status: "pending", requestedAt: "2025-08-26 15:03" },
]

const auditLog = [
  {
    id: "log-current",
    action: "User signed in",
    user: "Current User",
    ts: new Date().toLocaleString(),
  },
  ...Array.from({ length: 20 }).map((_, i) => ({
    id: `log-${i}`,
    action: i % 5 === 0 ? "Permission changed" : i % 3 === 0 ? "2FA verified" : "Login successful",
    user: i % 4 === 0 ? "Kranson" : i % 2 === 0 ? "Ananya" : "Rahul",
    ts: `2025-08-${(20 + (i % 10)).toString().padStart(2, "0")} ${String(9 + (i % 9)).padStart(2, "0")}:${String(10 + (i % 50)).padStart(2, "0")}`,
  }))
]

export default function SecurityPage() {
  const [requests, setRequests] = useState<AccessRequest[]>(mockRequests)

  function updateRequest(id: string, status: "approved" | "denied") {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  return (
    <main className="h-full w-full overflow-hidden">
      <div className="h-full flex flex-col gap-6 p-6 overflow-y-auto scrollbar-hide">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-balance">Security</h1>
          <Badge variant="outline" className="border-teal-500 text-teal-400">
            Secure
          </Badge>
        </div>

        {/* Authentication */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-400" />
              Authentication
            </CardTitle>
            <Badge className="bg-green-600/30 text-green-300 border border-green-600/40">2FA Enabled</Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-md border border-border/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 text-teal-400" />
                    <span className="font-medium">Two-Factor Auth (TOTP)</span>
                  </div>
                  <Button variant="outline" size="sm">
                    Set Up 2FA
                  </Button>
                </div>
                <Separator className="my-3" />
                <div className="flex items-center gap-4">
                  <div className="h-24 w-24 rounded-md bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                    QR CODE
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Scan with your authenticator app and enter the 6‑digit code.
                    </div>
                    <div className="flex items-center gap-2">
                      <Input placeholder="Enter 6‑digit code" className="max-w-[180px]" />
                      <Button size="sm">Verify</Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-teal-400" />
                    <span className="font-medium">SSO Status</span>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                    <LinkIcon className="h-4 w-4" /> Re‑link
                  </Button>
                </div>
                <Separator className="my-3" />
                <div className="text-sm text-muted-foreground">Connected to Google Workspace</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Access & Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-400" />
              Access &amp; Permissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-md border border-border/40 p-4">
                <div className="text-sm text-muted-foreground mb-1">Role</div>
                <div className="text-base font-medium">Finance Manager</div>
              </div>
              <div className="rounded-md border border-border/40 p-4 md:col-span-2">
                <div className="text-sm text-muted-foreground mb-2">Scopes</div>
                <ul className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <li className="flex items-center justify-between rounded-md bg-muted/20 px-3 py-2">
                    <span>uploadInvoice</span>
                    <Badge variant="outline" className="border-teal-500 text-teal-400">
                      true
                    </Badge>
                  </li>
                  <li className="flex items-center justify-between rounded-md bg-muted/20 px-3 py-2">
                    <span>generateCashflowReport</span>
                    <Badge variant="outline" className="border-teal-500 text-teal-400">
                      true
                    </Badge>
                  </li>
                  <li className="flex items-center justify-between rounded-md bg-muted/20 px-3 py-2">
                    <span>viewAR</span>
                    <Badge variant="outline">false</Badge>
                  </li>
                  <li className="flex items-center justify-between rounded-md bg-muted/20 px-3 py-2">
                    <span>approvePayments</span>
                    <Badge variant="outline">false</Badge>
                  </li>
                </ul>
              </div>
            </div>

            {/* Pending Requests anchor for deep-linking */}
            <div id="pending-requests" className="rounded-md border border-border/40">
              <div className="flex items-center justify-between p-4">
                <div className="font-medium">Pending Access Requests</div>
                <Badge variant="outline">{requests.filter((r) => r.status === "pending").length} pending</Badge>
              </div>
              <Separator />
              <div className="max-h-64 overflow-y-auto scrollbar-hide divide-y divide-border/40">
                {requests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-4 gap-4">
                    <div className="min-w-0">
                      <div className="text-sm">
                        <span className="font-medium">{req.requester}</span> requested access to{" "}
                        <span className="font-medium">{req.tool}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{req.requestedAt}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          req.status === "pending"
                            ? ""
                            : req.status === "approved"
                              ? "border-green-600/50 text-green-300"
                              : "border-red-600/50 text-red-300"
                        }
                      >
                        {req.status}
                      </Badge>
                      {req.status === "pending" ? (
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="gap-1" onClick={() => updateRequest(req.id, "approved")}>
                            <Check className="h-4 w-4" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 bg-transparent"
                            onClick={() => updateRequest(req.id, "denied")}
                          >
                            <X className="h-4 w-4" /> Deny
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audit Log */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-teal-400" />
              Audit Log
            </CardTitle>
            <Button variant="outline" size="sm">
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-y-auto scrollbar-hide divide-y divide-border/40">
              {/* Default logged in entry - highlighted */}
              <div className="flex items-center justify-between py-3 bg-teal-500/10 border-l-4 border-teal-500 pl-3 -ml-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-6 w-6 rounded-full bg-teal-500/20 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-teal-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-teal-300">User signed in</div>
                    <div className="text-xs text-teal-400">
                      Current User • {new Date().toLocaleString()}
                    </div>
                  </div>
                </div>
                <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30">Active</Badge>
              </div>
              {auditLog.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-6 w-6 rounded-full bg-muted/30 flex items-center justify-center">
                      <Shield className="h-4 w-4 text-teal-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm truncate">{item.action}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.user} • {item.ts}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline">OK</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
