import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { writeAuditLog, getClientIp } from '@/lib/audit';
import { unauthorized, forbidden, notFound, badRequest, serverError, ok } from '@/lib/responses';
import { ConsentSchema } from '@/validations/schemas';

// POST /api/v1/consent/grant
export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();

    const body = await req.json();
    const parsed = ConsentSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const { deviceId, purpose, policyVersion } = parsed.data;

    const deviceResult = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM devices WHERE id = $1 AND status = 'active'`,
      [deviceId]
    );
    const device = deviceResult.rows[0];
    if (!device) return notFound('Device not found');
    if (device.user_id !== auth.sub) return forbidden('You do not own this device');

    await query(
      `INSERT INTO consent_records (device_id, user_id, purpose, status, policy_version, ip_address)
       VALUES ($1, $2, $3, 'granted', $4, $5)`,
      [deviceId, auth.sub, purpose, policyVersion, getClientIp(req) ?? null]
    );

    await writeAuditLog({
      actorUserId:    auth.sub,
      action:         'consent.grant',
      targetDeviceId: deviceId,
      metadata:       { purpose, policyVersion },
      ipAddress:      getClientIp(req),
    });

    return ok({ message: 'Consent granted' });
  } catch (err) {
    console.error('POST /consent/grant error:', err);
    return serverError();
  }
}
