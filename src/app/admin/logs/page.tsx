'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, Input, Pagination, PageHeader, Badge, Loader } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';

interface ApiLog {
  id: string;
  createdAt: string;
  level: string;
  category: string;
  method: string | null;
  path: string | null;
  status: number | null;
  durationMs: number | null;
  message: string | null;
  metadata: unknown;
  error: string | null;
  userEmail: string | null;
}

interface LogsResponse {
  logs: ApiLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  counts: Record<string, number>;
}

const LEVELS = ['ALL', 'INFO', 'WARN', 'ERROR'] as const;
const CATEGORIES = ['ALL', 'api', 'statement_parse', 'ai_call'] as const;
const PAGE_SIZE = 50;

function levelVariant(level: string): 'secondary' | 'warning' | 'destructive' {
  if (level === 'ERROR') return 'destructive';
  if (level === 'WARN') return 'warning';
  return 'secondary';
}

function statusClass(status: number | null): string {
  if (status == null) return 'text-muted-foreground';
  if (status >= 500) return 'text-destructive';
  if (status >= 400) return 'text-warning';
  if (status >= 200 && status < 300) return 'text-success';
  return 'text-foreground';
}

export default function AdminLogsPage() {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [level, setLevel] = useState<string>('ALL');
  const [category, setCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to first page whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [level, category, debouncedSearch]);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (level !== 'ALL') params.set('level', level);
      if (category !== 'ALL') params.set('category', category);
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));

      const res = await fetch(`/api/admin/logs?${params}`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const json: LogsResponse = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [level, category, debouncedSearch, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const toggleRow = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const counts = data?.counts ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Logs"
        description="Server-side request, parsing, and AI activity captured across the app."
        action={
          <button
            type="button"
            onClick={() => fetchLogs()}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Refresh
          </button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-4 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Search</label>
            <Input
              placeholder="Search path, message, or error…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Level</label>
            <div className="flex gap-1">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    level === l
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted',
                  )}
                >
                  {l === 'ALL' ? 'All' : l}
                  {l !== 'ALL' && counts[l] != null && (
                    <span className="ml-1.5 text-xs opacity-70">{counts[l]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Category</label>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    category === c
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted',
                  )}
                >
                  {c === 'ALL' ? 'All' : c}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log table */}
      <Card>
        <CardContent className="p-0">
          {isLoading && !data ? (
            <div className="flex justify-center py-16">
              <Loader />
            </div>
          ) : !data || data.logs.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No logs found.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.logs.map((log) => {
                const isOpen = expanded.has(log.id);
                const hasDetail = !!log.error || (log.metadata != null);
                return (
                  <div key={log.id}>
                    <button
                      type="button"
                      onClick={() => hasDetail && toggleRow(log.id)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm',
                        hasDetail ? 'cursor-pointer hover:bg-muted/50' : 'cursor-default',
                      )}
                    >
                      <span className="w-4 flex-shrink-0 text-muted-foreground">
                        {hasDetail ? (
                          isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                        ) : null}
                      </span>

                      <span className="w-16 flex-shrink-0">
                        <Badge variant={levelVariant(log.level)}>{log.level}</Badge>
                      </span>

                      <span className="w-40 flex-shrink-0 font-mono text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>

                      <span className="w-14 flex-shrink-0 font-mono text-xs text-muted-foreground">
                        {log.method ?? '—'}
                      </span>

                      <span className={cn('w-12 flex-shrink-0 font-mono text-xs font-semibold', statusClass(log.status))}>
                        {log.status ?? '—'}
                      </span>

                      <span className="flex-1 truncate font-mono text-xs text-foreground">
                        {log.path ?? log.message ?? '—'}
                      </span>

                      <span className="w-20 flex-shrink-0 text-right font-mono text-xs text-muted-foreground">
                        {log.durationMs != null ? `${log.durationMs}ms` : ''}
                      </span>

                      <span className="hidden w-32 flex-shrink-0 truncate text-right text-xs text-muted-foreground lg:block">
                        {log.category}
                      </span>
                    </button>

                    {isOpen && hasDetail && (
                      <div className="space-y-3 bg-muted/30 px-4 py-3 pl-11 text-xs">
                        {log.message && (
                          <div>
                            <p className="mb-1 font-semibold text-muted-foreground">Message</p>
                            <p className="text-foreground">{log.message}</p>
                          </div>
                        )}
                        {log.userEmail && (
                          <div>
                            <p className="mb-1 font-semibold text-muted-foreground">User</p>
                            <p className="font-mono text-foreground">{log.userEmail}</p>
                          </div>
                        )}
                        {log.metadata != null && (
                          <div>
                            <p className="mb-1 font-semibold text-muted-foreground">Metadata</p>
                            <pre className="overflow-x-auto rounded-lg border border-border bg-card p-3 font-mono text-[11px] text-foreground">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.error && (
                          <div>
                            <p className="mb-1 font-semibold text-destructive">Error</p>
                            <pre className="overflow-x-auto rounded-lg border border-destructive/20 bg-destructive/5 p-3 font-mono text-[11px] text-destructive">
                              {log.error}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.total > PAGE_SIZE && (
        <Pagination
          currentPage={page}
          totalCount={data.total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
