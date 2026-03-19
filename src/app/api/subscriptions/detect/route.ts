import { NextResponse } from 'next/server';
import { detectAndUpsertSubscriptions } from '@/lib/subscriptionDetector';

export async function POST(request: Request) {
  try {
    let accountId: string | undefined;

    try {
      const body = await request.json();
      accountId = body.accountId || undefined;
    } catch {
      // No body or invalid JSON — detect across all accounts
    }

    const result = await detectAndUpsertSubscriptions(accountId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Subscription detection failed:', error);
    return NextResponse.json(
      { error: 'Failed to detect subscriptions' },
      { status: 500 }
    );
  }
}
