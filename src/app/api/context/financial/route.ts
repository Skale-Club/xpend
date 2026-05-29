import { NextResponse } from 'next/server';
import { buildFinancialContext, renderContextText } from '@/lib/memory/contextBuilder';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const context = await buildFinancialContext({
      topic: searchParams.get('topic'),
      entityType: searchParams.get('entityType'),
      entityId: searchParams.get('entityId'),
    });
    return NextResponse.json({ context, text: renderContextText(context) });
  } catch (error) {
    console.error('Failed to build financial context:', error);
    return NextResponse.json({ error: 'Failed to build financial context' }, { status: 500 });
  }
}
