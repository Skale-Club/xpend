import { NextResponse } from 'next/server';
import { withApiLogging } from '@/lib/apiLogger';

// Cache the model list for an hour; OpenRouter's catalog changes infrequently.
export const revalidate = 3600;

interface OpenRouterModel {
    id: string;
    name?: string;
}

export const GET = withApiLogging(async (_request: Request) => {
    try {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
            next: { revalidate: 3600 },
        });

        if (!res.ok) {
            return NextResponse.json({ models: [] });
        }

        const json = (await res.json()) as { data?: OpenRouterModel[] };
        const models = (json.data ?? [])
            .map((m) => ({ value: m.id, label: m.name || m.id }))
            .sort((a, b) => a.label.localeCompare(b.label));

        return NextResponse.json({ models });
    } catch (error) {
        console.error('Failed to fetch OpenRouter models:', error);
        return NextResponse.json({ models: [] });
    }
});
