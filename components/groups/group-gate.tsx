"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/auth-context";

type InviteMember = { email: string; role: string };
const ROLES = ["employee", "manager", "admin"];

export default function GroupGate() {
  const { groups, selectGroup, createGroup, addMembers } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  // Add-members modal state
  const [addOpen, setAddOpen] = useState(false);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [members, setMembers] = useState<InviteMember[]>([]);

  const onCreate = async () => {
    if (!name.trim()) return;
    const newGroupId = await createGroup(name.trim());
    if (newGroupId) {
      setCreatedGroupId(newGroupId);
      setName("");
      setOpen(false);
      setAddOpen(true);
    } else {
      console.error("Failed to get new group ID after creation.");
      setOpen(false);
    }
  };

  const addEmail = () => {
    const v = emailInput.trim();
    if (!v) return;
    setMembers((prev) => [...prev, { email: v, role: "employee" }]);
    setEmailInput("");
  };

  const removeMember = (idx: number) =>
      setMembers((prev) => prev.filter((_, i) => i !== idx));

  const updateMemberRole = (idx: number, role: string) =>
      setMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, role } : m)));

  const finishMembers = async () => {
    if (createdGroupId) {
      if (members.length > 0) {
        await addMembers(createdGroupId, members);
      }
      selectGroup(createdGroupId); // ✅ only select here
    }
    setMembers([]);
    setEmailInput("");
    setCreatedGroupId(null);
    setAddOpen(false);
  };

  const skipMembers = () => {
    if (createdGroupId) selectGroup(createdGroupId); // ✅ only select here
    setMembers([]);
    setEmailInput("");
    setCreatedGroupId(null);
    setAddOpen(false);
  };

  return (
      <section
          aria-labelledby="groups-title"
          className="relative flex h-[calc(100vh-120px)] flex-col rounded-md border border-neutral-800 bg-neutral-950/50"
      >
        <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h1 id="groups-title" className="text-pretty text-sm font-semibold">
            Your Groups
          </h1>
          <Button
              variant="outline"
              onClick={() => setOpen(true)}
              className="border-teal-500/50 text-teal-400 hover:bg-teal-500/10"
          >
            Create a Group
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          <div className="flex-1 min-h-0 overflow-y-auto rounded-md border border-neutral-900 bg-black p-4">
            {groups.length === 0 ? (
                <div className="grid h-full place-items-center">
                  <div className="text-center">
                    <p className="mb-3 text-neutral-400">No groups yet.</p>
                    <Button
                        className="bg-teal-600 hover:bg-teal-500"
                        onClick={() => setOpen(true)}
                    >
                      Create your first group
                    </Button>
                  </div>
                </div>
            ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.map((g) => (
                      <li
                          key={g.id}
                          className="rounded-lg border border-white/10 bg-neutral-950 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-foreground">{g.name}</h3>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                              size="sm"
                              className="bg-teal-600 hover:bg-teal-500"
                              onClick={() => selectGroup(g.id)}
                              aria-label={`Open ${g.name}`}
                          >
                            Open
                          </Button>
                        </div>
                      </li>
                  ))}
                </ul>
            )}
          </div>
        </div>

        {/* Create group dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="sr-only">Open create group</DialogTrigger>
          <DialogContent className="border-white/10 bg-black/90 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Create a Group
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <label className="text-sm text-neutral-400">Group Name</label>
              <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Finance Team"
                  className="border-white/10 bg-black/60"
              />
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button
                    variant="outline"
                    className="border-white/10 bg-transparent"
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button
                  className="bg-teal-600 hover:bg-teal-500"
                  onClick={onCreate}
              >
                Continue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add members dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger className="sr-only">Add members</DialogTrigger>
          <DialogContent className="border-white/10 bg-black/90 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Add members (optional)
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-neutral-400">Invite by email</label>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="name@company.com"
                      className="flex-1 border-white/10 bg-black/60"
                  />
                  <Button
                      type="button"
                      variant="outline"
                      onClick={addEmail}
                      className="border-teal-500/40 text-teal-300 hover:bg-teal-500/10 bg-transparent"
                  >
                    Add
                  </Button>
                </div>
              </div>

              {members.length > 0 && (
                  <ul className="max-h-40 overflow-y-auto rounded border border-white/10 bg-neutral-950 p-2 text-sm">
                    {members.map((m, i) => (
                        <li
                            key={`${m.email}-${i}`}
                            className="flex items-center justify-between gap-3 rounded px-2 py-1"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-neutral-200">{m.email}</span>
                            <select
                                value={m.role}
                                onChange={(e) => updateMemberRole(i, e.target.value)}
                                className="rounded border bg-black/60 px-2 py-1 text-xs"
                            >
                              {ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                              ))}
                            </select>
                          </div>
                          <Button
                              variant="ghost"
                              size="sm"
                              className="text-neutral-400 hover:text-red-300"
                              onClick={() => removeMember(i)}
                          >
                            Remove
                          </Button>
                        </li>
                    ))}
                  </ul>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                  variant="outline"
                  className="border-white/10 bg-transparent"
                  onClick={skipMembers}
              >
                Skip for now
              </Button>
              <Button
                  className="bg-teal-600 hover:bg-teal-500"
                  onClick={finishMembers}
              >
                Save & Continue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
  );
}
  