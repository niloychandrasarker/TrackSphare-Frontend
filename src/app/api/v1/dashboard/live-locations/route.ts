import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { writeAuditLog, getClientIp } from '@/lib/audit';
import { unauthorized, forbidden, serverError, ok } from '@/lib/responses';

// GET /api/v1/dashboard/live-locations
// Returns the latest location for every device the user is authorized to see
export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();

    const isAdmin = ['super_admin', 'org_admin'].includes(auth.role);

    let deviceIds: string[] = [];

    if (isAdmin) {
      // Admin sees all active devices
      const result = await query<{ id: string }>(
        `SELECT id FROM devices WHERE status = 'active' AND sharing_enabled = TRUE`
      );
      deviceIds = result.rows.map(r => r.id);
    } else {
      // Viewer sees only granted devices
      const result = await query<{ id: string }>(
        `SELECT d.id FROM devices d
         INNER JOIN device_viewers dv ON dv.device_id = d.id
         WHERE dv.viewer_user_id = $1 AND dv.status = 'active'
           AND d.status = 'active' AND d.sharing_enabled = TRUE
         UNION
         SELECT id FROM devices WHERE user_id = $1 AND status = 'active' AND sharing_enabled = TRUE`,
        [auth.sub]
      );
      deviceIds = result.rows.map(r => r.id);
    }

    if (deviceIds.length === 0) return ok([]);

    // Fetch latest location per device using DISTINCT ON
    const placeholders = deviceIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await query<{
      device_id: string; device_name: string; user_name: string;
      latitude: number; longitude: number; accuracy: number | null;
      battery_level: number | null; recorded_at: Date; received_at: Date;
      image_url?: string | null; avatar_url?: string | null;
    }>(
      `SELECT DISTINCT ON (l.device_id)
         l.device_id, d.name AS device_name, u.name AS user_name,
         l.latitude, l.longitude, l.accuracy,
         d.battery_level, l.recorded_at, l.received_at,
         d.image_url, u.avatar_url
       FROM locations l
       INNER JOIN devices d ON d.id = l.device_id
       INNER JOIN users u   ON u.id = d.user_id
       WHERE l.device_id IN (${placeholders})
       ORDER BY l.device_id, l.recorded_at DESC`,
      deviceIds
    );

    if (isAdmin) {
      await writeAuditLog({
        actorUserId: auth.sub,
        action:      'admin.location_read',
        metadata:    { deviceCount: result.rows.length },
        ipAddress:   getClientIp(req),
      });
    }

    return ok(result.rows);
  } catch (err) {
    console.error('GET /dashboard/live-locations error:', err);
    return serverError();
  }
}
