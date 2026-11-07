'use client';

import { useEffect, useState, useRef } from 'react';
import {
  MapPin, Search, Calendar, Clock, Navigation, Play, Pause,
  RotateCcw, ArrowRight, User, Smartphone, AlertCircle, RefreshCw,
  CheckCircle2, Layers, Compass, ChevronRight
} from 'lucide-react';
import { Device } from '@/types';
import clsx from 'clsx';

interface LocationRecord {
  id: number;
  device_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  recorded_at: string;
  received_at: string;
}

// Calculate distance between two points in km (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Filter / Sample locations into ~30 minute intervals
function sampleHalfHourCheckpoints(records: LocationRecord[]): LocationRecord[] {
  if (records.length <= 1) return records;
  // Sort oldest to newest
  const sorted = [...records].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const sampled: LocationRecord[] = [sorted[0]];
  let lastTimestamp = new Date(sorted[0].recorded_at).getTime();

  for (let i = 1; i < sorted.length; i++) {
    const currentTimestamp = new Date(sorted[i].recorded_at).getTime();
    // 25 minutes threshold to capture 30-minute intervals
    if (currentTimestamp - lastTimestamp >= 25 * 60 * 1000 || i === sorted.length - 1) {
      sampled.push(sorted[i]);
      lastTimestamp = currentTimestamp;
    }
  }
  return sampled;
}

export default function LocationHistoryPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [filterMode, setFilterMode] = useState<'30min' | 'all'>('30min');
  const [preset, setPreset] = useState<'today' | 'yesterday' | '24h' | 'custom'>('today');

  const [fromTime, setFromTime] = useState('');
  const [toTime, setToTime] = useState('');

  const [rawLocations, setRawLocations] = useState<LocationRecord[]>([]);
  const [displayedLocations, setDisplayedLocations] = useState<LocationRecord[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<LocationRecord | null>(null);

  const [loadingDevices, setLoadingDevices] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);

  // Map state
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const [mapType, setMapType] = useState<'google_streets' | 'google_hybrid' | 'osm'>('google_streets');

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const playbackMarkerRef = useRef<any>(null);

  function getToken() {
    return localStorage.getItem('adminToken') || localStorage.getItem('accessToken') || '';
  }

  // Load Leaflet dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

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

  // Fetch all devices on mount & set default date (Today)
  useEffect(() => {
    applyPreset('today');

    fetch('/api/v1/devices', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) {
          setDevices(d.data);
          if (d.data.length > 0) {
            setSelectedDeviceId(d.data[0].id);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoadingDevices(false));
  }, []);

  // Apply Quick Date Schedule Presets
  function applyPreset(p: 'today' | 'yesterday' | '24h' | 'custom') {
    setPreset(p);
    const now = new Date();

    if (p === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      setFromTime(formatDateTimeLocal(start));
      setToTime(formatDateTimeLocal(end));
    } else if (p === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
      setFromTime(formatDateTimeLocal(start));
      setToTime(formatDateTimeLocal(end));
    } else if (p === '24h') {
      const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      setFromTime(formatDateTimeLocal(past24h));
      setToTime(formatDateTimeLocal(now));
    }
  }

  function formatDateTimeLocal(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Trigger search when device or times change
  useEffect(() => {
    if (selectedDeviceId && fromTime && toTime) {
      fetchHistory();
    }
  }, [selectedDeviceId]);

  // Fetch History from API
  async function fetchHistory() {
    if (!selectedDeviceId) return;
    setLoadingHistory(true);
    setIsPlaying(false);
    if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);

    try {
      const params = new URLSearchParams({
        deviceId: selectedDeviceId,
        limit: '1500',
        offset: '0',
      });

      if (fromTime) params.set('from', new Date(fromTime).toISOString());
      if (toTime) params.set('to', new Date(toTime).toISOString());

      const res = await fetch(`/api/v1/locations/history?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.data?.locations)) {
        const locs: LocationRecord[] = data.data.locations;
        setRawLocations(locs);
        setTotalRecords(data.data.pagination?.total || locs.length);

        // Sort chronologically (oldest to newest)
        const sorted = [...locs].sort(
          (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
        );

        const displayed = filterMode === '30min' ? sampleHalfHourCheckpoints(sorted) : sorted;
        setDisplayedLocations(displayed);
        setSelectedPoint(displayed[0] || null);
        setPlaybackIndex(0);
      } else {
        setRawLocations([]);
        setDisplayedLocations([]);
        setSelectedPoint(null);
        setTotalRecords(0);
      }
    } catch (err) {
      console.error('Fetch history error:', err);
    } finally {
      setLoadingHistory(false);
    }
  }

  // Handle filter mode toggle (30-min checkpoints vs raw)
  useEffect(() => {
    if (rawLocations.length === 0) return;
    const sorted = [...rawLocations].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );
    const displayed = filterMode === '30min' ? sampleHalfHourCheckpoints(sorted) : sorted;
    setDisplayedLocations(displayed);
    setPlaybackIndex(0);
    setIsPlaying(false);
  }, [filterMode]);

  // Tile URL configuration (Google Maps / Hybrid / OSM)
  function getTileConfig(type: 'google_streets' | 'google_hybrid' | 'osm') {
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

  // Initialize Map
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const map = L.map(mapContainerRef.current, {
      center: [23.8103, 90.4125],
      zoom: 13,
      zoomControl: true,
    });

    const cfg = getTileConfig(mapType);
    const tileLayer = L.tileLayer(cfg.url, cfg.options);
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    routeLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [leafletLoaded]);

  // Handle Layer Toggle (Google Streets / Hybrid / OSM)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = (window as any).L;
    if (!map || !L || !tileLayerRef.current) return;

    map.removeLayer(tileLayerRef.current);
    const cfg = getTileConfig(mapType);
    tileLayerRef.current = L.tileLayer(cfg.url, cfg.options).addTo(map);
  }, [mapType]);

  // Render Route Polyline & Numbered Checkpoints
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = (window as any).L;
    const routeLayer = routeLayerRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !L || !routeLayer || !markersLayer) return;

    routeLayer.clearLayers();
    markersLayer.clearLayers();

    if (displayedLocations.length === 0) return;

    const latLngs: [number, number][] = displayedLocations.map(p => [Number(p.latitude), Number(p.longitude)]);
    const bounds = L.latLngBounds(latLngs);

    // 1. Draw Journey Polyline with Arrow Direction
    const polyline = L.polyline(latLngs, {
      color: '#4f46e5',
      weight: 4.5,
      opacity: 0.85,
      lineJoin: 'round',
    }).addTo(routeLayer);

    // Glow background line
    L.polyline(latLngs, {
      color: '#818cf8',
      weight: 8,
      opacity: 0.25,
      lineJoin: 'round',
    }).addTo(routeLayer);

    // 2. Add Markers for Each Checkpoint
    displayedLocations.forEach((p, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === displayedLocations.length - 1;
      const timeStr = new Date(p.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let iconHtml = '';
      let iconSize: [number, number] = [32, 32];
      let iconAnchor: [number, number] = [16, 16];

      if (isStart) {
        iconHtml = `
          <div style="background: #10b981; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
            START
          </div>
        `;
        iconSize = [34, 34];
        iconAnchor = [17, 17];
      } else if (isEnd) {
        iconHtml = `
          <div style="background: #ef4444; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.5); animation: pulse 2s infinite;">
            END
          </div>
        `;
        iconSize = [34, 34];
        iconAnchor = [17, 17];
      } else {
        iconHtml = `
          <div style="background: #1e1b4b; color: #a5b4fc; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; border: 2px solid #6366f1; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">
            ${idx + 1}
          </div>
        `;
        iconSize = [26, 26];
        iconAnchor = [13, 13];
      }

      const customIcon = L.divIcon({
        className: 'custom-history-marker',
        html: iconHtml,
        iconSize,
        iconAnchor,
      });

      const marker = L.marker([Number(p.latitude), Number(p.longitude)], { icon: customIcon }).addTo(markersLayer);

      const popupContent = `
        <div style="font-family: sans-serif; padding: 4px; min-width: 170px; color: #0f172a;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 800; font-size: 13px; color: ${isStart ? '#059669' : isEnd ? '#dc2626' : '#4f46e5'};">
              ${isStart ? '🚩 Journey Start' : isEnd ? '🏁 Final Stop' : `⏱️ Stop #${idx + 1}`}
            </span>
            <span style="font-size: 11px; background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 6px; font-weight: 600;">
              ${timeStr}
            </span>
          </div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">Date: ${new Date(p.recorded_at).toLocaleDateString()}</div>
          <div style="font-size: 12px; margin-bottom: 2px;"><strong>Lat:</strong> ${Number(p.latitude).toFixed(5)}</div>
          <div style="font-size: 12px; margin-bottom: 4px;"><strong>Lng:</strong> ${Number(p.longitude).toFixed(5)}</div>
          <div style="font-size: 11px; color: #64748b;">Accuracy: ±${p.accuracy ? Math.round(Number(p.accuracy)) + 'm' : 'GPS'}</div>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on('click', () => setSelectedPoint(p));
    });

    map.fitBounds(bounds, { padding: [50, 50] });
  }, [displayedLocations]);

  // Focus map when user clicks a timeline point
  function handleFocusPoint(p: LocationRecord) {
    setSelectedPoint(p);
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([Number(p.latitude), Number(p.longitude)], 17, { duration: 0.8 });
    }
  }

  // Playback Animation (Steps through the day's stops)
  useEffect(() => {
    if (!isPlaying) {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      return;
    }

    if (displayedLocations.length === 0) {
      setIsPlaying(false);
      return;
    }

    playbackTimerRef.current = setInterval(() => {
      setPlaybackIndex(prev => {
        const next = prev + 1;
        if (next >= displayedLocations.length) {
          setIsPlaying(false);
          return 0;
        }
        const point = displayedLocations[next];
        setSelectedPoint(point);
        const map = mapInstanceRef.current;
        if (map) {
          map.panTo([Number(point.latitude), Number(point.longitude)]);
        }
        return next;
      });
    }, 1500);

    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, displayedLocations]);

  // Total distance calculation
  const totalDistanceKm = displayedLocations.reduce((acc, curr, idx) => {
    if (idx === 0) return 0;
    const prev = displayedLocations[idx - 1];
    return acc + calculateDistance(Number(prev.latitude), Number(prev.longitude), Number(curr.latitude), Number(curr.longitude));
  }, 0);

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-400" />
            Location Schedule &amp; Day Journey History
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Track where any user traveled throughout the day with 30-minute checkpoints and route playback.
          </p>
        </div>

        {/* Quick Filter Mode Toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-900 border border-gray-800 rounded-xl text-xs">
          <button
            onClick={() => setFilterMode('30min')}
            className={clsx(
              'px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5',
              filterMode === '30min' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            Every 30 Mins (Half-Hour Stops)
          </button>
          <button
            onClick={() => setFilterMode('all')}
            className={clsx(
              'px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5',
              filterMode === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
            )}
          >
            All GPS Points ({totalRecords})
          </button>
        </div>
      </div>

      {/* Control Panel: Device Selector & Time Schedule */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Device Selector */}
          <div className="md:col-span-4">
            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">
              Select User / Device
            </label>
            <select
              value={selectedDeviceId}
              onChange={e => setSelectedDeviceId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              {devices.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} • {d.user_name || 'User'}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Schedule Presets */}
          <div className="md:col-span-8 flex flex-col justify-end space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                Schedule Presets
              </span>
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'today', label: 'Today (All Day)' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: '24h', label: 'Past 24 Hours' },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => applyPreset(item.id as any)}
                    className={clsx(
                      'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                      preset === item.id ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Range Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <input
                  type="datetime-local"
                  value={fromTime}
                  onChange={e => {
                    setPreset('custom');
                    setFromTime(e.target.value);
                  }}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
              <div>
                <input
                  type="datetime-local"
                  value={toTime}
                  onChange={e => {
                    setPreset('custom');
                    setToTime(e.target.value);
                  }}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
              <button
                onClick={fetchHistory}
                disabled={loadingHistory || !selectedDeviceId}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {loadingHistory ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                Search Schedule
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stat Cards */}
      {displayedLocations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wider block mb-1">
              Checkpoints / Stops
            </span>
            <p className="text-xl font-bold text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-indigo-400" />
              {displayedLocations.length} stops
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {filterMode === '30min' ? 'Sampled every ~30 mins' : 'All recorded GPS fixes'}
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wider block mb-1">
              Est. Distance Traveled
            </span>
            <p className="text-xl font-bold text-emerald-400 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-emerald-400" />
              {totalDistanceKm.toFixed(2)} km
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">Calculated across all stops</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wider block mb-1">
              Journey Start
            </span>
            <p className="text-lg font-bold text-white truncate">
              {new Date(displayedLocations[0].recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-[10px] text-emerald-400 mt-0.5 font-mono">
              {Number(displayedLocations[0].latitude).toFixed(4)}, {Number(displayedLocations[0].longitude).toFixed(4)}
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wider block mb-1">
              Final / Latest Stop
            </span>
            <p className="text-lg font-bold text-white truncate">
              {new Date(displayedLocations[displayedLocations.length - 1].recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-[10px] text-rose-400 mt-0.5 font-mono">
              {Number(displayedLocations[displayedLocations.length - 1].latitude).toFixed(4)}, {Number(displayedLocations[displayedLocations.length - 1].longitude).toFixed(4)}
            </p>
          </div>
        </div>
      )}

      {/* Main Content: Map & Side Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[580px]">
        {/* Interactive Map Area (8 cols) */}
        <div className="lg:col-span-8 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden relative flex flex-col min-h-[520px]">
          {/* Map Controls */}
          <div className="absolute top-4 right-4 z-[500] flex gap-1 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-xl p-1 shadow-xl text-xs">
            <button
              onClick={() => setMapType('google_streets')}
              className={clsx(
                'px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer',
                mapType === 'google_streets' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'
              )}
            >
              Google Map
            </button>
            <button
              onClick={() => setMapType('google_hybrid')}
              className={clsx(
                'px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer',
                mapType === 'google_hybrid' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'
              )}
            >
              Satellite + Places
            </button>
            <button
              onClick={() => setMapType('osm')}
              className={clsx(
                'px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer',
                mapType === 'osm' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'
              )}
            >
              OpenStreetMap
            </button>
          </div>

          {/* Route Playback Toolbar at bottom */}
          {displayedLocations.length > 1 && (
            <div className="absolute bottom-4 left-4 right-4 z-[500] bg-gray-900/95 backdrop-blur border border-gray-700/80 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer shrink-0"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <div>
                  <p className="text-xs font-bold text-white">
                    {isPlaying ? 'Playing Journey...' : 'Play Route Timeline'}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Step {playbackIndex + 1} of {displayedLocations.length} • {new Date(displayedLocations[playbackIndex]?.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 flex-1 max-w-xs">
                <input
                  type="range"
                  min="0"
                  max={displayedLocations.length - 1}
                  value={playbackIndex}
                  onChange={e => {
                    const idx = Number(e.target.value);
                    setPlaybackIndex(idx);
                    handleFocusPoint(displayedLocations[idx]);
                  }}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <button
                onClick={() => {
                  setPlaybackIndex(0);
                  handleFocusPoint(displayedLocations[0]);
                }}
                className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="Reset to Start"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Map canvas */}
          <div ref={mapContainerRef} className="w-full h-full min-h-[520px] flex-1" />

          {/* Empty state if no locations */}
          {!loadingHistory && displayedLocations.length === 0 && (
            <div className="absolute inset-0 bg-gray-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-[400]">
              <MapPin className="w-12 h-12 text-gray-700 mb-3" />
              <h3 className="text-base font-bold text-white mb-1">No Location Records in This Schedule</h3>
              <p className="text-xs text-gray-400 max-w-sm mb-4">
                No location fixes were recorded for this device during the selected time period.
              </p>
              <button
                onClick={() => applyPreset('24h')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow cursor-pointer transition-colors"
              >
                Try Past 24 Hours
              </button>
            </div>
          )}
        </div>

        {/* Side Timeline Panel (Where was he all day long) (4 cols) */}
        <div className="lg:col-span-4 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col h-[580px] overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Timeline Schedule</span>
                <span className="px-2 py-0.5 bg-indigo-950 text-indigo-400 border border-indigo-800 rounded-full text-[10px] font-mono">
                  {displayedLocations.length} stops
                </span>
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {selectedDevice ? `${selectedDevice.name} (${selectedDevice.user_name || 'User'})` : 'Select a device'}
              </p>
            </div>
          </div>

          {/* Timeline List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingHistory ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : displayedLocations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 p-6">
                <Clock className="w-8 h-8 text-gray-700 mb-2" />
                <p className="text-xs">No stops recorded for this timeframe.</p>
              </div>
            ) : (
              displayedLocations.map((p, idx) => {
                const isStart = idx === 0;
                const isEnd = idx === displayedLocations.length - 1;
                const isSelected = selectedPoint?.id === p.id;
                const timeStr = new Date(p.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div
                    key={p.id || idx}
                    onClick={() => handleFocusPoint(p)}
                    className={clsx(
                      'relative pl-7 cursor-pointer transition-all group',
                    )}
                  >
                    {/* Connecting line */}
                    {idx < displayedLocations.length - 1 && (
                      <div className="absolute left-[11px] top-4 bottom-[-16px] w-0.5 bg-gray-800 group-hover:bg-indigo-500/60 transition-colors" />
                    )}

                    {/* Timeline Dot */}
                    <div
                      className={clsx(
                        'absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all',
                        isStart
                          ? 'bg-emerald-600 border-emerald-400 text-white'
                          : isEnd
                          ? 'bg-rose-600 border-rose-400 text-white'
                          : isSelected
                          ? 'bg-indigo-600 border-white text-white scale-110 shadow-lg'
                          : 'bg-gray-800 border-gray-700 text-gray-400 group-hover:border-indigo-400 group-hover:text-white'
                      )}
                    >
                      {isStart ? 'S' : isEnd ? 'E' : idx + 1}
                    </div>

                    {/* Card Content */}
                    <div
                      className={clsx(
                        'p-3 rounded-xl border transition-all',
                        isSelected
                          ? 'bg-indigo-950/80 border-indigo-600 text-white shadow-md'
                          : 'bg-gray-850/80 hover:bg-gray-800 border-gray-800 text-gray-300'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-400" />
                          {timeStr}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                          {isStart ? 'Start' : isEnd ? 'Latest' : `Stop #${idx + 1}`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                        <span>Lat: {Number(p.latitude).toFixed(4)}</span>
                        <span>Lng: {Number(p.longitude).toFixed(4)}</span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1 pt-1 border-t border-gray-800/60">
                        <span>Accuracy: ±{p.accuracy ? Math.round(Number(p.accuracy)) + 'm' : 'GPS'}</span>
                        <span className="text-indigo-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                          Focus <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
