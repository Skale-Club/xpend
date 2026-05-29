'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, Check, Clock, AlertCircle, Calendar, Trash2, Loader2, Sparkles, ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';

interface ExistingStatement {
  id?: string;
  month: number;
  year: number;
  uploadedAt?: string | Date;
  fileName?: string;
  hasTransactions?: boolean;
  uncategorizedCount?: number;
  aiCategorized?: boolean;
}

interface TimelineUploadProps {
  accountId: string;
  year: number;
  existingStatements: ExistingStatement[];
  onUpload: (month: number, year: number, file: File) => Promise<void>;
  onDelete?: (statementId: string) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
  openingMonth?: number | null;
  openingYear?: number | null;
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error' | 'incomplete';

interface MonthStatus {
  month: number;
  status: UploadStatus;
  statement?: ExistingStatement;
  isCurrentMonth: boolean;
  isPast: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_ABBREV = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function TimelineUpload({ year, existingStatements, onUpload, onDelete, onRefresh, openingMonth, openingYear }: TimelineUploadProps) {
  const [monthStatuses, setMonthStatuses] = useState<Record<number, MonthStatus>>({});
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [uploadingMonth, setUploadingMonth] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Which month is currently being AI-categorized, plus its live progress.
  const [categorizingMonth, setCategorizingMonth] = useState<number | null>(null);
  const [categorizeProgress, setCategorizeProgress] = useState<{ processed: number; total: number; categorizedCount: number } | null>(null);

  // Calculate current month and year
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  // First visible month for the displayed year: hide months before the account
  // opening in the opening year; all other years start at January.
  const firstMonth = openingYear != null && year === openingYear ? (openingMonth ?? 1) : 1;

  useEffect(() => {
    setMonthStatuses((prevStatuses) => {
      const updated: Record<number, MonthStatus> = {};
      for (let month = firstMonth; month <= 12; month++) {
        const statement = existingStatements.find(
          (s) => s.month === month && s.year === year
        );

        const isCurrentMonth = month === currentMonth && year === currentYear;
        const isPast = year < currentYear || (year === currentYear && month < currentMonth);

        let status: UploadStatus = 'idle';

        // Don't override uploading status when data updates
        const currentStatus = prevStatuses[month]?.status;
        const prevStatement = prevStatuses[month]?.statement;

        if (currentStatus === 'uploading') {
          // Keep uploading status during upload
          status = 'uploading';
        } else if (statement) {
          // Statement exists - check if it has transactions
          status = statement.hasTransactions === false ? 'incomplete' : 'success';
        } else if (currentStatus === 'success' && prevStatement && !statement) {
          // Keep success status briefly if statement was just uploaded but not yet in existingStatements
          // This prevents red flash during data refresh
          status = 'success';
        } else if (isPast && !statement) {
          // Only mark as incomplete if it's a past month AND no statement exists
          status = 'incomplete';
        }

        updated[month] = {
          month,
          status,
          statement,
          isCurrentMonth,
          isPast,
        };
      }
      return updated;
    });
  }, [existingStatements, year, currentMonth, currentYear, firstMonth]);

  const goToMonth = useCallback((delta: number) => {
    setSelectedMonth((m) => {
      if (m === null) return m;
      const next = m + delta;
      return next >= firstMonth && next <= 12 ? next : m;
    });
  }, [firstMonth]);

  useEffect(() => {
    if (selectedMonth === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedMonth(null);
      else if (e.key === 'ArrowLeft') goToMonth(-1);
      else if (e.key === 'ArrowRight') goToMonth(1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = 'unset';
    };
  }, [selectedMonth, goToMonth]);

  const handleFileSelect = useCallback(
    async (month: number, file: File) => {
      setUploadingMonth(month);
      setUploadProgress(0);
      setMonthStatuses((prev) => ({
        ...prev,
        [month]: { ...prev[month], status: 'uploading' },
      }));

      // Simulate progress with intervals
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) return prev; // Cap at 90% until complete
          return prev + Math.random() * 15; // Random increment
        });
      }, 500);

      try {
        await onUpload(month, year, file);
        // Set to 100% when complete
        setUploadProgress(100);
        clearInterval(progressInterval);
        // Don't manually set success - let useEffect handle it when existingStatements updates
      } catch (error) {
        clearInterval(progressInterval);
        setUploadProgress(0);
        setMonthStatuses((prev) => ({
          ...prev,
          [month]: { ...prev[month], status: 'error' },
        }));
        console.error('Upload failed:', error);
      } finally {
        // Clear after a short delay to show 100%
        setTimeout(() => {
          setUploadingMonth(null);
          setUploadProgress(0);
        }, 500);
      }
    },
    [year, onUpload]
  );

  const handleDelete = async () => {
    const statement = monthStatuses[selectedMonth!]?.statement;
    if (!statement || !onDelete) return;

    if (!confirm('Are you sure you want to delete this statement and all its transactions?')) return;

    setIsDeleting(true);
    try {
      await onDelete(statement.id as string);
      setMonthStatuses((prev) => ({
        ...prev,
        [selectedMonth!]: {
          ...prev[selectedMonth!],
          status: 'idle',
          statement: undefined,
        },
      }));
      setSelectedMonth(null);
    } catch (error) {
      console.error('Failed to delete statement:', error);
      alert('Failed to delete statement');
    } finally {
      setIsDeleting(false);
    }
  };

  // Stream AI categorization for a single month and drive a live progress bar.
  // Reads NDJSON events (start / progress / done / error) from the endpoint.
  const runCategorize = useCallback(async (month: number) => {
    if (categorizingMonth !== null) return; // one at a time
    const statement = monthStatuses[month]?.statement;
    if (!statement?.id) return;

    setCategorizingMonth(month);
    setCategorizeProgress({ processed: 0, total: statement.uncategorizedCount ?? 0, categorizedCount: 0 });

    try {
      const res = await fetch(`/api/statements/${statement.id}/categorize`, {
        method: 'POST',
      });

      if (!res.ok || !res.body) {
        throw new Error('Failed to categorize');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) continue;

          const event = JSON.parse(line) as
            | { type: 'start'; total: number }
            | { type: 'progress'; processed: number; total: number; categorizedCount: number }
            | { type: 'done'; categorizedCount: number; total: number }
            | { type: 'error'; message: string };

          if (event.type === 'start') {
            setCategorizeProgress({ processed: 0, total: event.total, categorizedCount: 0 });
          } else if (event.type === 'progress') {
            setCategorizeProgress({ processed: event.processed, total: event.total, categorizedCount: event.categorizedCount });
          } else if (event.type === 'error') {
            throw new Error(event.message);
          }
        }
      }

      // Refresh so the new uncategorized count / aiCategorized flag is reflected.
      await onRefresh?.();
    } catch (error) {
      console.error('Failed to auto-categorize:', error);
    } finally {
      setCategorizingMonth(null);
      setCategorizeProgress(null);
    }
  }, [categorizingMonth, monthStatuses, onRefresh]);

  const getStatusStyles = (monthData: MonthStatus) => {
    const { status, isCurrentMonth } = monthData;

    // Base styles
    let baseStyles = 'relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer min-h-[100px] ';

    if (isCurrentMonth) {
      // Current month - always highlighted with blue ring
      baseStyles += 'ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-2 ring-offset-background ';
    }

    switch (status) {
      case 'success':
        // Green - uploaded and complete
        return baseStyles + 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40';
      case 'uploading':
        return baseStyles + 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800';
      case 'error':
        return baseStyles + 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
      case 'incomplete':
        // Red - missing information
        return baseStyles + 'bg-rose-50 dark:bg-rose-950/25 border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/40';
      default:
        // Idle - future month or not yet uploaded
        return baseStyles + 'bg-muted border-border hover:bg-muted hover:border-border';
    }
  };

  const getStatusIcon = (status: UploadStatus) => {
    switch (status) {
      case 'success':
        return <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />;
      case 'uploading':
        return <div className="w-6 h-6 border-2 border-blue-500 dark:border-blue-400 border-t-transparent rounded-full animate-spin" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-500 dark:text-red-400" />;
      case 'incomplete':
        return <AlertCircle className="w-6 h-6 text-rose-500 dark:text-rose-400" />;
      default:
        return <Clock className="w-6 h-6 text-muted-foreground/40" />;
    }
  };

  const getStatusLabel = (status: UploadStatus, isCurrentMonth: boolean) => {
    switch (status) {
      case 'success':
        return 'Uploaded';
      case 'uploading':
        return 'Uploading...';
      case 'error':
        return 'Error';
      case 'incomplete':
        return 'Missing info';
      default:
        return isCurrentMonth ? 'Current' : 'Pending';
    }
  };

  return (
    <div className="space-y-6">
      {/* Current month indicator */}
      <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200 bg-blue-50 dark:bg-muted px-4 py-2 rounded-lg border border-blue-100 dark:border-border">
        <Calendar className="w-4 h-4 text-blue-500 dark:text-blue-400" />
        <span>
          <strong>Current month:</strong> {MONTH_NAMES[currentMonth - 1]} {currentYear}
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800" />
          <span className="text-muted-foreground">Uploaded and complete</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-rose-50 dark:bg-rose-950/25 border-2 border-rose-200 dark:border-rose-900" />
          <span className="text-muted-foreground">Missing info</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted border-2 border-border" />
          <span className="text-muted-foreground">Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-50 dark:bg-muted border-2 border-blue-200 dark:border-border ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-1 ring-offset-background" />
          <span className="text-muted-foreground">Current month</span>
        </div>
      </div>

      {/* Month grid */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 - firstMonth + 1 }, (_, i) => i + firstMonth).map((month) => {
              const monthData = monthStatuses[month];
              if (!monthData) return null;

              return (
                <div
                  key={month}
                  className={getStatusStyles(monthData)}
                  onClick={() => monthData.status !== 'uploading' && setSelectedMonth(selectedMonth === month ? null : month)}
                >
                  {/* Current month badge */}
                  {monthData.isCurrentMonth && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <Calendar className="w-3 h-3 text-white" />
                    </div>
                  )}

                  {/* Status icon */}
                  <div className="mb-2">
                    {getStatusIcon(monthData.status)}
                  </div>

                  {/* Month name */}
                  <span className="font-semibold text-foreground text-sm">
                    {MONTH_ABBREV[month - 1]}
                  </span>

                  {/* Status label */}
                  <span className={`text-xs mt-1 ${monthData.status === 'success' ? 'text-emerald-700 dark:text-emerald-400' :
                    monthData.status === 'incomplete' ? 'text-rose-600 dark:text-rose-400' :
                      monthData.status === 'error' ? 'text-red-600 dark:text-red-400' :
                        'text-muted-foreground'
                    }`}>
                    {getStatusLabel(monthData.status, monthData.isCurrentMonth)}
                  </span>

                  {/* AI categorization status — shown once the month has transactions */}
                  {monthData.statement?.hasTransactions && (() => {
                    const stmt = monthData.statement;
                    const uncategorized = stmt.uncategorizedCount ?? 0;

                    // Live progress while this month is being categorized.
                    if (categorizingMonth === month) {
                      const total = categorizeProgress?.total ?? uncategorized;
                      const processed = categorizeProgress?.processed ?? 0;
                      const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
                      return (
                        <div className="mt-1.5 w-full px-1" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                            <Sparkles className="w-2.5 h-2.5 animate-pulse" />
                            {processed}/{total}
                          </div>
                          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950/50">
                            <div
                              className="h-full rounded-full bg-violet-500 transition-all duration-300 ease-out"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    }

                    // Already categorized with AI.
                    if (stmt.aiCategorized) {
                      return (
                        <span
                          className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-950/50 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300"
                          title="Transactions categorized with AI"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          AI
                          <Check className="w-2.5 h-2.5" />
                        </span>
                      );
                    }

                    // Not categorized yet, but there's something to do → clickable button.
                    if (uncategorized > 0) {
                      return (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            runCategorize(month);
                          }}
                          disabled={categorizingMonth !== null}
                          title={`Categorize ${uncategorized} transaction${uncategorized === 1 ? '' : 's'} with AI`}
                          className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300 transition-colors hover:bg-violet-100 dark:hover:bg-violet-900/50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          Categorize
                        </button>
                      );
                    }

                    // Nothing left to categorize, but AI was never run.
                    return (
                      <span
                        className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                        title="No uncategorized transactions"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        No AI
                      </span>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upload popup for selected month */}
      {selectedMonth && monthStatuses[selectedMonth] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedMonth(null)}
        >
          <div
            className="flex w-full max-w-xl max-h-[90vh] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with prev / title / next / close */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <button
                onClick={() => goToMonth(-1)}
                disabled={selectedMonth === firstMonth}
                aria-label="Previous month"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="flex-1 text-center">
                <h3 className="text-lg font-semibold text-foreground">
                  {MONTH_NAMES[selectedMonth - 1]} {year}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {monthStatuses[selectedMonth].statement?.uploadedAt
                    ? `Uploaded on ${new Date(monthStatuses[selectedMonth].statement!.uploadedAt!).toLocaleDateString()}`
                    : 'No file uploaded'}
                </p>
              </div>

              <button
                onClick={() => goToMonth(1)}
                disabled={selectedMonth === 12}
                aria-label="Next month"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              <button
                onClick={() => setSelectedMonth(null)}
                aria-label="Close"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-5">
            {monthStatuses[selectedMonth].statement?.fileName && (
              <div className="mb-4 space-y-3">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    <strong>File:</strong> {monthStatuses[selectedMonth].statement?.fileName}
                  </p>
                  {onDelete && (
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                      {isDeleting ? 'Removing...' : 'Remove'}
                    </button>
                  )}
                </div>

                {/* Large AI-categorized marker */}
                {monthStatuses[selectedMonth].statement?.aiCategorized && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-violet-500">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-violet-800 dark:text-violet-300">Categorized with AI</p>
                      <p className="text-xs text-violet-600 dark:text-violet-400/80">
                        Transactions in this statement were categorized using AI.
                      </p>
                    </div>
                  </div>
                )}

                {/* Auto-categorize: only offered while there are still
                    uncategorized transactions to act on. It's a one-time-per-upload
                    action, so once everything is categorized we show a done state
                    instead of the button. Hidden entirely until the upload has
                    produced transactions. */}
                {(() => {
                  const stmt = monthStatuses[selectedMonth].statement;
                  const uncategorized = stmt?.uncategorizedCount ?? 0;
                  if (!stmt?.hasTransactions) return null;

                  const isRunning = categorizingMonth === selectedMonth;

                  // Live progress while categorizing this month.
                  if (isRunning) {
                    const total = categorizeProgress?.total ?? uncategorized;
                    const processed = categorizeProgress?.processed ?? 0;
                    const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-violet-700 dark:text-violet-300">
                          <span className="flex items-center gap-2 font-medium">
                            <Sparkles className="w-4 h-4 animate-pulse" />
                            Categorizing with AI…
                          </span>
                          <span className="tabular-nums">{processed}/{total}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950/50">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 ease-out"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  }

                  if (uncategorized > 0) {
                    return (
                      <>
                        <button
                          onClick={() => runCategorize(selectedMonth)}
                          disabled={categorizingMonth !== null}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span className="font-medium">Auto-categorize with AI</span>
                        </button>
                        <p className="text-xs text-muted-foreground text-center">
                          {uncategorized} uncategorized transaction{uncategorized === 1 ? '' : 's'} — categorize with AI
                        </p>
                      </>
                    );
                  }

                  return (
                    <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-300">
                      <Check className="w-4 h-4" />
                      <span className="font-medium">All transactions categorized</span>
                    </div>
                  );
                })()}
              </div>
            )}

            {monthStatuses[selectedMonth].status !== 'uploading' && (
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept=".csv,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileSelect(selectedMonth, file);
                    }
                    e.target.value = '';
                  }}
                />
                <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-lg hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-muted-foreground font-medium">
                    {monthStatuses[selectedMonth].status === 'success'
                      ? 'Re-upload file'
                      : 'Upload statement'}
                  </span>
                </div>
              </label>
            )}

            {uploadingMonth === selectedMonth && (
              <div className="space-y-4">
                {/* Keep-open note */}
                <div className="flex items-start gap-3 p-4 bg-muted/50 border border-border rounded-lg">
                  <Loader2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5 animate-spin" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Keep this page open</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      We&apos;re reading your statement. This usually takes just a few seconds.
                    </p>
                  </div>
                </div>

                {/* Progress steps */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${uploadProgress < 30 ? 'bg-primary' : 'bg-success'}`}>
                      {uploadProgress < 30 ? (
                        <div className="w-2 h-2 bg-card rounded-full animate-pulse" />
                      ) : (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <span className={`text-sm ${uploadProgress < 30 ? 'font-medium text-blue-700 dark:text-blue-400' : 'text-green-700 dark:text-green-400'}`}>
                      {uploadProgress < 30 ? 'Uploading file...' : 'File uploaded'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${uploadProgress < 30 ? 'bg-muted' : uploadProgress < 70 ? 'bg-primary' : 'bg-success'}`}>
                      {uploadProgress < 30 ? (
                        <div className="w-2 h-2 bg-muted-foreground/40 rounded-full" />
                      ) : uploadProgress < 70 ? (
                        <div className="w-2 h-2 bg-card rounded-full animate-pulse" />
                      ) : (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <span className={`text-sm ${uploadProgress < 30 ? 'text-muted-foreground' : uploadProgress < 70 ? 'font-medium text-blue-700 dark:text-blue-400' : 'text-green-700 dark:text-green-400'}`}>
                      {uploadProgress < 70 ? 'Reading transactions...' : 'Transactions read'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${uploadProgress < 70 ? 'bg-muted' : uploadProgress < 100 ? 'bg-primary' : 'bg-success'}`}>
                      {uploadProgress < 70 ? (
                        <div className="w-2 h-2 bg-muted-foreground/40 rounded-full" />
                      ) : uploadProgress < 100 ? (
                        <div className="w-2 h-2 bg-card rounded-full animate-pulse" />
                      ) : (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <span className={`text-sm ${uploadProgress < 70 ? 'text-muted-foreground' : uploadProgress < 100 ? 'font-medium text-blue-700 dark:text-blue-400' : 'text-green-700 dark:text-green-400'}`}>
                      {uploadProgress < 100 ? 'Saving transactions...' : 'Transactions saved'}
                    </span>
                  </div>
                </div>

                {/* Real progress bar */}
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                  />
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  {uploadProgress < 100 ? (
                    <>Processing your statement…</>
                  ) : (
                    <>Done! Finalizing…</>
                  )}
                </p>
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface TimelineYearSelectorProps {
  years: number[];
  selectedYear: number;
  onSelectYear: (year: number) => void;
  disabled?: boolean;
}

export function TimelineYearSelector({
  years,
  selectedYear,
  onSelectYear,
  disabled = false,
}: TimelineYearSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // years is expected highest → lowest. Derive bounds for the step arrows.
  const lowerYear = years.length ? years[years.length - 1] : selectedYear;
  const upperYear = years.length ? years[0] : selectedYear;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-input bg-card p-1 shadow-sm">
      <button
        onClick={() => onSelectYear(selectedYear - 1)}
        disabled={disabled || selectedYear <= lowerYear}
        aria-label="Previous year"
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="relative" ref={containerRef}>
        <button
          onClick={() => setOpen((prev) => !prev)}
          disabled={disabled}
          aria-label="Select year"
          className="flex h-8 min-w-[5rem] items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {selectedYear}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>

        {open && (
          <div className="absolute left-1/2 z-50 mt-1 max-h-64 -translate-x-1/2 overflow-y-auto rounded-lg border border-input bg-card py-1 shadow-lg">
            {years.map((year) => (
              <button
                key={year}
                onClick={() => {
                  onSelectYear(year);
                  setOpen(false);
                }}
                className={`block w-full px-5 py-1.5 text-center text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${year === selectedYear ? 'bg-accent font-semibold text-accent-foreground' : 'text-foreground'
                  }`}
              >
                {year}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => onSelectYear(selectedYear + 1)}
        disabled={disabled || selectedYear >= upperYear}
        aria-label="Next year"
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
