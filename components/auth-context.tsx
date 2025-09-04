// components/auth-context.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { useSession, useUser, useDescope } from "@descope/nextjs-sdk/client";
import { useRouter } from "next/navigation";

type User = { id?: string; name?: string | null; email?: string | null } | null;
type Group = { id: string; name: string };
type Invite = { id: string; group_id: string; group_name: string; role: string; status: string };

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
  invites: Invite[];
  fetchInvites: () => Promise<void>;
  acceptInvite: (inviteId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isSessionLoading } = useSession();
  const { user: descopeUser, isUserLoading } = useUser();
  const sdk = useDescope();

  const [groups, setGroups] = useState<Group[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
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

  // fetch invites (server requires cookies)
  const fetchInvites = async () => {
    try {
      const res = await fetch("/api/invites", { method: "GET", credentials: "include" });
      if (!res.ok) {
        // log server response text for debugging
        console.error("Failed to fetch invites:", await res.text());
        return;
      }
      const data = (await res.json()) as Invite[];
      if (Array.isArray(data)) setInvites(data);
    } catch (err) {
      console.error("Failed to fetch invites:", err);
    }
  };

  // accept invite (send credentials)
  const acceptInvite = async (inviteId: string) => {
    try {
      const res = await fetch(`/api/invites/${inviteId}/accept`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) {
        console.error("Failed to accept invite:", await res.text());
        return;
      }
      // Refresh lists after success
      await fetchGroups();
      await fetchInvites();
    } catch (err) {
      console.error("acceptInvite error:", err);
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

  // addMembers -> send invites to server (POST)
  const addMembers = async (groupId: string, members: { email: string; role: string }[]) => {
    if (!groupId || !members?.length) return;
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, invites: members }),
      });
      if (!res.ok) {
        console.error("Failed to create invites:", await res.text());
      } else {
        // refresh invites list
        await fetchInvites();
      }
    } catch (err) {
      console.error("addMembers error:", err);
    }
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
    if (isAuthenticated) {
      fetch("/api/auth/sync", { method: "POST", credentials: "include" }).catch(() => {});
      fetchGroups();
      fetchInvites();
    } else {
      setGroups([]);
      setInvites([]);
      setSelectedGroupId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    invites,
    fetchInvites,
    acceptInvite,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
