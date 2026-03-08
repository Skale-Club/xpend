import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
    DEFAULT_GEMINI_CHAT_MODEL,
    GEMINI_CHAT_MODELS,
    GEMINI_CHAT_MODEL_VALUES,
} from '@/lib/chat/models';

async function getStoredGeminiChatModel(): Promise<string> {
    try {
        const rows = await prisma.$queryRaw<Array<{ geminiChatModel: string }>>`
            SELECT "geminiChatModel"
            FROM "Settings"
            WHERE "id" = 'default'
            LIMIT 1
        `;

        const model = rows[0]?.geminiChatModel;
        return model && GEMINI_CHAT_MODEL_VALUES.has(model)
            ? model
            : DEFAULT_GEMINI_CHAT_MODEL;
    } catch {
        return DEFAULT_GEMINI_CHAT_MODEL;
    }
}

async function setStoredGeminiChatModel(model: string): Promise<void> {
    await prisma.$executeRaw`
        UPDATE "Settings"
        SET "geminiChatModel" = ${model},
            "updatedAt" = NOW()
        WHERE "id" = 'default'
    `;
}

export async function GET() {
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

        const geminiChatModel = await getStoredGeminiChatModel();

        // Return settings but mask the API key for security
        return NextResponse.json({
            id: settings.id,
            hasGeminiApiKey: !!settings.geminiApiKey,
            geminiApiKeyPreview: settings.geminiApiKey
                ? `${settings.geminiApiKey.slice(0, 8)}...${settings.geminiApiKey.slice(-4)}`
                : null,
            geminiChatModel,
            availableGeminiChatModels: GEMINI_CHAT_MODELS,
        });
    } catch (error) {
        console.error('Failed to fetch settings:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { geminiApiKey, geminiChatModel } = body;

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

        if (geminiChatModel !== undefined && !GEMINI_CHAT_MODEL_VALUES.has(geminiChatModel)) {
            return NextResponse.json({
                error: 'Invalid Gemini chat model selected.'
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
                ? await getStoredGeminiChatModel()
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

        await setStoredGeminiChatModel(nextGeminiChatModel);

        return NextResponse.json({
            success: true,
            hasGeminiApiKey: !!updatedSettings.geminiApiKey,
            geminiApiKeyPreview: updatedSettings.geminiApiKey
                ? `${updatedSettings.geminiApiKey.slice(0, 8)}...${updatedSettings.geminiApiKey.slice(-4)}`
                : null,
            geminiChatModel: nextGeminiChatModel,
            availableGeminiChatModels: GEMINI_CHAT_MODELS,
        });
    } catch (error) {
        console.error('Failed to update settings:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const responseError = process.env.NODE_ENV === 'development'
            ? `Failed to update settings: ${errorMessage}`
            : 'Failed to update settings';
        return NextResponse.json({ error: responseError }, { status: 500 });
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
