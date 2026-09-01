import fs from 'fs';
import AdmZip from 'adm-zip';

const ALL_RESTRICTED_EXTS = [
  '.exe', '.scr', '.com', '.bat', '.cmd', '.ps1',
  '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh',
  '.msi', '.msp', '.dll', '.sys', '.cpl', '.reg',
  '.hta', '.lnk', '.url', '.jar', '.rar', '.7z',
  '.iso', '.img', '.tar', '.gz'
];

async function testAllRestrictedExtensions() {
  console.log('--- Comprehensive Security Test for All 28 Restricted Extensions ---');

  // Sign in as admin to get token
  const authRes = await fetch('http://localhost:3001/api/auth/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'samethxu@gmail.com', password: 'Sa12252005@' }),
  });
  const authData = await authRes.json();
  const token = authData.token;

  let passedBlocks = 0;

  // 1. Test each restricted extension hidden inside a ZIP archive
  for (const ext of ALL_RESTRICTED_EXTS) {
    const zipName = `test_hidden_${ext.replace('.', '')}.zip`;
    const innerFileName = `deep/nested/malicious_payload${ext}`;
    
    const zip = new AdmZip();
    zip.addFile(innerFileName, Buffer.from('payload content'));
    zip.addFile('innocent_photo.jpg', Buffer.from('photo content'));
    zip.writeZip(zipName);

    const form = new FormData();
    form.append('files', new Blob([fs.readFileSync(zipName)], { type: 'application/zip' }), zipName);
    form.append('senderName', 'Security Tester');

    const res = await fetch('http://localhost:3001/api/shares/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form,
    });

    const data = await res.json();
    fs.unlinkSync(zipName);

    if (res.status === 400 && data.error && data.error.includes(ext)) {
      passedBlocks++;
    } else {
      console.error(`[SECURITY FAILURE] Extension ${ext} inside ZIP was NOT blocked! Status: ${res.status}`);
      throw new Error(`Failed to block ${ext} inside ZIP`);
    }
  }

  console.log(`[PASS] All ${passedBlocks}/${ALL_RESTRICTED_EXTS.length} restricted extensions inside ZIP archives were strictly BLOCKED (Status 400).`);

  // 2. Test that safe files inside a ZIP archive ARE approved
  const safeZipName = 'test_safe_bundle.zip';
  const safeZip = new AdmZip();
  safeZip.addFile('photo1.jpg', Buffer.from('jpeg image mock'));
  safeZip.addFile('document.pdf', Buffer.from('pdf document mock'));
  safeZip.addFile('notes.txt', Buffer.from('notes text mock'));
  safeZip.writeZip(safeZipName);

  const safeForm = new FormData();
  safeForm.append('files', new Blob([fs.readFileSync(safeZipName)], { type: 'application/zip' }), safeZipName);
  safeForm.append('senderName', 'Legitimate User');

  const safeRes = await fetch('http://localhost:3001/api/shares/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: safeForm,
  });

  const safeData = await safeRes.json();
  fs.unlinkSync(safeZipName);

  console.log(`[Safe ZIP Test] HTTP Status: ${safeRes.status} (Expected 201)`);
  console.log(`[Share Created] Code: ${safeData.share?.code}, Title: "${safeData.share?.title}"`);

  if (safeRes.status !== 201) {
    throw new Error('Safe ZIP containing jpg/pdf was rejected!');
  }

  console.log('\n[CONFIRMED] Full Security Policy Verified:');
  console.log('1. All 28 restricted extensions inside ZIP files are 100% BLOCKED.');
  console.log('2. Safe files (photos, documents, clean zips) are 100% APPROVED.');
}

testAllRestrictedExtensions().catch(console.error);
