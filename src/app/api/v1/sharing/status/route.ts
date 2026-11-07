import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { unauthorized, forbidden, notFound, serverError, ok } from '@/lib/responses';

// GET /api/v1/sharing/status?deviceId=UUID
export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();

    const deviceId = req.nextUrl.searchParams.get('deviceId');
    if (!deviceId) return unauthorized('deviceId query param required');

    const deviceResult = await query<{
      id: string; user_id: string; sharing_enabled: boolean; last_seen_at: Date | null;
    }>(
      `SELECT id, user_id, sharing_enabled, last_seen_at
       FROM devices WHERE id = $1 AND status = 'active'`,
      [deviceId]
    );
    const device = deviceResult.rows[0];
    if (!device) return notFound('Device not found');

    // Must be owner or active viewer
    const isOwner = device.user_id === auth.sub;
    if (!isOwner) {
      const viewerResult = await query(
        `SELECT id FROM device_viewers
         WHERE device_id = $1 AND viewer_user_id = $2 AND status = 'active'`,
        [deviceId, auth.sub]
      );
      if (viewerResult.rowCount === 0) return forbidden('Access denied');
    }

    return ok({
      deviceId,
      sharingEnabled: device.sharing_enabled,
      lastSeenAt:     device.last_seen_at,
    });
  } catch (err) {
    console.error('GET /sharing/status error:', err);
    return serverError();
  }
}
