import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { writeAuditLog, getClientIp } from '@/lib/audit';
import { unauthorized, serverError, created, ok } from '@/lib/responses';
import { DeviceRegisterSchema } from '@/validations/schemas';

// POST /api/v1/devices/register
export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();

    const body = await req.json();
    const parsed = DeviceRegisterSchema.safeParse(body);
    if (!parsed.success) {
      return unauthorized(parsed.error.issues.map(i => i.message).join(', '));
    }

    const { name, model, androidVersion, appVersion } = parsed.data;

    const result = await query<{ id: string; name: string; sharing_enabled: boolean; created_at: Date }>(
      `INSERT INTO devices (user_id, name, model, android_version, app_version)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, sharing_enabled, created_at`,
      [auth.sub, name ?? 'My Device', model ?? null, androidVersion ?? null, appVersion ?? null]
    );

    const device = result.rows[0];

    await writeAuditLog({
      actorUserId:     auth.sub,
      action:          'device.register',
      targetDeviceId:  device.id,
      ipAddress:       getClientIp(req),
    });

    return created(device);
  } catch (err) {
    console.error('POST /devices/register error:', err);
    return serverError();
  }
}
