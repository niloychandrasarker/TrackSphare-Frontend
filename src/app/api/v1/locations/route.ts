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
    if (!auth) return unauthorized();

    const body = await req.json();
    const parsed = LocationUploadSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const { deviceId, latitude, longitude, accuracy, altitude, speed, recordedAt } = parsed.data;

    // Verify device ownership, active sharing, and consent — all in one query
    const deviceResult = await query<{
      id: string; user_id: string; sharing_enabled: boolean;
    }>(
      `SELECT d.id, d.user_id, d.sharing_enabled
       FROM devices d
       WHERE d.id = $1 AND d.status = 'active'`,
      [deviceId]
    );
    const device = deviceResult.rows[0];

    if (!device) return forbidden('Device not found or inactive');
    if (device.user_id !== auth.sub) return forbidden('You do not own this device');
    if (!device.sharing_enabled) return forbidden('Location sharing is disabled for this device');

    // Check active consent
    const consentResult = await query(
      `SELECT id FROM consent_records
       WHERE device_id = $1 AND status = 'granted'
       ORDER BY created_at DESC LIMIT 1`,
      [deviceId]
    );
    if (consentResult.rowCount === 0) {
      return forbidden('No active consent record for this device');
    }

    // Insert location — server sets received_at
    const result = await query<{ id: number }>(
      `INSERT INTO locations
         (device_id, latitude, longitude, accuracy, altitude, speed, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [deviceId, latitude, longitude, accuracy ?? null, altitude ?? null, speed ?? null, recordedAt]
    );

    // Update last_seen_at on device
    await query(
      `UPDATE devices SET last_seen_at = NOW() WHERE id = $1`,
      [deviceId]
    );

    return created({ locationId: result.rows[0].id });
  } catch (err) {
    console.error('POST /locations error:', err);
    return serverError();
  }
}
