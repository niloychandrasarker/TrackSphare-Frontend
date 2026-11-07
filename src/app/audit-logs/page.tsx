'use client';

import { useEffect, useState } from 'react';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { AuditLog } from '@/types';
import { clsx } from 'clsx';

const ACTION_COLORS: Record<string, string> = {
  'user.register':       'text-green-400 bg-green-900/30',
  'user.login':          'text-blue-400 bg-blue-900/30',
  'user.logout':         'text-gray-400 bg-gray-800',
  'sharing.start':       'text-green-400 bg-green-900/30',
  'sharing.stop':        'text-amber-400 bg-amber-900/30',
  'location.read_latest': 'text-indigo-400 bg-indigo-900/30',
  'location.read_history': 'text-indigo-400 bg-indigo-900/30',
  'admin.location_read': 'text-purple-400 bg-purple-900/30',
  'viewer.invite':       'text-cyan-400 bg-cyan-900/30',
  'viewer.revoke':       'text-red-400 bg-red-900/30',
  'consent.grant':       'text-green-400 bg-green-900/30',
  'consent.revoke':      'text-red-400 bg-red-900/30',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 50;

  function getToken() {
    return localStorage.getItem('adminToken') || localStorage.getItem('accessToken') || '';
  }

  async function fetchLogs(off = 0) {
    setLoading(true);
    try {
      // Build a simple endpoint using the same pattern — we'll use dashboard API
      // In production add GET /api/v1/audit-logs endpoint
      const res = await fetch(`/api/v1/audit-logs?limit=${limit}&offset=${off}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.data.logs);
        setTotal(data.data.total);
        setOffset(off);
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchLogs(0); }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
        <p className="text-gray-400 text-sm mt-1">Sensitive action log — location reads, sharing changes, viewer grants</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <span className="text-sm text-gray-400">{total} records</span>
          <div className="flex items-center gap-2">
            <button onClick={() => fetchLogs(offset - limit)} disabled={offset === 0}
              className="p-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-400 rounded-lg">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-500">{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
            <button onClick={() => fetchLogs(offset + limit)} disabled={offset + limit >= total}
              className="p-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-400 rounded-lg">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-10 bg-gray-800 rounded-lg animate-pulse" />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <FileText className="w-10 h-10 mx-auto mb-3 text-gray-700" />
            <p className="text-sm">No audit log entries yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {logs.map(log => (
              <div key={log.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <span className={clsx(
                  'px-2 py-0.5 rounded text-xs font-mono font-medium shrink-0',
                  ACTION_COLORS[log.action] ?? 'text-gray-400 bg-gray-800'
                )}>{log.action}</span>
                <span className="text-gray-400 text-xs font-mono truncate flex-1">
                  actor: {log.actor_user_id?.slice(0, 8) ?? 'system'}…
                  {log.target_device_id ? ` → device: ${log.target_device_id.slice(0, 8)}…` : ''}
                </span>
                <span className="text-gray-500 text-xs shrink-0">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
