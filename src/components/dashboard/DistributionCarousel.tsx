'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui';
import { ChevronLeft, ChevronRight, PieChart as PieIcon } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Sector } from 'recharts';
import { formatCurrency } from '@/lib/utils';

export interface DistributionDataPoint {
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
}

// Custom active shape for the donut slices
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;

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

export function DistributionCarousel({ items }: DistributionCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const cycleMode = (direction: 'prev' | 'next') => {
    if (items.length === 0) return;
    setActiveIndex(undefined);
    if (direction === 'next') {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    } else {
      setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    }
  };

  const currentItem = items[currentIndex];

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

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(undefined);
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
            <select
              value={currentIndex}
              onChange={(e) => {
                setCurrentIndex(Number(e.target.value));
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
              {items.map((item, idx) => (
                <option key={item.id} value={idx}>{item.title}</option>
              ))}
            </select>
            <div className="flex items-center gap-0.5 border border-slate-200 bg-white rounded-lg p-0.5">
              <button
                onClick={() => cycleMode('prev')}
                className="p-1.5 hover:bg-slate-50 rounded text-slate-400 hover:text-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous"
                disabled={items.length <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => cycleMode('next')}
                className="p-1.5 hover:bg-slate-50 rounded text-slate-400 hover:text-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next"
                disabled={items.length <= 1}
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
                      {...({ activeIndex } as any)}
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
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const percentage = ((data.amount / totalAmount) * 100).toFixed(1);
                          return (
                            <div className="bg-white border border-slate-200 shadow-lg rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
                                <span className="font-semibold text-slate-800 text-sm">{data.name}</span>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-lg font-bold text-slate-900">{formatCurrency(data.amount)}</span>
                                <span className="text-xs text-slate-500">{percentage}% of total</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center text for the donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  {activeIndex !== undefined ? (
                    <>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                        {chartData[activeIndex].name}
                      </span>
                      <span className="text-2xl font-extrabold text-slate-900">
                        {formatCurrency(chartData[activeIndex].amount)}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 mt-0.5">
                        {((chartData[activeIndex].amount / totalAmount) * 100).toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                        Total
                      </span>
                      <span className="text-2xl font-extrabold text-slate-900">
                        {formatCurrency(totalAmount)}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400 mt-1">
                        {currentItem.title}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="w-full space-y-2">
              {chartData.map((entry, index) => {
                const percentage = ((entry.amount / totalAmount) * 100).toFixed(1);
                const isActive = activeIndex === index;

                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer group ${
                      isActive
                        ? 'bg-slate-50 border-slate-200 shadow-sm'
                        : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(undefined)}
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
                        {formatCurrency(entry.amount)}
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
