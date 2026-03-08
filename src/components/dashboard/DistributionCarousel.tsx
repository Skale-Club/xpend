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
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: `drop-shadow(0 0 8px ${fill}44)` }}
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
    <Card className="overflow-hidden border-none shadow-sm bg-white">
      <CardHeader 
        title={
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <PieIcon className="w-4 h-4" />
            </div>
            <span className="font-semibold text-slate-800">Distribution Analysis</span>
          </div>
        } 
        action={
          <div className="flex items-center gap-3">
            <select
              value={currentIndex}
              onChange={(e) => {
                setCurrentIndex(Number(e.target.value));
                setActiveIndex(undefined);
              }}
              className="text-xs font-medium bg-slate-50 border-none text-slate-600 py-1.5 pl-3 pr-8 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:bg-slate-100 transition-colors appearance-none"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '12px' }}
            >
              {items.map((item, idx) => (
                <option key={item.id} value={idx}>{item.title}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-full">
              <button 
                onClick={() => cycleMode('prev')}
                className="p-1 hover:bg-white hover:shadow-sm rounded-full text-slate-400 hover:text-blue-600 transition-all"
                title="Previous chart"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => cycleMode('next')}
                className="p-1 hover:bg-white hover:shadow-sm rounded-full text-slate-400 hover:text-blue-600 transition-all"
                title="Next chart"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        }
      />
      <CardContent className="pt-6">
        <div className="relative">
          {chartData.length > 0 ? (
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full h-[320px] max-w-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      activeIndex={activeIndex}
                      activeShape={renderActiveShape}
                      data={chartData}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={85}
                      outerRadius={110}
                      paddingAngle={4}
                      cornerRadius={6}
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
                            <div className="bg-white/95 backdrop-blur-sm border border-slate-100 shadow-xl rounded-xl p-3 animate-in fade-in zoom-in duration-200">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                                <span className="font-semibold text-slate-700">{data.name}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-lg font-bold text-slate-900">{formatCurrency(data.amount)}</span>
                                <span className="text-xs text-slate-400 font-medium">{percentage}% of total</span>
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
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                        {chartData[activeIndex].name}
                      </span>
                      <span className="text-xl font-extrabold text-slate-900">
                        {formatCurrency(chartData[activeIndex].amount)}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">
                        {((chartData[activeIndex].amount / totalAmount) * 100).toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                        Total
                      </span>
                      <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                        {formatCurrency(totalAmount)}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">
                        {currentItem.title}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Enhanced Legend */}
              <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 md:mt-0 md:pl-4">
                {chartData.map((entry, index) => (
                  <div 
                    key={index} 
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-default group
                      ${activeIndex === index 
                        ? 'bg-slate-50 border-slate-100 shadow-sm' 
                        : 'bg-transparent border-transparent hover:bg-slate-50/50'}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(undefined)}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div 
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" 
                        style={{ backgroundColor: entry.color }} 
                      />
                      <span className="text-sm font-medium text-slate-600 truncate group-hover:text-slate-900 transition-colors">
                        {entry.name}
                      </span>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-sm font-bold text-slate-700">
                        {formatCurrency(entry.amount)}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">
                        {((entry.amount / totalAmount) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="p-4 bg-slate-50 rounded-full">
                <PieIcon className="w-8 h-8 opacity-20" />
              </div>
              <p className="text-sm font-medium">No data available for this view</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
