"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Mail, Users, Check, X, Clock } from "lucide-react"
import { useAuth } from "@/components/auth-context"

export default function InvitesPanel() {
    const { invites, fetchInvites, acceptInvite } = useAuth()
    const [processing, setProcessing] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    const handleInvite = async (inviteId: string, action: "accept" | "decline") => {
        try {
            setProcessing(inviteId)

            if (action === "accept") {
                await acceptInvite(inviteId)
            } else {
                const res = await fetch(`/api/invites/${inviteId}/decline`, {
                    method: "PATCH",
                    credentials: "include",
                })
                if (!res.ok) {
                    throw new Error("Failed to decline invite")
                }
                // Refresh invites after decline
                await fetchInvites()
            }
        } catch (err) {
            console.error(`Failed to ${action} invite:`, err)
        } finally {
            setProcessing(null)
        }
    }

    const handleRefresh = async () => {
        setIsLoading(true)
        await fetchInvites()
        setIsLoading(false)
    }

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString)
            const now = new Date()
            const diffMs = now.getTime() - date.getTime()
            const diffMins = Math.floor(diffMs / (1000 * 60))
            const diffHours = Math.floor(diffMins / 60)
            const diffDays = Math.floor(diffHours / 24)

            if (diffMins < 1) return "just now"
            if (diffMins < 60) return `${diffMins}m ago`
            if (diffHours < 24) return `${diffHours}h ago`
            if (diffDays < 7) return `${diffDays}d ago`
            return date.toLocaleDateString()
        } catch {
            return "recently"
        }
    }

    return (
        <Card className="border-neutral-800 bg-neutral-950">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-teal-400" />
                        Invitations
                    </CardTitle>
                    {invites.length > 0 && (
                        <Badge variant="outline" className="border-teal-500/40 text-teal-400">
                            {invites.length}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {invites.length === 0 ? (
                    <div className="py-8 text-center">
                        <Users className="mx-auto h-8 w-8 text-neutral-600" />
                        <p className="mt-2 text-xs text-neutral-500">No pending invitations</p>
                    </div>
                ) : (
                    <ScrollArea className="max-h-64">
                        <div className="space-y-3">
                            {invites.map((invite, index) => (
                                <div key={invite.id}>
                                    <div className="rounded-lg border border-neutral-800 bg-black p-3">
                                        <div className="mb-2 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4 text-cyan-400" />
                                                <span className="text-sm font-medium text-neutral-200">
                                                    {invite.group_name}
                                                </span>
                                            </div>
                                            <Badge variant="outline" className="text-xs">
                                                {invite.role}
                                            </Badge>
                                        </div>

                                        <p className="mb-3 text-xs text-neutral-400">
                                            Invited by {invite.invited_by_name || "someone"}{" "}
                                            • {formatDate(invite.created_at)}
                                        </p>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                className="flex-1 bg-teal-600 text-black hover:bg-teal-500"
                                                onClick={() => handleInvite(invite.id, "accept")}
                                                disabled={processing === invite.id}
                                            >
                                                {processing === invite.id ? (
                                                    <Clock className="h-3 w-3" />
                                                ) : (
                                                    <>
                                                        <Check className="h-3 w-3 mr-1" />
                                                        Accept
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="flex-1 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                                                onClick={() => handleInvite(invite.id, "decline")}
                                                disabled={processing === invite.id}
                                            >
                                                <X className="h-3 w-3 mr-1" />
                                                Decline
                                            </Button>
                                        </div>
                                    </div>
                                    {index < invites.length - 1 && (
                                        <Separator className="my-3 bg-neutral-800" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}

                <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-neutral-800 text-xs text-neutral-300 hover:bg-neutral-900 bg-transparent"
                    onClick={handleRefresh}
                    disabled={isLoading}
                >
                    {isLoading ? "Refreshing..." : "Refresh"}
                </Button>
            </CardContent>
        </Card>
    )
}