import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { writeAuditLog, getClientIp } from '@/lib/audit';
import { unauthorized, forbidden, notFound, serverError, ok } from '@/lib/responses';

// DELETE /api/v1/devices/[id]/viewers/[viewerId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; viewerId: string }> }
) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();

    const { id: deviceId, viewerId } = await params;

    // Verify ownership
    const deviceResult = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM devices WHERE id = $1 AND status = 'active'`,
      [deviceId]
    );
    const device = deviceResult.rows[0];
    if (!device) return notFound('Device not found');
    if (device.user_id !== auth.sub) return forbidden('You do not own this device');

    // Revoke
    const result = await query(
      `UPDATE device_viewers
       SET status = 'revoked', revoked_at = NOW()
       WHERE device_id = $1 AND viewer_user_id = $2 AND status = 'active'`,
      [deviceId, viewerId]
    );

    if (result.rowCount === 0) return notFound('Viewer grant not found or already revoked');

    await writeAuditLog({
      actorUserId:    auth.sub,
      action:         'viewer.revoke',
      targetDeviceId: deviceId,
      targetUserId:   viewerId,
      ipAddress:      getClientIp(req),
    });

    return ok({ message: 'Viewer access revoked' });
  } catch (err) {
    console.error('DELETE /devices/[id]/viewers/[viewerId] error:', err);
    return serverError();
  }
}
