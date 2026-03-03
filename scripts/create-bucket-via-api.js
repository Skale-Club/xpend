// Script to create Supabase Storage bucket via API
// Run with: node scripts/create-bucket-via-api.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables!');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createStatementsBucket() {
  console.log('🚀 Creating "statements" bucket...');

  // First, check if bucket exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('❌ Error listing buckets:', listError);
    return;
  }

  const bucketExists = buckets.some(b => b.id === 'statements');

  if (bucketExists) {
    console.log('✅ Bucket "statements" already exists!');
    return;
  }

  // Create the bucket
  const { data, error } = await supabase.storage.createBucket('statements', {
    public: true,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: ['text/csv', 'application/pdf']
  });

  if (error) {
    console.error('❌ Error creating bucket:', error);
    return;
  }

  console.log('✅ Bucket "statements" created successfully!');
  console.log('📦 Bucket details:', data);

  console.log('\n🎉 Done! You can now upload files to the statements bucket.');
  console.log('📝 Next step: Upload a test file from the app to verify.');
}

createStatementsBucket();
