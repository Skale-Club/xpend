ALTER TABLE "Settings"
ADD COLUMN IF NOT EXISTS "geminiChatModel" TEXT NOT NULL DEFAULT 'gemini-2.5-flash';
