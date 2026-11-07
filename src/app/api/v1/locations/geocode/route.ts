import { NextRequest } from 'next/server';
import { ok, badRequest } from '@/lib/responses';

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

    // Return from in-memory cache if already resolved
    if (geocodeCache.has(key)) {
      return ok({ ...geocodeCache.get(key), cached: true });
    }

    // 1. Try OpenStreetMap Nominatim
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'TrackSphere-App/1.0 (https://tracksphere.app; contact@tracksphere.app)',
          'Accept-Language': 'en,bn',
        },
        // Timeout 4 seconds
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const road = addr.road || addr.pedestrian || addr.footway || addr.path || '';
        const area = addr.neighbourhood || addr.suburb || addr.quarter || addr.residential || addr.subdistrict || '';
        const city = addr.city || addr.town || addr.municipality || addr.state_district || addr.county || '';
        const country = addr.country || '';

        // Build a readable place name: "Road / Landmark, Area, City"
        const parts = [road, area, city].filter(Boolean);
        const placeName = parts.length > 0 ? parts.join(', ') : (data.display_name?.split(',').slice(0, 3).join(',') || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);

        const resolved = {
          placeName,
          displayName: data.display_name || placeName,
          road,
          area,
          city,
          country,
        };

        geocodeCache.set(key, resolved);
        return ok(resolved);
      }
    } catch (nominatimErr) {
      // Proceed to fallback
    }

    // 2. Fallback: BigDataCloud Reverse Geocode Client API
    try {
      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
      const res = await fetch(bdcUrl, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        const locality = data.locality || data.city || '';
        const principalSubdivision = data.principalSubdivision || '';
        const countryName = data.countryName || '';

        const parts = [locality, principalSubdivision, countryName].filter(Boolean);
        const placeName = parts.length > 0 ? parts.join(', ') : `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;

        const resolved = {
          placeName,
          displayName: placeName,
          area: locality,
          city: principalSubdivision,
          country: countryName,
        };

        geocodeCache.set(key, resolved);
        return ok(resolved);
      }
    } catch (bdcErr) {
      // Proceed to fallback
    }

    // Default fallback if both services fail
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
