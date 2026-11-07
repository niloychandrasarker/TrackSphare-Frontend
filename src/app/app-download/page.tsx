'use client';

import { useEffect, useState } from 'react';
import {
  Smartphone, Download, CheckCircle, ShieldCheck,
  Globe, Radio, ArrowRight, CheckCircle2, Shield, Sparkles
} from 'lucide-react';
import Link from 'next/link';

export default function AppDownloadPage() {
  const backendEndpoint = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://trachsphare-backend.vercel.app/api/v1';
  const serverUrl = `${backendEndpoint.replace(/\/+$/, '')}/locations`;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 sm:p-12 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-indigo-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-600/30">
            <Smartphone className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">TrackSphere Mobile App</h1>
          <p className="text-gray-400 text-sm mt-2 max-w-lg mx-auto">
            Install the official TrackSphere App on your Android phone to track your location in real time with interactive maps and satellite views.
          </p>
        </div>

        {/* ─── PRIMARY METHOD: OFFICIAL TRACKSPHERE APP (WITH FULL WEB UI) ─── */}
        <div className="bg-gradient-to-br from-indigo-950/80 via-gray-900 to-indigo-900/40 border-2 border-indigo-500 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow">
              <Sparkles className="w-3.5 h-3.5" /> Official App (Full Web UI)
            </span>
            <span className="text-xs text-indigo-300 font-mono">100% TrackSphere</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white">
            Install TrackSphere App Directly on Your Phone
          </h2>
          <p className="text-sm text-gray-300 mt-2 leading-relaxed">
            This installs the complete TrackSphere application directly onto your Android phone&apos;s home screen.
            It features the <strong>exact same modern UI as the web</strong>:
          </p>

          <ul className="mt-4 space-y-2 text-xs sm:text-sm text-gray-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Full Interactive Live Map with Google Streets, Satellite &amp; OSM layers</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Pulsating live marker showing your exact real-time coordinates</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Screen WakeLock and Background stream to keep pinging every 3.5 seconds</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Direct access to Day Location History &amp; Printable Schedule Chart</span>
            </li>
          </ul>

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/app"
              className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-sm shadow-xl shadow-indigo-600/40 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Globe className="w-4 h-4" />
              Open &amp; Install TrackSphere App (/app)
            </Link>
          </div>

          <p className="mt-3 text-xs text-gray-400">
            💡 On Android Chrome: Open <code className="text-indigo-400 font-mono">/app</code> &gt; Tap <strong>&quot;Install on Phone&quot;</strong> or browser menu (⋮) &gt; <strong>&quot;Install app&quot;</strong>.
          </p>
        </div>

        {/* ─── OPTIONAL BACKGROUND ENGINE: TRACCAR CLIENT COMPATIBILITY ─── */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="border-b border-gray-800 pb-4 mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-indigo-400" />
              About Traccar Client Background App (Alternative Engine)
            </h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              If you downloaded the generic background APK (shown as <em>&quot;Traccar Client&quot;</em> in your screenshot), that is an open-source background GPS service daemon without a map interface. To link it to TrackSphere:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
            <div className="p-3.5 bg-gray-800/70 rounded-xl border border-gray-700/60">
              <span className="text-[10px] text-gray-400 uppercase font-semibold block">Server URL to Enter</span>
              <code className="text-xs font-mono text-indigo-300 block mt-1 break-all select-all font-bold">
                {serverUrl}
              </code>
            </div>
            <div className="p-3.5 bg-gray-800/70 rounded-xl border border-gray-700/60">
              <span className="text-[10px] text-gray-400 uppercase font-semibold block">Device Identifier</span>
              <code className="text-xs font-mono text-emerald-300 block mt-1 font-bold">
                Realme c71 (or your device name)
              </code>
            </div>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            Once you paste the Server URL above and toggle <strong>Service status: ON</strong>, Traccar Client will transmit coordinates to TrackSphere.
            <strong className="text-white"> However, for the official TrackSphere experience with the live map and full UI, please use Option 1 above (/app).</strong>
          </p>
        </div>

        <div className="text-center pt-2">
          <Link href="/tracking" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
            ← Back to Live Fleet Tracking Map
          </Link>
        </div>
      </div>
    </div>
  );
}
