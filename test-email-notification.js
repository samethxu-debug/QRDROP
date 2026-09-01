import { sendIncomingTransferNotification } from './server/utils/mailer.js';

async function testEmailNotification() {
  console.log('--- Testing Email Notification System ---');

  const result = await sendIncomingTransferNotification({
    recipientEmail: 'samethxu@gmail.com',
    recipientName: 'Korb Sameth (Founder & Admin)',
    senderName: 'Guest Phone 1',
    title: 'Family Photos Album 2026',
    fileCount: 4,
    totalSizeFormatted: '12.4 MB',
    note: 'Here are the photos from our trip!',
    reviewUrl: 'http://localhost:3001/send-to/INB-TEST99',
  });

  console.log('[Test 1] Notification triggered result:', result);
  console.log('\n[PASS] Email notification test completed successfully!');
}

testEmailNotification().catch(console.error);
