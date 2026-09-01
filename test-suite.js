import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { getLocalIpAddress } from './server/utils/network.js';

async function runTests() {
  console.log('--- Starting Automated Test Suite ---');

  // Test 1: Verify getLocalIpAddress
  const localIp = getLocalIpAddress();
  console.log(`[Test 1] Local IP detected: ${localIp}`);
  if (!localIp || localIp === '127.0.0.1') {
    console.warn('Warning: localIp is loopback, expected LAN IP if connected to network.');
  }

  // Obtain Google auth token for authorized tests
  const googleRes = await fetch('http://localhost:3001/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      googleId: 'test_google_suite_id',
      email: 'test.suite@gmail.com',
      name: 'Test Suite Runner',
    }),
  });
  const googleData = await googleRes.json();
  const token = googleData.token;

  // Test 2: Upload a restricted .exe file directly
  fs.writeFileSync('malicious.exe', 'MZ dummy binary');
  const exeBlob = new Blob([fs.readFileSync('malicious.exe')], { type: 'application/x-msdownload' });
  const exeForm = new FormData();
  exeForm.append('files', exeBlob, 'malicious.exe');

  const exeRes = await fetch('http://localhost:3001/api/shares/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: exeForm,
  });
  const exeData = await exeRes.json();
  console.log(`[Test 2] Direct .exe upload status: ${exeRes.status} (Expected 400)`);
  console.log(`         Error message: "${exeData.error}"`);
  fs.unlinkSync('malicious.exe');

  if (exeRes.status !== 400) {
    throw new Error('Test 2 Failed: Prohibited .exe was not blocked!');
  }

  // Test 3: Upload a restricted .bat file directly
  fs.writeFileSync('script.bat', '@echo off');
  const batBlob = new Blob([fs.readFileSync('script.bat')], { type: 'text/plain' });
  const batForm = new FormData();
  batForm.append('files', batBlob, 'script.bat');

  const batRes = await fetch('http://localhost:3001/api/shares/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: batForm,
  });
  const batData = await batRes.json();
  console.log(`[Test 3] Direct .bat upload status: ${batRes.status} (Expected 400)`);
  console.log(`         Error message: "${batData.error}"`);
  fs.unlinkSync('script.bat');

  if (batRes.status !== 400) {
    throw new Error('Test 3 Failed: Prohibited .bat was not blocked!');
  }

  // Test 4: Upload a ZIP containing a hidden .exe file inside
  const zip = new AdmZip();
  zip.addFile('safe_document.txt', Buffer.from('Hello world'));
  zip.addFile('hidden_virus.exe', Buffer.from('MZ binary dummy'));
  zip.writeZip('test_bundle.zip');

  const zipBlob = new Blob([fs.readFileSync('test_bundle.zip')], { type: 'application/zip' });
  const zipForm = new FormData();
  zipForm.append('files', zipBlob, 'test_bundle.zip');

  const zipRes = await fetch('http://localhost:3001/api/shares/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: zipForm,
  });
  const zipData = await zipRes.json();
  console.log(`[Test 4] ZIP with hidden .exe upload status: ${zipRes.status} (Expected 400)`);
  console.log(`         Error message: "${zipData.error}"`);
  fs.unlinkSync('test_bundle.zip');

  if (zipRes.status !== 400) {
    throw new Error('Test 4 Failed: Hidden executable inside ZIP was not blocked!');
  }

  // Test 5: Upload valid safe files and check auto-title & LAN IP in shareUrl
  fs.writeFileSync('photo1.jpg', 'fake image bytes');
  const safeBlob = new Blob([fs.readFileSync('photo1.jpg')], { type: 'image/jpeg' });
  const safeForm = new FormData();
  safeForm.append('files', safeBlob, 'photo1.jpg');
  safeForm.append('folderName', 'HolidayTrip2026');

  const safeRes = await fetch('http://localhost:3001/api/shares/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: safeForm,
  });
  const safeData = await safeRes.json();
  console.log(`[Test 5] Valid upload status: ${safeRes.status} (Expected 201)`);
  console.log(`         Share Code: ${safeData.share?.code}`);
  console.log(`         Auto Title: "${safeData.share?.title}"`);
  console.log(`         Share URL : "${safeData.share?.shareUrl}"`);
  fs.unlinkSync('photo1.jpg');

  if (safeRes.status !== 201 || !safeData.share?.shareUrl) {
    throw new Error('Test 5 Failed: Safe upload failed!');
  }

  console.log('\n[PASS] All automated security and functionality tests PASSED successfully!');
}

runTests().catch(console.error);
