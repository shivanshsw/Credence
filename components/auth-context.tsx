// components/auth-context.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { useSession, useUser, useDescope } from "@descope/nextjs-sdk/client";
import { useRouter } from "next/navigation";

type User = { id?: string; name?: string | null; email?: string | null } | null;
type Group = { id: string; name: string };

export interface AuthContextType {
  user: User;
  loggedIn: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  groups: Group[];
  selectedGroupId: string | null;
  selectedGroup: Group | null;
  fetchGroups: () => Promise<void>;
  selectGroup: (groupId: string | null) => void;
  clearGroup: () => void;
  createGroup: (name: string) => Promise<string | null>;
  addMembers: (groupId: string, members: { email: string; role: string }[]) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // NOTE: useSession provides auth state; useUser provides user info
  const { isAuthenticated, isSessionLoading } = useSession();
  const { user: descopeUser, isUserLoading } = useUser();
  const sdk = useDescope();

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("selectedGroupId");
      } catch {
        return null;
      }
    }
    return null;
  });


  // fetch groups when logged in changes
  useEffect(() => {
    if (isAuthenticated) {
      // sync user record (if you have an endpoint)
      fetch("/api/auth/sync", { method: "POST" }).catch(() => {});
      fetchGroups().catch(() => {});
    } else {
      setGroups([]);
      setSelectedGroupId(null);
      try {
        localStorage.removeItem("selectedGroupId");
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // keep persisted storage in sync
  useEffect(() => {
    try {
      if (selectedGroupId) localStorage.setItem("selectedGroupId", selectedGroupId);
      else localStorage.removeItem("selectedGroupId");
    } catch {}
  }, [selectedGroupId]);

  const fetchGroups = async () => {
    try {
      const res = await fetch("/api/groups");
      if (!res.ok) {
        console.error("Failed to fetch groups:", await res.text());
        return;
      }
      const data = (await res.json()) as Group[];
      if (Array.isArray(data)) setGroups(data);
    } catch (err) {
      console.error("Failed to fetch groups:", err);
    }
  };

  const selectGroup = (groupId: string | null) => {
    console.log("[auth] selectGroup called:", groupId);

    setSelectedGroupId(groupId);
    try {
      if (groupId) localStorage.setItem("selectedGroupId", groupId);
      else localStorage.removeItem("selectedGroupId");
    } catch {}
    // navigate to root so app/page.tsx re-evaluates render
    try {
      router.replace("/");
    } catch {}
  };

  const clearGroup = () => {
    setSelectedGroupId(null);
    try {
      localStorage.removeItem("selectedGroupId");
    } catch {}
    try {
      router.replace("/");
    } catch {}
  };

  const createGroup = async (name: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        console.error("Create group failed:", await res.text());
        return null;
      }
      const newGroup = (await res.json()) as Group;
      setGroups((prev) => [...prev, newGroup]);
      // do NOT auto-select here; GroupGate handles selecting after invites step
      return newGroup.id;
    } catch (err) {
      console.error("Create group error:", err);
      return null;
    }
  };

  const addMembers = async (groupId: string, members: { email: string; role: string }[]) => {
    if (!groupId || !members?.length) return;
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, invites: members }),
      });
      if (!res.ok) {
        console.error("Failed to create invites:", await res.text());
      }
    } catch (err) {
      console.error("addMembers error:", err);
    }
  };

  const logout = async () => {
    try {
      await sdk.logout();
    } catch (err) {
      console.error("logout error:", err);
    }
    try {
      localStorage.removeItem("selectedGroupId");
    } catch {}
  };

  const user = descopeUser ? { id: undefined, name: descopeUser.name, email: descopeUser.email } : null;
  const loggedIn = Boolean(isAuthenticated);
  const loading = Boolean(isSessionLoading || isUserLoading);

  const selectedGroup = useMemo(() => groups.find((g) => g.id === selectedGroupId) || null, [groups, selectedGroupId]);

  const value: AuthContextType = {
    user,
    loggedIn,
    loading,
    logout,
    groups,
    selectedGroupId,
    selectedGroup,
    fetchGroups,
    selectGroup,
    clearGroup,
    createGroup,
    addMembers,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
