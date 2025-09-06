# Credence MCP - Complete Setup Guide

## 🚀 Quick Start

### 1. Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Database
DATABASE_URL=your_neon_database_url_here

# Descope Authentication
NEXT_PUBLIC_DESCOPE_PROJECT_ID=your_descope_project_id
DESCOPE_MANAGEMENT_KEY=your_descope_management_key

# Google Gemini API
GEMINI_API_KEY=your_google_gemini_api_key_here

# Next.js
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=http://localhost:3000
```

### 2. Database Setup

Run the SQL schema in your Neon database:

```bash
# Execute the database-schema.sql file in your Neon console
# This will create all necessary tables and permissions
```

### 3. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 4. Run the Development Server

```bash
npm run dev
# or
pnpm dev
```

## 🔑 API Keys Setup

### Google Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create a new API key
3. Add it to your `.env.local` file as `GOOGLE_GEMINI_API_KEY`

### Descope Authentication

1. Sign up at [Descope](https://descope.com/)
2. Create a new project
3. Get your Project ID and Management Key
4. Add them to your `.env.local` file

### Neon Database

1. Sign up at [Neon](https://neon.tech/)
2. Create a new database
3. Get your connection string
4. Add it to your `.env.local` file as `DATABASE_URL`

## 🏗️ Features Implemented

### 1. Role-Based Access Control (RBAC) 🔐

**What it does:**
- Restricts user access based on their assigned role
- 7 predefined roles: employee, manager, admin, tech-lead, finance-manager, intern
- Granular permissions system with 15+ permission types

**How it works:**
- User permissions are fetched from database for every chat query
- Gemini AI uses permissions as rules to provide/deny access
- Dynamic permission management through admin interface

**API Endpoints:**
- `GET /api/admin/permissions` - Get all roles and permissions
- `POST /api/admin/permissions` - Update role permissions
- `GET /api/admin/roles` - Get all users with roles
- `PUT /api/admin/roles` - Update user role

### 2. Automated Task Assignment 🗓️

**What it does:**
- Enables natural language task assignment via chat
- Automatically creates tasks in the database
- Supports due dates, priorities, and multiple assignees

**How it works:**
- User types: "Assign Q3 report to all employees by Friday"
- Gemini parses the command and extracts structured data
- System creates tasks for each assigned user
- Tasks are stored in database with full metadata

**API Endpoints:**
- `GET /api/tasks` - Get user's tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/[id]` - Update task
- `DELETE /api/tasks/[id]` - Delete task

### 3. Secure Notes Application 📝

**What it does:**
- Two-mode notes: private and shared
- Email-based sharing system
- Full CRUD operations with permission checks

**How it works:**
- Users can create private or shared notes
- Shared notes are accessible to specific users via email
- Permission system controls who can create, read, share, and delete notes

**API Endpoints:**
- `GET /api/notes` - Get user's notes
- `POST /api/notes` - Create new note
- `PUT /api/notes/[id]` - Update note
- `DELETE /api/notes/[id]` - Delete note
- `POST /api/notes/[id]/share` - Share note with user

### 4. Dynamic Permission Management 🛡️

**What it does:**
- Admin interface for managing role permissions
- Live editing of permission assignments
- User role management

**How it works:**
- Admins can select any role and modify its permissions
- Changes are instantly applied to the system
- User roles can be updated through the interface

**Admin Interface:**
- Permission Management tab: Edit role permissions
- User Management tab: Update user roles
- Real-time updates with immediate effect

## 🎯 Usage Examples

### Chat Commands

```
# Task Assignment
"Assign the Q3 report to john@company.com and jane@company.com by next Friday"

# Calendar Management
"Schedule a team meeting for tomorrow at 2 PM"

# Notes
"Create a note about the client meeting"

# Data Access (based on permissions)
"Show me the financial reports"
"List all pending tasks"
```

### Permission Examples

**Employee:**
- Can create and read notes
- Can view assigned tasks
- Cannot access financial data

**Manager:**
- All employee permissions
- Can assign tasks
- Can read financial data
- Can share notes

**Admin:**
- All manager permissions
- Can manage user roles
- Can modify permissions
- Full system access

## 🔧 Technical Architecture

### Database Schema

- **users**: User accounts with roles
- **groups**: Team groups
- **group_members**: Group membership with roles
- **invites**: Group invitations
- **permissions**: Available permissions
- **role_permissions**: Role-permission mappings
- **notes**: User notes
- **note_shares**: Note sharing relationships
- **tasks**: Task assignments
- **chat_messages**: Chat history

### API Structure

- **Authentication**: Descope integration
- **RBAC**: Permission checking on all endpoints
- **AI Integration**: Google Gemini for chat
- **Database**: Neon PostgreSQL
- **Frontend**: Next.js 15 with TypeScript

### Security Features

- Role-based access control
- Permission validation on all API calls
- Secure note sharing
- Audit logging
- Session management

## 🚨 Important Notes

1. **Environment Variables**: Make sure all required environment variables are set
2. **Database**: Run the schema.sql file to set up the database
3. **Permissions**: The system comes with default permissions, but admins can modify them
4. **API Keys**: Google Gemini API key is required for chat functionality
5. **Authentication**: Descope integration is required for user management

## 🐛 Troubleshooting

### Common Issues

1. **"User email not found in database"**
   - Make sure the user sync is working
   - Check if the user exists in the database

2. **"Insufficient permissions"**
   - Check user's role and permissions
   - Verify the user has the required permission

3. **Chat not responding**
   - Check if GOOGLE_GEMINI_API_KEY is set
   - Verify the API key is valid

4. **Database errors**
   - Ensure DATABASE_URL is correct
   - Check if all tables are created

### Debug Mode

Enable debug logging by checking the browser console and server logs for detailed error messages.

## 📚 Next Steps

1. Set up your environment variables
2. Run the database schema
3. Install dependencies
4. Start the development server
5. Create your first user account
6. Test the chat functionality
7. Explore the admin panel
8. Create some notes and tasks

The system is now fully functional with all requested features implemented!
