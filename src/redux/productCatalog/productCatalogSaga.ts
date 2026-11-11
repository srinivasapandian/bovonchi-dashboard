import { all, call, put, select, takeEvery, takeLatest } from 'redux-saga/effects';
import type { SagaIterator } from '@redux-saga/types';
import { PC } from './productCatalogConstants';
import * as A from './productCatalogActions';
import type { RootState } from '../store';
import { CREDENTIALS } from '../../constants';
import { mapApiGetCategoriesToCategories } from '../../components/productCatalog/mappers/categoryMapper';
import {
  mapApiItemToMenuItem,
  mergeItemCategoryIdsFromCategoriesResponse,
} from '../../components/productCatalog/mappers/itemsMapper';
import {
  getItemsApi,
  getCategoriesCatalogApi,
  createItemApi,
  updateItemApi,
  deleteItemApi,
  bulkDeleteItemsApi,
  validateItemCodeApi,
  uploadItemImageApi,
  removeItemImageApi,
  getKitchenStationsApi,
  createKitchenStationApi,
  updateKitchenStationApi,
  deleteKitchenStationApi,
  getItemAttributesApi,
  type ApiKitchenStationRow,
} from '../../services/itemCatalogApi';
import {
  getCategoriesApi,
  createCategoryApi,
  updateCategoryApi,
  deleteCategoryApi,
  uploadCategoryImageApi,
  sortCategoryApi,
  getModuleListApi,
} from '../../services/categoryCatalogApi';
import {
  listCategoryGroupsApi,
  createCategoryGroupApi,
  updateCategoryGroupApi,
  deleteCategoryGroupApi,
  type ApiCategoryGroupListResponse,
} from '../../services/menuCatalogApi';
import { getSessionsApi, createSessionApi, updateSessionApi, deleteSessionApi } from '../../services/sessionCatalogApi';
import {
  getModifiersApi,
  createModifierApi,
  updateModifierApi,
  deleteModifierApi,
  type ApiModifier,
  type ApiModifierOption,
} from '../../services/modifierCatalogApi';
import {
  createComboApi,
  deleteComboApi,
  getCombosApi,
  updateComboApi,
  type ApiCombo,
} from '../../services/comboCatalogApi';
import {
  getOptionSetsApi,
  createOptionSetApi,
  updateOptionSetApi,
  deleteOptionSetApi,
  type ApiOptionSet,
} from '../../services/optionSetCatalogApi';
import { triggerSyncApi, SyncTriggerError } from '../../services/syncCatalogApi';
import { requestSyncWatch } from '../../components/productCatalog/features/syncHistory/syncWatchBus';
import { markProductCatalogSyncNeeded } from '../../components/productCatalog/store/syncNeeded';
import type { Menu, MenuStatus, OrderType } from '../../components/productCatalog/data/types';
import type { Session } from '../../components/productCatalog/data/types';
import type { ModifierGroup, ModifierOption } from '../../components/productCatalog/data/types';
import type { Combo, ItemStatus, OrderType as OT } from '../../components/productCatalog/data/types';
import type { OptionSet } from '../../components/productCatalog/data/types';
import type { KitchenStation } from '../../components/productCatalog/data/types';
import type { ItemAttribute } from '../../components/productCatalog/data/types';
import type { TaxOption } from './productCatalogTypes';
import type { AttrType } from './productCatalogTypes';

function getUserIdFromCredentials(): string {
  try {
    const raw = localStorage.getItem(CREDENTIALS);
    if (!raw) return '';
    const stored = JSON.parse(raw);
    const cred = stored?.credentials ?? stored;
    console.log({cred});
    
    return String(cred?.id ?? '');
  } catch {
    return '';
  }
}

let cachedItems: ReturnType<typeof mapApiItemToMenuItem>[] | null = null;
let cachedItemsLocationId: string | null = null;
let itemsFetchInflight: Record<string, Promise<{ items: any; categories: any }>> = {};

let cachedCategories: ReturnType<typeof mapApiGetCategoriesToCategories> | null = null;
let cachedCategoriesLocationId: string | null = null;
let categoriesFetchInflight: Record<string, Promise<any>> = {};

/** Dedupe concurrent attribute fetches (e.g. React StrictMode double mount). */
type AttrFetchResult = {
  results: Partial<Record<AttrType, ItemAttribute[] | TaxOption[]>>;
  errors: Partial<Record<AttrType, string>>;
};
let attributesFetchByKey: Record<string, Promise<AttrFetchResult>> = {};

let moduleListFetchInflight: Record<string, Promise<unknown[]>> = {};

function mapCategoryGroupsToMenus(resp: ApiCategoryGroupListResponse): Menu[] {
  const list = Array.isArray(resp.categoryGroups) ? resp.categoryGroups : [];
  const normalizeOrderTypeName = (value: string) => value.toLowerCase().replace(/[\s-]+/g, '_').trim();
  const mapApiOrderTypeToKey = (rawName?: string, rawTypeGroup?: string): OrderType | null => {
    const name = normalizeOrderTypeName(rawName ?? '');
    const source = `${name} ${(rawTypeGroup ?? '').toUpperCase()}`;
    if (/(dine|dining|walk_in|walkin|eat_in|\bD\b)/.test(source)) return 'dine_in';
    if (/(takeout|take_out|pickup|pick_up|\bP\b)/.test(source)) return 'takeout';
    if (/delivery|\bS\b/.test(source)) return 'delivery';
    if (/(online|gloriafood|web|app|digital|\bO\b)/.test(source)) return 'online_ordering';
    if (/(catering|cater)/.test(source)) return 'catering';
    return null;
  };
  return list
    .map((g) => {
      const id = String(g.id ?? '').trim();
      if (!id) return null;
      const name = String(g.name ?? '').trim() || 'Untitled';
      const description = (g.description ?? '') ? String(g.description) : '';
      const icon = g.icon ? String(g.icon) : undefined;
      const activeOn = g.activeOn ? String(g.activeOn) : null;
      const statusRaw = String(g.status ?? 'draft').toLowerCase();
      const status: Menu['status'] =
        statusRaw === 'schedule' || statusRaw === 'scheduled'
          ? 'scheduled'
          : statusRaw === 'active' || statusRaw === 'live'
            ? activeOn && new Date(activeOn).getTime() > Date.now()
              ? 'scheduled'
              : 'live'
            : 'draft';
      const categoryIds = (g.categories ?? [])
        .filter((c) => c?.enabled !== false)
        .map((c) => String(c.categoryId ?? c.id ?? '').trim())
        .filter(Boolean);
      const deviceIds = (g.devices ?? [])
        .filter((d) => d?.enabled !== false)
        .map((d) => String(d.deviceId ?? d.id ?? '').trim())
        .filter(Boolean);
      const enabledOrderTypes = (g.orderTypes ?? []).filter((ot) => ot?.enabled !== false);
      const assignedOrderTypeIds = enabledOrderTypes
        .map((ot) => String(ot.id ?? ot.orderTypeId ?? '').trim())
        .filter(Boolean);
      const channels = enabledOrderTypes
        .map((ot) => mapApiOrderTypeToKey(ot.orderTypeName, ot.typeGroup))
        .filter((x): x is OrderType => Boolean(x));
      const individualItemIds = (g.items ?? [])
        .filter((it) => it?.enabled !== false)
        .map((it) => String(it.itemId ?? it.id ?? '').trim())
        .filter(Boolean);
      return {
        id,
        name,
        description,
        icon,
        status,
        categoryIds,
        categoryCount: categoryIds.length,
        individualItemIds,
        channels,
        assignedOrderTypeIds,
        deviceIds,
        sessionIds: [],
        goLiveDate: activeOn,
        lastUpdated: new Date().toISOString(),
      } as Menu;
    })
    .filter((x): x is Menu => Boolean(x));
}

let cachedMenus: Menu[] | null = null;
let cachedMenusLocationId: string | null = null;
let menusFetchInflight: Record<string, Promise<Menu[]>> = {};

function tidSessionField(v: unknown): string | undefined {
  if (v == null) return undefined;
  const t = String(v).trim();
  return t || undefined;
}

function mapApiSessionToLocal(apiSession: import('../../services/sessionCatalogApi').ApiSession): Session {
  const WEEKDAY_MAP: Record<string, string> = {
    '1': 'Monday',
    '2': 'Tuesday',
    '3': 'Wednesday',
    '4': 'Thursday',
    '5': 'Friday',
    '6': 'Saturday',
    '7': 'Sunday',
  };
  const normalizeTime = (value?: string): string => {
    if (!value) return '00:00';
    const clean = value.trim();
    if (/^\d{2}:\d{2}:\d{2}$/.test(clean)) return clean.slice(0, 5);
    if (/^\d{2}:\d{2}$/.test(clean)) return clean;
    return '00:00';
  };
  type ApiSessionSlot = NonNullable<import('../../services/sessionCatalogApi').ApiSession['sessionSlot']>[number];
  const ALL_WEEKDAYS = Object.values(WEEKDAY_MAP);
  /** `weekday: "0"` means "all days" — expand to one slot per weekday with the same time range. */
  const mapSlotDays = (slot: ApiSessionSlot): string[] => {
    const weekdayRaw = slot.weekday != null ? String(slot.weekday).trim() : '';
    if (weekdayRaw === '0') return [...ALL_WEEKDAYS];
    if (WEEKDAY_MAP[weekdayRaw]) return [WEEKDAY_MAP[weekdayRaw]];
    const dayRaw = (slot.day ?? '').toString().trim();
    if (!dayRaw) return [];
    if (dayRaw.toLowerCase() === 'all') return [...ALL_WEEKDAYS];
    const normalized = `${dayRaw[0]?.toUpperCase() ?? ''}${dayRaw.slice(1).toLowerCase()}`;
    return ALL_WEEKDAYS.includes(normalized) ? [normalized] : [];
  };
  const slotList = Array.isArray(apiSession.sessionSlot) ? apiSession.sessionSlot : [];
  const slotsFromApi: { id: string; days: string[]; startTime: string; endTime: string }[] = [];
  slotList.forEach((slot, index) => {
    const days = mapSlotDays(slot);
    if (days.length === 0) return;
    const startTime = normalizeTime(slot.start_time ?? slot.startTime);
    const endTime = normalizeTime(slot.end_time ?? slot.endTime);
    const baseId = String(slot.id ?? `${startTime}|${endTime}-${index}`);
    // weekday "0" → single slot with all 7 days (maps to daySelection:'all' in UI)
    // weekday 1-7 → single-day slot
    slotsFromApi.push({ id: baseId, days, startTime, endTime });
  });
  const extractSessionAssignedItemId = (x: unknown): string | undefined => {
    if (x == null) return undefined;
    if (typeof x === 'string') return tidSessionField(x);
    if (typeof x !== 'object') return undefined;
    const o = x as Record<string, unknown>;
    return (
      tidSessionField(o.id) ??
      tidSessionField(o.itemId) ??
      tidSessionField(o.itemID) ??
      tidSessionField(o.item_id)
    );
  };
  const itemsFromApi = Array.isArray(apiSession.items)
    ? apiSession.items
        .map((x) => {
          const itemId = extractSessionAssignedItemId(x);
          if (!itemId) return null;
          const raw = typeof x === 'object' && x != null ? (x as Record<string, unknown>) : null;
          const name = raw ? String(raw.name ?? '').trim() : '';
          const rawPrice = raw?.sessionPrice;
          const sessionPrice =
            rawPrice != null && !Number.isNaN(Number(rawPrice)) ? Number(rawPrice) : undefined;
          return { id: itemId, name, ...(sessionPrice != null ? { sessionPrice } : {}) };
        })
        .filter((row): row is { id: string; name: string; sessionPrice?: number } => row != null)
    : [];
  const assignedIdsLegacy = Array.isArray(apiSession.assignedItems)
    ? apiSession.assignedItems
        .map((x) =>
          typeof x === 'string'
            ? tidSessionField(x)
            : tidSessionField(x?.itemId ?? x?.itemID ?? x?.item_id),
        )
        .filter((x): x is string => Boolean(x))
    : [];
  const fromAssignedSessionItems = Array.isArray(apiSession.assignedSessionItems)
    ? apiSession.assignedSessionItems
        .map((x) => extractSessionAssignedItemId(x))
        .filter((x): x is string => Boolean(x))
    : [];
  const assignedItemIdSet = new Set<string>();
  itemsFromApi.forEach((r) => assignedItemIdSet.add(r.id));
  assignedIdsLegacy.forEach((id) => assignedItemIdSet.add(id));
  fromAssignedSessionItems.forEach((id) => assignedItemIdSet.add(id));
  const assignedItemIds = Array.from(assignedItemIdSet);
  const matchIdSet = new Set<string>();
  for (const v of [
    apiSession.sessionGroupId,
    apiSession.session_group_id,
    apiSession.sessionId,
    apiSession.session_id,
    apiSession.id,
  ]) {
    const t = tidSessionField(v);
    if (t) matchIdSet.add(t);
  }
  const sessionId =
    tidSessionField(apiSession.sessionGroupId) ??
    tidSessionField(apiSession.session_group_id) ??
    tidSessionField(apiSession.sessionId) ??
    tidSessionField(apiSession.session_id) ??
    tidSessionField(apiSession.id) ??
    `session-${Date.now()}`;
  matchIdSet.add(sessionId);
  const groupForField =
    tidSessionField(apiSession.sessionGroupId) ?? tidSessionField(apiSession.session_group_id);
  return {
    id: sessionId,
    name: String(apiSession.name ?? ''),
    slots: slotsFromApi,
    assignedItemCount: Number(apiSession.itemCount ?? apiSession.assignedItemCount ?? assignedItemIds.length ?? 0),
    assignedItemIds,
    assignedSessionItems:
      itemsFromApi.length > 0
        ? itemsFromApi
        : assignedItemIds.length > 0
          ? assignedItemIds.map((id) => ({ id, name: '' }))
          : undefined,
    ...(groupForField ? { sessionGroupId: groupForField } : {}),
    sessionMatchIds: Array.from(matchIdSet),
    color: apiSession.color || undefined,
    description: apiSession.description ?? '',
    isDefault: Boolean(apiSession.isDefault ?? apiSession.is_default ?? false),
    deviceCount: Number(apiSession.deviceCount ?? 0),
  };
}

let cachedSessions: Session[] | null = null;
let cachedSessionsLocationId: string | null = null;
let sessionsFetchInflight: Record<string, Promise<Session[]>> = {};

function toBool(val?: number | boolean): boolean {
  if (typeof val === 'boolean') return val;
  return val === 1;
}
function mapApiOptionToLocal(opt: ApiModifierOption, index: number): ModifierOption {
  const serverOptionId =
    (typeof opt.modifierOption_id === 'string' && opt.modifierOption_id.trim()) ||
    (typeof opt.optionId === 'string' && opt.optionId.trim()) ||
    '';
  return {
    id: serverOptionId || `opt-${index}`,
    name: opt.name ?? '',
    isAvailable: toBool(opt.enable ?? opt.isEnabled ?? opt.isVisible ?? 1),
    price: opt.price != null ? Number(opt.price) : undefined,
    kitchenName: opt.kitchenName ?? '',
    isDefault: toBool(opt.isDefault),
    isOnline: toBool(opt.isVisible ?? 1),
  };
}
function mapApiModifierToLocal(api: ApiModifier): ModifierGroup {
  const options = Array.isArray(api.modifierOption) ? api.modifierOption.map(mapApiOptionToLocal) : [];
  const behavior = api.behaviorOptions ?? {};
  const minSelection = Number(behavior.minimumSelection ?? 0);
  const maxSelection = Number(behavior.maximumSelection ?? 1);
  const isRequired = Boolean(behavior.isRequired ?? minSelection > 0);
  const allowMultiple = maxSelection > 1;
  const serverModifierId =
    (typeof api.modifierId === 'string' && api.modifierId.trim()) ||
    (typeof api.modifier_id === 'string' && api.modifier_id.trim()) ||
    (typeof api.id === 'string' && api.id.trim()) ||
    '';
  return {
    id: serverModifierId || `mod-${Date.now()}`,
    name: api.name ?? '',
    displayName: api.displayName ?? api.name ?? '',
    type: 'options_list',
    isRequired,
    allowMultiple,
    minSelection,
    maxSelection,
    options,
    appliedItemCount: api.assignedItemCount ?? (Array.isArray(api.assignedItems) ? api.assignedItems.length : 0),
    assignedItems: Array.isArray(api.assignedItems)
      ? api.assignedItems.map((item) =>
          typeof item === 'string'
            ? { id: item, name: '' }
            : { id: item.itemID ?? '', name: item.itemName ?? '' },
        ).filter((i) => i.id)
      : [],
    channelVisibility: Array.isArray(api.channelVisibility)
      ? api.channelVisibility
          .filter((cv) => typeof cv?.orderTypeId === 'string' && cv.orderTypeId.trim().length > 0)
          .map((cv) => ({
            orderTypeId: String(cv.orderTypeId),
            enabled: Boolean(cv.enabled),
          }))
      : [],
  };
}

let cachedModifiers: ModifierGroup[] | null = null;
let cachedModifiersLocationId: string | null = null;
let modifiersFetchInflight: Record<string, Promise<ModifierGroup[]>> = {};

function normalizeOrderTypeNameCombo(value: string): string {
  return value.toLowerCase().replace(/[\s-]+/g, '_').trim();
}
function mapApiOrderTypeToKeyCombo(rawId?: string): OT | null {
  const source = normalizeOrderTypeNameCombo(rawId ?? '');
  if (/(dine|dining|walk_in|walkin|eat_in)/.test(source)) return 'dine_in';
  if (/(takeout|take_out|pickup|pick_up)/.test(source)) return 'takeout';
  if (/delivery/.test(source)) return 'delivery';
  if (/(online|gloriafood|web|app|digital)/.test(source)) return 'online_ordering';
  if (/(catering|cater)/.test(source)) return 'catering';
  return null;
}
function mapComboStatus(raw?: string): ItemStatus {
  const s = String(raw ?? '').toUpperCase();
  if (s === 'ACTIVE') return 'active';
  if (s === 'ARCHIVED') return 'archived';
  return 'draft';
}
function mapApiComboToLocal(api: ApiCombo): Combo {
  const slots = (api.slots ?? []).map((slot, idx) => ({
    id: String(slot.id ?? slot.slotId ?? `slot-${idx}-${Date.now()}`),
    slotName: String(slot.slotName ?? slot.slot_name ?? ''),
    slotType: (
      String(slot.slotType ?? slot.slot_type ?? 'REQUIRED').toUpperCase() === 'OPTIONAL'
        ? 'optional'
        : 'required'
    ) as 'required' | 'optional',
    minSelections: Number(slot.minSelections ?? slot.min_selections ?? 0),
    maxSelections: Number(slot.maxSelections ?? slot.max_selections ?? 1),
    defaultItemId: String(slot.defaultItemId ?? slot.default_item_id ?? '').trim() || undefined,
    defaultVariationId:
      String(slot.defaultVariationId ?? slot.default_variation_id ?? '').trim() || undefined,
    sortPosition: Number(slot.sortOrder ?? slot.sort_order ?? idx),
    eligibleItems: (slot.eligibleItems ?? []).map((ei) => ({
      itemId: String(ei.itemId ?? ei.item_id ?? ''),
      supplementPrice: Number(ei.supplementPrice ?? ei.supplement_price ?? 0),
    })),
  }));
  const orderTypeVisibility: Partial<Record<OT, boolean>> = {};
  const orderTypeAvailability = (api.orderTypeAvailability ?? [])
    .map((row) => {
      const orderTypeId = String(row.orderTypeId ?? row.order_type_id ?? '').trim();
      if (!orderTypeId) return null;
      return {
        orderTypeId,
        isEnable: Boolean(row.isEnable ?? row.is_enable ?? false),
      };
    })
    .filter((x): x is { orderTypeId: string; isEnable: boolean } => x !== null);
  for (const row of orderTypeAvailability) {
    const key = mapApiOrderTypeToKeyCombo(row.orderTypeId);
    if (!key) continue;
    orderTypeVisibility[key] = row.isEnable;
  }
  return {
    id: String(api.id ?? `combo-${Date.now()}`),
    itemId: String(api.itemId ?? api.item_id ?? '').trim() || undefined,
    name: String(api.name ?? ''),
    displayName: String(api.displayName ?? api.display_name ?? '').trim() || undefined,
    description: String(api.description ?? '').trim() || undefined,
    comboCode: String(api.comboCode ?? api.combo_code ?? '').trim(),
    pricingModel:
      String(api.pricingModel ?? api.pricing_model ?? 'FIXED').toUpperCase() === 'DYNAMIC'
        ? 'dynamic'
        : 'fixed',
    basePrice: Number(api.basePrice ?? api.base_price ?? 0),
    status: mapComboStatus(api.status),
    orderTypeVisibility,
    orderTypeAvailability,
    slots,
    modifierIds: (api.modifiers ?? [])
      .map((m) => String(m.modifierId ?? m.modifier_id ?? '').trim())
      .filter(Boolean),
    createdAt: new Date().toISOString(),
  };
}

let cachedCombos: Combo[] | null = null;
let cachedCombosLocationId: string | null = null;
let combosFetchInflight: Record<string, Promise<Combo[]>> = {};

function mapApiOptionSetToUi(row: ApiOptionSet, fallbackIndex: number): OptionSet | null {
  const id = String(row.templateId ?? row.id ?? '').trim();
  const name = String(row.name ?? '').trim();
  if (!id && !name) return null;
  const options = Array.isArray(row.options) ? [...row.options] : [];
  options.sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999));
  return {
    id: id || `option-set-${fallbackIndex}`,
    name: name || id || `Option Set ${fallbackIndex + 1}`,
    displayName: row.displayName ? String(row.displayName).trim() : undefined,
    itemCount: Number(row.itemCount ?? row.linkedItemCount ?? row.assignedItemCount ?? 0) || 0,
    options: options
      .map((o, idx) => {
        const optId = String(o.optionId ?? o.id ?? '').trim() || `opt-${fallbackIndex}-${idx}`;
        const optName = String(o.name ?? '').trim();
        if (!optId && !optName) return null;
        const price = o.price != null ? Number(o.price) : undefined;
        return {
          id: optId || optName,
          name: optName || optId,
          price: Number.isFinite(price as number) ? (price as number) : undefined,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  };
}

let cachedOptionSets: OptionSet[] | null = null;
let cachedOptionSetsLocationId: string | null = null;
let optionSetsFetchInflight: Record<string, Promise<OptionSet[]>> = {};

function normalizeStationsPayload(rows: ApiKitchenStationRow[]): KitchenStation[] {
  const mapped = rows
    .map((item, index) => {
      const id = String(item.id ?? '').trim();
      const name = String(item.stationName ?? '').trim();
      const code = String(item.stationCode ?? '').trim();
      const description = String(item.description ?? '').trim();
      if (!id && !name) return null;
      return {
        id: id || `station-${index}`,
        name: name || id || `Station ${index + 1}`,
        code: code || `STN${String(index + 1).padStart(2, '0')}`,
        description,
        color: '#B89550',
        itemCount: Array.isArray(item.items) ? item.items.length : 0,
        assignedItemIds: Array.isArray(item.items)
          ? item.items
              .map((row) => String(row.itemId ?? '').trim())
              .filter(Boolean)
          : [],
        assignedItems: Array.isArray(item.items)
          ? item.items
              .map((row) => {
                const rowId = String(row.itemId ?? '').trim();
                if (!rowId) return null;
                return {
                  id: rowId,
                  name: String(row.name ?? '').trim(),
                  productCode: row.productCode ?? null,
                };
              })
              .filter((row): row is { id: string; name: string; productCode: string | null } => row !== null)
          : [],
        isDefault: false,
        displayOrder: index + 1,
      } as KitchenStation;
    })
    .filter((x): x is KitchenStation => Boolean(x));
  if (mapped.length === 0) return [];
  return mapped.sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
}

let cachedStations: KitchenStation[] | null = null;
let cachedStationsLocationId: string | null = null;
let stationsFetchInflight: Record<string, Promise<KitchenStation[]>> = {};

function normalizeAttrList(data: unknown): ItemAttribute[] {
  let arr: unknown[] = [];
  if (Array.isArray(data)) {
    arr = data;
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.data)) arr = obj.data;
    else if (Array.isArray(obj.content)) arr = obj.content;
    else if (Array.isArray(obj.units)) arr = obj.units;
    else if (Array.isArray(obj.tags)) arr = obj.tags;
    else if (Array.isArray(obj.ingredients)) arr = obj.ingredients;
    else if (Array.isArray(obj.allergens)) arr = obj.allergens;
    else if (Array.isArray(obj.diet)) arr = obj.diet;
    // nested: { data: { units: [...] } }
    else if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      const inner = obj.data as Record<string, unknown>;
      const innerArr = inner.units ?? inner.tags ?? inner.ingredients ?? inner.allergens ?? inner.diet ?? inner.content;
      if (Array.isArray(innerArr)) arr = innerArr;
    }
  }
  return arr
    .map((item: unknown) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = String(
        row.id ??
          row._id ??
          row.unitId ??
          row.revenueClassId ??
          row.tagId ??
          row.ingredientId ??
          row.allergenId ??
          row.dietId ??
          row.dietaryId ??
          '',
      ).trim();
      const name = String(row.name ?? row.unitName ?? row.unit ?? row.label ?? row.symbol ?? row.type ?? '').trim();
      if (!id && !name) return null;
      return { id: id || name, name: name || id };
    })
    .filter(Boolean) as ItemAttribute[];
}

function normalizeTaxList(data: unknown): TaxOption[] {
  let arr: unknown[] = [];
  if (Array.isArray(data)) {
    arr = data;
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.data)) arr = obj.data;
    else if (Array.isArray(obj.content)) arr = obj.content;
  }
  return arr
    .map((item: unknown) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const taxId = String(row.taxId ?? row.id ?? row._id ?? '').trim();
      const name = String(row.name ?? '').trim();
      const type = String(row.type ?? 'PERCENT');
      const rate = Number(row.rate ?? 0);
      if (!taxId && !name) return null;
      const label = type === 'FLATFEE' ? `${name} $${rate}` : `${name} ${rate}%`;
      return { taxId: taxId || name, name, type, rate, label };
    })
    .filter(Boolean) as TaxOption[];
}

const attrTypes: AttrType[] = ['tags', 'ingredients', 'diet', 'allergens', 'tax', 'units', 'revenueClass'];

/** Saga-only item fetch cache (Redux `itemsClearCache` must reset this too). */
function invalidateItemsSagaCacheOnly() {
  cachedItems = null;
  cachedItemsLocationId = null;
  itemsFetchInflight = {};
}

/** Saga-only category fetch cache (Redux `categoriesClearCache` must reset this too). */
function invalidateCategoriesSagaCacheOnly() {
  cachedCategories = null;
  cachedCategoriesLocationId = null;
  categoriesFetchInflight = {};
}

/** Invalidate all cache layers for an entity after CUD — ensures next fetch hits the API. */
function invalidateCategoriesCache() {
  invalidateCategoriesSagaCacheOnly();
  // Also invalidate items cache since fetchItemsWorker fetches both items + categories
  invalidateItemsSagaCacheOnly();
}
function invalidateMenusCache() {
  cachedMenus = null;
  cachedMenusLocationId = null;
  menusFetchInflight = {};
}
function invalidateSessionsCache() {
  cachedSessions = null;
  cachedSessionsLocationId = null;
  sessionsFetchInflight = {};
}
function invalidateModifiersCache() {
  cachedModifiers = null;
  cachedModifiersLocationId = null;
  modifiersFetchInflight = {};
}
function invalidateCombosCache() {
  cachedCombos = null;
  cachedCombosLocationId = null;
  combosFetchInflight = {};
}
function invalidateOptionSetsCache() {
  cachedOptionSets = null;
  cachedOptionSetsLocationId = null;
  optionSetsFetchInflight = {};
}
function invalidateStationsCache() {
  cachedStations = null;
  cachedStationsLocationId = null;
  stationsFetchInflight = {};
}

function invalidateAttributesCache() {
  attributesFetchByKey = {};
}

function invalidateModuleListInflight() {
  moduleListFetchInflight = {};
}

function invalidateAllFetchCaches() {
  invalidateCategoriesCache();
  invalidateMenusCache();
  invalidateSessionsCache();
  invalidateModifiersCache();
  invalidateCombosCache();
  invalidateOptionSetsCache();
  invalidateStationsCache();
  invalidateAttributesCache();
  invalidateModuleListInflight();
}

function* fetchItemsWorker(action: ReturnType<typeof A.fetchItemsRequest>): SagaIterator {
  const { locationId, token, options, deferred } = action.payload;
  const force = Boolean(options?.force);
  try {
    if (!locationId) {
      yield put(A.itemsClearCache());
      yield put(A.categoriesClearCache());
      deferred?.resolve();
      return;
    }
    const state: RootState = yield select();
    const itemsState = state.productCatalog.items;
    if (!force && itemsState.loadedLocationId === locationId) {
      yield put(A.fetchItemsSuccess({ items: itemsState.items, locationId }));
      deferred?.resolve();
      return;
    }
    if (!force && cachedItems && cachedItemsLocationId === locationId && cachedCategories && cachedCategoriesLocationId === locationId) {
      yield put(A.categoriesPrime({ categories: cachedCategories, locationId }));
      yield put(A.fetchItemsSuccess({ items: cachedItems, locationId }));
      yield put(A.fetchCategoriesSuccess({ categories: cachedCategories, locationId }));
      deferred?.resolve();
      return;
    }
    if (force) {
      cachedItems = null;
      cachedItemsLocationId = null;
      cachedCategories = null;
      cachedCategoriesLocationId = null;
      itemsFetchInflight = {};
    }
    yield put(A.categoriesSetLoading({ loading: true, error: null }));
    // In-flight dedup: reuse existing promise if one is already running for this location
    const inflightKey = `${locationId}|${token ?? ''}`;
    if (!itemsFetchInflight[inflightKey]) {
      itemsFetchInflight[inflightKey] = (async () => {
        const [apiItems, catPayload] = await Promise.all([
          getItemsApi(locationId, token),
          getCategoriesCatalogApi(locationId, token),
        ]);
        const mappedCats = mapApiGetCategoriesToCategories(catPayload);
        const mappedItems = mergeItemCategoryIdsFromCategoriesResponse(
          apiItems.map(mapApiItemToMenuItem),
          catPayload,
        );
        return { items: mappedItems, categories: mappedCats };
      })();
      void itemsFetchInflight[inflightKey].finally(() => {
        delete itemsFetchInflight[inflightKey];
      });
    }
    const result = yield call(() => itemsFetchInflight[inflightKey]);
    cachedItems = result.items;
    cachedItemsLocationId = locationId;
    cachedCategories = result.categories;
    cachedCategoriesLocationId = locationId;
    yield put(A.categoriesPrime({ categories: result.categories, locationId }));
    yield put(A.categoriesSetLoading({ loading: false, error: null }));
    yield put(A.fetchItemsSuccess({ items: result.items, locationId }));
    yield put(A.fetchCategoriesSuccess({ categories: result.categories, locationId }));
    deferred?.resolve();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch items';
    yield put(A.categoriesSetLoading({ loading: false, error: null }));
    yield put(A.fetchItemsFailure({ error: msg }));
    yield put(A.fetchCategoriesFailure({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* fetchCategoriesWorker(action: ReturnType<typeof A.fetchCategoriesRequest>): SagaIterator {
  const { locationId, token, options, deferred } = action.payload;
  const force = Boolean(options?.force);
  try {
    if (!locationId) {
      yield put(A.categoriesClearCache());
      deferred?.resolve();
      return;
    }
    const state: RootState = yield select();
    const catState = state.productCatalog.categories;
    if (!force && catState.loadedLocationId === locationId) {
      yield put(A.fetchCategoriesSuccess({ categories: catState.categories, locationId }));
      deferred?.resolve();
      return;
    }
    if (!force && cachedCategories && cachedCategoriesLocationId === locationId) {
      yield put(A.fetchCategoriesSuccess({ categories: cachedCategories, locationId }));
      deferred?.resolve();
      return;
    }
    if (force) {
      cachedCategories = null;
      cachedCategoriesLocationId = null;
      categoriesFetchInflight = {};
    }
    // In-flight dedup
    const inflightKey = `${locationId}|${token ?? ''}`;
    if (!categoriesFetchInflight[inflightKey]) {
      categoriesFetchInflight[inflightKey] = (async () => {
        const response = await getCategoriesApi(locationId, token);
        return mapApiGetCategoriesToCategories(response);
      })();
      void categoriesFetchInflight[inflightKey].finally(() => {
        delete categoriesFetchInflight[inflightKey];
      });
    }
    const mapped = yield call(() => categoriesFetchInflight[inflightKey]);
    cachedCategories = mapped;
    cachedCategoriesLocationId = locationId;
    yield put(A.fetchCategoriesSuccess({ categories: mapped, locationId }));
    deferred?.resolve();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch categories';
    yield put(A.fetchCategoriesFailure({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* fetchMenusWorker(action: ReturnType<typeof A.fetchMenusRequest>): SagaIterator {
  const { locationId, token, options, deferred } = action.payload;
  const force = Boolean(options?.force);
  try {
    if (!locationId) {
      yield put(A.menusClearCache());
      deferred?.resolve();
      return;
    }
    const state: RootState = yield select();
    if (!force && state.productCatalog.menus.loadedLocationId === locationId) {
      yield put(A.fetchMenusSuccess({ menus: state.productCatalog.menus.menus, locationId }));
      deferred?.resolve();
      return;
    }
    if (!force && cachedMenus && cachedMenusLocationId === locationId) {
      yield put(A.fetchMenusSuccess({ menus: cachedMenus, locationId }));
      deferred?.resolve();
      return;
    }
    if (force) {
      cachedMenus = null;
      cachedMenusLocationId = null;
      menusFetchInflight = {};
    }
    const inflightKey = `${locationId}|${token ?? ''}`;
    if (!menusFetchInflight[inflightKey]) {
      menusFetchInflight[inflightKey] = (async () => {
        const resp = await listCategoryGroupsApi(locationId, token);
        return mapCategoryGroupsToMenus(resp);
      })();
      void menusFetchInflight[inflightKey].finally(() => {
        delete menusFetchInflight[inflightKey];
      });
    }
    const menus = yield call(() => menusFetchInflight[inflightKey]);
    cachedMenus = menus;
    cachedMenusLocationId = locationId;
    yield put(A.fetchMenusSuccess({ menus, locationId }));
    deferred?.resolve();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch menus';
    yield put(A.fetchMenusFailure({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* fetchSessionsWorker(action: ReturnType<typeof A.fetchSessionsRequest>): SagaIterator {
  const { locationId, token, options, deferred } = action.payload;
  const force = Boolean(options?.force);
  try {
    if (!locationId) {
      yield put(A.sessionsClearCache());
      deferred?.resolve();
      return;
    }
    const state: RootState = yield select();
    if (!force && state.productCatalog.sessions.loadedLocationId === locationId) {
      yield put(A.fetchSessionsSuccess({ sessions: state.productCatalog.sessions.sessions, locationId }));
      deferred?.resolve();
      return;
    }
    if (!force && cachedSessions && cachedSessionsLocationId === locationId) {
      yield put(A.fetchSessionsSuccess({ sessions: cachedSessions, locationId }));
      deferred?.resolve();
      return;
    }
    if (force) {
      cachedSessions = null;
      cachedSessionsLocationId = null;
      sessionsFetchInflight = {};
    }
    const inflightKey = `${locationId}|${token ?? ''}`;
    if (!sessionsFetchInflight[inflightKey]) {
      sessionsFetchInflight[inflightKey] = (async () => {
        const apiSessions = await getSessionsApi(locationId, token);
        return apiSessions.map(mapApiSessionToLocal);
      })();
      void sessionsFetchInflight[inflightKey].finally(() => {
        delete sessionsFetchInflight[inflightKey];
      });
    }
    const sessions = yield call(() => sessionsFetchInflight[inflightKey]);
    cachedSessions = sessions;
    cachedSessionsLocationId = locationId;
    yield put(A.fetchSessionsSuccess({ sessions, locationId }));
    deferred?.resolve();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch sessions';
    yield put(A.fetchSessionsFailure({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* fetchModifiersWorker(action: ReturnType<typeof A.fetchModifiersRequest>): SagaIterator {
  const { locationId, token, options, deferred } = action.payload;
  const force = Boolean(options?.force);
  try {
    if (!locationId) {
      yield put(A.modifiersClearCache());
      deferred?.resolve();
      return;
    }
    const state: RootState = yield select();
    if (!force && state.productCatalog.modifiers.loadedLocationId === locationId) {
      yield put(A.fetchModifiersSuccess({ modifiers: state.productCatalog.modifiers.modifiers, locationId }));
      deferred?.resolve();
      return;
    }
    if (!force && cachedModifiers && cachedModifiersLocationId === locationId) {
      yield put(A.fetchModifiersSuccess({ modifiers: cachedModifiers, locationId }));
      deferred?.resolve();
      return;
    }
    if (force) {
      cachedModifiers = null;
      cachedModifiersLocationId = null;
      modifiersFetchInflight = {};
    }
    const inflightKey = `${locationId}|${token ?? ''}`;
    if (!modifiersFetchInflight[inflightKey]) {
      modifiersFetchInflight[inflightKey] = (async () => {
        const apiModifiers = await getModifiersApi(locationId, token);
        return apiModifiers.map(mapApiModifierToLocal);
      })();
      void modifiersFetchInflight[inflightKey].finally(() => {
        delete modifiersFetchInflight[inflightKey];
      });
    }
    const modifiers = yield call(() => modifiersFetchInflight[inflightKey]);
    cachedModifiers = modifiers;
    cachedModifiersLocationId = locationId;
    yield put(A.fetchModifiersSuccess({ modifiers, locationId }));
    deferred?.resolve();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch modifiers';
    yield put(A.fetchModifiersFailure({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* fetchCombosWorker(action: ReturnType<typeof A.fetchCombosRequest>): SagaIterator {
  const { locationId, token, options, deferred } = action.payload;
  const force = Boolean(options?.force);
  try {
    if (!locationId) {
      yield put(A.combosClearCache());
      deferred?.resolve();
      return;
    }
    const state: RootState = yield select();
    if (!force && state.productCatalog.combos.loadedLocationId === locationId) {
      yield put(A.fetchCombosSuccess({ combos: state.productCatalog.combos.combos, locationId }));
      deferred?.resolve();
      return;
    }
    if (!force && cachedCombos && cachedCombosLocationId === locationId) {
      yield put(A.fetchCombosSuccess({ combos: cachedCombos, locationId }));
      deferred?.resolve();
      return;
    }
    if (force) {
      cachedCombos = null;
      cachedCombosLocationId = null;
      combosFetchInflight = {};
    }
    const inflightKey = `${locationId}|${token ?? ''}`;
    if (!combosFetchInflight[inflightKey]) {
      combosFetchInflight[inflightKey] = (async () => {
        const apiCombos = await getCombosApi(locationId, token);
        return apiCombos.map(mapApiComboToLocal);
      })();
      void combosFetchInflight[inflightKey].finally(() => {
        delete combosFetchInflight[inflightKey];
      });
    }
    const combos = yield call(() => combosFetchInflight[inflightKey]);
    cachedCombos = combos;
    cachedCombosLocationId = locationId;
    yield put(A.fetchCombosSuccess({ combos, locationId }));
    deferred?.resolve();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch combos';
    yield put(A.fetchCombosFailure({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* fetchOptionSetsWorker(action: ReturnType<typeof A.fetchOptionSetsRequest>): SagaIterator {
  const { locationId, token, options, deferred } = action.payload;
  const force = Boolean(options?.force);
  try {
    if (!locationId) {
      yield put(A.optionSetsClearCache());
      deferred?.resolve();
      return;
    }
    const state: RootState = yield select();
    if (!force && state.productCatalog.optionSets.loadedLocationId === locationId) {
      yield put(A.fetchOptionSetsSuccess({ optionSets: state.productCatalog.optionSets.optionSets, locationId }));
      deferred?.resolve();
      return;
    }
    if (!force && cachedOptionSets && cachedOptionSetsLocationId === locationId) {
      yield put(A.fetchOptionSetsSuccess({ optionSets: cachedOptionSets, locationId }));
      deferred?.resolve();
      return;
    }
    if (force) {
      cachedOptionSets = null;
      cachedOptionSetsLocationId = null;
      optionSetsFetchInflight = {};
    }
    const inflightKey = `${locationId}|${token ?? ''}`;
    if (!optionSetsFetchInflight[inflightKey]) {
      optionSetsFetchInflight[inflightKey] = (async () => {
        const rows = await getOptionSetsApi(locationId, token);
        return rows
          .map((r, idx) => mapApiOptionSetToUi(r, idx))
          .filter((x): x is OptionSet => Boolean(x));
      })();
      void optionSetsFetchInflight[inflightKey].finally(() => {
        delete optionSetsFetchInflight[inflightKey];
      });
    }
    const optionSets = yield call(() => optionSetsFetchInflight[inflightKey]);
    cachedOptionSets = optionSets;
    cachedOptionSetsLocationId = locationId;
    yield put(A.fetchOptionSetsSuccess({ optionSets, locationId }));
    deferred?.resolve();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch option sets';
    yield put(A.fetchOptionSetsFailure({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* fetchKitchenWorker(action: ReturnType<typeof A.fetchKitchenRequest>): SagaIterator {
  const { locationId, token, options, deferred } = action.payload;
  const force = Boolean(options?.force);
  try {
    if (!locationId) {
      deferred?.resolve();
      return;
    }
    const state: RootState = yield select();
    if (!force && state.productCatalog.kitchenStations.loadedLocationId === locationId) {
      yield put(A.fetchKitchenSuccess({ stations: state.productCatalog.kitchenStations.stations, locationId }));
      deferred?.resolve();
      return;
    }
    if (!force && cachedStations && cachedStationsLocationId === locationId) {
      yield put(A.fetchKitchenSuccess({ stations: cachedStations, locationId }));
      deferred?.resolve();
      return;
    }
    if (force) {
      cachedStations = null;
      cachedStationsLocationId = null;
      stationsFetchInflight = {};
    }
    const inflightKey = `${locationId}|${token ?? ''}`;
    if (!stationsFetchInflight[inflightKey]) {
      stationsFetchInflight[inflightKey] = (async () => {
        const raw = await getKitchenStationsApi(locationId, token);
        const rows = Array.isArray(raw.stations) ? raw.stations : [];
        const mapped = normalizeStationsPayload(rows);
        return mapped.length > 0 ? mapped : [];
      })();
      void stationsFetchInflight[inflightKey].finally(() => {
        delete stationsFetchInflight[inflightKey];
      });
    }
    const stations = yield call(() => stationsFetchInflight[inflightKey]);
    cachedStations = stations;
    cachedStationsLocationId = locationId;
    yield put(A.fetchKitchenSuccess({ stations, locationId }));
    deferred?.resolve();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch kitchen stations';
    yield put(A.fetchKitchenFailure({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* fetchAttributesWorker(action: ReturnType<typeof A.fetchAttributesRequest>): SagaIterator {
  const { locationId, token, deferred } = action.payload;
  try {
    if (!locationId) {
      yield put(A.clearAttributes());
      attributesFetchByKey = {};
      deferred?.resolve();
      return;
    }
    const state: RootState = yield select();
    const ia = state.productCatalog.itemAttributes;
    const unitsLoaded = ia.units.length > 0 || ia.error.units !== null;
    const revenueClassLoaded = ia.revenueClass.length > 0 || ia.error.revenueClass !== null;
    if (ia.loadedLocationId === locationId && unitsLoaded && revenueClassLoaded) {
      yield put(
        A.fetchAttributesSuccess({
          tags: ia.tags,
          ingredients: ia.ingredients,
          diet: ia.diet,
          allergens: ia.allergens,
          tax: ia.tax,
          units: ia.units,
          revenueClass: ia.revenueClass,
          errors: {
            tags: ia.error.tags ?? undefined,
            ingredients: ia.error.ingredients ?? undefined,
            diet: ia.error.diet ?? undefined,
            allergens: ia.error.allergens ?? undefined,
            tax: ia.error.tax ?? undefined,
            units: ia.error.units ?? undefined,
            revenueClass: ia.error.revenueClass ?? undefined,
          },
          locationId,
        }),
      );
      deferred?.resolve();
      return;
    }

    const key = `${locationId}|${token ?? ''}`;
    let dataPromise = attributesFetchByKey[key];
    if (!dataPromise) {
      dataPromise = (async (): Promise<AttrFetchResult> => {
        const res: Partial<Record<AttrType, ItemAttribute[] | TaxOption[]>> = {};
        const err: Partial<Record<AttrType, string>> = {};
        await Promise.all(
          attrTypes.map(async (type) => {
            try {
              const raw = await getItemAttributesApi(type, locationId, token);
              res[type] = type === 'tax' ? normalizeTaxList(raw) : normalizeAttrList(raw);
            } catch (e) {
              err[type] = e instanceof Error ? e.message : `Failed to fetch ${type}`;
              res[type] = [];
            }
          }),
        );
        return { results: res, errors: err };
      })();
      attributesFetchByKey[key] = dataPromise;
      void dataPromise.finally(() => {
        delete attributesFetchByKey[key];
      });
    }

    const { results, errors } = yield call(() => dataPromise);
    const after: RootState = yield select();
    if (after.productCatalog.itemAttributes.loadedLocationId !== locationId) {
      yield put(
        A.fetchAttributesSuccess({
          tags: (results.tags ?? []) as ItemAttribute[],
          ingredients: (results.ingredients ?? []) as ItemAttribute[],
          diet: (results.diet ?? []) as ItemAttribute[],
          allergens: (results.allergens ?? []) as ItemAttribute[],
          tax: (results.tax ?? []) as TaxOption[],
          units: (results.units ?? []) as ItemAttribute[],
          revenueClass: (results.revenueClass ?? []) as ItemAttribute[],
          errors,
          locationId,
        }),
      );
    }
    deferred?.resolve();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch attributes';
    yield put(A.fetchAttributesFailure({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* createItemWorker(action: ReturnType<typeof A.createItemRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    const userId = getUserIdFromCredentials();
    const response = yield call(createItemApi, { ...(data as object), userId }, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.createItemDone({ response }));
    deferred?.resolve(response);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    yield put(A.createItemDone({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* updateItemWorker(action: ReturnType<typeof A.updateItemRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    const userId = getUserIdFromCredentials();
    yield call(updateItemApi, { ...(data as object), userId }, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.updateItemDone({}));
    deferred?.resolve();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    yield put(A.updateItemDone({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* deleteItemWorker(action: ReturnType<typeof A.deleteItemRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    yield call(deleteItemApi, data, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.deleteItemDone({}));
    deferred?.resolve();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    yield put(A.deleteItemDone({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* bulkDeleteItemsWorker(action: ReturnType<typeof A.bulkDeleteItemsRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    yield call(bulkDeleteItemsApi, data, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.bulkDeleteItemsDone({}));
    deferred?.resolve();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    yield put(A.bulkDeleteItemsDone({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* validateItemCodeWorker(action: ReturnType<typeof A.validateItemCodeRequest>): SagaIterator {
  const { locationId, itemCode, token, deferred } = action.payload;
  try {
    const response = yield call(validateItemCodeApi, locationId, itemCode, token);
    yield put(A.validateItemCodeDone({ response }));
    deferred?.resolve(response);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    yield put(A.validateItemCodeDone({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* uploadItemImageWorker(action: ReturnType<typeof A.uploadItemImageRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    const response = yield call(uploadItemImageApi, data, token);
    yield put(A.uploadItemImageDone({ response }));
    deferred?.resolve(response);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    yield put(A.uploadItemImageDone({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* removeItemImageWorker(action: ReturnType<typeof A.removeItemImageRequest>): SagaIterator {
  const { imageId, token, deferred } = action.payload;
  try {
    const response = yield call(removeItemImageApi, imageId, token);
    yield put(A.removeItemImageDone({ response }));
    deferred?.resolve(response);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    yield put(A.removeItemImageDone({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* createSessionWorker(action: ReturnType<typeof A.createSessionRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    const createResp: unknown = yield call(createSessionApi, data as any, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.createSessionDone({}));
    deferred?.resolve(createResp);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    yield put(A.createSessionDone({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* updateSessionWorker(action: ReturnType<typeof A.updateSessionRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    const updateResp: unknown = yield call(updateSessionApi, data as any, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.updateSessionDone({}));
    deferred?.resolve(updateResp);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    yield put(A.updateSessionDone({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* deleteSessionWorker(action: ReturnType<typeof A.deleteSessionRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    yield call(deleteSessionApi, data, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.deleteSessionDone({ sessionId: data.sessionId }));
    deferred?.resolve();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    yield put(A.deleteSessionDone({ sessionId: data.sessionId, error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* createCategoryWorker(action: ReturnType<typeof A.createCategoryRequest>): SagaIterator {
  const { data, imageFile, token, deferred } = action.payload;
  try {
    const userId = getUserIdFromCredentials();
    let finalPayload: Record<string, unknown> = { ...data, userId };
    let preUploadedCategoryId = '';
    if (imageFile) {
      const formData = new FormData();
      formData.append('image', imageFile);
      const uploadRes = yield call(uploadCategoryImageApi, formData, null, token);
      if (uploadRes.categoryId && typeof uploadRes.categoryId === 'string') {
        preUploadedCategoryId = uploadRes.categoryId;
        finalPayload = { ...finalPayload, categoryId: uploadRes.categoryId };
      }
    }
    const createResp: Record<string, unknown> = yield call(createCategoryApi, finalPayload, token);
    const readId = (obj: unknown): string => {
      if (!obj || typeof obj !== 'object') return '';
      const row = obj as Record<string, unknown>;
      const direct = String(row.categoryId ?? row.id ?? '').trim();
      if (direct) return direct;
      for (const key of ['data', 'result', 'response', 'category', 'content']) {
        const nested = readId(row[key]);
        if (nested) return nested;
      }
      return '';
    };
    const newCategoryId = readId(createResp) || preUploadedCategoryId;
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.createCategoryDone({ saving: false }));
    deferred?.resolve(newCategoryId || undefined);
  } catch (e) {
    yield put(A.createCategoryDone({ saving: false, error: e instanceof Error ? e.message : 'Error' }));
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* updateCategoryWorker(action: ReturnType<typeof A.updateCategoryRequest>): SagaIterator {
  const { data, imageFile, token, deferred } = action.payload;
  try {
    const userId = getUserIdFromCredentials();
    if (imageFile) {
      const formData = new FormData();
      formData.append('image', imageFile);
      yield call(uploadCategoryImageApi, formData, data.categoryId, token);
    }
    yield call(updateCategoryApi, { ...data, userId } as any, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.updateCategoryDone({ saving: false }));
    deferred?.resolve();
  } catch (e) {
    yield put(A.updateCategoryDone({ saving: false, error: e instanceof Error ? e.message : 'Error' }));
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* deleteCategoryWorker(action: ReturnType<typeof A.deleteCategoryRequest>): SagaIterator {
  const { categoryId, locationId, token, deferred } = action.payload;
  try {
    yield call(deleteCategoryApi, { categoryId, locationId }, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.deleteCategoryDone({ saving: false, categoryId }));
    deferred?.resolve();
  } catch (e) {
    yield put(A.deleteCategoryDone({ saving: false, error: e instanceof Error ? e.message : 'Error' }));
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* sortCategoriesWorker(action: ReturnType<typeof A.sortCategoriesRequest>): SagaIterator {
  const { locationId, token, deferred } = action.payload;
  try {
    const state: RootState = yield select();
    const categories = state.productCatalog.categories.categories;
    const rootCats = categories
      .filter((c) => !c.parentCategoryId)
      .sort((a, b) => a.sortPosition - b.sortPosition);
    const flatList: { categoryId: string; sortOrder: number }[] = [];
    let sortIndex = 1;
    for (const parent of rootCats) {
      flatList.push({ categoryId: parent.id, sortOrder: sortIndex++ });
      const children = categories
        .filter((c) => c.parentCategoryId === parent.id)
        .sort((a, b) => a.sortPosition - b.sortPosition);
      for (const child of children) {
        flatList.push({ categoryId: child.id, sortOrder: sortIndex++ });
      }
    }
    yield call(sortCategoryApi, { locationId, category: flatList }, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.sortCategoriesDone());
    deferred?.resolve();
  } catch (e) {
    yield put(A.sortCategoriesDone());
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* createMenuWorker(action: ReturnType<typeof A.createMenuRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    const userId = getUserIdFromCredentials();
    yield call(createCategoryGroupApi, {
      locationId: data.locationId,
      name: data.name,
      description: data.description,
      icon: data.icon,
      status: data.status,
      ...(data.activeOn !== undefined && data.activeOn !== null && String(data.activeOn).trim() !== ''
        ? { activeOn: data.activeOn }
        : {}),
      categories: data.categories,
      orderTypes: data.orderTypes,
      devices: data.devices,
      ...(data.items !== undefined ? { items: data.items } : {}),
      sections: [],
      userId,
    }, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.createMenuDone({}));
    deferred?.resolve();
  } catch (e) {
    yield put(A.createMenuDone({ error: e instanceof Error ? e.message : 'Error' }));
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* updateMenuWorker(action: ReturnType<typeof A.updateMenuRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    const userId = getUserIdFromCredentials();
    yield call(updateCategoryGroupApi, {
      categoryGroupId: data.categoryGroupId,
      locationId: data.locationId,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.icon !== undefined ? { icon: data.icon } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.activeOn !== undefined && data.activeOn !== null && String(data.activeOn).trim() !== ''
        ? { activeOn: data.activeOn }
        : {}),
      ...(data.categories ? { categories: data.categories } : {}),
      ...(data.orderTypes ? { orderTypes: data.orderTypes } : {}),
      ...(data.devices ? { devices: data.devices } : {}),
      ...(data.items !== undefined && data.items.length > 0 ? { items: data.items } : {}),
      sections: [],
      userId,
    }, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.updateMenuDone({}));
    deferred?.resolve();
  } catch (e) {
    yield put(A.updateMenuDone({ error: e instanceof Error ? e.message : 'Error' }));
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* deleteMenuWorker(action: ReturnType<typeof A.deleteMenuRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    yield call(deleteCategoryGroupApi, data, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.deleteMenuDone({ categoryGroupId: data.categoryGroupId }));
    deferred?.resolve();
  } catch (e) {
    yield put(A.deleteMenuDone({ categoryGroupId: data.categoryGroupId, error: e instanceof Error ? e.message : 'Error' }));
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* createModifierWorker(action: ReturnType<typeof A.createModifierRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    const createResp: unknown = yield call(createModifierApi, data, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.createModifierDone({}));
    deferred?.resolve(createResp);
  } catch (e) {
    yield put(A.createModifierDone({ error: e instanceof Error ? e.message : 'Error' }));
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* updateModifierWorker(action: ReturnType<typeof A.updateModifierRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    const userId = getUserIdFromCredentials();
    yield call(updateModifierApi, { ...data, userId } as any, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.updateModifierDone({}));
    deferred?.resolve();
  } catch (e) {
    yield put(A.updateModifierDone({ error: e instanceof Error ? e.message : 'Error' }));
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* deleteModifierWorker(action: ReturnType<typeof A.deleteModifierRequest>): SagaIterator {
  const { modifierId, locationId, token, deferred } = action.payload;
  try {
    yield call(deleteModifierApi, { modifierId, locationId }, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.deleteModifierDone({ modifierId }));
    deferred?.resolve();
  } catch (e) {
    yield put(A.deleteModifierDone({ error: e instanceof Error ? e.message : 'Error' }));
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* createComboWorker(action: ReturnType<typeof A.createComboRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    const userId = getUserIdFromCredentials();
    yield call(createComboApi, { ...data, userId } as any, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.createComboDone({}));
    deferred?.resolve();
  } catch (e) {
    yield put(A.createComboDone({ error: e instanceof Error ? e.message : 'Error' }));
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* updateComboWorker(action: ReturnType<typeof A.updateComboRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    const userId = getUserIdFromCredentials();
    yield call(updateComboApi, { ...data, userId } as any, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.updateComboDone({}));
    deferred?.resolve();
  } catch (e) {
    yield put(A.updateComboDone({ error: e instanceof Error ? e.message : 'Error' }));
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* deleteComboWorker(action: ReturnType<typeof A.deleteComboRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    yield call(deleteComboApi, data, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.deleteComboDone({ comboId: data.comboId }));
    deferred?.resolve();
  } catch (e) {
    yield put(A.deleteComboDone({ comboId: data.comboId, error: e instanceof Error ? e.message : 'Error' }));
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* createOptionSetWorker(action: ReturnType<typeof A.createOptionSetRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    const userId = getUserIdFromCredentials();
    yield call(
      createOptionSetApi,
      {
        locationId: data.locationId,
        name: data.name,
        displayName: data.displayName,
        options: data.options.map((o, idx) => ({
          name: o.name,
          ...(o.price != null ? { price: o.price } : {}),
          sortOrder: o.sortOrder ?? idx + 1,
        })),
        userId,
      },
      token,
    );
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.createOptionSetDone({}));
    deferred?.resolve();
  } catch (e) {
    yield put(A.createOptionSetDone({ error: e instanceof Error ? e.message : 'Error' }));
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* updateOptionSetWorker(action: ReturnType<typeof A.updateOptionSetRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    const userId = getUserIdFromCredentials();
    yield call(
      updateOptionSetApi,
      {
        templateId: data.templateId,
        locationId: data.locationId,
        name: data.name,
        displayName: data.displayName,
        options: data.options.map((o, idx) => ({
          ...(o.optionId ? { optionId: o.optionId } : {}),
          name: o.name,
          ...(o.price != null ? { price: o.price } : {}),
          sortOrder: o.sortOrder ?? idx + 1,
        })),
        userId,
      },
      token,
    );
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.updateOptionSetDone({}));
    deferred?.resolve();
  } catch (e) {
    yield put(A.updateOptionSetDone({ error: e instanceof Error ? e.message : 'Error' }));
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* deleteOptionSetWorker(action: ReturnType<typeof A.deleteOptionSetRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    yield call(deleteOptionSetApi, data, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.deleteOptionSetDone({ templateId: data.templateId }));
    deferred?.resolve();
  } catch (e) {
    yield put(A.deleteOptionSetDone({ templateId: data.templateId, error: e instanceof Error ? e.message : 'Error' }));
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* createStationWorker(action: ReturnType<typeof A.createStationRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    const createResp: unknown = yield call(createKitchenStationApi, data, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.createStationDone({}));
    deferred?.resolve(createResp);
  } catch (e) {
    yield put(A.createStationDone({ error: e instanceof Error ? e.message : 'Error' }));
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* updateStationWorker(action: ReturnType<typeof A.updateStationRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    const userId = getUserIdFromCredentials();
    yield call(updateKitchenStationApi, { ...data, userId } as any, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.updateStationDone({}));
    deferred?.resolve();
  } catch (e) {
    yield put(A.updateStationDone({ error: e instanceof Error ? e.message : 'Error' }));
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* deleteStationWorker(action: ReturnType<typeof A.deleteStationRequest>): SagaIterator {
  const { data, token, deferred } = action.payload;
  try {
    yield call(deleteKitchenStationApi, data, token);
    markProductCatalogSyncNeeded();
    invalidateAllFetchCaches();
    yield put(A.invalidateFetchCache());
    yield put(A.deleteStationDone({ id: data.id }));
    deferred?.resolve();
  } catch (e) {
    yield put(A.deleteStationDone({ id: data.id, error: e instanceof Error ? e.message : 'Error' }));
    deferred?.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function* triggerSyncWorker(action: ReturnType<typeof A.triggerSyncRequest>): SagaIterator {
  const { locationId, userId, syncHistoryId, token, deferred } = action.payload;
  try {
    yield call(triggerSyncApi, { locationId, userId, ...(syncHistoryId ? { syncHistoryId } : {}) }, token);
    yield put(A.triggerSyncSuccess());
    requestSyncWatch();
    deferred?.resolve();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to trigger sync';
    const errorKind = e instanceof SyncTriggerError ? e.kind : 'server';
    yield put(A.triggerSyncFailure({ error: msg, errorKind }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

function* invalidateFetchCacheWorker(): SagaIterator {
  yield call(invalidateAllFetchCaches);
}

function* clearSessionsCacheWorker(): SagaIterator {
  yield call(invalidateSessionsCache);
}

function* clearItemsCacheWorker(): SagaIterator {
  yield call(invalidateItemsSagaCacheOnly);
}

function* clearCategoriesCacheWorker(): SagaIterator {
  yield call(invalidateCategoriesSagaCacheOnly);
}

function* clearMenusCacheWorker(): SagaIterator {
  yield call(invalidateMenusCache);
}

function* clearModifiersCacheWorker(): SagaIterator {
  yield call(invalidateModifiersCache);
}

function* clearCombosCacheWorker(): SagaIterator {
  yield call(invalidateCombosCache);
}

function* clearOptionSetsCacheWorker(): SagaIterator {
  yield call(invalidateOptionSetsCache);
}

function* clearKitchenCacheWorker(): SagaIterator {
  yield call(invalidateStationsCache);
}

function* clearAttributesCacheWorker(): SagaIterator {
  yield call(invalidateAttributesCache);
}

function* fetchModuleListWorker(action: ReturnType<typeof A.fetchModuleListRequest>): SagaIterator {
  const { moduleType, query, token, deferred } = action.payload;
  const inflightKey = `${moduleType}|${JSON.stringify(query)}|${token ?? ''}`;
  try {
    if (!moduleListFetchInflight[inflightKey]) {
      moduleListFetchInflight[inflightKey] = (async () => {
        return (await getModuleListApi(moduleType, query, token)) as unknown[];
      })();
      void moduleListFetchInflight[inflightKey].finally(() => {
        delete moduleListFetchInflight[inflightKey];
      });
    }
    const response = (yield call(() => moduleListFetchInflight[inflightKey])) as unknown[];
    yield put(A.fetchModuleListDone({ response: response as any[] }));
    deferred?.resolve(response as any[]);
  } catch (e) {
    delete moduleListFetchInflight[inflightKey];
    const msg = e instanceof Error ? e.message : 'Error';
    yield put(A.fetchModuleListDone({ error: msg }));
    deferred?.reject(e instanceof Error ? e : new Error(msg));
  }
}

export function* productCatalogSaga(): SagaIterator {
  yield all([
    takeLatest(PC.ITEMS_CLEAR_CACHE, clearItemsCacheWorker),
    takeLatest(PC.CATEGORIES_CLEAR_CACHE, clearCategoriesCacheWorker),
    takeLatest(PC.MENUS_CLEAR_CACHE, clearMenusCacheWorker),
    takeLatest(PC.MODIFIERS_CLEAR_CACHE, clearModifiersCacheWorker),
    takeLatest(PC.COMBOS_CLEAR_CACHE, clearCombosCacheWorker),
    takeLatest(PC.OPTION_SETS_CLEAR_CACHE, clearOptionSetsCacheWorker),
    takeLatest(PC.KITCHEN_CLEAR_CACHE, clearKitchenCacheWorker),
    takeLatest(PC.CLEAR_ATTRIBUTES, clearAttributesCacheWorker),
    takeLatest(PC.FETCH_ITEMS_REQUEST, fetchItemsWorker),
    takeLatest(PC.CREATE_ITEM_REQUEST, createItemWorker),
    takeLatest(PC.UPDATE_ITEM_REQUEST, updateItemWorker),
    takeLatest(PC.DELETE_ITEM_REQUEST, deleteItemWorker),
    takeLatest(PC.BULK_DELETE_ITEMS_REQUEST, bulkDeleteItemsWorker),
    takeLatest(PC.VALIDATE_ITEM_CODE_REQUEST, validateItemCodeWorker),
    takeEvery(PC.UPLOAD_ITEM_IMAGE_REQUEST, uploadItemImageWorker),
    takeEvery(PC.REMOVE_ITEM_IMAGE_REQUEST, removeItemImageWorker),
    takeLatest(PC.FETCH_CATEGORIES_REQUEST, fetchCategoriesWorker),
    takeLatest(PC.FETCH_MENUS_REQUEST, fetchMenusWorker),
    takeLatest(PC.FETCH_SESSIONS_REQUEST, fetchSessionsWorker),
    takeLatest(PC.CREATE_SESSION_REQUEST, createSessionWorker),
    takeLatest(PC.UPDATE_SESSION_REQUEST, updateSessionWorker),
    takeLatest(PC.DELETE_SESSION_REQUEST, deleteSessionWorker),
    takeLatest(PC.SESSIONS_CLEAR_CACHE, clearSessionsCacheWorker),
    takeLatest(PC.FETCH_MODIFIERS_REQUEST, fetchModifiersWorker),
    takeLatest(PC.FETCH_COMBOS_REQUEST, fetchCombosWorker),
    takeLatest(PC.FETCH_OPTION_SETS_REQUEST, fetchOptionSetsWorker),
    takeLatest(PC.FETCH_KITCHEN_REQUEST, fetchKitchenWorker),
    takeLatest(PC.FETCH_ATTRIBUTES_REQUEST, fetchAttributesWorker),
    takeLatest(PC.CREATE_CATEGORY_REQUEST, createCategoryWorker),
    takeLatest(PC.UPDATE_CATEGORY_REQUEST, updateCategoryWorker),
    takeLatest(PC.DELETE_CATEGORY_REQUEST, deleteCategoryWorker),
    takeLatest(PC.SORT_CATEGORIES_REQUEST, sortCategoriesWorker),
    takeLatest(PC.CREATE_MENU_REQUEST, createMenuWorker),
    takeLatest(PC.UPDATE_MENU_REQUEST, updateMenuWorker),
    takeLatest(PC.DELETE_MENU_REQUEST, deleteMenuWorker),
    takeLatest(PC.CREATE_MODIFIER_REQUEST, createModifierWorker),
    takeLatest(PC.UPDATE_MODIFIER_REQUEST, updateModifierWorker),
    takeLatest(PC.DELETE_MODIFIER_REQUEST, deleteModifierWorker),
    takeLatest(PC.CREATE_COMBO_REQUEST, createComboWorker),
    takeLatest(PC.UPDATE_COMBO_REQUEST, updateComboWorker),
    takeLatest(PC.DELETE_COMBO_REQUEST, deleteComboWorker),
    takeLatest(PC.CREATE_OPTION_SET_REQUEST, createOptionSetWorker),
    takeLatest(PC.UPDATE_OPTION_SET_REQUEST, updateOptionSetWorker),
    takeLatest(PC.DELETE_OPTION_SET_REQUEST, deleteOptionSetWorker),
    takeLatest(PC.CREATE_STATION_REQUEST, createStationWorker),
    takeLatest(PC.UPDATE_STATION_REQUEST, updateStationWorker),
    takeLatest(PC.DELETE_STATION_REQUEST, deleteStationWorker),
    takeLatest(PC.TRIGGER_SYNC_REQUEST, triggerSyncWorker),
    takeLatest(PC.INVALIDATE_FETCH_CACHE, invalidateFetchCacheWorker),
    takeLatest(PC.FETCH_MODULE_LIST_REQUEST, fetchModuleListWorker),
  ]);
}
