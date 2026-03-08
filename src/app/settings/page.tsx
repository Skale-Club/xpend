'use client';

import { useEffect, useState } from 'react';
import { Button, Card, CardContent, Input, Select } from '@/components/ui';
import { CheckCircle, Key, Loader2, XCircle } from 'lucide-react';

const MASKED_KEY = '*'.repeat(30);

export default function SettingsPage() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keyMessage, setKeyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState<string | null>(null);

  const [geminiChatModel, setGeminiChatModel] = useState('gemini-2.5-flash');
  const [modelOptions, setModelOptions] = useState<{ value: string; label: string }[]>([
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (Preview)' },
  ]);
  const [isSavingModel, setIsSavingModel] = useState(false);
  const [modelMessage, setModelMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();

      setHasExistingKey(Boolean(data.hasGeminiApiKey));
      setKeyPreview(data.geminiApiKeyPreview || null);
      if (data.hasGeminiApiKey) {
        setGeminiApiKey(MASKED_KEY);
      }

      setGeminiChatModel(data.geminiChatModel || 'gemini-2.5-flash');
      if (Array.isArray(data.availableGeminiChatModels) && data.availableGeminiChatModels.length > 0) {
        setModelOptions(data.availableGeminiChatModels);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSeedCategories = async () => {
    setIsSeeding(true);
    setSeedMessage(null);
    try {
      const res = await fetch('/api/categories/seed', { method: 'POST' });
      const data = await res.json();
      setSeedMessage(data.message || `Seeded ${data.count} categories`);
    } catch {
      setSeedMessage('Failed to seed categories');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (geminiApiKey === MASKED_KEY) {
      setKeyMessage({ type: 'success', text: 'API key is already saved.' });
      return;
    }

    if (!geminiApiKey.trim()) {
      setKeyMessage({ type: 'error', text: 'Please enter a valid API key.' });
      return;
    }

    setIsSavingKey(true);
    setKeyMessage(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: geminiApiKey.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save API key');
      }

      setKeyMessage({ type: 'success', text: 'API key saved successfully.' });
      setHasExistingKey(true);
      setKeyPreview(data.geminiApiKeyPreview || null);
      setGeminiApiKey(MASKED_KEY);
    } catch (error) {
      setKeyMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save API key',
      });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleClearApiKey = async () => {
    setIsSavingKey(true);
    setKeyMessage(null);

    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: null }),
      });

      setKeyMessage({ type: 'success', text: 'API key removed.' });
      setHasExistingKey(false);
      setKeyPreview(null);
      setGeminiApiKey('');
    } catch {
      setKeyMessage({ type: 'error', text: 'Failed to remove API key' });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleSaveModel = async () => {
    if (!geminiChatModel) {
      setModelMessage({ type: 'error', text: 'Please select a model.' });
      return;
    }

    setIsSavingModel(true);
    setModelMessage(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiChatModel }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save model');
      }

      setGeminiChatModel(data.geminiChatModel || geminiChatModel);
      setModelMessage({ type: 'success', text: 'Chat model saved successfully.' });
    } catch (error) {
      setModelMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save model',
      });
    } finally {
      setIsSavingModel(false);
    }
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (hasExistingKey && geminiApiKey === MASKED_KEY && !value.includes(MASKED_KEY)) {
      setGeminiApiKey(value.replace(/\*/g, ''));
      return;
    }
    setGeminiApiKey(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-gray-500">Configure your spending tracker</p>
      </div>

      <Card>
        <CardContent className="py-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Key className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Google Gemini</h3>
              <p className="text-sm text-gray-500">
                Configure API key and default chat model.
              </p>
            </div>
          </div>

          {hasExistingKey && keyPreview && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm text-green-700">
                  Key configured: <code className="rounded bg-green-100 px-1">{keyPreview}</code>
                </span>
              </div>
              <button
                onClick={handleClearApiKey}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          )}

          <div className="space-y-3">
            <Input
              type="password"
              placeholder="AIzaSy..."
              value={geminiApiKey}
              onChange={handleApiKeyChange}
              label={hasExistingKey ? 'Update API Key' : 'New API Key'}
            />

            <div className="flex items-center gap-3">
              <Button onClick={handleSaveApiKey} isLoading={isSavingKey}>
                {isSavingKey ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Save Key'
                )}
              </Button>

              <a
                href="https://makersuite.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Get an API key
              </a>
            </div>
          </div>

          {keyMessage && (
            <div className={`mt-3 flex items-center gap-2 text-sm ${keyMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {keyMessage.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {keyMessage.text}
            </div>
          )}

          <div className="mt-5 border-t border-gray-100 pt-4">
            <Select
              label="Default Chat Model"
              value={geminiChatModel}
              onChange={(e) => setGeminiChatModel(e.target.value)}
              options={modelOptions}
            />

            <div className="mt-3">
              <Button onClick={handleSaveModel} isLoading={isSavingModel}>
                {isSavingModel ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Model...
                  </>
                ) : (
                  'Save Model'
                )}
              </Button>
            </div>

            {modelMessage && (
              <div className={`mt-3 flex items-center gap-2 text-sm ${modelMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {modelMessage.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {modelMessage.text}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <h3 className="mb-2 font-semibold text-gray-900">Default Categories</h3>
          <p className="mb-4 text-sm text-gray-500">
            Populate the database with default expense and income categories.
          </p>
          <Button onClick={handleSeedCategories} isLoading={isSeeding}>
            Seed Default Categories
          </Button>
          {seedMessage && <p className="mt-3 text-sm text-green-600">{seedMessage}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
