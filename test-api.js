import fs from 'fs';

async function test() {
  fs.writeFileSync('sample_photo.txt', 'This simulates a shared file or photo data.');

  const fileData = fs.readFileSync('sample_photo.txt');
  const blob = new Blob([fileData], { type: 'text/plain' });
  const formData = new FormData();
  formData.append('files', blob, 'sample_photo.txt');
  formData.append('title', 'រូបថតដំណើរកម្សាន្ត');
  formData.append('note', 'ស្កេន QR កូដនេះដើម្បីទទួលឯកសារ');
  formData.append('expiryHours', '24');

  const uploadRes = await fetch('http://localhost:3001/api/shares/upload', {
    method: 'POST',
    body: formData,
  });

  const uploadData = await uploadRes.json();
  console.log('Upload Status:', uploadRes.status);
  console.log('Created Share Code:', uploadData.share?.code);
  console.log('QR Code Data URL Length:', uploadData.share?.qrDataUrl?.length);
  console.log('Files in share:', uploadData.share?.files?.length);

  // Now test fetching the share by code
  const code = uploadData.share?.code;
  const getRes = await fetch(`http://localhost:3001/api/shares/${code}`);
  const getData = await getRes.json();
  console.log('Get Share Status:', getRes.status);
  console.log('Retrieved Title:', getData.share?.title);

  // Test downloading ZIP
  const zipRes = await fetch(`http://localhost:3001/api/shares/${code}/download-all`);
  console.log('Download ZIP Status:', zipRes.status, 'Content-Type:', zipRes.headers.get('content-type'));

  fs.unlinkSync('sample_photo.txt');
}

test().catch(console.error);
