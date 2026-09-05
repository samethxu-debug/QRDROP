import fs from 'fs';

const BASE = 'http://localhost:3001';

async function runComprehensiveAudit() {
  console.log('=====================================================');
  console.log('   QR DROP - COMPREHENSIVE ALL-FUNCTION AUDIT TEST   ');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // ---------------------------------------------------------
    // TEST 1: Google Auth (Admin & Regular User)
    // ---------------------------------------------------------
    console.log('[1] Testing Google Authentication...');
    const authRes = await fetch(`${BASE}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        googleId: 'admin_user_001',
        email: 'korb.sameth@gmail.com',
        name: 'Korb Sameth (Founder & Admin)',
      }),
    });
    const authData = await authRes.json();
    assert(authRes.status === 200 && authData.token, 'Google Login returns 200 with JWT token');
    const adminToken = authData.token;

    // Me endpoint check
    const meRes = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.user?.email === 'korb.sameth@gmail.com', 'GET /api/auth/me returns current user info');

    // ---------------------------------------------------------
    // TEST 2: Personal Receive Inbox (Permanent, Unlimited)
    // ---------------------------------------------------------
    console.log('\n[2] Testing Personal Receive Inbox (Permanent Identity & Unlimited Expiry)...');
    const myQrRes = await fetch(`${BASE}/api/inbox/my-qr`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const myQrData = await myQrRes.json();
    assert(myQrRes.status === 200 && myQrData.inbox?.id?.startsWith('INB-'), `GET /api/inbox/my-qr returned inbox ID: ${myQrData.inbox?.id}`);
    assert(myQrData.inbox?.expiresAt === null && myQrData.inbox?.isPermanent === true, 'Personal Inbox has unlimited lifetime (expiresAt: null, isPermanent: true)');

    const inboxId = myQrData.inbox.id;

    // Call my-qr a second time -> MUST return the EXACT SAME inbox ID
    const myQrRes2 = await fetch(`${BASE}/api/inbox/my-qr`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const myQrData2 = await myQrRes2.json();
    assert(myQrData2.inbox?.id === inboxId, 'Personal QR ID is permanent and never changes across logins');

    // ---------------------------------------------------------
    // TEST 3: Sender Uploads to Personal QR Inbox (with Live Photo pair & HD toggle)
    // ---------------------------------------------------------
    console.log('\n[3] Testing Sender Upload to Personal Inbox (Live Photo & HD)...');
    fs.writeFileSync('sample_photo.jpg', 'mock jpg binary data');
    fs.writeFileSync('sample_photo.mov', 'mock mov binary data');
    fs.writeFileSync('report.pdf', 'mock pdf binary data');

    const inboxForm = new FormData();
    inboxForm.append('files', new Blob([fs.readFileSync('sample_photo.jpg')], { type: 'image/jpeg' }), 'sample_photo.jpg');
    inboxForm.append('files', new Blob([fs.readFileSync('sample_photo.mov')], { type: 'video/quicktime' }), 'sample_photo.mov');
    inboxForm.append('files', new Blob([fs.readFileSync('report.pdf')], { type: 'application/pdf' }), 'report.pdf');
    inboxForm.append('senderName', 'Guest Sender');
    inboxForm.append('title', 'Project Photos & Reports');
    inboxForm.append('isHighQuality', 'true');

    const inboxUploadRes = await fetch(`${BASE}/api/inbox/${inboxId}/upload`, {
      method: 'POST',
      body: inboxForm,
    });
    const inboxUploadData = await inboxUploadRes.json();
    assert(inboxUploadRes.status === 201 && inboxUploadData.transferId, `Sender uploaded to inbox ${inboxId} (Transfer ID: ${inboxUploadData.transferId})`);

    const transferId = inboxUploadData.transferId;

    // Cleanup temp files
    fs.unlinkSync('sample_photo.jpg');
    fs.unlinkSync('sample_photo.mov');
    fs.unlinkSync('report.pdf');

    // ---------------------------------------------------------
    // TEST 4: Host Inbox Status & Auto View-Approve
    // ---------------------------------------------------------
    console.log('\n[4] Testing Inbox Status, Live Photo Pairing & Auto View-Approval...');
    const statusRes = await fetch(`${BASE}/api/inbox/${inboxId}/status`);
    const statusData = await statusRes.json();
    assert(statusRes.status === 200, 'Host inbox status check returned 200');

    const pending = (statusData.pendingTransfers || []).find((t) => t.transferId === transferId);
    assert(pending && pending.status === 'pending_approval', 'Host sees transfer status "pending_approval"');

    const liveImg = pending?.files?.find((f) => f.originalName === 'sample_photo.jpg');
    assert(liveImg?.isLivePhoto && liveImg?.pairedLiveVideoId, 'Live Photo JPEG automatically paired with MOV video');

    // Test Host Approve View Endpoint
    const approveViewRes = await fetch(`${BASE}/api/inbox/${inboxId}/approve-view/${transferId}`, { method: 'POST' });
    const approveViewData = await approveViewRes.json();
    assert(approveViewRes.status === 200 && approveViewData.transfer?.isViewApproved === true, 'Host POST /approve-view sets isViewApproved: true');

    // Host Previews photo file after view approval
    const previewFileId = liveImg.id;
    const previewRes = await fetch(`${BASE}/api/inbox/${inboxId}/preview/${previewFileId}`);
    assert(previewRes.status === 200, `Host preview image status: ${previewRes.status} 200 OK`);

    // ---------------------------------------------------------
    // TEST 5: Host Confirm & Auto-Download ZIP
    // ---------------------------------------------------------
    console.log('\n[5] Testing Host Confirm & Auto-Download...');
    const confirmRes = await fetch(`${BASE}/api/inbox/${inboxId}/confirm/${transferId}`, { method: 'POST' });
    const confirmData = await confirmRes.json();
    assert(confirmRes.status === 200 && confirmData.downloadUrl, 'Host POST /confirm returns 200 with downloadUrl');

    const dlRes = await fetch(`${BASE}${confirmData.downloadUrl}`);
    assert(dlRes.status === 200 && dlRes.headers.get('content-type') === 'application/zip', 'Download stream returns 200 OK with application/zip');

    // ---------------------------------------------------------
    // TEST 6: Direct File Share Creation & Password Protection
    // ---------------------------------------------------------
    console.log('\n[6] Testing Direct File Share Upload (With Password & Security Filter)...');
    fs.writeFileSync('vacation.jpg', 'vacation image mock');
    fs.writeFileSync('notes.txt', 'some notes text');

    const shareForm = new FormData();
    shareForm.append('files', new Blob([fs.readFileSync('vacation.jpg')], { type: 'image/jpeg' }), 'vacation.jpg');
    shareForm.append('files', new Blob([fs.readFileSync('notes.txt')], { type: 'text/plain' }), 'notes.txt');
    shareForm.append('title', 'Secret Vacation Photos');
    shareForm.append('password', 'secret123');
    shareForm.append('expiryHours', '24');

    const shareUploadRes = await fetch(`${BASE}/api/shares/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: shareForm,
    });
    const shareUploadData = await shareUploadRes.json();
    assert(shareUploadRes.status === 201 && shareUploadData.share?.code, `Direct Share created with code: ${shareUploadData.share?.code}`);
    const shareCode = shareUploadData.share?.code;

    fs.unlinkSync('vacation.jpg');
    fs.unlinkSync('notes.txt');

    // Fetch share info without password -> Expect 401 Protected
    const getShareUnauth = await fetch(`${BASE}/api/shares/${shareCode}`);
    assert(getShareUnauth.status === 401, 'Fetching password protected share without password returns 401');

    // Unlock share with wrong password -> Expect 403
    const unlockFailRes = await fetch(`${BASE}/api/shares/${shareCode}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrongpassword' }),
    });
    assert(unlockFailRes.status === 403, 'Unlock with wrong password returns 403 Forbidden');

    // Unlock share with correct password -> Expect 200
    const unlockSuccessRes = await fetch(`${BASE}/api/shares/${shareCode}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secret123' }),
    });
    const unlockSuccessData = await unlockSuccessRes.json();
    assert(unlockSuccessRes.status === 200 && unlockSuccessData.downloadToken, 'Unlock with correct password returns 200 OK & downloadToken');

    // ---------------------------------------------------------
    // TEST 7: Malware Filtering & Skipped Restricted Files
    // ---------------------------------------------------------
    console.log('\n[7] Testing Malware Blockers & Skipping Restricted Entries...');
    fs.writeFileSync('bad.exe', 'MZ binary');
    const badForm = new FormData();
    badForm.append('files', new Blob([fs.readFileSync('bad.exe')], { type: 'application/x-msdownload' }), 'bad.exe');

    const badRes = await fetch(`${BASE}/api/shares/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: badForm,
    });
    assert(badRes.status === 400, 'Direct upload of pure .exe file is blocked with 400 Bad Request');
    fs.unlinkSync('bad.exe');

    // ---------------------------------------------------------
    // TEST 8: Smart Routing Check for INB- Codes on /api/shares/:code
    // ---------------------------------------------------------
    console.log('\n[8] Testing Smart Routing for INB- Inbox Code Lookup...');
    const inbLookupRes = await fetch(`${BASE}/api/shares/${inboxId}`);
    const inbLookupData = await inbLookupRes.json();
    assert(inbLookupRes.status === 200 && inbLookupData.isInbox === true && inbLookupData.inboxId === inboxId, `GET /api/shares/${inboxId} recognizes inbox code and returns isInbox: true`);

    // ---------------------------------------------------------
    // TEST 9: My Transfers History Endpoint
    // ---------------------------------------------------------
    console.log('\n[9] Testing My Transfers History Endpoint...');
    const historyRes = await fetch(`${BASE}/api/shares/my-shares`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const historyData = await historyRes.json();
    assert(historyRes.status === 200, 'GET /api/shares/my-shares returns 200 OK');
    assert(Array.isArray(historyData.shares) && Array.isArray(historyData.inboxTransfers), 'History response contains shares array and inboxTransfers array');

    // ---------------------------------------------------------
    // TEST 10: Admin Dashboard Endpoints
    // ---------------------------------------------------------
    console.log('\n[10] Testing Admin Dashboard APIs...');
    const adminStatsRes = await fetch(`${BASE}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminStatsData = await adminStatsRes.json();
    assert(adminStatsRes.status === 200 && typeof adminStatsData.stats?.totalUsers === 'number', 'GET /api/admin/stats returns site statistics');

    const adminUsersRes = await fetch(`${BASE}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminUsersData = await adminUsersRes.json();
    assert(adminUsersRes.status === 200 && Array.isArray(adminUsersData.users), 'GET /api/admin/users returns registered users list');

    console.log('\n=====================================================');
    console.log(`   AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Audit Exception Error:', err);
    process.exit(1);
  }
}

runComprehensiveAudit();
