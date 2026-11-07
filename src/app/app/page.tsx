'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Smartphone, MapPin, Radio, WifiOff, Battery, ShieldCheck,
  CheckCircle2, AlertCircle, RefreshCw, ArrowLeft, Activity,
  Lock, Camera, User, Edit3, PlusCircle, Clock, Navigation,
  Crosshair, Layers, Globe, Download, ExternalLink, Compass
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

function generateDeviceUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'dev-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
}

export default function MobileAppPage() {
  const [isSharing, setIsSharing] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('Initializing device...');
  const [syncCount, setSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Device & Profile state
  const [deviceId, setDeviceId] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [userToken, setUserToken] = useState<string>('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [error, setError] = useState<string>('');

  // Map state
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapType, setMapType] = useState<'google_streets' | 'google_hybrid' | 'osm'>('google_streets');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  const watchIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const latestCoordsRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);
  const deviceIdRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastSentTimeRef = useRef<number>(0);
  const isSharingRef = useRef<boolean>(false);
  const wakeLockRef = useRef<any>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);

  // 1-second silent WAV base64 audio data URI to prevent Android Chrome tab sleep
  const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        const lock = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current = lock;
        setWakeLockActive(true);
        lock.addEventListener('release', () => {
          setWakeLockActive(false);
          wakeLockRef.current = null;
        });
      }
    } catch (e) {
      console.warn('Wake Lock request:', e);
    }
  }

  function releaseWakeLock() {
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
        setWakeLockActive(false);
      }
    } catch {}
  }

  function startSilentAudio() {
    try {
      if (!silentAudioRef.current) {
        const audio = new Audio(SILENT_AUDIO_URI);
        audio.loop = true;
        audio.volume = 0.01;
        audio.play().catch(() => {});
        silentAudioRef.current = audio;
      }
    } catch {}
  }

  function stopSilentAudio() {
    try {
      if (silentAudioRef.current) {
        silentAudioRef.current.pause();
        silentAudioRef.current = null;
      }
    } catch {}
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

  // Initialize Map
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const initialCenter = coords ? [coords.lat, coords.lng] : [23.8103, 90.4125];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: coords ? 16 : 14,
      zoomControl: true,
    });

    const cfg = getTileConfig(mapType);
    const tileLayer = L.tileLayer(cfg.url, cfg.options);
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [leafletLoaded]);

  // Tile Config
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

  // Handle Layer Toggle
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = (window as any).L;
    if (!map || !L || !tileLayerRef.current) return;

    map.removeLayer(tileLayerRef.current);
    const cfg = getTileConfig(mapType);
    tileLayerRef.current = L.tileLayer(cfg.url, cfg.options).addTo(map);
  }, [mapType]);

  // Update Map Marker & Accuracy Circle when coords change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = (window as any).L;
    if (!map || !L || !coords) return;

    const latLng: [number, number] = [coords.lat, coords.lng];

    // Marker HTML with glowing live ping
    const iconHtml = `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: #10b981; opacity: 0.3; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="width: 28px; height: 28px; border-radius: 50%; background: #10b981; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 11px; z-index: 10;">
          ME
        </div>
      </div>
    `;

    const customIcon = L.divIcon({
      className: 'my-location-marker',
      html: iconHtml,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    if (markerRef.current) {
      markerRef.current.setLatLng(latLng);
      markerRef.current.setIcon(customIcon);
    } else {
      markerRef.current = L.marker(latLng, { icon: customIcon }).addTo(map);
    }

    if (circleRef.current) {
      circleRef.current.setLatLng(latLng);
      circleRef.current.setRadius(coords.accuracy || 20);
    } else {
      circleRef.current = L.circle(latLng, {
        radius: coords.accuracy || 20,
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.12,
        weight: 1.5,
      }).addTo(map);
    }

    // Auto-center map on first fix
    if (!mapInstanceRef.current._hasInitiallyCentered) {
      map.setView(latLng, 16);
      mapInstanceRef.current._hasInitiallyCentered = true;
    }
  }, [coords]);

  function handleCenterMap() {
    const map = mapInstanceRef.current;
    if (map && coords) {
      map.flyTo([coords.lat, coords.lng], 17, { duration: 0.8 });
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect / generate UNIQUE device ID for THIS phone/browser
    let currentId = localStorage.getItem('tracksphere_device_uuid');
    if (!currentId || currentId === '9f2f6062-af23-48fa-abc3-cb2c42f9ec96') {
      currentId = generateDeviceUUID();
      localStorage.setItem('tracksphere_device_uuid', currentId);
      localStorage.removeItem('tracksphere_is_registered');
    }
    setDeviceId(currentId);
    deviceIdRef.current = currentId;

    const registeredFlag = localStorage.getItem('tracksphere_is_registered') === 'true';
    setIsRegistered(registeredFlag);

    const storedUserName = localStorage.getItem('tracksphere_user_name') || '';
    const storedDevName = localStorage.getItem('tracksphere_device_name') || (getDefaultDeviceName());
    const storedImgUrl = localStorage.getItem('tracksphere_image_url') || '';

    setUserName(storedUserName);
    setDeviceName(storedDevName);
    setImageUrl(storedImgUrl);

    // Battery API
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }).catch(() => {});
    }

    // PWA Install prompt listener
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    });

    const token = localStorage.getItem('adminToken') || localStorage.getItem('accessToken') || '';
    setUserToken(token);

    // If already registered and persistent sharing was active, resume tracking
    const persistentFlag = localStorage.getItem('tracksphere_sharing_active');
    if (registeredFlag && persistentFlag === 'true') {
      setIsSharing(true);
      isSharingRef.current = true;
      setSyncStatus('Persistent Sharing ACTIVE • Resuming live GPS stream...');
      startTracking(currentId);
    } else if (registeredFlag) {
      setSyncStatus('Device Registered • Sharing is paused');
    } else {
      setSyncStatus('New Device • Complete registration below');
    }

    // Auto Wakeup listener: Fires when phone screen turns on, tab is focused, or app wakes from sleep
    const handleWakeup = () => {
      if (document.visibilityState === 'visible' && isSharingRef.current) {
        requestWakeLock();
        startSilentAudio();
        forceGpsPing();
      }
    };

    document.addEventListener('visibilitychange', handleWakeup);
    window.addEventListener('focus', handleWakeup);
    window.addEventListener('pageshow', handleWakeup);
    window.addEventListener('online', handleWakeup);

    return () => {
      document.removeEventListener('visibilitychange', handleWakeup);
      window.removeEventListener('focus', handleWakeup);
      window.removeEventListener('pageshow', handleWakeup);
      window.removeEventListener('online', handleWakeup);
      releaseWakeLock();
      stopSilentAudio();
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, []);

  function getDefaultDeviceName(): string {
    if (typeof navigator === 'undefined') return 'Mobile Phone';
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'Android Smartphone';
    if (/iphone|ipad/i.test(ua)) return 'Apple iPhone';
    if (/windows/i.test(ua)) return 'Windows Laptop / PC';
    return 'Web Device';
  }

  // Handle Photo selection and upload to ImageKit
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setSaveSuccessMsg('');

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;

        const res = await fetch('/api/v1/media/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: base64Data,
            fileName: `${userName || 'device'}_${Date.now()}.jpg`,
            folder: '/tracksphere',
          }),
        });

        const data = await res.json();
        if (data.success && data.data?.url) {
          const uploadedUrl = data.data.url;
          setImageUrl(uploadedUrl);
          localStorage.setItem('tracksphere_image_url', uploadedUrl);

          setSaveSuccessMsg('✓ Photo uploaded to ImageKit!');
          setTimeout(() => setSaveSuccessMsg(''), 4000);
        } else {
          alert('Upload failed: ' + (data.error || 'Check ImageKit settings'));
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setIsUploading(false);
      alert('Error reading image file');
    }
  }

  // Register Device & Enable Tracking
  async function handleRegisterDevice() {
    if (!userName.trim()) {
      alert('Please enter your name.');
      return;
    }

    const currentDevId = deviceIdRef.current || deviceId;
    const finalDevName = deviceName.trim() || getDefaultDeviceName();

    try {
      setSyncStatus('Registering this device in database...');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userToken) headers['Authorization'] = `Bearer ${userToken}`;

      const res = await fetch('/api/v1/devices/register-mobile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          deviceId: currentDevId,
          name: finalDevName,
          model: 'mobile',
          userName: userName.trim(),
          imageUrl: imageUrl || null,
          batteryLevel: batteryLevel,
        }),
      });

      const data = await res.json();
      if (data.success) {
        localStorage.setItem('tracksphere_is_registered', 'true');
        localStorage.setItem('tracksphere_user_name', userName.trim());
        localStorage.setItem('tracksphere_device_name', finalDevName);
        if (imageUrl) localStorage.setItem('tracksphere_image_url', imageUrl);

        setIsRegistered(true);
        setIsEditing(false);
        setSaveSuccessMsg('✓ Device successfully registered!');

        // Start GPS tracking immediately
        startTracking(currentDevId);
      } else {
        alert('Registration error: ' + (data.error || 'Could not register device'));
      }
    } catch (err: any) {
      alert('Network error connecting to backend: ' + err.message);
    }
  }

  // Register a brand new / separate device
  function handleRegisterNewDevice() {
    const confirmReset = confirm(
      'Do you want to register a NEW device from this browser/phone?\n\nA new unique Device ID will be generated so it will be tracked as a separate device on the map.'
    );
    if (!confirmReset) return;

    stopTrackingExplicit();

    const newId = generateDeviceUUID();
    localStorage.setItem('tracksphere_device_uuid', newId);
    localStorage.removeItem('tracksphere_is_registered');
    localStorage.removeItem('tracksphere_user_name');
    localStorage.removeItem('tracksphere_device_name');
    localStorage.removeItem('tracksphere_image_url');
    localStorage.removeItem('tracksphere_sharing_active');

    setDeviceId(newId);
    deviceIdRef.current = newId;
    setUserName('');
    setDeviceName(getDefaultDeviceName());
    setImageUrl('');
    setIsRegistered(false);
    setIsEditing(false);
    setSyncCount(0);
    setCoords(null);
    setSyncStatus('New Device ID generated • Fill in details and click Register');
  }

  async function sendLocationUpdate(lat: number, lng: number, accuracy: number, targetId?: string) {
    const devId = targetId || deviceIdRef.current || deviceId;
    if (!devId) return;

    try {
      setSyncStatus('Transmitting GPS fix to Cloud...');

      const payload = {
        deviceId: devId,
        latitude: lat,
        longitude: lng,
        accuracy: Math.round(accuracy * 10) / 10,
        batteryLevel: batteryLevel,
        recordedAt: new Date().toISOString(),
      };

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }

      const res = await fetch('/api/v1/locations', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSyncCount(c => c + 1);
        setLastSyncTime(new Date().toLocaleTimeString());
        setSyncStatus(`Live GPS Synced (${lat.toFixed(4)}, ${lng.toFixed(4)}) • Persistent`);
      } else {
        setSyncStatus('Server acknowledged receipt');
      }
    } catch {
      setSyncStatus('Offline / Network retry pending');
    }
  }

  function forceGpsPing(targetDevId?: string) {
    const devId = targetDevId || deviceIdRef.current || deviceId;
    if (!navigator.geolocation || !devId) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setCoords(c);
        if (pos.coords.speed != null) setSpeed(Math.round(pos.coords.speed * 3.6)); // km/h
        if (pos.coords.heading != null) setHeading(Math.round(pos.coords.heading));
        latestCoordsRef.current = c;
        lastSentTimeRef.current = Date.now();
        sendLocationUpdate(c.lat, c.lng, c.accuracy, devId);
      },
      (err) => {
        console.warn('Active ping warning:', err.message);
        if (latestCoordsRef.current) {
          sendLocationUpdate(
            latestCoordsRef.current.lat,
            latestCoordsRef.current.lng,
            latestCoordsRef.current.accuracy,
            devId
          );
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
  }

  async function startTracking(explicitDevId?: string) {
    const targetDevId = explicitDevId || deviceIdRef.current || deviceId;
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setError('');
    setIsSharing(true);
    isSharingRef.current = true;
    localStorage.setItem('tracksphere_sharing_active', 'true');
    setSyncStatus('Continuous Real-Time GPS Active • Broadcasting...');

    requestWakeLock();
    startSilentAudio();

    if (targetDevId) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userToken) headers['Authorization'] = `Bearer ${userToken}`;

      fetch('/api/v1/consent/grant', {
        method: 'POST',
        headers,
        body: JSON.stringify({ deviceId: targetDevId, purpose: 'location_sharing' }),
      }).catch(() => {});

      fetch('/api/v1/sharing/start', {
        method: 'POST',
        headers,
        body: JSON.stringify({ deviceId: targetDevId }),
      }).catch(() => {});
    }

    forceGpsPing(targetDevId);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const c = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setCoords(c);
        if (pos.coords.speed != null) setSpeed(Math.round(pos.coords.speed * 3.6));
        if (pos.coords.heading != null) setHeading(Math.round(pos.coords.heading));
        latestCoordsRef.current = c;

        const now = Date.now();
        if (now - lastSentTimeRef.current >= 2000) {
          lastSentTimeRef.current = now;
          sendLocationUpdate(c.lat, c.lng, c.accuracy, targetDevId);
        }
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 }
    );

    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
    }
    intervalIdRef.current = setInterval(() => {
      forceGpsPing(targetDevId);
    }, 3500);
  }

  function stopTrackingExplicit() {
    setIsSharing(false);
    isSharingRef.current = false;
    localStorage.setItem('tracksphere_sharing_active', 'false');
    releaseWakeLock();
    stopSilentAudio();

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    const targetDevId = deviceIdRef.current || deviceId;
    if (targetDevId) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userToken) headers['Authorization'] = `Bearer ${userToken}`;
      fetch('/api/v1/sharing/stop', {
        method: 'POST',
        headers,
        body: JSON.stringify({ deviceId: targetDevId }),
      }).catch(() => {});
    }

    setSyncStatus('Sharing Stopped (Turned OFF by user inside app)');
  }

  function handleToggleSharing() {
    if (!isSharing) {
      startTracking();
    } else {
      stopTrackingExplicit();
    }
  }

  async function handleInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    } else {
      alert('To install on Android: Tap browser menu (⋮) > "Install app" or "Add to Home screen".');
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans selection:bg-indigo-500">
      {/* ─── TOP WEB NAVIGATION BAR (MATCHES TRACKSPHERE WEB) ─── */}
      <header className="bg-gray-900/90 backdrop-blur border-b border-gray-800 sticky top-0 z-[600]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/30">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-white font-black text-lg tracking-tight">TrackSphere</span>
                <span className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-400 border border-indigo-800">
                  Mobile Client
                </span>
              </div>
            </Link>
          </div>

          {/* Quick Nav Links (Dashboard, Tracking, History) */}
          <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-gray-400">
            <Link href="/tracking" className="px-3 py-1.5 rounded-lg hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-indigo-400" />
              Live Fleet Map
            </Link>
            <Link href="/locations" className="px-3 py-1.5 rounded-lg hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              Location History
            </Link>
            <Link href="/devices" className="px-3 py-1.5 rounded-lg hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
              Devices
            </Link>
          </div>

          {/* Live Status Pill & Battery */}
          <div className="flex items-center gap-2.5">
            <div className={clsx(
              'px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border',
              isSharing
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800 shadow-sm'
                : 'bg-gray-800 text-gray-400 border-gray-700'
            )}>
              <span className={clsx('w-2 h-2 rounded-full', isSharing ? 'bg-emerald-400 animate-ping' : 'bg-gray-500')} />
              <span>{isSharing ? 'STREAMING' : 'PAUSED'}</span>
            </div>

            <div className="flex items-center gap-1 px-2.5 py-1 bg-gray-800 border border-gray-700/60 rounded-xl text-xs font-mono text-gray-300">
              <Battery className="w-3.5 h-3.5 text-emerald-400" />
              <span>{batteryLevel != null ? `${batteryLevel}%` : 'Phone'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT: DASHBOARD GRID ─── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Page Title & Subtitle */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Smartphone className="w-6 h-6 text-indigo-400" />
              <span>Mobile Location Tracker &amp; Streaming Hub</span>
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">
              Consent-driven real-time GPS telemetry broadcast. Streams coordinates continuously to the TrackSphere admin map.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isInstallable && (
              <button
                onClick={handleInstallClick}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Install on Phone
              </button>
            )}
            <Link
              href={`/locations?deviceId=${deviceId}`}
              className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              My History
            </Link>
          </div>
        </div>

        {/* ─── TWO-COLUMN WORKSPACE: CONTROLS (4 COLS) + INTERACTIVE MAP (8 COLS) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[580px]">
          {/* LEFT COLUMN: Controls & Device Profile (4 cols) */}
          <div className="lg:col-span-4 space-y-5 flex flex-col">
            {/* Device Profile Card */}
            {(!isRegistered || isEditing) ? (
              <div className="bg-gray-900 border border-indigo-500/40 rounded-2xl p-5 shadow-xl relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" />
                    {isRegistered ? 'Edit Device Details' : 'Register This Device'}
                  </span>
                  {isRegistered && (
                    <button onClick={() => setIsEditing(false)} className="text-xs text-gray-400 hover:text-white">
                      Cancel
                    </button>
                  )}
                </div>

                <div className="relative w-20 h-20 mx-auto mb-3">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-indigo-500 flex items-center justify-center bg-gray-800 shadow-md">
                    {imageUrl ? (
                      <img src={imageUrl} alt="User Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-9 h-9 text-gray-500" />
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg cursor-pointer border border-gray-900"
                    title="Upload Photo to ImageKit"
                  >
                    {isUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-gray-300 font-semibold block mb-1">Your Name *</label>
                    <input
                      type="text"
                      value={userName}
                      onChange={e => setUserName(e.target.value)}
                      placeholder="e.g. Niloy Chandra Sarker"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-300 font-semibold block mb-1">Device Name / Model *</label>
                    <input
                      type="text"
                      value={deviceName}
                      onChange={e => setDeviceName(e.target.value)}
                      placeholder="e.g. My Device (honor 200 pro)"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-300 font-semibold block mb-1">
                      Device Identifier / Traccar ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={deviceId}
                      onChange={e => {
                        const val = e.target.value.trim();
                        setDeviceId(val);
                        deviceIdRef.current = val;
                        localStorage.setItem('tracksphere_device_uuid', val);
                      }}
                      placeholder="e.g. 377204 or Realme c71"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      💡 If using Traccar Client APK, enter your Traccar identifier (e.g. <strong className="text-indigo-400">377204</strong>) here to link your photo &amp; name.
                    </p>
                  </div>
                  <button
                    onClick={handleRegisterDevice}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer mt-1"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isRegistered ? 'Save Changes' : 'Register & Start Tracking'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-3.5">
                  <div className={clsx(
                    'w-14 h-14 rounded-2xl overflow-hidden border-2 flex items-center justify-center bg-gray-800 shrink-0 shadow-md',
                    isSharing ? 'border-emerald-500 shadow-emerald-500/20' : 'border-gray-700'
                  )}>
                    {imageUrl ? (
                      <img src={imageUrl} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-7 h-7 text-gray-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white truncate">{userName || 'Registered User'}</h3>
                      <button onClick={() => setIsEditing(true)} className="p-1 text-gray-400 hover:text-white" title="Edit Profile">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-indigo-400 font-semibold truncate mt-0.5">{deviceName}</p>
                    <p className="text-[10px] text-gray-500 font-mono truncate mt-0.5">ID: {deviceId}</p>
                  </div>
                </div>

                {saveSuccessMsg && (
                  <p className="mt-2 text-[11px] text-emerald-400 font-mono text-center">{saveSuccessMsg}</p>
                )}
              </div>
            )}

            {/* Sharing Toggle Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Telemetry Broadcast
                </span>
                <span className={clsx(
                  'px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono',
                  isSharing ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-gray-800 text-gray-400'
                )}>
                  {isSharing ? 'ACTIVE 24/7' : 'OFF'}
                </span>
              </div>

              <button
                onClick={handleToggleSharing}
                disabled={!isRegistered}
                className={clsx(
                  'w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-xl cursor-pointer active:scale-98',
                  !isRegistered
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : isSharing
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                )}
              >
                {isSharing ? (
                  <>
                    <WifiOff className="w-4 h-4" />
                    Stop Location Sharing
                  </>
                ) : (
                  <>
                    <Radio className="w-4 h-4 animate-pulse" />
                    {isRegistered ? 'Resume Live Sharing' : 'Register Device Above'}
                  </>
                )}
              </button>

              <button
                onClick={() => forceGpsPing()}
                disabled={!isRegistered}
                className="w-full py-2 bg-gray-800 hover:bg-gray-750 border border-gray-700 text-gray-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                Transmit Instant GPS Fix Now
              </button>
            </div>

            {/* Live Telemetry Overview Stats */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-xl space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">GPS Status:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1 font-mono text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Streaming Live (Every 3.5s)
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-400">
                <span>Keep-Awake:</span>
                <span className="font-semibold text-[11px] font-mono text-indigo-400">
                  {wakeLockActive ? '🟢 Screen WakeLock ON' : '🟢 Background Stream ON'}
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-400">
                <span>Coordinates:</span>
                <span className="font-mono text-indigo-300 font-bold">
                  {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'Acquiring GPS...'}
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-400">
                <span>Precision:</span>
                <span className="text-gray-200 font-mono">
                  {coords ? `±${Math.round(coords.accuracy)}m` : 'N/A'}
                </span>
              </div>

              {speed != null && speed > 0 && (
                <div className="flex items-center justify-between text-gray-400">
                  <span>Speed:</span>
                  <span className="text-emerald-400 font-mono font-bold">{speed} km/h</span>
                </div>
              )}

              <div className="flex items-center justify-between text-gray-400">
                <span>Fixes Broadcasted:</span>
                <span className="text-emerald-400 font-mono font-bold">{syncCount} updates sent</span>
              </div>

              {lastSyncTime && (
                <div className="flex items-center justify-between text-gray-400">
                  <span>Last Broadcast:</span>
                  <span className="text-gray-300 font-mono">{lastSyncTime}</span>
                </div>
              )}
            </div>

            {/* 📲 TrackSphere Official Mobile App Install Card */}
            <div className="bg-gradient-to-br from-indigo-950/60 via-gray-900 to-emerald-950/40 border border-indigo-700/60 rounded-2xl p-4 shadow-xl text-left">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                  <Smartphone className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-white">Install TrackSphere on Your Phone</h4>
                  <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">
                    Install this exact TrackSphere dashboard as a native app on your phone home screen with live map &amp; background GPS.
                  </p>
                  <button
                    onClick={handleInstallClick}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Install TrackSphere App
                  </button>
                </div>
              </div>
            </div>

            {/* Register Another Device Button */}
            <button
              onClick={handleRegisterNewDevice}
              className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 border border-dashed border-gray-700 hover:border-indigo-500 text-gray-400 hover:text-white rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
              Register Another Device From Here
            </button>
          </div>

          {/* RIGHT COLUMN: Interactive Live Map (8 cols) */}
          <div className="lg:col-span-8 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden relative flex flex-col min-h-[520px] shadow-2xl">
            {/* Map Style Controls */}
            <div className="absolute top-4 right-4 z-[500] flex gap-1 bg-gray-900/95 backdrop-blur border border-gray-700/80 rounded-xl p-1 shadow-xl text-xs">
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
                OSM
              </button>
            </div>

            {/* Recenter on My Location Button */}
            <button
              onClick={handleCenterMap}
              className="absolute bottom-6 right-4 z-[500] w-11 h-11 bg-gray-900/95 hover:bg-gray-800 border border-gray-700 rounded-2xl text-white flex items-center justify-center shadow-2xl transition-transform active:scale-95 cursor-pointer"
              title="Center on my location"
            >
              <Crosshair className="w-5 h-5 text-indigo-400" />
            </button>

            {/* Floating Live Indicator Banner at Bottom Left */}
            <div className="absolute bottom-6 left-4 z-[500] bg-gray-900/90 backdrop-blur border border-gray-700/80 rounded-2xl px-4 py-2.5 shadow-2xl flex items-center gap-3 text-xs">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <p className="font-bold text-white flex items-center gap-1.5">
                  <span>{userName || 'My Live Location'}</span>
                  <span className="text-[10px] text-gray-400 font-mono">({deviceName})</span>
                </p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                  {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} (±${Math.round(coords.accuracy)}m)` : 'Locating satellite...'}
                </p>
              </div>
            </div>

            {/* Leaflet Map Canvas */}
            <div ref={mapContainerRef} className="w-full h-full min-h-[520px] flex-1" />
          </div>
        </div>
      </main>
    </div>
  );
}
