import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // This will refresh the session token if expired.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Protect App Routes
  const isProtectedRoute =
    path.startsWith('/dashboard') ||
    path.startsWith('/groups') ||
    path.startsWith('/profile') ||
    path.startsWith('/settings');

  // Auth Page Routes (publicly accessible)
  const isAuthRoute =
    path === '/login' ||
    path === '/signup' ||
    path === '/forgot-password';

  // Reset password page: always allow — the recovery token arrives
  // via URL hash and is exchanged client-side. The middleware must
  // NOT redirect away from this page regardless of session state.
  const isResetPassword = path === '/reset-password';

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from auth pages — but NOT /reset-password
  if (user && (isAuthRoute || path === '/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
