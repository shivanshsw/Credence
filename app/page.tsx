"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth-context"
import { useSearchParams, useRouter } from "next/navigation"
import AppShell from "@/components/app-shell"
import SecurityPanel from "@/components/security-panel"
import SettingsPanel from "@/components/settings-panel"
import GroupGate from "@/components/groups/group-gate"
import { ChatView } from "@/components/chat/chat-view"

export default function Page() {
  // Get the state from our central 'brain', the auth context
  const { loggedIn, loading, selectedGroupId } = useAuth()
  const search = useSearchParams()
  const router = useRouter()
  const view = search.get("view")

  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])

  // On the server, or while the auth state is loading, show a generic loading UI
  if (!isClient || loading) {
    return (
        <AppShell>
          <div className="flex h-full items-center justify-center">
            <p className="text-neutral-500">Loading...</p>
          </div>
        </AppShell>
    );
  }

  // This function makes the rendering logic clear and easy to follow
  const renderContent = () => {
    // Priority 1: Handle special views from the URL, like 'security' or 'settings'
    if (view === "security") return <SecurityPanel />;
    if (view === "settings") return <SettingsPanel />;

    // Priority 2: If the user is logged in AND has selected a group, show the chat view
    if (loggedIn && selectedGroupId) return <ChatView />;

    // Priority 3: If the user is logged in but has NOT selected a group, show the group selection screen
    if (loggedIn && !selectedGroupId) return <GroupGate />;

    // Default case: If none of the above are true, the user is not logged in. Show the login prompt.
    return (
        <div className="relative flex h-[calc(100vh-120px)] flex-col place-items-center justify-center">
          <div className="rounded-md border border-neutral-800 bg-neutral-950 p-6 text-center shadow">
            <p className="text-sm text-neutral-300">Welcome to FINCORP MCP</p>
            <h2 className="mt-1 text-pretty text-lg font-semibold">Sign in to start chatting</h2>
            <button
                type="button"
                onClick={() => router.push('/sign-in')}
                className="mt-4 inline-flex items-center justify-center rounded-md bg-teal-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              Sign In / Sign Up
            </button>
          </div>
        </div>
    );
  };

  return <AppShell>{renderContent()}</AppShell>
}

