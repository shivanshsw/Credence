"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useSession, useUser, useDescope } from '@descope/nextjs-sdk/client';

// Define the shape of your data
type User = { name?: string; email?: string; };
type Group = { id: string; name: string; };

interface AuthContextType {
  user: User | null;
  loggedIn: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  groups: Group[];
  selectedGroupId: string | null;
  selectedGroup: Group | null; // <-- NEW: The full group object for easy access
  selectGroup: (groupId: string | null) => void;
  createGroup: (name: string) => Promise<string | null>;
  addMembers: (groupId: string, members: { email: string, role: string }[]) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isSessionLoading } = useSession();
  const { user: descopeUser, isUserLoading } = useUser();
  const sdk = useDescope();

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Find the full group object based on the selected ID
  const selectedGroup = useMemo(() => {
    return groups.find(g => g.id === selectedGroupId) || null;
  }, [groups, selectedGroupId]);

  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/auth/sync', { method: 'POST' });
      fetch('/api/groups')
          .then(res => res.json())
          .then((data: Group[]) => {
            if (Array.isArray(data)) setGroups(data);
          })
          .catch(err => console.error("Failed to fetch groups:", err));
    } else {
      setGroups([]);
      setSelectedGroupId(null);
    }
  }, [isAuthenticated]);

  const logout = async () => {
    await sdk.logout();
  };

  const createGroup = async (name: string): Promise<string | null> => {
    const response = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (response.ok) {
      const newGroup: Group = await response.json();
      setGroups(prev => [...prev, newGroup]);
      return newGroup.id;
    }
    return null;
  };

  const addMembers = async (groupId: string, members: { email: string, role: string }[]) => {
    console.log("Placeholder for inviting members:", { groupId, members });
  };

  const value: AuthContextType = {
    loggedIn: isAuthenticated,
    loading: isSessionLoading || isUserLoading,
    user: descopeUser ? { name: descopeUser.name, email: descopeUser.email } : null,
    logout,
    groups,
    selectedGroupId,
    selectedGroup, // <-- NEW: Providing the full group object
    selectGroup: setSelectedGroupId,
    createGroup,
    addMembers,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}