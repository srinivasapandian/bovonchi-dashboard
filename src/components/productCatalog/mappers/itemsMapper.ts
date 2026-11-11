import type { ItemStatus, MenuItem, OrderType } from '../data/types';
import {
  apiNumericItemTypeToFe,
  feStatusFromItemCreationStatus,
  type ApiItemRow,
  type ApiGetCategoriesResponse,
} from '../../../services/itemCatalogApi';

function parseApiBool(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (typeof v === 'string') {
    const s = v.toLowerCase().trim();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return false;
}

function resolveMediaPath(
  media?: { fileName?: string; imageUrl?: string; imageId?: string; imageType?: string; type?: string } | null,
): string | undefined {
  if (!media) return undefined;
  const direct = String(media.fileName ?? media.imageUrl ?? '').trim();
  if (direct) return direct;
  const imageId = String(media.imageId ?? '').trim();
  const imageType = String(media.imageType ?? media.type ?? '').trim();
  if (imageId && imageType) return `img/testing/${imageId}/${imageType}`;
  return undefined;
}

export const itemNextStatus: Record<ItemStatus, ItemStatus> = {
  active: 'draft',
  draft: 'active',
  out_of_stock: 'active',
  hidden: 'active',
  archived: 'active',
};

function normalizeOrderTypeName(value: string): string {
  return value.toLowerCase().replace(/[\s-]+/g, '_').trim();
}

function mapApiOrderTypeToKey(rawId?: string, rawName?: string): OrderType | null {
  const id = normalizeOrderTypeName(rawId ?? '');
  const name = normalizeOrderTypeName(rawName ?? '');
  const source = `${id} ${name}`;
  if (/(dine|dining|walk_in|walkin|eat_in)/.test(source)) return 'dine_in';
  if (/(takeout|take_out|pickup|pick_up)/.test(source)) return 'takeout';
  if (/delivery/.test(source)) return 'delivery';
  if (/(online|gloriafood|web|app|digital)/.test(source)) return 'online_ordering';
  if (/(catering|cater)/.test(source)) return 'catering';
  return null;
}

function numPrice(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function mergeItemCategoryIdsFromCategoriesResponse(
  items: MenuItem[],
  payload: ApiGetCategoriesResponse,
): MenuItem[] {
  const rows = [...(payload.parentcatagory ?? []), ...(payload.subcategory ?? [])];
  const extraByItem = new Map<string, Set<string>>();
  // Build per-item sort positions: itemId → { categoryId → sortOrder }
  const sortByItem = new Map<string, Record<string, number>>();
  for (const cat of rows) {
    const cid = String(cat.category_id ?? '').trim();
    if (!cid) continue;
    for (const row of cat.items ?? []) {
      const iid = String(row.itemID ?? row.itemId ?? '').trim();
      if (!iid) continue;
      if (!extraByItem.has(iid)) extraByItem.set(iid, new Set());
      extraByItem.get(iid)!.add(cid);
      if (row.sortOrder != null) {
        if (!sortByItem.has(iid)) sortByItem.set(iid, {});
        sortByItem.get(iid)![cid] = row.sortOrder;
      }
    }
  }
  return items.map((item) => {
    const extra = extraByItem.get(item.id);
    const sortPositions = sortByItem.get(item.id);
    if ((!extra || extra.size === 0) && !sortPositions) return item;
    const merged = new Set(item.categoryIds);
    if (extra) Array.from(extra).forEach((c) => merged.add(c));
    return {
      ...item,
      categoryIds: Array.from(merged),
      ...(sortPositions ? { categorySortPositions: { ...(item.categorySortPositions ?? {}), ...sortPositions } } : {}),
    };
  });
}

export function mapApiItemToMenuItem(api: ApiItemRow): MenuItem {
  const id =
    String(api.itemId ?? api.id ?? '')
      .trim() || `item-${Math.random().toString(36).slice(2)}`;
  const categoryIds = Array.isArray(api.categories)
    ? api.categories.map((c) => String(c.id ?? '').trim()).filter(Boolean)
    : [];

  const pricing = api.pricing;
  let basePrice = numPrice(pricing?.basePrice ?? null);
  const costPriceRaw = pricing?.costPrice;
  let costPrice: number | undefined;
  if (costPriceRaw !== undefined && costPriceRaw !== null && costPriceRaw !== '') {
    const n = Number(costPriceRaw);
    if (Number.isFinite(n)) costPrice = n;
  }
  const channelPrices: Partial<Record<OrderType, number>> = {};
  const visibilityPerOrderType: Partial<Record<OrderType, boolean>> = {};
  const availabilityPerOrderType: Partial<Record<OrderType, boolean>> = {};
  const inactiveModePerOrderType: Partial<Record<OrderType, string | null>> = {};
  const inactiveUntilTimePerOrderType: Partial<Record<OrderType, string | null>> = {};
  const channelsByOrderTypeId: Record<string, {
    enabled: boolean;
    availabilityEnabled: boolean;
    inactiveMode?: string | null;
    inactiveUntilTime?: string | null;
    price?: number;
    name?: string;
  }> = {};
  const channels = Array.isArray(pricing?.channels) ? pricing.channels : [];
  for (const ch of channels) {
    const oid = String(ch.orderTypeId ?? '').trim();
    if (oid) {
      const priceNum = ch.price != null ? Number(ch.price) : undefined;
      channelsByOrderTypeId[oid] = {
        enabled: Boolean(ch.enabled),
        availabilityEnabled: ch.availabilityEnabled !== false,
        inactiveMode: ch.inactiveMode ?? null,
        inactiveUntilTime: ch.inactiveUntilTime ?? null,
        price: priceNum != null && Number.isFinite(priceNum) ? priceNum : undefined,
        name: ch.name,
      };
    }
    const ot = mapApiOrderTypeToKey(ch.orderTypeId, ch.name);
    if (!ot) continue;
    if (ch.enabled) {
      const p = ch.price != null ? Number(ch.price) : basePrice;
      channelPrices[ot] = Number.isFinite(p) ? p : basePrice;
    }
    if (ch.enabled !== undefined) {
      visibilityPerOrderType[ot] = Boolean(ch.enabled);
    }
    if (ch.availabilityEnabled !== undefined) {
      availabilityPerOrderType[ot] = ch.availabilityEnabled !== false;
    }
    inactiveModePerOrderType[ot] = ch.inactiveMode ?? null;
    inactiveUntilTimePerOrderType[ot] = ch.inactiveUntilTime ?? null;
  }

  const apiRecord = api as Record<string, unknown>;
  const inv = (apiRecord.inventory as Record<string, unknown> | null | undefined) ?? null;
  const inventoryTracking =
    inv && typeof inv === 'object'
      ? {
          enabled: inv.is_inventory_tracking === true || inv.enabled === true,
          trackingMode:
            inv.mode === 'availability' || inv.mode === 'count'
              ? (inv.mode as 'count' | 'availability')
              : ('count' as const),
          currentStock:
            inv.currentStock == null ? undefined : (Number(inv.currentStock) as number),
          lowStockThreshold:
            inv.lowStockAlert == null ? undefined : (Number(inv.lowStockAlert) as number),
          defaultStockQuantity:
            inv.defaultStockQuantity == null ? undefined : (Number(inv.defaultStockQuantity) as number),
          unitType: inv.unit == null ? undefined : String(inv.unit),
          stockResetMode:
            inv.stockResetMode === 'auto_reset' ||
            inv.stockResetMode === 'clear_stocks' ||
            inv.stockResetMode === 'carry_forward'
              ? (inv.stockResetMode as 'carry_forward' | 'auto_reset' | 'clear_stocks')
              : 'auto_reset', // legacy null / unknown → auto_reset (first option)
        }
      : undefined;
  const kotEntries = Array.isArray(apiRecord.kotordertype)
    ? (apiRecord.kotordertype as Array<{ orderTypeId?: string; isKot?: boolean }>)
    : [];
  const kotByOrderType: Partial<Record<OrderType, boolean>> = {};
  for (const row of kotEntries) {
    const oid = String(row.orderTypeId ?? '').trim();
    if (!oid) continue;
    const ch = channels.find((c) => String(c.orderTypeId ?? '').trim() === oid);
    const ot = ch ? mapApiOrderTypeToKey(ch.orderTypeId, ch.name) : mapApiOrderTypeToKey(oid, '');
    if (!ot) continue;
    kotByOrderType[ot] = row.isKot === true;
  }
  if (basePrice === 0 && channels.length > 0) {
    const first = channels.find((c) => c.enabled && c.price != null);
    if (first) basePrice = Number(first.price);
  }

  const kitchens = api.kitchenDetails?.kitchens ?? [];
  const kitchenStationIdList: string[] = [];
  const kitchenSeen = new Set<string>();
  for (const k of kitchens) {
    const kid = String((k as { id?: string }).id ?? '').trim();
    if (!kid || kitchenSeen.has(kid)) continue;
    kitchenSeen.add(kid);
    kitchenStationIdList.push(kid);
  }
  const kitchenStationIds =
    kitchenStationIdList.length > 0 ? kitchenStationIdList : undefined;
  const kitchenStationId = kitchenStationIdList[0];
  const prepRaw =
    api.kitchenDetails?.preparationTimeInMins ??
    (api as Record<string, unknown>).preparationTimeInMins;
  const prepTime = prepRaw != null && prepRaw !== '' ? Number(prepRaw) : 0;

  const media = Array.isArray(api.mediaResponseList) ? [...api.mediaResponseList] : [];
  media.sort((a, b) => {
    const ao = a.sortOrder;
    const bo = b.sortOrder;
    if (ao != null && bo != null) return ao - bo;
    if (ao != null) return -1;
    if (bo != null) return 1;
    return 0;
  });
  const primary = media[0];
  const imageUrl = resolveMediaPath(primary);
  const mediaResponseList = media
    .map((m, idx) => {
      const fileName = resolveMediaPath(m);
      if (!fileName) return null;
      const mid = String(m.id ?? fileName).trim();
      const sortOrder = Number(m.sortOrder ?? idx + 1);
      const mediaType = m.type ? String(m.type) : undefined;
      return {
        id: mid,
        fileName,
        ...(mediaType ? { type: mediaType } : {}),
        ...(m.imageUrl ? { imageUrl: String(m.imageUrl) } : {}),
        ...(m.imageId ? { imageId: String(m.imageId) } : {}),
        ...(m.imageType ? { imageType: String(m.imageType) } : {}),
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : idx + 1,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const modifierIds = Array.isArray(api.modifiers)
    ? api.modifiers
        .map((m) => String(m.modifierId ?? '').trim())
        .filter(Boolean)
    : undefined;

  const tags = Array.isArray(api.tags)
    ? api.tags
        .map((t) => {
          const tid = String((t as Record<string, unknown>).id ?? (t as Record<string, unknown>).tagId ?? '').trim();
          const name = String((t as Record<string, unknown>).name ?? (t as Record<string, unknown>).tagName ?? '').trim();
          if (!tid && !name) return null;
          return { id: tid || name, name: name || tid };
        })
        .filter(Boolean) as { id: string; name: string }[]
    : [];
  const allergens = Array.isArray(api.allergens)
    ? api.allergens
        .map((a) => {
          const aid = String((a as Record<string, unknown>).id ?? (a as Record<string, unknown>).allergenId ?? '').trim();
          const name = String((a as Record<string, unknown>).name ?? (a as Record<string, unknown>).allergenName ?? '').trim();
          if (!aid && !name) return null;
          return { id: aid || name, name: name || aid };
        })
        .filter(Boolean) as { id: string; name: string }[]
    : [];
  const dietaryLabels = Array.isArray(api.diettypes)
    ? api.diettypes
        .map((d) => {
          const did = String((d as Record<string, unknown>).dietaryId ?? d.id ?? '').trim();
          const name = String(d.name ?? '').trim();
          if (!did && !name) return null;
          return { id: did || name, name: name || did };
        })
        .filter(Boolean) as { id: string; name: string }[]
    : [];
  const ingredients = Array.isArray(api.ingredients)
    ? api.ingredients
        .map((i) => {
          const iid = String(i.id ?? '').trim();
          const name = String(i.name ?? '').trim();
          if (!iid && !name) return null;
          return { id: iid || name, name: name || iid };
        })
        .filter(Boolean) as { id: string; name: string }[]
    : [];
  const taxObj = apiRecord.tax as Record<string, unknown> | undefined;
  const apiTaxesArr =
    (apiRecord.taxes as Array<Record<string, unknown>> | undefined) ??
    (Array.isArray(apiRecord.tax) ? (apiRecord.tax as Array<Record<string, unknown>>) : undefined);
  const taxIds: string[] = Array.isArray(apiTaxesArr)
    ? Array.from(
        new Set(
          apiTaxesArr
            .map((t) => String(t?.taxId ?? t?.id ?? '').trim())
            .filter((s) => !!s),
        ),
      )
    : (() => {
        const single = String(
          apiRecord.taxId ??
            apiRecord.taxGroupId ??
            (taxObj && !Array.isArray(taxObj) ? (taxObj.taxId ?? taxObj.id) : '') ??
            '',
        ).trim();
        return single ? [single] : [];
      })();
  const taxGroup = taxIds[0] ?? '';

  const specialInstructionsRaw =
    apiRecord.specialInstructions ??
    apiRecord.specialInstruction ??
    apiRecord.special_instructions;
  const specialInstructions =
    specialInstructionsRaw != null && String(specialInstructionsRaw).trim() !== ''
      ? String(specialInstructionsRaw).trim()
      : undefined;

  const rawRC = (api.kitchenDetails as Record<string, unknown> | undefined)?.revenueClass as
    | { id?: string; revenueClassId?: string; name?: string }
    | undefined
    ?? (api as Record<string, unknown>).revenueClass as
    | { id?: string; revenueClassId?: string; name?: string }
    | undefined;
  const revenueClass = rawRC?.id || rawRC?.revenueClassId
    ? { id: String(rawRC.id ?? rawRC.revenueClassId ?? ''), name: String(rawRC.name ?? '') }
    : undefined;

  const printInMasterKOT =
    api.kitchenDetails?.printInMasterKOT !== undefined
      ? api.kitchenDetails.printInMasterKOT
      : api.printInMasterKOT !== undefined
        ? api.printInMasterKOT
        : false;

  const kotOrderTypes = Object.keys(kotByOrderType) as OrderType[];
  const kotValues = kotOrderTypes.map((k) => kotByOrderType[k] === true);
  let masterKotMode: 'all' | 'none' | 'selected' | undefined;
  let masterKotOrderTypes: OrderType[] | undefined;
  if (kotOrderTypes.length > 0) {
    const allOn = kotValues.length > 0 && kotValues.every(Boolean);
    const allOff = kotValues.every((v) => !v);
    if (allOn) {
      masterKotMode = 'all';
      masterKotOrderTypes = [];
    } else if (allOff) {
      masterKotMode = 'none';
      masterKotOrderTypes = [];
    } else {
      masterKotMode = 'selected';
      masterKotOrderTypes = kotOrderTypes.filter((k) => kotByOrderType[k] === true);
    }
  }

  const seasonalDateRange = api.availability?.seasonalDateRange ?? null;

  const sessionIds = Array.isArray(api.availability?.timeBasedAvailability)
    ? api.availability!.timeBasedAvailability
        .map((s) => {
          const row = s as Record<string, unknown>;
          const raw = row.sessionGroupId ?? row.session_group_id ?? row.sessionId;
          if (raw == null || raw === '') return '';
          return String(raw).trim();
        })
        .filter(Boolean)
    : undefined;

  const sessionSlotIdsBySessionGroupId: Record<string, string[]> = {};
  if (Array.isArray(api.availability?.timeBasedAvailability)) {
    for (const t of api.availability!.timeBasedAvailability!) {
      const row = t as Record<string, unknown>;
      const gid = String(row.sessionGroupId ?? row.session_group_id ?? row.sessionId ?? '').trim();
      if (!gid) continue;
      const slots = Array.isArray(row.sessionSlot) ? row.sessionSlot : [];
      const ids = slots
        .map((s) => {
          if (typeof s === 'string') return s.trim();
          const o = s as Record<string, unknown>;
          return String(o.slotId ?? o.id ?? '').trim();
        })
        .filter(Boolean);
      if (ids.length) sessionSlotIdsBySessionGroupId[gid] = ids;
    }
  }

  let sessionNames: string[] | undefined;
  if (Array.isArray(api.availability?.timeBasedAvailability)) {
    const seen = new Set<string>();
    sessionNames = [];
    for (const t of api.availability!.timeBasedAvailability!) {
      const n = String(t.name ?? '').trim();
      if (!n || seen.has(n)) continue;
      seen.add(n);
      sessionNames.push(n);
    }
    if (sessionNames.length === 0) sessionNames = undefined;
  }

  const containsAlcohol =
    parseApiBool(api.containsAlcohol) ||
    parseApiBool(apiRecord.contains_alcohol);

  return {
    id,
    name: String(api.name ?? ''),
    status: feStatusFromItemCreationStatus(api.itemCreationStatus) as ItemStatus,
    itemCode: String(api.pluCode ?? ''),
    itemType: apiNumericItemTypeToFe(api.itemType),
    basePrice,
    costPrice,
    channelPrices,
    categoryIds,
    imageUrl,
    mediaResponseList,
    description: String(api.description ?? ''),
    allergens,
    dietaryLabels,
    tags,
    ingredients,
    nutrition: api.nutrition ?? undefined,
    prepTime: Number.isFinite(prepTime) ? prepTime : 0,
    kitchenStationId,
    ...(kitchenStationIds ? { kitchenStationIds } : {}),
    createdAt: new Date().toISOString(),
    modifierIds,
    kitchenName: (() => {
      const raw = (api as Record<string, unknown>).kitchenName;
      if (raw == null || String(raw).trim() === '') return undefined;
      return String(raw).trim();
    })(),
    taxGroup: taxGroup || undefined,
    taxIds: taxIds.length ? taxIds : undefined,
    visibilityPerOrderType:
      Object.keys(visibilityPerOrderType).length > 0 ? visibilityPerOrderType : undefined,
    availabilityPerOrderType:
      Object.keys(availabilityPerOrderType).length > 0 ? availabilityPerOrderType : undefined,
    inactiveModePerOrderType:
      Object.keys(inactiveModePerOrderType).length > 0 ? inactiveModePerOrderType : undefined,
    inactiveUntilTimePerOrderType:
      Object.keys(inactiveUntilTimePerOrderType).length > 0 ? inactiveUntilTimePerOrderType : undefined,
    channelsByOrderTypeId:
      Object.keys(channelsByOrderTypeId).length > 0 ? channelsByOrderTypeId : undefined,
    printInMasterKOT,
    kotExcludedOrderTypeIds: Array.isArray((api as Record<string, unknown>).kotExcludedOrderTypeIds)
      ? ((api as Record<string, unknown>).kotExcludedOrderTypeIds as unknown[]).map((v) => String(v))
      : [],
    revenueClass,
    bestPairedItems: Array.isArray((api as Record<string, unknown>).bestPairedItems)
      ? ((api as Record<string, unknown>).bestPairedItems as Array<{ itemId?: string; sortOrder?: number }>)
          .filter((bp) => bp.itemId)
          .map((bp, idx) => ({ itemId: String(bp.itemId), sortOrder: bp.sortOrder ?? idx + 1 }))
      : undefined,
    unit: (() => {
      const rawUnit = (api as Record<string, unknown>).unit as { unitId?: string; type?: string } | null | undefined;
      if (!rawUnit?.unitId) return undefined;
      return { unitId: String(rawUnit.unitId), type: String(rawUnit.type ?? '') };
    })(),
    seasonalDateRange,
    sessionIds,
    ...(Object.keys(sessionSlotIdsBySessionGroupId).length > 0
      ? { sessionSlotIdsBySessionGroupId }
      : {}),
    ...(sessionNames && sessionNames.length > 0 ? { sessionNames } : {}),
    containsAlcohol,
    isAgeRestricted: parseApiBool(apiRecord.isAgeRestricted),
    isTableSide: apiRecord.isTableSide != null ? parseApiBool(apiRecord.isTableSide) : undefined,
    isOrderStation: apiRecord.isOrderStation != null ? parseApiBool(apiRecord.isOrderStation) : undefined,
    isMenuStation: apiRecord.isMenuStation != null ? parseApiBool(apiRecord.isMenuStation) : undefined,
    isCdMenu: apiRecord.isCdMenu != null ? parseApiBool(apiRecord.isCdMenu) : undefined,
    minAge: apiRecord.minimumAge != null ? Number(apiRecord.minimumAge) : undefined,
    ...(inventoryTracking ? { inventoryTracking } : {}),
    ...(specialInstructions ? { specialInstructions } : {}),
    ...(masterKotMode ? { masterKotMode, masterKotOrderTypes } : {}),
    // Catering — maps the nested `catering` block (mhc_items + mhc_item_bulkprice) returned by the item API.
    ...(() => {
      const c = apiRecord.catering as
        | null
        | {
            enabled?: boolean;
            serveCount?: number | string;
            minQtyRequired?: number | string;
            maxQtyRequired?: number | string | null;
            bulkPrices?: Array<{
              id?: string;
              unitLabel?: string;
              serveCount?: number | string;
              unitPrice?: number | string;
            }>;
          }
        | undefined;
      if (!c || !c.enabled) return {};
      return {
        cateringEnabled: true,
        cateringServesCount: c.serveCount != null ? Number(c.serveCount) : undefined,
        cateringMinOrderQty: c.minQtyRequired != null ? Number(c.minQtyRequired) : undefined,
        cateringMaxOrderQty: c.maxQtyRequired != null ? Number(c.maxQtyRequired) : undefined,
        cateringPricingTiers: Array.isArray(c.bulkPrices)
          ? c.bulkPrices.map((b) => ({
              id: b.id ? String(b.id) : undefined,
              label: b.unitLabel != null ? String(b.unitLabel) : undefined,
              servesCount: b.serveCount != null ? Number(b.serveCount) : undefined,
              price: Number(b.unitPrice ?? 0),
            }))
          : [],
      };
    })(),
  };
}
