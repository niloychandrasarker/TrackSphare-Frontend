import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    const body = await req.json();
    const { deviceId, name, model, androidVersion, appVersion, batteryLevel, userName, imageUrl } = body;

    let targetUserId = auth?.sub;
    if (!targetUserId) {
      const adminRes = await query<{ id: string }>('SELECT id FROM users WHERE role = $1 ORDER BY created_at ASC LIMIT 1', ['super_admin']);
      targetUserId = adminRes.rows[0]?.id;
    }

    if (!targetUserId) {
      return NextResponse.json({ success: false, error: 'No user account found to bind device' }, { status: 500 });
    }

    const devName = name || 'Mobile Android Device';
    const devModel = model || 'honor';

    let result;
    if (deviceId) {
      result = await query<{ id: string; name: string; model: string; sharing_enabled: boolean; status: string; image_url: string; user_name: string }>(
        `INSERT INTO devices (id, user_id, name, model, android_version, app_version, status, sharing_enabled, last_seen_at, battery_level, image_url, user_name)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', TRUE, NOW(), $7, $8, $9)
         ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             model = EXCLUDED.model,
             status = 'active',
             sharing_enabled = TRUE,
             last_seen_at = NOW(),
             battery_level = COALESCE(EXCLUDED.battery_level, devices.battery_level),
             image_url = COALESCE(EXCLUDED.image_url, devices.image_url),
             user_name = COALESCE(EXCLUDED.user_name, devices.user_name)
         RETURNING id, name, model, sharing_enabled, status, image_url, user_name`,
        [deviceId, targetUserId, devName, devModel, androidVersion || null, appVersion || null, batteryLevel || null, imageUrl || null, userName || null]
      );
    } else {
      result = await query<{ id: string; name: string; model: string; sharing_enabled: boolean; status: string; image_url: string; user_name: string }>(
        `INSERT INTO devices (user_id, name, model, android_version, app_version, status, sharing_enabled, last_seen_at, battery_level, image_url, user_name)
         VALUES ($1, $2, $3, $4, $5, 'active', TRUE, NOW(), $6, $7, $8)
         RETURNING id, name, model, sharing_enabled, status, image_url, user_name`,
        [targetUserId, devName, devModel, androidVersion || null, appVersion || null, batteryLevel || null, imageUrl || null, userName || null]
      );
    }

    const device = result.rows[0];

    // Grant consent
    await query(
      `INSERT INTO consent_records (device_id, user_id, purpose, status, policy_version)
       VALUES ($1, $2, 'location_sharing', 'granted', '1.2')
       ON CONFLICT DO NOTHING`,
      [device.id, targetUserId]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      data: device,
    });
  } catch (err: any) {
    console.error('POST /api/v1/devices/register-mobile error:', err);
    return NextResponse.json({ success: false, error: 'Failed to register mobile device' }, { status: 500 });
  }
}
