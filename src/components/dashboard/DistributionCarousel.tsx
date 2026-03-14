'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui';
import { ChevronLeft, ChevronRight, PieChart as PieIcon } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Sector } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';

export interface DistributionDataPoint {
  id?: string;
  name: string;
  amount: number;
  color: string;
}

export interface DistributionCarouselItem {
  id: string;
  title: string;
  data: DistributionDataPoint[];
}

interface DistributionCarouselProps {
  items: DistributionCarouselItem[];
  onDataPointClick?: (payload: {
    viewId: string;
    viewTitle: string;
    dataPoint: DistributionDataPoint;
  }) => void;
}

interface ActiveShapeProps {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
}

// Custom active shape for the donut slices
const renderActiveShape = (props: ActiveShapeProps) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;

  if (
    cx === undefined ||
    cy === undefined ||
    innerRadius === undefined ||
    outerRadius === undefined ||
    startAngle === undefined ||
    endAngle === undefined ||
    !fill
  ) {
    return null;
  }

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: `drop-shadow(0 4px 12px ${fill}55)` }}
      />
    </g>
  );
};

export function DistributionCarousel({ items, onDataPointClick }: DistributionCarouselProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const { hideSensitiveValues } = useSensitiveValues();

  // Separate parent breakdown items from regular items
  const { parentBreakdowns, regularItems } = useMemo(() => {
    const parentBreakdowns = items.filter(item => item.id.startsWith('parent-breakdown-'));
    const regularItems = items.filter(item => !item.id.startsWith('parent-breakdown-'));
    return { parentBreakdowns, regularItems };
  }, [items]);

  // State for main selection (regular items)
  const [currentIndex, setCurrentIndex] = useState(0);

  // State for parent breakdown selection (when viewing subcategory breakdown)
  const [selectedParentIndex, setSelectedParentIndex] = useState(0);

  // Determine if we're showing a parent breakdown
  const currentMainItem = regularItems[currentIndex];
  const isSubcategoryBreakdownView = currentMainItem?.id === 'subcategory' && parentBreakdowns.length > 0;

  // Get the actual item to display
  const currentItem = isSubcategoryBreakdownView
    ? parentBreakdowns[selectedParentIndex]
    : currentMainItem;

  const cycleMode = (direction: 'prev' | 'next') => {
    if (regularItems.length === 0) return;
    setActiveIndex(undefined);
    if (direction === 'next') {
      const newIndex = (currentIndex + 1) % regularItems.length;
      setCurrentIndex(newIndex);
      // Reset parent selection when changing main view
      setSelectedParentIndex(0);
    } else {
      const newIndex = (currentIndex - 1 + regularItems.length) % regularItems.length;
      setCurrentIndex(newIndex);
      setSelectedParentIndex(0);
    }
  };

  const totalAmount = useMemo(() => {
    if (!currentItem || !currentItem.data) return 0;
    return currentItem.data.reduce((sum, item) => sum + item.amount, 0);
  }, [currentItem]);

  // Group by "Other" if there are too many items to keep the chart clean
  const chartData = useMemo(() => {
    if (!currentItem || !currentItem.data) return [];

    // Sort by amount descending
    const sortedData = [...currentItem.data].sort((a, b) => b.amount - a.amount);

    if (sortedData.length <= 8) return sortedData;

    const top = sortedData.slice(0, 7);
    const rest = sortedData.slice(7);
    const otherAmount = rest.reduce((sum, item) => sum + item.amount, 0);

    return [
      ...top,
      {
        name: 'Other',
        color: '#94A3B8', // Slate-400
        amount: otherAmount,
      }
    ];
  }, [currentItem]);

  if (!items || items.length === 0) {
    return null;
  }

  const onPieEnter = (_: unknown, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(undefined);
  };

  const handleDataPointClick = (index: number) => {
    if (!onDataPointClick || !currentItem) return;
    const dataPoint = chartData[index];
    if (!dataPoint || dataPoint.name === 'Other') return;

    onDataPointClick({
      viewId: currentItem.id,
      viewTitle: currentItem.title,
      dataPoint,
    });
  };

  return (
    <Card className="overflow-hidden border border-slate-200 bg-white">
      <CardHeader
        title={
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <PieIcon className="w-4 h-4" />
            </div>
            <span className="font-semibold text-slate-900">Distribution Analysis</span>
          </div>
        }
        action={
          <div className="flex items-center gap-2">
            {/* Main view selector */}
            <select
              value={currentIndex}
              onChange={(e) => {
                setCurrentIndex(Number(e.target.value));
                setActiveIndex(undefined);
                setSelectedParentIndex(0);
              }}
              className="text-sm font-medium bg-white border border-slate-200 text-slate-700 py-1.5 pl-3 pr-9 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 cursor-pointer hover:border-slate-300 transition-all appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.5rem center',
                backgroundSize: '1.25rem'
              }}
            >
              {regularItems.map((item, idx) => (
                <option key={item.id} value={idx}>{item.title}</option>
              ))}
            </select>

            {/* Conditional parent category selector - only for subcategory breakdown view */}
            {isSubcategoryBreakdownView && (
              <select
                value={selectedParentIndex}
                onChange={(e) => {
                  setSelectedParentIndex(Number(e.target.value));
                  setActiveIndex(undefined);
                }}
                className="text-sm font-medium bg-white border border-slate-200 text-slate-700 py-1.5 pl-3 pr-9 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 cursor-pointer hover:border-slate-300 transition-all appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.5rem center',
                  backgroundSize: '1.25rem'
                }}
              >
                {parentBreakdowns.map((item, idx) => (
                  <option key={item.id} value={idx}>
                    {item.title.replace(' Breakdown', '')}
                  </option>
                ))}
              </select>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center gap-0.5 border border-slate-200 bg-white rounded-lg p-0.5">
              <button
                onClick={() => cycleMode('prev')}
                className="p-1.5 hover:bg-slate-50 rounded text-slate-400 hover:text-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous"
                disabled={regularItems.length <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => cycleMode('next')}
                className="p-1.5 hover:bg-slate-50 rounded text-slate-400 hover:text-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next"
                disabled={regularItems.length <= 1}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        }
      />
      <CardContent className="pt-4 pb-6">
        {chartData.length > 0 ? (
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            {/* Donut Chart */}
            <div className="flex flex-col items-center">
              <div className="relative w-full h-[280px] max-w-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      // @ts-expect-error - Recharts v3 types are missing activeIndex
                      activeIndex={activeIndex}
                      activeShape={renderActiveShape}
                      data={chartData}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={75}
                      outerRadius={100}
                      paddingAngle={2}
                      cornerRadius={4}
                      onMouseEnter={onPieEnter}
                      onMouseLeave={onPieLeave}
                      onClick={(_, index) => handleDataPointClick(index)}
                      stroke="none"
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          style={{ outline: 'none' }}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Center text for the donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  <div className="bg-white rounded-2xl shadow-md border border-slate-200 px-4 py-3 max-w-[140px] text-center">
                    {activeIndex !== undefined ? (
                      <>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-1 truncate">
                          {chartData[activeIndex].name}
                        </span>
                        <span className="text-xl font-extrabold text-slate-900 block">
                          {formatCurrency(chartData[activeIndex].amount, { hideSensitiveValues })}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 block mt-0.5">
                          {((chartData[activeIndex].amount / totalAmount) * 100).toFixed(1)}%
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                          Total
                        </span>
                        <span className="text-xl font-extrabold text-slate-900 block">
                          {formatCurrency(totalAmount, { hideSensitiveValues })}
                        </span>
                        <span className="text-[9px] font-medium text-slate-400 block mt-1 truncate">
                          {currentItem.title}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="w-full space-y-2">
              {chartData.map((entry, index) => {
                const percentage = ((entry.amount / totalAmount) * 100).toFixed(1);
                const isActive = activeIndex === index;
                const isClickable = !!onDataPointClick && entry.name !== 'Other';

                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all group ${
                      isActive
                        ? 'bg-slate-50 border-slate-200 shadow-sm'
                        : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                    } ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(undefined)}
                    onClick={() => handleDataPointClick(index)}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : -1}
                    onKeyDown={(e) => {
                      if (!isClickable) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleDataPointClick(index);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className={`text-sm font-medium truncate transition-colors ${
                        isActive ? 'text-slate-900' : 'text-slate-700 group-hover:text-slate-900'
                      }`}>
                        {entry.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className={`text-sm font-bold transition-colors ${
                        isActive ? 'text-slate-900' : 'text-slate-700'
                      }`}>
                        {formatCurrency(entry.amount, { hideSensitiveValues })}
                      </span>
                      <span className="text-xs font-medium text-slate-400 min-w-[3rem] text-right">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-[280px] flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="p-4 bg-slate-50 rounded-full">
              <PieIcon className="w-8 h-8 opacity-20" />
            </div>
            <p className="text-sm font-medium">No data available for this view</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
