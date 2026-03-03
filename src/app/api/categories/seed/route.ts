import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface CategorySeed {
  name: string;
  color: string;
  icon: string;
  budget?: number;
  children?: CategorySeed[];
  rules?: string[];
}

const DEFAULT_CATEGORIES: CategorySeed[] = [
  {
    name: 'Food & Dining',
    color: '#EF4444',
    icon: 'Utensils',
    budget: 600,
    children: [
      { name: 'Groceries', color: '#EF4444', icon: 'ShoppingCart', budget: 400, rules: ['grocery', 'supermarket', 'walmart', 'costco', 'whole foods', 'trader joe', 'kroger', 'safeway', 'publix', 'aldi', 'market'] },
      { name: 'Restaurants', color: '#F97316', icon: 'ChefHat', budget: 150, rules: ['restaurant', 'cafe', 'coffee', 'starbucks', 'dunkin', 'mcdonald', 'burger', 'pizza', 'sushi', 'grill', 'bistro', 'diner'] },
      { name: 'Fast Food', color: '#FB923C', icon: 'Drumstick', budget: 50, rules: ['fast food', 'drive thru', 'takeout', 'delivery', 'doordash', 'uber eats', 'grubhub', 'postmates'] },
    ],
    rules: ['food', 'dining', 'eat', 'meal'],
  },
  {
    name: 'Transportation',
    color: '#3B82F6',
    icon: 'Car',
    budget: 300,
    children: [
      { name: 'Gas & Fuel', color: '#3B82F6', icon: 'Fuel', budget: 150, rules: ['gas', 'fuel', 'shell', 'exxon', 'chevron', 'bp', 'mobil', 'gasoline', 'petrol'] },
      { name: 'Public Transit', color: '#60A5FA', icon: 'Train', budget: 50, rules: ['metro', 'subway', 'bus', 'transit', 'uber', 'lyft', 'taxi', 'cab'] },
      { name: 'Car Maintenance', color: '#2563EB', icon: 'Wrench', budget: 100, rules: ['car wash', 'oil change', 'tire', 'mechanic', 'auto', 'vehicle', 'repair'] },
    ],
    rules: ['transport', 'travel', 'commute'],
  },
  {
    name: 'Shopping',
    color: '#8B5CF6',
    icon: 'ShoppingBag',
    budget: 200,
    children: [
      { name: 'Clothing', color: '#8B5CF6', icon: 'Shirt', budget: 75, rules: ['clothing', 'clothes', 'shoes', 'apparel', 'fashion', 'nike', 'adidas', 'h&m', 'zara', 'gap', 'old navy'] },
      { name: 'Electronics', color: '#A78BFA', icon: 'Laptop', budget: 50, rules: ['electronics', 'computer', 'phone', 'laptop', 'tablet', 'apple', 'best buy', 'amazon'] },
      { name: 'Home & Garden', color: '#7C3AED', icon: 'Home', budget: 75, rules: ['home', 'garden', 'furniture', 'decor', 'ikea', 'home depot', 'lowes', 'target'] },
    ],
    rules: ['shop', 'store', 'purchase'],
  },
  {
    name: 'Entertainment',
    color: '#F59E0B',
    icon: 'Film',
    budget: 100,
    children: [
      { name: 'Streaming', color: '#F59E0B', icon: 'Tv', budget: 30, rules: ['netflix', 'hulu', 'disney', 'hbo', 'spotify', 'apple music', 'youtube', 'streaming', 'subscription'] },
      { name: 'Movies & Events', color: '#FBBF24', icon: 'Clapperboard', budget: 40, rules: ['movie', 'cinema', 'theater', 'concert', 'ticket', 'event', 'show'] },
      { name: 'Games', color: '#D97706', icon: 'Gamepad2', budget: 30, rules: ['game', 'gaming', 'steam', 'playstation', 'xbox', 'nintendo'] },
    ],
    rules: ['entertainment', 'fun', 'leisure'],
  },
  {
    name: 'Bills & Utilities',
    color: '#10B981',
    icon: 'Receipt',
    budget: 400,
    children: [
      { name: 'Electricity', color: '#10B981', icon: 'Zap', budget: 120, rules: ['electric', 'power', 'energy', 'light'] },
      { name: 'Water', color: '#059669', icon: 'Droplet', budget: 40, rules: ['water', 'sewer'] },
      { name: 'Internet', color: '#34D399', icon: 'Wifi', budget: 80, rules: ['internet', 'wifi', 'broadband', 'comcast', 'verizon', 'at&t', 'spectrum'] },
      { name: 'Phone', color: '#047857', icon: 'Phone', budget: 80, rules: ['phone', 'mobile', 'cellular', 't-mobile', 'verizon', 'at&t'] },
      { name: 'Rent/Mortgage', color: '#0D9488', icon: 'Building', budget: 0, rules: ['rent', 'mortgage', 'housing'] },
    ],
    rules: ['bill', 'utility', 'payment'],
  },
  {
    name: 'Health',
    color: '#EC4899',
    icon: 'Heart',
    budget: 200,
    children: [
      { name: 'Medical', color: '#EC4899', icon: 'Stethoscope', budget: 100, rules: ['doctor', 'medical', 'hospital', 'clinic', 'health', 'physician'] },
      { name: 'Pharmacy', color: '#F472B6', icon: 'Pill', budget: 50, rules: ['pharmacy', 'cvs', 'walgreens', 'medicine', 'prescription', 'drug'] },
      { name: 'Insurance', color: '#DB2777', icon: 'Shield', budget: 50, rules: ['insurance', 'health plan', 'dental', 'vision'] },
      { name: 'Fitness', color: '#BE185D', icon: 'Dumbbell', budget: 50, rules: ['gym', 'fitness', 'workout', 'yoga', 'peloton'] },
    ],
    rules: ['health', 'wellness', 'medical'],
  },
  {
    name: 'Income',
    color: '#22C55E',
    icon: 'TrendingUp',
    children: [
      { name: 'Salary', color: '#22C55E', icon: 'Briefcase', rules: ['salary', 'payroll', 'paycheck', 'wage', 'direct deposit'] },
      { name: 'Freelance', color: '#4ADE80', icon: 'Laptop', rules: ['freelance', 'contract', 'consulting', 'gig'] },
      { name: 'Investments', color: '#16A34A', icon: 'LineChart', rules: ['dividend', 'interest', 'investment', 'return', 'capital gain'] },
      { name: 'Other Income', color: '#15803D', icon: 'Plus', rules: ['refund', 'reimbursement', 'cashback'] },
    ],
    rules: ['income', 'deposit', 'credit'],
  },
  {
    name: 'Transfer',
    color: '#6366F1',
    icon: 'ArrowRightLeft',
    children: [
      { name: 'Internal Transfer', color: '#6366F1', icon: 'ArrowRightLeft', rules: ['transfer', 'move', 'internal'] },
      { name: 'Savings', color: '#4F46E5', icon: 'PiggyBank', rules: ['savings', 'save'] },
    ],
    rules: ['transfer', 'move'],
  },
  {
    name: 'Other',
    color: '#6B7280',
    icon: 'MoreHorizontal',
    children: [
      { name: 'Other Expenses', color: '#6B7280', icon: 'Minus', rules: [] },
      { name: 'Other Income', color: '#9CA3AF', icon: 'Plus', rules: [] },
    ],
    rules: [],
  },
];

async function seedCategories(categories: CategorySeed[], parentId?: string): Promise<number> {
  let count = 0;

  for (const category of categories) {
    const existing = await prisma.category.findFirst({
      where: { name: category.name },
    });

    if (existing) {
      // Update existing category with new fields
      await prisma.category.update({
        where: { id: existing.id },
        data: {
          color: category.color,
          icon: category.icon,
          parentId: parentId || null,
          isSystem: true,
          budget: category.budget || null,
        },
      });

      // Create rules for existing category
      if (category.rules && category.rules.length > 0) {
        await prisma.categorizationRule.createMany({
          data: category.rules.map((keyword) => ({
            categoryId: existing.id,
            keywords: keyword,
            matchType: 'contains',
            priority: parentId ? 10 : 5,
          })),
          skipDuplicates: true,
        });
      }

      count++;
    } else {
      // Create new category
      const newCategory = await prisma.category.create({
        data: {
          name: category.name,
          color: category.color,
          icon: category.icon,
          parentId: parentId || null,
          isSystem: true,
          budget: category.budget || null,
        },
      });

      // Create rules
      if (category.rules && category.rules.length > 0) {
        await prisma.categorizationRule.createMany({
          data: category.rules.map((keyword) => ({
            categoryId: newCategory.id,
            keywords: keyword,
            matchType: 'contains',
            priority: parentId ? 10 : 5,
          })),
        });
      }

      count++;
    }

    // Seed children
    if (category.children && category.children.length > 0) {
      const parent = await prisma.category.findFirst({
        where: { name: category.name },
      });
      if (parent) {
        count += await seedCategories(category.children, parent.id);
      }
    }
  }

  return count;
}

export async function POST() {
  try {
    const count = await seedCategories(DEFAULT_CATEGORIES);
    return NextResponse.json({ message: 'Categories seeded successfully', count });
  } catch (error) {
    console.error('Failed to seed categories:', error);
    return NextResponse.json({ error: 'Failed to seed categories' }, { status: 500 });
  }
}
