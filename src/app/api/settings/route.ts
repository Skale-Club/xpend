import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
    DEFAULT_CHAT_MODEL,
    OPENROUTER_CHAT_MODELS,
} from '@/lib/chat/models';
import { withApiLogging } from '@/lib/apiLogger';

async function getStoredChatModel(): Promise<string> {
    try {
        const rows = await prisma.$queryRaw<Array<{ geminiChatModel: string }>>`
            SELECT "geminiChatModel"
            FROM "Settings"
            WHERE "id" = 'default'
            LIMIT 1
        `;

        const model = rows[0]?.geminiChatModel;
        return model && model.trim() !== '' ? model : DEFAULT_CHAT_MODEL;
    } catch {
        return DEFAULT_CHAT_MODEL;
    }
}

async function setStoredChatModel(model: string): Promise<void> {
    await prisma.$executeRaw`
        UPDATE "Settings"
        SET "geminiChatModel" = ${model},
            "updatedAt" = NOW()
        WHERE "id" = 'default'
    `;
}

export const GET = withApiLogging(async (_request: Request) => {
    try {
        let settings = await prisma.settings.findUnique({
            where: { id: 'default' },
        });

        // Create default settings if not exists
        if (!settings) {
            settings = await prisma.settings.create({
                data: {
                    id: 'default',
                },
            });
        }

        const geminiChatModel = await getStoredChatModel();

        // Return settings but mask the API key for security
        return NextResponse.json({
            id: settings.id,
            hasGeminiApiKey: !!settings.geminiApiKey,
            geminiApiKeyPreview: settings.geminiApiKey
                ? `${settings.geminiApiKey.slice(0, 8)}...${settings.geminiApiKey.slice(-4)}`
                : null,
            geminiChatModel,
            availableGeminiChatModels: OPENROUTER_CHAT_MODELS,
        });
    } catch (error) {
        console.error('Failed to fetch settings:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
});

export const PUT = withApiLogging(async (request: Request) => {
    try {
        const body = await request.json();
        const { geminiApiKey, geminiChatModel } = body;

        // Validate API key format (basic check)
        if (geminiApiKey && typeof geminiApiKey === 'string' && geminiApiKey.trim() !== '') {
            // Test the API key by making a simple request to OpenRouter
            const isValid = await validateOpenRouterApiKey(geminiApiKey.trim());

            if (!isValid) {
                return NextResponse.json({
                    error: 'Invalid API key. Please check your OpenRouter key.'
                }, { status: 400 });
            }
        }

        if (
            geminiChatModel !== undefined &&
            (typeof geminiChatModel !== 'string' || geminiChatModel.trim() === '')
        ) {
            return NextResponse.json({
                error: 'Invalid chat model selected.'
            }, { status: 400 });
        }

        const settings = await prisma.settings.findUnique({
            where: { id: 'default' },
            select: { geminiApiKey: true },
        });

        const nextGeminiApiKey =
            geminiApiKey === undefined
                ? settings?.geminiApiKey ?? null
                : geminiApiKey?.trim() || null;

        const nextGeminiChatModel =
            geminiChatModel === undefined
                ? await getStoredChatModel()
                : geminiChatModel;

        const updatedSettings = await prisma.settings.upsert({
            where: { id: 'default' },
            create: {
                id: 'default',
                geminiApiKey: nextGeminiApiKey,
            },
            update: {
                geminiApiKey: nextGeminiApiKey,
            },
        });

        await setStoredChatModel(nextGeminiChatModel);

        return NextResponse.json({
            success: true,
            hasGeminiApiKey: !!updatedSettings.geminiApiKey,
            geminiApiKeyPreview: updatedSettings.geminiApiKey
                ? `${updatedSettings.geminiApiKey.slice(0, 8)}...${updatedSettings.geminiApiKey.slice(-4)}`
                : null,
            geminiChatModel: nextGeminiChatModel,
            availableGeminiChatModels: OPENROUTER_CHAT_MODELS,
        });
    } catch (error) {
        console.error('Failed to update settings:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const responseError = process.env.NODE_ENV === 'development'
            ? `Failed to update settings: ${errorMessage}`
            : 'Failed to update settings';
        return NextResponse.json({ error: responseError }, { status: 500 });
    }
});

// Export the API key getter for use in other modules
export async function getOpenRouterApiKey(): Promise<string | null> {
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

// Validate API key by making a test request to OpenRouter
async function validateOpenRouterApiKey(apiKey: string): Promise<boolean> {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/key', {
            method: 'GET',
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        return response.ok;
    } catch {
        return false;
    }
}
