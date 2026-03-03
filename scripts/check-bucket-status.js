// Script to check Supabase Storage bucket status
// Run with: node scripts/check-bucket-status.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkBucketStatus() {
  console.log('🔍 Checking Supabase Storage buckets...\n');

  // List all buckets
  const { data: buckets, error } = await supabase.storage.listBuckets();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (buckets.length === 0) {
    console.log('⚠️  No buckets found!');
    return;
  }

  console.log(`✅ Found ${buckets.length} bucket(s):\n`);

  buckets.forEach(bucket => {
    console.log(`📦 ${bucket.id}`);
    console.log(`   Name: ${bucket.name}`);
    console.log(`   Public: ${bucket.public ? '✅ Yes' : '❌ No'}`);
    console.log(`   Created: ${new Date(bucket.created_at).toLocaleString()}`);
    console.log(`   Updated: ${new Date(bucket.updated_at).toLocaleString()}`);
    console.log(`   File size limit: ${bucket.file_size_limit ? (bucket.file_size_limit / 1024 / 1024).toFixed(0) + ' MB' : 'Unlimited'}`);
    console.log(`   Allowed MIME types: ${bucket.allowed_mime_types ? bucket.allowed_mime_types.join(', ') : 'All'}`);
    console.log('');
  });

  // Check for statements bucket specifically
  const statementsBucket = buckets.find(b => b.id === 'statements');

  if (statementsBucket) {
    console.log('✅ "statements" bucket is ready!');
    console.log('🚀 You can now upload files from the app.');
  } else {
    console.log('⚠️  "statements" bucket not found.');
    console.log('💡 Run: node scripts/create-bucket-via-api.js');
  }
}

checkBucketStatus();
