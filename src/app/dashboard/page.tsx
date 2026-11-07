'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Smartphone, Radio, WifiOff, Activity, AlertTriangle,
  ShieldCheck, MapPin, ExternalLink, ArrowRight, Battery, Clock
} from 'lucide-react';
import { DashboardSummary, Device } from '@/types';
import { clsx } from 'clsx';
import Link from 'next/link';

function StatCard({
  label, value, icon: Icon, color, sublabel
}: {
  label: string; value: number | string; icon: React.ElementType;
  color: string; sublabel?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400 font-medium">{label}</span>
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sublabel && <p className="text-xs text-gray-500 mt-1">{sublabel}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    const token = localStorage.getItem('adminToken') || localStorage.getItem('accessToken');
    if (!token) {
      router.push('/admin/login');
      return;
    }

    try {
      const [sumRes, devRes] = await Promise.all([
        fetch('/api/v1/dashboard/summary', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/devices', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (sumRes.status === 401 || sumRes.status === 403) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('accessToken');
        router.push('/admin/login');
        return;
      }

      const sumData = await sumRes.json();
      if (sumData.success) {
        setSummary(sumData.data);
      } else {
        setError(sumData.error);
      }

      const devData = await devRes.json();
      if (devData.success && Array.isArray(devData.data)) {
        setDevices(devData.data);
      }
    } catch {
      setError('Cannot connect to TrackSphere Backend server on port 5000');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Overview Dashboard
            <span className="px-2.5 py-0.5 text-xs bg-indigo-950 text-indigo-400 border border-indigo-800 rounded-full font-mono">
              Admin Protected
            </span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">Platform-wide statistics and live device metrics • Refreshes every 15s</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/tracking"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-indigo-600/20"
          >
            <MapPin className="w-4 h-4" />
            Open Google Maps Tracking
          </Link>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-xl text-xs text-gray-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Authenticated Admin</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-xl text-red-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => router.push('/admin/login')}
            className="px-3 py-1 bg-red-950 hover:bg-red-900 text-red-200 border border-red-800 rounded-lg text-xs cursor-pointer"
          >
            Go to Admin Login
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-24 mb-4" />
              <div className="h-8 bg-gray-800 rounded w-16" />
            </div>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          <StatCard label="Total Users"        value={summary.totalUsers}        icon={Users}       color="bg-indigo-600"  sublabel="Active registered accounts" />
          <StatCard label="Registered Devices" value={summary.registeredDevices} icon={Smartphone}  color="bg-violet-600"  sublabel="Non-revoked devices in DB" />
          <StatCard label="Sharing Enabled"    value={summary.sharingEnabled}    icon={Radio}       color="bg-emerald-600"   sublabel="Broadcasting location to Google Maps" />
          <StatCard label="Sharing Disabled"   value={summary.sharingDisabled}   icon={WifiOff}     color="bg-gray-600"    sublabel="Sharing is OFF by default" />
          <StatCard label="Recently Updated"   value={summary.recentlyUpdated}   icon={Activity}    color="bg-blue-600"    sublabel="Location fix in last 10 minutes" />
          <StatCard label="Stale / Offline"    value={summary.stale}             icon={AlertTriangle} color="bg-amber-600" sublabel="No update for >10 minutes" />
        </div>
      ) : null}

      {/* Live Devices Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-indigo-400" />
              Connected Devices Telemetry
            </h2>
            <p className="text-gray-400 text-xs mt-0.5">Live listing of all registered mobile trackers and phone clients</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/tracking"
              className="px-3.5 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>View All on Live Map</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {devices.length === 0 ? (
          <div className="text-center py-12 bg-gray-950/40 rounded-xl border border-gray-800/60 p-6">
            <Smartphone className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <h3 className="text-white font-medium text-sm">No Devices Linked Yet</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-4">
              Open the TrackSphere Mobile Tracker on your phone at <code className="text-indigo-400">/app</code> to automatically register your phone.
            </p>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-500 transition-colors"
            >
              Launch Mobile Tracker (/app)
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="text-xs uppercase bg-gray-950/60 text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Device</th>
                  <th className="py-3 px-4 font-semibold">Assigned Owner</th>
                  <th className="py-3 px-4 font-semibold">Sharing State</th>
                  <th className="py-3 px-4 font-semibold">Battery</th>
                  <th className="py-3 px-4 font-semibold">Last Seen</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {devices.map(d => (
                  <tr key={d.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-white flex items-center gap-3">
                      {d.image_url ? (
                        <img src={d.image_url} alt="" className="w-10 h-10 rounded-xl object-cover border border-gray-700 shadow-sm shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center shrink-0 border border-gray-700">
                          <Smartphone className="w-4 h-4 text-indigo-400" />
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-white">{d.name}</div>
                        <div className="text-xs text-gray-400">{d.model || 'Android Phone'}</div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-sm text-gray-200">{d.owner_name || 'Admin'}</div>
                      <div className="text-xs text-gray-500 font-mono">{d.owner_email || 'admin@tracksphere.com'}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={clsx(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                        d.sharing_enabled
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                          : 'bg-gray-800 text-gray-400'
                      )}>
                        <span className={clsx('w-2 h-2 rounded-full', d.sharing_enabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500')} />
                        {d.sharing_enabled ? 'Sharing Active' : 'Sharing Disabled'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="flex items-center gap-1 text-xs text-gray-300 font-mono">
                        <Battery className="w-4 h-4 text-emerald-400" />
                        {d.battery_level != null ? `${d.battery_level}%` : '100%'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-400">
                      {d.last_seen_at ? (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-500" />
                          {new Date(d.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      ) : (
                        'Never'
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href="/tracking"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        Track Live Pin
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
