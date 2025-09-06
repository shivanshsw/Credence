"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Search, Share2, Edit, Trash2, User } from "lucide-react"
import { useAuth } from "@/components/auth-context"
import AppShell from "@/components/app-shell"

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
  const [shareEmail, setShareEmail] = useState("")

  // Form state for creating/editing notes
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    isPrivate: true
  })

  useEffect(() => {
    fetchNotes()
  }, [activeTab])

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
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const newNote = await response.json()
        setNotes(prev => [newNote, ...prev])
        setFormData({ title: "", content: "", isPrivate: true })
        setIsCreateOpen(false)
      }
    } catch (error) {
      console.error('Error creating note:', error)
    }
  }

  const shareNote = async () => {
    if (!selectedNote || !shareEmail) return

    try {
      const response = await fetch(`/api/notes/${selectedNote.id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email: shareEmail })
      })

      if (response.ok) {
        setShareEmail("")
        setIsShareOpen(false)
        // Show success message
      }
    } catch (error) {
      console.error('Error sharing note:', error)
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
          <h1 className="text-2xl font-bold">Notes</h1>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-teal-600 hover:bg-teal-500">
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
                <Button onClick={createNote} className="w-full">
                  Create Note
                </Button>
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
                <div className="text-neutral-500">Loading notes...</div>
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
                      <p className="text-xs text-neutral-500 mt-2">
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Share Note Dialog */}
        <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Enter email address"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
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