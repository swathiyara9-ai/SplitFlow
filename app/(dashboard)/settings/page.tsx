'use client';

import React from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { 
  Settings, 
  Sun, 
  Moon, 
  Monitor, 
  Database, 
  Lock, 
  Server, 
  Sparkles,
  Info
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useCurrency, CURRENCIES } from '@/components/CurrencyProvider';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const toast = useToast();

  const handleClearCache = () => {
    localStorage.removeItem('splitflow-theme');
    toast.success('App cache reset successfully!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">System Preferences</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Configure visual themes and inspect database engine parameters.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Theme Settings Card */}
        <div className="glass-panel p-6 rounded-premium shadow-layered space-y-6">
          <div className="flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold">App Appearance</h3>
          </div>
          
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Visual Interface Mode</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { name: 'light', icon: Sun, label: 'Light' },
                { name: 'dark', icon: Moon, label: 'Dark' },
                { name: 'system', icon: Monitor, label: 'System' }
              ].map((t) => {
                const isSelected = theme === t.name;
                return (
                  <button
                    key={t.name}
                    onClick={() => {
                      setTheme(t.name as any);
                      toast.success(`Theme mode set to ${t.label}!`);
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-black/5 dark:border-white/5 bg-slate-950/5 dark:bg-white/5 text-slate-500 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
                    }`}
                  >
                    <t.icon className="w-4 h-4" />
                    <span className="text-[10px] font-semibold">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-black/5 dark:border-white/5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">App Currency</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CURRENCIES.map((c) => {
                const isSelected = currency.code === c.code;
                return (
                  <button
                    key={c.code}
                    onClick={() => {
                      setCurrency(c.code);
                      toast.success(`Currency set to ${c.label}!`);
                    }}
                    className={`py-2 px-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-black/5 dark:border-white/5 bg-slate-950/5 dark:bg-white/5 text-slate-500 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
                    }`}
                  >
                    <span className="text-xs font-bold">{c.symbol}</span>
                    <span className="text-[9px] font-semibold">{c.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-black/5 dark:border-white/5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Developer Tools</label>
            <button
              onClick={handleClearCache}
              className="px-4 py-2.5 bg-danger/10 hover:bg-danger text-danger hover:text-white rounded-xl text-xs font-semibold transition-all"
            >
              Reset Application Cache
            </button>
          </div>
        </div>

        {/* Database & Security Card */}
        <div className="glass-panel p-6 rounded-premium shadow-layered space-y-6">
          <div className="flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-3">
            <Database className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold">Engine Details</h3>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3 text-xs">
              <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-slate-800 dark:text-slate-200">Row Level Security (RLS)</span>
                <p className="text-[11px] text-slate-400 font-medium">
                  Supabase database policies are fully active. All queries verify membership logic against group IDs using cryptographically signed tokens.
                </p>
              </div>
            </div>

            <div className="flex gap-3 text-xs">
              <Server className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-slate-800 dark:text-slate-200">Vercel Serverless Edge</span>
                <p className="text-[11px] text-slate-400 font-medium">
                  The application routes and Next.js middleware run as optimized serverless runtimes. Session persistence utilizes cookies.
                </p>
              </div>
            </div>

            <div className="flex gap-3 text-xs">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-slate-800 dark:text-slate-200">System Integration Status</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                  <span className="text-[10px] font-bold text-success uppercase tracking-wider">Sync Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
