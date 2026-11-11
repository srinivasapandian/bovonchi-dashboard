import type { MenuItem, Category, OrderType, EffectiveStateResult, EntityChannel86 } from '../../data/types';

function normalizeId(value: string | undefined | null): string {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Assigned categories plus every ancestor (parent chain). Matches how category visibility is enforced
 * for subcategories in the Control Centre (parent and sub must both allow the channel).
 */
export function expandItemCategoriesWithAncestors(item: MenuItem, allCategories: Category[]): Category[] {
  const byId = new Map(allCategories.map((c) => [String(c.id).trim(), c]));
  const out: Category[] = [];
  const seen = new Set<string>();
  const add = (cat: Category) => {
    const id = String(cat.id).trim();
    if (seen.has(id)) return;
    seen.add(id);
    out.push(cat);
  };
  const visitUp = (rawId: string) => {
    const cid = String(rawId).trim();
    if (!cid) return;
    const cat = byId.get(cid);
    if (!cat) return;
    add(cat);
    if (cat.parentCategoryId) visitUp(String(cat.parentCategoryId));
  };
  (item.categoryIds ?? []).forEach((id) => visitUp(String(id)));
  return out;
}

/** One assignment’s path: leaf → parent → … → root (matches ItemForm / multi-category OR semantics). */
export function buildCategoryPathFromAssignedId(leafId: string, allCategories: Category[]): Category[] {
  const byId = new Map(allCategories.map((c) => [String(c.id).trim(), c]));
  const path: Category[] = [];
  let current: string | undefined = String(leafId).trim();
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current)) break;
    seen.add(current);
    const cat = byId.get(current);
    if (!cat) break;
    path.push(cat);
    current = cat.parentCategoryId ? String(cat.parentCategoryId).trim() : undefined;
  }
  return path;
}

/**
 * Item category visibility: **some** assigned path fully allows the channel (OR), matching ItemForm
 * `channelAllowedByAnyCategory` / `channelAllowedByAnyCategoryForOutletId`. Within each path,
 * **every** category on that chain must allow (parent + sub for that tree).
 */
export function itemCategoryVisibilityAllowsChannel(
  item: MenuItem,
  channel: OrderType,
  categories: Category[],
  orderTypeIdByKey: Partial<Record<OrderType, string>> | undefined,
  outletOrderTypeId?: string,
): { allows: boolean; blockingCat: Category | null; blockingCats: Category[] } {
  const rawIds = (item.categoryIds ?? []).map((id) => String(id).trim()).filter(Boolean);
  if (rawIds.length === 0) return { allows: true, blockingCat: null, blockingCats: [] };

  const otk = orderTypeIdByKey;
  const branchOrderTypeId = normalizeId(outletOrderTypeId) || normalizeId(otk?.[channel]);
  const hasOrderTypeRows = !!branchOrderTypeId;

  const categoryAllowsChannel = (cat: Category): boolean => {
    const cvList = cat.channelVisibility;
    if (Array.isArray(cvList)) {
      if (!hasOrderTypeRows) return false;
      const row = cvList.find((cv) => normalizeId(cv.orderTypeId) === branchOrderTypeId);
      return !!row && row.enabled !== false;
    }
    return cat.orderTypeVisibility[channel] !== false;
  };

  const pathAllowsChannel = (path: Category[]): boolean => {
    if (path.length === 0) return false;
    return path.every((c) => categoryAllowsChannel(c));
  };

  const firstBlockingInPath = (path: Category[]): Category | null => {
    if (path.length === 0) return null;
    return path.find((c) => !categoryAllowsChannel(c)) ?? null;
  };

  for (const id of rawIds) {
    const path = buildCategoryPathFromAssignedId(id, categories);
    if (pathAllowsChannel(path)) {
      return { allows: true, blockingCat: null, blockingCats: [] };
    }
  }

  const blockingById = new Map<string, Category>();
  for (const id of rawIds) {
    const path = buildCategoryPathFromAssignedId(id, categories);
    const blocking = firstBlockingInPath(path);
    if (blocking) {
      const bid = String(blocking.id).trim();
      if (bid) blockingById.set(bid, blocking);
    }
  }

  const blockingCats = Array.from(blockingById.values());
  return { allows: false, blockingCat: blockingCats[0] ?? null, blockingCats };
}

/**
 * Per-channel category flags from API `channelVisibility` (matches Categories grid / Control Centre).
 * When there is no row for the outlet order type id, visibility is treated as off until configured.
 */
export function categoryChannelState(
  category: Category,
  channel: OrderType,
  orderTypeIdByKey: Partial<Record<OrderType, string>>,
  outletId?: string,
): { enabled: boolean; availabilityEnabled: boolean } {
  // Prefer per-outlet UUID when provided — avoids collapsing sibling third parties (DoorDash/GrubHub/Ubereats)
  // that share the same OrderType key to a single entry in orderTypeIdByKey.
  const orderTypeId = outletId ? normalizeId(outletId) : normalizeId(orderTypeIdByKey[channel]);
  if (!orderTypeId) return { enabled: false, availabilityEnabled: false };
  const row = (category.channelVisibility ?? []).find((cv) => normalizeId(cv.orderTypeId) === orderTypeId);
  if (!row) return { enabled: false, availabilityEnabled: false };
  const availabilityEnabled = row.availabilityEnabled ?? row.avaliblityEnable ?? true;
  return { enabled: row.enabled !== false, availabilityEnabled };
}

export type ResolveEffectiveStateOptions = {
  categories: Category[];
  channel86Records: EntityChannel86[];
  /** When set (outlet order-type ids), category step uses `channelVisibility`; otherwise legacy `orderTypeVisibility`. */
  orderTypeIdByKey?: Partial<Record<OrderType, string>>;
  /**
   * When set, item visibility + availability are resolved from `item.channelsByOrderTypeId[outletOrderTypeId]`
   * instead of the OrderType-grouped fields. Lets the Control Centre distinguish per-outlet third parties
   * (DoorDash/GrubHub/Ubereats) that otherwise collapse to one OrderType bucket.
   */
  outletOrderTypeId?: string;
};

/**
 * PCF-18.1: Resolution chain — determines effective visibility/availability
 * for an entity on a specific channel at a given time.
 */
export function resolveEffectiveState(
  item: MenuItem,
  channel: OrderType,
  opts: ResolveEffectiveStateOptions,
): EffectiveStateResult {
  const reasons: EffectiveStateResult['reasons'] = [];

  // Step 1: Check per-channel 86 (temporary operational override)
  const ch86 = opts.channel86Records.find(
    (r) => r.entityId === item.id && r.channel === channel && r.entityType === 'item',
  );
  const ch86Active = ch86 && (!ch86.reEnableAt || new Date(ch86.reEnableAt) > new Date());
  reasons.push({
    step: 'channel_86',
    label: 'Per-channel 86',
    passed: !ch86Active,
    detail: ch86Active ? `86'd on ${channel} until ${ch86.durationMode === 'manual' ? 'manually restored' : ch86.reEnableAt ?? 'next session'}` : 'No active 86',
  });
  if (ch86Active) return { visible: true, available: false, effective: 'sold_out', reasons };

  // Step 2: Item status
  const isOos = item.status === 'out_of_stock';
  reasons.push({
    step: 'item_status',
    label: 'Item status',
    passed: true,
    detail: `Status: ${item.status}`,
    fixPath: `/product-catalog/items/${item.id}/edit`,
  });

  // Step 3: Item channel visibility — prefer per-outlet UUID (channelsByOrderTypeId) when available,
  // else fall back to OrderType-grouped fields. Per-UUID lets us distinguish same-group third parties.
  const perOutletRow = opts.outletOrderTypeId
    ? item.channelsByOrderTypeId?.[opts.outletOrderTypeId]
    : undefined;
  const itemVis =
    perOutletRow !== undefined
      ? perOutletRow.enabled
      : item.visibilityPerOrderType?.[channel] ?? (item as any).orderTypeVisibility?.[channel] ?? false;
  reasons.push({
    step: 'item_visibility',
    label: `Item ${channel} visibility`,
    passed: itemVis !== false,
    detail: itemVis !== false ? 'Visible' : 'Visibility OFF for this channel',
    fixPath: `/product-catalog/items/${item.id}/edit`,
  });
  if (itemVis === false) return { visible: false, available: false, effective: 'hidden', reasons };

  // Step 4: Category channel visibility — OR across assigned category paths (see `itemCategoryVisibilityAllowsChannel`).
  // When per-outlet `channelsByOrderTypeId` data is present, the API has already answered visibility
  // per outlet — trust it and skip the category gate (we still compute reasons for the diagnostic panel).
  const otk = opts.orderTypeIdByKey;
  const { allows: categoryChainAllows, blockingCat, blockingCats } = itemCategoryVisibilityAllowsChannel(
    item,
    channel,
    opts.categories,
    otk,
    opts.outletOrderTypeId,
  );
  const blockingNames = blockingCats
    .map((c) => c.name?.trim())
    .filter((n): n is string => !!n && n.length > 0 && n !== 'unknown');
  const detailText = categoryChainAllows
    ? 'At least one category path allows this channel'
    : blockingNames.length <= 1
      ? `Blocked by category '${blockingNames[0] ?? blockingCat?.name ?? 'unknown'}'`
      : `Blocked by categories ${blockingNames.map((n) => `'${n}'`).join(', ')}`;
  reasons.push({
    step: 'category_visibility',
    label: 'Category visibility',
    passed: categoryChainAllows || perOutletRow !== undefined,
    detail: detailText,
    fixPath: blockingCat ? `/product-catalog/categories/edit` : undefined,
  });
  if (!categoryChainAllows && perOutletRow === undefined) {
    return { visible: false, available: false, effective: 'blocked', reasons };
  }

  // Step 4.5: Category channel availability (availabilityEnabled per outlet UUID)
  // Walk all assigned category paths (same OR-across-paths, AND-within-path logic as step 4).
  // Item is unavailable if EVERY allowing path has at least one category with availabilityEnabled falsy.
  // Skip when item has explicit per-outlet availability data (perOutletRow) — same as step 4 visibility bypass.
  const outletId = normalizeId(opts.outletOrderTypeId) || normalizeId(otk?.[channel]);
  if (outletId && perOutletRow === undefined) {
    const catByIdMap = new Map(opts.categories.map((c) => [String(c.id).trim(), c]));
    const catAvailAllowsChannel = (cat: Category): boolean => {
      if (!Array.isArray(cat.channelVisibility)) return true;
      const cvRow = cat.channelVisibility.find((cv) => normalizeId(cv.orderTypeId) === outletId);
      if (!cvRow) return true; // no row = not explicitly restricted
      const avail = cvRow.availabilityEnabled ?? cvRow.avaliblityEnable;
      return avail == null ? true : !!avail;
    };
    const pathAvailAllows = (leafId: string): boolean => {
      let current: string | undefined = String(leafId).trim();
      const seen = new Set<string>();
      while (current) {
        if (seen.has(current)) break;
        seen.add(current);
        const cat = catByIdMap.get(current);
        if (!cat) break;
        if (!catAvailAllowsChannel(cat)) return false;
        current = cat.parentCategoryId ? String(cat.parentCategoryId).trim() : undefined;
      }
      return true;
    };
    const rawCatIds = (item.categoryIds ?? []).map((id) => String(id).trim()).filter(Boolean);
    const anyPathAvail = rawCatIds.length === 0 || rawCatIds.some((id) => pathAvailAllows(id));
    if (!anyPathAvail) {
      reasons.push({
        step: 'category_availability',
        label: 'Category availability',
        passed: false,
        detail: 'All category paths mark this channel as unavailable',
        fixPath: `/product-catalog/categories/edit`,
      });
      return { visible: true, available: false, effective: 'sold_out', reasons };
    }
  }

  // Step 5: Item session (simplified — check if item has session restrictions)
  const hasSessions = item.sessionIds && item.sessionIds.length > 0;
  reasons.push({
    step: 'item_session',
    label: 'Session assignment',
    passed: true, // Simplified — full time check requires session data
    detail: hasSessions ? `Assigned to ${item.sessionIds!.length} session(s)` : 'Available all day',
  });

  // Step 6: Per-channel availability from item API (pricing.channels[].availabilityEnabled)
  // Prefer per-outlet UUID lookup so each third-party (DoorDash/GrubHub/Ubereats) resolves independently.
  const channelAvailable =
    perOutletRow !== undefined
      ? perOutletRow.availabilityEnabled
      : item.availabilityPerOrderType?.[channel];
  reasons.push({
    step: 'channel_availability',
    label: `Item ${channel} availability`,
    passed: channelAvailable !== false,
    detail: channelAvailable === false ? 'Marked unavailable for this channel' : 'Available for this channel',
    fixPath: `/product-catalog/items/${item.id}/edit`,
  });
  if (channelAvailable === false) {
    return { visible: true, available: false, effective: 'sold_out', reasons };
  }

  // All visibility checks pass — then fallback to global OOS status
  if (isOos) {
    reasons.push({
      step: 'availability',
      label: 'Availability',
      passed: false,
      detail: 'Item is Out of Stock',
      fixPath: `/product-catalog/items/${item.id}/edit`,
    });
    return { visible: true, available: false, effective: 'sold_out', reasons };
  }

  return { visible: true, available: true, effective: 'showing', reasons };
}

/** Colour tokens for visibility vs availability (PCF-18.1) */
export const VISIBILITY_COLOR = '#8C6A7A'; // purple
export const AVAILABILITY_COLOR = '#5E8C7B'; // teal
export const EFFECTIVE_COLORS = {
  showing: '#5F7A55',   // green
  sold_out: '#B07A2A',  // amber
  hidden: '#9A9084',    // grey
  blocked: '#A63D2F',   // red
} as const;
