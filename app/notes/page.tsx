"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Share2, Edit, Trash2, User, Upload, FileText } from "lucide-react"
import { useAuth } from "@/components/auth-context"
import AppShell from "@/components/app-shell"
import { LoadingSpinner, LoadingDots } from "@/components/ui/loading-spinner"

interface Note {
  id: string
  title: string
  content: string
  authorId: string
  authorName: string
  isPrivate: boolean
  createdAt: string
  updatedAt: string
}

export default function NotesPage() {
  const { selectedGroup } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [shareEmails, setShareEmails] = useState("")
  const [addByCodeOpen, setAddByCodeOpen] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [groups, setGroups] = useState<Array<{ id: string; name: string; role: string }>>([])
  const [addToGroupOpen, setAddToGroupOpen] = useState(false)
  const [targetGroupId, setTargetGroupId] = useState<string>("")

  // Form state for creating/editing notes
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    isPrivate: true,
    inviteCode: ""
  })

  useEffect(() => {
    fetchNotes()
  }, [activeTab])
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/security/access', { credentials: 'include' })
        const data = await res.json().catch(() => ({}))
        const rows = Array.isArray(data.data) ? data.data : []
        setGroups(rows)
      } catch {}
    }
    load()
  }, [])

  const fetchNotes = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/notes?type=${activeTab}`, {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setNotes(data)
      }
    } catch (error) {
      console.error('Error fetching notes:', error)
    } finally {
      setLoading(false)
    }
  }

  const createNote = async () => {
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ ...formData })
      })

      if (response.ok) {
        // Always refetch to ensure full objects (prevents undefined title/content)
        await fetchNotes()
        setFormData({ title: "", content: "", isPrivate: true, inviteCode: "" })
        setIsCreateOpen(false)
      }
    } catch (error) {
      console.error('Error creating note:', error)
    }
  }

  const shareNote = async () => {
    if (!selectedNote || !shareEmails) return

    try {
      const response = await fetch(`/api/notes/${selectedNote.id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ emails: shareEmails.split(',').map(e => e.trim()).filter(Boolean) })
      })

      if (response.ok) {
        setShareEmails("")
        setIsShareOpen(false)
        // Show success message
      } else {
        const err = await response.json().catch(() => ({} as any))
        alert(`Share failed: ${err.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error sharing note:', error)
      alert('Share failed. Check console for details.')
    }
  }

  const addByInviteCode = async () => {
    if (!joinCode) return
    try {
      // Reuse create endpoint with inviteCode only
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: "", content: "", isPrivate: true, inviteCode: joinCode })
      })
      if (res.ok) {
        setJoinCode("")
        setAddByCodeOpen(false)
        fetchNotes()
      } else {
        const err = await res.json().catch(() => ({} as any))
        alert(err.error || 'Invalid invite code')
      }
    } catch (e) {
      alert('Failed to add by invite code')
    }
  }
  
  const copyNote = async (noteId: string) => {
    try {
      const res = await fetch('/api/notes/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ note_id: noteId })
      })
      if (res.ok) {
        await fetchNotes()
      }
    } catch (e) {
      console.error('Copy note error', e)
    }
  }

  const deleteNote = async (noteId: string) => {
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        setNotes(prev => prev.filter(note => note.id !== noteId))
      }
    } catch (error) {
      console.error('Error deleting note:', error)
    }
  }

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-120px)] flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20">
              <FileText className="w-6 h-6 text-teal-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Notes</h1>
              <p className="text-sm text-neutral-400">Capture and organize your thoughts</p>
            </div>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white shadow-lg hover:shadow-teal-500/25 transition-all duration-200">
                <Plus className="h-4 w-4 mr-2" />
                New Note
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Note</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Note title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
                <Textarea
                  placeholder="Note content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  rows={6}
                />
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isPrivate"
                    checked={formData.isPrivate}
                    onChange={(e) => setFormData(prev => ({ ...prev, isPrivate: e.target.checked }))}
                  />
                  <label htmlFor="isPrivate" className="text-sm">Private note</label>
                </div>
                <Input
                  placeholder="Add by invite code (optional)"
                  value={formData.inviteCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, inviteCode: e.target.value }))}
                />
                <Button onClick={createNote} className="w-full">
                  Create Note
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={addByCodeOpen} onOpenChange={setAddByCodeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Add by Invite Code</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Note by Invite Code</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Invite code (6-8 chars also work)" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
                <Button onClick={addByInviteCode} className="w-full">Add</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList>
            <TabsTrigger value="all">All Notes</TabsTrigger>
            <TabsTrigger value="private">Private</TabsTrigger>
            <TabsTrigger value="shared">Shared</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="flex flex-col items-center space-y-2">
                  <LoadingDots />
                  <div className="text-neutral-500">Loading notes...</div>
                </div>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <p className="text-neutral-500">No notes found</p>
                  <p className="text-sm text-neutral-400">Create your first note to get started</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredNotes.map((note) => (
                  <Card key={note.id} className="border-neutral-800">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{note.title}</CardTitle>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedNote(note); setAddToGroupOpen(true); }} title="Add to group as inline file">
                            <Upload className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedNote(note)
                              setIsShareOpen(true)
                            }}
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => copyNote(note.id)}>
                            Copy
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteNote(note.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={note.isPrivate ? "outline" : "default"}>
                          {note.isPrivate ? "Private" : "Shared"}
                        </Badge>
                        <span className="text-xs text-neutral-400">
                          by {note.authorName}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-neutral-300 line-clamp-3">
                        {note.content}
                      </p>
                      <div className="flex items-center justify-between text-xs text-neutral-500 mt-2">
                        <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                        <span className="text-[11px]">Code: {(note as any).inviteCode || '—'}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Add note to group (inline file) */}
        <Dialog open={addToGroupOpen} onOpenChange={setAddToGroupOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add note to group</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="w-full"
                onClick={async () => {
                  if (!selectedNote || !targetGroupId) return
                  try {
                    const form = new FormData()
                    form.set('title', selectedNote.title)
                    form.set('description', selectedNote.content)
                    form.set('group_id', targetGroupId)
                    const res = await fetch('/api/files/upload', { method: 'POST', credentials: 'include', body: form })
                    if (res.ok) {
                      setAddToGroupOpen(false)
                    } else {
                      const err = await res.json().catch(() => ({}))
                      alert(err.error || 'Failed to add to group')
                    }
                  } catch (e) {
                    alert('Failed to add to group')
                  }
                }}
              >
                Add
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Share Note Dialog */}
        <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Enter comma-separated usernames or emails"
                value={shareEmails}
                onChange={(e) => setShareEmails(e.target.value)}
              />
              <Button onClick={shareNote} className="w-full">
                Share Note
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  )
}