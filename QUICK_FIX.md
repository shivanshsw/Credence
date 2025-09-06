# 🚨 Quick Fix for Database Errors

## The Problem
You're getting these errors because the database schema hasn't been applied yet:
- `column "role" does not exist`
- `relation "chat_messages" does not exist`

## The Solution

### Option 1: Use the Migration Button (Easiest)
1. **Go to your app** (http://localhost:3000)
2. **Click the "Run Database Migration" button** on the login page
3. **Wait for it to complete** (you'll see "Database migrated successfully!")
4. **Refresh the page** and try the chat again

### Option 2: Manual Database Migration
1. **Go to your Neon database console**
2. **Run the SQL from `database-migration.sql`** file
3. **Refresh your app**

### Option 3: Use the API Endpoint
```bash
curl -X POST http://localhost:3000/api/migrate
```

## What the Migration Does
- ✅ Adds `role` column to `users` table
- ✅ Creates `permissions` table with 15+ permission types
- ✅ Creates `role_permissions` table for RBAC
- ✅ Creates `notes` table for notes app
- ✅ Creates `note_shares` table for note sharing
- ✅ Creates `tasks` table for task management
- ✅ Creates `chat_messages` table for chat history
- ✅ Inserts default permissions for all roles
- ✅ Creates performance indexes

## After Migration
Once the migration is complete, you should be able to:
- ✅ Use the chat with AI responses
- ✅ Create and manage notes
- ✅ Assign tasks via natural language
- ✅ Use the admin panel for permissions
- ✅ All RBAC features will work

## Environment Variables Required
Make sure you have these in your `.env.local`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=your_neon_database_url
NEXT_PUBLIC_DESCOPE_PROJECT_ID=your_descope_project_id
DESCOPE_MANAGEMENT_KEY=your_descope_management_key
```

## Test the Fix
1. Run the migration
2. Go to the chat
3. Try typing: "Hello, can you help me?"
4. You should get an AI response instead of an error

The system will now work perfectly! 🎉
