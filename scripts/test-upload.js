// Test upload to Supabase Storage
// Run with: node scripts/test-upload.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testUpload() {
  console.log('🧪 Testing Supabase Storage upload...\n');

  // Create a test CSV content
  const testContent = `Date,Description,Amount,Type
2026-03-01,Test Transaction 1,100.00,credit
2026-03-02,Test Transaction 2,50.00,debit
2026-03-03,Test Transaction 3,75.50,credit`;

  const testAccountId = 'test-account-123';
  const timestamp = Date.now();
  const filePath = `${testAccountId}/2026-03/${timestamp}_test-statement.csv`;

  console.log(`📁 Uploading to: statements/${filePath}`);

  // Upload the file
  const { data, error } = await supabase.storage
    .from('statements')
    .upload(filePath, Buffer.from(testContent), {
      contentType: 'text/csv',
      upsert: false,
    });

  if (error) {
    console.error('❌ Upload failed:', error);
    return;
  }

  console.log('✅ File uploaded successfully!');
  console.log('📦 Upload data:', data);

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('statements')
    .getPublicUrl(filePath);

  console.log('\n🔗 Public URL:', urlData.publicUrl);

  // List files in the test account folder
  const { data: files, error: listError } = await supabase.storage
    .from('statements')
    .list(`${testAccountId}/2026-03`);

  if (listError) {
    console.error('❌ Error listing files:', listError);
    return;
  }

  console.log(`\n📂 Files in test folder (${files.length}):`);
  files.forEach(file => {
    console.log(`   - ${file.name} (${(file.metadata.size / 1024).toFixed(2)} KB)`);
  });

  // Cleanup - delete test file
  console.log('\n🧹 Cleaning up test file...');
  const { error: deleteError } = await supabase.storage
    .from('statements')
    .remove([filePath]);

  if (deleteError) {
    console.error('❌ Error deleting test file:', deleteError);
  } else {
    console.log('✅ Test file deleted successfully!');
  }

  console.log('\n🎉 Upload test completed successfully!');
  console.log('✅ Your Supabase Storage is working correctly.');
}

testUpload();
