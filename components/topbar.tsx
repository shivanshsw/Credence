"use client"

import { Menu } from "lucide-react"

export default function Topbar({
  isOpen,
  onOpenMenu,
}: {
  isOpen?: boolean
  onOpenMenu?: () => void
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-neutral-800 bg-black/80 backdrop-blur supports-[backdrop-filter]:bg-black/60 lg:hidden">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-teal-500" aria-hidden="true" />
          <p className="text-sm font-medium">FINCORP MCP</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-md border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          aria-label="Open navigation"
          aria-controls="mobile-nav"
          aria-expanded={isOpen ? true : undefined}
          onClick={onOpenMenu}
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
          Menu
        </button>
      </div>
    </header>
  )
}
