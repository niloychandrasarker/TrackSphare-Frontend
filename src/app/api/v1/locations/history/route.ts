import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { writeAuditLog, getClientIp } from '@/lib/audit';
import { unauthorized, forbidden, notFound, badRequest, serverError, ok } from '@/lib/responses';
import { LocationHistoryQuerySchema } from '@/validations/schemas';

// GET /api/v1/locations/history?deviceId=UUID&from=ISO&to=ISO&limit=100&offset=0
export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();

    const sp = req.nextUrl.searchParams;
    const parsed = LocationHistoryQuerySchema.safeParse({
      deviceId: sp.get('deviceId'),
      from:     sp.get('from') ?? undefined,
      to:       sp.get('to') ?? undefined,
      limit:    sp.get('limit') ?? undefined,
      offset:   sp.get('offset') ?? undefined,
    });

    if (!parsed.success) {
      return badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const { deviceId, from, to, limit, offset } = parsed.data;

    // Verify access
    const deviceResult = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM devices WHERE id = $1 AND status = 'active'`,
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

    // Build dynamic WHERE conditions
    const conditions: string[] = ['device_id = $1'];
    const params: unknown[] = [deviceId];
    let idx = 2;

    if (from) { conditions.push(`recorded_at >= $${idx++}`); params.push(from); }
    if (to)   { conditions.push(`recorded_at <= $${idx++}`); params.push(to); }

    params.push(limit, offset);

    const result = await query<{
      id: number; latitude: number; longitude: number; accuracy: number | null;
      recorded_at: Date; received_at: Date;
    }>(
      `SELECT id, latitude, longitude, accuracy, recorded_at, received_at
       FROM locations
       WHERE ${conditions.join(' AND ')}
       ORDER BY recorded_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    // Count total (for pagination)
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM locations WHERE ${conditions.slice(0, -0).join(' AND ')}`,
      params.slice(0, params.length - 2)
    );

    await writeAuditLog({
      actorUserId:    auth.sub,
      action:         'location.read_history',
      targetDeviceId: deviceId,
      metadata:       { from, to, limit, offset },
      ipAddress:      getClientIp(req),
    });

    return ok({
      locations: result.rows,
      pagination: {
        total:  parseInt(countResult.rows[0]?.count ?? '0'),
        limit,
        offset,
      },
    });
  } catch (err) {
    console.error('GET /locations/history error:', err);
    return serverError();
  }
}
