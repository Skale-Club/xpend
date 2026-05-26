import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Page routes that require authentication. The root '/' doubles as the login
// page (via AuthGate), so it is intentionally excluded — redirecting '/' to
// itself would create an infinite loop.
const PROTECTED_PAGE_PATHS = [
  '/accounts',
  '/categories',
  '/reports',
  '/settings',
  '/statements',
  '/subscriptions',
  '/transactions',
];

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

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request,
        });

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
  }

  return response;
}

export const config = {
  matcher: [
    // Match API routes and all protected page routes
    '/api/:path*',
    '/accounts/:path*',
    '/categories/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/statements/:path*',
    '/subscriptions/:path*',
    '/transactions/:path*',
  ],
};
