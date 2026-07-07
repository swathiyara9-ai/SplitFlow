'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, KeyRound, Sparkles, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';

const resetSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm_password: z.string().min(6, 'Confirm password must be at least 6 characters'),
}).refine((data) => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

type ResetFormValues = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Track whether the PASSWORD_RECOVERY session has been established
  const [recoverySessionReady, setRecoverySessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
  });

  useEffect(() => {
    const supabase = createClient();

    // The password reset email sends the user to this page with a token
    // in the URL hash: #access_token=xxx&type=recovery
    // Supabase client automatically parses this and fires PASSWORD_RECOVERY event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          // Session is now established from the recovery token
          setRecoverySessionReady(true);
          setCheckingSession(false);
        } else if (event === 'SIGNED_IN' && session) {
          // Also handle case where session is already established
          setRecoverySessionReady(true);
          setCheckingSession(false);
        }
      }
    );

    // Fallback: if we already have a session (e.g. user navigated back), allow the form
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setRecoverySessionReady(true);
      }
      setCheckingSession(false);
    });

    // Timeout: if no recovery event after 5 seconds, show error
    const timer = setTimeout(() => {
      setCheckingSession(false);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const onSubmit = async (data: ResetFormValues) => {
    if (!recoverySessionReady) {
      setErrorMessage('Recovery session not found. Please use the password reset link from your email.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    const supabase = createClient();

    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        setErrorMessage(error.message);
        toast.error(error.message);
      } else {
        toast.success('Password updated successfully!');
        // Sign out so user is forced to log in with new password
        await supabase.auth.signOut();
        router.push('/login?message=Password updated! Sign in with your new password.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-30%] right-[-20%] w-[80vw] h-[80vw] rounded-full bg-primary/10 blur-[130px]"></div>
        <div className="absolute bottom-[-30%] left-[-20%] w-[70vw] h-[70vw] rounded-full bg-purple-600/10 blur-[110px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8 text-center">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-purple-400 flex items-center justify-center text-white shadow-lg">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Set New Password</h1>
            <p className="text-xs text-slate-400">Enter and confirm your new password below</p>
          </div>
        </div>

        <div className="glass-panel p-6 md:p-8 rounded-premium bg-white/5 border-white/5 shadow-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[9px] font-bold text-primary tracking-wider uppercase">
            <Sparkles className="w-3 h-3" /> Password Recovery
          </div>

          {/* Session status indicator */}
          {checkingSession ? (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-xs font-semibold text-primary flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Verifying recovery link...</span>
            </div>
          ) : recoverySessionReady ? (
            <div className="p-3 bg-success/10 border border-success/20 rounded-xl text-xs font-semibold text-success flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Recovery link verified. Set your new password below.</span>
            </div>
          ) : (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-xs font-semibold text-danger flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Invalid or expired reset link. Please request a new one.</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-xs font-semibold text-danger flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Password</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                  className="w-full text-xs font-semibold bg-slate-950/20 border border-white/10 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-slate-600"
                />
              </div>
              {errors.password && (
                <p className="text-[10px] text-danger font-semibold">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Confirm New Password</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  {...register('confirm_password')}
                  className="w-full text-xs font-semibold bg-slate-950/20 border border-white/10 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-slate-600"
                />
              </div>
              {errors.confirm_password && (
                <p className="text-[10px] text-danger font-semibold">{errors.confirm_password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !recoverySessionReady || checkingSession}
              className="w-full py-3 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating Password...
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
