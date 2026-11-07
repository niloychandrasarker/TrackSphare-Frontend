import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { unauthorized, serverError, ok } from '@/lib/responses';

// GET /api/v1/devices — list devices owned by or viewable by the current user
export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();

    const isAdmin = ['super_admin', 'org_admin'].includes(auth.role);

    let result;
    if (isAdmin) {
      result = await query<{
        id: string; name: string; model: string | null; sharing_enabled: boolean;
        status: string; last_seen_at: Date | null; battery_level: number | null;
        image_url?: string | null; user_name?: string | null;
      }>(
        `SELECT d.id, d.name, d.model, d.sharing_enabled, d.status, d.last_seen_at, d.battery_level, d.image_url, COALESCE(d.user_name, u.name) as user_name
         FROM devices d
         LEFT JOIN users u ON u.id = d.user_id
         WHERE d.status = 'active'
         ORDER BY d.last_seen_at DESC NULLS LAST`
      );
    } else {
      result = await query<{
        id: string; name: string; model: string | null; sharing_enabled: boolean;
        status: string; last_seen_at: Date | null; battery_level: number | null;
        image_url?: string | null; user_name?: string | null;
      }>(
        `SELECT d.id, d.name, d.model, d.sharing_enabled, d.status, d.last_seen_at, d.battery_level, d.image_url, COALESCE(d.user_name, u.name) as user_name
         FROM devices d
         LEFT JOIN users u ON u.id = d.user_id
         WHERE d.user_id = $1 AND d.status = 'active'
         UNION
         SELECT d.id, d.name, d.model, d.sharing_enabled, d.status, d.last_seen_at, d.battery_level, d.image_url, COALESCE(d.user_name, u.name) as user_name
         FROM devices d
         LEFT JOIN users u ON u.id = d.user_id
         INNER JOIN device_viewers dv ON dv.device_id = d.id
         WHERE dv.viewer_user_id = $1 AND dv.status = 'active' AND d.status = 'active'
         ORDER BY last_seen_at DESC NULLS LAST`,
        [auth.sub]
      );
    }

    return ok(result.rows);
  } catch (err) {
    console.error('GET /devices error:', err);
    return serverError();
  }
}
