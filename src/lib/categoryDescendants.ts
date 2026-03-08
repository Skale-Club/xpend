interface CategoryNode {
  id: string;
  parentId: string | null;
}

export function expandCategoryIdsWithDescendants(
  categories: CategoryNode[],
  selectedCategoryIds: string[]
): string[] {
  if (selectedCategoryIds.length === 0) return [];

  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    if (!childrenByParent.has(category.parentId)) {
      childrenByParent.set(category.parentId, []);
    }
    childrenByParent.get(category.parentId)!.push(category.id);
  }

  const visited = new Set<string>();
  const queue = [...selectedCategoryIds];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const children = childrenByParent.get(current) || [];
    for (const childId of children) {
      if (!visited.has(childId)) queue.push(childId);
    }
  }

  return Array.from(visited);
}
