import { DistributionData, DistributionItem, CategorySummary, CategoryReportNode } from '@/types';

/**
 * Transform CategorySummary (from Dashboard API) to DistributionItem format
 */
export function categorySummaryToDistribution(
  categories: CategorySummary[]
): DistributionItem[] {
  return categories.map((cat) => ({
    name: cat.categoryName,
    amount: cat.total,
    color: cat.color,
  }));
}

/**
 * Transform CategoryReportNode (from Reports API) to DistributionItem format
 * Flattens the hierarchy to top-level categories only
 */
export function categoryReportNodeToDistribution(
  nodes: CategoryReportNode[]
): DistributionItem[] {
  return nodes.map((node) => ({
    name: node.name,
    amount: node.amount,
    color: node.color,
  }));
}

/**
 * Transform merchant breakdown to DistributionItem format
 */
export function merchantBreakdownToDistribution(
  merchants: Array<{
    name: string;
    amount: number;
    color?: string;
    primaryCategory?: { color: string } | null;
  }>,
  defaultColor: string = '#3B82F6'
): DistributionItem[] {
  return merchants.map((merchant) => ({
    name: merchant.name,
    amount: merchant.amount,
    // Use merchant color, or primary category color, or default
    color: merchant.color || merchant.primaryCategory?.color || defaultColor,
  }));
}

/**
 * Ensure consistent color palette for merchants
 */
const MERCHANT_COLORS = [
  '#3B82F6', // blue-500
  '#EF4444', // red-500
  '#10B981', // green-500
  '#F59E0B', // amber-500
  '#8B5CF6', // violet-500
  '#6366F1', // indigo-500
  '#EC4899', // pink-500
  '#14B8A6', // teal-500
];

/**
 * Assign colors to merchants based on index for consistency
 */
export function assignMerchantColors(
  merchants: Array<{ name: string; amount: number }>,
  existingColorMap?: Map<string, string>
): DistributionItem[] {
  const colorMap = existingColorMap || new Map<string, string>();

  return merchants.map((merchant, index) => {
    // Check if we already have a color for this merchant
    if (!colorMap.has(merchant.name)) {
      colorMap.set(merchant.name, MERCHANT_COLORS[index % MERCHANT_COLORS.length]);
    }

    return {
      name: merchant.name,
      amount: merchant.amount,
      color: colorMap.get(merchant.name)!,
    };
  });
}

/**
 * Transform generic data with name/amount/color to DistributionItem format
 */
export function genericToDistribution(
  data: Array<{ name: string; amount: number; color: string }>
): DistributionItem[] {
  return data.map((item) => ({
    name: item.name,
    amount: item.amount,
    color: item.color,
  }));
}

export interface ParentCategoryBreakdownInput {
  id: string;
  title: string;
  data: DistributionItem[];
}

export interface DistributionTemplateInput {
  expenseByCategory: DistributionItem[];
  expenseBySubcategory: DistributionItem[];
  parentBreakdowns?: ParentCategoryBreakdownInput[];
  incomeByCategory: DistributionItem[];
  topMerchants: DistributionItem[];
  expenseByAccount: DistributionItem[];
  recurringVsOneTime: DistributionItem[];
  expenseByWeekday: DistributionItem[];
}

/**
 * Shared template used by Dashboard and Reports DistributionCarousel.
 * Keep ordering and IDs in one place so both pages always stay in sync.
 */
export function buildDistributionTemplateItems(
  input: DistributionTemplateInput
): DistributionData[] {
  return [
    {
      id: 'expense',
      title: 'Expenses by Category',
      data: input.expenseByCategory,
    },
    {
      id: 'subcategory',
      title: 'Expenses by Subcategory',
      data: input.expenseBySubcategory,
    },
    ...(input.parentBreakdowns || []),
    {
      id: 'income',
      title: 'Income by Category',
      data: input.incomeByCategory,
    },
    {
      id: 'merchant',
      title: 'Top Merchants',
      data: input.topMerchants,
    },
    {
      id: 'account',
      title: 'Expenses by Account',
      data: input.expenseByAccount,
    },
    {
      id: 'recurring',
      title: 'Recurring vs One-time',
      data: input.recurringVsOneTime,
    },
    {
      id: 'weekday',
      title: 'Expenses by Weekday',
      data: input.expenseByWeekday,
    },
  ].filter((item) => item.data.length > 0);
}

/**
 * Converts hierarchical report nodes into "Parent Breakdown" items
 * matching the Dashboard distribution template.
 */
export function categoryReportNodesToParentBreakdowns(
  nodes: CategoryReportNode[]
): ParentCategoryBreakdownInput[] {
  return nodes
    .map((node) => ({
      id: `parent-breakdown-${node.id}`,
      title: `${node.name} Breakdown`,
      // Match dashboard behavior: use first-level children as segments and keep parent color.
      // If a parent has direct transactions and no children, it still gets a single-segment breakdown.
      data: (node.subcategories && node.subcategories.length > 0
        ? node.subcategories.map((sub) => ({
            name: sub.name,
            amount: sub.amount,
            color: node.color,
          }))
        : [
            {
              name: node.name,
              amount: node.amount,
              color: node.color,
            },
          ])
        .filter((sub) => sub.amount > 0)
        .sort((a, b) => b.amount - a.amount),
    }))
    .filter((item) => item.data.length > 0);
}

/**
 * Flatten report hierarchy into subcategory chart data with root-category color inheritance.
 * This mirrors dashboard subcategory coloring (parent category color drives all descendants).
 */
export function categoryReportNodesToSubcategoryDistribution(
  nodes: CategoryReportNode[],
  limit: number = 10
): DistributionItem[] {
  const subcategories: DistributionItem[] = [];

  const walk = (node: CategoryReportNode, root: CategoryReportNode) => {
    for (const sub of node.subcategories || []) {
      subcategories.push({
        name: `${root.name} - ${sub.name}`,
        amount: sub.amount,
        color: root.color,
      });
      walk(sub, root);
    }
  };

  for (const root of nodes) {
    walk(root, root);
  }

  return subcategories
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}
