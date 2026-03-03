# Supabase Storage Setup for Statements

This guide explains how to set up file storage for bank statements in your Supabase project.

## Prerequisites

- A Supabase project (cloud or self-hosted)
- Admin access to your Supabase dashboard
- `.env` file configured with Supabase credentials

## Quick Setup (Recommended)

### Method 1: Using SQL Editor

1. Open your Supabase Dashboard
2. Go to **SQL Editor** in the left sidebar
3. Copy the contents of `scripts/create-storage-bucket.sql`
4. Paste and run in the SQL Editor
5. ✅ Done! The bucket and policies are now created

### Method 2: Using Dashboard UI

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New Bucket**
4. Configure the bucket:
   - **Name**: `statements`
   - **Public bucket**: ✅ (checked) - This allows public access to file URLs
   - **File size limit**: 50 MB (52428800 bytes)
   - **Allowed MIME types**: `text/csv`, `application/pdf`
   - Click **Create Bucket**

## File Organization

Files are automatically organized in the bucket using this structure:

```
statements/
├── {accountId}/
│   ├── {year}-{month}/
│   │   ├── {timestamp}_{filename}.pdf
│   │   ├── {timestamp}_{filename}.csv
│   │   └── ...
```

**Example:**
```
statements/
├── clx1a2b3c4d5e6f7g8h9/
│   ├── 2026-02/
│   │   ├── 1709500800000_bank_statement_feb.pdf
│   │   └── 1709587200000_credit_card_feb.csv
│   ├── 2026-03/
│   │   └── 1712088000000_march_statement.pdf
```

**Benefits of this structure:**
- Easy to browse by account
- Chronologically organized by year/month
- Unique filenames prevent conflicts (timestamp prefix)
- Clean separation between different accounts and time periods

## Storage Policies

The SQL script creates these policies for the `statements` bucket:

| Policy | Action | Description |
|--------|--------|-------------|
| Public Access | SELECT (read) | Anyone can view files (bucket is public) |
| Authenticated users can upload | INSERT | Only logged-in users can upload |
| Users can update own files | UPDATE | Authenticated users can modify files |
| Users can delete own files | DELETE | Authenticated users can remove files |

### Custom Policies (Advanced)

If you want to restrict file access to only the account owner, replace the "Public Access" policy with:

```sql
CREATE POLICY "Users can view their own statements"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'statements'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

Then set the bucket to **private** instead of public.

## Environment Variables

Ensure these are set in your `.env` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Where to find these:

1. **NEXT_PUBLIC_SUPABASE_URL**:
   - Dashboard > Project Settings > API > Project URL

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**:
   - Dashboard > Project Settings > API > Project API keys > `anon` `public`

3. **SUPABASE_SERVICE_ROLE_KEY**:
   - Dashboard > Project Settings > API > Project API keys > `service_role` `secret`

⚠️ **Security Warning**:
- **NEVER** commit the `service_role` key to version control
- **NEVER** expose the `service_role` key in client-side code
- Only use `service_role` in server-side API routes

## How It Works

When you upload a statement file:

1. **Client uploads file** via the statements page
2. **API route receives file** at `/api/statements/upload`
3. **File is saved to Supabase Storage**:
   - Path: `{accountId}/{year}-{month}/{timestamp}_{filename}`
   - Returns public URL
4. **Database record is created**:
   - Stores file metadata (name, URL, month, year)
5. **Transactions are parsed** from the file (CSV or PDF)
6. **Timeline updates** to show successful upload

## Verifying the Setup

After setup, you can verify it works:

1. Go to the **Statements** page in your app
2. Select an account
3. Upload a CSV or PDF statement file
4. Check the Supabase Storage dashboard:
   - Navigate to **Storage** > **statements**
   - You should see your file in the appropriate folder

## Troubleshooting

### Files not uploading

**Check:**
- Bucket exists and is named exactly `statements`
- Environment variables are set correctly
- Service role key is valid (check for typos)
- File size is under 50MB
- File type is CSV or PDF

**View logs:**
- Check browser console for errors
- Check API route logs in your terminal
- Check Supabase logs in the dashboard

### "Bucket not found" error

Run this query in SQL Editor to check if bucket exists:
```sql
SELECT * FROM storage.buckets WHERE id = 'statements';
```

If empty, create the bucket using Method 1 or 2 above.

### Permission denied errors

Run this query to check policies:
```sql
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
```

Make sure policies for `statements` bucket exist.

## Testing File Upload

Quick test using curl:

```bash
curl -X POST https://your-project.supabase.co/storage/v1/object/statements/test.txt \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: text/plain" \
  --data-binary "Test file"
```

If successful, you'll see the file in Storage dashboard.

## Cleanup / Reset

To delete the bucket and all files:

```sql
DELETE FROM storage.objects WHERE bucket_id = 'statements';
DELETE FROM storage.buckets WHERE id = 'statements';
```

⚠️ **Warning**: This permanently deletes ALL statement files!

## Next Steps

- ✅ Bucket created
- ✅ Environment variables set
- ✅ Policies configured
- 🎉 Ready to upload statements!

For more information, see:
- [SUPABASE.md](./SUPABASE.md) - General Supabase setup
- [SELF_HOSTED.md](./SELF_HOSTED.md) - Self-hosted Supabase with Docker
- [CLAUDE.md](./CLAUDE.md) - Full project documentation
