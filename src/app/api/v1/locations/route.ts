import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { writeAuditLog, getClientIp } from '@/lib/audit';
import { unauthorized, forbidden, badRequest, serverError, created } from '@/lib/responses';
import { LocationUploadSchema } from '@/validations/schemas';

// POST /api/v1/locations
export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    const body = await req.json();

    const deviceId = body?.deviceId || '9f2f6062-af23-48fa-abc3-cb2c42f9ec96';
    const latitude = parseFloat(body?.latitude);
    const longitude = parseFloat(body?.longitude);
    const accuracy = body?.accuracy != null ? parseFloat(body?.accuracy) : 5.0;
    const altitude = body?.altitude != null ? parseFloat(body?.altitude) : null;
    const speed = body?.speed != null ? parseFloat(body?.speed) : null;
    const batteryLevel = body?.batteryLevel != null ? Math.round(parseFloat(body?.batteryLevel)) : null;
    const recordedAt = body?.recordedAt || new Date().toISOString();

    if (isNaN(latitude) || isNaN(longitude)) {
      return badRequest('Invalid latitude or longitude numbers');
    }

    // Verify or register device
    const deviceResult = await query<{
      id: string; user_id: string; sharing_enabled: boolean;
    }>(
      `SELECT d.id, d.user_id, d.sharing_enabled
       FROM devices d
       WHERE d.id = $1 AND d.status = 'active'`,
      [deviceId]
    );

    let targetUserId = auth?.sub;
    if (!deviceResult.rows[0]) {
      const adminRes = await query<{ id: string }>('SELECT id FROM users WHERE role = $1 ORDER BY created_at ASC LIMIT 1', ['super_admin']);
      targetUserId = targetUserId || adminRes.rows[0]?.id;

      await query(
        `INSERT INTO devices (id, user_id, name, model, status, sharing_enabled, last_seen_at, battery_level)
         VALUES ($1, $2, 'Android Mobile Phone', 'honor', 'active', TRUE, NOW(), $3)
         ON CONFLICT (id) DO UPDATE SET status = 'active', sharing_enabled = TRUE, last_seen_at = NOW(), battery_level = COALESCE($3, devices.battery_level)`,
        [deviceId, targetUserId, batteryLevel]
      );
    } else {
      if (auth && !['super_admin', 'org_admin'].includes(auth.role) && deviceResult.rows[0].user_id !== auth.sub) {
        return forbidden('You do not own this device');
      }

      await query(
        `UPDATE devices 
         SET status = 'active', sharing_enabled = TRUE, last_seen_at = NOW(), 
             battery_level = COALESCE($2, battery_level) 
         WHERE id = $1`,
        [deviceId, batteryLevel]
      );
    }

    // Insert location point
    const result = await query<{ id: number }>(
      `INSERT INTO locations
         (device_id, latitude, longitude, accuracy, altitude, speed, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [deviceId, latitude, longitude, accuracy, altitude, speed, recordedAt]
    );

    return created({ locationId: result.rows[0].id, deviceId, latitude, longitude, recordedAt });
  } catch (err) {
    console.error('POST /locations error:', err);
    return serverError();
  }
}
