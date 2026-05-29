import { withApiLogging } from '@/lib/apiLogger';

export const GET = withApiLogging(async (_request: Request) => {
  return new Response(null, { status: 204 });
});
