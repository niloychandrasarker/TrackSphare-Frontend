'use client';

import { useEffect, useState, useRef } from 'react';
import {
  RefreshCw, MapPin, Battery, Wifi, Clock, Radio, Navigation,
  ShieldCheck, Layers, Crosshair, AlertCircle, CheckCircle2, Globe,
  Smartphone, User
} from 'lucide-react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { clsx } from 'clsx';

// Types
interface LiveDevice {
  device_id:     string;
  device_name:   string;
  user_name:     string;
  image_url?:    string | null;
  latitude:      number;
  longitude:     number;
  accuracy:      number | null;
  battery_level: number | null;
  recorded_at:   string;
  received_at:   string;
}

function isStale(recordedAt: string): boolean {
  if (!recordedAt) return true;
  return Date.now() - new Date(recordedAt).getTime() > 5 * 60 * 1000;
}

function getTimeAgo(dateStr: string): string {
  if (!dateStr) return 'unknown';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  return `${diffHours} hr ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. LEAFLET INTERACTIVE MAP (DEFAULT - 100% Reliable, No API Key Issues)
// ─────────────────────────────────────────────────────────────────────────────
function LeafletMapComponent({
  devices,
  selected,
  onSelect,
}: {
  devices: LiveDevice[];
  selected: LiveDevice | null;
  onSelect: (d: LiveDevice) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const [mapType, setMapType] = useState<'google_streets' | 'google_hybrid' | 'osm'>('google_streets');
  const tileLayerRef = useRef<any>(null);
  const lastFlyIdRef = useRef<string | null>(null);

  function getTileConfig(type: 'google_streets' | 'google_hybrid' | 'osm'): { url: string; options: any } {
    if (type === 'google_streets') {
      return {
        url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        options: { maxZoom: 20, attribution: '&copy; Google Maps' },
      };
    }
    if (type === 'google_hybrid') {
      return {
        url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        options: { maxZoom: 20, attribution: '&copy; Google Hybrid &copy; Google Maps' },
      };
    }
    return {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' },
    };
  }

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const initialCenter = devices[0]
      ? [Number(devices[0].latitude), Number(devices[0].longitude)]
      : [23.8103, 90.4125];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: devices[0] ? 15 : 13,
      zoomControl: true,
    });

    const cfg = getTileConfig(mapType);
    const tileLayer = L.tileLayer(cfg.url, cfg.options);
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Layer Toggle (Google Streets / Google Hybrid / OSM)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = (window as any).L;
    if (!map || !L || !tileLayerRef.current) return;

    map.removeLayer(tileLayerRef.current);
    const cfg = getTileConfig(mapType);
    tileLayerRef.current = L.tileLayer(cfg.url, cfg.options).addTo(map);
  }, [mapType]);

  // Update Markers & Circles
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = (window as any).L;
    const markersLayer = markersLayerRef.current;
    if (!map || !L || !markersLayer) return;

    markersLayer.clearLayers();
    if (devices.length === 0) return;

    const bounds = L.latLngBounds([]);

    devices.forEach(d => {
      const lat = Number(d.latitude);
      const lng = Number(d.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const pos: [number, number] = [lat, lng];
      bounds.extend(pos);

      const stale = isStale(d.recorded_at);
      const isSelected = selected?.device_id === d.device_id;

      // Accuracy circle
      if (d.accuracy && d.accuracy > 0 && d.accuracy < 1000) {
        L.circle(pos, {
          radius: Number(d.accuracy),
          color: stale ? '#f59e0b' : '#6366f1',
          fillColor: stale ? '#f59e0b' : '#6366f1',
          fillOpacity: 0.15,
          weight: 1.5,
        }).addTo(markersLayer);
      }

      // Custom pulsing HTML Pin (showing user image if uploaded)
      const pinColor = stale ? '#f59e0b' : '#10b981';
      const iconHtml = d.image_url ? `
        <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 40px; height: 40px; border-radius: 50%; background: ${pinColor}; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <img src="${d.image_url}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 2.5px solid ${pinColor}; box-shadow: 0 3px 10px rgba(0,0,0,0.6); z-index: 10; background: #1e293b;" />
        </div>
      ` : `
        <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: ${pinColor}; opacity: 0.3; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 18px; height: 18px; border-radius: 50%; background: ${pinColor}; border: 3px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.5); z-index: 10;"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-live-marker',
        html: iconHtml,
        iconSize: d.image_url ? [40, 40] : [32, 32],
        iconAnchor: d.image_url ? [20, 20] : [16, 16],
      });

      const marker = L.marker(pos, { icon: customIcon }).addTo(markersLayer);

      const popupContent = `
        <div style="color: #0f172a; font-family: sans-serif; padding: 4px; min-width: 195px;">
          ${d.image_url ? `<img src="${d.image_url}" style="width: 100%; height: 95px; border-radius: 10px; object-fit: cover; margin-bottom: 8px; border: 1px solid #e2e8f0;" />` : ''}
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 2px;">${d.device_name}</div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">User: <strong>${d.user_name}</strong></div>
          <div style="font-size: 12px; margin-bottom: 4px;"><strong>Lat:</strong> ${lat.toFixed(5)}, <strong>Lng:</strong> ${lng.toFixed(5)}</div>
          <div style="font-size: 11px; color: #475569;">Precision: ±${d.accuracy ? Math.round(Number(d.accuracy)) + 'm' : 'GPS'}</div>
          <div style="margin-top: 6px; font-size: 10px; font-weight: 600; color: ${stale ? '#d97706' : '#059669'};">
            ${stale ? '⚠️ Stale Fix' : '🟢 Real GPS (Live)'} • ${new Date(d.recorded_at).toLocaleTimeString()}
          </div>
          <a href="/locations?deviceId=${d.device_id}" style="display: flex; align-items: center; justify-content: center; gap: 4px; text-decoration: none; margin-top: 8px; padding: 6px 10px; background: #4f46e5; color: #ffffff; border-radius: 8px; font-size: 11px; font-weight: 700;">
            ⏱️ Location History
          </a>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on('click', () => {
        lastFlyIdRef.current = d.device_id;
        onSelect(d);
      });

      if (isSelected) {
        marker.openPopup();
      }
    });

    if (selected) {
      const sLat = Number(selected.latitude);
      const sLng = Number(selected.longitude);
      if (!isNaN(sLat) && !isNaN(sLng)) {
        if (lastFlyIdRef.current !== selected.device_id) {
          lastFlyIdRef.current = selected.device_id;
          map.flyTo([sLat, sLng], 16, { duration: 0.8 });
        }
      }
    } else if (devices.length === 1 && !lastFlyIdRef.current) {
      map.setView([Number(devices[0].latitude), Number(devices[0].longitude)], 15);
    } else if (devices.length > 1 && !lastFlyIdRef.current) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [devices, selected]);

  return (
    <div className="relative w-full h-full min-h-[550px] rounded-2xl overflow-hidden">
      {/* Map Style Controls */}
      <div className="absolute top-4 right-4 z-[500] flex gap-1 bg-gray-900/90 backdrop-blur border border-gray-700/80 rounded-xl p-1 shadow-lg text-xs">
        <button
          onClick={() => setMapType('google_streets')}
          className={clsx(
            'px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer',
            mapType === 'google_streets' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'
          )}
        >
          Google Map
        </button>
        <button
          onClick={() => setMapType('google_hybrid')}
          className={clsx(
            'px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer',
            mapType === 'google_hybrid' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'
          )}
        >
          Satellite + Places
        </button>
        <button
          onClick={() => setMapType('osm')}
          className={clsx(
            'px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer',
            mapType === 'osm' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'
          )}
        >
          OpenStreetMap
        </button>
      </div>

      <div ref={mapContainerRef} className="w-full h-full min-h-[550px]" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. GOOGLE MAPS COMPONENT (OPTIONAL / ALTERNATIVE)
// ─────────────────────────────────────────────────────────────────────────────
function GoogleMapComponent({
  devices,
  selected,
  onSelect,
}: {
  devices: LiveDevice[];
  selected: LiveDevice | null;
  onSelect: (d: LiveDevice) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!containerRef.current || !(window as any).google || mapInstanceRef.current) return;

    const initialCenter = devices[0]
      ? { lat: Number(devices[0].latitude), lng: Number(devices[0].longitude) }
      : { lat: 23.8103, lng: 90.4125 };

    const map = new (window as any).google.maps.Map(containerRef.current, {
      zoom: devices[0] ? 15 : 12,
      center: initialCenter,
      mapTypeId: 'roadmap',
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
    });

    mapInstanceRef.current = map;
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !(window as any).google) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    devices.forEach(d => {
      const lat = Number(d.latitude);
      const lng = Number(d.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const marker = new (window as any).google.maps.Marker({
        position: { lat, lng },
        map,
        title: d.device_name,
      });

      marker.addListener('click', () => onSelect(d));
      markersRef.current.push(marker);
    });

    if (selected) {
      map.panTo({ lat: Number(selected.latitude), lng: Number(selected.longitude) });
      map.setZoom(16);
    }
  }, [devices, selected]);

  return <div ref={containerRef} className="w-full h-full min-h-[550px] rounded-2xl" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MAIN LIVE TRACKING PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function TrackingPage() {
  const [devices, setDevices] = useState<LiveDevice[]>([]);
  const [selected, setSelected] = useState<LiveDevice | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState('');
  const [mapEngine, setMapEngine] = useState<'leaflet' | 'google'>('leaflet');
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? '';

  function handleSelectDevice(device: LiveDevice) {
    selectedIdRef.current = device.device_id;
    setSelected(device);
  }

  // Load Leaflet Assets on Mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    // Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Leaflet JS
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setLeafletLoaded(true);
      document.head.appendChild(script);
    } else {
      setLeafletLoaded(true);
    }
  }, []);

  async function fetchLocations() {
    setIsRefreshing(true);
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('accessToken');
      if (!token) {
        window.location.href = '/admin/login';
        return;
      }

      const res = await fetch('/api/v1/dashboard/live-locations', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403) {
        window.location.href = '/admin/login';
        return;
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setDevices(data.data);
        setLastRefresh(new Date());

        const currentSelectedId = selectedIdRef.current;
        if (currentSelectedId) {
          const matching = data.data.find((d: LiveDevice) => d.device_id === currentSelectedId);
          if (matching) {
            setSelected(matching);
          }
        } else if (data.data.length > 0) {
          selectedIdRef.current = data.data[0].device_id;
          setSelected(data.data[0]);
        }
      }
    } catch (err) {
      console.error('Fetch locations error:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  // Live auto-polling every 2.5 seconds for real-time tracking
  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 2500);
    return () => clearInterval(interval);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // 📍 1-CLICK: BROADCAST REAL GPS LOCATION TO CLOUD
  // ─────────────────────────────────────────────────────────────────────────────
  async function handleSendMyRealLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationSuccessMsg('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;

        const targetDevId = selected?.device_id || devices[0]?.device_id || '9f2f6062-af23-48fa-abc3-cb2c42f9ec96';
        const token = localStorage.getItem('adminToken') || localStorage.getItem('accessToken') || '';

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
          const res = await fetch('/api/v1/locations', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              deviceId: targetDevId,
              latitude: lat,
              longitude: lng,
              accuracy: Math.round(accuracy * 10) / 10,
              recordedAt: new Date().toISOString(),
            }),
          });

          if (res.ok) {
            setLocationSuccessMsg(`✓ Real GPS location pinned: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
            await fetchLocations();
            setTimeout(() => setLocationSuccessMsg(''), 6000);
          } else {
            alert('Failed to transmit location to server.');
          }
        } catch {
          alert('Network error while transmitting location.');
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        alert(`Location permission error: ${err.message}. Please allow Location access in your browser bar.`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return (
    <div>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Live Device Tracking
            <span className="px-2.5 py-0.5 text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Real-Time Live (2.5s Stream)
            </span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Real-time coordinates streamed from mobile agents • Live sub-3s telemetry sync
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Real Location 1-Click Button */}
          <button
            onClick={handleSendMyRealLocation}
            disabled={isLocating}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
            title="Get your actual GPS coordinates right now from this device and broadcast to map"
          >
            <Crosshair className={clsx('w-4 h-4', isLocating && 'animate-spin')} />
            {isLocating ? 'Acquiring GPS Fix…' : '📍 Use My Real Location'}
          </button>

          {/* Map Engine Toggle */}
          <div className="flex items-center bg-gray-900 border border-gray-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setMapEngine('leaflet')}
              className={clsx(
                'px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer',
                mapEngine === 'leaflet' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              )}
            >
              Interactive Map
            </button>
            <button
              onClick={() => setMapEngine('google')}
              className={clsx(
                'px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer',
                mapEngine === 'google' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              )}
            >
              Google Maps
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchLocations}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            <RefreshCw className={clsx('w-4 h-4 text-indigo-400', isRefreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {locationSuccessMsg && (
        <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-300 text-xs font-mono flex items-center gap-2 shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{locationSuccessMsg}</span>
        </div>
      )}

      {/* Main Grid: Device List + Map */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 min-h-[600px] h-[calc(100vh-210px)]">
        {/* Device Sidebar */}
        <div className="xl:col-span-1 bg-gray-900 border border-gray-800 rounded-2xl overflow-y-auto flex flex-col">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">Registered Devices</h2>
            <span className="text-xs font-mono text-gray-500">{devices.length} Online</span>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : devices.length === 0 ? (
            <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center flex-1">
              <MapPin className="w-10 h-10 text-gray-700 mb-2" />
              <p className="font-medium text-gray-400 text-sm">No live devices found</p>
              <p className="text-xs text-gray-600 mt-1">Open TrackSphere on your phone at /app or click &quot;Use My Real Location&quot; above.</p>
            </div>
          ) : (
            <div className="p-2 space-y-2 flex-1 overflow-y-auto">
              {devices.map(d => {
                const stale = isStale(d.recorded_at);
                const isSelected = selected?.device_id === d.device_id;

                return (
                  <div
                    key={d.device_id}
                    onClick={() => handleSelectDevice(d)}
                    role="button"
                    tabIndex={0}
                    className={clsx(
                      'w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer border',
                      isSelected
                        ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-lg shadow-indigo-950/50'
                        : 'bg-gray-850 hover:bg-gray-800 border-gray-800/80 text-gray-300'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {d.image_url ? (
                        <div className="relative shrink-0">
                          <img src={d.image_url} alt="" className="w-11 h-11 rounded-xl object-cover border border-gray-700 shadow-sm" />
                          <span className={clsx('absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-gray-900', stale ? 'bg-amber-400' : 'bg-emerald-400')} />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-gray-800 flex items-center justify-center shrink-0 border border-gray-700">
                          <Smartphone className="w-5 h-5 text-indigo-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm font-bold truncate text-white">{d.device_name}</span>
                          <span className={clsx('text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold', stale ? 'bg-amber-950 text-amber-400 border border-amber-800/50' : 'bg-emerald-950 text-emerald-400 border border-emerald-800/50')}>
                            {stale ? 'Stale' : 'Live'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">User: <strong className="text-gray-300">{d.user_name}</strong></p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono mt-2.5 pt-2 border-t border-gray-800/80">
                      <span>📍 {Number(d.latitude).toFixed(4)}, {Number(d.longitude).toFixed(4)}</span>
                      <span>{new Date(d.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>

                    {/* ⏱️ LOCATION HISTORY BUTTON */}
                    <div className="mt-2.5 pt-2 border-t border-gray-800/60 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-gray-500 font-medium">Day Schedule</span>
                      <a
                        href={`/locations?deviceId=${d.device_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                        title="View Location Schedule & History"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Location History
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick link to mobile app */}
          <div className="p-3 bg-gray-950/60 border-t border-gray-800 text-xs text-gray-400 flex items-center justify-between">
            <span>Install on Android Phone</span>
            <a href="/app" className="text-indigo-400 hover:text-indigo-300 font-semibold underline">
              Open /app
            </a>
          </div>
        </div>

        {/* Map View Area */}
        <div className="xl:col-span-3 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden relative flex flex-col min-h-[550px]">
          {mapEngine === 'leaflet' ? (
            leafletLoaded ? (
              <LeafletMapComponent
                devices={devices}
                selected={selected}
                onSelect={handleSelectDevice}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-950">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                <p className="text-sm font-medium">Initializing Interactive Map...</p>
              </div>
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-950 text-gray-300">
              <AlertCircle className="w-12 h-12 text-amber-500 mb-3" />
              <h3 className="text-lg font-bold text-white mb-2">Google Maps Key Notice (InvalidKeyMapError)</h3>
              <p className="text-xs text-gray-400 max-w-md mb-4 leading-relaxed">
                Google Cloud rejected the key <code className="text-indigo-400 font-mono px-1 bg-gray-800 rounded">{mapsKey.slice(0, 10)}...</code> with <strong>InvalidKeyMapError</strong>. 
                Google requires activating <em>&quot;Maps JavaScript API&quot;</em> in Google Cloud Console.
              </p>
              <button
                onClick={() => setMapEngine('leaflet')}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                Switch back to Interactive Map (Recommended)
              </button>
            </div>
          )}

          {/* Floating Selected Device Overlay Card */}
          {selected && (
            <div className="absolute bottom-5 left-5 right-5 sm:left-auto sm:right-5 sm:w-96 bg-gray-900/95 backdrop-blur-md border border-gray-700/80 rounded-2xl p-5 shadow-2xl z-[600]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {selected.image_url ? (
                    <img src={selected.image_url} alt="" className="w-12 h-12 rounded-2xl object-cover border-2 border-indigo-500 shadow-md shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-gray-800 flex items-center justify-center shrink-0 border border-gray-700">
                      <Smartphone className="w-6 h-6 text-indigo-400" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <h3 className="font-bold text-white text-base">{selected.device_name}</h3>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">User: {selected.user_name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    selectedIdRef.current = null;
                    setSelected(null);
                  }}
                  className="text-gray-400 hover:text-white text-xl leading-none px-2 py-1 cursor-pointer"
                >
                  ×
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs text-gray-300">
                <div className="p-2 bg-gray-800/70 rounded-xl border border-gray-700/50">
                  <span className="text-[10px] text-gray-500 uppercase block font-semibold">GPS Coordinates</span>
                  <span className="font-mono text-indigo-300">
                    {Number(selected.latitude).toFixed(5)}, {Number(selected.longitude).toFixed(5)}
                  </span>
                </div>
                <div className="p-2 bg-gray-800/70 rounded-xl border border-gray-700/50">
                  <span className="text-[10px] text-gray-500 uppercase block font-semibold">Accuracy</span>
                  <span className="font-mono text-emerald-300">
                    ±{selected.accuracy ? Math.round(Number(selected.accuracy)) + ' meters' : 'Standard'}
                  </span>
                </div>
                <div className="p-2 bg-gray-800/70 rounded-xl border border-gray-700/50">
                  <span className="text-[10px] text-gray-500 uppercase block font-semibold">Battery</span>
                  <span className="font-mono text-gray-200 flex items-center gap-1">
                    <Battery className="w-3.5 h-3.5 text-emerald-400" />
                    {selected.battery_level != null ? `${selected.battery_level}%` : 'Unknown'}
                  </span>
                </div>
                <div className="p-2 bg-gray-800/70 rounded-xl border border-gray-700/50">
                  <span className="text-[10px] text-gray-500 uppercase block font-semibold">Last Ping</span>
                  <span className="font-mono text-gray-200">
                    {new Date(selected.recorded_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {isStale(selected.recorded_at) ? (
                <div className="mt-3 p-2 bg-amber-950/60 border border-amber-800/80 rounded-xl text-amber-300 text-xs flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Stale Telemetry: Last update was {getTimeAgo(selected.recorded_at)}</span>
                </div>
              ) : (
                <div className="mt-3 p-2 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Active Live Fix: Coordinates streaming live ({getTimeAgo(selected.recorded_at)})</span>
                </div>
              )}

              {/* ⏱️ Direct Button to Location History */}
              <div className="mt-3 pt-3 border-t border-gray-700/60">
                <a
                  href={`/locations?deviceId=${selected.device_id}`}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  Location History
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
