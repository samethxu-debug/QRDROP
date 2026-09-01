import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const usersFile = path.join(dataDir, 'users.json');
const sharesFile = path.join(dataDir, 'shares.json');
const inboxesFile = path.join(dataDir, 'inboxes.json');

function initStorage() {
  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(sharesFile)) {
    fs.writeFileSync(sharesFile, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(inboxesFile)) {
    fs.writeFileSync(inboxesFile, JSON.stringify([], null, 2));
  }
}

initStorage();

function readJSON(file) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return [];
  }
}

function writeJSON(file, data) {
  try {
    const tempFile = `${file}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, file);
    return true;
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
    return false;
  }
}

export const db = {
  // Users
  getUsers: () => readJSON(usersFile),
  findUserByEmail: (email) => {
    const users = readJSON(usersFile);
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },
  findUserByUsername: (username) => {
    const users = readJSON(usersFile);
    return users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  },
  findUserById: (id) => {
    const users = readJSON(usersFile);
    return users.find((u) => u.id === id);
  },
  createUser: (user) => {
    const users = readJSON(usersFile);
    users.push(user);
    writeJSON(usersFile, users);
    return user;
  },
  updateUser: (id, updates) => {
    const users = readJSON(usersFile);
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return null;
    users[index] = { ...users[index], ...updates };
    writeJSON(usersFile, users);
    return users[index];
  },
  deleteUser: (id) => {
    const users = readJSON(usersFile);
    const filtered = users.filter((u) => u.id !== id);
    writeJSON(usersFile, filtered);
    return true;
  },
  toggleUserRestriction: (id, isRestricted) => {
    const users = readJSON(usersFile);
    const user = users.find((u) => u.id === id);
    if (!user) return null;
    user.isRestricted = isRestricted !== undefined ? Boolean(isRestricted) : !user.isRestricted;
    user.restrictedAt = user.isRestricted ? new Date().toISOString() : null;
    writeJSON(usersFile, users);
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  },
  getUsersWithStats: () => {
    const users = readJSON(usersFile);
    const shares = readJSON(sharesFile);
    const inboxes = readJSON(inboxesFile);

    return users.map((user) => {
      const userShares = shares.filter((s) => s.userId === user.id);
      const userInboxes = inboxes.filter((i) => i.userId === user.id);
      const totalUploads = userShares.length;
      const totalDownloads = userShares.reduce((acc, s) => acc + (s.downloads || 0), 0);
      const totalBytes = userShares.reduce((acc, s) => {
        const shareSize = (s.files || []).reduce((fAcc, f) => fAcc + (f.size || 0), 0);
        return acc + shareSize;
      }, 0);

      const { passwordHash: _, ...safeUser } = user;
      return {
        ...safeUser,
        stats: {
          totalUploads,
          totalDownloads,
          totalBytes,
          activeInboxes: userInboxes.length,
        },
      };
    });
  },
  getAdminStats: () => {
    const users = readJSON(usersFile);
    const shares = readJSON(sharesFile);
    const inboxes = readJSON(inboxesFile);

    const totalUsers = users.length;
    const restrictedUsers = users.filter((u) => u.isRestricted).length;
    const totalShares = shares.length;
    const totalDownloads = shares.reduce((acc, s) => acc + (s.downloads || 0), 0);
    const totalInboxes = inboxes.length;
    const totalStorageBytes = shares.reduce((acc, s) => {
      return acc + (s.files || []).reduce((fAcc, f) => fAcc + (f.size || 0), 0);
    }, 0);

    return {
      totalUsers,
      restrictedUsers,
      totalShares,
      totalDownloads,
      totalInboxes,
      totalStorageBytes,
    };
  },

  // Shares
  getShares: () => readJSON(sharesFile),
  findShareByCode: (code) => {
    const shares = readJSON(sharesFile);
    return shares.find((s) => s.code.toLowerCase() === code.toLowerCase());
  },
  findSharesByUserId: (userId) => {
    const shares = readJSON(sharesFile);
    return shares.filter((s) => s.userId === userId);
  },
  createShare: (share) => {
    const shares = readJSON(sharesFile);
    shares.unshift(share);
    writeJSON(sharesFile, shares);
    return share;
  },
  updateShare: (code, updates) => {
    const shares = readJSON(sharesFile);
    const index = shares.findIndex((s) => s.code.toLowerCase() === code.toLowerCase());
    if (index === -1) return null;
    shares[index] = { ...shares[index], ...updates };
    writeJSON(sharesFile, shares);
    return shares[index];
  },
  deleteShare: (code) => {
    const shares = readJSON(sharesFile);
    const filtered = shares.filter((s) => s.code.toLowerCase() !== code.toLowerCase());
    writeJSON(sharesFile, filtered);
    return true;
  },
  incrementDownloadCount: (code) => {
    const shares = readJSON(sharesFile);
    const share = shares.find((s) => s.code.toLowerCase() === code.toLowerCase());
    if (share) {
      share.downloads = (share.downloads || 0) + 1;
      share.lastDownloadedAt = new Date().toISOString();
      writeJSON(sharesFile, shares);
    }
  },

  // Inboxes (Personal Receive QR & Confirmation Flow)
  getInboxes: () => readJSON(inboxesFile),
  findInboxById: (id) => {
    const inboxes = readJSON(inboxesFile);
    return inboxes.find((i) => i.id.toLowerCase() === id.toLowerCase());
  },
  findInboxByUserId: (userId) => {
    const inboxes = readJSON(inboxesFile);
    return inboxes.find((i) => i.userId === userId);
  },
  createInbox: (inbox) => {
    const inboxes = readJSON(inboxesFile);
    inboxes.unshift(inbox);
    writeJSON(inboxesFile, inboxes);
    return inbox;
  },
  updateInbox: (id, updates) => {
    const inboxes = readJSON(inboxesFile);
    const index = inboxes.findIndex((i) => i.id.toLowerCase() === id.toLowerCase());
    if (index === -1) return null;
    inboxes[index] = { ...inboxes[index], ...updates };
    writeJSON(inboxesFile, inboxes);
    return inboxes[index];
  },
  deleteInbox: (id) => {
    const inboxes = readJSON(inboxesFile);
    const filtered = inboxes.filter((i) => i.id.toLowerCase() !== id.toLowerCase());
    writeJSON(inboxesFile, filtered);
    return true;
  }
};
