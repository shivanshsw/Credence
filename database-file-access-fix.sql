-- Database migration to fix file access issues
-- Run this script to add missing columns and RLS policies

-- 1. Add mime_type column to uploaded_files table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'uploaded_files' AND column_name = 'mime_type'
    ) THEN
        ALTER TABLE uploaded_files ADD COLUMN mime_type TEXT;
        RAISE NOTICE 'Added mime_type column to uploaded_files table';
    ELSE
        RAISE NOTICE 'mime_type column already exists in uploaded_files table';
    END IF;
END $$;

-- 2. Add storage_path column to uploaded_files table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'uploaded_files' AND column_name = 'storage_path'
    ) THEN
        ALTER TABLE uploaded_files ADD COLUMN storage_path TEXT;
        RAISE NOTICE 'Added storage_path column to uploaded_files table';
    ELSE
        RAISE NOTICE 'storage_path column already exists in uploaded_files table';
    END IF;
END $$;

-- 3. Update existing records to set storage_path = file_url where storage_path is null
UPDATE uploaded_files 
SET storage_path = file_url 
WHERE storage_path IS NULL OR storage_path = '';

-- 4. Enable RLS on storage.objects table if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated read access to group files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to group files" ON storage.objects;

-- 6. Create RLS policies for group-files bucket access
-- Allow authenticated users to read files from group-files bucket
CREATE POLICY "Allow authenticated read access to group files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'group-files');

-- Allow authenticated users to upload files to group-files bucket
CREATE POLICY "Allow authenticated uploads to group files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'group-files');

-- 7. Ensure the group-files bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-files', 'group-files', false)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    public = EXCLUDED.public;

-- 8. Create index on mime_type for better performance
CREATE INDEX IF NOT EXISTS idx_uploaded_files_mime_type ON uploaded_files(mime_type);

-- 9. Verify the setup
SELECT 
    'uploaded_files table columns:' as info,
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'uploaded_files' 
ORDER BY ordinal_position;

SELECT 
    'storage.objects policies:' as info,
    policyname, 
    permissive, 
    roles, 
    cmd 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';

SELECT 
    'storage buckets:' as info,
    id, 
    name, 
    public 
FROM storage.buckets 
WHERE name = 'group-files';
