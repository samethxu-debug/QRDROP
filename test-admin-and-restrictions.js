import fs from 'fs';

async function testAdminFlow() {
  console.log('--- Testing Admin Dashboard, Credentials & User Restriction ---');

  // 1. Test Admin Login with provided credentials
  const adminLoginRes = await fetch('http://localhost:3001/api/auth/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'samethxu@gmail.com',
      password: 'Sa12252005@',
    }),
  });

  const adminData = await adminLoginRes.json();
  console.log(`[Test 1] Admin Password Login status: ${adminLoginRes.status} (Expected 200)`);
  console.log(`         Admin User: ${adminData.user?.name} (${adminData.user?.email})`);
  console.log(`         Admin Role: ${adminData.user?.role}`);

  if (adminLoginRes.status !== 200 || !adminData.user?.isAdmin) {
    throw new Error('Test 1 Failed: Admin login did not authenticate admin role');
  }

  const adminToken = adminData.token;

  // 2. Fetch Admin Stats
  const statsRes = await fetch('http://localhost:3001/api/admin/stats', {
    headers: { 'Authorization': `Bearer ${adminToken}` },
  });
  const statsData = await statsRes.json();
  console.log(`[Test 2] Admin Stats status: ${statsRes.status} (Expected 200)`);
  console.log(`         Stats: Users=${statsData.stats?.totalUsers}, Shares=${statsData.stats?.totalShares}`);

  if (statsRes.status !== 200) throw new Error('Test 2 Failed: Admin stats fetch failed');

  // 3. Create a test standard user
  const userRes = await fetch('http://localhost:3001/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      googleId: 'google_regular_user_99',
      email: 'spammer.test@gmail.com',
      name: 'Spammer Test',
    }),
  });
  const userData = await userRes.json();
  const userToken = userData.token;
  const targetUserId = userData.user.id;
  console.log(`[Test 3] Regular user created: ID=${targetUserId}, Email=${userData.user.email}`);

  // 4. Admin restricts the target user
  const restrictRes = await fetch(`http://localhost:3001/api/admin/users/${targetUserId}/restrict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ isRestricted: true }),
  });
  const restrictData = await restrictRes.json();
  console.log(`[Test 4] Admin restrict user status: ${restrictRes.status} (Expected 200)`);
  console.log(`         Target user isRestricted: ${restrictData.user?.isRestricted}`);

  // 5. Restricted user tries to upload -> Expect 403
  fs.writeFileSync('test_sample.txt', 'hello world test');
  const uploadForm = new FormData();
  uploadForm.append('files', new Blob([fs.readFileSync('test_sample.txt')], { type: 'text/plain' }), 'test_sample.txt');
  uploadForm.append('senderName', 'Spammer Test');

  const uploadBlockedRes = await fetch('http://localhost:3001/api/shares/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    body: uploadForm,
  });
  const uploadBlockedData = await uploadBlockedRes.json();
  console.log(`[Test 5] Restricted user upload status: ${uploadBlockedRes.status} (Expected 403)`);
  console.log(`         Error: "${uploadBlockedData.error}"`);

  if (uploadBlockedRes.status !== 403) {
    throw new Error('Test 5 Failed: Restricted user was NOT blocked with 403');
  }

  // 6. Admin lifts restriction
  const unrestrictRes = await fetch(`http://localhost:3001/api/admin/users/${targetUserId}/restrict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ isRestricted: false }),
  });
  console.log(`[Test 6] Admin un-restrict user status: ${unrestrictRes.status} (Expected 200)`);

  // 7. User tries upload again -> Expect 201 Success
  const uploadSuccessRes = await fetch('http://localhost:3001/api/shares/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    body: uploadForm,
  });
  const uploadSuccessData = await uploadSuccessRes.json();
  console.log(`[Test 7] Un-restricted user upload status: ${uploadSuccessRes.status} (Expected 201)`);
  console.log(`         Share Code: ${uploadSuccessData.share?.code}`);

  fs.unlinkSync('test_sample.txt');

  if (uploadSuccessRes.status !== 201) {
    throw new Error('Test 7 Failed: User was unable to upload after restriction lifted');
  }

  console.log('\n[PASS] All Admin Dashboard and User Restriction tests PASSED successfully!');
}

testAdminFlow().catch(console.error);
