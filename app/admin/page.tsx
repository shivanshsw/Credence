"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save, Users, Shield, RefreshCw } from "lucide-react"
import { useAuth } from "@/components/auth-context"
import AppShell from "@/components/app-shell"

interface Permission {
  name: string
  description: string
}

interface Role {
  role: string
  count: number
}

interface User {
  id: string
  name: string
  email: string
  role: string
  created_at: string
}

export default function AdminPage() {
  const { selectedGroup } = useAuth()
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedRole, setSelectedRole] = useState<string>("")
  const [rolePermissions, setRolePermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [permissionsRes, rolesRes, usersRes] = await Promise.all([
        fetch('/api/admin/permissions', { credentials: 'include' }),
        fetch('/api/admin/permissions', { credentials: 'include' }),
        fetch('/api/admin/roles', { credentials: 'include' })
      ])

      if (permissionsRes.ok) {
        const permissionsData = await permissionsRes.json()
        setPermissions(permissionsData.permissions)
        setRoles(permissionsData.roles)
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData)
      }
    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleSelect = async (role: string) => {
    setSelectedRole(role)
    try {
      const response = await fetch(`/api/admin/permissions?role=${role}`, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setRolePermissions(data.permissions || [])
      }
    } catch (error) {
      console.error('Error fetching role permissions:', error)
    }
  }

  const handlePermissionToggle = (permissionName: string) => {
    setRolePermissions(prev => 
      prev.includes(permissionName)
        ? prev.filter(p => p !== permissionName)
        : [...prev, permissionName]
    )
  }

  const saveRolePermissions = async () => {
    if (!selectedRole) return

    try {
      setSaving(true)
      const response = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          role: selectedRole,
          permissions: rolePermissions
        })
      })

      if (response.ok) {
        // Show success message
        console.log('Permissions saved successfully')
      }
    } catch (error) {
      console.error('Error saving permissions:', error)
    } finally {
      setSaving(false)
    }
  }

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const response = await fetch('/api/admin/roles', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId,
          role: newRole
        })
      })

      if (response.ok) {
        setUsers(prev => prev.map(user => 
          user.id === userId ? { ...user, role: newRole } : user
        ))
      }
    } catch (error) {
      console.error('Error updating user role:', error)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-32">
          <div className="text-neutral-500">Loading admin panel...</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-120px)] flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="permissions" className="flex-1">
          <TabsList>
            <TabsTrigger value="permissions">Permission Management</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
          </TabsList>

          <TabsContent value="permissions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Role Permissions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Select value={selectedRole} onValueChange={handleRoleSelect}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.role} value={role.role}>
                          {role.role} ({role.count} users)
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
                  <div className="grid gap-3 md:grid-cols-2">
                    {permissions.map((permission) => (
                      <div key={permission.name} className="flex items-center space-x-2">
                        <Checkbox
                          id={permission.name}
                          checked={rolePermissions.includes(permission.name)}
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
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border border-neutral-800 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-neutral-400">{user.email}</p>
                        </div>
                        <Badge variant="outline">{user.role}</Badge>
                      </div>
                      <Select
                        value={user.role}
                        onValueChange={(newRole) => updateUserRole(user.id, newRole)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="tech-lead">Tech Lead</SelectItem>
                          <SelectItem value="finance-manager">Finance Manager</SelectItem>
                          <SelectItem value="intern">Intern</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
