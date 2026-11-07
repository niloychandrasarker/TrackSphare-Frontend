import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { writeAuditLog, getClientIp } from '@/lib/audit';
import { unauthorized, forbidden, notFound, badRequest, serverError, ok } from '@/lib/responses';
import { ConsentSchema } from '@/validations/schemas';

// POST /api/v1/consent/revoke
export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();

    const body = await req.json();
    const parsed = ConsentSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const { deviceId, purpose } = parsed.data;

    const deviceResult = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM devices WHERE id = $1 AND status = 'active'`,
      [deviceId]
    );
    const device = deviceResult.rows[0];
    if (!device) return notFound('Device not found');
    if (device.user_id !== auth.sub) return forbidden('You do not own this device');

    // Add revocation record and stop sharing
    await query(
      `INSERT INTO consent_records (device_id, user_id, purpose, status, policy_version, ip_address)
       VALUES ($1, $2, $3, 'revoked', '1.0', $4)`,
      [deviceId, auth.sub, purpose, getClientIp(req) ?? null]
    );
    await query(
      `UPDATE devices SET sharing_enabled = FALSE, updated_at = NOW() WHERE id = $1`,
      [deviceId]
    );
    await query(
      `UPDATE sharing_sessions SET status = 'stopped', stopped_at = NOW()
       WHERE device_id = $1 AND status = 'active'`,
      [deviceId]
    );

    await writeAuditLog({
      actorUserId:    auth.sub,
      action:         'consent.revoke',
      targetDeviceId: deviceId,
      metadata:       { purpose },
      ipAddress:      getClientIp(req),
    });

    return ok({ message: 'Consent revoked. Sharing has been stopped.' });
  } catch (err) {
    console.error('POST /consent/revoke error:', err);
    return serverError();
  }
}
