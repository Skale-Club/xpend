# Spending Tracker - Supabase Setup

## Option 1: Local SQLite (Default - Prisma)

The app uses SQLite by default. Just run:
```bash
npm run dev
```

## Option 2: Supabase

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Wait for the project to be ready

### 2. Set Up the Database

1. Go to SQL Editor in your Supabase dashboard
2. Copy the contents of `supabase/schema.sql` and run it
3. This creates all tables and default categories

### 3. Configure Environment Variables

Update `.env`:
```env
NEXT_PUBLIC_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Get these values from:
- **URL**: Project Settings > API > Project URL
- **Anon Key**: Project Settings > API > Project API keys > anon public

### 4. Update API Routes

The Supabase API routes are in `/api/supabase/`. To use them, update the imports in your pages:

```typescript
// Change from:
const res = await fetch('/api/accounts');

// To:
const res = await fetch('/api/supabase/accounts');
```

Or rename the folders to swap the backends.

## Supabase Features

With Supabase you also get:
- **Authentication**: Add user login/signup
- **Real-time**: Live updates across clients
- **Storage**: Upload statement files to cloud
- **Edge Functions**: Server-side processing

### Adding Authentication (Optional)

```typescript
// In your components
import { supabase } from '@/lib/supabase';

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});

// Sign out
await supabase.auth.signOut();

// Get current user
const { data: { user } } = await supabase.auth.getUser();
```

### Adding File Storage (Optional)

```typescript
// Upload statement file
const { data, error } = await supabase.storage
  .from('statements')
  .upload(`${userId}/${file.name}`, file);

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('statements')
  .getPublicUrl(path);
```
