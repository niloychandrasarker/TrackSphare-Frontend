'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Smartphone, Activity, Radio, Shield, LogOut,
  Clock, CheckCircle, AlertTriangle
} from 'lucide-react';

interface SummaryData {
  totalUsers: number;
  registeredDevices: number;
  sharingEnabled: number;
  sharingDisabled: number;
  recentlyUpdated: number;
  stale: number;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

interface AuditRow {
  id: number;
  actor_user_id: string;
  action: string;
  ip_address: string;
  created_at: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000/api/v1';

  function getAdminToken() {
    return localStorage.getItem('adminToken');
  }

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      router.push('/admin/login');
      return;
    }
    loadAdminData(token);
  }, []);

  async function loadAdminData(token: string) {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [sumRes, usersRes, logsRes] = await Promise.all([
        fetch(`${API_URL}/admin/summary`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/admin/users`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/admin/audit-logs?limit=10`, { headers }).then(r => r.json()),
      ]);

      if (sumRes.success) setSummary(sumRes.data);
      if (usersRes.success) setUsers(usersRes.data);
      if (logsRes.success) setAuditLogs(logsRes.data.logs);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    router.push('/admin/login');
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 sm:p-10">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 mb-8 border-b border-gray-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-red-600/30">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              TrackSphere Admin Control Center
              <span className="px-2 py-0.5 text-xs bg-red-950 text-red-400 border border-red-800 rounded-full font-mono">
                RESTRICTED
              </span>
            </h1>
            <p className="text-xs text-gray-400">Platform-wide overview, audit logs, and account management</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
        >
          <LogOut className="w-4 h-4 text-red-400" />
          Exit Admin
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-32 bg-gray-900 border border-gray-800 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <span className="text-xs text-gray-400 font-semibold uppercase">Total Users</span>
              <p className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                {summary?.totalUsers || 0}
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <span className="text-xs text-gray-400 font-semibold uppercase">Registered Devices</span>
              <p className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-purple-400" />
                {summary?.registeredDevices || 0}
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <span className="text-xs text-gray-400 font-semibold uppercase">Sharing ON</span>
              <p className="text-2xl font-bold text-emerald-400 mt-1 flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-400" />
                {summary?.sharingEnabled || 0}
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <span className="text-xs text-gray-400 font-semibold uppercase">Stale / Inactive</span>
              <p className="text-2xl font-bold text-amber-400 mt-1 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                {summary?.stale || 0}
              </p>
            </div>
          </div>

          {/* User Management & Audit Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Registered Users */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                Registered System Accounts
              </h2>
              <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
                {users.map(u => (
                  <div key={u.id} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-white">{u.name}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300 font-mono">
                        {u.role}
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit Logs */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-red-400" />
                Security Audit Trail
              </h2>
              <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto font-mono text-xs">
                {auditLogs.map(l => (
                  <div key={l.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-indigo-400 font-semibold">{l.action}</span>
                      <span className="text-gray-500 text-[11px]">{new Date(l.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-gray-400 text-[11px] mt-1">
                      Actor: {l.actor_user_id ? l.actor_user_id.slice(0, 8) + '...' : 'system'} | IP: {l.ip_address || '127.0.0.1'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
