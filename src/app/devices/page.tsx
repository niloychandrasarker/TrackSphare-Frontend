'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Smartphone, Plus, Radio, WifiOff, Trash2, UserPlus,
  Clock, Edit3, Camera, Upload, CheckCircle2, User, X
} from 'lucide-react';
import { clsx } from 'clsx';
import { Device } from '@/types';

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({ name: 'My Device', model: '', userName: '', imageUrl: '' });
  const [regLoading, setRegLoading] = useState(false);
  const [inviteDeviceId, setInviteDeviceId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');

  // Edit Device State
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editForm, setEditForm] = useState({ name: '', model: '', userName: '', imageUrl: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);
  const regFileInputRef = useRef<HTMLInputElement | null>(null);

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

  function openEditModal(d: Device) {
    setEditingDevice(d);
    setEditForm({
      name: d.name || '',
      model: d.model || '',
      userName: d.user_name || '',
      imageUrl: d.image_url || '',
    });
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, isReg = false) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        const res = await fetch('/api/v1/media/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: base64Data,
            fileName: `${(isReg ? regForm.userName : editForm.userName) || 'device'}_${Date.now()}.jpg`,
            folder: '/tracksphere',
          }),
        });
        const data = await res.json();
        if (data.success && data.data?.url) {
          if (isReg) {
            setRegForm(f => ({ ...f, imageUrl: data.data.url }));
          } else {
            setEditForm(f => ({ ...f, imageUrl: data.data.url }));
          }
        } else {
          alert('Failed to upload image: ' + (data.error || 'Server error'));
        }
        setImageUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert('Upload error: ' + err.message);
      setImageUploading(false);
    }
  }

  async function saveDeviceEdit() {
    if (!editingDevice) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/v1/devices/${editingDevice.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        setEditingDevice(null);
        fetchDevices();
      } else {
        alert('Update failed: ' + (data.error || 'Could not save device changes'));
      }
    } finally {
      setEditLoading(false);
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Devices</h1>
          <p className="text-gray-400 text-sm mt-1">Manage registered devices, assign photos, names, and viewer access</p>
        </div>
        <div className="flex items-center gap-2.5">
          <a
            href="/tracking"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-emerald-600/20"
          >
            <Radio className="w-4 h-4 animate-pulse" />
            Live Location Track
          </a>
          <button
            onClick={() => setShowRegister(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Register Device
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-xl text-red-300 text-sm">{error}</div>}

      {/* ─── EDIT DEVICE & PHOTO MODAL ─── */}
      {editingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setEditingDevice(null)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-indigo-400" />
              Edit Device &amp; Profile Photo
            </h2>
            <p className="text-xs text-gray-400 mb-5">
              Set photo, owner name, and identifier for Traccar and live tracking map.
            </p>

            <div className="space-y-4">
              {/* Photo Upload Section */}
              <div className="flex flex-col items-center justify-center p-4 bg-gray-800/60 border border-gray-700/80 rounded-2xl">
                <div className="relative group cursor-pointer mb-2" onClick={() => editFileInputRef.current?.click()}>
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-indigo-500 shadow-lg bg-gray-900 flex items-center justify-center">
                    {editForm.imageUrl ? (
                      <img src={editForm.imageUrl} alt="Device avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-gray-500" />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>

                <input
                  type="file"
                  ref={editFileInputRef}
                  accept="image/*"
                  onChange={e => handleImageUpload(e, false)}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => editFileInputRef.current?.click()}
                  disabled={imageUploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {imageUploading ? 'Uploading Image...' : editForm.imageUrl ? 'Change Photo' : 'Upload User Photo'}
                </button>
                <span className="text-[10px] text-gray-400 mt-1">This photo will appear on the live GPS map pin</span>
              </div>

              {/* Form Inputs */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">User / Owner Name</label>
                <input
                  type="text"
                  value={editForm.userName}
                  onChange={e => setEditForm(f => ({ ...f, userName: e.target.value }))}
                  placeholder="e.g. Pollob karmoker"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Device Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Realme c71"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Device Model / Traccar Identifier</label>
                <input
                  type="text"
                  value={editForm.model}
                  onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))}
                  placeholder="e.g. 377204 or honor"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingDevice(null)}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={saveDeviceEdit}
                disabled={editLoading || imageUploading}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── REGISTER DEVICE MODAL ─── */}
      {showRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">Register New Device</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Device Name</label>
                <input
                  value={regForm.name}
                  onChange={e => setRegForm(r => ({ ...r, name: e.target.value }))}
                  placeholder="e.g. Realme c71"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Model / Identifier</label>
                <input
                  value={regForm.model}
                  onChange={e => setRegForm(r => ({ ...r, model: e.target.value }))}
                  placeholder="e.g. 377204"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">User / Owner Name</label>
                <input
                  value={regForm.userName}
                  onChange={e => setRegForm(r => ({ ...r, userName: e.target.value }))}
                  placeholder="e.g. Pollob karmoker"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
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

      {/* ─── INVITE VIEWER MODAL ─── */}
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

      {/* ─── DEVICE LIST ─── */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse" />)}</div>
      ) : devices.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-gray-900/50 border border-gray-800 rounded-2xl">
          <Smartphone className="w-12 h-12 mx-auto mb-3 text-gray-700" />
          <p className="font-medium text-gray-300">No devices registered yet</p>
          <p className="text-xs text-gray-500 mt-1">Click &quot;Register Device&quot; or pair your phone with the app to begin tracking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map(d => (
            <div key={d.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {d.image_url ? (
                  <img
                    src={d.image_url}
                    alt={d.name}
                    className="w-12 h-12 rounded-xl object-cover border-2 border-indigo-500/60 shadow shrink-0"
                  />
                ) : (
                  <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', d.sharing_enabled ? 'bg-green-900/50' : 'bg-gray-800')}>
                    <Smartphone className={clsx('w-6 h-6', d.sharing_enabled ? 'text-green-400' : 'text-gray-500')} />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold truncate">{d.name}</p>
                    {d.user_name && (
                      <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800/60 rounded-md text-[10px] font-bold">
                        User: {d.user_name}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-xs mt-0.5 font-mono">{d.model ?? 'Android Device'}</p>
                  {d.last_seen_at && (
                    <p className="text-gray-500 text-[11px] flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-gray-500" /> {new Date(d.last_seen_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* ⏱️ Location History Button */}
                <a
                  href={`/locations?deviceId=${d.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/70 border border-indigo-800 hover:bg-indigo-800 text-indigo-300 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  title="View Location Schedule & History"
                >
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  Location History
                </a>

                {/* ✏️ Edit Device & Photo Button */}
                <button
                  onClick={() => openEditModal(d)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950/70 border border-blue-800 hover:bg-blue-800 text-blue-300 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  title="Edit Device Name, Owner, and Upload Photo"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                  Edit &amp; Photo
                </button>

                <span className={clsx('px-3 py-1 rounded-full text-xs font-medium', d.sharing_enabled ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400')}>
                  {d.sharing_enabled ? <><Radio className="w-3 h-3 inline mr-1" />Sharing ON</> : <><WifiOff className="w-3 h-3 inline mr-1" />Sharing OFF</>}
                </span>
                <button
                  onClick={() => toggleSharing(d.id, d.sharing_enabled)}
                  className={clsx('px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer', d.sharing_enabled ? 'bg-red-900/40 text-red-400 hover:bg-red-900/60' : 'bg-green-900/40 text-green-400 hover:bg-green-900/60')}
                >
                  {d.sharing_enabled ? 'Stop' : 'Start'}
                </button>
                <button
                  onClick={() => setInviteDeviceId(d.id)}
                  className="px-3 py-1.5 bg-indigo-900/40 text-indigo-400 hover:bg-indigo-900/60 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  title="Invite Viewer"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteDevice(d.id)}
                  className="px-3 py-1.5 bg-red-950/40 text-red-400 hover:bg-red-900/60 rounded-xl text-xs font-medium transition-colors cursor-pointer"
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
