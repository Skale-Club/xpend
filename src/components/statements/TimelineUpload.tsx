'use client';

import { useState, useCallback, useEffect } from 'react';
import { Upload, Check, Clock, AlertCircle, Calendar, FileText, Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';

interface ExistingStatement {
  id?: string;
  month: number;
  year: number;
  uploadedAt?: string | Date;
  fileName?: string;
  hasTransactions?: boolean;
}

interface TimelineUploadProps {
  accountId: string;
  year: number;
  existingStatements: ExistingStatement[];
  onUpload: (month: number, year: number, file: File) => Promise<void>;
  onDelete?: (statementId: string) => Promise<void>;
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

export function TimelineUpload({ accountId, year, existingStatements, onUpload, onDelete }: TimelineUploadProps) {
  const [monthStatuses, setMonthStatuses] = useState<Record<number, MonthStatus>>({});
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [uploadingMonth, setUploadingMonth] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Calculate current month and year
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  useEffect(() => {
    setMonthStatuses((prevStatuses) => {
      const updated: Record<number, MonthStatus> = {};
      for (let month = 1; month <= 12; month++) {
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
  }, [existingStatements, year, currentMonth, currentYear]);

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

  const getStatusStyles = (monthData: MonthStatus) => {
    const { status, isCurrentMonth, isPast } = monthData;

    // Base styles
    let baseStyles = 'relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer min-h-[100px] ';

    if (isCurrentMonth) {
      // Current month - always highlighted with blue ring
      baseStyles += 'ring-2 ring-blue-400 ring-offset-2 ';
    }

    switch (status) {
      case 'success':
        // Green - uploaded and complete
        return baseStyles + 'bg-green-100 border-green-400 hover:bg-green-200';
      case 'uploading':
        return baseStyles + 'bg-blue-100 border-blue-400';
      case 'error':
        return baseStyles + 'bg-red-100 border-red-400';
      case 'incomplete':
        // Red - missing information
        return baseStyles + 'bg-red-50 border-red-300 hover:bg-red-100';
      default:
        // Idle - future month or not yet uploaded
        return baseStyles + 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300';
    }
  };

  const getStatusIcon = (status: UploadStatus) => {
    switch (status) {
      case 'success':
        return <Check className="w-6 h-6 text-green-600" />;
      case 'uploading':
        return <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      case 'incomplete':
        return <AlertCircle className="w-6 h-6 text-red-400" />;
      default:
        return <Clock className="w-6 h-6 text-gray-300" />;
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
      <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
        <Calendar className="w-4 h-4 text-blue-500" />
        <span>
          <strong>Current month:</strong> {MONTH_NAMES[currentMonth - 1]} {currentYear}
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-100 border-2 border-green-400" />
          <span className="text-gray-600">Uploaded and complete</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-50 border-2 border-red-300" />
          <span className="text-gray-600">Missing info</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-50 border-2 border-gray-200" />
          <span className="text-gray-600">Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-50 border-2 border-blue-200 ring-2 ring-blue-400 ring-offset-1" />
          <span className="text-gray-600">Current month</span>
        </div>
      </div>

      {/* Month grid */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
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
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <Calendar className="w-3 h-3 text-white" />
                    </div>
                  )}

                  {/* Status icon */}
                  <div className="mb-2">
                    {getStatusIcon(monthData.status)}
                  </div>

                  {/* Month name */}
                  <span className="font-semibold text-gray-800 text-sm">
                    {MONTH_ABBREV[month - 1]}
                  </span>

                  {/* Status label */}
                  <span className={`text-xs mt-1 ${monthData.status === 'success' ? 'text-green-600' :
                    monthData.status === 'incomplete' ? 'text-red-500' :
                      monthData.status === 'error' ? 'text-red-600' :
                        'text-gray-400'
                    }`}>
                    {getStatusLabel(monthData.status, monthData.isCurrentMonth)}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upload panel for selected month */}
      {selectedMonth && monthStatuses[selectedMonth] && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {MONTH_NAMES[selectedMonth - 1]} {year}
                </h3>
                <p className="text-sm text-gray-500">
                  {monthStatuses[selectedMonth].statement?.uploadedAt
                    ? `Uploaded on ${new Date(monthStatuses[selectedMonth].statement!.uploadedAt!).toLocaleDateString()}`
                    : 'No file uploaded'}
                </p>
              </div>
              <button
                onClick={() => setSelectedMonth(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {monthStatuses[selectedMonth].statement?.fileName && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                <p className="text-sm text-green-700">
                  <strong>File:</strong> {monthStatuses[selectedMonth].statement?.fileName}
                </p>
                {onDelete && (
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isDeleting ? 'Removing...' : 'Remove'}
                  </button>
                )}
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
                <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <Upload className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-600 font-medium">
                    {monthStatuses[selectedMonth].status === 'success'
                      ? 'Re-upload file'
                      : 'Upload statement'}
                  </span>
                </div>
              </label>
            )}

            {uploadingMonth === selectedMonth && (
              <div className="space-y-4">
                {/* Warning not to refresh */}
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Please do not refresh or close this page</p>
                    <p className="text-xs text-amber-600 mt-1">
                      PDF processing with AI can take up to 2 minutes. The page will automatically update when complete.
                    </p>
                  </div>
                </div>

                {/* Progress steps */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${uploadProgress < 30 ? 'bg-blue-500' : 'bg-green-500'}`}>
                      {uploadProgress < 30 ? (
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      ) : (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <span className={`text-sm ${uploadProgress < 30 ? 'font-medium text-blue-700' : 'text-green-700'}`}>
                      {uploadProgress < 30 ? 'Uploading file...' : 'File uploaded'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${uploadProgress < 30 ? 'bg-gray-200' : uploadProgress < 70 ? 'bg-blue-500' : 'bg-green-500'}`}>
                      {uploadProgress < 30 ? (
                        <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      ) : uploadProgress < 70 ? (
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      ) : (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <span className={`text-sm ${uploadProgress < 30 ? 'text-gray-500' : uploadProgress < 70 ? 'font-medium text-blue-700' : 'text-green-700'}`}>
                      {uploadProgress < 70 ? 'Parsing with AI...' : 'Parsing complete'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${uploadProgress < 70 ? 'bg-gray-200' : uploadProgress < 100 ? 'bg-blue-500' : 'bg-green-500'}`}>
                      {uploadProgress < 70 ? (
                        <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      ) : uploadProgress < 100 ? (
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      ) : (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <span className={`text-sm ${uploadProgress < 70 ? 'text-gray-500' : uploadProgress < 100 ? 'font-medium text-blue-700' : 'text-green-700'}`}>
                      {uploadProgress < 100 ? 'Saving transactions...' : 'Transactions saved'}
                    </span>
                  </div>
                </div>

                {/* Real progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                  />
                </div>

                <p className="text-xs text-gray-500 text-center">
                  {uploadProgress < 100 ? (
                    <>Processing... {Math.round(uploadProgress)}% complete (this may take 30-120 seconds)</>
                  ) : (
                    <>Upload complete! Finalizing...</>
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface TimelineYearSelectorProps {
  years: number[];
  selectedYear: number;
  onSelectYear: (year: number) => void;
}

export function TimelineYearSelector({ years, selectedYear, onSelectYear }: TimelineYearSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {years.map((year) => (
        <button
          key={year}
          onClick={() => onSelectYear(year)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${selectedYear === year
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          {year}
        </button>
      ))}
    </div>
  );
}
