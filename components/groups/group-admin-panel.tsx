"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Save, Users, Shield, RefreshCw, Settings, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Permission {
  name: string;
  description: string;
}

interface GroupMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface GroupAdminPanelProps {
  groupId: string;
  isAdmin: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function GroupAdminPanel({ groupId, isAdmin, isOpen = false, onToggle }: GroupAdminPanelProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [customPermissions, setCustomPermissions] = useState<Record<string, string>>({});
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedRolePermissions, setSelectedRolePermissions] = useState<string[]>([]);
  const [customPermissionText, setCustomPermissionText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const availableRoles = ['admin', 'manager', 'employee'];

  useEffect(() => {
    if (isAdmin) {
      fetchGroupAdminData();
    }
  }, [groupId, isAdmin]);

  const fetchGroupAdminData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/groups/${groupId}/admin`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch group admin data');
      }
      
      const data = await response.json();
      setPermissions(data.permissions || []);
      setGroupMembers(data.groupMembers || []);
      setRolePermissions(data.rolePermissions || {});
      setCustomPermissions(data.customPermissions || {});
    } catch (error) {
      console.error('Error fetching group admin data:', error);
      toast({
        title: "Error",
        description: "Failed to load group admin data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
    setSelectedRolePermissions(rolePermissions[role] || []);
    setCustomPermissionText(customPermissions[role] || "");
  };

  const handlePermissionToggle = (permissionName: string) => {
    setSelectedRolePermissions(prev => 
      prev.includes(permissionName)
        ? prev.filter(p => p !== permissionName)
        : [...prev, permissionName]
    );
  };

  const saveRolePermissions = async () => {
    if (!selectedRole) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/groups/${groupId}/admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          role: selectedRole,
          permissions: selectedRolePermissions,
          customPermissionText: customPermissionText
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Group permissions updated successfully",
        });
        
        // Update local state
        setRolePermissions(prev => ({
          ...prev,
          [selectedRole]: selectedRolePermissions
        }));
        setCustomPermissions(prev => ({
          ...prev,
          [selectedRole]: customPermissionText
        }));
      } else {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        throw new Error(errorData.error || 'Failed to save permissions');
      }
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update group permissions",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

 
  if (!isOpen) return null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Group Admin Panel
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-neutral-500">Loading group admin panel...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Group Admin Panel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="permissions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="permissions">Role Permissions</TabsTrigger>
            <TabsTrigger value="members">Group Members</TabsTrigger>
          </TabsList>

          <TabsContent value="permissions" className="space-y-4">
            <div className="flex items-center gap-4">
              <Select value={selectedRole} onValueChange={handleRoleSelect}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedRole && (
                <Button onClick={saveRolePermissions} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              )}
            </div>

            {selectedRole && (
              <div className="space-y-6">
                {/* Standard Permissions */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Standard Permissions</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    {permissions.map((permission) => (
                      <div key={permission.name} className="flex items-center space-x-2">
                        <Checkbox
                          id={permission.name}
                          checked={selectedRolePermissions.includes(permission.name)}
                          onCheckedChange={() => handlePermissionToggle(permission.name)}
                        />
                        <label
                          htmlFor={permission.name}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {permission.name}
                        </label>
                        <span className="text-xs text-neutral-500">
                          {permission.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Permission Text */}
                <div>
                  <h4 className="text-sm font-medium mb-3">
                    Custom Permission Description
                    <span className="text-xs text-yellow-500 ml-2">(High Priority - Overrides Standard Permissions)</span>
                  </h4>
                  <Textarea
                    placeholder="Enter custom permission description for this role. This text will be given to the AI chatbot with high priority and can override standard permissions..."
                    value={customPermissionText}
                    onChange={(e) => setCustomPermissionText(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <p className="text-xs text-neutral-500 mt-2">
                    This custom text will be provided to the AI chatbot with high priority and can override standard permission restrictions.
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            <div className="space-y-3">
              {groupMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border border-neutral-800 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">{member.name || 'Unknown'}</p>
                      <p className="text-sm text-neutral-400">{member.email || 'No email'}</p>
                    </div>
                    <Badge variant="outline">{member.role}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
