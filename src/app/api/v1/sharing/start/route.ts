import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { writeAuditLog, getClientIp } from '@/lib/audit';
import { unauthorized, forbidden, notFound, conflict, serverError, ok } from '@/lib/responses';

// POST /api/v1/sharing/start
export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();

    const body = await req.json();
    const { deviceId } = body;
    if (!deviceId) return unauthorized('deviceId is required');

    // Verify ownership
    const deviceResult = await query<{ id: string; user_id: string; sharing_enabled: boolean }>(
      `SELECT id, user_id, sharing_enabled FROM devices WHERE id = $1 AND status = 'active'`,
      [deviceId]
    );
    const device = deviceResult.rows[0];
    if (!device) return notFound('Device not found');
    if (device.user_id !== auth.sub) return forbidden('You do not own this device');
    if (device.sharing_enabled) return conflict('Sharing is already enabled');

    // Check active consent
    const consentResult = await query(
      `SELECT id FROM consent_records
       WHERE device_id = $1 AND status = 'granted'
       ORDER BY created_at DESC LIMIT 1`,
      [deviceId]
    );
    if (consentResult.rowCount === 0) {
      return forbidden('User consent is required before enabling sharing');
    }

    // Enable sharing and start session
    await query(
      `UPDATE devices SET sharing_enabled = TRUE, updated_at = NOW() WHERE id = $1`,
      [deviceId]
    );
    await query(
      `INSERT INTO sharing_sessions (device_id) VALUES ($1)`,
      [deviceId]
    );

    await writeAuditLog({
      actorUserId:    auth.sub,
      action:         'sharing.start',
      targetDeviceId: deviceId,
      ipAddress:      getClientIp(req),
    });

    return ok({ message: 'Location sharing started', sharingEnabled: true });
  } catch (err) {
    console.error('POST /sharing/start error:', err);
    return serverError();
  }
}
