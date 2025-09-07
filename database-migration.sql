-- Credence MCP Database Migration
-- Run this to add the missing columns and tables

-- Add role column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'employee';

-- Add invite_code column to groups table if it doesn't exist
ALTER TABLE groups ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create role permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    permission_name TEXT NOT NULL REFERENCES permissions(name) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role, permission_name)
);

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    is_private BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create note sharing table
CREATE TABLE IF NOT EXISTS note_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(note_id, shared_with_user_id)
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    assigned_to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    assigned_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    due_date TIMESTAMPTZ,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create group members table
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Create chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default permissions
INSERT INTO permissions (name, description) VALUES
('finance_data:read', 'Read access to financial data and reports'),
('finance_data:write', 'Write access to financial data and reports'),
('user_management:read', 'View user information and roles'),
('user_management:write', 'Create, update, and delete users'),
('task_assignment:create', 'Create and assign tasks to users'),
('task_assignment:read', 'View assigned tasks'),
('task_assignment:update', 'Update task status and details'),
('notes:create', 'Create new notes'),
('notes:read', 'Read notes'),
('notes:share', 'Share notes with other users'),
('notes:delete', 'Delete notes'),
('calendar:read', 'View calendar events'),
('calendar:write', 'Create and update calendar events'),
('admin:permissions', 'Manage role permissions and access control'),
('admin:system', 'Full system administration access')
ON CONFLICT (name) DO NOTHING;

-- Insert default role permissions
INSERT INTO role_permissions (role, permission_name) VALUES
-- Employee permissions
('employee', 'notes:create'),
('employee', 'notes:read'),
('employee', 'task_assignment:read'),
('employee', 'calendar:read'),

-- Manager permissions
('manager', 'finance_data:read'),
('manager', 'user_management:read'),
('manager', 'task_assignment:create'),
('manager', 'task_assignment:read'),
('manager', 'task_assignment:update'),
('manager', 'notes:create'),
('manager', 'notes:read'),
('manager', 'notes:share'),
('manager', 'calendar:read'),
('manager', 'calendar:write'),

-- Admin permissions
('admin', 'finance_data:read'),
('admin', 'finance_data:write'),
('admin', 'user_management:read'),
('admin', 'user_management:write'),
('admin', 'task_assignment:create'),
('admin', 'task_assignment:read'),
('admin', 'task_assignment:update'),
('admin', 'notes:create'),
('admin', 'notes:read'),
('admin', 'notes:share'),
('admin', 'notes:delete'),
('admin', 'calendar:read'),
('admin', 'calendar:write'),
('admin', 'admin:permissions'),

-- Tech Lead permissions
('tech-lead', 'user_management:read'),
('tech-lead', 'task_assignment:create'),
('tech-lead', 'task_assignment:read'),
('tech-lead', 'task_assignment:update'),
('tech-lead', 'notes:create'),
('tech-lead', 'notes:read'),
('tech-lead', 'notes:share'),
('tech-lead', 'calendar:read'),
('tech-lead', 'calendar:write'),

-- Finance Manager permissions
('finance-manager', 'finance_data:read'),
('finance-manager', 'finance_data:write'),
('finance-manager', 'task_assignment:create'),
('finance-manager', 'task_assignment:read'),
('finance-manager', 'task_assignment:update'),
('finance-manager', 'notes:create'),
('finance-manager', 'notes:read'),
('finance-manager', 'notes:share'),
('finance-manager', 'calendar:read'),
('finance-manager', 'calendar:write'),

-- Intern permissions
('intern', 'notes:create'),
('intern', 'notes:read'),
('intern', 'task_assignment:read'),
('intern', 'calendar:read')
ON CONFLICT (role, permission_name) DO NOTHING;

-- Group files for uploads (per-group storage metadata)
CREATE TABLE IF NOT EXISTS group_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    uploader_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    storage_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_files_group_id ON group_files(group_id);
CREATE INDEX IF NOT EXISTS idx_group_files_uploader ON group_files(uploader_user_id);

-- Ensure tasks has is_completed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'is_completed'
    ) THEN
        ALTER TABLE tasks ADD COLUMN is_completed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Create group-specific role permissions table
CREATE TABLE IF NOT EXISTS group_role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    permission_name TEXT NOT NULL REFERENCES permissions(name) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, role, permission_name)
);

-- Create group-specific custom permissions table
CREATE TABLE IF NOT EXISTS group_custom_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    custom_permission_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, role)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notes_author_id ON notes(author_id);
CREATE INDEX IF NOT EXISTS idx_notes_group_id ON notes(group_id);
CREATE INDEX IF NOT EXISTS idx_notes_is_private ON notes(is_private);
CREATE INDEX IF NOT EXISTS idx_note_shares_note_id ON note_shares(note_id);
CREATE INDEX IF NOT EXISTS idx_note_shares_shared_with ON note_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_group_id ON tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_group_id ON chat_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_group_role_permissions_group_id ON group_role_permissions(group_id);
CREATE INDEX IF NOT EXISTS idx_group_custom_permissions_group_id ON group_custom_permissions(group_id);

-- Audit logs and display_name support
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
