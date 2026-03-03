import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        let settings = await prisma.settings.findUnique({
            where: { id: 'default' },
        });

        // Create default settings if not exists
        if (!settings) {
            settings = await prisma.settings.create({
                data: { id: 'default' },
            });
        }

        // Return settings but mask the API key for security
        return NextResponse.json({
            id: settings.id,
            hasGeminiApiKey: !!settings.geminiApiKey,
            geminiApiKeyPreview: settings.geminiApiKey
                ? `${settings.geminiApiKey.slice(0, 8)}...${settings.geminiApiKey.slice(-4)}`
                : null,
        });
    } catch (error) {
        console.error('Failed to fetch settings:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { geminiApiKey } = body;

        // Validate API key format (basic check)
        if (geminiApiKey && typeof geminiApiKey === 'string' && geminiApiKey.trim() !== '') {
            // Test the API key by making a simple request to Gemini
            const isValid = await validateGeminiApiKey(geminiApiKey.trim());

            if (!isValid) {
                return NextResponse.json({
                    error: 'Invalid API key. Please check your Google Gemini key.'
                }, { status: 400 });
            }
        }

        const settings = await prisma.settings.upsert({
            where: { id: 'default' },
            create: {
                id: 'default',
                geminiApiKey: geminiApiKey?.trim() || null,
            },
            update: {
                geminiApiKey: geminiApiKey?.trim() || null,
            },
        });

        return NextResponse.json({
            success: true,
            hasGeminiApiKey: !!settings.geminiApiKey,
            geminiApiKeyPreview: settings.geminiApiKey
                ? `${settings.geminiApiKey.slice(0, 8)}...${settings.geminiApiKey.slice(-4)}`
                : null,
        });
    } catch (error) {
        console.error('Failed to update settings:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}

// Export the API key getter for use in other modules
export async function getGeminiApiKey(): Promise<string | null> {
    try {
        const settings = await prisma.settings.findUnique({
            where: { id: 'default' },
            select: { geminiApiKey: true },
        });
        return settings?.geminiApiKey || null;
    } catch {
        return null;
    }
}

// Validate API key by making a test request
async function validateGeminiApiKey(apiKey: string): Promise<boolean> {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            { method: 'GET' }
        );
        return response.ok;
    } catch {
        return false;
    }
}
