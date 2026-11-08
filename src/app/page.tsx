'use client';

import Link from 'next/link';
import {
  MapPin, Smartphone, Shield, Download, Lock, CheckCircle2,
  Radio, Clock, ArrowRight, EyeOff, ShieldCheck
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/80">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">TrackSphere</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#security" className="hover:text-white transition-colors">Security & Privacy</a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold rounded-xl transition-all"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Mobile Tracker
            </Link>

            <Link
              href="/admin/login"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/20"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-36 pb-20 px-6 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-800/80 text-indigo-300 text-xs font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          Official Android Client v1.2.0 Available
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight max-w-4xl mx-auto leading-tight sm:leading-tight">
          Consent-Driven, Real-Time <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-500 bg-clip-text text-transparent">
            Location Sharing Platform
          </span>
        </h1>

        <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Transparent location sharing designed for enterprise fleets and family safety.
          Location tracking is <strong>OFF by default</strong> and runs strictly with explicit user consent and visible foreground notifications.
        </p>

        {/* Primary Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/app"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Smartphone className="w-5 h-5" />
            Launch &amp; Install TrackSphere App
          </Link>

          <Link
            href="/tracking"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600/30 hover:bg-indigo-600/40 border border-indigo-500/50 text-indigo-200 font-semibold rounded-2xl transition-all"
          >
            <Radio className="w-5 h-5 text-indigo-400" />
            Live Fleet Tracking Map
          </Link>
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Compatible with all Android, iOS &amp; Web Devices • 100% TrackSphere Engine • Installable on Home Screen
        </p>

        {/* Core Privacy Pillar Banner */}
        <div className="mt-14 max-w-3xl mx-auto bg-gradient-to-r from-emerald-950/40 via-gray-900 to-emerald-950/40 border border-emerald-800/60 rounded-2xl p-5 flex items-center gap-4 text-left">
          <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-emerald-300">Zero Covert Tracking Policy</h4>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              Sharing only transmits GPS data while you actively have it enabled. A persistent system notification is always visible on your phone whenever the foreground location service is running.
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-6 max-w-7xl mx-auto border-t border-gray-800/80">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">Capabilities</h2>
          <h3 className="text-3xl font-bold text-white">Engineered for Precision & Privacy</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-8 hover:border-gray-700 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-6">
              <Clock className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">30-Second Target Cadence</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Fused Location Provider updates coordinates every 30 seconds when active, balancing high precision with optimal battery efficiency.
            </p>
          </div>

          <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-8 hover:border-gray-700 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center mb-6">
              <Radio className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Explicit Consent Toggle</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Location sharing is strictly disabled by default. You have full granular control to start, pause, or revoke location sharing anytime.
            </p>
          </div>

          <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-8 hover:border-gray-700 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center mb-6">
              <Shield className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Authorized Viewer Access</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Every location request is cryptographically verified against active device-level viewer grants. Sensitive administrative access is audited.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works / Installation Guide */}
      <section id="how-it-works" className="py-20 px-6 max-w-7xl mx-auto border-t border-gray-800/80">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">Get Started in Minutes</h2>
          <h3 className="text-3xl font-bold text-white">How to Install & Pair Your Device</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              step: '01',
              title: 'Download APK',
              desc: 'Click the Download button to save the TrackSphere APK file directly to your Android device.',
            },
            {
              step: '02',
              title: 'Install on Phone',
              desc: 'Open the downloaded file and allow "Install from Unknown Sources" if prompted by your Android settings.',
            },
            {
              step: '03',
              title: 'Pair Your Device',
              desc: 'Open TrackSphere and sign in with your credentials to link your phone to the system.',
            },
            {
              step: '04',
              title: 'Toggle Sharing ON',
              desc: 'Review the clear location disclosure and flip the switch to start sharing with authorized viewers.',
            },
          ].map((item, idx) => (
            <div key={idx} className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-6 relative">
              <span className="text-2xl font-mono font-extrabold text-indigo-500/40">{item.step}</span>
              <h4 className="text-base font-bold text-white mt-3 mb-2">{item.title}</h4>
              <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Big Download Card */}
        <div className="mt-12 bg-gradient-to-br from-indigo-950/60 to-gray-900 border border-indigo-800/40 rounded-3xl p-8 sm:p-12 text-center">
          <Smartphone className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white">Ready to Install TrackSphere?</h3>
          <p className="text-sm text-gray-400 max-w-md mx-auto mt-2 mb-6">
            Get the private signed APK package now and start managing your device location with complete transparency.
          </p>
          <a
            href="/downloads/TrackSphere-release.apk"
            download="TrackSphere-v1.2.0.apk"
            className="inline-flex items-center gap-3 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:scale-105"
          >
            <Download className="w-5 h-5" />
            Download APK Now
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-800/60 text-center text-xs text-gray-500">
        <p>© 2026 TrackSphere. All rights reserved. Consent-First Real-Time Location Platform.</p>
        <div className="mt-2 flex items-center justify-center gap-6 text-gray-400">
          <Link href="/tracking" className="hover:text-white transition-colors">Live Tracking</Link>
          <Link href="/app" className="hover:text-white transition-colors">Mobile App</Link>
          <a href="/downloads/TrackSphere-release.apk" download className="hover:text-indigo-400 transition-colors">Download APK</a>
        </div>
      </footer>
    </div>
  );
}
