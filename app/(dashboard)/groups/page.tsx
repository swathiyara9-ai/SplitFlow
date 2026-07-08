'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Loader2, Sparkles, AlertCircle, ChevronRight, UserPlus, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createGroup, getUserGroups } from '@/services/group';
import { useToast } from '@/components/ui/Toast';
import { useRealtimeSubscription } from '@/hooks/useRealtime';

const groupSchema = z.object({
  name: z.string().min(3, 'Group identity name must be at least 3 characters'),
  description: z.string().optional(),
});

type GroupFormValues = z.infer<typeof groupSchema>;

export default function GroupsPage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [showCreateForm, setShowCreateForm] = useState(false);

  // 1. Query groups
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => getUserGroups(supabase),
  });

  // Realtime updates on group membership changes
  useRealtimeSubscription('group_members', [['groups']]);
  useRealtimeSubscription('groups', [['groups']]);

  // 2. Mutation for creating a group
  const createGroupMutation = useMutation({
    mutationFn: async (data: GroupFormValues) => {
      const res = await createGroup(supabase, data.name, data.description);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (newGroup) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success(`Group "${newGroup?.name}" instantiated!`);
      setShowCreateForm(false);
      reset();
      if (newGroup) {
        router.push(`/groups/${newGroup.id}`);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create group');
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
  });

  const onSubmit = (data: GroupFormValues) => {
    createGroupMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Ledger Channels</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">Establish and manage shared expense groups.</p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 text-xs font-semibold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" /> Instantiate Group
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Group Form Column */}
        {showCreateForm && (
          <div className="glass-panel p-6 rounded-premium shadow-layered self-start space-y-6">
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                <h3 className="text-sm font-bold">New Ledger Node</h3>
              </div>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-xs text-stone-400 hover:text-stone-200"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Group Name</label>
                <input
                  type="text"
                  placeholder="e.g. Iceland Road Trip 2026"
                  {...register('name')}
                  className="w-full text-xs font-semibold bg-stone-950/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {errors.name && (
                  <p className="text-[10px] text-danger font-semibold">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="e.g. Shared diesel, cabin stays, and groceries split between crew members."
                  rows={3}
                  {...register('description')}
                  className="w-full text-xs font-semibold bg-stone-950/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <button
                type="submit"
                disabled={createGroupMutation.isPending}
                className="w-full py-3 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {createGroupMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deploying Ledger...
                  </>
                ) : (
                  'Deploy Group Node'
                )}
              </button>
            </form>
          </div>
        )}

        {/* Groups List Column */}
        <div className={showCreateForm ? 'lg:col-span-2 space-y-4' : 'lg:col-span-3 space-y-4'}>
          <h3 className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">Your Active Ledgers</h3>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-32 bg-stone-200 dark:bg-stone-800 rounded-premium animate-pulse"></div>
              <div className="h-32 bg-stone-200 dark:bg-stone-800 rounded-premium animate-pulse"></div>
            </div>
          ) : groups.length === 0 ? (
            <div className="glass-panel p-12 text-center rounded-premium space-y-4 shadow-layered">
              <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold">No groups found</h4>
                <p className="text-xs text-stone-500 max-w-xs mx-auto">
                  You are not a member of any shared expense ledgers. Create one to begin tracking.
                </p>
              </div>
              {!showCreateForm && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-4 py-2 text-xs font-semibold bg-primary hover:bg-primary-hover text-white rounded-xl transition-all"
                >
                  Create Your First Group
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  className="glass-panel p-5 rounded-premium flex items-center justify-between hover:border-primary/30 smooth-hover"
                >
                  <div className="space-y-1.5 flex-1 min-w-0 pr-4">
                    <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                      Shared Channel
                    </span>
                    <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                      {group.name}
                    </h4>
                    {group.description && (
                      <p className="text-[11px] text-stone-400 line-clamp-1">
                        {group.description}
                      </p>
                    )}
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-stone-900 flex items-center justify-center shrink-0">
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
