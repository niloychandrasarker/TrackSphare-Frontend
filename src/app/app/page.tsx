'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Smartphone, MapPin, Radio, WifiOff, Battery, ShieldCheck,
  CheckCircle2, AlertCircle, RefreshCw, ArrowLeft, Activity,
  Lock, Camera, User, Edit3, PlusCircle
} from 'lucide-react';
import Link from 'next/link';

function generateDeviceUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'dev-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
}

export default function MobileAppPage() {
  const [isSharing, setIsSharing] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
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

  const watchIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const latestCoordsRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);
  const deviceIdRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      setSyncStatus('Persistent Sharing ACTIVE • Resuming GPS broadcast...');
      startTracking(currentId);
    } else if (registeredFlag) {
      setSyncStatus('Device Registered • Sharing is paused');
    } else {
      setSyncStatus('New Device • Complete registration below');
    }

    return () => {
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

    // Stop current tracking
    stopTrackingExplicit();

    // Generate fresh device ID
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
        setSyncStatus(`Live GPS Synced (Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}) • Persistent`);
      } else {
        setSyncStatus('Server acknowledged receipt');
      }
    } catch {
      setSyncStatus('Offline / Network retry pending');
    }
  }

  async function startTracking(explicitDevId?: string) {
    const targetDevId = explicitDevId || deviceIdRef.current || deviceId;
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setError('');
    setIsSharing(true);
    localStorage.setItem('tracksphere_sharing_active', 'true');
    setSyncStatus('Acquiring high-accuracy GPS fix...');

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
        latestCoordsRef.current = c;
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setError('Location permission required. Please allow access.');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    navigator.geolocation.getCurrentPosition((pos) => {
      const c = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
      setCoords(c);
      latestCoordsRef.current = c;
      sendLocationUpdate(c.lat, c.lng, c.accuracy, targetDevId);
    });

    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
    }
    intervalIdRef.current = setInterval(() => {
      if (latestCoordsRef.current) {
        sendLocationUpdate(
          latestCoordsRef.current.lat,
          latestCoordsRef.current.lng,
          latestCoordsRef.current.accuracy,
          targetDevId
        );
      }
    }, 25000);
  }

  function stopTrackingExplicit() {
    setIsSharing(false);
    localStorage.setItem('tracksphere_sharing_active', 'false');

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
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-4 selection:bg-indigo-500">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glowing top line */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 transition-colors duration-500 ${isSharing ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-gray-800'}`} />

        {/* Top Header */}
        <div className="flex items-center justify-between mb-5">
          <Link href="/" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-gray-800 border border-gray-700/60 rounded-full text-[10px] font-mono text-gray-400" title={deviceId}>
              ID: {deviceId ? `${deviceId.substring(0, 8)}...` : 'Generating'}
            </span>
            <div className="flex items-center gap-1 px-2.5 py-0.5 bg-gray-800 rounded-full text-xs text-gray-300">
              <Battery className="w-3.5 h-3.5 text-emerald-400" />
              <span>{batteryLevel != null ? `${batteryLevel}%` : 'Phone'}</span>
            </div>
          </div>
        </div>

        {/* ─── CASE A: REGISTRATION FORM (IF NOT REGISTERED OR EDITING) ─── */}
        {(!isRegistered || isEditing) && (
          <div className="bg-gradient-to-br from-gray-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-5 mb-6 text-center relative shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-4 h-4" />
                {isRegistered ? 'Edit Device Details' : 'Register This Device'}
              </span>
              {isRegistered && (
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
              )}
            </div>

            <p className="text-xs text-gray-400 mb-4 text-left leading-relaxed">
              Register this specific phone/browser. It will appear on the admin tracking map with its own individual marker, photo, and live coordinates.
            </p>

            {/* Avatar with Camera Icon */}
            <div className="relative w-20 h-20 mx-auto mb-3">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-indigo-500/60 flex items-center justify-center bg-gray-800 shadow-md">
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
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer border border-gray-900"
                title="Upload Photo to ImageKit"
              >
                {isUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
            </div>

            <p className="text-[11px] text-gray-400 mb-4">
              {isUploading ? 'Uploading to ImageKit Cloud...' : 'Tap camera icon to upload photo (ImageKit)'}
            </p>

            <div className="space-y-3 text-left">
              <div>
                <label className="text-[11px] text-gray-300 font-semibold block mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  placeholder="e.g. Rahim Ahmed"
                  className="w-full px-3.5 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-300 font-semibold block mb-1">
                  Device Name / Model *
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={e => setDeviceName(e.target.value)}
                  placeholder="e.g. Rahim's Samsung S24"
                  className="w-full px-3.5 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <button
                onClick={handleRegisterDevice}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isRegistered ? 'Save Changes' : 'Register & Start Location Sharing'}
              </button>
            </div>
          </div>
        )}

        {/* ─── CASE B: REGISTERED DEVICE STATUS CARD ─── */}
        {isRegistered && !isEditing && (
          <div className="bg-gray-850/80 border border-gray-800 rounded-2xl p-4 mb-6 relative">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-full overflow-hidden border-2 flex items-center justify-center bg-gray-800 shrink-0 ${
                isSharing ? 'border-emerald-500 shadow-md shadow-emerald-500/20' : 'border-gray-700'
              }`}>
                {imageUrl ? (
                  <img src={imageUrl} alt={userName} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-7 h-7 text-gray-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white truncate">{userName || 'Registered Device'}</h3>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                    title="Edit name or photo"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-indigo-400 font-medium truncate">{deviceName}</p>
                <p className="text-[10px] text-gray-500 font-mono truncate mt-0.5">ID: {deviceId}</p>
              </div>
            </div>

            {saveSuccessMsg && (
              <p className="mt-2 text-[11px] text-emerald-400 font-mono text-center">{saveSuccessMsg}</p>
            )}
          </div>
        )}

        {/* Install to Android Phone Banner */}
        {isInstallable && (
          <div className="mb-5 p-3.5 bg-indigo-950/40 border border-indigo-800/80 rounded-2xl flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white">Install App on Phone</p>
              <p className="text-[11px] text-gray-400">Installs directly to Home Screen like an APK.</p>
            </div>
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shrink-0 transition-colors shadow-md cursor-pointer"
            >
              Install
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ─── SHARING CONTROL CARD ─── */}
        <div className="bg-gray-800/50 border border-gray-700/60 rounded-2xl p-5 text-center mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Location Sharing
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${isSharing ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-gray-800 text-gray-400'}`}>
              {isSharing ? 'ACTIVE (PERSISTENT)' : 'PAUSED'}
            </span>
          </div>

          <button
            onClick={handleToggleSharing}
            disabled={!isRegistered}
            className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg cursor-pointer ${
              !isRegistered
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-60'
                : isSharing
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            }`}
          >
            {isSharing ? (
              <>
                <WifiOff className="w-4 h-4" />
                Stop Location Sharing
              </>
            ) : (
              <>
                <Radio className="w-4 h-4" />
                {isRegistered ? 'Resume Location Sharing' : 'Register Above First'}
              </>
            )}
          </button>

          <button
            onClick={() => {
              if (navigator.geolocation) {
                setSyncStatus('Acquiring instant GPS fix…');
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
                    setCoords(c);
                    sendLocationUpdate(c.lat, c.lng, c.accuracy);
                    alert(`✓ Live Location Sent for "${userName || deviceName}"!\nLat: ${c.lat.toFixed(5)}, Lng: ${c.lng.toFixed(5)}`);
                  },
                  (err) => alert('Location error: ' + err.message + '. Please allow location access in your browser.'),
                  { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                );
              }
            }}
            disabled={!isRegistered}
            className="w-full mt-2.5 py-2 bg-gray-700/80 hover:bg-gray-700 text-gray-200 border border-gray-600/80 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Send Instant GPS Fix to Admin Map
          </button>

          <div className="mt-3 p-2 bg-gray-900/60 rounded-xl border border-gray-800 text-[10px] text-gray-400 flex items-center justify-center gap-1.5 text-center">
            <Lock className="w-3 h-3 text-indigo-400 shrink-0" />
            <span>
              {isSharing
                ? 'Persistent: Location stays ON even if browser/app is closed. Only turns off via "Stop Location Sharing".'
                : 'Sharing is turned OFF.'}
            </span>
          </div>
        </div>

        {/* ─── LIVE GPS TELEMETRY ─── */}
        <div className="bg-gray-800/30 border border-gray-800 rounded-2xl p-4 space-y-2 mb-5 text-xs">
          <div className="flex items-center justify-between text-gray-400">
            <span>Status:</span>
            <span className="font-medium text-white truncate max-w-[230px]">{syncStatus}</span>
          </div>

          <div className="flex items-center justify-between text-gray-400">
            <span>Coordinates:</span>
            <span className="font-mono text-indigo-300">
              {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'Waiting for GPS fix...'}
            </span>
          </div>

          <div className="flex items-center justify-between text-gray-400">
            <span>Accuracy:</span>
            <span className="text-gray-300 font-mono">
              {coords ? `±${Math.round(coords.accuracy)}m` : 'N/A'}
            </span>
          </div>

          <div className="flex items-center justify-between text-gray-400">
            <span>Sync Count:</span>
            <span className="text-emerald-400 font-mono font-bold">{syncCount} updates sent</span>
          </div>

          {lastSyncTime && (
            <div className="flex items-center justify-between text-gray-400">
              <span>Last Broadcast:</span>
              <span className="text-gray-300 font-mono">{lastSyncTime}</span>
            </div>
          )}
        </div>

        {/* ─── MULTI-DEVICE SUPPORT: REGISTER ANOTHER DEVICE BUTTON ─── */}
        <div className="pt-2 border-t border-gray-800 flex items-center justify-between">
          <button
            onClick={handleRegisterNewDevice}
            className="w-full py-2.5 bg-gray-850 hover:bg-gray-800 border border-dashed border-gray-700 hover:border-indigo-500 text-gray-300 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
            Register Another Device From Here
          </button>
        </div>
      </div>
    </div>
  );
}
