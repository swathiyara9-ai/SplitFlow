'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  Plus, 
  Copy, 
  Check, 
  Users, 
  ChevronRight, 
  Activity, 
  PieChart, 
  Sparkles,
  DollarSign,
  Search
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getCurrentProfile } from '@/services/profile';
import { getDashboardData } from '@/services/dashboard';
import { calculateGlobalBalances } from '@/utils/balances';
import { useRealtimeSubscription } from '@/hooks/useRealtime';
import { useCurrency } from '@/components/CurrencyProvider';

function DashboardContent() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search')?.trim() || '';
  const searchFilter = searchQuery.toLowerCase();
  const view = searchParams.get('view');
  const isActivityView = view === 'activity';
  const activityRef = useRef<HTMLDivElement>(null);
  
  const supabase = createClient();
  const [copied, setCopied] = useState(false);
  const { format, currency } = useCurrency();

  // 1. Fetch Profile
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => getCurrentProfile(supabase),
  });

  // 2. Fetch Dashboard Data
  const { data: dashboard, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => getDashboardData(supabase),
  });

  // 3. Register Realtime Database Subscriptions
  useRealtimeSubscription('expenses', [['dashboard']]);
  useRealtimeSubscription('settlements', [['dashboard']]);
  useRealtimeSubscription('group_members', [['dashboard']]);
  useRealtimeSubscription('activity_logs', [['dashboard']]);
  useRealtimeSubscription('profiles', [['profile']]);

  const userId = profile?.id || '';
  const groupsData = useMemo(() => dashboard?.groupsData || [], [dashboard?.groupsData]);
  const groups = useMemo(() => dashboard?.groups || [], [dashboard?.groups]);
  const activities = useMemo(() => dashboard?.activities || [], [dashboard?.activities]);
  const isLoading = isProfileLoading || isDashboardLoading;

  const searchResults = useMemo(() => {
    if (!searchFilter) {
      return {
        groups,
        expenses: [] as { group: typeof groups[number]; expense: (typeof groupsData)[number]['expenses'][number] }[],
        members: [] as { group: typeof groups[number]; member: (typeof groupsData)[number]['members'][number] }[],
      };
    }

    const groupMatches = groups.filter((group) =>
      group.name.toLowerCase().includes(searchFilter) ||
      (group.description || '').toLowerCase().includes(searchFilter)
    );

    const expenseMatches = groupsData.flatMap(({ group, expenses }) =>
      expenses
        .filter((expense) =>
          expense.title.toLowerCase().includes(searchFilter) ||
          (expense.description || '').toLowerCase().includes(searchFilter)
        )
        .map((expense) => ({ group, expense }))
    );

    const memberMatches = groupsData.flatMap(({ group, members }) =>
      members
        .filter((member) => {
          const displayName = member.profiles?.display_name || '';
          const uniqueUserId = member.profiles?.unique_user_id || '';
          return (
            displayName.toLowerCase().includes(searchFilter) ||
            uniqueUserId.toLowerCase().includes(searchFilter)
          );
        })
        .map((member) => ({ group, member }))
    );

    return {
      groups: groupMatches,
      expenses: expenseMatches,
      members: memberMatches,
    };
  }, [groups, groupsData, searchFilter]);

  const hasSearch = searchFilter.length > 0;
  const hasSearchResults =
    searchResults.groups.length > 0 ||
    searchResults.expenses.length > 0 ||
    searchResults.members.length > 0;

  useEffect(() => {
    if (!isActivityView || isLoading) return;

    const viewedAt = new Date().toISOString();
    localStorage.setItem(`splitflow-last-viewed-activity-at:${profile?.id || 'current'}`, viewedAt);
    window.dispatchEvent(new CustomEvent('splitflow-activity-viewed', { detail: { viewedAt } }));
    activityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isActivityView, isLoading, profile?.id]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-stone-200 dark:bg-stone-800 rounded-xl animate-pulse"></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-32 bg-stone-200 dark:bg-stone-800 rounded-premium animate-pulse"></div>
          <div className="h-32 bg-stone-200 dark:bg-stone-800 rounded-premium animate-pulse"></div>
          <div className="h-32 bg-stone-200 dark:bg-stone-800 rounded-premium animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-stone-200 dark:bg-stone-800 rounded-premium animate-pulse"></div>
          <div className="h-96 bg-stone-200 dark:bg-stone-800 rounded-premium animate-pulse"></div>
        </div>
      </div>
    );
  }

  // Calculate Balances
  const balances = calculateGlobalBalances(userId, groupsData);
  const visibleGroups = hasSearch ? searchResults.groups : groups;
  const visibleActivities = isActivityView ? activities : activities.slice(0, 5);

  const handleCopyId = () => {
    if (profile?.unique_user_id) {
      navigator.clipboard.writeText(profile.unique_user_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Outflow chart calculations
  const categoryTotals: Record<string, number> = {};
  let totalSpent = 0;

  groupsData.forEach(({ expenses }) => {
    expenses.forEach((e) => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + Number(e.amount);
      totalSpent += Number(e.amount);
    });
  });

  const categories = Object.entries(categoryTotals)
    .map(([name, value]) => ({
      name,
      value,
      percentage: totalSpent > 0 ? Math.round((value / totalSpent) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Welcome back, {profile?.display_name || 'User'} 👋</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">Here is your shared financial standing across all groups.</p>
        </div>
        
        {/* ID copy badge */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto px-3.5 py-2 glass-panel rounded-premium">
          <span className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">Your ID:</span>
          <span className="text-xs font-mono font-bold text-primary">{profile?.unique_user_id}</span>
          <button 
            onClick={handleCopyId}
            className="text-stone-400 hover:text-primary transition-colors p-1 hover:bg-stone-100/50 dark:hover:bg-stone-900/50 rounded-lg"
            title="Copy ID to Clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Balances summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Owed to you */}
        <div className="glass-panel rounded-premium p-5 shadow-layered relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 text-success/5 pointer-events-none">
            <ArrowUpRight className="w-24 h-24" />
          </div>
          <span className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">You Are Owed</span>
          <h3 className="text-2xl font-bold mt-1 text-success tracking-tight">{format(balances.owedToMe)}</h3>
          <p className="text-[11px] text-stone-400 mt-2">Accumulated receivables</p>
        </div>

        {/* You owe */}
        <div className="glass-panel rounded-premium p-5 shadow-layered relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 text-danger/5 pointer-events-none">
            <ArrowDownLeft className="w-24 h-24" />
          </div>
          <span className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">You Owe Others</span>
          <h3 className="text-2xl font-bold mt-1 text-danger tracking-tight">{format(balances.iOwe)}</h3>
          <p className="text-[11px] text-stone-400 mt-2">Pending settlement debts</p>
        </div>

        {/* Net */}
        <div className={`rounded-premium p-5 relative overflow-hidden text-white border-none ${
          balances.netBalance >= 0 
            ? 'bg-gradient-to-tr from-primary to-orange-500 shadow-md shadow-primary/20' 
            : 'bg-stone-900 dark:bg-stone-950 border border-white/5 shadow-layered'
        }`}>
          <div className="absolute -right-4 -bottom-4 text-white/10 pointer-events-none">
            <Wallet className="w-24 h-24" />
          </div>
          <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Net Standing</span>
          <h3 className="text-2xl font-bold mt-1 tracking-tight">
            {balances.netBalance >= 0 ? '+' : ''}{format(balances.netBalance)}
          </h3>
          <p className="text-[11px] text-white/80 mt-2">
            {balances.netBalance >= 0 ? 'Positive net balance!' : 'Needs settlement action'}
          </p>
        </div>
      </div>

      {/* Main split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Groups Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
              {hasSearch ? `Search Results for "${searchQuery}"` : 'Shared Groups'}
            </h3>
            <Link 
              href="/groups" 
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> New Group
            </Link>
          </div>

          {hasSearch && !hasSearchResults ? (
            <div className="glass-panel rounded-premium p-8 text-center space-y-3 shadow-layered">
              <Search className="w-8 h-8 text-stone-300 dark:text-stone-700 mx-auto" />
              <h4 className="text-sm font-bold">No results found for &quot;{searchQuery}&quot;</h4>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                Try a group name, expense title, member name, or SPL user ID.
              </p>
            </div>
          ) : visibleGroups.length === 0 && !hasSearch ? (
            <div className="glass-panel rounded-premium p-8 text-center space-y-4 shadow-layered">
              <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold">No active groups</h4>
                <p className="text-xs text-stone-500 max-w-xs mx-auto">
                  Get started by creating a shared group and inviting members via their Unique ID.
                </p>
              </div>
              <Link
                href="/groups"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-primary hover:bg-primary-hover text-white rounded-xl transition-all"
              >
                Create First Group
              </Link>
            </div>
          ) : (
            <>
              {visibleGroups.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visibleGroups.map((group) => {
                const groupNet = balances.groupSummaries[group.id] || 0;
                const membersCount = groupsData.find((gd) => gd.group.id === group.id)?.members.length || 1;

                return (
                  <Link 
                    key={group.id}
                    href={`/groups/${group.id}`} 
                    className="glass-panel rounded-premium p-5 flex flex-col justify-between h-40 hover:border-primary/30 smooth-hover"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                          Group
                        </span>
                        <span className="text-[10px] text-stone-400 flex items-center gap-1 font-semibold">
                          <Users className="w-3 h-3" /> {membersCount}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold mt-2 text-stone-900 dark:text-stone-100 truncate">
                        {group.name}
                      </h4>
                      {group.description && (
                        <p className="text-[11px] text-stone-400 line-clamp-1 mt-0.5">
                          {group.description}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-end justify-between pt-4 border-t border-black/5 dark:border-white/5">
                      <div>
                        <span className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">Your Standing</span>
                        <p className={`text-xs font-bold ${
                          groupNet > 0.01 
                            ? 'text-success' 
                            : groupNet < -0.01 
                            ? 'text-danger' 
                            : 'text-stone-400'
                        }`}>
                          {groupNet > 0.01 
                            ? `Owed ${format(groupNet)}` 
                            : groupNet < -0.01 
                            ? `You owe ${format(Math.abs(groupNet))}` 
                            : 'Settled'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-400" />
                    </div>
                  </Link>
                );
              })}
                </div>
              )}

              {hasSearch && (searchResults.expenses.length > 0 || searchResults.members.length > 0) && (
                <div className="space-y-3">
                  {searchResults.expenses.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">Matching Expenses</h4>
                      {searchResults.expenses.map(({ group, expense }) => (
                        <Link
                          key={expense.id}
                          href={`/groups/${group.id}`}
                          className="glass-panel rounded-xl p-3 flex items-center justify-between gap-3 hover:border-primary/30 transition-all"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{expense.title}</p>
                            <p className="text-[10px] text-stone-400 truncate">
                              {group.name}{expense.description ? ` - ${expense.description}` : ''}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-primary shrink-0">{format(Number(expense.amount))}</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {searchResults.members.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">Matching Members</h4>
                      {searchResults.members.map(({ group, member }) => (
                        <Link
                          key={`${group.id}-${member.user_id}`}
                          href={`/groups/${group.id}`}
                          className="glass-panel rounded-xl p-3 flex items-center justify-between gap-3 hover:border-primary/30 transition-all"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{member.profiles?.display_name || 'Member'}</p>
                            <p className="text-[10px] text-stone-400 truncate">{group.name}</p>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-primary shrink-0">
                            {member.profiles?.unique_user_id || 'SPL-UNKNOWN'}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar Analytics & Activity Column */}
        <div className="space-y-6">
          {/* Outflow Statistics */}
          <div className="glass-panel rounded-premium p-5 shadow-layered space-y-4">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">Spend by Category</h3>
            </div>

            {categories.length === 0 ? (
              <div className="text-center py-4">
                <DollarSign className="w-8 h-8 text-stone-300 dark:text-stone-700 mx-auto mb-2" />
                <p className="text-[11px] text-stone-400">No expenses recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {categories.map((c) => (
                  <div key={c.name} className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="capitalize">{c.name}</span>
                      <span>{format(c.value)} ({c.percentage}%)</span>
                    </div>
                    <div className="w-full bg-stone-100 dark:bg-stone-900 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-primary h-full rounded-full transition-all" 
                        style={{ width: `${c.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Log */}
          <div ref={activityRef} className="glass-panel rounded-premium p-5 shadow-layered space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                {isActivityView ? 'Activity Feed' : 'Recent Activity'}
              </h3>
            </div>

            {activities.length === 0 ? (
              <div className="text-center py-4">
                <Sparkles className="w-8 h-8 text-stone-300 dark:text-stone-700 mx-auto mb-2" />
                <p className="text-[11px] text-stone-400">No activities logged yet.</p>
              </div>
            ) : (
              <div className="relative border-l-2 border-stone-100 dark:border-stone-900 pl-4 ml-1 space-y-4">
                {visibleActivities.map((act) => (
                  <div key={act.id} className="relative text-xs space-y-0.5">
                    {/* Circle icon marker */}
                    <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-white dark:ring-stone-950"></span>
                    <p className="font-semibold text-stone-800 dark:text-stone-200">
                      {act.description
                        .replace(/\$/g, currency.symbol)
                        .replace(/\((\d+(?:\.\d{2})?)\)/g, `(${currency.symbol}$1)`)
                        .replace(/\bfor (\d+(?:\.\d{2})?)\b/g, `for ${currency.symbol}$1`)}
                    </p>
                    <span className="text-[10px] text-stone-400 block">
                      {new Date(act.created_at).toLocaleDateString(undefined, { 
                        month: 'short', 
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric'
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-10 w-64 bg-stone-200 dark:bg-stone-800 rounded-xl animate-pulse"></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-32 bg-stone-200 dark:bg-stone-800 rounded-premium animate-pulse"></div>
          <div className="h-32 bg-stone-200 dark:bg-stone-800 rounded-premium animate-pulse"></div>
          <div className="h-32 bg-stone-200 dark:bg-stone-800 rounded-premium animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-stone-200 dark:bg-stone-800 rounded-premium animate-pulse"></div>
          <div className="h-96 bg-stone-200 dark:bg-stone-800 rounded-premium animate-pulse"></div>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
