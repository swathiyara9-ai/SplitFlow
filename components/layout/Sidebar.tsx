'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, User, Settings, LogOut, Sun, Moon, Monitor } from 'lucide-react';
import { Profile } from '@/types';
import { logoutAction } from '@/actions/auth';
import { useTheme } from '../ThemeProvider';

interface SidebarProps {
  profile: Profile | null;
}

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Groups', href: '/groups', icon: Users },
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 fixed inset-y-0 left-0 z-30 p-4 hidden md:flex flex-col border-r border-black/5 dark:border-white/5 bg-white/20 dark:bg-stone-950/20 backdrop-blur-xl">
      {/* Brand header */}
      <div className="flex items-center gap-3 px-3 py-4 mb-4">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-orange-400 flex items-center justify-center text-white shadow-md shadow-primary/20">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight">SplitFlow</h1>
          <span className="text-[10px] text-stone-400 dark:text-stone-500 font-semibold tracking-wider uppercase">Premium Ledgers</span>
        </div>
      </div>

      {/* User Profile Card */}
      <div className="glass-panel rounded-premium p-3.5 mb-6 flex items-center gap-3 shadow-layered dark:shadow-layered-dark">
        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
          {profile?.display_name ? profile.display_name.substring(0, 2).toUpperCase() : 'SF'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{profile?.display_name || 'SplitFlow User'}</p>
          <p className="text-[10px] font-mono text-primary truncate">{profile?.unique_user_id || 'SPL-000000'}</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                isActive
                  ? 'text-primary bg-primary/10 dark:bg-primary/20'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/50 dark:hover:bg-stone-900/50'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Theme and Logout Controls */}
      <div className="pt-4 border-t border-black/5 dark:border-white/5 space-y-2">
        {/* Theme Toggle Button */}
        <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-stone-500 dark:text-stone-400 rounded-xl hover:bg-stone-100/50 dark:hover:bg-stone-900/50">
          <span className="flex items-center gap-3">
            {theme === 'light' && <Sun className="w-4 h-4" />}
            {theme === 'dark' && <Moon className="w-4 h-4" />}
            {theme === 'system' && <Monitor className="w-4 h-4" />}
            Theme Mode
          </span>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as any)}
            className="text-[10px] bg-stone-200/50 dark:bg-stone-800/50 text-stone-700 dark:text-stone-200 px-1.5 py-0.5 rounded border-none focus:ring-1 focus:ring-primary focus:outline-none"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        {/* Logout Form Action */}
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-danger rounded-xl hover:bg-danger/5 dark:hover:bg-danger/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
