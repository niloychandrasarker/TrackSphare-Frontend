import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { unauthorized, forbidden, serverError, ok } from '@/lib/responses';
import { DashboardSummary } from '@/types';

const STALE_MINUTES = 10;

// GET /api/v1/dashboard/summary
export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();
    if (!['super_admin', 'org_admin'].includes(auth.role)) return forbidden();

    const [users, devices, sharing, stale] = await Promise.all([
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM users WHERE status = 'active'`),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM devices WHERE status = 'active'`),
      query<{ enabled: string; disabled: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE sharing_enabled = TRUE)  AS enabled,
           COUNT(*) FILTER (WHERE sharing_enabled = FALSE) AS disabled
         FROM devices WHERE status = 'active'`
      ),
      query<{ recent: string; stale: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '${STALE_MINUTES} minutes') AS recent,
           COUNT(*) FILTER (WHERE last_seen_at <= NOW() - INTERVAL '${STALE_MINUTES} minutes'
                             OR last_seen_at IS NULL) AS stale
         FROM devices WHERE status = 'active'`
      ),
    ]);

    const summary: DashboardSummary = {
      totalUsers:        parseInt(users.rows[0]?.count ?? '0'),
      registeredDevices: parseInt(devices.rows[0]?.count ?? '0'),
      sharingEnabled:    parseInt(sharing.rows[0]?.enabled ?? '0'),
      sharingDisabled:   parseInt(sharing.rows[0]?.disabled ?? '0'),
      recentlyUpdated:   parseInt(stale.rows[0]?.recent ?? '0'),
      stale:             parseInt(stale.rows[0]?.stale ?? '0'),
    };

    return ok(summary);
  } catch (err) {
    console.error('GET /dashboard/summary error:', err);
    return serverError();
  }
}
