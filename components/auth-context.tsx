// components/auth-context.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { useSession, useUser, useDescope } from "@descope/nextjs-sdk/client";
import { useRouter } from "next/navigation";

type User = { id?: string; name?: string | null; email?: string | null } | null;
type Group = { id: string; name: string };

interface AuthContextType {
  user: User | null;
  loggedIn: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  groups: Group[];
  selectedGroupId: string | null;
  selectedGroup: Group | null;
  selectGroup: (groupId: string | null) => void;
  clearGroup: () => void;
  createGroup: (name: string) => Promise<string | null>;
  addMembers: (groupId: string, members: { email: string; role: string }[]) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isSessionLoading } = useSession();
  const { user: descopeUser, isUserLoading } = useUser();
  const sdk = useDescope();

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("selectedGroupId");
    return null;
  });

  // ---- Helpers ----
  const safeJson = async (res: Response) => {
    try { return await res.json(); } catch { return null; }
  };

  // fetch groups (server requires cookies -> include credentials)
  const fetchGroups = async () => {
    try {
      const res = await fetch("/api/groups", { method: "GET", credentials: "include" });
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


  // create group (POST) and return id
  const createGroup = async (name: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        console.error("Create group failed:", await res.text());
        return null;
      }
      const newGroup = (await res.json()) as Group;
      setGroups((prev) => [...prev, newGroup]);
      return newGroup.id;
    } catch (err) {
      console.error("Create group error:", err);
      return null;
    }
  };

  // addMembers -> placeholder function (no longer needed with invite codes)
  const addMembers = async (groupId: string, members: { email: string; role: string }[]) => {
    // This function is kept for backward compatibility but does nothing
    // The new invite code system doesn't require this functionality
    console.log("addMembers called but not implemented with new invite code system");
  };

  const selectGroup = (groupId: string | null) => {
    setSelectedGroupId(groupId);
    try {
      if (groupId) localStorage.setItem("selectedGroupId", groupId);
      else localStorage.removeItem("selectedGroupId");
    } catch {}
    // keep user on / and let page re-evaluate
    try { router.replace("/"); } catch {}
  };

  const clearGroup = () => selectGroup(null);

  const logout = async () => {
    try {
      await sdk.logout();
    } catch (err) {
      console.error("logout error:", err);
    }
    try { localStorage.removeItem("selectedGroupId"); } catch {}
    router.push("/");
  };

  // fetch on login
  useEffect(() => {
    const handleLogin = async () => {
      if (isAuthenticated) {
        try {
          // 1. First, trigger the user sync and wait for it to complete.
          let syncResponse = await fetch("/api/auth/sync", { method: "POST", credentials: "include" });
          
          // Retry sync once if it fails
          if (!syncResponse.ok) {
            console.warn("Initial sync failed, retrying...");
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            syncResponse = await fetch("/api/auth/sync", { method: "POST", credentials: "include" });
          }
          
          if (!syncResponse.ok) {
            const syncError = await syncResponse.text();
            console.error("User sync failed after retry:", syncError);
            return; // Don't proceed with fetching data if sync failed
          }

          // 2. Only after sync is successful, fetch groups.
          await fetchGroups();
        } catch (err) {
          console.error("Error during initial sync and data fetch:", err);
        }
      } else {
        setGroups([]);
        setSelectedGroupId(null);
      }
    };

    handleLogin();

  }, [isAuthenticated]);

  useEffect(() => {
    try {
      if (selectedGroupId) localStorage.setItem("selectedGroupId", selectedGroupId);
      else localStorage.removeItem("selectedGroupId");
    } catch {}
  }, [selectedGroupId]);

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
