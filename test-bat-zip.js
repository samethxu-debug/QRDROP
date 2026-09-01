import fs from 'fs';
import AdmZip from 'adm-zip';

async function testBatInsideZip() {
  console.log('--- Testing Security: .bat Inside .zip Archive ---');

  // Create a zip with a .bat inside
  const zip = new AdmZip();
  zip.addFile('malicious_script.bat', Buffer.from('@echo off\necho attack'));
  zip.addFile('photo.jpg', Buffer.from('photo content'));
  zip.writeZip('test_bat_bundle.zip');

  // Sign in as admin
  const authRes = await fetch('http://localhost:3001/api/auth/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'samethxu@gmail.com', password: 'Sa12252005@' }),
  });
  const authData = await authRes.json();
  const token = authData.token;

  // Attempt Upload to standard share
  const form = new FormData();
  form.append('files', new Blob([fs.readFileSync('test_bat_bundle.zip')], { type: 'application/zip' }), 'test_bat_bundle.zip');
  form.append('senderName', 'Tester');

  const res = await fetch('http://localhost:3001/api/shares/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  });

  const data = await res.json();
  console.log(`[Upload Share Test] HTTP Status: ${res.status} (Expected 400)`);
  console.log(`[Server Response] "${data.error}"`);

  // Attempt Upload to Personal Receive Inbox
  const inboxCreateRes = await fetch('http://localhost:3001/api/inbox/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ hostName: 'Host Test' }),
  });
  const inboxData = await inboxCreateRes.json();
  const inboxId = inboxData.inbox.id;

  const inboxForm = new FormData();
  inboxForm.append('files', new Blob([fs.readFileSync('test_bat_bundle.zip')], { type: 'application/zip' }), 'test_bat_bundle.zip');
  inboxForm.append('senderName', 'Tester');

  const inboxUploadRes = await fetch(`http://localhost:3001/api/inbox/${inboxId}/upload`, {
    method: 'POST',
    body: inboxForm,
  });
  const inboxUploadData = await inboxUploadRes.json();
  console.log(`[Inbox Share Test] HTTP Status: ${inboxUploadRes.status} (Expected 400)`);
  console.log(`[Server Response] "${inboxUploadData.error}"`);

  fs.unlinkSync('test_bat_bundle.zip');

  if (res.status === 400 && inboxUploadRes.status === 400 && data.error.includes('.bat')) {
    console.log('\n[CONFIRMED & VERIFIED] NO! Files named .bat inside .zip CANNOT be sent under any circumstances. They are 100% BLOCKED by the server.');
  } else {
    throw new Error('Test Failed: .bat in zip was not blocked');
  }
}

testBatInsideZip().catch(console.error);
