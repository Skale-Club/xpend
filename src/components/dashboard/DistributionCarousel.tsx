'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
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

export function DistributionCarousel({ items }: DistributionCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const cycleMode = (direction: 'prev' | 'next') => {
    if (items.length === 0) return;
    if (direction === 'next') {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    } else {
      setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    }
  };

  const currentItem = items[currentIndex];

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
        color: '#D1D5DB', // Gray-300
        amount: otherAmount,
      }
    ];
  }, [currentItem]);

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader 
        title="Distribution" 
        action={
          <div className="flex items-center gap-2">
            <select
              value={currentIndex}
              onChange={(e) => setCurrentIndex(Number(e.target.value))}
              className="text-sm bg-white border border-gray-200 text-gray-700 py-1 pl-2 pr-6 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {items.map((item, idx) => (
                <option key={item.id} value={idx}>{item.title}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 border-l pl-2 border-gray-100">
              <button 
                onClick={() => cycleMode('prev')}
                className="p-1 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"
                title="Previous chart"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => cycleMode('next')}
                className="p-1 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"
                title="Next chart"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        }
      />
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="amount"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, value }) => `${name} (${formatCurrency(Number(value))})`}
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            No data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
