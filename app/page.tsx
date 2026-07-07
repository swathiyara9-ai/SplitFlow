import React from 'react';
import Link from 'next/link';
import { ArrowRight, DollarSign, Shield, Zap, Sparkles } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-hidden">
      {/* Background Ambient Gradients */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full bg-primary/10 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-purple-600/10 blur-[100px]"></div>
      </div>

      {/* Navbar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-purple-400 flex items-center justify-center text-white shadow-md shadow-primary/20">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-base font-bold tracking-tight">SplitFlow</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-xs font-semibold text-slate-400 hover:text-slate-100 transition-colors">
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 text-xs font-semibold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md transition-colors"
          >
            Create Account
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 w-full max-w-5xl mx-auto px-6 py-16 md:py-24 text-center space-y-12">
        {/* Floating Accent Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-[10px] font-bold text-primary tracking-wider uppercase">
          <Sparkles className="w-3.5 h-3.5" /> Split Premium, Simpler UI
        </div>

        {/* Hero Title */}
        <div className="space-y-4 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
            Shared expense splitting, <br />
            <span className="gradient-text">engineered with precision.</span>
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-xl mx-auto font-medium">
            Ditch contact syncs, invites, and telephone matrices. Track shared ledger entries cleanly with a permanent, secure Unique User ID.
          </p>
        </div>

        {/* Hero Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="w-full sm:w-auto px-6 py-3.5 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
          >
            Get Your Unique ID
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-6 py-3.5 text-xs font-bold border border-white/10 hover:bg-white/5 text-white rounded-xl transition-all"
          >
            Access Dashboard
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 text-left">
          {/* Card 1 */}
          <div className="glass-panel p-6 rounded-premium space-y-3 bg-white/5 border-white/5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold">Privacy First ID</h3>
            <p className="text-xs text-slate-400">
              No phone numbers. No contact harvesting. Add friends and members instantly using a secure permanent unique ID.
            </p>
          </div>
          {/* Card 2 */}
          <div className="glass-panel p-6 rounded-premium space-y-3 bg-white/5 border-white/5">
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center text-success">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold">Granular Splitting</h3>
            <p className="text-xs text-slate-400">
              Support for equal, exact cash value, and percentage splits. Let our optimized ledger calculate debt structures instantly.
            </p>
          </div>
          {/* Card 3 */}
          <div className="glass-panel p-6 rounded-premium space-y-3 bg-white/5 border-white/5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold">Vercel & Supabase Sync</h3>
            <p className="text-xs text-slate-400">
              Instant real-time synchronization on all expenses, settlement statuses, and group logs. High speed, premium caching.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-[11px] font-semibold">
        <span>© {new Date().getFullYear()} SplitFlow. Supabase Certified.</span>
        <div className="flex gap-4">
          <Link href="/login" className="hover:text-slate-300">Client Access</Link>
          <Link href="/signup" className="hover:text-slate-300">Sign Up</Link>
        </div>
      </footer>
    </div>
  );
}
