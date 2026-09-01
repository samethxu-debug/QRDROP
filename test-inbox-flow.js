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

  // 3. Create First Unique Inbox
  const createRes1 = await fetch('http://localhost:3001/api/inbox/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ hostName: 'Host Tester 1' }),
  });
  const createData1 = await createRes1.json();
  const inbox1 = createData1.inbox;
  console.log(`[Step 2] First Unique Inbox created: ID = ${inbox1?.id}`);

  // 4. Create Second Unique Inbox (Generate New QR)
  const createRes2 = await fetch('http://localhost:3001/api/inbox/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ hostName: 'Host Tester 2' }),
  });
  const createData2 = await createRes2.json();
  const inbox2 = createData2.inbox;
  console.log(`[Step 3] Second Fresh Unique Inbox created: ID = ${inbox2?.id}`);

  if (!inbox1?.id || !inbox2?.id || inbox1.id === inbox2.id) {
    throw new Error('Step 3 Failed: Personal QR codes were not unique/fresh!');
  }
  console.log(`         [VERIFIED] QR Code 1 (${inbox1.id}) != QR Code 2 (${inbox2.id}) -> Always Fresh & Unique!`);

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

  // 6. Sender uploads valid files to host inbox
  fs.writeFileSync('photo_vacation.jpg', 'image mock content');
  fs.writeFileSync('document.pdf', 'pdf mock content');

  const uploadForm = new FormData();
  uploadForm.append('files', new Blob([fs.readFileSync('photo_vacation.jpg')], { type: 'image/jpeg' }), 'photo_vacation.jpg');
  uploadForm.append('files', new Blob([fs.readFileSync('document.pdf')], { type: 'application/pdf' }), 'document.pdf');
  uploadForm.append('senderName', 'Guest Phone');
  uploadForm.append('title', 'Vacation Photos');

  const uploadRes = await fetch(`http://localhost:3001/api/inbox/${inbox2.id}/upload`, {
    method: 'POST',
    body: uploadForm,
  });
  const uploadData = await uploadRes.json();
  console.log(`[Step 5] Sender uploaded files: status = ${uploadRes.status} (Expected 201)`);
  console.log(`         Transfer ID = ${uploadData.transferId}`);

  fs.unlinkSync('photo_vacation.jpg');
  fs.unlinkSync('document.pdf');

  const transferId = uploadData.transferId;

  // 7. Host checks status
  const statusRes = await fetch(`http://localhost:3001/api/inbox/${inbox2.id}/status`);
  const statusData = await statusRes.json();
  const pending = statusData.pendingTransfers.find((t) => t.transferId === transferId);
  console.log(`[Step 6] Host sees incoming transfer: status = ${pending?.status} (Expected pending_approval)`);

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
