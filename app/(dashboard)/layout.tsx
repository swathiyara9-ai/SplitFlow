import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/services/profile';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Verify auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Load user profile
  const profile = await getCurrentProfile(supabase);

  return (
    <div className="relative min-h-screen flex">
      {/* Background ambient accents */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[40%] -right-[20%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-br from-primary/10 to-transparent opacity-70 blur-[120px]"></div>
        <div className="absolute -bottom-[30%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tr from-purple-500/10 to-transparent opacity-50 blur-[100px]"></div>
      </div>

      {/* Desktop Sidebar */}
      <Sidebar profile={profile} />

      {/* Main Workspace Frame */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen z-10 relative">
        <Header profile={profile} />
        
        {/* Workspace Content */}
        <main className="flex-1 p-6 md:p-8 max-w-6xl w-full mx-auto space-y-8">
          {children}
        </main>
      </div>
    </div>
  );
}
