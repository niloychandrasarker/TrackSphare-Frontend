import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { writeAuditLog, getClientIp } from '@/lib/audit';
import { unauthorized, forbidden, notFound, conflict, serverError, ok } from '@/lib/responses';
import { InviteViewerSchema } from '@/validations/schemas';

// POST /api/v1/devices/[id]/viewers/invite
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();

    const { id: deviceId } = await params;

    // Verify ownership
    const deviceResult = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM devices WHERE id = $1 AND status = 'active'`,
      [deviceId]
    );
    const device = deviceResult.rows[0];
    if (!device) return notFound('Device not found');
    if (device.user_id !== auth.sub) return forbidden('You do not own this device');

    const body = await req.json();
    const parsed = InviteViewerSchema.safeParse(body);
    if (!parsed.success) {
      return unauthorized(parsed.error.issues.map(i => i.message).join(', '));
    }

    const { viewerEmail, accessType } = parsed.data;

    // Find viewer user
    const viewerResult = await query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 AND status = 'active'`,
      [viewerEmail.toLowerCase()]
    );
    const viewer = viewerResult.rows[0];
    if (!viewer) return notFound('No active user with that email');

    // Prevent self-invite
    if (viewer.id === auth.sub) return conflict('Cannot invite yourself');

    // Upsert grant
    const grantResult = await query<{ id: string }>(
      `INSERT INTO device_viewers (device_id, viewer_user_id, access_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (device_id, viewer_user_id)
         DO UPDATE SET status = 'active', access_type = EXCLUDED.access_type, revoked_at = NULL
       RETURNING id`,
      [deviceId, viewer.id, accessType]
    );

    await writeAuditLog({
      actorUserId:    auth.sub,
      action:         'viewer.invite',
      targetDeviceId: deviceId,
      targetUserId:   viewer.id,
      metadata:       { accessType },
      ipAddress:      getClientIp(req),
    });

    return ok({ grantId: grantResult.rows[0].id, message: 'Viewer invited successfully' });
  } catch (err) {
    console.error('POST /devices/[id]/viewers/invite error:', err);
    return serverError();
  }
}
