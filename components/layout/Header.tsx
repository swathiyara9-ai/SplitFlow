'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Menu, Search, X, LayoutDashboard, Users, User, Settings, LogOut, Bell } from 'lucide-react';
import { Profile } from '@/types';
import { logoutAction } from '@/actions/auth';
import { createClient } from '@/lib/supabase/client';
import { getDashboardData } from '@/services/dashboard';

interface HeaderProps {
  profile: Profile | null;
}

export default function Header({ profile }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const activityStorageKey = `splitflow-last-viewed-activity-at:${profile?.id || 'current'}`;
  const [lastViewedActivityAt, setLastViewedActivityAt] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem(activityStorageKey)
  );

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => getDashboardData(supabase),
  });

  useEffect(() => {
    const handleActivityViewed = (event: Event) => {
      const viewedAt = event instanceof CustomEvent ? event.detail?.viewedAt : null;
      setLastViewedActivityAt(viewedAt || localStorage.getItem(activityStorageKey));
    };

    window.addEventListener('splitflow-activity-viewed', handleActivityViewed);
    window.addEventListener('storage', handleActivityViewed);

    return () => {
      window.removeEventListener('splitflow-activity-viewed', handleActivityViewed);
      window.removeEventListener('storage', handleActivityViewed);
    };
  }, [activityStorageKey]);

  const latestActivityAt = dashboard?.activities?.[0]?.created_at;
  const hasUnreadActivity = latestActivityAt
    ? !lastViewedActivityAt || new Date(latestActivityAt) > new Date(lastViewedActivityAt)
    : false;

  // Generate breadcrumb from path
  const getBreadcrumb = () => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return 'Workspace / Overview';
    return (
      'Workspace / ' +
      parts
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, ' '))
        .join(' / ')
    );
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/dashboard?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/dashboard');
    }
  };

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Groups', href: '/groups', icon: Users },
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <>
      <header className="glass-nav sticky top-0 z-20 flex items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 tracking-tight">
            {getBreadcrumb()}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Global Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative hidden sm:block">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search ID, groups, bills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 text-[11px] font-semibold bg-slate-950/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl pl-9 pr-4 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:w-60 transition-all duration-300"
            />
          </form>

          {/* Quick notification trigger (points to Activity feed) */}
          <Link
            href="/dashboard?view=activity"
            className="p-2 glass-panel rounded-xl text-slate-600 dark:text-slate-300 relative shadow-sm hover:bg-slate-100/50 dark:hover:bg-slate-900/50"
          >
            {hasUnreadActivity && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-danger animate-pulse"></span>
            )}
            <Bell className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden bg-black/40 backdrop-blur-sm flex">
          <div className="w-64 bg-white dark:bg-slate-950 h-full p-4 flex flex-col shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-bold tracking-wider uppercase text-slate-400">SplitFlow Menu</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* User Profile */}
            <div className="glass-panel rounded-premium p-3.5 mb-6 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                {profile?.display_name ? profile.display_name.substring(0, 2).toUpperCase() : 'SF'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{profile?.display_name || 'SplitFlow User'}</p>
                <p className="text-[10px] font-mono text-primary truncate">{profile?.unique_user_id || 'SPL-000000'}</p>
              </div>
            </div>

            {/* Search for mobile */}
            <form onSubmit={handleSearchSubmit} className="relative mb-6">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-950/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl pl-8 pr-4 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </form>

            {/* Navigation links */}
            <nav className="flex-1 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                      isActive
                        ? 'text-primary bg-primary/10 dark:bg-primary/20'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-slate-900/50'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Sign Out */}
            <div className="pt-4 border-t border-black/5 dark:border-white/5">
              <form action={logoutAction} onClick={() => setMobileMenuOpen(false)}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-danger rounded-xl hover:bg-danger/5 dark:hover:bg-danger/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </form>
            </div>
          </div>
          {/* Clicking outside sidebar closes it */}
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)}></div>
        </div>
      )}
    </>
  );
}
