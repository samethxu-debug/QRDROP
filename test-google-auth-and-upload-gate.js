import fs from 'fs';

async function testGoogleAuthAndGate() {
  console.log('--- Testing Google Sign-In & Upload Authentication Gate ---');

  // 1. Unauthenticated Upload Rejection Test
  fs.writeFileSync('sample_test.png', 'fake image bytes');
  const unauthForm = new FormData();
  unauthForm.append('files', new Blob([fs.readFileSync('sample_test.png')], { type: 'image/png' }), 'sample_test.png');
  unauthForm.append('title', 'Unauthenticated Test');

  const unauthRes = await fetch('http://localhost:3001/api/shares/upload', {
    method: 'POST',
    body: unauthForm,
  });

  console.log(`[Test 1] Unauthenticated upload status: ${unauthRes.status} (Expected 401)`);
  if (unauthRes.status !== 401) {
    throw new Error('Test 1 Failed: Unauthenticated upload was not blocked!');
  }

  // 2. Google Sign-In Test
  const googleRes = await fetch('http://localhost:3001/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      googleId: 'google_test_12345',
      email: 'korb.sameth@gmail.com',
      name: 'Korb Sameth',
    }),
  });

  const googleData = await googleRes.json();
  console.log(`[Test 2] Google Sign-In status: ${googleRes.status} (Expected 200)`);
  console.log(`         User: ${googleData.user?.name} (${googleData.user?.email})`);
  console.log(`         Provider: ${googleData.user?.authProvider}`);

  if (googleRes.status !== 200 || !googleData.token) {
    throw new Error('Test 2 Failed: Google authentication failed');
  }

  const token = googleData.token;

  // 3. Verify /api/auth/me
  const meRes = await fetch('http://localhost:3001/api/auth/me', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const meData = await meRes.json();
  console.log(`[Test 3] Token validation status: ${meRes.status} (Expected 200)`);
  if (meRes.status !== 200 || meData.user?.email !== 'korb.sameth@gmail.com') {
    throw new Error('Test 3 Failed: /api/auth/me failed');
  }

  // 4. Authenticated Upload Test
  const authForm = new FormData();
  authForm.append('files', new Blob([fs.readFileSync('sample_test.png')], { type: 'image/png' }), 'sample_test.png');
  authForm.append('title', 'Authenticated Upload');

  const authRes = await fetch('http://localhost:3001/api/shares/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: authForm,
  });

  const authData = await authRes.json();
  console.log(`[Test 4] Authenticated upload status: ${authRes.status} (Expected 201)`);
  console.log(`         Share Code: ${authData.share?.code}`);
  console.log(`         Created by: ${authData.share?.senderName}`);

  fs.unlinkSync('sample_test.png');

  if (authRes.status !== 201 || !authData.share?.code) {
    throw new Error('Test 4 Failed: Authenticated upload failed');
  }

  console.log('\n[PASS] Google Sign-In & Upload Authentication Gate tests PASSED successfully!');
}

testGoogleAuthAndGate().catch(console.error);
