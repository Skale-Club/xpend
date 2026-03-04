'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, Button, Input } from '@/components/ui';
import { Key, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  // Gemini API Key state
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keyMessage, setKeyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState<string | null>(null);

  // Load existing settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setHasExistingKey(data.hasGeminiApiKey);
      setKeyPreview(data.geminiApiKeyPreview);
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

      setKeyMessage({ type: 'success', text: 'API key saved successfully!' });
      setGeminiApiKey('');
      setHasExistingKey(true);
      setKeyPreview(data.geminiApiKeyPreview);
    } catch (error) {
      setKeyMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save API key'
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
    } catch {
      setKeyMessage({ type: 'error', text: 'Failed to remove API key' });
    } finally {
      setIsSavingKey(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure your spending tracker</p>
      </div>

      {/* Gemini API Key Configuration */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Key className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Google Gemini API Key</h3>
              <p className="text-gray-500 text-sm">
                Configure your Google Gemini API key to process PDF bank statements.
              </p>
            </div>
          </div>

          {hasExistingKey && keyPreview && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-green-700">
                  Key configured: <code className="bg-green-100 px-1 rounded">{keyPreview}</code>
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
              onChange={(e) => setGeminiApiKey(e.target.value)}
              label="New API Key"
            />

            <div className="flex items-center gap-3">
              <Button onClick={handleSaveApiKey} isLoading={isSavingKey}>
                {isSavingKey ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
                Get an API key →
              </a>
            </div>
          </div>

          {keyMessage && (
            <div className={`mt-3 flex items-center gap-2 text-sm ${keyMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
              }`}>
              {keyMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              {keyMessage.text}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Default Categories */}
      <Card>
        <CardContent className="py-6">
          <h3 className="font-semibold text-gray-900 mb-2">Default Categories</h3>
          <p className="text-gray-500 text-sm mb-4">
            Populate the database with default expense and income categories.
          </p>
          <Button onClick={handleSeedCategories} isLoading={isSeeding}>
            Seed Default Categories
          </Button>
          {seedMessage && (
            <p className="mt-3 text-sm text-green-600">{seedMessage}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
