'use client';

import { useEffect, useState } from 'react';
import { MapPin, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Device, Location } from '@/types';

export default function LocationsPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const [loading, setLoading] = useState(false);

  function getToken() {
    return localStorage.getItem('adminToken') || localStorage.getItem('accessToken') || '';
  }

  useEffect(() => {
    fetch('/api/v1/devices', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json()).then(d => { if (d.success) setDevices(d.data); });
  }, []);

  async function fetchHistory(off = 0) {
    if (!deviceId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ deviceId, limit: String(limit), offset: String(off) });
      if (from) params.set('from', new Date(from).toISOString());
      if (to)   params.set('to',   new Date(to).toISOString());

      const res = await fetch(`/api/v1/locations/history?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setLocations(data.data.locations);
        setTotal(data.data.pagination.total);
        setOffset(off);
      }
    } finally { setLoading(false); }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Location History</h1>
        <p className="text-gray-400 text-sm mt-1">Date-filtered paginated location records</p>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Device</label>
            <select
              value={deviceId}
              onChange={e => setDeviceId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select device…</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">From</label>
            <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">To</label>
            <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => fetchHistory(0)}
              disabled={!deviceId || loading}
              className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Search className="w-4 h-4" /> Search
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <span className="text-sm text-gray-400">{total > 0 ? `${total} records found` : 'No results'}</span>
          {total > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={() => fetchHistory(offset - limit)} disabled={offset === 0}
                className="p-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-400 rounded-lg transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-500">{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
              <button onClick={() => fetchHistory(offset + limit)} disabled={offset + limit >= total}
                className="p-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-400 rounded-lg transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-10 bg-gray-800 rounded-lg animate-pulse" />)}
          </div>
        ) : locations.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <MapPin className="w-10 h-10 mx-auto mb-3 text-gray-700" />
            <p className="text-sm">{deviceId ? 'No locations found for the selected range' : 'Select a device to view history'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            <div className="grid grid-cols-5 px-4 py-2 text-xs text-gray-500 font-medium uppercase tracking-wider">
              <span>#</span><span>Latitude</span><span>Longitude</span><span>Accuracy</span><span>Recorded At</span>
            </div>
            {locations.map((loc, idx) => (
              <div key={loc.id} className="grid grid-cols-5 px-4 py-3 text-sm hover:bg-gray-800/50 transition-colors">
                <span className="text-gray-500">{offset + idx + 1}</span>
                <span className="text-gray-200 font-mono">{Number(loc.latitude).toFixed(5)}</span>
                <span className="text-gray-200 font-mono">{Number(loc.longitude).toFixed(5)}</span>
                <span className="text-gray-400">{loc.accuracy ? Number(loc.accuracy).toFixed(1) + 'm' : '—'}</span>
                <span className="text-gray-400">{new Date(loc.recorded_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
