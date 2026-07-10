import { NextResponse } from 'next/server';
import { isSuperAdmin } from '@/lib/auth/superAdmin';

/**
 * The middleware strips any client-supplied `x-user-email` header and re-adds
 * it only after verifying the Supabase session, so its presence proves the
 * request was authenticated. Sensitive handlers call these as defense in
 * depth — a middleware matcher regression must not silently expose them.
 */
export function getVerifiedUserEmail(request: Request): string | null {
  return request.headers.get('x-user-email');
}

/** Returns a 401 response when the request has no verified session, else null. */
export function requireSession(request: Request): NextResponse | null {
  if (!getVerifiedUserEmail(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

/** Returns a 401/403 response unless the verified user is a super admin, else null. */
export function requireSuperAdmin(request: Request): NextResponse | null {
  const email = getVerifiedUserEmail(request);
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isSuperAdmin(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
