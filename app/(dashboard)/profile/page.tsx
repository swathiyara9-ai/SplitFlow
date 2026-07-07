'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  User, 
  Mail, 
  Copy, 
  Check, 
  Loader2, 
  Sparkles, 
  ShieldCheck, 
  QrCode,
  Smartphone
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { getCurrentProfile, updateProfile } from '@/services/profile';
import { useToast } from '@/components/ui/Toast';
import { useRealtimeSubscription } from '@/hooks/useRealtime';

const profileSchema = z.object({
  display_name: z.string().min(2, 'Display name must be at least 2 characters'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const supabase = createClient();
  
  const [copied, setCopied] = useState(false);

  // 1. Fetch Profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => getCurrentProfile(supabase),
  });

  // Realtime updates
  useRealtimeSubscription('profiles', [['profile']]);

  // 2. Mutation for updating profile
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      if (!profile?.id) throw new Error('Profile ID missing');
      const res = await updateProfile(supabase, profile.id, {
        display_name: data.display_name,
      });
      if (res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile details updated!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update profile');
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
  });

  // Set form default when profile loads
  React.useEffect(() => {
    if (profile) {
      setValue('display_name', profile.display_name);
    }
  }, [profile, setValue]);

  const handleCopyId = () => {
    if (profile?.unique_user_id) {
      navigator.clipboard.writeText(profile.unique_user_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const onSubmit = (data: ProfileFormValues) => {
    updateProfileMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-premium animate-pulse"></div>
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-premium animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Identity Node</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Manage your credentials and view your permanent sharing ID.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Fintech Virtual ID Card */}
        <div className="relative overflow-hidden rounded-premium bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 p-6 md:p-8 text-white shadow-2xl flex flex-col justify-between h-72 border border-white/5 group">
          {/* Ambient card lights */}
          <div className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full bg-primary/10 blur-[80px] group-hover:bg-primary/20 transition-all duration-500"></div>
          
          <div className="flex justify-between items-start z-10">
            <div className="space-y-1">
              <span className="text-[9px] bg-white/10 text-slate-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                SplitFlow Core
              </span>
              <h3 className="text-lg font-bold tracking-tight mt-1 text-slate-100">Permanent ID Node</h3>
            </div>
            <QrCode className="w-8 h-8 text-slate-400 dark:text-slate-500" />
          </div>

          <div className="z-10 space-y-4">
            <div className="space-y-1">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Unique User ID</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-mono font-bold tracking-wider text-slate-100">{profile?.unique_user_id}</span>
                <button
                  onClick={handleCopyId}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                  title="Copy ID to Clipboard"
                >
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-end">
              <div className="space-y-0.5">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Node Owner</span>
                <p className="text-sm font-bold text-slate-200">{profile?.display_name}</p>
              </div>
              <span className="text-[9px] text-slate-500 font-semibold">Registered {new Date(profile?.created_at || '').toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Update Details Form */}
        <div className="glass-panel p-6 md:p-8 rounded-premium shadow-layered self-start space-y-6">
          <div className="flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-3">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold">Configure Identity Coordinates</h3>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Display Name</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Jane Doe"
                  {...register('display_name')}
                  className="w-full text-xs font-semibold bg-slate-950/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {errors.display_name && (
                <p className="text-[10px] text-danger font-semibold">{errors.display_name.message}</p>
              )}
            </div>

            {/* Email (Read Only) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Coordinates (Permanent)</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={profile?.email}
                  disabled
                  className="w-full text-xs font-semibold bg-slate-200/50 dark:bg-slate-900/50 border border-black/5 dark:border-white/5 rounded-xl pl-11 pr-4 py-3 text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="w-full py-3 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating Node...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
