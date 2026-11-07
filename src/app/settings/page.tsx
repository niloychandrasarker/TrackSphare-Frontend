'use client';

import { useEffect, useState } from 'react';
import { Settings, User, Lock, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const [user, setUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function getToken() {
    return localStorage.getItem('adminToken') || localStorage.getItem('accessToken') || '';
  }

  useEffect(() => {
    fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setUser(d.data);
          setName(d.data.name);
        }
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const body: Record<string, string> = { name };
      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      const res = await fetch('/api/v1/users/profile', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        setMessage('Profile updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to update settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-400" />
          Account & Privacy Settings
        </h1>
        <p className="text-gray-400 text-sm mt-1">Manage profile, password security, and system preferences</p>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {message}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" /> Personal Information
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Email Address</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-gray-400 text-sm cursor-not-allowed"
              />
              <p className="text-[11px] text-gray-500 mt-1">Account email address is verified and locked to this ID.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Assigned Role</label>
              <span className="inline-block px-3 py-1 bg-gray-800 text-indigo-300 rounded-lg text-xs font-mono">
                {user?.role || 'device_user'}
              </span>
            </div>
          </div>
        </div>

        {/* Password Security */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-400" /> Security & Password
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Current Password</label>
              <input
                type="password"
                placeholder="Leave blank to keep unchanged"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">New Password</label>
              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="p-4 bg-indigo-950/20 border border-indigo-900/40 rounded-2xl flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-indigo-400 shrink-0" />
          <p className="text-xs text-gray-400 leading-relaxed">
            TrackSphere employs parameterized SQL queries, bcrypt salt encryption, short-lived rotating JWT tokens, and transparent foreground location tracking.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-600/30"
        >
          {saving ? 'Saving Changes...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
