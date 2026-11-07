import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { unauthorized, forbidden, badRequest, serverError, created } from '@/lib/responses';
import { toValidUuid } from '@/lib/uuid';

async function handleLocationUpload(req: NextRequest, isGet = false) {
  try {
    const auth = getAuthUser(req);
    const { searchParams } = new URL(req.url);

    let body: any = {};
    if (!isGet) {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const rawDevId = body?.deviceId || body?.id || searchParams.get('id') || searchParams.get('deviceId') || '377204';
    const computedUuid = toValidUuid(String(rawDevId));

    const rawLat = body?.latitude ?? body?.lat ?? searchParams.get('lat') ?? searchParams.get('latitude');
    const rawLng = body?.longitude ?? body?.lon ?? body?.lng ?? searchParams.get('lon') ?? searchParams.get('lng') ?? searchParams.get('longitude');

    if (rawLat === undefined || rawLng === undefined || rawLat === null || rawLng === null) {
      return badRequest('Missing latitude or longitude');
    }

    const latitude = parseFloat(String(rawLat));
    const longitude = parseFloat(String(rawLng));

    if (isNaN(latitude) || isNaN(longitude)) {
      return badRequest('Invalid latitude or longitude numbers');
    }

    const rawAcc = body?.accuracy ?? searchParams.get('accuracy') ?? searchParams.get('hdop');
    const accuracy = rawAcc != null ? parseFloat(String(rawAcc)) : 5.0;

    const rawAlt = body?.altitude ?? searchParams.get('altitude');
    const altitude = rawAlt != null ? parseFloat(String(rawAlt)) : null;

    const rawSpeed = body?.speed ?? searchParams.get('speed');
    const speed = rawSpeed != null ? parseFloat(String(rawSpeed)) : null;

    const rawBatt = body?.batteryLevel ?? searchParams.get('batt') ?? searchParams.get('battery');
    const batteryLevel = rawBatt != null ? Math.round(parseFloat(String(rawBatt))) : null;

    let recordedAt = body?.recordedAt;
    if (!recordedAt && searchParams.get('timestamp')) {
      const ts = Number(searchParams.get('timestamp'));
      recordedAt = ts > 10000000000 ? new Date(ts).toISOString() : new Date(ts * 1000).toISOString();
    }
    if (!recordedAt) {
      recordedAt = new Date().toISOString();
    }

    const rawDevName = body?.name || searchParams.get('name');
    const rawUserName = body?.userName || body?.user_name || searchParams.get('userName') || searchParams.get('user_name');
    const rawImageUrl = body?.imageUrl || body?.image_url || searchParams.get('imageUrl') || searchParams.get('image_url');

    // Check device by UUID or matching name/model
    const dev = await query<{ id: string; user_id: string; sharing_enabled: boolean; status: string; name: string }>(
      `SELECT id, user_id, sharing_enabled, status, name 
       FROM devices 
       WHERE id = $1 OR name ILIKE $2 OR model ILIKE $2 
       LIMIT 1`,
      [computedUuid, String(rawDevId)]
    );

    let deviceId = dev.rows[0]?.id || computedUuid;
    let targetUserId = auth?.sub;

    if (!dev.rows[0]) {
      const adminRes = await query<{ id: string }>('SELECT id FROM users WHERE role = $1 ORDER BY created_at ASC LIMIT 1', ['super_admin']);
      targetUserId = targetUserId || adminRes.rows[0]?.id;

      const devName = rawDevName ? String(rawDevName) : `Device (${rawDevId})`;
      const uName = rawUserName ? String(rawUserName) : `Device ${rawDevId}`;
      const imgUrl = rawImageUrl ? String(rawImageUrl) : null;

      await query(
        `INSERT INTO devices (id, user_id, name, model, user_name, image_url, status, sharing_enabled, last_seen_at, battery_level)
         VALUES ($1, $2, $3, 'Android GPS Client', $4, $5, 'active', TRUE, NOW(), $6)
         ON CONFLICT (id) DO UPDATE SET 
            status = 'active', 
            sharing_enabled = TRUE, 
            last_seen_at = NOW(), 
            battery_level = COALESCE($6, devices.battery_level),
            name = COALESCE($3, devices.name),
            user_name = COALESCE($4, devices.user_name),
            image_url = COALESCE($5, devices.image_url)`,
        [deviceId, targetUserId, devName, uName, imgUrl, batteryLevel]
      );
    } else {
      deviceId = dev.rows[0].id;
      if (auth && !['super_admin', 'org_admin'].includes(auth.role) && dev.rows[0].user_id !== auth.sub) {
        return forbidden('You do not own this device');
      }

      await query(
        `UPDATE devices 
         SET status = 'active', sharing_enabled = TRUE, last_seen_at = NOW(), 
             battery_level = COALESCE($2, battery_level),
             name = COALESCE($3, name),
             user_name = COALESCE($4, user_name),
             image_url = COALESCE($5, image_url)
         WHERE id = $1`,
        [deviceId, batteryLevel, rawDevName || null, rawUserName || null, rawImageUrl || null]
      );
    }

    // Insert location point
    const result = await query<{ id: number }>(
      `INSERT INTO locations
         (device_id, latitude, longitude, accuracy, altitude, speed, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [deviceId, latitude, longitude, accuracy, altitude, speed, recordedAt]
    );

    return NextResponse.json({
      success: true,
      data: {
        locationId: result.rows[0].id,
        deviceId,
        latitude,
        longitude,
        recordedAt
      }
    }, { status: 200 });
  } catch (err) {
    console.error('Location upload error:', err);
    return serverError();
  }
}

// GET /api/v1/locations (OsmAnd / Traccar GPS protocol)
export async function GET(req: NextRequest) {
  return handleLocationUpload(req, true);
}

// POST /api/v1/locations (TrackSphere JSON protocol)
export async function POST(req: NextRequest) {
  return handleLocationUpload(req, false);
}
