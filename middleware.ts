import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSuperAdmin } from '@/lib/auth/superAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Page routes that require authentication. The root '/' doubles as the login
// page (via AuthGate), so it is intentionally excluded — redirecting '/' to
// itself would create an infinite loop.
const PROTECTED_PAGE_PATHS = [
  '/accounts',
  '/admin',
  '/categories',
  '/reports',
  '/settings',
  '/statements',
  '/subscriptions',
  '/transactions',
];

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin');
}

export async function middleware(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    // MCP routes use Bearer token auth — always pass through
    if (request.nextUrl.pathname.startsWith('/api/mcp')) {
      return NextResponse.next({ request });
    }
    // For API routes return JSON error; for page routes do a best-effort pass-through.
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Supabase auth is not configured' },
        { status: 500 }
      );
    }
    return NextResponse.next({ request });
  }

  // Forwarded request headers. We strip any client-supplied x-user-email so it
  // can only ever be set by us, then re-add it once the session is verified.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-user-email');

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request: { headers: requestHeaders } });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user) {
    // MCP routes use Bearer token auth — bypass Supabase session check
    if (pathname.startsWith('/api/mcp')) {
      return response;
    }

    // API routes: return 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Protected page routes: redirect to root (which renders the login form)
    if (PROTECTED_PAGE_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/';
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  // Super-admin gate for the logs panel and its API.
  if (isAdminPath(pathname) && !isSuperAdmin(user.email)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    return NextResponse.redirect(homeUrl);
  }

  // Authenticated: expose the verified email to downstream handlers/loggers.
  if (user.email) {
    requestHeaders.set('x-user-email', user.email);
    const finalResponse = NextResponse.next({ request: { headers: requestHeaders } });
    // Preserve any session cookies refreshed during getUser().
    response.cookies.getAll().forEach((cookie) => finalResponse.cookies.set(cookie));
    response = finalResponse;
  }

  return response;
}

export const config = {
  matcher: [
    // Match API routes and all protected page routes
    '/api/:path*',
    '/accounts/:path*',
    '/admin/:path*',
    '/categories/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/statements/:path*',
    '/subscriptions/:path*',
    '/transactions/:path*',
  ],
};
