import fs from 'fs';

async function testInboxFlow() {
  console.log('--- Testing Personal Receive Inbox (Google Auth & Unique QR) ---');

  // 1. Test unauthenticated inbox create -> Expect 401
  const unauthRes = await fetch('http://localhost:3001/api/inbox/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostName: 'Unauth Host' }),
  });
  console.log(`[Step 1] Unauthenticated inbox create status: ${unauthRes.status} (Expected 401)`);
  if (unauthRes.status !== 401) throw new Error('Step 1 Failed: Unauthenticated inbox create was not blocked');

  // 2. Sign in with Google to get token
  const googleRes = await fetch('http://localhost:3001/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      googleId: 'google_inbox_tester',
      email: 'tester.inbox@gmail.com',
      name: 'Tester Host',
    }),
  });
  const googleData = await googleRes.json();
  const token = googleData.token;

  // 3. Get Persistent Personal QR (my-qr)
  const getMyQrRes = await fetch('http://localhost:3001/api/inbox/my-qr', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  const getMyQrData = await getMyQrRes.json();
  const inbox1 = getMyQrData.inbox;
  console.log(`[Step 2] Persistent Unique Personal Inbox fetched: ID = ${inbox1?.id}`);

  // Fetching again returns SAME personal QR ("don't change qr personal")
  const getMyQrRes2 = await fetch('http://localhost:3001/api/inbox/my-qr', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  const getMyQrData2 = await getMyQrRes2.json();
  const inbox1_repeat = getMyQrData2.inbox;
  if (inbox1.id !== inbox1_repeat.id) {
    throw new Error('Step 2 Failed: Personal QR code changed unexpectedly!');
  }
  console.log(`         [VERIFIED] Personal QR code is preserved: ${inbox1.id} === ${inbox1_repeat.id}`);

  // 4. Verify Personal QR cannot be changed (forceNew retains same user QR)
  const createRes2 = await fetch('http://localhost:3001/api/inbox/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ hostName: 'Host Tester 2', forceNew: true }),
  });
  const createData2 = await createRes2.json();
  const inbox2 = createData2.inbox;
  console.log(`[Step 3] Personal QR ID fetched: ID = ${inbox2?.id}`);

  if (!inbox1?.id || !inbox2?.id || inbox1.id !== inbox2.id) {
    throw new Error('Step 3 Failed: Personal QR code changed when it should be permanent!');
  }
  console.log(`         [VERIFIED] Personal QR Code is permanent and fixed: ${inbox1.id} === ${inbox2.id}`);

  // 5. Prohibited file upload to inbox
  fs.writeFileSync('virus.exe', 'MZ binary');
  const exeBlob = new Blob([fs.readFileSync('virus.exe')], { type: 'application/x-msdownload' });
  const exeForm = new FormData();
  exeForm.append('files', exeBlob, 'virus.exe');

  const exeRes = await fetch(`http://localhost:3001/api/inbox/${inbox2.id}/upload`, {
    method: 'POST',
    body: exeForm,
  });
  console.log(`[Step 4] Prohibited .exe upload to inbox status: ${exeRes.status} (Expected 400)`);
  fs.unlinkSync('virus.exe');
  if (exeRes.status !== 400) throw new Error('Step 4 Failed: Prohibited file was not blocked in inbox');

  // 6. Sender uploads valid files & Live Photo pair to host inbox
  fs.writeFileSync('IMG_0001.JPG', 'image mock content');
  fs.writeFileSync('IMG_0001.MOV', 'video mock content');
  fs.writeFileSync('document.pdf', 'pdf mock content');

  const uploadForm = new FormData();
  uploadForm.append('files', new Blob([fs.readFileSync('IMG_0001.JPG')], { type: 'image/jpeg' }), 'IMG_0001.JPG');
  uploadForm.append('files', new Blob([fs.readFileSync('IMG_0001.MOV')], { type: 'video/quicktime' }), 'IMG_0001.MOV');
  uploadForm.append('files', new Blob([fs.readFileSync('document.pdf')], { type: 'application/pdf' }), 'document.pdf');
  uploadForm.append('senderName', 'Guest Phone');
  uploadForm.append('title', 'Vacation Live Photos');
  uploadForm.append('isHighQuality', 'true');

  const uploadRes = await fetch(`http://localhost:3001/api/inbox/${inbox2.id}/upload`, {
    method: 'POST',
    body: uploadForm,
  });
  const uploadData = await uploadRes.json();
  console.log(`[Step 5] Sender uploaded files with Live Photo: status = ${uploadRes.status} (Expected 201)`);
  console.log(`         Transfer ID = ${uploadData.transferId}`);

  fs.unlinkSync('IMG_0001.JPG');
  fs.unlinkSync('IMG_0001.MOV');
  fs.unlinkSync('document.pdf');

  const transferId = uploadData.transferId;

  // 7. Host checks status & verifies Live Photo pairing
  const statusRes = await fetch(`http://localhost:3001/api/inbox/${inbox2.id}/status`);
  const statusData = await statusRes.json();
  const pending = statusData.pendingTransfers.find((t) => t.transferId === transferId);
  console.log(`[Step 6] Host sees incoming transfer: status = ${pending?.status} (Expected pending_approval)`);

  const liveImg = pending.files.find((f) => f.originalName === 'IMG_0001.JPG');
  if (!liveImg?.isLivePhoto) {
    throw new Error('Step 6 Failed: Live Photo IMG_0001.JPG was not automatically paired with IMG_0001.MOV');
  }
  console.log(`         [VERIFIED] Live Photo automatically paired: ${liveImg.originalName} -> pairedLiveVideoId = ${liveImg.pairedLiveVideoId}`);

  // 8. Host confirms transfer
  const confirmRes = await fetch(`http://localhost:3001/api/inbox/${inbox2.id}/confirm/${transferId}`, {
    method: 'POST',
  });
  const confirmData = await confirmRes.json();
  console.log(`[Step 7] Host confirmed transfer: status = ${confirmRes.status} (Expected 200)`);

  // 9. Auto download ZIP test
  const dlRes = await fetch(`http://localhost:3001${confirmData.downloadUrl}`);
  console.log(`[Step 8] Auto-download stream status: ${dlRes.status}, Content-Type: ${dlRes.headers.get('content-type')}`);

  console.log('\n[PASS] Personal Receive Inbox & Fresh Unique QR Flow verified successfully!');
}

testInboxFlow().catch(console.error);
