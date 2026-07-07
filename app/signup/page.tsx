'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, KeyRound, Mail, User, Sparkles, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';

const signupSchema = z.object({
  display_name: z.string().min(2, 'Display name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormValues) => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    const supabase = createClient();

    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            display_name: data.display_name,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        toast.error(error.message);
      } else {
        // If auto-confirm is enabled in Supabase, we can check if user is already signed in
        if (authData.session) {
          toast.success('Registration successful!');
          router.push('/dashboard');
        } else {
          setSuccessMessage('Registration successful! Please check your email for a verification link.');
          toast.success('Verification link sent!');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-30%] left-[-20%] w-[80vw] h-[80vw] rounded-full bg-primary/10 blur-[130px]"></div>
        <div className="absolute bottom-[-30%] right-[-20%] w-[70vw] h-[70vw] rounded-full bg-purple-600/10 blur-[110px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 mb-8 text-center">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-purple-400 flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Generate SplitFlow ID</h1>
            <p className="text-xs text-slate-400">Establish your permanent transaction node</p>
          </div>
        </div>

        {/* Card */}
        <div className="glass-panel p-6 md:p-8 rounded-premium bg-white/5 border-white/5 shadow-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[9px] font-bold text-primary tracking-wider uppercase">
            <Sparkles className="w-3 h-3" /> Node Registration Form
          </div>

          {/* Messages */}
          {errorMessage && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-xs font-semibold text-danger flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage ? (
            <div className="space-y-4">
              <div className="p-4 bg-success/15 border border-success/30 rounded-xl text-xs font-semibold text-success flex flex-col gap-2">
                <div className="flex items-center gap-2 font-bold">
                  <Sparkles className="w-4 h-4 text-success" />
                  <span>Account Created Successfully</span>
                </div>
                <p className="text-[11px] text-slate-300 font-medium">
                  {successMessage}
                </p>
              </div>
              <Link
                href="/login"
                className="w-full py-3 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-lg flex items-center justify-center transition-all"
              >
                Go to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Display Name Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Display Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. Jane Doe"
                    {...register('display_name')}
                    className="w-full text-xs font-semibold bg-slate-950/20 border border-white/10 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-slate-600"
                  />
                </div>
                {errors.display_name && (
                  <p className="text-[10px] text-danger font-semibold">{errors.display_name.message}</p>
                )}
              </div>

              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Coordinates</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    placeholder="e.g. jane@splitflow.io"
                    {...register('email')}
                    className="w-full text-xs font-semibold bg-slate-950/20 border border-white/10 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-slate-600"
                  />
                </div>
                {errors.email && (
                  <p className="text-[10px] text-danger font-semibold">{errors.email.message}</p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Secret Key</label>
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

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registering Node...
                  </>
                ) : (
                  'Generate Unique ID'
                )}
              </button>
            </form>
          )}
        </div>

        {/* Login Link */}
        <p className="text-center text-xs text-slate-500 mt-6 font-semibold">
          Already have a unique ID?{' '}
          <Link href="/login" className="text-primary hover:underline font-bold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
