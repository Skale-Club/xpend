export type RawCategory = { id: string; name: string; color: string; parentId: string | null };

const DEFAULT_COLOR = '#6B7280';

export function buildCategoryContext(categories: RawCategory[]) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const rootCache = new Map<string, string>();
  const firstChildCache = new Map<string, string | null>();
  const colorCache = new Map<string, string>();

  const getRootCategoryId = (categoryId: string): string => {
    if (rootCache.has(categoryId)) return rootCache.get(categoryId)!;

    let current = byId.get(categoryId);
    let rootId = categoryId;

    while (current?.parentId) {
      rootId = current.parentId;
      current = byId.get(current.parentId);
    }

    rootCache.set(categoryId, current?.id || rootId);
    return rootCache.get(categoryId)!;
  };

  const getFirstChildUnderRootId = (categoryId: string): string | null => {
    if (firstChildCache.has(categoryId)) return firstChildCache.get(categoryId)!;

    const rootId = getRootCategoryId(categoryId);
    let currentId = categoryId;
    let current = byId.get(currentId);

    if (!current || current.id === rootId) {
      firstChildCache.set(categoryId, null);
      return null;
    }

    while (current?.parentId && current.parentId !== rootId) {
      currentId = current.parentId;
      current = byId.get(current.parentId);
    }

    firstChildCache.set(categoryId, currentId);
    return currentId;
  };

  const getEffectiveColor = (categoryId: string): string => {
    if (colorCache.has(categoryId)) return colorCache.get(categoryId)!;

    let current = byId.get(categoryId);
    let color = current?.color || DEFAULT_COLOR;

    // Subcategories inherit root color in charts for visual consistency.
    while (current?.parentId) {
      current = byId.get(current.parentId);
      if (current?.color) color = current.color;
    }

    colorCache.set(categoryId, color);
    return color;
  };

  return {
    byId,
    getRootCategoryId,
    getFirstChildUnderRootId,
    getEffectiveColor,
  };
}

export type CategoryContext = ReturnType<typeof buildCategoryContext>;
