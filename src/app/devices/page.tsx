'use client';

import { useEffect, useState } from 'react';
import { Smartphone, Plus, Radio, WifiOff, Trash2, UserPlus, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { Device } from '@/types';

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({ name: 'My Device', model: '', androidVersion: '', appVersion: '' });
  const [regLoading, setRegLoading] = useState(false);
  const [inviteDeviceId, setInviteDeviceId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');

  function getToken() {
    return localStorage.getItem('adminToken') || localStorage.getItem('accessToken') || '';
  }

  async function fetchDevices() {
    const token = getToken();
    if (!token) {
      window.location.href = '/admin/login';
      return;
    }
    try {
      const res = await fetch('/api/v1/devices', { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) {
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (data.success) setDevices(data.data);
      else setError(data.error);
    } finally { setLoading(false); }
  }

  async function registerDevice() {
    setRegLoading(true);
    try {
      const res = await fetch('/api/v1/devices/register', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm),
      });
      const data = await res.json();
      if (data.success) { setShowRegister(false); fetchDevices(); }
      else setError(data.error);
    } finally { setRegLoading(false); }
  }

  async function toggleSharing(deviceId: string, currentlyEnabled: boolean) {
    try {
      if (!currentlyEnabled) {
        // Automatically grant explicit consent record if turning ON
        await fetch('/api/v1/consent/grant', {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, purpose: 'location_sharing', policyVersion: '1.2' }),
        });
      }

      const endpoint = currentlyEnabled ? '/api/v1/sharing/stop' : '/api/v1/sharing/start';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      const data = await res.json();
      if (data.success) fetchDevices();
      else alert(data.error);
    } catch {
      alert('Failed to update sharing state');
    }
  }

  async function inviteViewer(deviceId: string) {
    if (!inviteEmail) return;
    const res = await fetch(`/api/v1/devices/${deviceId}/viewers/invite`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewerEmail: inviteEmail }),
    });
    const data = await res.json();
    alert(data.success ? 'Viewer invited!' : data.error);
    setInviteDeviceId(null);
    setInviteEmail('');
  }

  async function deleteDevice(deviceId: string) {
    if (!confirm('Are you sure you want to revoke this device?')) return;
    const res = await fetch(`/api/v1/devices/${deviceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    if (data.success) fetchDevices();
    else alert(data.error);
  }

  useEffect(() => { fetchDevices(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Devices</h1>
          <p className="text-gray-400 text-sm mt-1">Manage registered devices and viewer access</p>
        </div>
        <button
          onClick={() => setShowRegister(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Register Device
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-xl text-red-300 text-sm">{error}</div>}

      {/* Register modal */}
      {showRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">Register New Device</h2>
            <div className="space-y-3">
              {[
                { label: 'Device Name', key: 'name', placeholder: 'My Phone' },
                { label: 'Model', key: 'model', placeholder: 'Pixel 8 Pro' },
                { label: 'Android Version', key: 'androidVersion', placeholder: '14' },
                { label: 'App Version', key: 'appVersion', placeholder: '1.2.0' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm text-gray-400 mb-1">{f.label}</label>
                  <input
                    value={(regForm as Record<string, string>)[f.key]}
                    onChange={e => setRegForm(r => ({ ...r, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowRegister(false)} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors">Cancel</button>
              <button onClick={registerDevice} disabled={regLoading} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">
                {regLoading ? 'Registering…' : 'Register'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {inviteDeviceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold text-white mb-4">Invite Viewer</h2>
            <input
              type="email" value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="viewer@example.com"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setInviteDeviceId(null)} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-xl text-sm">Cancel</button>
              <button onClick={() => inviteViewer(inviteDeviceId)} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium">Invite</button>
            </div>
          </div>
        </div>
      )}

      {/* Device list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse" />)}</div>
      ) : devices.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-gray-900/50 border border-gray-800 rounded-2xl">
          <Smartphone className="w-12 h-12 mx-auto mb-3 text-gray-700" />
          <p className="font-medium text-gray-300">No devices registered yet</p>
          <p className="text-xs text-gray-500 mt-1">Click &quot;Register Device&quot; or download the Android app to pair your phone.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map(d => (
            <div key={d.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', d.sharing_enabled ? 'bg-green-900/50' : 'bg-gray-800')}>
                  <Smartphone className={clsx('w-6 h-6', d.sharing_enabled ? 'text-green-400' : 'text-gray-500')} />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{d.name}</p>
                  <p className="text-gray-400 text-sm">{d.model ?? 'Unknown model'}</p>
                  {d.last_seen_at && (
                    <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> {new Date(d.last_seen_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={clsx('px-3 py-1 rounded-full text-xs font-medium', d.sharing_enabled ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400')}>
                  {d.sharing_enabled ? <><Radio className="w-3 h-3 inline mr-1" />Sharing ON</> : <><WifiOff className="w-3 h-3 inline mr-1" />Sharing OFF</>}
                </span>
                <button
                  onClick={() => toggleSharing(d.id, d.sharing_enabled)}
                  className={clsx('px-3 py-1.5 rounded-xl text-xs font-medium transition-colors', d.sharing_enabled ? 'bg-red-900/40 text-red-400 hover:bg-red-900/60' : 'bg-green-900/40 text-green-400 hover:bg-green-900/60')}
                >
                  {d.sharing_enabled ? 'Stop' : 'Start'}
                </button>
                <button
                  onClick={() => setInviteDeviceId(d.id)}
                  className="px-3 py-1.5 bg-indigo-900/40 text-indigo-400 hover:bg-indigo-900/60 rounded-xl text-xs font-medium transition-colors"
                  title="Invite Viewer"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteDevice(d.id)}
                  className="px-3 py-1.5 bg-red-950/40 text-red-400 hover:bg-red-900/60 rounded-xl text-xs font-medium transition-colors"
                  title="Revoke Device"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
