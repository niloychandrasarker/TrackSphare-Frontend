import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { writeAuditLog, getClientIp } from '@/lib/audit';
import { unauthorized, forbidden, notFound, badRequest, serverError, ok } from '@/lib/responses';

// GET /api/v1/locations/latest?deviceId=UUID
export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();

    const deviceId = req.nextUrl.searchParams.get('deviceId');
    if (!deviceId) return badRequest('deviceId query param required');

    // Check ownership or viewer grant
    const deviceResult = await query<{ id: string; user_id: string; sharing_enabled: boolean }>(
      `SELECT id, user_id, sharing_enabled FROM devices WHERE id = $1 AND status = 'active'`,
      [deviceId]
    );
    const device = deviceResult.rows[0];
    if (!device) return notFound('Device not found');

    const isOwner = device.user_id === auth.sub;
    const isAdmin = auth.role === 'super_admin' || auth.role === 'org_admin';

    if (!isOwner && !isAdmin) {
      const viewerResult = await query(
        `SELECT id FROM device_viewers
         WHERE device_id = $1 AND viewer_user_id = $2 AND status = 'active'`,
        [deviceId, auth.sub]
      );
      if (viewerResult.rowCount === 0) return forbidden('Access denied');
    }

    const result = await query<{
      id: number; latitude: number; longitude: number; accuracy: number | null;
      altitude: number | null; speed: number | null; recorded_at: Date; received_at: Date;
    }>(
      `SELECT id, latitude, longitude, accuracy, altitude, speed, recorded_at, received_at
       FROM locations
       WHERE device_id = $1
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [deviceId]
    );

    if (result.rowCount === 0) return notFound('No location data for this device');

    await writeAuditLog({
      actorUserId:    auth.sub,
      action:         isAdmin && !isOwner ? 'admin.location_read' : 'location.read_latest',
      targetDeviceId: deviceId,
      metadata:       { isAdmin, isOwner },
      ipAddress:      getClientIp(req),
    });

    return ok(result.rows[0]);
  } catch (err) {
    console.error('GET /locations/latest error:', err);
    return serverError();
  }
}
