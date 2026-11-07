import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { writeAuditLog, getClientIp } from '@/lib/audit';
import { unauthorized, forbidden, notFound, serverError, ok } from '@/lib/responses';

// POST /api/v1/sharing/stop
export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();

    const body = await req.json();
    const { deviceId } = body;
    if (!deviceId) return unauthorized('deviceId is required');

    const deviceResult = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM devices WHERE id = $1 AND status = 'active'`,
      [deviceId]
    );
    const device = deviceResult.rows[0];
    if (!device) return notFound('Device not found');
    if (device.user_id !== auth.sub) return forbidden('You do not own this device');

    // Disable sharing and close session
    await query(
      `UPDATE devices SET sharing_enabled = FALSE, updated_at = NOW() WHERE id = $1`,
      [deviceId]
    );
    await query(
      `UPDATE sharing_sessions
       SET status = 'stopped', stopped_at = NOW()
       WHERE device_id = $1 AND status = 'active'`,
      [deviceId]
    );

    await writeAuditLog({
      actorUserId:    auth.sub,
      action:         'sharing.stop',
      targetDeviceId: deviceId,
      ipAddress:      getClientIp(req),
    });

    return ok({ message: 'Location sharing stopped', sharingEnabled: false });
  } catch (err) {
    console.error('POST /sharing/stop error:', err);
    return serverError();
  }
}
