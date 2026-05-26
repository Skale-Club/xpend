'use client';

import { useEffect, useState } from 'react';
import { Button, Card, CardContent } from '@/components/ui';
import {
  CheckCircle,
  ChevronUp,
  Copy,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';

const READ_TOOLS = [
  'get_transactions',
  'get_accounts',
  'get_categories',
  'get_subscriptions',
  'get_dashboard_summary',
  'get_category_breakdown',
] as const;

const WRITE_TOOLS = [
  'categorize_transaction',
  'update_transaction_notes',
  'mark_transaction_recurring',
  'categorize_by_description',
  'create_categorization_rule',
] as const;

type ToolName = (typeof READ_TOOLS)[number] | (typeof WRITE_TOOLS)[number];

interface McpTokenRecord {
  id: string;
  name: string;
  tokenPreview: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

function formatDate(iso: string | null) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ToolLabel({ name }: { name: string }) {
  return (
    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">
      {name}
    </span>
  );
}

export default function McpSettings() {
  const [tokens, setTokens] = useState<McpTokenRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [newName, setNewName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<Set<ToolName>>(new Set());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadTokens();
  }, []);

  async function loadTokens() {
    setLoading(true);
    try {
      const res = await fetch('/api/mcp/tokens');
      const data = await res.json();
      setTokens(data.tokens ?? []);
    } catch {
      setTokens([]);
    } finally {
      setLoading(false);
    }
  }

  function togglePerm(tool: ToolName) {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(tool)) next.delete(tool);
      else next.add(tool);
      return next;
    });
  }

  function selectAllRead() {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      READ_TOOLS.forEach((t) => next.add(t));
      return next;
    });
  }

  function selectAllWrite() {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      WRITE_TOOLS.forEach((t) => next.add(t));
      return next;
    });
  }

  async function handleCreate() {
    if (!newName.trim()) {
      setCreateError('Token name is required.');
      return;
    }
    if (selectedPerms.size === 0) {
      setCreateError('Select at least one permission.');
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/mcp/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), permissions: Array.from(selectedPerms) }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create token');

      setFreshToken(data.token);
      setNewName('');
      setSelectedPerms(new Set());
      setShowForm(false);
      await loadTokens();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create token');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setActionLoading(id + ':revoke');
    try {
      await fetch(`/api/mcp/tokens/${id}`, { method: 'DELETE' });
      await loadTokens();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRotate(id: string) {
    setActionLoading(id + ':rotate');
    try {
      const res = await fetch(`/api/mcp/tokens/${id}/rotate`, { method: 'POST' });
      const data = await res.json();
      if (data.token) setFreshToken(data.token);
      await loadTokens();
    } finally {
      setActionLoading(null);
    }
  }

  async function copyToken(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardContent className="py-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-lg bg-violet-100 p-2">
            <ShieldCheck className="h-5 w-5 text-violet-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">MCP Agent Tokens</h3>
            <p className="text-sm text-gray-500">
              Allow AI agents to access Xpend data through controlled token-based connections.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShowForm((v) => !v);
              setCreateError(null);
            }}
          >
            {showForm ? (
              <>
                <ChevronUp className="mr-1 h-4 w-4" /> Cancel
              </>
            ) : (
              <>
                <Plus className="mr-1 h-4 w-4" /> New Token
              </>
            )}
          </Button>
        </div>

        {freshToken && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="mb-1 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Token generated — copy it now, it will not be shown again.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-green-100 p-2 text-xs text-green-900 whitespace-nowrap">
                {freshToken}
              </code>
              <button
                onClick={() => copyToken(freshToken)}
                className="shrink-0 rounded p-1.5 text-green-700 hover:bg-green-100"
                title="Copy token"
              >
                {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-green-700">
              <Link2 className="h-3 w-3" />
              <span>Endpoint: <code className="font-mono">POST https://your-app/api/mcp</code> with <code className="font-mono">Authorization: Bearer {freshToken.slice(0, 20)}...</code></span>
            </div>
            <button
              onClick={() => setFreshToken(null)}
              className="mt-2 text-xs text-green-600 hover:text-green-700"
            >
              Dismiss
            </button>
          </div>
        )}

        {showForm && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="mb-3 text-sm font-semibold text-gray-800">New Token</h4>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Token name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Claude Desktop"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
            </div>

            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700">Read permissions</label>
                <button onClick={selectAllRead} className="text-xs text-violet-600 hover:text-violet-700">
                  Select all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {READ_TOOLS.map((tool) => (
                  <button
                    key={tool}
                    onClick={() => togglePerm(tool)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      selectedPerms.has(tool)
                        ? 'border-violet-400 bg-violet-100 text-violet-800'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {tool}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700">Write permissions</label>
                <button onClick={selectAllWrite} className="text-xs text-violet-600 hover:text-violet-700">
                  Select all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {WRITE_TOOLS.map((tool) => (
                  <button
                    key={tool}
                    onClick={() => togglePerm(tool)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      selectedPerms.has(tool)
                        ? 'border-amber-400 bg-amber-100 text-amber-800'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {tool}
                  </button>
                ))}
              </div>
            </div>

            {createError && (
              <div className="mb-3 flex items-center gap-1.5 text-sm text-red-600">
                <XCircle className="h-4 w-4" />
                {createError}
              </div>
            )}

            <Button onClick={handleCreate} isLoading={creating} size="sm">
              Generate Token
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tokens...
          </div>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-gray-500">No tokens yet. Create one to allow agent access.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {tokens.map((token) => (
              <div key={token.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">{token.name}</span>
                      {token.isActive ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          Revoked
                        </span>
                      )}
                    </div>
                    <code className="mt-0.5 block text-xs text-gray-400">{token.tokenPreview}</code>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {token.permissions.map((p) => (
                        <ToolLabel key={p} name={p} />
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-gray-400">
                      Created {formatDate(token.createdAt)} · Last used {formatDate(token.lastUsedAt)}
                    </p>
                  </div>

                  {token.isActive && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => handleRotate(token.id)}
                        disabled={actionLoading === token.id + ':rotate'}
                        title="Rotate token"
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                      >
                        {actionLoading === token.id + ':rotate' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleRevoke(token.id)}
                        disabled={actionLoading === token.id + ':revoke'}
                        title="Revoke token"
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        {actionLoading === token.id + ':revoke' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
          <div className="flex items-center gap-1.5 font-medium text-gray-700 mb-1">
            <Link2 className="h-3.5 w-3.5" />
            How to connect
          </div>
          <p>Send requests to <code className="font-mono text-gray-700">POST /api/mcp</code> with header <code className="font-mono text-gray-700">Authorization: Bearer &lt;token&gt;</code> and body <code className="font-mono text-gray-700">{"{ \"tool\": \"...\", \"params\": {} }"}</code>.</p>
          <p className="mt-1">Use <code className="font-mono text-gray-700">GET /api/mcp</code> to discover available tools and their parameters.</p>
        </div>
      </CardContent>
    </Card>
  );
}
