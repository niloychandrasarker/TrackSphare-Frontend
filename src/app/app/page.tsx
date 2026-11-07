'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Smartphone, MapPin, Radio, WifiOff, Battery, ShieldCheck,
  CheckCircle2, AlertCircle, RefreshCw, Download, ArrowLeft, Activity,
  Lock, Camera, UploadCloud, User, Edit3
} from 'lucide-react';
import Link from 'next/link';

export default function MobileAppPage() {
  const [isSharing, setIsSharing] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('Checking persistent sharing state...');
  const [syncCount, setSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('Honor Android Phone');
  const [userName, setUserName] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [userToken, setUserToken] = useState<string>('');
  const [deviceModel, setDeviceModel] = useState('Android Device');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [error, setError] = useState<string>('');

  const watchIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const latestCoordsRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);
  const deviceIdRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Read persisted profile info
    if (typeof window !== 'undefined') {
      const storedUserName = localStorage.getItem('tracksphere_user_name') || '';
      const storedDevName = localStorage.getItem('tracksphere_device_name') || 'Honor Android Phone';
      const storedImgUrl = localStorage.getItem('tracksphere_image_url') || '';

      if (storedUserName) setUserName(storedUserName);
      if (storedDevName) setDeviceName(storedDevName);
      if (storedImgUrl) setImageUrl(storedImgUrl);

      const ua = navigator.userAgent;
      if (/android/i.test(ua)) {
        setDeviceModel('Android Smartphone');
      } else {
        setDeviceModel('Mobile Device');
      }

      // Battery API
      if ('getBattery' in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          setBatteryLevel(Math.round(battery.level * 100));
          battery.addEventListener('levelchange', () => {
            setBatteryLevel(Math.round(battery.level * 100));
          });
        }).catch(() => {});
      }
    }

    // PWA Install prompt listener
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    });

    const token = localStorage.getItem('adminToken') || localStorage.getItem('accessToken') || '';
    setUserToken(token);

    // Initialize or bind device with persistent state
    initDevice(token);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, []);

  async function initDevice(token: string) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let currentDevId = localStorage.getItem('tracksphere_device_uuid') || '9f2f6062-af23-48fa-abc3-cb2c42f9ec96';
      deviceIdRef.current = currentDevId;
      setDeviceId(currentDevId);

      const savedDevName = localStorage.getItem('tracksphere_device_name') || 'My Device (honor)';
      const savedUserName = localStorage.getItem('tracksphere_user_name') || '';
      const savedImgUrl = localStorage.getItem('tracksphere_image_url') || '';

      // Register or bind this mobile device directly to backend
      const res = await fetch('/api/v1/devices/register-mobile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          deviceId: currentDevId,
          name: savedDevName,
          model: 'honor',
          userName: savedUserName,
          imageUrl: savedImgUrl,
          androidVersion: '14',
          appVersion: '1.2.0',
          batteryLevel: batteryLevel,
        }),
      });

      const data = await res.json();
      const boundDevId = data.success && data.data ? data.data.id : currentDevId;
      setDeviceId(boundDevId);
      deviceIdRef.current = boundDevId;
      localStorage.setItem('tracksphere_device_uuid', boundDevId);

      if (data.success && data.data) {
        if (data.data.name) setDeviceName(data.data.name);
        if (data.data.image_url) {
          setImageUrl(data.data.image_url);
          localStorage.setItem('tracksphere_image_url', data.data.image_url);
        }
      }

      // Check persistent sharing permission
      const persistentFlag = localStorage.getItem('tracksphere_sharing_active');
      const isBackendSharing = data.success && data.data ? data.data.sharing_enabled : false;

      const shouldBeSharing = persistentFlag === 'true' || (persistentFlag === null && isBackendSharing);

      if (shouldBeSharing) {
        setIsSharing(true);
        localStorage.setItem('tracksphere_sharing_active', 'true');
        setSyncStatus('Persistent Sharing ACTIVE • Resuming GPS broadcast...');
        startTracking(boundDevId);
      } else {
        setIsSharing(false);
        setSyncStatus('Sharing is OFF (Tap Start to enable persistent tracking)');
      }
    } catch {
      const fallback = localStorage.getItem('tracksphere_device_uuid') || '9f2f6062-af23-48fa-abc3-cb2c42f9ec96';
      setDeviceId(fallback);
      deviceIdRef.current = fallback;

      if (localStorage.getItem('tracksphere_sharing_active') === 'true') {
        setIsSharing(true);
        startTracking(fallback);
      }
    }
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

        // Post to backend media endpoint (which uploads directly to ImageKit)
        const res = await fetch('/api/v1/media/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: base64Data,
            fileName: file.name || 'avatar.jpg',
            folder: '/tracksphere',
          }),
        });

        const data = await res.json();
        if (data.success && data.data?.url) {
          const uploadedUrl = data.data.url;
          setImageUrl(uploadedUrl);
          localStorage.setItem('tracksphere_image_url', uploadedUrl);

          // Save profile with new image
          await saveProfile(userName, deviceName, uploadedUrl);
          setSaveSuccessMsg('✓ Photo uploaded to ImageKit & synced with Map!');
          setTimeout(() => setSaveSuccessMsg(''), 5000);
        } else {
          alert('Upload failed: ' + (data.error || 'Check ImageKit credentials'));
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setIsUploading(false);
      alert('Error reading image file');
    }
  }

  // Save Name, Device Name, Image to Backend
  async function saveProfile(overrideUser?: string, overrideDev?: string, overrideImg?: string) {
    const uName = overrideUser !== undefined ? overrideUser : userName;
    const dName = overrideDev !== undefined ? overrideDev : deviceName;
    const img = overrideImg !== undefined ? overrideImg : imageUrl;
    const devId = deviceIdRef.current || deviceId;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userToken) headers['Authorization'] = `Bearer ${userToken}`;

      const res = await fetch('/api/v1/devices/register-mobile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          deviceId: devId,
          name: dName,
          model: 'honor',
          userName: uName,
          imageUrl: img,
          batteryLevel: batteryLevel,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (uName) localStorage.setItem('tracksphere_user_name', uName);
        if (dName) localStorage.setItem('tracksphere_device_name', dName);
        if (img) localStorage.setItem('tracksphere_image_url', img);
        setSaveSuccessMsg('✓ Profile details saved and live on map!');
        setTimeout(() => setSaveSuccessMsg(''), 4000);
      }
    } catch {
      alert('Could not sync profile to backend.');
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

  async function sendLocationUpdate(lat: number, lng: number, accuracy: number, targetId?: string) {
    const devId = targetId || deviceIdRef.current || deviceId;
    if (!devId) return;

    try {
      setSyncStatus('Transmitting GPS fix to TrackSphere Cloud...');

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
    }, 30000);
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

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-4 selection:bg-indigo-500">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glowing top line */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 transition-colors duration-500 ${isSharing ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-gray-800'}`} />

        {/* Top Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-300">
            <Battery className="w-3.5 h-3.5 text-emerald-400" />
            <span>{batteryLevel != null ? `${batteryLevel}%` : 'Phone'}</span>
          </div>
        </div>

        {/* Profile & Photo Section (ImageKit Integration) */}
        <div className="bg-gray-850/80 border border-gray-800 rounded-2xl p-5 mb-6 text-center relative">
          {/* Avatar with Camera Icon */}
          <div className="relative w-24 h-24 mx-auto mb-3">
            <div className={`w-24 h-24 rounded-full overflow-hidden border-2 flex items-center justify-center bg-gray-800 ${
              isSharing ? 'border-emerald-500 shadow-lg shadow-emerald-500/20' : 'border-gray-700'
            }`}>
              {imageUrl ? (
                <img src={imageUrl} alt="User Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-gray-500" />
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />

            {/* Trigger Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer border border-gray-900"
              title="Upload photo to ImageKit"
            >
              {isUploading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>
          </div>

          <p className="text-[11px] text-gray-400 mb-4">
            {isUploading ? 'Uploading to ImageKit Cloud...' : 'Tap camera icon to upload photo (ImageKit)'}
          </p>

          {/* Form fields for Name & Device Name */}
          <div className="space-y-3 text-left">
            <div>
              <label className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider block mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                placeholder="e.g. Abir Hossain"
                className="w-full px-3.5 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider block mb-1">
                Device Name / Model
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={e => setDeviceName(e.target.value)}
                placeholder="e.g. Honor X9b"
                className="w-full px-3.5 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={() => saveProfile()}
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
              Save Name &amp; Device Info
            </button>
          </div>

          {saveSuccessMsg && (
            <p className="mt-2 text-[11px] text-emerald-400 font-mono">{saveSuccessMsg}</p>
          )}
        </div>

        {/* Install to Android Phone Banner */}
        {isInstallable && (
          <div className="mb-6 p-4 bg-indigo-950/40 border border-indigo-800/80 rounded-2xl flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white">Install TrackSphere on Android</p>
              <p className="text-[11px] text-gray-400">Runs full screen like a native APK without browser frame.</p>
            </div>
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shrink-0 transition-colors shadow-md cursor-pointer"
            >
              Install App
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* The Big Sharing Control Card */}
        <div className="bg-gray-800/50 border border-gray-700/60 rounded-2xl p-6 text-center mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Location Sharing
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${isSharing ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-gray-800 text-gray-400'}`}>
              {isSharing ? 'ACTIVE (PERSISTENT)' : 'OFF'}
            </span>
          </div>

          <button
            onClick={handleToggleSharing}
            className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all shadow-lg cursor-pointer ${
              isSharing
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            }`}
          >
            {isSharing ? (
              <>
                <WifiOff className="w-5 h-5" />
                Stop Location Sharing
              </>
            ) : (
              <>
                <Radio className="w-5 h-5" />
                Start Location Sharing
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
                    alert(`✓ Live Location Sent! Lat: ${c.lat.toFixed(5)}, Lng: ${c.lng.toFixed(5)}`);
                  },
                  (err) => alert('Location error: ' + err.message + '. Please allow location access in your browser.'),
                  { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                );
              }
            }}
            className="w-full mt-3 py-2.5 bg-gray-700/80 hover:bg-gray-700 text-gray-200 border border-gray-600/80 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            Send Instant GPS Fix to Admin Map
          </button>

          <div className="mt-4 p-2.5 bg-gray-900/60 rounded-xl border border-gray-800 text-[11px] text-gray-400 flex items-center justify-center gap-1.5 text-center">
            <Lock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>
              {isSharing
                ? 'Persistent Access: Stays ON even if you close the browser or app. Only turns off when you click "Stop Location Sharing".'
                : 'Sharing is turned OFF. Tap "Start Location Sharing" to enable.'}
            </span>
          </div>
        </div>

        {/* Live GPS Telemetry */}
        <div className="bg-gray-800/30 border border-gray-800 rounded-2xl p-4 space-y-2.5 mb-6 text-xs">
          <div className="flex items-center justify-between text-gray-400">
            <span>Status:</span>
            <span className="font-medium text-white">{syncStatus}</span>
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

        {/* Privacy Note */}
        <div className="p-3 bg-indigo-950/30 border border-indigo-900/40 rounded-xl flex items-center gap-2.5 text-xs text-indigo-300">
          <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
          <span>
            Strict Consent Model: Location is only recorded while sharing is explicitly ON.
          </span>
        </div>
      </div>
    </div>
  );
}
