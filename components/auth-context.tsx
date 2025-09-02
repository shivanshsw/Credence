"use client"

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react"
import { useEffect } from "react"

type Group = { id: string; name: string; members: number }

type AuthContextValue = {
  loggedIn: boolean
  loading: boolean
  login: () => Promise<void>
  logout: () => void
  groups: Group[]
  selectedGroupId: string | null
  selectGroup: (id: string) => void
  createGroup: (g: Group) => void
  addMembers: (id: string, emails: string[]) => void // add members helper
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const LS = {
  loggedIn: "demo_logged_in",
  groups: "demo_groups",
  selectedGroup: "demo_selected_group_id",
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem(key) : null
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return sessionStorage.getItem(LS.loggedIn) === "1"
  })
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<Group[]>(() => readJSON<Group[]>(LS.groups, []))
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return sessionStorage.getItem(LS.selectedGroup) || null
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(LS.loggedIn, loggedIn ? "1" : "0")
    } catch {}
  }, [loggedIn])

  useEffect(() => {
    try {
      sessionStorage.setItem(LS.groups, JSON.stringify(groups))
    } catch {}
  }, [groups])

  useEffect(() => {
    try {
      if (selectedGroupId) sessionStorage.setItem(LS.selectedGroup, selectedGroupId)
      else sessionStorage.removeItem(LS.selectedGroup)
    } catch {}
  }, [selectedGroupId])

  const login = useCallback(async () => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 900))
    setLoggedIn(true)
    setLoading(false)
  }, [])

  const logout = useCallback(() => {
    setLoggedIn(false)
    setLoading(false)
    setSelectedGroupId(null)
    // keep groups list around for demo; remove next line to also clear it
    // setGroups([])
  }, [])

  const selectGroup = useCallback((id: string) => {
    setSelectedGroupId(id)
  }, [])

  const createGroup = useCallback((g: Group) => {
    setGroups((prev) => [...prev, g])
  }, [])

  const addMembers = useCallback((id: string, emails: string[]) => {
    const delta = emails.filter((e) => e.trim().length > 0).length
    if (delta === 0) return
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, members: g.members + delta } : g)))
  }, [])

  const value = useMemo(
    () => ({
      loggedIn,
      loading,
      login,
      logout,
      groups,
      selectedGroupId,
      selectGroup,
      createGroup,
      addMembers, // expose addMembers
    }),
    [loggedIn, loading, login, logout, groups, selectedGroupId, selectGroup, createGroup, addMembers],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return ctx
}

export function generateMockGroup(name: string): Group {
  const id = "grp_" + Math.random().toString(36).slice(2, 9)
  return { id, name: name.trim() || "New Group", members: 0 }
}
