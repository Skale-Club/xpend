import { NextResponse } from 'next/server';
import { withApiLogging } from '@/lib/apiLogger';

// Super-admin access is enforced in middleware (isAdminPath + isSuperAdmin), so
// reaching this handler at all means the caller is a super admin. The sidebar
// probes this endpoint to decide whether to render the admin link.
export const GET = withApiLogging(async () => {
    return NextResponse.json({ isSuperAdmin: true });
});
