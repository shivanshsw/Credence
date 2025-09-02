"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSession, useUser, useDescope } from '@descope/nextjs-sdk/client';

// Define the shape of your data from the database
type User = {
  name?: string;
  email?: string;
};

type Group = {
  id: string;
  name: string;
};

interface AuthContextType {
  user: User | null;
  loggedIn: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  groups: Group[];
  selectedGroupId: string | null;
  selectGroup: (groupId: string | null) => void;
  createGroup: (name: string) => Promise<string | null>; // FIX: Changed to return the new group's ID or null
  addMembers: (groupId: string, emails: string[]) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isSessionLoading } = useSession();
  const { user: descopeUser, isUserLoading } = useUser();
  const sdk = useDescope();

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/auth/sync', { method: 'POST' });
      fetch('/api/groups')
          .then(res => res.json())
          .then((data: Group[]) => {
            if (Array.isArray(data)) {
              setGroups(data);
            }
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

  // FIX: This function now returns the ID of the new group on success
  const createGroup = async (name: string): Promise<string | null> => {
    const response = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (response.ok) {
      const newGroup: Group = await response.json();
      setGroups(prev => [...prev, newGroup]);
      return newGroup.id; // Return the ID
    } else {
      console.error("Failed to create group");
      return null; // Return null on failure
    }
  };

  // Placeholder for the "Add Members" functionality
  const addMembers = (groupId: string, emails: string[]) => {
    console.log(`Adding members to group ${groupId}:`, emails);
    // Here you would typically make another API call to a new endpoint
    // For example: POST /api/groups/${groupId}/members
  };

  const value: AuthContextType = {
    loggedIn: isAuthenticated,
    loading: isSessionLoading || isUserLoading,
    user: descopeUser ? { name: descopeUser.name, email: descopeUser.email } : null,
    logout,
    groups,
    selectedGroupId,
    selectGroup: setSelectedGroupId,
    createGroup,
    addMembers, // FIX: The function is now correctly provided
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

