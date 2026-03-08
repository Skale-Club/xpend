import { Category } from '@/types';

interface CategoryNode extends Category {
  children: CategoryNode[];
}

export interface HierarchicalCategoryOption {
  value: string;
  label: string;
  depth: number;
}

function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  for (const category of categories) {
    map.set(category.id, { ...category, children: [] });
  }

  for (const category of categories) {
    const node = map.get(category.id);
    if (!node) continue;

    if (category.parentId && map.has(category.parentId)) {
      map.get(category.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortTree = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of nodes) {
      if (node.children.length > 0) sortTree(node.children);
    }
  };

  sortTree(roots);
  return roots;
}

export function buildHierarchicalCategoryOptions(
  categories: Category[],
  prefix = '↳ '
): HierarchicalCategoryOption[] {
  const roots = buildCategoryTree(categories);
  const options: HierarchicalCategoryOption[] = [];

  const walk = (nodes: CategoryNode[], depth: number) => {
    for (const node of nodes) {
      options.push({
        value: node.id,
        label: `${prefix.repeat(depth)}${node.name}`,
        depth,
      });

      if (node.children.length > 0) {
        walk(node.children, depth + 1);
      }
    }
  };

  walk(roots, 0);
  return options;
}
