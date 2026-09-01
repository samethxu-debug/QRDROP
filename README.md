# QR Drop - Fast QR File & Photo Sharing Platform

Fast, secure, cross-device photo and file sharing web application powered by QR code scanning, Google Authentication, and live peer-to-peer confirmation.

---

## Key Features

- **Instant QR Sharing**: Generate unique QR codes for direct file and folder downloads.
- **Personal Receive QR**: Host device displays a live receive QR code; senders scan to stream photos/files with real-time preview before accepting.
- **Google OAuth Authentication**: Strict Google sign-in gating for uploaders and hosts.
- **Security & Restriction Engine**: Deep recursive ZIP inspection automatically blocking 28 dangerous executable and script formats (`.exe`, `.bat`, `.ps1`, `.vbs`, etc.).
- **Admin Dashboard**: Full user management, platform analytics, and account restriction controls.
- **Email Notifications**: Instant HTML email notifications sent to user's connected Google account when incoming transfers arrive.
- **Bilingual & Responsive**: Khmer and English interfaces with mobile bottom touch navigation.

---

## Founder Information
- **Founder**: Korb Sameth
- **Facebook**: [https://www.facebook.com/korb.sameth/](https://www.facebook.com/korb.sameth/)

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
npm --prefix client install
```

### 2. Build Frontend
```bash
npm --prefix client run build
```

### 3. Start Server
```bash
node server/server.js
```
Or run `start-qr-drop.bat` on Windows.
