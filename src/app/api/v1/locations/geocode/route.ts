import { NextRequest, NextResponse } from 'next/server';
import { ok, badRequest, serverError } from '@/lib/responses';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// In-memory cache for resolved addresses (keyed by lat.toFixed(4),lng.toFixed(4))
const geocodeCache = new Map<string, { placeName: string; displayName: string; road?: string; area?: string; city?: string }>();

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const latStr = sp.get('lat');
    const lngStr = sp.get('lng');

    if (!latStr || !lngStr) {
      return badRequest('Latitude (lat) and Longitude (lng) are required');
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      return badRequest('Invalid coordinates');
    }

    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;

    // 0. Check Saved Geofences / Custom Landmarks in Database First
    try {
      const gfRes = await query<{ name: string; radius_meters: number; distance_meters: number }>(
        `SELECT name, radius_meters,
                (6371000 * acos(LEAST(1.0, GREATEST(-1.0, cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) + sin(radians($1)) * sin(radians(latitude)))))) AS distance_meters
         FROM geofences
         WHERE status = 'active'
         ORDER BY distance_meters ASC
         LIMIT 1`,
        [lat, lng]
      );

      if (gfRes.rows[0]) {
        const gf = gfRes.rows[0];
        const maxDist = Math.max(gf.radius_meters || 500, 800);
        if (gf.distance_meters <= maxDist) {
          const resolved = {
            placeName: gf.name,
            displayName: `${gf.name} (Within ${Math.round(gf.distance_meters)}m)`,
            isCustomPlace: true,
          };
          geocodeCache.set(key, resolved);
          return ok(resolved);
        }
      }
    } catch (dbErr) {
      console.warn('Geofence check error:', dbErr);
    }

    // Return from in-memory cache if already resolved
    if (geocodeCache.has(key)) {
      return ok({ ...geocodeCache.get(key), cached: true });
    }

    // 1. Try Photon (Komoot OSM - Fast & detects streets, bridges, specific local landmarks)
    try {
      const photonUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
      const photonRes = await fetch(photonUrl, {
        headers: { 'Accept-Language': 'bn,en' },
        signal: AbortSignal.timeout(3500),
      });

      if (photonRes.ok) {
        const photonData = await photonRes.json();
        const feat = photonData.features?.[0]?.properties;
        if (feat) {
          const localName = feat.name || feat.street || feat.locality || '';
          const subArea = feat.suburb || feat.district || feat.city || '';
          const county = feat.county || feat.state || '';

          const parts = [localName, subArea, county].filter(Boolean);
          if (parts.length > 0) {
            const placeName = parts.join(', ');
            const resolved = {
              placeName,
              displayName: placeName,
              road: feat.street,
              area: subArea,
              city: county,
            };
            geocodeCache.set(key, resolved);
            return ok(resolved);
          }
        }
      }
    } catch {}

    // 2. Try OpenStreetMap Nominatim with granular Bangladeshi village/bazaar/subdistrict tags
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'TrackSphere-App/1.0 (https://tracksphere.app; contact@tracksphere.app)',
          'Accept-Language': 'bn,en',
        },
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};

        // Extract most granular local place tag
        const specificSpot = addr.amenity || addr.shop || addr.building || addr.market || addr.bazaar ||
                             addr.village || addr.hamlet || addr.neighbourhood || addr.road || addr.street || '';

        const subdistrict = addr.subdistrict || addr.town || addr.county || addr.suburb || '';
        const district = addr.state_district || addr.district || addr.city || '';

        const parts = [specificSpot, subdistrict, district].filter(Boolean);
        const placeName = parts.length > 0 ? parts.join(', ') : (data.display_name?.split(',').slice(0, 3).join(',') || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);

        const resolved = {
          placeName,
          displayName: data.display_name || placeName,
          road: addr.road,
          area: specificSpot || subdistrict,
          city: district,
        };

        geocodeCache.set(key, resolved);
        return ok(resolved);
      }
    } catch (nominatimErr) {
      // Fallback
    }

    // 3. Fallback: BigDataCloud Reverse Geocode
    try {
      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
      const res = await fetch(bdcUrl, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        const locality = data.locality || data.city || '';
        const adminList = data.localityInfo?.administrative || [];
        const localDetail = adminList[adminList.length - 1]?.name || locality;
        const parentDetail = adminList[adminList.length - 2]?.name || data.principalSubdivision || '';

        const parts = [localDetail, parentDetail].filter(Boolean);
        const placeName = parts.length > 0 ? parts.join(', ') : `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;

        const resolved = {
          placeName,
          displayName: placeName,
          area: localDetail,
          city: parentDetail,
        };

        geocodeCache.set(key, resolved);
        return ok(resolved);
      }
    } catch {}

    // Default fallback
    const defaultResolved = {
      placeName: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      displayName: `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    };
    return ok(defaultResolved);

  } catch (error: any) {
    return ok({
      placeName: 'Location Coordinates',
      displayName: error.message || 'Geocoding unavailable',
    });
  }
}

// POST /api/v1/locations/geocode — Save custom place / landmark name for coordinates
export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    const body = await req.json();
    const { name, latitude, longitude, radiusMeters = 800 } = body;

    if (!name || latitude === undefined || longitude === undefined) {
      return badRequest('Name, latitude, and longitude are required');
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    let targetUserId = auth?.sub;
    if (!targetUserId) {
      const adminRes = await query<{ id: string }>('SELECT id FROM users LIMIT 1');
      targetUserId = adminRes.rows[0]?.id;
    }

    await query(
      `INSERT INTO geofences (user_id, name, latitude, longitude, radius_meters, status)
       VALUES ($1, $2, $3, $4, $5, 'active')`,
      [targetUserId, name.trim(), lat, lng, radiusMeters]
    );

    // Invalidate cache for this area
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    geocodeCache.delete(key);

    return ok({ success: true, message: 'Custom place name saved successfully', name: name.trim() });
  } catch (err: any) {
    console.error('Save custom place error:', err);
    return serverError();
  }
}
