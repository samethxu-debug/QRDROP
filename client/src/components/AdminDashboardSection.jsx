import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  ShieldAlert,
  ShieldCheck,
  HardDrive,
  Download,
  Trash2,
  Search,
  RefreshCw,
  FolderArchive,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  UserCheck,
  UserX,
  FileText
} from 'lucide-react';
import { safeFetchJson } from '../utils/api';

export default function AdminDashboardSection({ user, t }) {
  const [stats, setStats] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [sharesList, setSharesList] = useState([]);
  const [activeAdminTab, setActiveAdminTab] = useState('users'); // 'users' | 'shares'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const fetchAdminData = async () => {
    setLoading(true);
    setErrorMessage('');
    const token = localStorage.getItem('qr_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    // 1. Fetch Stats
    const statsRes = await safeFetchJson('/api/admin/stats', { headers });
    if (statsRes.ok && statsRes.data.stats) {
      setStats(statsRes.data.stats);
    } else {
      setErrorMessage(statsRes.error || 'Failed to load admin statistics.');
    }

    // 2. Fetch Users
    const usersRes = await safeFetchJson('/api/admin/users', { headers });
    if (usersRes.ok && usersRes.data.users) {
      setUsersList(usersRes.data.users);
    }

    // 3. Fetch Shares
    const sharesRes = await safeFetchJson('/api/admin/shares', { headers });
    if (sharesRes.ok && sharesRes.data.shares) {
      setSharesList(sharesRes.data.shares);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleToggleRestrict = async (targetUser) => {
    setActionLoadingId(targetUser.id);
    const token = localStorage.getItem('qr_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    const newStatus = !targetUser.isRestricted;
    const res = await safeFetchJson(`/api/admin/users/${targetUser.id}/restrict`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ isRestricted: newStatus }),
    });

    if (res.ok) {
      setFeedbackMessage(
        newStatus
          ? `User ${targetUser.name || targetUser.email} has been restricted.`
          : `User ${targetUser.name || targetUser.email} restriction has been lifted.`
      );
      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, isRestricted: newStatus } : u))
      );
      setTimeout(() => setFeedbackMessage(''), 4000);
    } else {
      setErrorMessage(res.error || 'Failed to update user restriction.');
    }
    setActionLoadingId(null);
  };

  const handleDeleteUser = async (targetUser) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${targetUser.name || targetUser.email}" and all their files?`)) {
      return;
    }

    setActionLoadingId(targetUser.id);
    const token = localStorage.getItem('qr_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    const res = await safeFetchJson(`/api/admin/users/${targetUser.id}`, {
      method: 'DELETE',
      headers,
    });

    if (res.ok) {
      setFeedbackMessage(`User ${targetUser.name || targetUser.email} deleted successfully.`);
      setUsersList((prev) => prev.filter((u) => u.id !== targetUser.id));
      setTimeout(() => setFeedbackMessage(''), 4000);
    } else {
      setErrorMessage(res.error || 'Failed to delete user.');
    }
    setActionLoadingId(null);
  };

  const handleDeleteShare = async (code) => {
    if (!window.confirm(`Delete transfer ${code} from server?`)) return;

    const token = localStorage.getItem('qr_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    const res = await safeFetchJson(`/api/admin/shares/${code}`, {
      method: 'DELETE',
      headers,
    });

    if (res.ok) {
      setFeedbackMessage(`Transfer ${code} deleted.`);
      setSharesList((prev) => prev.filter((s) => s.code !== code));
      setTimeout(() => setFeedbackMessage(''), 4000);
    } else {
      setErrorMessage(res.error || 'Failed to delete transfer.');
    }
  };

  const filteredUsers = usersList.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q))
    );
  });

  const filteredShares = sharesList.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (s.code && s.code.toLowerCase().includes(q)) ||
      (s.title && s.title.toLowerCase().includes(q)) ||
      (s.senderName && s.senderName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-bold uppercase tracking-wider mb-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>Admin Control Panel</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            {t.adminDashboardTitle || 'Website Administration'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {t.adminDashboardSubtitle || 'Monitor active platform users, track transfers, and manage user restrictions.'}
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAdminData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold transition self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-400' : ''}`} />
          <span>{t.refresh || 'Refresh Data'}</span>
        </button>
      </div>

      {/* Notifications */}
      {feedbackMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Users */}
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">{t.totalUsersLabel || 'Total Users'}</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white">
            {stats?.totalUsers || 0}
          </p>
          <p className="text-[11px] text-rose-400">
            {stats?.restrictedUsers || 0} {t.restrictedUsersLabel || 'Restricted Users'}
          </p>
        </div>

        {/* Active Shares */}
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">{t.activeSharesLabel || 'Active Shares'}</span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
              <FolderArchive className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white">
            {stats?.totalShares || 0}
          </p>
          <p className="text-[11px] text-teal-400">
            {stats?.totalDownloads || 0} {t.totalDownloadsLabel || 'Total Downloads'}
          </p>
        </div>

        {/* Storage Used */}
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">{t.storageUsedLabel || 'Storage Used'}</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white truncate">
            {formatFileSize(stats?.totalStorageBytes || 0)}
          </p>
          <p className="text-[11px] text-slate-400">
            Across active uploads
          </p>
        </div>

        {/* Active Inboxes */}
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">{t.receiveInboxesLabel || 'Receive Inboxes'}</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <QrCode className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white">
            {stats?.totalInboxes || 0}
          </p>
          <p className="text-[11px] text-emerald-400">
            Live Receive Channels
          </p>
        </div>

      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        
        {/* Controls Bar: Sub-tabs & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Sub-tabs */}
          <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveAdminTab('users')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                activeAdminTab === 'users'
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.usersTab || 'Users Management'} ({usersList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveAdminTab('shares')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                activeAdminTab === 'shares'
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.sharesTab || 'Live Shares'} ({sharesList.length})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
            />
          </div>

        </div>

        {/* Tab 1: Users Management */}
        {activeAdminTab === 'users' && (
          <div className="overflow-x-auto">
            {filteredUsers.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No users found.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Desktop & Mobile responsive cards / table */}
                <div className="hidden md:block">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="pb-3 px-3">User Profile</th>
                        <th className="pb-3 px-3">Google Email</th>
                        <th className="pb-3 px-3">Uploads</th>
                        <th className="pb-3 px-3">Downloads</th>
                        <th className="pb-3 px-3">Status</th>
                        <th className="pb-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredUsers.map((u) => {
                        const isFounder = (u.email || '').toLowerCase() === 'korb.sameth@gmail.com';
                        return (
                          <tr key={u.id} className="hover:bg-slate-950/40 transition">
                            
                            {/* Profile */}
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-300 flex items-center justify-center font-bold uppercase text-xs shrink-0">
                                  {u.name ? u.name.charAt(0) : 'U'}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-white truncate max-w-[140px]">{u.name}</p>
                                  <span className="text-[10px] text-slate-400">
                                    {isFounder ? 'Founder & Admin' : 'Google Member'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Email */}
                            <td className="py-3.5 px-3 font-mono text-[11px] text-slate-300">
                              {u.email}
                            </td>

                            {/* Uploads */}
                            <td className="py-3.5 px-3 font-semibold text-white">
                              {u.stats?.totalUploads || 0}
                            </td>

                            {/* Downloads */}
                            <td className="py-3.5 px-3 font-semibold text-white">
                              {u.stats?.totalDownloads || 0}
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-3">
                              {u.isRestricted ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold">
                                  <UserX className="w-3 h-3" />
                                  <span>Restricted</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                                  <UserCheck className="w-3 h-3" />
                                  <span>Active</span>
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-3 text-right">
                              {!isFounder && (
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={actionLoadingId === u.id}
                                    onClick={() => handleToggleRestrict(u)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                                      u.isRestricted
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                                        : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                                    }`}
                                  >
                                    {u.isRestricted ? 'Unrestrict' : 'Restrict User'}
                                  </button>

                                  <button
                                    type="button"
                                    disabled={actionLoadingId === u.id}
                                    onClick={() => handleDeleteUser(u)}
                                    className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition cursor-pointer"
                                    title="Delete User"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Card List */}
                <div className="md:hidden space-y-2.5">
                  {filteredUsers.map((u) => {
                    const isFounder = (u.email || '').toLowerCase() === 'korb.sameth@gmail.com';
                    return (
                      <div key={u.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 font-bold flex items-center justify-center text-xs shrink-0">
                              {u.name ? u.name.charAt(0) : 'U'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-white text-xs truncate">{u.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">{u.email}</p>
                            </div>
                          </div>

                          {u.isRestricted ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                              Restricted
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                          <span>Uploads: <strong className="text-white">{u.stats?.totalUploads || 0}</strong></span>
                          <span>Downloads: <strong className="text-white">{u.stats?.totalDownloads || 0}</strong></span>
                        </div>

                        {!isFounder && (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleToggleRestrict(u)}
                              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition text-center ${
                                u.isRestricted
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                              }`}
                            >
                              {u.isRestricted ? 'Unrestrict' : 'Restrict User'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-rose-400 text-xs font-bold"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Live Shares List */}
        {activeAdminTab === 'shares' && (
          <div className="space-y-3">
            {filteredShares.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No active transfers found.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {filteredShares.map((s) => (
                  <div key={s.code} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-teal-300 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                          {s.code}
                        </span>
                        <p className="text-xs font-bold text-white truncate max-w-xs sm:max-w-md">{s.title}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        By: <strong className="text-slate-300">{s.senderName}</strong> • {s.files?.length || 0} files • {s.downloads || 0} downloads
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteShare(s.code)}
                      className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400 transition shrink-0 cursor-pointer"
                      title="Delete Transfer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
