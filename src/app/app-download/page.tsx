'use client';

import { useEffect, useState } from 'react';
import {
  Smartphone, Download, CheckCircle, ShieldCheck, QrCode,
  Globe, Radio, ArrowRight, CheckCircle2, Shield
} from 'lucide-react';
import Link from 'next/link';

export default function AppDownloadPage() {
  const [serverIp, setServerIp] = useState('192.168.110.177');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host && host !== 'localhost') {
        setServerIp(host);
      }
    }
  }, []);

  const backendEndpoint = process.env.NEXT_PUBLIC_BACKEND_URL || (serverIp ? `http://${serverIp}:5000/api/v1` : 'https://trachsphare-backend.vercel.app/api/v1');
  const serverUrl = `${backendEndpoint.replace(/\/+$/, '')}/locations`;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 sm:p-12">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-indigo-600/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
            <Smartphone className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-white">TrackSphere Android Mobile Client</h1>
          <p className="text-gray-400 text-sm mt-2 max-w-lg mx-auto">
            Install the mobile agent on your Android phone to enable consent-controlled live GPS location sharing.
          </p>
        </div>

        {/* 2 Ways to Install */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Method 1: Instant Web App (PWA) */}
          <div className="bg-gradient-to-br from-indigo-950/60 to-gray-900 border border-indigo-500/40 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
            <div>
              <span className="px-3 py-1 bg-indigo-900/60 text-indigo-300 border border-indigo-700/60 rounded-full text-[11px] font-semibold uppercase tracking-wider">
                Recommended & Instant
              </span>
              <h3 className="text-lg font-bold text-white mt-3">Option 1: Install Web App</h3>
              <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">
                Open in your mobile browser, tap <strong>&quot;Install App&quot;</strong>. Installs immediately with an icon on your phone without APK parse issues.
              </p>
            </div>
            <Link
              href="/app"
              className="mt-6 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl text-xs shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Globe className="w-4 h-4" />
              Launch &amp; Install Web Tracker (/app)
            </Link>
          </div>

          {/* Method 2: Physical Android APK */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
            <div>
              <span className="px-3 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800/80 rounded-full text-[11px] font-semibold uppercase tracking-wider">
                Official Binary APK (6.45 MB)
              </span>
              <h3 className="text-lg font-bold text-white mt-3">Option 2: Download APK File</h3>
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                Download the signed compiled Android APK. Install on Android 7 to 15 with zero parse errors.
              </p>
            </div>
            <a
              href="/downloads/TrackSphere-release.apk"
              download="TrackSphere-release.apk"
              className="mt-6 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-2xl text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download APK (6.45 MB)
            </a>
          </div>
        </div>

        {/* APK Setup Guide */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 mb-8 shadow-2xl relative overflow-hidden">
          <div className="border-b border-gray-800 pb-5 mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-indigo-400" />
              Android APK Configuration Guide
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              After installing the APK on your Android phone, enter these quick settings inside the app:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-xs">
            <div className="p-4 bg-gray-800/60 rounded-2xl border border-gray-700/60">
              <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider block">Server URL</span>
              <code className="text-sm font-mono text-indigo-300 block mt-1 break-all select-all font-bold">
                {serverUrl}
              </code>
              <span className="text-[10px] text-gray-500 mt-1 block">Paste this into the &quot;Server URL&quot; field in the app</span>
            </div>

            <div className="p-4 bg-gray-800/60 rounded-2xl border border-gray-700/60">
              <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider block">Device Identifier</span>
              <code className="text-sm font-mono text-emerald-300 block mt-1 font-bold">
                honor
              </code>
              <span className="text-[10px] text-gray-500 mt-1 block">Or enter any device name (e.g. MyPhone)</span>
            </div>
          </div>

          <div className="space-y-3">
            {[
              {
                title: '1. Install APK on Phone',
                desc: 'Download the APK file above, open it in Files or Downloads, and tap Install (Allow Unknown Sources if prompted).'
              },
              {
                title: '2. Grant Android Location Permission',
                desc: 'When opening the app, allow Location Access (&quot;While using the app&quot; or &quot;Always allow&quot; for high accuracy GPS).'
              },
              {
                title: '3. Enter Server URL and Turn Status ON',
                desc: `Set Server URL to ${serverUrl} and toggle Service Status to ON. The app will immediately start transmitting GPS fixes!`
              },
              {
                title: '4. View Live on Admin Map',
                desc: 'Open the TrackSphere Admin Dashboard at /tracking to see your phone streaming real-time coordinates live on the map.'
              }
            ].map((step, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3.5 bg-gray-800/30 rounded-2xl border border-gray-800">
                <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-white">{step.title}</h4>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Privacy Guarantee */}
          <div className="mt-6 p-4 bg-emerald-950/30 border border-emerald-900/60 rounded-2xl flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-300">
              <strong>Consent Controlled:</strong> Location is only shared when you toggle Service Status to ON. You can stop sharing anytime with 1 tap.
            </p>
          </div>
        </div>

        <div className="text-center">
          <Link href="/dashboard" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            ← Back to Web Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
