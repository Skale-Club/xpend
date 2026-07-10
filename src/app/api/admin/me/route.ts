import { NextResponse } from 'next/server';
import { withApiLogging } from '@/lib/apiLogger';
import { requireSuperAdmin } from '@/lib/auth/requireSession';

// Super-admin access is enforced in middleware (isAdminPath + isSuperAdmin) and
// revalidated here as defense in depth. The sidebar probes this endpoint to
// decide whether to render the admin link.
export const GET = withApiLogging(async (request: Request) => {
    const denied = requireSuperAdmin(request);
    if (denied) return denied;
    return NextResponse.json({ isSuperAdmin: true });
});
