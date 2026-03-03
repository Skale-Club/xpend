-- Create the 'statements' storage bucket
-- Run this in Supabase SQL Editor

-- First, insert the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'statements',
  'statements',
  true, -- public bucket for easy access
  52428800, -- 50MB file size limit
  ARRAY['text/csv', 'application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Create policies for the bucket

-- Policy: Allow anyone to read files (since bucket is public)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'statements');

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'statements'
  AND auth.role() = 'authenticated'
);

-- Policy: Allow authenticated users to update their own files
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'statements'
  AND auth.role() = 'authenticated'
);

-- Policy: Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'statements'
  AND auth.role() = 'authenticated'
);
