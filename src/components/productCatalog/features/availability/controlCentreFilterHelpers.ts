import type { Category, MenuItem, OrderType, Session } from '../../data/types';
import { resolveEffectiveState, categoryChannelState } from './resolveEffectiveState';

export type ItemAvailabilityBucket = 'fully' | 'partial' | 'none';
export type CategoryVisibilityBucket = 'full' | 'partial' | 'none';

function tid(s: string | undefined | null): string {
  return String(s ?? '').trim();
}

function normalizeId(s: string | undefined | null): string {
  return tid(s).toLowerCase();
}

/** Revamp catalog APIs expect order type ids as UUIDs; non-UUID values from branch config cause 400 responses. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Tooltip / label text for `resolveEffectiveState` `effective` (plain language; no internal “86” jargon). */
export function channelEffectiveTooltipLabel(effective: string): string {
  switch (effective) {
    case 'showing':
      return 'Available';
    case 'sold_out':
      return 'Out of Stock';
    case 'hidden':
      return 'Not visible';
    case 'blocked':
      return 'Category off';
    default:
      return effective;
  }
}

/** Parse `resolveEffectiveState` category_visibility reason detail for the blocking category display name. */
export function blockingCategoryNameFromReasons(
  reasons: { step: string; passed: boolean; detail?: string }[] | undefined,
): string | null {
  const r = reasons?.find((x) => x.step === 'category_visibility' && !x.passed);
  const d = r?.detail ?? '';
  const names = Array.from(d.matchAll(/'([^']+)'/g))
    .map((m) => (m[1] ?? '').trim())
    .filter((name) => name && name !== 'unknown');
  if (names.length > 0) return names.join(', ');
  const m = d.match(/Blocked by category ([^,]+)/i);
  const fallback = m?.[1]?.trim();
  return fallback && fallback !== 'unknown' ? fallback : null;
}

/** Category / session filter values must be real entity ids from the loaded lists (never display names). */
export function normalizeCategoryFilterId(selected: string, allCategories: Category[]): 'all' | string {
  if (tid(selected) === '' || selected === 'all') return 'all';
  const id = tid(selected);
  return allCategories.some((c) => tid(c.id) === id) ? id : 'all';
}

export function normalizeSessionFilterId(selected: string, sessions: Session[]): 'all' | string {
  if (tid(selected) === '' || selected === 'all') return 'all';
  const id = tid(selected);
  const normalized = normalizeId(id);
  return sessions.some((s) => getSessionMatchIdSet(s).has(normalized)) ? id : 'all';
}

/** Resolve the session row for the current filter value (matches `Session.id` or any id in `sessionMatchIds` / `sessionGroupId`). */
export function findSessionByFilterSelectionValue(sessions: Session[], sessionId: string): Session | undefined {
  const id = normalizeId(sessionId);
  if (!id) return undefined;
  return sessions.find((s) => getSessionMatchIdSet(s).has(id));
}

export function collectCategoryTreeIds(rootId: string, allCategories: Category[]): Set<string> {
  const root = tid(rootId);
  if (!root) return new Set();
  const out = new Set<string>([root]);
  const queue = [root];
  while (queue.length) {
    const id = queue.shift()!;
    allCategories.forEach((c) => {
      const cid = tid(c.id);
      const parent = tid(c.parentCategoryId);
      if (parent === id && cid && !out.has(cid)) {
        out.add(cid);
        queue.push(cid);
      }
    });
  }
  return out;
}

export function itemInSelectedCategoryTree(item: MenuItem, categoryId: string, allCategories: Category[]): boolean {
  const id = tid(categoryId);
  if (!id || !allCategories.some((c) => tid(c.id) === id)) return false;
  const allowed = collectCategoryTreeIds(id, allCategories);
  return item.categoryIds.some((raw) => allowed.has(tid(raw)));
}

/** Dropdown options: value is always category `id`; disambiguate duplicate display names without exposing raw ids. */
function getCategorySortPosition(category: Category): number {
  const n = Number(category.sortPosition);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

function compareCategoriesBySortPositionThenName(a: Category, b: Category): number {
  const byPosition = getCategorySortPosition(a) - getCategorySortPosition(b);
  if (byPosition !== 0) return byPosition;
  return a.name.localeCompare(b.name);
}

/** Build parent->child option order (Category page style), preserving stable duplicate-name disambiguation. */
export function buildCategoryFilterOptions(categories: Category[]): { value: string; label: string }[] {
  const parentMap = new Map<string, Category[]>();
  categories.forEach((cat) => {
    const parentId = tid(cat.parentCategoryId);
    if (!parentId) return;
    const siblings = parentMap.get(parentId) ?? [];
    siblings.push(cat);
    parentMap.set(parentId, siblings);
  });

  const ordered: Array<{ category: Category; depth: number }> = [];
  const roots = categories
    .filter((c) => !tid(c.parentCategoryId))
    .slice()
    .sort(compareCategoriesBySortPositionThenName);

  const visit = (cat: Category, depth: number) => {
    ordered.push({ category: cat, depth });
    const children = (parentMap.get(tid(cat.id)) ?? []).slice().sort(compareCategoriesBySortPositionThenName);
    children.forEach((child) => visit(child, depth + 1));
  };
  roots.forEach((root) => visit(root, 0));

  const nameCounts = new Map<string, number>();
  ordered.forEach(({ category }) => {
    nameCounts.set(category.name, (nameCounts.get(category.name) ?? 0) + 1);
  });
  const nameIndex = new Map<string, number>();

  return [
    { value: 'all', label: 'All categories' },
    ...ordered.map(({ category, depth }) => {
      const total = nameCounts.get(category.name) ?? 1;
      const idx = nameIndex.get(category.name) ?? 0;
      nameIndex.set(category.name, idx + 1);
      const baseLabel = total <= 1 ? category.name : idx === 0 ? category.name : `${category.name} (${idx + 1})`;
      const childPrefix = depth > 0 ? `${'  '.repeat(depth)}- ` : '';
      return { value: tid(category.id), label: `${childPrefix}${baseLabel}` };
    }),
  ];
}

/** Items tab search: match by visible code or name (query is already lowercased). */
export function itemMatchesItemsTabSearchQuery(item: MenuItem, queryLower: string): boolean {
  if (!queryLower) return true;
  return (
    tid(item.itemCode).toLowerCase().includes(queryLower) ||
    item.name.toLowerCase().includes(queryLower)
  );
}

/** Categories tab search: match by category name (query is already lowercased). */
export function categoryMatchesCategoriesTabSearchQuery(cat: { id: string; name: string }, queryLower: string): boolean {
  if (!queryLower) return true;
  return cat.name.toLowerCase().includes(queryLower);
}

export function getItemAvailabilityBucket(
  item: MenuItem,
  channelRows: Array<{ key: OrderType; id: string }>,
  cats: Category[],
  orderTypeIdByKey?: Partial<Record<OrderType, string>>,
): ItemAvailabilityBucket {
  if (channelRows.length === 0) return 'none';
  let showing = 0;
  channelRows.forEach((ch) => {
    const eff = resolveEffectiveState(item, ch.key, {
      categories: cats,
      channel86Records: [],
      ...(orderTypeIdByKey ? { orderTypeIdByKey } : {}),
      ...(ch.id ? { outletOrderTypeId: ch.id } : {}),
    }).effective;
    if (eff === 'showing') showing += 1;
  });
  if (showing === 0) return 'none';
  if (showing === channelRows.length) return 'fully';
  return 'partial';
}

/**
 * Session group ids from item API `availability.timeBasedAvailability[].sessionGroupId`
 * (mapped in itemsMapper → `MenuItem.sessionIds`).
 */
export function getItemSessionGroupIds(item: MenuItem): string[] {
  const raw = item.sessionIds;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((x) => normalizeId(x)).filter(Boolean);
}

/** Ids that may appear on items (`timeBasedAvailability.sessionGroupId`) vs session row (`id` / group id). */
export function getSessionMatchIdSet(session: Session): Set<string> {
  const out = new Set<string>();
  const add = (v: string | undefined) => {
    const t = normalizeId(v);
    if (t) out.add(t);
  };
  add(session.id);
  add(session.sessionGroupId);
  (session.sessionMatchIds ?? []).forEach((x) => add(x));
  return out;
}

export function itemMatchesSessionFilter(item: MenuItem, sessionId: string, session: Session | undefined): boolean {
  if (!session) return false;
  const matchIds = getSessionMatchIdSet(session);
  const sid = normalizeId(sessionId);
  if (sid) matchIds.add(sid);
  const itemId = normalizeId(item.id);
  // Primary: item `timeBasedAvailability[].sessionGroupId` → `sessionIds` vs session group / catalog ids
  if (getItemSessionGroupIds(item).some((g) => matchIds.has(g))) return true;
  if ((session.assignedItemIds ?? []).some((x) => normalizeId(x) === itemId)) return true;
  if ((session.assignedSessionItems ?? []).some((x) => normalizeId(x.id) === itemId)) return true;
  return false;
}

/** Same rules as the session filter; use for dropdown counts so labels match the list. */
export function countItemsMatchingSession(session: Session, items: MenuItem[]): number {
  const sid = tid(session.id);
  let n = 0;
  for (const it of items) {
    if (itemMatchesSessionFilter(it, sid, session)) n += 1;
  }
  return n;
}

export function getCategoryVisibilityBucketForCategory(
  category: Category,
  chRows: Array<{ key: OrderType; id: string }>,
  orderTypeIdByKey: Partial<Record<OrderType, string>>,
): CategoryVisibilityBucket {
  if (chRows.length === 0) return 'none';
  let enabled = 0;
  chRows.forEach((ch) => {
    if (categoryChannelState(category, ch.key, orderTypeIdByKey, ch.id).enabled) enabled += 1;
  });
  if (enabled === 0) return 'none';
  if (enabled === chRows.length) return 'full';
  return 'partial';
}

export function getSubCategoryVisibilityBucket(
  parent: Category,
  sub: Category,
  chRows: Array<{ key: OrderType; id: string }>,
  orderTypeIdByKey: Partial<Record<OrderType, string>>,
): CategoryVisibilityBucket {
  if (chRows.length === 0) return 'none';
  let visible = 0;
  chRows.forEach((ch) => {
    const pv = categoryChannelState(parent, ch.key, orderTypeIdByKey, ch.id).enabled;
    const sv = categoryChannelState(sub, ch.key, orderTypeIdByKey, ch.id).enabled;
    if (pv && sv) visible += 1;
  });
  if (visible === 0) return 'none';
  if (visible === chRows.length) return 'full';
  return 'partial';
}

export function getItemsTabHasActiveFilters(
  itemsCategoryFilter: string,
  categories: Category[],
  sessionFilter: string,
  sessions: Session[],
  itemsAvailabilityFilter: 'all' | 'fully_available' | 'partially_available' | 'not_available',
  search: string,
): boolean {
  if (normalizeCategoryFilterId(itemsCategoryFilter, categories) !== 'all') return true;
  if (normalizeSessionFilterId(sessionFilter, sessions) !== 'all') return true;
  if (itemsAvailabilityFilter !== 'all') return true;
  if (search.trim().length > 0) return true;
  return false;
}

export function getCategoriesTabHasActiveFilters(
  categoryVisibilityFilter: 'all' | 'full' | 'partial' | 'none',
  search: string,
): boolean {
  if (categoryVisibilityFilter !== 'all') return true;
  if (search.trim().length > 0) return true;
  return false;
}

/** True if at least one parent row would render on the Categories tab (same rules as the table body). */
export function categoriesTabHasVisibleParentRow(
  categories: Category[],
  options: {
    categoryVisibilityFilter: 'all' | 'full' | 'partial' | 'none';
    searchQueryLower: string;
    channels: Array<{ key: OrderType; id: string }>;
    orderTypeIdByKey: Partial<Record<OrderType, string>>;
  },
): boolean {
  const { categoryVisibilityFilter, channels, orderTypeIdByKey } = options;
  const q = options.searchQueryLower.trim().toLowerCase();
  const top = categories.filter((c) => !c.parentCategoryId);
  for (const parent of top) {
    const subCats = categories.filter((c) => c.parentCategoryId === parent.id);
    const parentVisBucket = getCategoryVisibilityBucketForCategory(parent, channels, orderTypeIdByKey);
    const parentVisPasses = categoryVisibilityFilter === 'all' || categoryVisibilityFilter === parentVisBucket;
    const parentRowPassesFilters = parentVisPasses;
    const subsAfterMeta = subCats.filter((sub) => {
      const subVisBucket = getSubCategoryVisibilityBucket(parent, sub, channels, orderTypeIdByKey);
      const subVisOk = categoryVisibilityFilter === 'all' || categoryVisibilityFilter === subVisBucket;
      return subVisOk;
    });
    const filteredSubCats = q
      ? subsAfterMeta.filter((s) => categoryMatchesCategoriesTabSearchQuery(s, q))
      : subsAfterMeta;
    const parentMatchesSearch = !q || categoryMatchesCategoriesTabSearchQuery(parent, q);
    const searchShowsThisParent = !q || parentMatchesSearch || filteredSubCats.length > 0;
    if (!parentRowPassesFilters && filteredSubCats.length === 0) continue;
    if (!searchShowsThisParent) continue;
    return true;
  }
  return false;
}

/** Item rows: show code without `#`; blank or whitespace → `-` (Items + Control Centre). */
export function formatItemCodeListDisplay(code: string | undefined | null): string {
  const t = (code ?? '').trim();
  return t.length > 0 ? t : '-';
}

/**
 * Control Centre item/category names: full text is always returned so the row can use all available width.
 * Overflow is handled by CSS (names wrap), so no hover tooltip (`title`) is needed.
 */
export function truncateControlCentreLabel(text: string): { display: string; title?: string } {
  return { display: text };
}
