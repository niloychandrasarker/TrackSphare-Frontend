import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { toValidUuid } from '@/lib/uuid';
import { unauthorized, forbidden, notFound, serverError, ok } from '@/lib/responses';

// GET /api/v1/devices/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(req);
    const { id } = await params;
    const computedUuid = toValidUuid(id);

    const dev = await query<{
      id: string; user_id: string; name: string; model: string;
      sharing_enabled: boolean; status: string; last_seen_at: Date;
      battery_level: number; image_url: string; user_name: string;
    }>(
      `SELECT d.id, d.user_id, d.name, d.model, d.sharing_enabled, d.status,
              d.last_seen_at, d.battery_level, d.image_url, COALESCE(d.user_name, u.name) as user_name
       FROM devices d
       LEFT JOIN users u ON u.id = d.user_id
       WHERE d.id = $1 OR d.name ILIKE $2 OR d.model ILIKE $2
       LIMIT 1`,
      [computedUuid, id]
    );

    if (!dev.rows[0]) return notFound('Device not found');
    return ok(dev.rows[0]);
  } catch (err) {
    console.error('GET /devices/[id] error:', err);
    return serverError();
  }
}

// PATCH / PUT /api/v1/devices/[id] — update device name, user name, and image
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(req);
    const { id } = await params;
    const computedUuid = toValidUuid(id);
    const body = await req.json();
    const { name, model, userName, imageUrl, sharingEnabled, status } = body;

    // Check existing device
    const existing = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM devices 
       WHERE id = $1 OR name ILIKE $2 OR model ILIKE $2 
       LIMIT 1`,
      [computedUuid, id]
    );

    const targetId = existing.rows[0]?.id || computedUuid;

    if (auth && !['super_admin', 'org_admin'].includes(auth.role)) {
      if (existing.rows[0] && existing.rows[0].user_id !== auth.sub) {
        return forbidden('Unauthorized to edit this device');
      }
    }

    const result = await query(
      `UPDATE devices
       SET name = COALESCE($1, name),
           model = COALESCE($2, model),
           user_name = COALESCE($3, user_name),
           image_url = COALESCE($4, image_url),
           sharing_enabled = COALESCE($5, sharing_enabled),
           status = COALESCE($6, status),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, name, model, user_name, image_url, sharing_enabled, status, last_seen_at, battery_level`,
      [
        name ?? null,
        model ?? null,
        userName ?? null,
        imageUrl ?? null,
        sharingEnabled !== undefined ? sharingEnabled : null,
        status ?? null,
        targetId
      ]
    );

    if (!result.rows[0]) {
      return notFound('Device not found');
    }

    return ok(result.rows[0]);
  } catch (err) {
    console.error('PATCH /devices/[id] error:', err);
    return serverError();
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return PATCH(req, ctx);
}

// DELETE /api/v1/devices/[id] — revoke device
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();
    const { id } = await params;
    const computedUuid = toValidUuid(id);

    const dev = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM devices WHERE id = $1 OR name ILIKE $2 LIMIT 1`,
      [computedUuid, id]
    );

    if (!dev.rows[0]) return notFound('Device not found');

    if (!['super_admin', 'org_admin'].includes(auth.role) && dev.rows[0].user_id !== auth.sub) {
      return forbidden('Unauthorized to delete this device');
    }

    await query(`UPDATE devices SET status = 'revoked', sharing_enabled = FALSE, updated_at = NOW() WHERE id = $1`, [dev.rows[0].id]);
    await query(`UPDATE sharing_sessions SET status = 'stopped', stopped_at = NOW() WHERE device_id = $1 AND status = 'active'`, [dev.rows[0].id]);

    return ok({ message: 'Device revoked successfully' });
  } catch (err) {
    console.error('DELETE /devices/[id] error:', err);
    return serverError();
  }
}
