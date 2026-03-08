import { ChatApiError } from '@/lib/chat/errors';

type Bucket = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 120;
const buckets = new Map<string, Bucket>();

function getRequestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || null;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return null;
}

export async function checkChatRateLimit(request: Request): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const ip = getRequestIp(request);
  if (!ip) {
    return;
  }

  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return;
  }

  bucket.count += 1;

  if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
    throw new ChatApiError('rate_limit:chat');
  }
}