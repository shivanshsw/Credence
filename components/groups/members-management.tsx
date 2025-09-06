"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Save, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface MembersManagementProps {
  groupId: string;
  isAdmin: boolean;
}

const ROLES = ["admin", "manager", "member"];

export function MembersManagement({ groupId, isAdmin }: MembersManagementProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleChanges, setRoleChanges] = useState<Record<string, string>>({});

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/members`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }
      
      const data = await response.json();
      setMembers(data.members);
    } catch (error) {
      console.error('Failed to fetch members:', error);
      toast({
        title: "Error",
        description: "Failed to load group members",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (memberId: string, newRole: string) => {
    setRoleChanges(prev => ({
      ...prev,
      [memberId]: newRole
    }));
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const promises = Object.entries(roleChanges).map(([memberId, newRole]) =>
        fetch(`/api/groups/${groupId}/members`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ member_user_id: memberId, new_role: newRole })
        })
      );

      const results = await Promise.all(promises);
      const failed = results.filter(r => !r.ok);
      
      if (failed.length > 0) {
        throw new Error(`${failed.length} role updates failed`);
      }

      toast({
        title: "Success",
        description: "Member roles updated successfully",
      });

      setRoleChanges({});
      await fetchMembers();
    } catch (error) {
      console.error('Failed to save changes:', error);
      toast({
        title: "Error",
        description: "Failed to update member roles",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(roleChanges).length > 0;

  useEffect(() => {
    if (open) {
      fetchMembers();
    }
  }, [open, groupId]);

  if (!isAdmin) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
        >
          <Users className="w-4 h-4 mr-2" />
          Members
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-black/90 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Manage Group Members
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-4">
              <p className="text-neutral-400">Loading members...</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-neutral-950"
                >
                  <div className="flex-1">
                    <p className="font-medium text-white">{member.name}</p>
                    <p className="text-sm text-neutral-400">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={roleChanges[member.id] || member.role}
                      onValueChange={(value) => handleRoleChange(member.id, value)}
                    >
                      <SelectTrigger className="w-32 border-white/10 bg-black/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {roleChanges[member.id] && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newChanges = { ...roleChanges };
                          delete newChanges[member.id];
                          setRoleChanges(newChanges);
                        }}
                        className="text-neutral-400 hover:text-red-300"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="border-white/10 bg-transparent"
          >
            Close
          </Button>
          {hasChanges && (
            <Button
              onClick={saveChanges}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-500"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
