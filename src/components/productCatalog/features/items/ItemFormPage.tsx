import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import './ItemFormPage.css';
import { useNavigate, useLocation, Navigate, useSearchParams } from 'react-router-dom';
import { useItemsStore, useCategoriesStore, useKitchenStationsStore, useModifiersStore, useSessionsStore, useVariationSetsStore, useToastStore, useMenusStore, useMenuPricesStore, useItemAttributesStore } from '../../../../redux/productCatalog/productCatalogHooks';
import type {
  ItemStatus,
  ItemType,
  ItemVariationPreview,
  ItemAttribute,
  NutritionInfo,
  KitchenStation,
  MenuItem,
  OrderType,
  Category,
  ItemPricingTier,
} from '../../data/types';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { pcPaths } from '../../paths';
import {
  formPageOuterStyle,
  formPageMainScrollStyle,
  formStickyActionBarFooterStyle,
  formCancelButtonStyle,
  formSaveButtonStyle,
} from '../../formLayout';
import TextField from '../../components/forms/TextField';
import TextArea from '../../components/forms/TextArea';
import NumberField from '../../components/forms/NumberField';
import Select from '../../components/forms/Select';
import { Toggle } from '../../components/ui/Toggle';
import { isThirdPartyTypeGroup } from '../../utils/outletOrderTypes';
import ChipSelectList from '../../components/forms/ChipSelectList';
import { ItemAssignmentSection } from '../../components/ui/ItemAssignmentSection';
import { DeleteConfirmationModal } from '../../components/ui/DeleteConfirmationModal';
import { DiscardChangesModal } from '../../components/ui/DiscardChangesModal';
import { CatalogDatePicker } from '../../components/ui/CatalogDatePicker';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useErrorToast } from '../../hooks/useErrorToast';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import { resolveCatalogItemImageUrl } from '../../../../constants';
import { feItemTypeToBackendCode, itemCreationStatusApiFromFeStatus, getExclusiveItemsApi } from '../../../../services/itemCatalogApi';
import { getLocationDetails } from '../../../../services/api';
import { locationDetailsCache, locationDetailsInFlight } from '../../../../services/locationDetailsCache';
import { useAppDispatch } from '../../../../redux/hooks';
import { invalidateFetchCache } from '../../../../redux/productCatalog/productCatalogActions';
import { formatSessionScheduleSummary } from '../sessions/sessionFormatting';
import { useFormDiscardGuard } from '../../hooks/useFormDiscardGuard';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { useLocationAges } from '../../hooks/useLocationAges';
import { normalizeApiErrorMessage } from '../../../../utils/apiNetworkError';

/* --------- constants --------- */

const itemTypeConfig: { value: ItemType; icon: string; label: string; desc: string; badge?: string }[] = [
  { value: 'prepared_food_beverage', icon: 'restaurant', label: 'Prepared Food', desc: 'Cooked meals & drinks' },
  { value: 'event', icon: 'event', label: 'Event', desc: 'Ticketed events' },
  { value: 'physical_good', icon: 'inventory_2', label: 'Physical Good', desc: 'Tangible products' },
  { value: 'merchandise', icon: 'storefront', label: 'Merchandise', desc: 'Branded merch' },
  { value: 'service', icon: 'handyman', label: 'Service', desc: 'Labor & services' },
  { value: 'digital', icon: 'cloud_download', label: 'Digital', desc: 'Digital products' },
];

const channelLabels: Record<OrderType, string> = {
  dine_in: 'Dine In',
  takeout: 'Takeout',
  delivery: 'Delivery',
  online_ordering: 'Online Ordering',
  catering: 'Catering',
};

const allOrderTypes: OrderType[] = ['dine_in', 'takeout', 'delivery', 'online_ordering', 'catering'];

function resolveItemMediaPreviewUrl(
  media?: { fileName?: string; imageUrl?: string; imageId?: string; imageType?: string; type?: string } | null,
): string | null {
  if (!media) return null;
  const direct = resolveCatalogItemImageUrl(media.fileName ?? media.imageUrl ?? null);
  if (direct) return direct;
  const imageId = String(media.imageId ?? '').trim();
  const imageType = String(media.imageType ?? media.type ?? '').trim();
  if (!imageId || !imageType) return null;
  return resolveCatalogItemImageUrl(`img/testing/${imageId}/${imageType}`);
}

interface OutletOrderType {
  id?: string;
  typeName?: string;
  typeGroup?: string;
  isEnabled?: number | boolean;
}

function normalizeText(v: string): string {
  return v.toLowerCase().replace(/[\s-]+/g, '_').trim();
}

/**
 * Helper text shown beneath the Stock Reset Behavior dropdown. Reads the live
 * `defaultStockQuantity` value so the `auto_reset` line stays accurate as the
 * user types (e.g. "Stock resets to 30 every day.").
 */
function stockResetHelperText(
  mode: 'carry_forward' | 'auto_reset' | 'clear_stocks',
  defaultQty: string,
): string {
  if (mode === 'clear_stocks') return 'Stock will become 0 at end of day.';
  if (mode === 'carry_forward') return 'Stock will carry forward day-to-day.';
  // auto_reset
  const v = defaultQty.trim();
  return v
    ? `Stock resets to ${v} every day.`
    : 'Stock resets to the default quantity every day.';
}

function mapOutletOrderTypeToKey(ot: OutletOrderType): OrderType | null {
  const fromTypeName = normalizeText(ot.typeName ?? '');
  const fromId = normalizeText(ot.id ?? '');
  const source = `${fromTypeName} ${fromId}`;

  if (/(dine|dining|walk_in|walkin|eat_in)/.test(source)) return 'dine_in';
  if (/(takeout|take_out|pickup|pick_up)/.test(source)) return 'takeout';
  if (/delivery/.test(source)) return 'delivery';
  if (/(online|gloriafood|web|app|digital)/.test(source)) return 'online_ordering';
  if (/(catering|cater)/.test(source)) return 'catering';

  switch ((ot.typeGroup ?? '').toUpperCase()) {
    case 'D': return 'dine_in';
    case 'P': return 'takeout';
    case 'S': return 'delivery';
    case 'O': return 'online_ordering';
    case 'T': return 'online_ordering';
    default: return null;
  }
}

function getOutletOrderTypeIdByKey(
  selectedBranch: Record<string, any> | null | undefined,
): Partial<Record<OrderType, string>> {
  const raw = selectedBranch?.orderTypes;
  if (!Array.isArray(raw) || raw.length === 0) return {};

  const out: Partial<Record<OrderType, string>> = {};
  raw.forEach((entry: OutletOrderType) => {
    // Include disabled (isEnabled: 0) order types too; still exclude in-store.
    const notInstore = (entry?.typeGroup ?? 'T') !== 'I';
    if (!notInstore) return;

    const key = mapOutletOrderTypeToKey(entry);
    const id = String(entry?.id ?? '').trim();
    if (!key || !id || out[key]) return;
    out[key] = id;
  });
  return out;
}

/** Same shape as ItemsPage / CategoriesPage — pair with `category.channelVisibility` by `orderTypeId`. */
type BranchOutletOrderType = {
  id: string;
  typeName: string;
  typeGroup?: string;
  isEnabled?: number | boolean;
};

function getChannelDisplayName(typeName: string): string {
  const n = (typeName ?? '').toLowerCase();
  if (n.includes('dining') || n.includes('dinein') || n.includes('dine-in') || n.includes('walk-in') || n.includes('walkin')) {
    return 'Dine-in';
  }
  if (!typeName) return '';
  return typeName.charAt(0).toUpperCase() + typeName.slice(1).toLowerCase();
}

function getOrderTypesForBranch(
  selectedBranch: Record<string, unknown> | null | undefined,
): BranchOutletOrderType[] {
  if (!selectedBranch) return [];
  const raw = selectedBranch.orderTypes;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.filter((ot: { isEnabled?: number | boolean; typeGroup?: string }) => {
    // Include disabled (isEnabled: 0) order types too; still exclude in-store.
    const notInstore = (ot?.typeGroup ?? 'T') !== 'I';
    return notInstore;
  }) as BranchOutletOrderType[];
}

/** Aggregate per-outlet toggles into `OrderType` keys (OR within each key). */
function deriveOrderVisibilityFromOutletMap(
  byId: Record<string, boolean>,
  branchList: BranchOutletOrderType[],
): Record<OrderType, boolean> {
  if (branchList.length === 0) {
    return defaultOrderVisibility();
  }
  const next: Record<OrderType, boolean> = {
    dine_in: false,
    takeout: false,
    delivery: false,
    online_ordering: false,
    catering: false,
  };
  allOrderTypes.forEach((k) => {
    const outs = branchList.filter((ot) => mapOutletOrderTypeToKey(ot as OutletOrderType) === k);
    if (outs.length === 0) {
      next[k] = true;
    } else {
      next[k] = outs.some((ot) => byId[String(ot.id ?? '').trim()] !== false);
    }
  });
  return next;
}

/**
 * Same rule as category listing: match `channelVisibility` rows by outlet `orderTypeId` (not a single id per OrderType key).
 */
function categoryAllowsOutletOrderTypeId(
  cat: Category,
  orderTypeId: string,
  mappedKey: OrderType | null,
): boolean {
  const cvList = cat.channelVisibility;
  // If API provided channelVisibility (including empty), treat it as authoritative.
  if (Array.isArray(cvList)) {
    const row = cvList.find((c) => String(c.orderTypeId).trim() === String(orderTypeId).trim());
    if (row) return row.enabled !== false;
    return false;
  }
  if (mappedKey) return cat.orderTypeVisibility?.[mappedKey] !== false;
  return true;
}

function channelAllowedByAnyCategoryForOutletId(
  assignedCats: Category[],
  orderTypeId: string,
  mappedKey: OrderType | null,
): boolean {
  if (assignedCats.length === 0) return true;
  return assignedCats.some((c) => categoryAllowsOutletOrderTypeId(c, orderTypeId, mappedKey));
}

const PREP_TIMES = [5, 10, 15, 20, 30, 45, 60, 75, 90] as const;
const BEST_PAIRED_MAX = 30;
const ITEM_NAME_MAX = 128;
const ITEM_CODE_MAX = 15;
const SPECIAL_INSTRUCTIONS_MAX = 1000;
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const REGISTRATION_LABELS = ['Register', 'RSVP', 'Reserve Spot', 'Get Ticket', 'Sign Up', 'Book Now'] as const;

function defaultOrderVisibility(): Record<OrderType, boolean> {
  return {
    dine_in: true,
    takeout: true,
    delivery: true,
    online_ordering: true,
    catering: true,
  };
}

/** Mirrors Maghil-Merchant-Portal Copy `TEMPLATES` --- pre-fills type, allergens, prep, kitchen station, dietary. */
interface ItemTemplate {
  id: string;
  type: ItemType;
  name: string;
  emoji: string;
  desc: string;
  fields: number;
  allergens?: string[];
  prep?: number;
  station?: string;
  alcohol?: boolean;
  dietary?: string[];
}

const ITEM_TEMPLATES: ItemTemplate[] = [
  { id: 'pizza', type: 'prepared_food_beverage', name: 'Pizza', emoji: '\u{1F355}', desc: 'Classic pizza with modifier groups', fields: 8, allergens: ['Gluten', 'Dairy'], prep: 15, station: 'Grill' },
  { id: 'cocktail', type: 'prepared_food_beverage', name: 'Cocktail', emoji: '\u{1F378}', desc: 'Mixed drink with garnish options', fields: 7, allergens: [], prep: 5, station: 'Bar', alcohol: true },
  { id: 'coffee', type: 'prepared_food_beverage', name: 'Coffee', emoji: '\u2615', desc: 'Hot or iced coffee variants', fields: 6, allergens: ['Dairy'], prep: 5, station: 'Bar' },
  { id: 'burger', type: 'prepared_food_beverage', name: 'Burger', emoji: '\u{1F354}', desc: 'Customizable burger build', fields: 9, allergens: ['Gluten', 'Dairy', 'Eggs'], prep: 15, station: 'Grill' },
  { id: 'salad', type: 'prepared_food_beverage', name: 'Salad Bowl', emoji: '\u{1F957}', desc: 'Fresh salad with dressing picks', fields: 6, allergens: ['Nuts'], prep: 10, station: 'Cold Kitchen', dietary: ['Vegetarian'] },
  { id: 'dessert', type: 'prepared_food_beverage', name: 'Dessert', emoji: '\u{1F370}', desc: 'Sweet treats and pastries', fields: 5, allergens: ['Gluten', 'Dairy', 'Eggs', 'Nuts'], prep: 10, station: 'Dessert Station' },
  { id: 'soup', type: 'prepared_food_beverage', name: 'Soup', emoji: '\u{1F35C}', desc: 'Cup or bowl with temperature options', fields: 5, allergens: [], prep: 5, station: 'Cold Kitchen' },
  { id: 'starter', type: 'prepared_food_beverage', name: 'Starter', emoji: '\u{1F371}', desc: 'Sharing plate with dipping sauces', fields: 6, allergens: [], prep: 10, station: 'Grill' },
  { id: 'wine-tasting', type: 'event', name: 'Wine Tasting', emoji: '\u{1F377}', desc: 'Guided tasting with ticket types', fields: 7, allergens: [] },
  { id: 'cooking-class', type: 'event', name: 'Cooking Class', emoji: '\u{1F468}\u200D\u{1F373}', desc: 'Hands-on class with skill levels', fields: 7, allergens: [] },
  { id: 'live-music', type: 'event', name: 'Live Music Night', emoji: '\u{1F3B5}', desc: 'Concert with General/VIP tickets', fields: 6, allergens: [] },
  { id: 'private-dining', type: 'event', name: 'Private Dining', emoji: '\u{1F37D}', desc: 'Exclusive dining experience', fields: 7, allergens: [] },
  { id: 'free-event', type: 'event', name: 'Free Community Event', emoji: '\u{1F389}', desc: 'Free registration event', fields: 5, allergens: [] },
  { id: 'bottled-bev', type: 'physical_good', name: 'Bottled Beverage', emoji: '\u{1F37A}', desc: 'Retail bottle with SKU and inventory', fields: 6, allergens: [] },
  { id: 'branded-merch', type: 'merchandise', name: 'Branded Merchandise', emoji: '\u{1F455}', desc: 'Apparel or accessory with sizes', fields: 7, allergens: [] },
  { id: 'gift-basket', type: 'physical_good', name: 'Gift Basket', emoji: '\u{1F381}', desc: 'Curated selection for gifting', fields: 5, allergens: [] },
  { id: 'catering', type: 'service', name: 'Catering Package', emoji: '\u{1F37D}', desc: 'Per-person catering with headcount', fields: 7, allergens: [] },
  { id: 'delivery-fee', type: 'service', name: 'Delivery Fee', emoji: '\u{1F69A}', desc: 'Fixed delivery charge', fields: 3, allergens: [] },
  { id: 'gift-card', type: 'digital', name: 'Gift Card', emoji: '\u{1F4B3}', desc: 'E-voucher with amount variations', fields: 4, allergens: [] },
  { id: 'recipe-book', type: 'digital', name: 'Digital Recipe Book', emoji: '\u{1F4D6}', desc: 'Downloadable recipe collection', fields: 4, allergens: [] },
];

function matchStationId(stationLabel: string | undefined, list: KitchenStation[]): string {
  if (!stationLabel || !list.length) return '';
  const n = stationLabel.toLowerCase().trim();
  const exact = list.find((s) => s.name.toLowerCase() === n);
  if (exact) return exact.id;
  const byWord = (w: string) => list.find((s) => s.name.toLowerCase().includes(w));
  if (n.includes('grill')) return byWord('grill')?.id ?? '';
  if (n.includes('bar')) return byWord('bar')?.id ?? '';
  if (n.includes('cold')) return byWord('cold')?.id ?? '';
  if (n.includes('dessert')) return byWord('dessert')?.id ?? list[0]?.id ?? '';
  if (n.includes('prep') || n.includes('master')) return list[0]?.id ?? '';
  return list[0]?.id ?? '';
}

interface FormState {
  name: string;
  itemCode: string;
  /** Whether this item is marked as exclusive (max 15). */
  exclusiveItem: boolean;
  itemType: ItemType;
  description: string;
  basePrice: number | '';
  costPrice: number | '';
  channelPrices: Partial<Record<string, number | ''>>;
  useSamePriceAllChannels: boolean;
  pricingStrategy: 'standard' | 'menu_specific';
  menuPriceOverrides: { menuId: string; price: number | '' }[];
  status: ItemStatus;
  categoryIds: string[];
  kitchenStationSelectedIds: string[];
  kitchenName: string;
  prepTime: number | '';
  revenueClass: string;
  revenueClassId: string;
  bestPairedItemIds: string[];
  soldBy: 'each' | 'weight' | 'volume';
  unitOfMeasure: string;
  unitId: string;
  pricePerQty: number | '';
  stockUnit: string;
  stockConversionRate: number | '';
  specialInstructions: string;
  masterKot: boolean;
  masterKotMode: 'all' | 'none' | 'selected';
  masterKotOrderTypes: OrderType[];
  kitchenPrintMode: 'all' | 'selected';
  /**
   * Order types excluded from kitchen printing (BE field `kotExcludedOrderTypeIds`).
   * Unique outlet order-type ids (row.orderTypeId), not the coarse OrderType key — several
   * providers (Doordash/Gloriafood/Grubhub/Swiggy) share the same key.
   * Every order type not in this list still prints as usual (default-enabled).
   */
  kitchenPrintExcludedOrderTypeIds: string[];
  isAgeRestricted: boolean;
  minAge: number;
  restrictionReasons: string[];
  inventoryEnabled: boolean;
  inventoryTrackingMode: 'count' | 'availability';
  inventoryStockResetMode: 'carry_forward' | 'auto_reset' | 'clear_stocks';
  currentStock: string;
  lowStockThreshold: string;
  defaultStockQuantity: string;
  unitType: string;
  orderVisibility: Record<OrderType, boolean>;
  /** Per branch outlet order type id — aligns with category `channelVisibility.orderTypeId` (listing). */
  orderVisibilityByOutletId: Record<string, boolean>;
  /** Kiosk device visibility. Master toggle is derived: on if any of the three below is true. */
  isTableSide: boolean;
  isOrderStation: boolean;
  isMenuStation: boolean;
  /** Contactless Dine-in menu visibility (BE field: isCdMenu). */
  isCdMenu: boolean;
  allergens: ItemAttribute[];
  dietaryLabels: ItemAttribute[];
  tags: ItemAttribute[];
  ingredients: ItemAttribute[];
  nutrition: NutritionInfo;
  hasVariations: boolean;
  variations: ItemVariationPreview[];
  modifierIds: string[];
  sessionIds: string[];
  useDefaultSession: boolean;
  containsAlcohol: boolean;
  taxIds: string[];
  isFreeEvent: boolean;
  registrationLabel: string;
  isSeasonal: boolean;
  seasonStart: string;
  seasonEnd: string;
  /* Catering */
  cateringEnabled: boolean;
  cateringServesCount: number | '';
  cateringPricingTiers: ItemPricingTier[];
  cateringMinOrderQty: number | '';
  cateringMaxOrderQty: number | '';
  cateringTaxRateId: string;
}

function itemCompleteness(f: FormState, hasImage: boolean): number {
  // Weights sum to 100. Boolean toggles (exclusiveItem, containsAlcohol,
  // masterKot, isAgeRestricted, inventoryEnabled, etc.) are intentionally excluded.
  let s = 0;

  // ── Mandatory (45 pts) ──────────────────────────────────────────────────────
  if (f.name.trim()) s += 25;
  const priced =
    (f.basePrice !== '' && Number(f.basePrice) > 0) || (f.itemType === 'event' && f.isFreeEvent);
  if (priced) s += 20;

  // ── Core content (40 pts) ───────────────────────────────────────────────────
  if (f.categoryIds.length > 0) s += 12;
  if (f.description.trim()) s += 10;
  if (hasImage) s += 10;
  if (f.itemCode.trim()) s += 8;

  // ── Operational (10 pts) ────────────────────────────────────────────────────
  if (f.prepTime !== '' && Number(f.prepTime) > 0) s += 4;
  if (dedupeKitchenIds(f.kitchenStationSelectedIds).length > 0) s += 3;
  if (f.revenueClass.trim()) s += 2;
  // if (f.taxIds.length > 0) s += 2;

  // ── Enrichment (5 pts) ──────────────────────────────────────────────────────
  if (f.allergens.length > 0 || f.dietaryLabels.length > 0) s += 2;
  if (f.tags.length > 0 || f.ingredients.length > 0) s += 2;
  const n = f.nutrition;
  if ([n.calories, n.protein, n.carbs, n.fat].some(v => v !== '' && v !== undefined)) s += 2;

  return Math.min(100, s);
}

function itemMandatoryComplete(f: FormState): boolean {
  const priced =
    (f.basePrice !== '' && Number(f.basePrice) > 0) || (f.itemType === 'event' && f.isFreeEvent);
  return !!f.name.trim() && priced;
}

function getItemHint(f: FormState, hasImage: boolean): string {
  const priced =
    (f.basePrice !== '' && Number(f.basePrice) > 0) || (f.itemType === 'event' && f.isFreeEvent);
  if (!f.name.trim()) return 'Add an item name to get started.';
  if (!priced && !f.categoryIds.length) return 'Add price and category to improve.';
  if (!priced) return 'Add a price to complete the basics.';
  if (!f.categoryIds.length) return 'Add a category to complete the basics.';
  if (!f.description.trim()) return 'Add a description to help customers.';
  if (!hasImage) return 'Add an image to make your item stand out.';
  if (!f.itemCode.trim()) return 'Add a Item code for better tracking.';
  return 'Your item looks great!';
}

function isValidItemCode(code: string): boolean {
  if (code.length === 0) return true;
  return new RegExp(`^[A-Za-z0-9]{1,${ITEM_CODE_MAX}}$`).test(code);
}

/** At least one letter or number — rejects whitespace- or punctuation-only names. */
function hasAlphanumericName(name: string): boolean {
  return /[A-Za-z0-9]/.test(name.trim());
}

function toIsoLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Single source of truth for item form validation (sync rules + optional server item-code message). */
function computeItemFormErrors(
  form: FormState,
  pricingRows: Array<{ orderTypeId: string; key: OrderType }>,
  serverItemCodeMessage?: string | null,
  isEdit: boolean = false,
): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!form.name.trim()) errs.name = 'Item name is required';
  else if (!hasAlphanumericName(form.name)) errs.name = 'Please enter a valid item name.';
  else if (form.name.length > ITEM_NAME_MAX) errs.name = `Item name cannot exceed ${ITEM_NAME_MAX} characters.`;
  const isFreeEvent = form.itemType === 'event' && form.isFreeEvent;
  if (!isFreeEvent) {
    if (form.basePrice === '' || form.basePrice === null) errs.basePrice = 'Base price is required';
    else {
      const bp = Number(form.basePrice);
      if (!Number.isFinite(bp) || bp < 0) errs.basePrice = 'Enter a valid price (0 or greater)';
    }
  }
  if (!form.useDefaultSession && form.sessionIds.length === 0) {
    errs.sessionIds = 'Select at least one session or enable Default "All Day"';
  }
  if (form.isSeasonal) {
    const todayIso = toIsoLocalDate(new Date());
    if (!form.seasonStart) errs.seasonStart = 'Start date is required for seasonal items';
    else if (!isEdit && form.seasonStart < todayIso) errs.seasonStart = 'Start date cannot be in the past';
    if (!form.seasonEnd) errs.seasonEnd = 'End date is required for seasonal items';
    if (form.seasonStart && form.seasonEnd) {
      const t0 = new Date(form.seasonStart).getTime();
      const t1 = new Date(form.seasonEnd).getTime();
      if (Number.isFinite(t0) && Number.isFinite(t1) && t1 < t0) {
        errs.seasonEnd = 'End date must be on or after the start date';
      }
    }
  }
  const code = form.itemCode.trim();
  if (code.length > 0 && !isValidItemCode(code)) {
    errs.itemCode = `Item code must be letters and numbers only (up to ${ITEM_CODE_MAX} characters)`;
  } else if (serverItemCodeMessage && code.length > 0 && isValidItemCode(code)) {
    errs.itemCode = serverItemCodeMessage;
  }

  if (form.costPrice !== '' && form.costPrice !== undefined && form.costPrice !== null) {
    const c = Number(form.costPrice);
    if (!Number.isFinite(c) || c < 0) errs.costPrice = 'Enter a valid cost (0 or greater)';
  }
  if (!form.useSamePriceAllChannels && !isFreeEvent) {
    for (const row of pricingRows) {
      const enabled = form.orderVisibilityByOutletId[row.orderTypeId] !== false;
      if (!enabled) continue;
      const v = form.channelPrices[row.orderTypeId];
      if (v === '' || v === undefined || v === null) {
        errs.channelPrices = 'Enter a price for each enabled channel';
        break;
      }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        errs.channelPrices = 'Enter a valid price (0 or greater) for each channel';
        break;
      }
    }
  }
  if (form.pricingStrategy === 'menu_specific') {
    for (const row of form.menuPriceOverrides) {
      if (row.price === '' || row.price === undefined) continue;
      const n = Number(row.price);
      if (!Number.isFinite(n) || n < 0) {
        errs.menuPriceOverrides = 'Enter a valid menu price (0 or greater)';
        break;
      }
    }
  }
  if (form.bestPairedItemIds.length > BEST_PAIRED_MAX) {
    errs.bestPaired = `You can add at most ${BEST_PAIRED_MAX} best paired items.`;
  }
  const kitchenRows = pricingRows.filter((row) => !isThirdPartyTypeGroup((row as { typeGroup?: string }).typeGroup));
  if (form.kitchenPrintMode === 'selected' && kitchenRows.length > 0) {
    const printingCount = kitchenRows.filter((row) => !form.kitchenPrintExcludedOrderTypeIds.includes(row.orderTypeId)).length;
    if (printingCount === 0) {
      errs.kitchenPrintOrderTypes = 'Pick at least one order type, or choose Follow outlet default.';
    }
  }
  if (form.soldBy !== 'each' && !form.unitId) {
    errs.unit = 'Select a unit of measure';
  }
  if (form.inventoryEnabled) {
    const MAX_STOCK = form.soldBy === 'each' ? 9999 : 9999.999;
    const requiresDefault = form.inventoryStockResetMode === 'auto_reset';
    const defaultRaw = form.defaultStockQuantity.trim();
    if (requiresDefault && !defaultRaw) {
      errs.defaultStockQuantity = 'Default stock quantity is required';
    } else if (defaultRaw) {
      const def = Number(defaultRaw);
      if (!Number.isFinite(def) || def < 0) {
        errs.defaultStockQuantity = 'Enter a valid default stock quantity (0 or greater)';
      } else if (def > MAX_STOCK) {
        errs.defaultStockQuantity = `Default stock quantity cannot exceed ${MAX_STOCK}`;
      } else {
        const alertRaw = form.lowStockThreshold.trim();
        if (alertRaw) {
          const alert = Number(alertRaw);
          if (!Number.isFinite(alert) || alert < 0) {
            errs.lowStockThreshold = 'Enter a valid low stock alert (0 or greater)';
          } else if (alert > MAX_STOCK) {
            errs.lowStockThreshold = `Low stock alert cannot exceed ${MAX_STOCK}`;
          } else if (alert >= def) {
            errs.lowStockThreshold = 'Low stock alert must be less than default stock quantity';
          }
        }
      }
    }
    const currentRaw = form.currentStock.trim();
    if (currentRaw) {
      const current = Number(currentRaw);
      if (!Number.isFinite(current) || current < 0) {
        errs.currentStock = 'Enter a valid stock quantity (0 or greater)';
      } else if (current > MAX_STOCK) {
        errs.currentStock = `Current stock cannot exceed ${MAX_STOCK}`;
      }
    }
  }

  // Catering bulk tray sizes: an added tray must have Size (serves) and Price filled.
  // Each tray size must be greater than the base serves-per-unit and unique across trays.
  if (form.cateringEnabled) {
    const baseServes = form.cateringServesCount === '' ? 1 : Number(form.cateringServesCount);
    const seenSizes = new Set<number>();
    form.cateringPricingTiers.forEach((tier, idx) => {
      const size = tier.servesCount;
      const sizeFilled = size !== undefined && size !== null && Number(size) >= 1;
      const price = tier.price;
      const priceFilled = price !== undefined && price !== null && !isNaN(Number(price)) && Number(price) > 0;
      if (!sizeFilled) {
        errs[`cateringTray_${idx}_size`] = 'Required';
      } else {
        const sizeNum = Number(size);
        if (sizeNum <= baseServes) {
          errs[`cateringTray_${idx}_size`] = `Must be more than base (${baseServes})`;
        } else if (seenSizes.has(sizeNum)) {
          errs[`cateringTray_${idx}_size`] = 'Duplicate size';
        } else {
          seenSizes.add(sizeNum);
        }
      }
      if (!priceFilled) errs[`cateringTray_${idx}_price`] = 'Required';
      if (!tier.label?.trim()) errs[`cateringTray_${idx}_label`] = 'Required';
    });
  }

  return errs;
}

function getParentCategoryChildSelectionError(
  selectedCategoryIds: string[],
  expandedParentCategoryIds: Set<string>,
  categories: Category[],
): string | null {
  const selectedSet = new Set(selectedCategoryIds);
  const invalidParents = categories.filter((parent) => {
    if (parent.parentCategoryId) return false;
    const childIds = categories.filter((c) => c.parentCategoryId === parent.id).map((c) => c.id);
    if (childIds.length === 0) return false;
    const parentTouched = expandedParentCategoryIds.has(parent.id) || selectedSet.has(parent.id);
    if (!parentTouched) return false;
    const hasAnyChildSelected = childIds.some((id) => selectedSet.has(id));
    return !hasAnyChildSelected;
  });

  if (invalidParents.length === 0) return null;
  if (invalidParents.length === 1) {
    return `Select at least one sub-category under "${invalidParents[0].name}", or deselect that parent category.`;
  }
  return 'Select at least one sub-category under each selected parent category, or deselect those parent categories.';
}


function categoryAllowsOrderTypeKey(
  cat: Category,
  key: OrderType,
  orderTypeIdByKey: Partial<Record<OrderType, string>>,
): boolean {
  const branchId = orderTypeIdByKey[key];
  const cvList = cat.channelVisibility;
  // If API provided channelVisibility (including empty), treat it as authoritative.
  if (Array.isArray(cvList)) {
    if (!branchId) return false;
    const row = cvList.find((c) => String(c.orderTypeId).trim() === String(branchId).trim());
    if (row) return row.enabled !== false;
    return false;
  }
  return cat.orderTypeVisibility[key] !== false;
}

/** Union: channel is available if any selected category allows it. */
function channelAllowedByAnyCategory(
  assignedCats: Category[],
  key: OrderType,
  orderTypeIdByKey: Partial<Record<OrderType, string>>,
): boolean {
  if (assignedCats.length === 0) return true;
  return assignedCats.some((c) => categoryAllowsOrderTypeKey(c, key, orderTypeIdByKey));
}

function toSingleTagSelection(next: ItemAttribute[]): ItemAttribute[] {
  if (next.length <= 1) return next;
  // Keep the most recently selected tag when multiple are returned.
  return [next[next.length - 1]];
}

function pickItemIdFromApiResponse(payload: unknown): string {
  const read = (obj: unknown): string => {
    if (!obj) return '';
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = read(item);
        if (found) return found;
      }
      return '';
    }
    if (typeof obj !== 'object') return '';
    const row = obj as Record<string, unknown>;
    const direct = String(row.itemId ?? row.itemID ?? row.item_id ?? row.id ?? '').trim();
    if (direct) return direct;
    const nestedCandidates = [
      row.data,
      row.result,
      row.item,
      row.response,
      row.content,
    ];
    for (const c of nestedCandidates) {
      if (Array.isArray(c) && c.length > 0) {
        const fromFirst = read(c[0]);
        if (fromFirst) return fromFirst;
      } else {
        const nested = read(c);
        if (nested) return nested;
      }
    }
    return '';
  };
  return read(payload);
}

function pickEntityIdFromApiResponse(payload: unknown, keys: string[]): string {
  const read = (obj: unknown): string => {
    if (!obj) return '';
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = read(item);
        if (found) return found;
      }
      return '';
    }
    if (typeof obj !== 'object') return '';
    const row = obj as Record<string, unknown>;
    for (const key of keys) {
      const direct = String(row[key] ?? '').trim();
      if (direct) return direct;
    }
    const nestedCandidates = [row.data, row.result, row.item, row.response, row.content];
    for (const c of nestedCandidates) {
      if (Array.isArray(c) && c.length > 0) {
        const fromFirst = read(c[0]);
        if (fromFirst) return fromFirst;
      } else {
        const nested = read(c);
        if (nested) return nested;
      }
    }
    return '';
  };
  return read(payload);
}

/* Helpers for comparing item attributes by ID */
function arrayDiff(previous: string[] = [], current: string[] = []) {
  const prevSet = new Set(previous);
  const currSet = new Set(current);
  const added = current.filter((id) => !prevSet.has(id));
  const removed = previous.filter((id) => !currSet.has(id));
  return { added, removed };
}

/** Deduped kitchen station tag ids (preserves first-seen order). */
function dedupeKitchenIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const t = String(id ?? '').trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function sortSelectedFirst(options: ItemAttribute[], selected: ItemAttribute[]): ItemAttribute[] {
  const selectedIds = new Set(selected.map((s) => s.id));
  const alpha = (a: ItemAttribute, b: ItemAttribute) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  const selectedGroup = options.filter((o) => selectedIds.has(o.id)).sort(alpha);
  const unselectedGroup = options.filter((o) => !selectedIds.has(o.id)).sort(alpha);
  return [...selectedGroup, ...unselectedGroup];
}

function sortSelectedFirstByIdName<T extends { id: string; name: string }>(
  options: T[],
  selectedIdsInput: string[],
): T[] {
  const selectedIds = new Set(selectedIdsInput);
  const alpha = (a: T, b: T) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  const selectedGroup = options.filter((o) => selectedIds.has(o.id)).sort(alpha);
  const unselectedGroup = options.filter((o) => !selectedIds.has(o.id)).sort(alpha);
  return [...selectedGroup, ...unselectedGroup];
}

/** Same two-block order as ItemAssignmentSection: IDs from load stay on top; new picks stay in the lower block. */
function sortPersistedFirstAttribute(options: ItemAttribute[], persistedIds: string[]): ItemAttribute[] {
  const persisted = new Set(persistedIds);
  const alpha = (a: ItemAttribute, b: ItemAttribute) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  const blockA = options.filter((o) => persisted.has(o.id)).sort(alpha);
  const blockB = options.filter((o) => !persisted.has(o.id)).sort(alpha);
  return [...blockA, ...blockB];
}

function sortPersistedFirstByIdName<T extends { id: string; name: string }>(
  options: T[],
  persistedIds: string[],
): T[] {
  const persisted = new Set(persistedIds);
  const alpha = (a: T, b: T) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  const blockA = options.filter((o) => persisted.has(o.id)).sort(alpha);
  const blockB = options.filter((o) => !persisted.has(o.id)).sort(alpha);
  return [...blockA, ...blockB];
}

const statusPreviewBadge: Record<
  ItemStatus,
  { label: string; bg: string; color: string }
> = {
  active: { label: 'Available', bg: '#DCFCE7', color: '#3F5A3A' },
  draft: { label: 'Draft', bg: '#F3F4F6', color: '#6E665D' },
  out_of_stock: { label: 'Out of stock', bg: '#F0D6CF', color: '#8E3226' },
  hidden: { label: 'Hidden', bg: '#FFEDD5', color: '#8A6D33' },
  archived: { label: 'Archived', bg: '#E8E0D1', color: '#374151' },
};

const emptyForm: FormState = {
  name: '',
  itemCode: '',
  exclusiveItem: false,
  itemType: 'prepared_food_beverage',
  description: '',
  basePrice: '',
  costPrice: '',
  channelPrices: {},
  useSamePriceAllChannels: true,
  pricingStrategy: 'standard',
  menuPriceOverrides: [],
  status: 'draft',
  categoryIds: [],
  kitchenStationSelectedIds: [],
  kitchenName: '',
  prepTime: 15,
  revenueClass: '',
  revenueClassId: '',
  bestPairedItemIds: [],
  soldBy: 'each',
  unitOfMeasure: 'Each',
  unitId: '',
  pricePerQty: 1,
  stockUnit: '',
  stockConversionRate: '',
  specialInstructions: '',
  masterKot: false,
  masterKotMode: 'all',
  masterKotOrderTypes: [],
  kitchenPrintMode: 'all',
  kitchenPrintExcludedOrderTypeIds: [],
  isAgeRestricted: false,
  minAge: 18,
  restrictionReasons: [],
  inventoryEnabled: false,
  inventoryTrackingMode: 'count',
  inventoryStockResetMode: 'auto_reset',
  currentStock: '',
  lowStockThreshold: '',
  defaultStockQuantity: '',
  unitType: 'Each',
  orderVisibility: defaultOrderVisibility(),
  orderVisibilityByOutletId: {},
  isTableSide: true,
  isOrderStation: true,
  isMenuStation: true,
  isCdMenu: true,
  allergens: [],
  dietaryLabels: [],
  tags: [],
  ingredients: [],
  nutrition: {},
  hasVariations: false,
  variations: [],
  modifierIds: [],
  sessionIds: [],
  useDefaultSession: true,
  containsAlcohol: false,
  taxIds: [],
  isFreeEvent: false,
  registrationLabel: 'Register',
  isSeasonal: false,
  seasonStart: '',
  seasonEnd: '',
  cateringEnabled: false,
  cateringServesCount: 1,
  cateringPricingTiers: [],
  cateringMinOrderQty: '',
  cateringMaxOrderQty: '',
  cateringTaxRateId: '',
};

/* --------- styles --------- */

const S = {
  twoColRow: {
    display: 'flex',
    gap: 24,
    padding: '12px 24px 16px',
    alignItems: 'flex-start' as const,
  } as React.CSSProperties,
  leftCol: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  rightRail: {
    flex: '0 0 clamp(280px, 32%, 360px)',
    minWidth: 280,
    maxWidth: 360,
    flexShrink: 0,
    alignSelf: 'flex-start' as const,
    position: 'sticky' as const,
    top: 12,
  } as React.CSSProperties,
  previewCard: {
    background: 'var(--surface, #FFFFFF)',
    border: '1px solid var(--card-border, #E6DFD3)',
    borderRadius: 2,
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
    overflow: 'hidden',
  } as React.CSSProperties,
  previewImage: {
    aspectRatio: '4 / 3',
    background: '#F1ECE2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9A9084',
  } as React.CSSProperties,
  previewBody: {
    padding: 16,
  } as React.CSSProperties,
  card: {
    background: 'var(--surface, #FFFFFF)',
    border: '1px solid var(--card-border, #E6DFD3)',
    borderRadius: 2,
    padding: 24,
  } as React.CSSProperties,
  section: {
    borderBottom: '1px solid var(--card-border, #E6DFD3)',
    paddingBottom: 24,
    marginBottom: 24,
  } as React.CSSProperties,
  sectionLast: {
    paddingBottom: 0,
    marginBottom: 0,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#9A9084',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: 16,
    fontFamily: 'var(--font-primary)',
  } as React.CSSProperties,
  typeRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 10,
    overflowX: 'auto' as const,
    paddingBottom: 4,
  } as React.CSSProperties,
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 2,
    background: 'var(--accent-soft, rgba(184,149,80,0.08))',
    color: 'var(--accent, #B89550)',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'var(--font-primary)',
  } as React.CSSProperties,
  pillRemove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    color: 'var(--accent, #B89550)',
  } as React.CSSProperties,
  addCatBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    borderRadius: 2,
    border: '1px dashed var(--card-border, #E6DFD3)',
    background: 'transparent',
    color: 'var(--t2, #6E665D)',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
  } as React.CSSProperties,
  channelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12,
  } as React.CSSProperties,
  whiteCard: {
    background: 'var(--surface, #FFFFFF)',
    border: '1px solid var(--card-border, #E6DFD3)',
    borderRadius: 2,
    padding: 24,
    marginBottom: 20,
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  } as React.CSSProperties,
  cardTitle: {
    margin: '0 0 4px 0',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--t1, #453F39)',
    fontFamily: 'var(--font-primary)',
  } as React.CSSProperties,
  cardSubtitle: {
    margin: '0 0 16px 0',
    fontSize: 11,
    color: 'var(--t2, #6E665D)',
    fontFamily: 'var(--font-primary)',
    lineHeight: 1.45,
  } as React.CSSProperties,
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
  } as React.CSSProperties,
  templateBanner: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    gap: 12,
    background: 'rgba(184,149,80, 0.05)',
    border: '1px solid rgba(184,149,80, 0.15)',
    borderRadius: 2,
    padding: '12px 16px',
    marginBottom: 16,
  } as React.CSSProperties,
  templatePanel: {
    background: 'var(--surface, #FFFFFF)',
    border: '1px solid var(--card-border, #E6DFD3)',
    borderRadius: 2,
    padding: '16px 20px',
    marginBottom: 16,
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  } as React.CSSProperties,
  templateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: 12,
  } as React.CSSProperties,
};

export default function ItemFormPage() {
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    items,
    editingItemId,
    fetchItems,
    clearItemsCache,
    createItemOnServer,
    updateItemOnServer,
    validateItemCodeOnServer,
    uploadItemImageOnServer,
    removeItemImageOnServer,
    error: itemsError,
  } = useItemsStore();
  // console.log({items});
  
  const { auth } = useAuth();
  const { selectedBranch } = useBranch();
  // Store-level catering feature flag — when the outlet has catering disabled,
  // the whole Catering section is hidden from the item form.
  const isStoreCateringEnabled = selectedBranch?.uiFeatureFlags?.isCateringEnabled === true;
  const location = useLocation();
  const isEditRoute = location.pathname === pcPaths.itemEdit;
  const id = isEditRoute ? editingItemId : null;
  const { categories } = useCategoriesStore();
  const { stations, fetchStations, error: stationsError } = useKitchenStationsStore();
  const { modifiers, fetchModifiers, error: modifiersError } = useModifiersStore();
  const { sessions, fetchSessions, error: sessionsError } = useSessionsStore();
  const { variationSets, fetchVariationSets, loading: optionSetsLoading, error: optionSetsError } = useVariationSetsStore();
  const { tags, ingredients, diet: dietaryLabels, allergens, tax: taxOptions, units: unitOptions, revenueClass: revenueClassOptions, fetchAttributes, error: attributesError } = useItemAttributesStore();
  const { addToast } = useToastStore();
  const { menus } = useMenusStore();
  const { getForItem: getMenuPricesForItem, setMenuPrice, removeAllForItem: removeMenuPricesForItem } = useMenuPricesStore();
  const isMobile = useMediaQuery('(max-width: 768px)');
  useErrorToast(itemsError, { fallbackMessage: 'Failed to load items' });
  useErrorToast(stationsError, { fallbackMessage: 'Failed to load kitchen stations' });
  useErrorToast(modifiersError, { fallbackMessage: 'Failed to load modifiers' });
  useErrorToast(sessionsError, { fallbackMessage: 'Failed to load sessions' });
  useErrorToast(optionSetsError, { fallbackMessage: 'Failed to load option sets' });
  useErrorToast(attributesError.tags, { fallbackMessage: 'Failed to load tags' });
  useErrorToast(attributesError.ingredients, { fallbackMessage: 'Failed to load ingredients' });
  useErrorToast(attributesError.diet, { fallbackMessage: 'Failed to load dietary labels' });
  useErrorToast(attributesError.allergens, { fallbackMessage: 'Failed to load allergens' });
  useErrorToast(attributesError.tax, { fallbackMessage: 'Failed to load tax options' });

  const isEdit = Boolean(id);
  const existing = isEdit ? items.find((i) => i.id === id) : null;
  const saveIdleLabel = isEdit ? 'Update Item' : 'Create Item';
  const saveLoadingLabel = isEdit ? 'Updating...' : 'Creating...';
  const cloneId = !isEdit ? searchParams.get('clone')?.trim() || null : null;
  const cloneSource = useMemo(
    () => (!isEdit && cloneId ? items.find((i) => i.id === cloneId) ?? null : null),
    [isEdit, cloneId, items],
  );
  const isCloneHydrate = Boolean(!isEdit && cloneSource);
  const hydrateKeyRef = useRef<string>('');
  const initialBestPairedItemIdsRef = useRef<string[]>([]);
  const initialAllergenIdsRef = useRef<string[]>([]);
  const initialDietaryIdsRef = useRef<string[]>([]);
  const initialIngredientIdsRef = useRef<string[]>([]);
  const initialTagIdsRef = useRef<string[]>([]);
  const initialCategoryIdsRef = useRef<string[]>([]);
  const initialModifierIdsRef = useRef<string[]>([]);
  const initialBulkPriceIdsRef = useRef<string[]>([]);
  const initialSessionIdsRef = useRef<string[]>([]);
  const initialSessionSlotIdsByGroupRef = useRef<Record<string, string[]>>({});
  const initialKitchenStationIdsRef = useRef<string[]>([]);
  const itemCodeInputRef = useRef<HTMLInputElement>(null);
  const initialTaxIdsRef = useRef<string[]>([]);

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    if (isEdit) {
      setTopBarProps({
        title: `Edit Item (${existing?.name})`,
        breadcrumbs: 'Product Catalog > Items',
        subtitle: undefined,
      });
    } else if (isCloneHydrate && cloneSource) {
      setTopBarProps({
        title: `Clone Item (${cloneSource.name})`,
        breadcrumbs: 'Product Catalog > Items',
        subtitle: undefined,
      });
    } else {
      setTopBarProps({
        title: 'New Item',
        breadcrumbs: 'Product Catalog > Items',
        subtitle: undefined,
      });
    }
  }, [setTopBarProps, isEdit, isCloneHydrate, cloneSource]);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) return;
    void fetchAttributes(locationId, token);
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token, fetchAttributes]);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) return;
    void fetchItems(locationId, token, { skipDuplicateMs: 750 });
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token, fetchItems]);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) return;
    void fetchSessions(locationId, token, { skipDuplicateMs: 750 });
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token, fetchSessions]);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) return;
    void fetchModifiers(locationId, token, { skipDuplicateMs: 750 });
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token, fetchModifiers]);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) return;
    void fetchStations(locationId, token, { skipDuplicateMs: 750 });
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token, fetchStations]);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) return;
    void fetchVariationSets(locationId, token, { skipDuplicateMs: 750 });
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token, fetchVariationSets]);

  const [form, setForm] = useState<FormState>(emptyForm);
  // console.log({form});
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** One row per branch outlet order type — same source as category listing channel names. */
  const outletChannelRows = useMemo(() => {
    const list = getOrderTypesForBranch(selectedBranch as Record<string, unknown> | null | undefined);
    if (list.length === 0) {
      return allOrderTypes.map((k) => ({
        orderTypeId: '',
        key: k,
        label: channelLabels[k],
      }));
    }
    return list
      .map((ot) => {
        const k = mapOutletOrderTypeToKey(ot as OutletOrderType);
        if (!k) return null;
        const id = String(ot.id ?? '').trim();
        if (!id) return null;
        const label = getChannelDisplayName(ot.typeName) || (ot.typeName ?? '').trim() || channelLabels[k];
        return { orderTypeId: id, key: k, label, typeGroup: ot.typeGroup };
      })
      .filter((x): x is { orderTypeId: string; key: OrderType; label: string; typeGroup: string | undefined } => x !== null);
  }, [selectedBranch]);

  /** One row per outlet order type — not deduped — so Doordash/Grubhub/Ubereats each appear. */
  const pricingOrderTypeRows = useMemo(() => {
    if (outletChannelRows.length === 0) {
      return allOrderTypes.map((k) => ({ orderTypeId: k as string, key: k, label: channelLabels[k] }));
    }
    if (!outletChannelRows[0].orderTypeId) {
      return outletChannelRows.map((r) => ({ orderTypeId: r.key as string, key: r.key, label: r.label }));
    }
    return outletChannelRows.map((r) => ({ orderTypeId: r.orderTypeId, key: r.key, label: r.label, typeGroup: (r as { typeGroup?: string }).typeGroup }));
  }, [outletChannelRows]);
  /** Kitchen printing leaves third-party order types out — the backend applies the Delivery rule to them. */
  const kitchenPrintRows = useMemo(
    () => pricingOrderTypeRows.filter((row) => !isThirdPartyTypeGroup((row as { typeGroup?: string }).typeGroup)),
    [pricingOrderTypeRows],
  );
  const activeOrderTypes = useMemo(() => {
    if (!outletChannelRows[0]?.orderTypeId) {
      return allOrderTypes;
    }
    return pricingOrderTypeRows.map((r) => r.key);
  }, [outletChannelRows, pricingOrderTypeRows]);
  const [saving, setSaving] = useState(false);
  const [showZeroPriceModal, setShowZeroPriceModal] = useState(false);
  const [zeroPriceModalDetail, setZeroPriceModalDetail] = useState<{
    mode: 'base' | 'channels';
    channelLabels: string[];
  }>({ mode: 'base', channelLabels: [] });
  const [showPastSeasonEndModal, setShowPastSeasonEndModal] = useState(false);
  // Per-location custom age list (e.g. [17, 19]). Fetched on mount per
  // locationId. The picker merges these with the hardcoded presets and lets
  // the user add new ones via the "+ Add custom age" affordance.
  const ageLocationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
  const ageAuthToken = (auth?.accessToken ?? auth?.access_token ?? null) as string | null;
  const {
    ages: locationCustomAges,
    addAge: addLocationAge,
    refetch: refetchLocationAges,
  } = useLocationAges(ageLocationId || null, ageAuthToken);
  // Inline-add UI state for the dropdown's "+ Add custom" row.
  const [customAgeInput, setCustomAgeInput] = useState<string>('');
  const [customAgeError, setCustomAgeError] = useState<string | null>(null);
  const [customAgeBusy, setCustomAgeBusy] = useState<boolean>(false);
  const skipPastSeasonEndCheckRef = useRef(false);
  const skipZeroPriceCheckRef = useRef(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showVariationSetPicker, setShowVariationSetPicker] = useState(false);
  const [showOptionSetPicker, setShowOptionSetPicker] = useState(false);
  const [expandedOptionSetId, setExpandedOptionSetId] = useState<string | null>(null);
  const [removeVariationsOpen, setRemoveVariationsOpen] = useState(false);
  const [initialFormSnapshot, setInitialFormSnapshot] = useState<string>('');
  const [expandedParentCategoryIds, setExpandedParentCategoryIds] = useState<Set<string>>(new Set());
  const [categorySearch, setCategorySearch] = useState('');
  const [primaryImageFile, setPrimaryImageFile] = useState<File | null>(null);
  const [hideSavedPrimaryImage, setHideSavedPrimaryImage] = useState(false);
  const [additionalImageFiles, setAdditionalImageFiles] = useState<Array<File | null>>(
    Array.from({ length: 5 }, () => null),
  );

  // Track whether form has unsaved changes
  const isFormDirty = useCallback(() => {
    if (!initialFormSnapshot) return false;
    try {
      if (JSON.stringify(form) !== initialFormSnapshot) return true;
      if (primaryImageFile != null) return true;
      if (hideSavedPrimaryImage) return true;
      if (additionalImageFiles.some((f) => f != null)) return true;
      return false;
    } catch { return false; }
  }, [form, initialFormSnapshot, primaryImageFile, hideSavedPrimaryImage, additionalImageFiles]);

  // Guard all navigation (cancel, browser back, sidebar) with standard discard modal
  const { showDiscardModal, handleCancel: handleDiscardCancel, handleConfirmDiscard, handleKeepEditing } = useFormDiscardGuard(isFormDirty(), pcPaths.items);

  const [pendingItemType, setPendingItemType] = useState<ItemType | null>(null);
  const [dragVariationId, setDragVariationId] = useState<string | null>(null);
  const [dragModifierId, setDragModifierId] = useState<string | null>(null);
  const [categorySortSnapshot, setCategorySortSnapshot] = useState<Set<string>>(new Set());

  /* Exclusive item slots. The max/limit is NOT a static FE constant — it comes
     from the merchant location details API (`exclusiveItemCount`, GET
     /merchants/location/:id/details; despite the "Count" name, BE confirmed
     this field is the configured LIMIT, not how many items are currently
     exclusive). Fetch it cache-first via the same shared cache DesktopLayout
     uses, and read it off the raw payload — DesktopLayout's restaurantDetails
     store narrows the payload to `payload.restaurantDetails` when present,
     which would drop this sibling field. */
  const [exclusiveItemsLimit, setExclusiveItemsLimit] = useState<number | null>(null);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    if (!locationId) return;

    const token = auth?.accessToken ?? auth?.access_token ?? null;
    let cancelled = false;
    const cacheKey = String(locationId);

    const applyPayload = (payload: any) => {
      if (cancelled || !payload) return;
      const raw = payload?.exclusiveItemCount ?? payload?.restaurantDetails?.exclusiveItemCount;
      setExclusiveItemsLimit(typeof raw === 'number' ? raw : null);
    };

    const cached = locationDetailsCache.get(cacheKey);
    if (cached) {
      applyPayload(cached);
      return () => { cancelled = true; };
    }

    const inFlight = locationDetailsInFlight.get(cacheKey);
    if (inFlight) {
      inFlight.then(applyPayload).catch(() => {});
      return () => { cancelled = true; };
    }

    const req = getLocationDetails(locationId, token)
      .then((res: any) => {
        const payload = res?.metaDataInfo?.data ?? res?.data ?? res;
        if (payload) locationDetailsCache.set(cacheKey, payload);
        return payload;
      })
      .finally(() => {
        locationDetailsInFlight.delete(cacheKey);
      });
    locationDetailsInFlight.set(cacheKey, req);
    req.then(applyPayload).catch(() => {});

    return () => { cancelled = true; };
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token]);

  /* Exclusive item current tally (how many items are already marked exclusive). */
  const [exclusiveItemsCount, setExclusiveItemsCount] = useState<number | null>(null);
  const [exclusiveItemsLoading, setExclusiveItemsLoading] = useState(false);
  const [exclusiveItemIds, setExclusiveItemIds] = useState<string[]>([]);
  const [exclusiveFetchCompleted, setExclusiveFetchCompleted] = useState(false);
  const exclusiveHydratedItemIdRef = useRef<string | null>(null);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    if (!locationId) return;

    const token = auth?.accessToken ?? auth?.access_token ?? null;
    let cancelled = false;

    setExclusiveItemsLoading(true);
    setExclusiveItemsCount(null);
    setExclusiveItemIds([]);
    setExclusiveFetchCompleted(false);

    void (async () => {
      try {
        const data = await getExclusiveItemsApi(locationId, token);
        const items = (data as any)?.items;
        const arr = Array.isArray(items) ? items : [];

        const ids = arr
          .map((x: any) => String(x?.itemId ?? x?.itemID ?? x?.id ?? '').trim())
          .filter((s: string) => Boolean(s));

        if (cancelled) return;
        setExclusiveItemsCount(arr.length);
        setExclusiveItemIds(ids);
      } catch {
        if (cancelled) return;
        setExclusiveItemsCount(null);
        setExclusiveItemIds([]);
      } finally {
        if (cancelled) return;
        setExclusiveItemsLoading(false);
        setExclusiveFetchCompleted(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token]);

  const isExclusiveOnServer = useMemo(() => {
    if (!isEdit || !existing?.id) return false;
    return exclusiveItemIds.includes(existing.id);
  }, [isEdit, existing?.id, exclusiveItemIds]);

  // Display count should react immediately to checkbox changes.
  // - if item is already exclusive on server, checking should NOT increase the count
  // - unchecking should decrease by 1 (pending save)
  // - checking a non-exclusive item should increase by 1 (pending save)
  const exclusiveCountForDisplay = useMemo(() => {
    if (exclusiveItemsCount == null) return null;
    if (form.exclusiveItem) return exclusiveItemsCount + (isExclusiveOnServer ? 0 : 1);
    return exclusiveItemsCount + (isExclusiveOnServer ? -1 : 0);
  }, [exclusiveItemsCount, isExclusiveOnServer, form.exclusiveItem]);

  useEffect(() => {
    if (!isEdit || !existing?.id) return;
    if (!exclusiveFetchCompleted) return;
    if (exclusiveHydratedItemIdRef.current === existing.id) return;

    exclusiveHydratedItemIdRef.current = existing.id;
    setForm((prev) => ({ ...prev, exclusiveItem: isExclusiveOnServer }));
  }, [isEdit, existing?.id, exclusiveFetchCompleted, isExclusiveOnServer]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const itemNameInputRef = useRef<HTMLInputElement | null>(null);
  /** Primary image media ids to delete on save after user removed primary (incl. promote flow). */
  const pendingDeletePrimaryMediaIdsRef = useRef<string[]>([]);
  const additionalImageInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const additionalImagePreviewsRef = useRef<string[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState('');
  const [existingPrimaryImageId, setExistingPrimaryImageId] = useState<string | null>(null);
  const [cloneSourcePrimaryImageId, setCloneSourcePrimaryImageId] = useState<string | null>(null);
  const [additionalImagePreviews, setAdditionalImagePreviews] = useState<Array<string | null>>(
    Array.from({ length: 5 }, () => null),
  );
  const [existingAdditionalImageIds, setExistingAdditionalImageIds] = useState<Array<string | null>>(
    Array.from({ length: 5 }, () => null),
  );
  const [cloneSourceAdditionalImageIds, setCloneSourceAdditionalImageIds] = useState<Array<string | null>>(
    Array.from({ length: 5 }, () => null),
  );
  const apiAllergens = allergens;
  const apiDietary = dietaryLabels;
  const apiIngredients = ingredients;
  const apiTags = tags;
  // Tax configuration (item-level tax)
  const apiTaxOptions = taxOptions;
  const TAX_OPTIONS = useMemo(
    () => apiTaxOptions.map((t) => ({ value: t.taxId, label: t.label })),
    [apiTaxOptions],
  );
  const hasTaxOptions = TAX_OPTIONS.length > 0;
  const optionSets = variationSets;
// console.log({apiTaxOptions,taxOptions});

  // Catering tax rate — temporarily hidden; catering uses the item's regular (item-level) tax.
  // const cateringTaxOptions = useMemo(
  //   () => taxOptions.map((t) => ({ value: t.taxId, label: t.label })),
  //   [taxOptions],
  // );

  const handleImageFile = (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      addToast('Accepts only valid formats: PNG, JPEG, JPG.', 'error');
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      addToast('Image must be 2MB or smaller.', 'error');
      return;
    }
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setPrimaryImageFile(file);
    setImageFileName(file.name);
    setHideSavedPrimaryImage(false);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    handleImageFile(file);
    event.target.value = '';
  };

  const handleRemoveImage = () => {
    let promoteIdx = -1;
    for (let i = 0; i < 5; i += 1) {
      if (additionalImagePreviews[i] || additionalImageFiles[i]) {
        promoteIdx = i;
        break;
      }
    }

    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);

    const queueOldPrimaryForDeletion = () => {
      const idToQueue = existingPrimaryImageId || cloneSourcePrimaryImageId;
      if (idToQueue && !pendingDeletePrimaryMediaIdsRef.current.includes(idToQueue)) {
        pendingDeletePrimaryMediaIdsRef.current.push(idToQueue);
      }
    };

    if (promoteIdx < 0) {
      queueOldPrimaryForDeletion();
      setPrimaryImageFile(null);
      setImagePreview(null);
      setImageFileName('');
      setHideSavedPrimaryImage(true);
      setExistingPrimaryImageId(null);
      setCloneSourcePrimaryImageId(null);
      addToast('Primary image removed.', 'success');
      return;
    }

    queueOldPrimaryForDeletion();

    const i = promoteIdx;
    const file = additionalImageFiles[i];
    const prevUrl = additionalImagePreviews[i];
    const exAdd = existingAdditionalImageIds[i];
    const clAdd = cloneSourceAdditionalImageIds[i];

    const shiftAdditionalLeftFrom = (from: number) => {
      setAdditionalImageFiles((p) => {
        const n = [...p];
        for (let j = from; j < 4; j += 1) n[j] = n[j + 1];
        n[4] = null;
        return n;
      });
      setAdditionalImagePreviews((p) => {
        const n = [...p];
        for (let j = from; j < 4; j += 1) n[j] = n[j + 1];
        const dropped = n[4];
        if (dropped?.startsWith('blob:')) URL.revokeObjectURL(dropped);
        n[4] = null;
        additionalImagePreviewsRef.current = n.filter((u): u is string => Boolean(u));
        return n;
      });
      setExistingAdditionalImageIds((p) => {
        const n = [...p];
        for (let j = from; j < 4; j += 1) n[j] = n[j + 1];
        n[4] = null;
        return n;
      });
      setCloneSourceAdditionalImageIds((p) => {
        const n = [...p];
        for (let j = from; j < 4; j += 1) n[j] = n[j + 1];
        n[4] = null;
        return n;
      });
    };

    if (file && prevUrl) {
      setPrimaryImageFile(file);
      setImagePreview(prevUrl);
      setImageFileName(file.name);
      setHideSavedPrimaryImage(false);
      setExistingPrimaryImageId(null);
      setCloneSourcePrimaryImageId(null);
      shiftAdditionalLeftFrom(i);
    } else if (exAdd && prevUrl) {
      setPrimaryImageFile(null);
      setImagePreview(prevUrl);
      setImageFileName('');
      setExistingPrimaryImageId(exAdd);
      setCloneSourcePrimaryImageId(null);
      setHideSavedPrimaryImage(false);
      shiftAdditionalLeftFrom(i);
    } else if (clAdd && prevUrl) {
      setPrimaryImageFile(null);
      setImagePreview(prevUrl);
      setImageFileName('');
      setExistingPrimaryImageId(null);
      setCloneSourcePrimaryImageId(clAdd);
      setHideSavedPrimaryImage(false);
      shiftAdditionalLeftFrom(i);
    }

    addToast('Primary image updated from your additional image.', 'success');
  };

  const handleAdditionalImageSelect = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      addToast('Accepts only valid formats: PNG, JPEG, JPG.', 'error');
      event.target.value = '';
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      addToast('Image must be 2MB or smaller.', 'error');
      event.target.value = '';
      return;
    }
    setAdditionalImageFiles((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAdditionalImagePreviews((prev) => {
        const next = [...prev];
        const current = next[index];
        if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
        next[index] = dataUrl;
        additionalImagePreviewsRef.current = next.filter((u): u is string => Boolean(u));
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAdditionalImage = (index: number) => {
    setAdditionalImageFiles((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setAdditionalImagePreviews((prev) => {
      const next = [...prev];
      const current = next[index];
      if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
      next[index] = null;
      additionalImagePreviewsRef.current = next.filter((u): u is string => Boolean(u));
      return next;
    });
  };

  const applyItemToForm = (src: MenuItem, isClone: boolean) => {
    const ext = src as unknown as Record<string, unknown>;
    const kitchenDetails =
      ext.kitchenDetails && typeof ext.kitchenDetails === 'object'
        ? (ext.kitchenDetails as Record<string, unknown>)
        : null;
    const printInMasterKOTValue =
      (typeof kitchenDetails?.printInMasterKOT === 'boolean'
        ? kitchenDetails.printInMasterKOT
        : src.printInMasterKOT) !== false;
      const cp: Partial<Record<OrderType, number | ''>> = {};
    allOrderTypes.forEach((ot) => {
      cp[ot] = src.channelPrices[ot] ?? '';
    });
    const orderVisibility = allOrderTypes.reduce(
      (acc, ot) => {
        acc[ot] = src.visibilityPerOrderType?.[ot] === true;
        return acc;
      },
      {} as Record<OrderType, boolean>,
    );
    const branchOt = getOrderTypesForBranch(selectedBranch as Record<string, unknown> | null | undefined);
    const orderVisibilityByOutletId: Record<string, boolean> = {};
        // const cp: Partial<Record<string, number | ''>> = {};
    branchOt.forEach((ot) => {
      const oid = String(ot.id ?? '').trim();
      if (!oid) return;
      const perOutlet = src.channelsByOrderTypeId?.[oid];
      if (perOutlet !== undefined) {
        orderVisibilityByOutletId[oid] = perOutlet.enabled !== false;
        return;
      }
      const k = mapOutletOrderTypeToKey(ot as OutletOrderType);
      if (!k) return;
      // No per-outlet data from API: fall back to OrderType-grouped value, which already
      // defaults to false when the API didn't return a channel row for this order type.
      orderVisibilityByOutletId[oid] = orderVisibility[k] === true;
    });
    // Populate per-outlet channel prices — keyed by outlet orderTypeId so
    // Doordash/Grubhub/Ubereats each carry an independent price.

    if (branchOt.length > 0) {
      branchOt.forEach((ot) => {
        const oid = String(ot.id ?? '').trim();
        if (!oid) return;
        const perOutlet = src.channelsByOrderTypeId?.[oid];
        const k = mapOutletOrderTypeToKey(ot as OutletOrderType);
        if (perOutlet?.price !== undefined && Number.isFinite(perOutlet.price)) {
          cp[oid] = perOutlet.price;
        } else if (k !== null) {
          const collapsed = src.channelPrices[k];
          cp[oid] = collapsed !== undefined ? collapsed : '';
        } else {
          cp[oid] = '';
        }
      });
    } else {
      allOrderTypes.forEach((ot) => {
        cp[ot] = src.channelPrices[ot] ?? '';
      });
    }
    const base = src.basePrice;
    const useSame = branchOt.length > 0
      ? branchOt.every((ot) => {
          const oid = String(ot.id ?? '').trim();
          const v = cp[oid];
          return v === undefined || v === '' || Number(v) === base;
        })
      : allOrderTypes.filter((ot) => orderVisibility[ot] !== false).every((ot) => {
          const v = src.channelPrices[ot];
          return v === undefined || Number(v) === base;
        });
    const vars = src.variations?.length
      ? src.variations.map((v) => ({ ...v }))
      : [];
    setCategorySortSnapshot(new Set(src.categoryIds));
    additionalImagePreviewsRef.current.forEach((url) => {
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
    const sortedMedia = [...(src.mediaResponseList ?? [])].sort(
      (a, b) => Number(a.sortOrder) - Number(b.sortOrder),
    );
    const primaryMedia = sortedMedia[0] ?? null;
    const additionalMedia = sortedMedia.slice(1, 6);
    setPrimaryImageFile(null);
    setAdditionalImageFiles(Array.from({ length: 5 }, () => null));
    const existingAdditional = additionalMedia
      .map((m) => resolveItemMediaPreviewUrl(m))
      .filter((u): u is string => Boolean(u));
    const nextAdditionalPreviews = Array.from({ length: 5 }, (_, i) => existingAdditional[i] ?? null);
    const nextAdditionalIds = Array.from({ length: 5 }, (_, i) => additionalMedia[i]?.id ?? null);
    setAdditionalImagePreviews(nextAdditionalPreviews);
    setCloneSourceAdditionalImageIds(isClone ? nextAdditionalIds : Array.from({ length: 5 }, () => null));
    setExistingAdditionalImageIds(isClone ? Array.from({ length: 5 }, () => null) : nextAdditionalIds);
    setCloneSourcePrimaryImageId(isClone ? (primaryMedia?.id ?? null) : null);
    setExistingPrimaryImageId(isClone ? null : (primaryMedia?.id ?? null));
    setHideSavedPrimaryImage(false);
    const bestPairedIds = Array.isArray(src.bestPairedItems)
      ? src.bestPairedItems.map((bp) => bp.itemId).filter(Boolean)
      : [];
    initialBestPairedItemIdsRef.current = [...bestPairedIds];
    initialAllergenIdsRef.current = src.allergens.map((a) => a.id);
    initialDietaryIdsRef.current = src.dietaryLabels.map((d) => d.id);
    initialIngredientIdsRef.current = (src.ingredients ?? []).map((i) => i.id);
    initialTagIdsRef.current = src.tags.map((t) => t.id);
    initialCategoryIdsRef.current = [...(src.categoryIds ?? [])];
    initialModifierIdsRef.current = [...(src.modifierIds ?? [])];
    initialBulkPriceIdsRef.current = (src.cateringPricingTiers ?? [])
      .map((t) => t.id)
      .filter((bpId): bpId is string => Boolean(bpId));
    initialSessionIdsRef.current = [...(src.sessionIds ?? [])];
    initialSessionSlotIdsByGroupRef.current = { ...(src.sessionSlotIdsBySessionGroupId ?? {}) };
    const rawKitchenList =
      Array.isArray(src.kitchenStationIds) && src.kitchenStationIds.length > 0
        ? src.kitchenStationIds
        : src.kitchenStationId
          ? [src.kitchenStationId]
          : [];
    const fullKitchenIds = dedupeKitchenIds(rawKitchenList);
    initialKitchenStationIdsRef.current = [...fullKitchenIds];
    const initialTaxList: string[] = (() => {
      const arr = (src as any).taxIds;
      if (Array.isArray(arr) && arr.length) {
        return Array.from(new Set(arr.map((s: unknown) => String(s).trim()).filter(Boolean)));
      }
      const single = (src.taxGroup ?? (src as any).taxId ?? '').toString().trim();
      return single ? [single] : [];
    })();
    initialTaxIdsRef.current = isClone ? [] : [...initialTaxList];
      setForm({
      name: isClone ? '' : src.name,
      itemCode: isClone ? '' : src.itemCode,
      exclusiveItem: false, // edit mode will auto-sync from exclusive items list
      itemType: src.itemType ?? 'prepared_food_beverage',
      description: src.description,
      basePrice: src.basePrice,
      costPrice: src.costPrice ?? '',
        channelPrices: cp,
      useSamePriceAllChannels: useSame,
      pricingStrategy: src.pricingStrategy ?? 'standard',
      menuPriceOverrides: [],
      status: isClone ? 'draft' : src.status,
      categoryIds: [...src.categoryIds],
      kitchenStationSelectedIds: [...fullKitchenIds],
      kitchenName: src.kitchenName ?? '',
      prepTime: src.prepTime || 15,
      revenueClass: src.revenueClass?.name ?? '',
      revenueClassId: src.revenueClass?.id ?? '',
      bestPairedItemIds: [...bestPairedIds],
      soldBy: (() => {
        const unitType = String(src.unit?.type ?? '').replace(/[\s_]/g, '').toUpperCase();
        if (unitType.includes('PERITEM')) return 'each' as const;
        if (src.unit?.unitId) return 'weight' as const;
        return 'each';
      })(),
      unitOfMeasure: src.unit?.type ?? 'Each',
      unitId: src.unit?.unitId ?? '',
      pricePerQty: (src as any).pricePerQty ?? 1,
      stockUnit: (src as any).stockUnit ?? '',
      stockConversionRate: (src as any).stockConversionRate ?? '',
      specialInstructions: (() => {
        const raw =
          src.specialInstructions
          ?? ext.specialInstruction
          ?? ext.special_instructions;
        return raw != null && raw !== ''
          ? String(raw).trim().slice(0, SPECIAL_INSTRUCTIONS_MAX)
          : '';
      })(),
      masterKot: printInMasterKOTValue,
      masterKotMode: printInMasterKOTValue ? 'all' : 'none',
      masterKotOrderTypes: src.masterKotOrderTypes ?? [],
      kitchenPrintMode: (src.kotExcludedOrderTypeIds ?? []).length > 0 ? 'selected' : 'all',
      kitchenPrintExcludedOrderTypeIds: src.kotExcludedOrderTypeIds ?? [],
      isAgeRestricted: src.isAgeRestricted ?? false,
      minAge: src.minAge ?? 18,
      restrictionReasons: src.restrictionReasons ?? [],
      inventoryEnabled: src.inventoryTracking?.enabled ?? false,
      inventoryTrackingMode: src.inventoryTracking?.trackingMode ?? 'count',
      inventoryStockResetMode: (() => {
        const raw = src.inventoryTracking?.stockResetMode;
        if (raw === 'auto_reset' || raw === 'clear_stocks' || raw === 'carry_forward') return raw;
        return 'auto_reset'; // legacy null / unset → first option (auto_reset)
      })(),
      currentStock: src.inventoryTracking?.currentStock != null ? String(src.inventoryTracking.currentStock) : '',
      lowStockThreshold: src.inventoryTracking?.lowStockThreshold != null ? String(src.inventoryTracking.lowStockThreshold) : '',
      defaultStockQuantity: src.inventoryTracking?.defaultStockQuantity != null ? String(src.inventoryTracking.defaultStockQuantity) : '',
      unitType: src.inventoryTracking?.unitType ?? 'Each',
      orderVisibility,
      orderVisibilityByOutletId,
      isTableSide: src.isTableSide == null ? true : Boolean(src.isTableSide),
      isOrderStation: src.isOrderStation == null ? true : Boolean(src.isOrderStation),
      isMenuStation: src.isMenuStation == null ? true : Boolean(src.isMenuStation),
      isCdMenu: src.isCdMenu == null ? true : Boolean(src.isCdMenu),
      allergens: [...src.allergens],
      dietaryLabels: [...src.dietaryLabels],
      tags: src.tags.length > 0 ? [src.tags[0]] : [],
      ingredients: [...(src.ingredients ?? [])],
      nutrition: src.nutrition ? { ...src.nutrition } : {},
      hasVariations: vars.length > 0,
      variations: vars,
      modifierIds: [...(src.modifierIds ?? [])],
      sessionIds: [...(src.sessionIds ?? [])],
      useDefaultSession: !(src.sessionIds && src.sessionIds.length > 0),
      containsAlcohol: src.containsAlcohol ?? false,
      taxIds: [...initialTaxList],
      isFreeEvent: src.eventIsFree ?? false,
      registrationLabel: src.eventRegistrationLabel ?? 'Register',
      isSeasonal: !!(src.seasonalDateRange?.from || src.seasonalDateRange?.to),
      seasonStart: src.seasonalDateRange?.from ?? '',
      seasonEnd: src.seasonalDateRange?.to ?? '',
      cateringEnabled: src.cateringEnabled ?? false,
      cateringServesCount: src.cateringServesCount ?? 1,
      // Clone: tray rows get new ids on save, so drop the source item's bulk-price ids.
      cateringPricingTiers: src.cateringPricingTiers
        ? src.cateringPricingTiers.map((t) => (isClone ? { ...t, id: undefined } : { ...t }))
        : [],
      cateringMinOrderQty: src.cateringMinOrderQty ?? '',
      cateringMaxOrderQty: src.cateringMaxOrderQty ?? '',
      cateringTaxRateId: src.cateringTaxRateId ?? '',
    });
  };

  useEffect(() => {
    if (isEdit) {
      if (!existing || !id) return;
      const key = `edit:${id}`;
      if (hydrateKeyRef.current === key) return;
      hydrateKeyRef.current = key;
      applyItemToForm(existing, false);
      return;
    }
    if (cloneId) {
      if (cloneSource) {
        const key = `clone:${cloneId}`;
        if (hydrateKeyRef.current === key) return;
        hydrateKeyRef.current = key;
        applyItemToForm(cloneSource, true);
        return;
      }
      if (hydrateKeyRef.current !== 'new') {
        hydrateKeyRef.current = 'new';
        initialBestPairedItemIdsRef.current = [];
        initialAllergenIdsRef.current = [];
        initialDietaryIdsRef.current = [];
        initialIngredientIdsRef.current = [];
        initialTagIdsRef.current = [];
        initialCategoryIdsRef.current = [];
        initialModifierIdsRef.current = [];
        initialBulkPriceIdsRef.current = [];
        initialSessionIdsRef.current = [];
        initialSessionSlotIdsByGroupRef.current = {};
        initialKitchenStationIdsRef.current = [];
        initialTaxIdsRef.current = [];
        setCategorySortSnapshot(new Set());
        setPrimaryImageFile(null);
        setAdditionalImageFiles(Array.from({ length: 5 }, () => null));
        setHideSavedPrimaryImage(false);
        setCloneSourcePrimaryImageId(null);
        setCloneSourceAdditionalImageIds(Array.from({ length: 5 }, () => null));
        setForm(emptyForm);
      }
      return;
    }
    if (hydrateKeyRef.current !== 'new') {
      hydrateKeyRef.current = 'new';
      initialBestPairedItemIdsRef.current = [];
      initialAllergenIdsRef.current = [];
      initialDietaryIdsRef.current = [];
      initialIngredientIdsRef.current = [];
      initialTagIdsRef.current = [];
      initialCategoryIdsRef.current = [];
      initialModifierIdsRef.current = [];
      initialBulkPriceIdsRef.current = [];
      initialSessionIdsRef.current = [];
      initialSessionSlotIdsByGroupRef.current = {};
      initialKitchenStationIdsRef.current = [];
      setCategorySortSnapshot(new Set());
      setPrimaryImageFile(null);
      setAdditionalImageFiles(Array.from({ length: 5 }, () => null));
      setHideSavedPrimaryImage(false);
      setCloneSourcePrimaryImageId(null);
      setCloneSourceAdditionalImageIds(Array.from({ length: 5 }, () => null));
      setForm(emptyForm);
    }
  }, [isEdit, id, existing, cloneId, cloneSource]);

  // Capture initial snapshot for dirty-check after first form population
  useEffect(() => {
    if (form.name || form.basePrice || !isEdit) {
      const timeout = setTimeout(() => {
        if (!initialFormSnapshot) setInitialFormSnapshot(JSON.stringify(form));
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [form, isEdit, initialFormSnapshot]);

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
      additionalImagePreviewsRef.current.forEach((url) => {
        if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    };
  }, [imagePreview]);

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  useBarcodeScanner({
    onScan: (raw) => {
      const sanitized = raw.replace(/[^A-Za-z0-9]/g, '').slice(0, ITEM_CODE_MAX);
      if (!sanitized) return;
      patch('itemCode', sanitized);
      itemCodeInputRef.current?.focus();
      // Inline duplicate check (helpers below this hook would be a
      // forward-reference). If the scanned code already belongs to
      // another item, surface the rephrased message via toast + inline
      // error instead of a generic "Scanned" success toast.
      const target = sanitized.trim().toLowerCase();
      const currentId = isEdit ? (existing?.id ?? null) : null;
      const dup = items.find(
        (it) =>
          (it?.itemCode || '').trim().toLowerCase() === target &&
          (!currentId || it.id !== currentId),
      );
      if (dup) {
        const dupName = (dup.name || '').trim() || 'another item';
        const msg = `This barcode is already linked to ${dupName}. Please use a unique code.`;
        setErrors((prev) => ({ ...prev, itemCode: msg }));
        addToast(msg, 'error');
        return;
      }
      addToast(`Scanned: ${sanitized}`, 'success');
    },
    passthroughRef: itemCodeInputRef,
  });

  const bestPairedPickerItems = useMemo(
    () =>
      items
        .filter((it) => (id ? it.id !== id : true))
        .map((it) => ({
          id: it.id,
          name: it.name,
          categoryIds: it.categoryIds,
          categorySortPositions: it.categorySortPositions,
          trailing: `$${it.basePrice.toFixed(2)}`,
        })),
    [items, id],
  );

  const bestPairedItemsForPills = useMemo(
    () =>
      form.bestPairedItemIds.map((iid) => {
        const it = items.find((i) => i.id === iid);
        return it ? { id: it.id, name: it.name } : { id: iid, name: 'Item' };
      }),
    [form.bestPairedItemIds, items],
  );

  const toggleBestPairedItem = useCallback((itemId: string) => {
    setForm((prev) => {
      const has = prev.bestPairedItemIds.includes(itemId);
      if (!has && prev.bestPairedItemIds.length >= BEST_PAIRED_MAX) {
        setErrors((e) => ({
          ...e,
          bestPaired: `You can add at most ${BEST_PAIRED_MAX} best paired items.`,
        }));
        return prev;
      }
      setErrors((e) => {
        const n = { ...e };
        delete n.bestPaired;
        return n;
      });
      return {
        ...prev,
        bestPairedItemIds: has
          ? prev.bestPairedItemIds.filter((x) => x !== itemId)
          : [...prev.bestPairedItemIds, itemId],
      };
    });
  }, []);

  const removeBestPairedItem = useCallback((itemId: string) => {
    setForm((prev) => ({
      ...prev,
      bestPairedItemIds: prev.bestPairedItemIds.filter((x) => x !== itemId),
    }));
    setErrors((e) => {
      const n = { ...e };
      delete n.bestPaired;
      return n;
    });
  }, []);

  // Auto-set PER ITEM unit when soldBy is 'each' and units have loaded
  useEffect(() => {
    if (unitOptions.length === 0) return;
    setForm((prev) => {
      if (prev.soldBy !== 'each' || prev.unitId) return prev;
      const perItem = unitOptions.find((u) =>
        u.name.replace(/[\s_]/g, '').toUpperCase().includes('PERITEM') ||
        u.name.toUpperCase() === 'PER ITEM' ||
        u.name.toUpperCase() === 'PER_ITEM',
      );
      if (!perItem) return prev;
      return { ...prev, unitId: perItem.id, unitOfMeasure: perItem.name };
    });
  }, [unitOptions]);

  const setChannelPrice = (type: string, value: number | '') => {
    setForm((prev) => ({ ...prev, channelPrices: { ...prev.channelPrices, [type]: value } }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.channelPrices;
      return next;
    });
  };

  const MAX_MODIFIERS = 30;

  const toggleModifier = useCallback((modifierId: string) => {
    setForm((prev) => {
      const selected = prev.modifierIds.includes(modifierId);
      if (!selected && prev.modifierIds.length >= MAX_MODIFIERS) return prev;
      return {
        ...prev,
        modifierIds: selected
          ? prev.modifierIds.filter((x) => x !== modifierId)
          : [...prev.modifierIds, modifierId],
      };
    });
  }, []);

  const toggleSession = useCallback((sessionId: string) => {
    setForm((prev) => {
      const selected = prev.sessionIds.includes(sessionId);
      return {
        ...prev,
        sessionIds: selected
          ? prev.sessionIds.filter((x) => x !== sessionId)
          : [...prev.sessionIds, sessionId],
      };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.sessionIds;
      return next;
    });
  }, []);

  const applyTemplate = (t: ItemTemplate) => {
    const stationId = matchStationId(t.station, stations);
    setForm((prev) => ({
      ...prev,
      itemType: t.type,
      allergens: (t.allergens ?? []).map((name) => {
        const match = apiAllergens.find((a) => a.name.toLowerCase() === name.toLowerCase());
        return match ?? { id: name, name };
      }),
      dietaryLabels: (t.dietary ?? []).map((name) => {
        const match = apiDietary.find((d) => d.name.toLowerCase() === name.toLowerCase());
        return match ?? { id: name, name };
      }),
      prepTime: t.prep !== undefined ? t.prep : prev.prepTime,
      kitchenStationSelectedIds: stationId ? dedupeKitchenIds([stationId]) : prev.kitchenStationSelectedIds,
      containsAlcohol: Boolean(t.alcohol) || prev.containsAlcohol,
    }));
    setShowTemplates(false);
  };


  const validate = (): boolean => {
    let valid = true;
    let firstErrorFieldId: string | null = null;
    setErrors((prev) => {
      const errs = computeItemFormErrors(form, pricingOrderTypeRows, prev.itemCode, isEdit);
      const parentCategorySelectionError = getParentCategoryChildSelectionError(
        form.categoryIds,
        expandedParentCategoryIds,
        categories,
      );
      if (parentCategorySelectionError) errs.category = parentCategorySelectionError;
      valid = Object.keys(errs).length === 0;
      if (!valid) {
        const fieldOrder: Array<[string, string]> = [
          ['item-field-name', 'name'],
          ['categories', 'category'],
          ['item-field-basePrice', 'basePrice'],
          ['item-field-unit', 'unit'],
          ['item-field-itemCode', 'itemCode'],
          ['item-field-kitchen', 'kitchenStation'],
          ['item-field-kitchen-print', 'kitchenPrintOrderTypes'],
          ['item-field-sessions', 'sessionIds'],
          ['item-field-seasonStart', 'seasonStart'],
          ['item-field-seasonEnd', 'seasonEnd'],
          ['item-field-channel-prices', 'channelPrices'],
          ['item-field-best-paired', 'bestPaired'],
        ];
        firstErrorFieldId = fieldOrder.find(([, key]) => errs[key])?.[0] ?? null;
      }
      return { ...errs, ...(prev.imageUrl ? { imageUrl: prev.imageUrl } : {}) };
    });
    if (!valid && firstErrorFieldId) {
      const id = firstErrorFieldId;
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
    return valid;
  };
  const isFreeEvent = form.itemType === 'event' && form.isFreeEvent;
  const parentCategorySelectionError = useMemo(
    () => getParentCategoryChildSelectionError(form.categoryIds, expandedParentCategoryIds, categories),
    [form.categoryIds, expandedParentCategoryIds, categories],
  );

  /** Live field messages (same rules as save) so users see issues before clicking Save. */
  const validationErrors: Record<string, string> = useMemo(
    () => {
      const errs = computeItemFormErrors(form, pricingOrderTypeRows, errors.itemCode, isEdit);
      if (parentCategorySelectionError) errs.category = parentCategorySelectionError;
      return errs;
    },
    [form, activeOrderTypes, errors.itemCode, parentCategorySelectionError, isEdit],
  );
  const canSave = useMemo(() => Object.keys(validationErrors).length === 0, [validationErrors]);
  const displayErrors: Record<string, string> = useMemo(
    () => ({ ...validationErrors, ...(errors.imageUrl ? { imageUrl: errors.imageUrl } : {}) }),
    [validationErrors, errors.imageUrl],
  );

  const getChannelPctDiff = (orderTypeId: string): number | null => {
    const base = Number(form.basePrice);
    const ch = form.channelPrices[orderTypeId];
    if (ch === '' || ch === undefined || Number.isNaN(Number(ch))) return null;
    const c = Number(ch);
    if (Number.isNaN(base) || base === 0) return null;
    return ((c - base) / base) * 100;
  };

  /**
   * Look up the local items list for an item that already owns `code`,
   * excluding the item we're currently editing. Used so we can show a
   * specific message ("This barcode is already linked to <name>...")
   * instead of the generic backend error.
   */
  const findLocalDuplicateItemByCode = useCallback(
    (code: string): { id: string; name: string } | null => {
      const target = code.trim().toLowerCase();
      if (!target) return null;
      const currentId = isEdit ? (existing?.id ?? null) : null;
      for (const it of items) {
        if (!it?.itemCode) continue;
        if ((it.itemCode || '').trim().toLowerCase() !== target) continue;
        if (currentId && it.id === currentId) continue;
        return { id: it.id, name: (it.name || '').trim() || 'another item' };
      }
      return null;
    },
    [items, isEdit, existing],
  );

  const buildDuplicateCodeMessage = useCallback(
    (code: string): string => {
      const dup = findLocalDuplicateItemByCode(code);
      return dup
        ? `This barcode is already linked to ${dup.name}. Please use a unique code.`
        : 'This barcode is already linked to another item. Please use a unique code.';
    },
    [findLocalDuplicateItemByCode],
  );

  const handleItemCodeBlur = useCallback(async () => {
    const code = form.itemCode.trim();
    if (!code) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.itemCode;
        return next;
      });
      return;
    }
    if (!isValidItemCode(code)) {
      setErrors((prev) => ({
        ...prev,
        itemCode: `Item code must be letters and numbers only (up to ${ITEM_CODE_MAX} characters)`,
      }));
      return;
    }
    if (isEdit && existing && code === (existing.itemCode || '').trim()) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.itemCode;
        return next;
      });
      return;
    }
    // Validate against the locally cached items list first so we can
    // produce a specific "already linked to <name>" message. The server
    // call below stays as a fallback for items not yet in the local cache.
    const localDup = findLocalDuplicateItemByCode(code);
    if (localDup) {
      const msg = `This barcode is already linked to ${localDup.name}. Please use a unique code.`;
      setErrors((prev) => ({ ...prev, itemCode: msg }));
      addToast(msg, 'error');
      return;
    }
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId || !token) return;
    try {
      await validateItemCodeOnServer(locationId, code, token);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.itemCode;
        return next;
      });
    } catch (e) {
      // Server says the code is taken — rephrase using the local lookup
      // (or the generic fallback if we can't find the owner).
      const msg = buildDuplicateCodeMessage(code);
      setErrors((prev) => ({ ...prev, itemCode: msg }));
      addToast(msg, 'error');
    }
  }, [
    form.itemCode,
    selectedBranch?.id,
    selectedBranch?.locationId,
    auth?.accessToken,
    auth?.access_token,
    isEdit,
    existing,
    findLocalDuplicateItemByCode,
    buildDuplicateCodeMessage,
    addToast,
  ]);

  const normalizeInventoryDecimalInput = useCallback((raw: string, allowDecimal: boolean): string => {
    if (!allowDecimal) return raw.replace(/[^0-9]/g, '');
    let result = raw.replace(/[^0-9.]/g, '');
    const parts = result.split('.');
    if (parts.length > 2) result = parts[0] + '.' + parts.slice(1).join('');
    if (parts.length === 2 && parts[1].length > 3) result = parts[0] + '.' + parts[1].slice(0, 3);
    return result;
  }, []);

  const handleSave = async () => {
    if (!validate()) return;
    const hasPastSeasonEndDate = (): boolean => {
      if (!form.isSeasonal || !form.seasonEnd) return false;
      return form.seasonEnd < toIsoLocalDate(new Date());
    };

    const computeZeroPriceModalDetail = (): { mode: 'base' | 'channels'; channelLabels: string[] } => {
      if (form.itemType === 'event' && form.isFreeEvent) return { mode: 'base', channelLabels: [] };
      if (form.basePrice === '' || form.basePrice === null) return { mode: 'base', channelLabels: [] };
      const base = Number(form.basePrice);
      if (!Number.isFinite(base)) return { mode: 'base', channelLabels: [] };
      if (base === 0) return { mode: 'base', channelLabels: [] };
      if (!form.useSamePriceAllChannels) {
        const labels: string[] = [];
        for (const row of pricingOrderTypeRows) {
          if (form.orderVisibilityByOutletId[row.orderTypeId] === false) continue;
          const v = form.channelPrices[row.orderTypeId];
          if (v === '' || v === undefined) continue;
          if (Number(v) === 0) labels.push(row.label);
        }
        if (labels.length > 0) return { mode: 'channels', channelLabels: labels };
      }
      return { mode: 'base', channelLabels: [] };
    };

    const needsZeroPriceConfirmation = (): boolean => {
      if (form.itemType === 'event' && form.isFreeEvent) return false;
      if (form.basePrice === '' || form.basePrice === null) return false;
      const base = Number(form.basePrice);
      if (!Number.isFinite(base)) return false;
      if (base === 0) return true;
      if (!form.useSamePriceAllChannels) {
        return pricingOrderTypeRows.some((row) => {
          if (form.orderVisibilityByOutletId[row.orderTypeId] === false) return false;
          const v = form.channelPrices[row.orderTypeId];
          if (v === '' || v === undefined) return false;
          return Number(v) === 0;
        });
      }
      return false;
    };

    if (!skipPastSeasonEndCheckRef.current && hasPastSeasonEndDate()) {
      setShowPastSeasonEndModal(true);
      return;
    }

    if (!skipZeroPriceCheckRef.current && needsZeroPriceConfirmation()) {
      setZeroPriceModalDetail(computeZeroPriceModalDetail());
      setShowZeroPriceModal(true);
      return;
    }
    skipZeroPriceCheckRef.current = false;

    setSaving(true);

    try {
      const free = form.itemType === 'event' && form.isFreeEvent;
      const baseNum = free ? 0 : Number(form.basePrice);
      const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
      const token = auth?.accessToken ?? auth?.access_token ?? null;

      if (!locationId) {
        addToast('Select a location before saving', 'error');
        setSaving(false);
        return;
      }

      const itemCodeFinal = form.itemCode.trim();
      const branchListForSave = getOrderTypesForBranch(
        selectedBranch as Record<string, unknown> | null | undefined,
      );
      // Build price lookup directly from pricingOrderTypeRows — these are the exact
      // rows the user sees and types into, so this guarantees UI ↔ payload consistency.
      const uiPriceByOutletId: Record<string, number> = {};
      pricingOrderTypeRows.forEach((row) => {
        if (form.useSamePriceAllChannels) {
          uiPriceByOutletId[row.orderTypeId] = baseNum;
        } else {
          const v = form.channelPrices[row.orderTypeId];
          const n = v !== '' && v !== undefined ? Number(v) : NaN;
          uiPriceByOutletId[row.orderTypeId] = Number.isFinite(n) ? n : baseNum;
        }
      });
      const channelPayload =
        branchListForSave.length > 0
          ? branchListForSave
              .map((ot) => {
                const oid = String(ot.id ?? '').trim();
                if (!oid) return null;
                const on = form.orderVisibilityByOutletId[oid] !== false;
                const price = uiPriceByOutletId[oid] ?? baseNum;
                return { orderTypeId: oid, price, enabled: on, availabilityEnabled: on };
              })
              .filter((x): x is NonNullable<typeof x> => x !== null)
          : activeOrderTypes.map((ot) => ({
              orderTypeId: orderTypeIdByKey[ot] ?? ot,
              price: form.useSamePriceAllChannels ? baseNum : (Number(form.channelPrices[ot]) || baseNum),
              enabled: form.orderVisibility[ot] ?? true,
              availabilityEnabled: form.orderVisibility[ot] ?? true,
            }));
      // Order-type-wise Master KOT payload is deprecated.
      // const isKotForChannel = (ot: OrderType): boolean => {
      //   if (form.masterKotMode === 'none') return false;
      //   if (form.masterKotMode === 'all') return true;
      //   return form.masterKotOrderTypes.includes(ot);
      // };
      // const kotordertype = activeOrderTypes.map((ot) => ({
      //   orderTypeId: orderTypeIdByKey[ot] ?? ot,
      //   isKot: isKotForChannel(ot),
      // }));
      // const printInMasterKotFromChannels = kotordertype.some((r) => r.isKot);
      const orderTypeAvailability =
        branchListForSave.length > 0
          ? branchListForSave
              .map((ot) => {
                const oid = String(ot.id ?? '').trim();
                if (!oid) return null;
                const on = form.orderVisibilityByOutletId[oid] !== false;
                return { orderTypeId: oid, isEnable: on };
              })
              .filter((x): x is NonNullable<typeof x> => x !== null)
          : activeOrderTypes.map((ot) => ({
              orderTypeId: orderTypeIdByKey[ot] ?? ot,
              isEnable: form.orderVisibility[ot] ?? true,
            }));
      const variantsPayload = form.hasVariations
        ? form.variations
            .map((v) => {
              const name = v.name.trim();
              if (!name) return null;
              const variationPrice = Number.isFinite(Number(v.price))
                ? Number(v.price)
                : Number(baseNum);
              const channelRows =
                branchListForSave.length > 0
                  ? branchListForSave
                      .map((ot) => {
                        const oid = String(ot.id ?? '').trim();
                        if (!oid) return null;
                        return { orderTypeId: oid, price: variationPrice };
                      })
                      .filter((x): x is NonNullable<typeof x> => x !== null)
                  : activeOrderTypes.map((ot) => ({
                      orderTypeId: orderTypeIdByKey[ot] ?? ot,
                      price: variationPrice,
                    }));
              const out: Record<string, unknown> = {
                name,
                isEnabled: true,
                channels: channelRows,
              };
              // In update mode backend accepts `variationId` / `id` alias.
              if (isEdit && !String(v.id).startsWith('var-')) {
                out.variationId = v.id;
              }
              return out;
            })
            .filter((x): x is NonNullable<typeof x> => x !== null)
        : [];

      const parseInventoryNumber = (raw: string): number | null => {
        if (raw.trim() === '') return null;
        const n = Number(raw);
        if (!Number.isFinite(n)) return null;
        return Math.max(0, n);
      };
      const inventoryPayload: Record<string, unknown> | undefined = {
        is_inventory_tracking: form.inventoryEnabled,
        currentStock: parseInventoryNumber(form.currentStock),
        lowStockAlert: parseInventoryNumber(form.lowStockThreshold),
        defaultStockQuantity: parseInventoryNumber(form.defaultStockQuantity),
        stockResetMode: form.inventoryStockResetMode,
      };
      const basePayload: Record<string, unknown> = {
        locationId,
        name: form.name.trim(),
        itemType: feItemTypeToBackendCode(form.itemType),
        itemCreationStatus: itemCreationStatusApiFromFeStatus(form.status),
        description: form.description.trim(),
        pluCode: itemCodeFinal,
        // Backend expects this boolean even when false.
        exclusiveItem: form.exclusiveItem,
        isTableSide: form.isTableSide ? 1 : 0,
        isOrderStation: form.isOrderStation ? 1 : 0,
        isMenuStation: form.isMenuStation ? 1 : 0,
        isCdMenu: form.isCdMenu ? 1 : 0,
        categoryIds: form.categoryIds,
        pricing: {
          basePrice: baseNum,
          costPrice: form.costPrice === '' ? undefined : Number(form.costPrice),
          channels: channelPayload,
        },
        // kotordertype,
        // Order types this item should NOT print to the kitchen for. Always sent in full —
        // update replaces the saved list wholesale, there's no deleteFields for this field.
        kotExcludedOrderTypeIds:
          form.kitchenPrintMode === 'selected'
            ? form.kitchenPrintExcludedOrderTypeIds.filter((id) => kitchenPrintRows.some((row) => row.orderTypeId === id))
            : [],
        kitchenName: form.kitchenName.trim() || form.name.trim(),
        kitchenIds: dedupeKitchenIds(form.kitchenStationSelectedIds),
        preparationTimeInMins: String(Number(form.prepTime) || 0),
        printInMasterKOT: form.masterKot,
        containsAlcohol: form.containsAlcohol,
        isAgeRestricted: form.isAgeRestricted,
        minimumAge: form.isAgeRestricted ? form.minAge : undefined,
        orderTypeAvailability,
        availability: {
          seasonalDateRange: form.isSeasonal
            ? { from: form.seasonStart, to: form.seasonEnd }
            : { from: null, to: null },
          timeBasedAvailability:
            !form.useDefaultSession && form.sessionIds.length > 0
              ? form.sessionIds.map((sid) => {
                  const sess = sessions.find((s) => s.id === sid);
                  return {
                    name: sess?.name ?? '',
                    sessionGroupId: sid,
                    sessionSlot: sess?.slots?.map((slot) => slot.id) ?? [],
                  };
                })
              : [],
        },
        taxIds: form.taxIds.length > 0 ? form.taxIds : undefined,
        specialInstructions: form.specialInstructions.trim(),
        revenueClassId: form.revenueClassId || undefined,
        unit: form.unitId ? { unitId: form.unitId, type: form.unitOfMeasure } : undefined,
        modifiers: form.modifierIds.map((modifierId, idx) => ({ modifierId, sortOrder: String(idx + 1) })),
        tags: form.tags.map((t) => t.id),
        allergens: form.allergens.map((a) => a.id),
        dietaryLabels: form.dietaryLabels.map((d) => d.id),
        ingredients: form.ingredients.map((i) => i.id),
        bestPairedItems: form.bestPairedItemIds.map((itemId, idx) => ({ itemId, sortOrder: idx + 1 })),
        nutrition: {
          basis: form.nutrition.basis ?? null,
          calories: form.nutrition.calories != null ? String(form.nutrition.calories) : null,
          protein: form.nutrition.protein != null ? String(form.nutrition.protein) : null,
          carbs: form.nutrition.carbs != null ? String(form.nutrition.carbs) : null,
          fat: form.nutrition.fat != null ? String(form.nutrition.fat) : null,
        },
        // Catering DTO — persisted by the item create/update API into mhc_items + mhc_item_bulkprice.
        // `enabled: false` tells the backend to remove any existing catering row + its bulk-price children.
        catering: form.cateringEnabled
          ? {
              enabled: true,
              isCustomItem: false,
              serveCount: form.cateringServesCount === '' ? 1 : Number(form.cateringServesCount),
              minQtyRequired: form.cateringMinOrderQty === '' ? 1 : Number(form.cateringMinOrderQty),
              maxQtyRequired: form.cateringMaxOrderQty === '' ? null : Number(form.cateringMaxOrderQty),
              notes: null,
              bulkPrices: form.cateringPricingTiers
                .filter((t) => t.price !== undefined && !isNaN(Number(t.price)))
                .map((t) => ({
                  ...(t.id ? { id: t.id } : {}),
                  unitLabel: t.label?.trim() || undefined,
                  unitPrice: Number(t.price),
                  serveCount:
                    t.servesCount === undefined || t.servesCount === null || isNaN(Number(t.servesCount))
                      ? 1
                      : Number(t.servesCount),
                  isDefault: false,
                })),
            }
          : { enabled: false },
        variants: variantsPayload,
        inventory: inventoryPayload,
      };

      const uploadResponses: unknown[] = [];
      const isCloneSubmit = !isEdit && Boolean(cloneSource);
      const hasSelectedImages =
        Boolean(primaryImageFile) || additionalImageFiles.some((file) => Boolean(file));

      if (isEdit && id) {
        const imageDeletes: Promise<unknown>[] = [];
        const pendingPrimaryDels = pendingDeletePrimaryMediaIdsRef.current;
        if (pendingPrimaryDels.length > 0) {
          pendingPrimaryDels.forEach((mediaId) => {
            imageDeletes.push(removeItemImageOnServer(mediaId, token));
          });
          pendingDeletePrimaryMediaIdsRef.current = [];
        }
        // Primary image: delete when removed or replaced.
        if ((hideSavedPrimaryImage || primaryImageFile) && existingPrimaryImageId) {
          imageDeletes.push(removeItemImageOnServer(existingPrimaryImageId, token));
        }
        // Additional images: delete when removed or replaced.
        existingAdditionalImageIds.forEach((existingId, idx) => {
          if (!existingId) return;
          const replaced = Boolean(additionalImageFiles[idx]);
          const removed = !additionalImagePreviews[idx];
          if (replaced || removed) {
            imageDeletes.push(removeItemImageOnServer(existingId, token));
          }
        });
        if (imageDeletes.length > 0) {
          await Promise.all(imageDeletes);
        }

        const imageUploads: Promise<unknown>[] = [];
        if (primaryImageFile) {
          imageUploads.push(uploadItemImageOnServer({ file: primaryImageFile, itemId: id, sortOrder: 1 }, token));
        }
        additionalImageFiles.forEach((file, idx) => {
          if (!file) return;
          imageUploads.push(
            uploadItemImageOnServer({ file, itemId: id, sortOrder: idx + 2 }, token),
          );
        });
        if (imageUploads.length > 0) {
          uploadResponses.push(...(await Promise.all(imageUploads)));
        }
      } else {
        let createdItemId = '';
        if (primaryImageFile) {
          const primaryResp = await uploadItemImageOnServer({ file: primaryImageFile, sortOrder: 1 }, token);
          uploadResponses.push(primaryResp);
          createdItemId = pickItemIdFromApiResponse(primaryResp);
        }

        if (isCloneSubmit) {
          if (!primaryImageFile && !hideSavedPrimaryImage && cloneSourcePrimaryImageId) {
            const clonePrimaryResp = await uploadItemImageOnServer(
              {
                existingImageId: cloneSourcePrimaryImageId,
                sortOrder: 1,
              },
              token,
            );
            uploadResponses.push(clonePrimaryResp);
            createdItemId = pickItemIdFromApiResponse(clonePrimaryResp) || createdItemId;
          }
        }

        const additionalUploads: Promise<unknown>[] = [];
        additionalImageFiles.forEach((file, idx) => {
          if (!file) return;
          additionalUploads.push(
            uploadItemImageOnServer(
              {
                file,
                sortOrder: idx + 2,
                ...(createdItemId ? { itemId: createdItemId } : {}),
              },
              token,
            ),
          );
        });
        if (isCloneSubmit) {
          cloneSourceAdditionalImageIds.forEach((existingId, idx) => {
            if (!existingId || !additionalImagePreviews[idx] || additionalImageFiles[idx]) return;
            additionalUploads.push(
              uploadItemImageOnServer(
                {
                  existingImageId: existingId,
                  sortOrder: idx + 2,
                  ...(createdItemId ? { itemId: createdItemId } : {}),
                },
                token,
              ),
            );
          });
        }
        if (additionalUploads.length > 0) {
          uploadResponses.push(...(await Promise.all(additionalUploads)));
        }
      }

      const uploadedItemId = pickItemIdFromApiResponse(uploadResponses);
      const uploadedCategoryId = pickEntityIdFromApiResponse(uploadResponses, ['categoryId']);

      let highlightItemId = '';

      if (isEdit && id) {
        /* Build edit-delta payload with deleteFields like maghil-portal */
        const editPayload: Record<string, unknown> = {
          ...basePayload,
          itemId: id,
        };
        if (existing) {
          const tagsDiff = arrayDiff(
            existing.tags.map((t) => t.id),
            form.tags.map((t) => t.id),
          );
          const allergensDiff = arrayDiff(
            existing.allergens.map((a) => a.id),
            form.allergens.map((a) => a.id),
          );
          const dietDiff = arrayDiff(
            existing.dietaryLabels.map((d) => d.id),
            form.dietaryLabels.map((d) => d.id),
          );
          const ingredientsDiff = arrayDiff(
            existing.ingredients.map((i) => i.id),
            form.ingredients.map((i) => i.id),
          );
          const categoryDiff = arrayDiff(initialCategoryIdsRef.current, form.categoryIds);

          if (tagsDiff.added.length) editPayload.tags = tagsDiff.added;
          else delete editPayload.tags;
          if (allergensDiff.added.length) editPayload.allergens = allergensDiff.added;
          else delete editPayload.allergens;
          if (dietDiff.added.length) editPayload.dietaryLabels = dietDiff.added;
          else delete editPayload.dietaryLabels;
          if (ingredientsDiff.added.length) editPayload.ingredients = ingredientsDiff.added;
          else delete editPayload.ingredients;

          const deleteFields: Record<string, string[]> = {};
          if (tagsDiff.removed.length) deleteFields.tags = tagsDiff.removed;
          if (allergensDiff.removed.length) deleteFields.allergens = allergensDiff.removed;
          if (dietDiff.removed.length) deleteFields.dietaryLabels = dietDiff.removed;
          if (ingredientsDiff.removed.length) deleteFields.ingredients = ingredientsDiff.removed;
          if (categoryDiff.removed.length) deleteFields.categoryIds = categoryDiff.removed;

          editPayload.categoryIds = form.categoryIds;

          const desiredKitchenIds = dedupeKitchenIds(form.kitchenStationSelectedIds);
          const kitchenDiff = arrayDiff(initialKitchenStationIdsRef.current, desiredKitchenIds);
          if (kitchenDiff.removed.length) deleteFields.kitchenIds = kitchenDiff.removed;

          const modifierDiff = arrayDiff(initialModifierIdsRef.current, form.modifierIds);
          if (modifierDiff.removed.length) deleteFields.modifierIds = modifierDiff.removed;

          // Bulk tray sizes removed in the UI → send their persisted ids for deletion.
          const currentBulkPriceIds = form.cateringEnabled
            ? form.cateringPricingTiers.map((t) => t.id).filter((bpId): bpId is string => Boolean(bpId))
            : [];
          const bulkPriceDiff = arrayDiff(initialBulkPriceIdsRef.current, currentBulkPriceIds);
          if (bulkPriceDiff.removed.length) deleteFields.cateringBulkPrices = bulkPriceDiff.removed;

          const bestPairedDiff = arrayDiff(initialBestPairedItemIdsRef.current, form.bestPairedItemIds);
          if (bestPairedDiff.removed.length) deleteFields.bestPairedItemIds = bestPairedDiff.removed;

          const prevSessionIds = initialSessionIdsRef.current;
          const currSessionIds = form.useDefaultSession ? [] : form.sessionIds;
          const sessionDiff = arrayDiff(prevSessionIds, currSessionIds);
          const timeBasedAvailDeletes: string[] = [];
          for (const gid of sessionDiff.removed) {
            let slotIds = initialSessionSlotIdsByGroupRef.current[gid];
            if (!slotIds?.length) {
              const sess = sessions.find((s) => s.id === gid);
              slotIds = sess?.slots?.map((s) => s.id).filter(Boolean) ?? [];
            }
            timeBasedAvailDeletes.push(...slotIds);
          }
          if (timeBasedAvailDeletes.length > 0) {
            deleteFields.timeBasedAvailability = Array.from(new Set(timeBasedAvailDeletes));
          }

          if (kitchenDiff.added.length) editPayload.kitchenIds = kitchenDiff.added;
          else delete editPayload.kitchenIds;

          const taxDiff = arrayDiff(initialTaxIdsRef.current, form.taxIds);
          if (taxDiff.added.length) editPayload.taxIds = taxDiff.added;
          else delete editPayload.taxIds;
          if (taxDiff.removed.length) deleteFields.taxIds = taxDiff.removed;

          if (Object.keys(deleteFields).length > 0) editPayload.deleteFields = deleteFields;
        }
        await updateItemOnServer(editPayload, token);
        highlightItemId = id;
      } else {
        const createPayload: Record<string, unknown> = { ...basePayload };
        if (uploadedItemId) createPayload.itemId = uploadedItemId;
        if (uploadedCategoryId) createPayload.categoryId = uploadedCategoryId;
        const createResp = await createItemOnServer(createPayload, token);
        const createdItemId = pickItemIdFromApiResponse(createResp);
        if (hasSelectedImages && !createdItemId && !uploadedItemId) {
          throw new Error('Failed to resolve item id after create.');
        }
        highlightItemId = (createdItemId || uploadedItemId || '').trim();
      }

      addToast(isEdit ? 'Item updated successfully' : 'Item created successfully', 'success');
      dispatch(invalidateFetchCache());
      clearItemsCache();
      navigate(
        highlightItemId
          ? `${pcPaths.items}?highlight=${encodeURIComponent(highlightItemId)}`
          : pcPaths.items,
      );
    } catch (e) {
      const rawMsg = normalizeApiErrorMessage(e, 'Failed to save item');
      // If the failure is the backend's "item code already in use" message,
      // rephrase it to surface the offending product name (MHB rephrase
      // requirement). Detect by phrase since the API doesn't tag error codes.
      const looksLikeDuplicateCodeError = /item\s*code/i.test(rawMsg) && /(already|in\s*use|exist|duplicate|taken)/i.test(rawMsg);
      const finalMsg = looksLikeDuplicateCodeError
        ? buildDuplicateCodeMessage(form.itemCode.trim())
        : rawMsg;
      if (looksLikeDuplicateCodeError) {
        setErrors((prev) => ({ ...prev, itemCode: finalMsg }));
      }
      addToast(finalMsg, 'error');
    } finally {
      setSaving(false);
      skipPastSeasonEndCheckRef.current = false;
      skipZeroPriceCheckRef.current = false;
    }
  };

  const mobileWhiteCard = isMobile ? { ...S.whiteCard, padding: 16 } : S.whiteCard;

  const visiblePricingOrderTypes = useMemo(
    () => activeOrderTypes.filter((ot) => form.orderVisibility[ot]),
    [activeOrderTypes, form.orderVisibility],
  );
  const orderTypeIdByKey = useMemo(
    () => getOutletOrderTypeIdByKey(selectedBranch),
    [selectedBranch],
  );

  useEffect(() => {
    if (!isCloneHydrate || !cloneId) return;
    const t = window.setTimeout(() => itemNameInputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [isCloneHydrate, cloneId]);

  /** When branch outlets load, fill `orderVisibilityByOutletId` from aggregated keys (listing-aligned ids). */
  useEffect(() => {
    const branchList = getOrderTypesForBranch(selectedBranch as Record<string, unknown> | null | undefined);
    if (branchList.length === 0) return;
    setForm((prev) => {
      const next = { ...prev.orderVisibilityByOutletId };
      let changed = false;
      branchList.forEach((ot) => {
        const oid = String(ot.id ?? '').trim();
        const k = mapOutletOrderTypeToKey(ot as OutletOrderType);
        if (!oid || !k) return;
        if (next[oid] !== undefined) return;
        next[oid] = prev.orderVisibility[k] !== false;
        changed = true;
      });
      if (!changed) return prev;
      const orderVisibility = deriveOrderVisibilityFromOutletMap(next, branchList);
      return { ...prev, orderVisibilityByOutletId: next, orderVisibility };
    });
  }, [selectedBranch]);

  useEffect(() => {
    if (form.categoryIds.length === 0) return;
    const assigned = categories.filter((c) => form.categoryIds.includes(c.id));
    if (assigned.length === 0) return;
    const branchList = getOrderTypesForBranch(selectedBranch as Record<string, unknown> | null | undefined);
    setForm((prev) => {
      if (branchList.length > 0) {
        let changed = false;
        const nextById = { ...prev.orderVisibilityByOutletId };
        for (const ot of branchList) {
          const oid = String(ot.id ?? '').trim();
          const k = mapOutletOrderTypeToKey(ot as OutletOrderType);
          if (!oid || !k) continue;
          const allowed = channelAllowedByAnyCategoryForOutletId(assigned, oid, k);
          if (!allowed && nextById[oid] !== false) {
            nextById[oid] = false;
            changed = true;
          }
        }
        if (!changed) return prev;
        const orderVisibility = deriveOrderVisibilityFromOutletMap(nextById, branchList);
        return { ...prev, orderVisibilityByOutletId: nextById, orderVisibility };
      }
      let changed = false;
      const next = { ...prev.orderVisibility };
      for (const row of pricingOrderTypeRows) {
        const allowed = channelAllowedByAnyCategory(assigned, row.key, orderTypeIdByKey);
        if (!allowed && next[row.key]) {
          next[row.key] = false;
          changed = true;
        }
      }
      return changed ? { ...prev, orderVisibility: next } : prev;
    });
  }, [form.categoryIds, categories, selectedBranch, pricingOrderTypeRows, orderTypeIdByKey]);

  const displayCategories = useMemo(() => {
    const alpha = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
    return [...categories].sort((a, b) => {
      const aPinned = categorySortSnapshot.has(a.id);
      const bPinned = categorySortSnapshot.has(b.id);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return alpha(a.name, b.name);
    });
  }, [categories, categorySortSnapshot]);
  const displayCategoriesSelectedFirst = useMemo(
    () => sortSelectedFirstByIdName(displayCategories, form.categoryIds),
    [displayCategories, form.categoryIds],
  );
  const visibleParentCategories = useMemo(() => {
    const parents = displayCategories.filter((c) => !c.parentCategoryId);
    const q = categorySearch.trim().toLowerCase();
    const filtered = !q ? parents : parents.filter((parent) => {
      if (parent.name.toLowerCase().includes(q)) return true;
      return displayCategories.some(
        (c) => c.parentCategoryId === parent.id && c.name.toLowerCase().includes(q),
      );
    });
    const selectedIds = new Set(form.categoryIds);
    return [...filtered].sort((a, b) => {
      const aActive = selectedIds.has(a.id) || displayCategories.some((c) => c.parentCategoryId === a.id && selectedIds.has(c.id));
      const bActive = selectedIds.has(b.id) || displayCategories.some((c) => c.parentCategoryId === b.id && selectedIds.has(c.id));
      if (aActive !== bActive) return aActive ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
    });
  }, [displayCategories, categorySearch, form.categoryIds]);

  // Show the customer-facing Display Name in brackets next to the internal Set Name,
  // rendered in a lighter weight. Set Name stays the primary identifier; subtitle keeps
  // the options/required context.
  const modifierSecondary = useCallback(
    (m: { name: string; displayName?: string }) =>
      m.displayName && m.displayName !== m.name ? `(${m.displayName})` : undefined,
    [],
  );
  const modifierSubtitle = useCallback(
    (m: { options: unknown[]; isRequired: boolean }) =>
      `${m.options.length} options${m.isRequired ? ' · Required' : ' · Optional'}`,
    [],
  );

  const modifierItemsForAssignment = useMemo(
    () =>
      modifiers.map((m) => ({
        id: m.id,
        name: m.name,
        secondaryName: modifierSecondary(m),
        subtitle: modifierSubtitle(m),
      })),
    [modifiers, modifierSecondary, modifierSubtitle],
  );

  const modifierAssignmentPills = useMemo(
    () =>
      form.modifierIds.map((id) => {
        const m = modifiers.find((x) => x.id === id);
        return m
          ? {
              id: m.id,
              name: m.name,
              secondaryName: modifierSecondary(m),
              subtitle: modifierSubtitle(m),
            }
          : { id, name: 'Modifier' };
      }),
    [form.modifierIds, modifiers, modifierSecondary, modifierSubtitle],
  );

  const kitchenStationItemsForAssignment = useMemo(
    () =>
      stations.map((s) => ({
        id: s.id,
        name: s.name,
        subtitle: s.code ? String(s.code) : undefined,
      })),
    [stations],
  );

  const kitchenStationAssignmentPills = useMemo(
    () =>
      form.kitchenStationSelectedIds.map((id) => {
        const s = stations.find((x) => x.id === id);
        return s ? { id: s.id, name: s.name } : { id, name: 'Station' };
      }),
    [form.kitchenStationSelectedIds, stations],
  );

  const toggleKitchenStation = useCallback((stationId: string) => {
    setForm((prev) => {
      const has = prev.kitchenStationSelectedIds.includes(stationId);
      if (has) {
        return { ...prev, kitchenStationSelectedIds: prev.kitchenStationSelectedIds.filter((x) => x !== stationId) };
      }
      return { ...prev, kitchenStationSelectedIds: [...prev.kitchenStationSelectedIds, stationId] };
    });
    setErrors((prev) => {
      const n = { ...prev };
      delete n.kitchenStation;
      return n;
    });
  }, []);

  const sessionItemsForAssignment = useMemo(
    () =>
      sessions.map((s) => ({
        id: s.id,
        name: s.name,
        subtitle: formatSessionScheduleSummary(s),
      })),
    [sessions],
  );

  const sessionAssignmentPills = useMemo(
    () =>
      form.sessionIds.map((id) => {
        const s = sessions.find((x) => x.id === id);
        return s ? { id: s.id, name: s.name } : { id, name: 'Session' };
      }),
    [form.sessionIds, sessions],
  );

  const allergenOptionsSorted = useMemo(
    () => sortPersistedFirstAttribute(apiAllergens, initialAllergenIdsRef.current),
    [apiAllergens, form.allergens],
  );
  const dietaryOptionsSorted = useMemo(
    () => sortPersistedFirstAttribute(apiDietary, initialDietaryIdsRef.current),
    [apiDietary, form.dietaryLabels],
  );
  const ingredientOptionsSorted = useMemo(
    () => sortPersistedFirstAttribute(apiIngredients, initialIngredientIdsRef.current),
    [apiIngredients, form.ingredients],
  );
  const tagOptionsSorted = useMemo(
    () => sortPersistedFirstAttribute(apiTags, initialTagIdsRef.current),
    [apiTags, form.tags],
  );

  const handleOpenOptionSetPicker = useCallback(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) {
      addToast('Select a location to load option sets', 'error');
      return;
    }
    void (async () => {
      await fetchVariationSets(locationId, token, { force: true });
      setShowOptionSetPicker(true);
    })();
  }, [
    selectedBranch?.id,
    selectedBranch?.locationId,
    auth?.accessToken,
    auth?.access_token,
    fetchVariationSets,
    addToast,
  ]);

  const hasImage = !!(imagePreview || (!hideSavedPrimaryImage && (existing?.imageUrl || cloneSource?.imageUrl)));
  const completeness = useMemo(() => itemCompleteness(form, hasImage), [form, hasImage]);
  const mandatoryComplete = useMemo(() => itemMandatoryComplete(form), [form]);
  const barColor = mandatoryComplete ? '#5F7A55' : '#7D8F69';
  const itemHint = useMemo(() => getItemHint(form, hasImage), [form, hasImage]);
  const priceStr =
    form.itemType === 'event' && form.isFreeEvent
      ? '0.00'
      : form.basePrice !== '' && !Number.isNaN(Number(form.basePrice))
        ? Number(form.basePrice).toFixed(2)
        : '0.00';
  const previewBadge = statusPreviewBadge[form.status] ?? statusPreviewBadge.draft;
  const rawCode =
    form.itemCode.trim() || (isEdit ? (existing?.itemCode ?? '').trim() : '') || '';
  const codeLine = rawCode
    ? rawCode.startsWith('#')
      ? `Code: ${rawCode}`
      : `Code: #${rawCode}`
    : 'Code: ---';

  const previewImageSrc = useMemo(() => {
    if (imagePreview) return imagePreview;
    if (hideSavedPrimaryImage) return null;
    const mediaPrimary = (cloneSource?.mediaResponseList ?? [])
      .slice()
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))[0];
    const fromExisting = resolveCatalogItemImageUrl(existing?.imageUrl);
    if (fromExisting) return fromExisting;
    const fromCloneMedia = resolveItemMediaPreviewUrl(mediaPrimary);
    if (fromCloneMedia) return fromCloneMedia;
    return resolveCatalogItemImageUrl(cloneSource?.imageUrl);
  }, [imagePreview, hideSavedPrimaryImage, existing?.imageUrl, cloneSource?.imageUrl, cloneSource?.mediaResponseList]);
  const todayIso = useMemo(() => toIsoLocalDate(new Date()), []);
  const seasonEndMinDate = useMemo(() => {
    const from = form.seasonStart || '';
    if (!from) return todayIso;
    return from > todayIso ? from : todayIso;
  }, [form.seasonStart, todayIso]);

  const primaryImageCaption = useMemo(() => {
    if (imageFileName.trim()) return imageFileName.trim();
    const mediaPrimary = (cloneSource?.mediaResponseList ?? [])
      .slice()
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))[0];
    const mediaRaw = String(
      mediaPrimary?.fileName ?? mediaPrimary?.imageUrl ?? '',
    ).trim();
    const raw = (existing?.imageUrl || mediaRaw || cloneSource?.imageUrl || '').trim();
    if (raw) {
      const leaf = raw.split(/[/\\]/).pop();
      if (leaf) return leaf;
    }
    return 'Saved image';
  }, [imageFileName, existing?.imageUrl, cloneSource?.imageUrl, cloneSource?.mediaResponseList]);

  const itemTypeLabel =
    itemTypeConfig.find((x) => x.value === form.itemType)?.label.toLowerCase() ?? 'item';

  const templatesForType = ITEM_TEMPLATES.filter((t) => t.type === form.itemType);

  const pageTitle = isEdit
    ? `Edit Item (${existing?.name})`
    : (isCloneHydrate && cloneSource)
      ? `Clone Item (${cloneSource.name})`
      : isCloneHydrate
        ? 'Clone Item'
        : 'New Item';
      
 
        

  const cloneSeasonalPastEndBanner = useMemo(() => {
    if (!isCloneHydrate || !form.isSeasonal || !form.seasonEnd) return false;
    return form.seasonEnd < todayIso;
  }, [isCloneHydrate, form.isSeasonal, form.seasonEnd, todayIso]);

  const formContent = (
      <div style={isMobile ? { ...formPageOuterStyle, height: 'auto', minHeight: 0 } : formPageOuterStyle}>
        <div style={isMobile ? { ...formPageMainScrollStyle, paddingBottom: 80 } : formPageMainScrollStyle}>
        <div style={{ ...S.twoColRow, flexDirection: isMobile ? 'column' : 'row', padding: isMobile ? '12px 16px 16px' : S.twoColRow.padding }}>
          <div style={{ ...S.leftCol, width: isMobile ? '100%' : undefined }}>

            {/* Browse Templates banner — hidden, kept for future use */}
            {/* {!isEdit && !showTemplates && (
              <div style={S.templateBanner}>
                <span
                  className="material-symbols-rounded"
                  style={{ fontSize: 22, color: 'var(--accent, #B89550)' }}
                >
                  auto_awesome
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--t1, #453F39)',
                    fontFamily: 'var(--font-primary)',
                    flex: 1,
                    minWidth: 200,
                  }}
                >
                  Start faster with a {itemTypeLabel} template
                </span>
                <button
                  type="button"
                  onClick={() => setShowTemplates(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--accent, #B89550)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                    textDecoration: 'none',
                  }}
                >
                  Browse Templates
          </button>
              </div>
            )} */}

            {!isEdit && showTemplates && (
              <div style={S.templatePanel}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--t1, #453F39)',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    Choose a Template
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowTemplates(false)}
                    aria-label="Close templates"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 4,
                      cursor: 'pointer',
                      color: 'var(--t3, #9A9084)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: 20 }}>close</span>
                  </button>
                </div>
                <div style={isMobile ? { ...S.templateGrid, gridTemplateColumns: 'repeat(2, 1fr)' } : S.templateGrid}>
                  {templatesForType.length === 0 && (
                    <div
                      style={{
                        gridColumn: '1 / -1',
                        fontSize: 13,
                        color: 'var(--t3, #9A9084)',
                        fontFamily: 'var(--font-primary)',
                        padding: '8px 0',
                      }}
                    >
                      No templates for this item type. Change item type below or close to continue.
                    </div>
                  )}
                  {templatesForType.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        padding: 16,
                        borderRadius: 2,
                        border: '1px solid var(--card-border, #E6DFD3)',
                        background: 'var(--surface, #FFFFFF)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        fontFamily: 'var(--font-primary)',
                        transition: 'border-color 0.15s ease, background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(184,149,80, 0.35)';
                        e.currentTarget.style.background = 'rgba(184,149,80, 0.04)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--card-border, #E6DFD3)';
                        e.currentTarget.style.background = 'var(--surface, #FFFFFF)';
                      }}
                    >
                      <span style={{ fontSize: 26, lineHeight: 1 }}>{t.emoji}</span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--t1, #453F39)',
                        }}
                      >
                        {t.name}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--t3, #9A9084)', lineHeight: 1.3 }}>
                        {t.fields} fields pre-filled
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={mobileWhiteCard}>
              <h2 style={S.cardTitle}>Basic Information</h2>

              {/* <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t2, #6E665D)', marginBottom: 8, fontFamily: 'var(--font-primary)' }}>
                  Item Type
                </div>
                <div style={S.typeRow}>
                  {itemTypeConfig.map((t) => {
                    const active = form.itemType === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => {
                          if (isEdit && form.itemType !== t.value) {
                            setPendingItemType(t.value);
                            return;
                          }
                          patch('itemType', t.value);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          padding: '12px 14px',
                          borderRadius: 2,
                          border: `2px solid ${active ? 'var(--accent, #B89550)' : 'var(--card-border, #E6DFD3)'}`,
                          background: active ? 'var(--accent-soft, rgba(184,149,80,0.06))' : 'var(--surface, #FFFFFF)',
                          cursor: 'pointer',
                          flexShrink: 0,
                          minWidth: 130,
                          maxWidth: 155,
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span
                          className="material-symbols-rounded"
                          style={{ fontSize: 20, color: active ? 'var(--accent, #B89550)' : 'var(--t3, #9A9084)' }}
                        >
                          {t.icon}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: active ? 'var(--accent, #B89550)' : 'var(--t1, #453F39)', fontFamily: 'var(--font-primary)', lineHeight: 1.25 }}>
                            {t.label}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)', marginTop: 4, lineHeight: 1.3 }}>
                            {t.desc}
                          </div>
                          {t.badge && (
                            <div style={{ marginTop: 6, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#7F9770', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>
                              {t.badge}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div> */}

              {/* <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t2, #6E665D)', marginBottom: 8, fontFamily: 'var(--font-primary)' }}>
                  Status
                </div>
                <div style={S.chipRow}>
                  {([
                    { id: 'active' as const, label: 'Active', dot: '#5F7A55', bg: 'rgba(95,122,85,0.08)' },
                    { id: 'draft' as const, label: 'Draft', dot: '#9A9084', bg: '#F4F0E8' },
                    { id: 'hidden' as const, label: 'Hidden', dot: '#B07A2A', bg: 'rgba(176,122,42,0.08)' },
                    { id: 'archived' as const, label: 'Archived', dot: '#9A9084', bg: '#F4F0E8' },
                  ] as const).map((s) => {
                    const selected = form.status === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => patch('status', s.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 2,
                          fontSize: 10,
                          fontWeight: 600,
                          fontFamily: 'var(--font-primary)',
                          border: selected ? `1px solid ${s.dot}` : '1px solid var(--card-border, #E6DFD3)',
                          background: selected ? s.bg : 'var(--surface, #FFFFFF)',
                          color: selected ? s.dot : 'var(--t2, #6E665D)',
                          cursor: 'pointer',
                          boxShadow: selected ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
                        {s.label}
                        {selected && <span className="material-symbols-rounded" style={{ fontSize: 14 }}>check</span>}
                      </button>
                    );
                  })}
                </div>
                {form.status === 'archived' && (
                  <p style={{ fontSize: 10, color: '#8A6D33', marginTop: 8, fontFamily: 'var(--font-primary)' }}>
                    Archiving removes this item from menus and channels after save.
                  </p>
                )}
                {form.status === 'hidden' && (
                  <p style={{ fontSize: 10, color: 'var(--t2, #6E665D)', marginTop: 8, fontFamily: 'var(--font-primary)' }}>
                    Hidden items stay off customer menus; staff can still find them on POS.
                  </p>
                )}
              </div> */}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div id="item-field-name">
              <TextField
                label="Item Name"
                value={form.name}
                onChange={(v) => patch('name', v.slice(0, ITEM_NAME_MAX))}
                required
                error={displayErrors.name}
                  placeholder="Enter item name"
                maxLength={ITEM_NAME_MAX}
                counterWarnAfter={115}
                inputRef={itemNameInputRef}
              />
              </div>
              <TextArea
                label="Description"
                value={form.description}
                onChange={(v) => patch('description', v)}
                  placeholder="Describe this item"
                  counterWarnAfter={900}
                  maxLength={1000}
                rows={3}
              />
                <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t2, #6E665D)', marginBottom: 8, fontFamily: 'var(--font-primary)' }}>
                    Primary Image
                </div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                  />
                  {previewImageSrc ? (
                    <div style={{ position: 'relative', borderRadius: 2, overflow: 'hidden', border: '1px solid var(--card-border, #E6DFD3)' }}>
                      <img
                        src={previewImageSrc}
                        alt="Preview"
                        style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface, #FFFFFF)', borderTop: '1px solid var(--card-border, #E6DFD3)' }}>
                        <span style={{ fontSize: 11, color: 'var(--t2, #6E665D)', fontFamily: 'var(--font-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{primaryImageCaption}</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                            title="Replace image"
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--accent, #B89550)' }}>edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                            title="Remove image"
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--red, #A63D2F)' }}>delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => imageInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleImageFile(file);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      borderRadius: 2,
                        border: `2px dashed ${displayErrors.imageUrl ? 'var(--red, #A63D2F)' : 'var(--card-border, #E6DFD3)'}`,
                        background: 'var(--bg, #FFFFFF)',
                        padding: 32,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ textAlign: 'center' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: 36, color: 'var(--t3, #9A9084)' }}>upload</span>
                        <p style={{ fontSize: 12, color: 'var(--t2, #6E665D)', marginTop: 8, fontFamily: 'var(--font-primary)' }}>
                          Drag & drop an image or <span style={{ color: 'var(--accent, #B89550)', fontWeight: 600 }}>browse</span>
                        </p>
                        <p style={{ fontSize: 10, color: 'var(--t3, #9A9084)', marginTop: 4, fontFamily: 'var(--font-primary)' }}>PNG, JPG up to 2MB</p>
                      </div>
                    </div>
                  )}
                  {displayErrors.imageUrl && (
                    <p style={{ fontSize: 11, color: 'var(--red, #A63D2F)', marginTop: 6, fontFamily: 'var(--font-primary)' }}>{displayErrors.imageUrl}</p>
                  )}
                </div>
                <div id="categories">
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, fontFamily: 'var(--font-primary)' }}>
                    Category
                  </div>
                  {displayErrors.category && <p style={{ fontSize: 11, color: '#A63D2F', marginBottom: 6, fontFamily: 'var(--font-primary)' }}>{displayErrors.category}</p>}
                  <div style={{ marginBottom: 8 }}>
                    <input
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      placeholder="Search categories..."
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '8px 10px',
                        borderRadius: 2,
                        border: '1px solid #E6DFD3',
                        fontSize: 12,
                        fontFamily: 'var(--font-primary)',
                      }}
                    />
                  </div>
                  {/* Parent categories */}
                  <div style={{ maxHeight: 180, overflowY: 'auto', paddingRight: 2, marginBottom: 8 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {visibleParentCategories.map((parent) => {
                      const hasChildren = displayCategories.some((c) => c.parentCategoryId === parent.id);
                      const childIds = displayCategories.filter((c) => c.parentCategoryId === parent.id).map((c) => c.id);
                      const isExpanded = expandedParentCategoryIds.has(parent.id);
                      const anyChildSelected = childIds.some((cid) => form.categoryIds.includes(cid));
                      const isActive = hasChildren ? (isExpanded || anyChildSelected) : form.categoryIds.includes(parent.id);
                      return (
                        <button
                          key={parent.id}
                          type="button"
                          onClick={() => {
                            if (hasChildren) {
                              // Toggle expand to reveal sub-categories
                              setExpandedParentCategoryIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(parent.id)) next.delete(parent.id);
                                else next.add(parent.id);
                                return next;
                              });
                            } else {
                              // No children — toggle this parent directly
                              const next = form.categoryIds.includes(parent.id)
                                ? form.categoryIds.filter((cid) => cid !== parent.id)
                                : [...form.categoryIds, parent.id];
                              patch('categoryIds', next);
                              setErrors((prev) => { const n = { ...prev }; delete n.category; return n; });
                            }
                          }}
                          style={{
                            padding: '6px 12px', borderRadius: 2, fontSize: 11, fontWeight: 600,
                            border: isActive ? '1px solid var(--accent, #B89550)' : '1px solid #E6DFD3',
                            background: isActive ? 'var(--accent, #B89550)' : '#fff',
                            color: isActive ? '#fff' : 'var(--t2, #6E665D)',
                            cursor: 'pointer', fontFamily: 'var(--font-primary)',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          {parent.name}
                          {hasChildren && (
                            <span className="material-symbols-rounded" style={{ fontSize: 14, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                              expand_more
                            </span>
                          )}
                        </button>
                      );
                    })}
                    </div>
                  </div>
                  {visibleParentCategories.length === 0 && (
                    <p style={{ fontSize: 11, color: 'var(--t3, #9A9084)', margin: '0 0 8px', fontFamily: 'var(--font-primary)' }}>
                      No categories found.
                    </p>
                  )}
                  {/* Sub-categories — only shown when parent is clicked/expanded */}
                  {visibleParentCategories.map((parent) => {
                    const q = categorySearch.trim().toLowerCase();
                    const parentMatches = !q || parent.name.toLowerCase().includes(q);
                    const children = displayCategories
                      .filter((c) => c.parentCategoryId === parent.id)
                      .filter((c) => parentMatches || !q || c.name.toLowerCase().includes(q));
                    if (children.length === 0) return null;
                    const isExpanded = expandedParentCategoryIds.has(parent.id);
                    // Show sub-categories only while the parent is expanded.
                    if (!isExpanded) return null;
                    return (
                      <div key={parent.id} style={{ marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid rgba(184,149,80,0.15)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1, #453F39)', marginBottom: 4, fontFamily: 'var(--font-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {parent.name} sub-categories
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {children.map((child) => {
                            const selected = form.categoryIds.includes(child.id);
                            return (
                              <button
                                key={child.id}
                                type="button"
                                onClick={() => {
                                  const next = selected
                                    ? form.categoryIds.filter((cid) => cid !== child.id)
                                    : [...form.categoryIds, child.id];
                                  patch('categoryIds', next);
                                  setErrors((prev) => { const n = { ...prev }; delete n.category; return n; });
                                }}
                                style={{
                                  padding: '4px 10px', borderRadius: 2, fontSize: 10, fontWeight: 500,
                                  border: selected ? '1px solid var(--accent, #B89550)' : '1px solid #E6DFD3',
                                  background: selected ? 'rgba(184,149,80,0.08)' : '#FDFCF9',
                                  color: selected ? '#B89550' : 'var(--t2, #6E665D)',
                                  cursor: 'pointer', fontFamily: 'var(--font-primary)',
                                }}
                              >
                                {selected && <span className="material-symbols-rounded" style={{ fontSize: 12, marginRight: 3, verticalAlign: 'middle' }}>check</span>}
                                {child.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div id="item-field-itemCode">
                <TextField
                  label="Item Code"
                  value={form.itemCode}
                  inputRef={itemCodeInputRef}
                  onChange={(v) => {
                    const sanitized = v.replace(/[^A-Za-z0-9]/g, '').slice(0, ITEM_CODE_MAX);
                    patch('itemCode', sanitized);
                    const code = sanitized.trim();
                    setErrors((prev) => {
                      const next = { ...prev };
                      if (!code) {
                        delete next.itemCode;
                        return next;
                      }
                      if (!isValidItemCode(code)) {
                        next.itemCode = `Item code must be letters and numbers only (up to ${ITEM_CODE_MAX} characters)`;
                        return next;
                      }
                      delete next.itemCode;
                      return next;
                    });
                  }}
                  onBlur={() => void handleItemCodeBlur()}
                  maxLength={ITEM_CODE_MAX}
                  placeholder="Unique identifier (e.g., SKU) — or scan a barcode"
                  error={displayErrors.itemCode}
                />
                <button
                  type="button"
                  onClick={() => itemCodeInputRef.current?.focus()}
                  style={{
                    marginTop: 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    border: '1px solid var(--border, #E8E0D1)',
                    borderRadius: 2,
                    background: 'var(--surface-2, #F7F4EC)',
                    color: 'var(--t2, #6E665D)',
                    fontSize: 12,
                    fontFamily: 'var(--font-primary)',
                    cursor: 'pointer',
                  }}
                  title="Scanner is always listening on this page. Click to focus the field, or just trigger your barcode reader."
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 14 }}>qr_code_scanner</span>
                  Scanner ready
                </button>
                </div>
                {!form.itemCode.trim() && (
                  <div style={{ fontSize: 11, color: 'var(--t3, #9A9084)', marginTop: -8, fontFamily: 'var(--font-primary)' }}>
                    Enter a code if you need one. It will not be auto-generated.
                  </div>
                )}

                {/* Exclusive item (limit comes from BE, not a static FE cap) */}
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="checkbox"
                    id="exclusive-item"
                    checked={form.exclusiveItem}
                    disabled={
                      exclusiveItemsLoading
                      || (
                        exclusiveItemsCount != null
                        && exclusiveItemsLimit != null
                        && exclusiveItemsCount >= exclusiveItemsLimit
                        && !form.exclusiveItem
                        && !isExclusiveOnServer
                      )
                    }
                    onChange={(e) => patch('exclusiveItem', e.target.checked)}
                    style={{
                      accentColor: 'var(--accent, #B89550)',
                      width: 16,
                      height: 16,
                      cursor:
                        exclusiveItemsLoading
                        || (
                          exclusiveItemsCount != null
                          && exclusiveItemsLimit != null
                          && exclusiveItemsCount >= exclusiveItemsLimit
                          && !form.exclusiveItem
                          && !isExclusiveOnServer
                        )
                          ? 'not-allowed'
                          : 'pointer',
                      opacity:
                        exclusiveItemsLoading
                        || (
                          exclusiveItemsCount != null
                          && exclusiveItemsLimit != null
                          && exclusiveItemsCount >= exclusiveItemsLimit
                          && !form.exclusiveItem
                          && !isExclusiveOnServer
                        )
                          ? 0.6
                          : 1,
                    }}
                  />
                  <label
                    htmlFor="exclusive-item"
                    style={{ fontSize: 12, color: 'var(--t1, #453F39)', cursor: 'pointer', fontFamily: 'var(--font-primary)', fontWeight: 600 }}
                  >
                    Exclusive item
                    <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 8, padding: '2px 8px', borderRadius: 999, background: 'rgba(184,149,80,0.06)', border: '1px solid rgba(184,149,80,0.15)', color: 'var(--accent, #B89550)' }}>
                      {exclusiveCountForDisplay == null ? '...' : exclusiveCountForDisplay}/{exclusiveItemsLimit == null ? '...' : exclusiveItemsLimit}
                    </span>
                  </label>
                </div>

                {/* Sold By — unit of measure (Square-style) */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, fontFamily: 'var(--font-primary)' }}>
                    Sold By
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    {([
                      { id: 'each' as const, label: 'Each', icon: 'inventory_2', desc: 'Individual items' },
                      { id: 'weight' as const, label: 'Weight', icon: 'scale', desc: 'Sold by weight' },
                      // { id: 'volume' as const, label: 'Volume', icon: 'local_drink', desc: 'Sold by volume' },
                    ]).map((opt) => {
                      const sel = form.soldBy === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            patch('soldBy', opt.id);
                            patch('pricePerQty', 1);
                            if (opt.id === 'each') {
                              const perItem = unitOptions.find((u) =>
                                u.name.replace(/[\s_]/g, '').toUpperCase().includes('PERITEM') ||
                                u.name.toUpperCase() === 'PER ITEM' ||
                                u.name.toUpperCase() === 'PER_ITEM',
                              );
                              patch('unitId', perItem?.id ?? '');
                              patch('unitOfMeasure', perItem?.name ?? 'Each');
                              setForm((prev) => ({
                                ...prev,
                                currentStock: prev.currentStock ? String(Math.floor(Number(prev.currentStock))) : '',
                                lowStockThreshold: prev.lowStockThreshold ? String(Math.floor(Number(prev.lowStockThreshold))) : '',
                                defaultStockQuantity: prev.defaultStockQuantity ? String(Math.floor(Number(prev.defaultStockQuantity))) : '',
                              }));
                            } else if (opt.id === 'weight') {
                              const firstWeight = unitOptions.find(
                                (u) => !u.name.replace(/[\s_]/g, '').toUpperCase().includes('PERITEM'),
                              );
                              patch('unitId', firstWeight?.id ?? '');
                              patch('unitOfMeasure', firstWeight?.name ?? '');
                              patch('inventoryEnabled', false);
                            }
                            // else if (opt.id === 'volume') { patch('unitId', ''); patch('unitOfMeasure', 'Litre'); }
                          }}
                          style={{
                            flex: 1, padding: '10px 12px', borderRadius: 2, textAlign: 'center',
                            border: sel ? '1.5px solid var(--accent, #B89550)' : '1px solid #E6DFD3',
                            background: sel ? 'rgba(184,149,80,0.04)' : '#fff',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: 20, color: sel ? '#B89550' : '#9A9084', display: 'block', marginBottom: 4 }}>{opt.icon}</span>
                          <div style={{ fontSize: 11, fontWeight: 600, color: sel ? '#B89550' : 'var(--t1, #453F39)', fontFamily: 'var(--font-primary)' }}>{opt.label}</div>
                          <div style={{ fontSize: 9, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)', marginTop: 2 }}>{opt.desc}</div>
                        </button>
                      );
                    })}
                  </div>

                  {form.soldBy !== 'each' && (() => {
                    const weightUnits = unitOptions.filter(
                      (u) => !u.name.replace(/[\s_]/g, '').toUpperCase().includes('PERITEM'),
                    );
                    const noUnits = weightUnits.length === 0;
                    return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div id="item-field-unit">
                        <Select
                          label="Unit of Measure"
                          value={form.unitId}
                          onChange={(v) => {
                            const found = unitOptions.find((u) => u.id === v);
                            patch('unitId', v);
                            patch('unitOfMeasure', found?.name ?? v);
                          }}
                          options={weightUnits.map((u) => ({ value: u.id, label: u.name }))}
                          placeholder={noUnits ? 'No units configured' : 'Select unit...'}
                          disabled={noUnits}
                          error={displayErrors.unit}
                        />
                        {noUnits && !displayErrors.unit && (
                          <p style={{ fontSize: 11, color: 'var(--red, #A63D2F)', marginTop: 4, fontFamily: 'var(--font-primary)' }}>
                            No units configured. Switch to &quot;Each&quot; or add units before saving.
                          </p>
                        )}
                      </div>
                      {/* <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--t2, #6E665D)', marginBottom: 6, fontFamily: 'var(--font-primary)' }}>
                          Price Per
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--card-border, #E6DFD3)', borderRadius: 2, overflow: 'hidden' }}>
                          <input
                            type="number"
                            value={form.pricePerQty}
                            onChange={(e) => patch('pricePerQty', e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="1"
                            min={0}
                            step="any"
                            style={{
                              flex: 1, padding: '8px 12px', border: 'none', outline: 'none',
                              fontSize: 12, fontFamily: 'var(--font-primary)', color: 'var(--t1, #453F39)',
                              background: 'transparent', minWidth: 0,
                            }}
                          />
                          <span style={{
                            padding: '8px 12px', background: '#FFFFFF', fontSize: 11, fontWeight: 600,
                            color: 'var(--t2, #6E665D)', fontFamily: 'var(--font-primary)',
                            borderLeft: '1px solid var(--card-border, #E6DFD3)', whiteSpace: 'nowrap',
                          }}>
                            {form.unitOfMeasure}
                          </span>
                        </div>
                        {form.pricePerQty && Number(form.pricePerQty) !== 1 && (
                          <p style={{ fontSize: 10, color: '#5F7A55', marginTop: 4, fontFamily: 'var(--font-primary)' }}>
                            Base price applies per {form.pricePerQty} {form.unitOfMeasure}
                          </p>
                        )}
                      </div> */}
                    </div>
                    );
                  })()}

                  {/* {form.soldBy !== 'each' && (
                    <div style={{ marginTop: 12, padding: 12, borderRadius: 2, background: '#FDFCF9', border: '1px solid #F4F0E8' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2, #6E665D)', marginBottom: 8, fontFamily: 'var(--font-primary)' }}>
                        Stock Conversion (optional)
                      </div>
                      <p style={{ fontSize: 10, color: 'var(--t3, #9A9084)', marginBottom: 8, fontFamily: 'var(--font-primary)', lineHeight: 1.4 }}>
                        If you stock in a different unit than you sell (e.g., stock bottles, sell glasses), set the conversion here.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'end' }}>
                        <TextField
                          label="Stock Unit"
                          value={form.stockUnit}
                          onChange={(v) => patch('stockUnit', v)}
                          placeholder="e.g., Bottle"
                          maxLength={20}
                        />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t3, #9A9084)', paddingBottom: 10 }}>=</span>
                        <TextField
                          label={`Sell Units (${form.unitOfMeasure})`}
                          value={String(form.stockConversionRate)}
                          onChange={(v) => patch('stockConversionRate', v === '' ? '' : Number(v))}
                          placeholder="e.g., 4"
                        />
                      </div>
                      {form.stockUnit && form.stockConversionRate && (
                        <p style={{ fontSize: 10, color: '#5F7A55', marginTop: 6, fontFamily: 'var(--font-primary)' }}>
                          1 {form.stockUnit} = {form.stockConversionRate} {form.unitOfMeasure}
                        </p>
                      )}
                    </div>
                  )} */}
                </div>
              </div>
            </div>

            <div style={mobileWhiteCard}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8C6A7A', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, fontFamily: 'var(--font-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#8C6A7A' }}>visibility</span>
                Channel Visibility
              </div>
              <p style={{ fontSize: 11, color: 'var(--t3, #9A9084)', margin: '0 0 10px', fontFamily: 'var(--font-primary)', lineHeight: 1.5, paddingLeft: 10, borderLeft: '2px solid rgba(124,58,237,0.2)' }}>
                Choose which channels this item appears on. This narrows within what your category and menu allow.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {outletChannelRows.map((row) => {
                  const assignedCats = categories.filter((c) => form.categoryIds.includes(c.id));
                  const hasCats = assignedCats.length > 0;
                  const useOutletId = Boolean(row.orderTypeId);
                  const channelAllowedByCat = !hasCats
                    ? true
                    : useOutletId
                      ? channelAllowedByAnyCategoryForOutletId(
                          assignedCats,
                          row.orderTypeId,
                          row.key,
                        )
                      : channelAllowedByAnyCategory(assignedCats, row.key, orderTypeIdByKey);

                  return (
                    <div
                      key={useOutletId ? row.orderTypeId : row.key}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', borderRadius: 2,
                        border: `1px solid ${!channelAllowedByCat ? '#E6DFD3' : 'var(--card-border, #E6DFD3)'}`,
                        background: !channelAllowedByCat ? '#F7F4EC' : 'var(--surface, #FFFFFF)',
                        opacity: !channelAllowedByCat ? 0.6 : 1,
                      }}
                      title={
                        !channelAllowedByCat
                          ? 'Not enabled on selected categories.'
                          : undefined
                      }
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {!channelAllowedByCat && (
                          <span className="material-symbols-rounded" style={{ fontSize: 14, color: '#9A9084' }}>lock</span>
                        )}
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-primary)', color: !channelAllowedByCat ? '#9A9084' : 'var(--t1, #453F39)' }}>{row.label}</span>
                          {!channelAllowedByCat && (
                            <div style={{ fontSize: 9, color: '#B07A2A', fontFamily: 'var(--font-primary)', marginTop: 1 }}>
                              Not enabled on selected categories
                            </div>
                          )}
                        </div>
                      </div>
                      <Toggle
                        checked={
                          channelAllowedByCat
                            ? useOutletId
                              ? form.orderVisibilityByOutletId[row.orderTypeId] !== false
                              : Boolean(form.orderVisibility[row.key])
                            : false
                        }
                        onChange={
                          channelAllowedByCat
                            ? (c) =>
                                setForm((prev) => {
                                  if (!useOutletId) {
                                    return {
                                      ...prev,
                                      orderVisibility: { ...prev.orderVisibility, [row.key]: c },
                                    };
                                  }
                                  const branchList = getOrderTypesForBranch(
                                    selectedBranch as Record<string, unknown> | null | undefined,
                                  );
                                  const nextById = {
                                    ...prev.orderVisibilityByOutletId,
                                    [row.orderTypeId]: c,
                                  };
                                  const orderVisibility =
                                    branchList.length > 0
                                      ? deriveOrderVisibilityFromOutletMap(nextById, branchList)
                                      : prev.orderVisibility;
                                  return {
                                    ...prev,
                                    orderVisibilityByOutletId: nextById,
                                    orderVisibility,
                                  };
                                })
                            : undefined
                        }
                      />
                    </div>
                  );
                })}
                {/* {form.categoryIds.length === 0 && (
                  <p style={{ fontSize: 10, color: '#B07A2A', fontFamily: 'var(--font-primary)', marginTop: 4 }}>
                    Assign a category to manage visibility at the category level.
                  </p>
                )} */}
              </div>
            </div>

            <div style={mobileWhiteCard}>
              <div style={{ border: '1px solid var(--card-border, #E6DFD3)', borderRadius: 2, padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: form.isTableSide || form.isOrderStation || form.isMenuStation ? 12 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--t2, #6E665D)' }}>point_of_sale</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1, #453F39)', fontFamily: 'var(--font-primary)' }}>Kiosk</span>
                  </div>
                  <Toggle
                    checked={form.isTableSide || form.isOrderStation || form.isMenuStation}
                    onChange={(c) =>
                      setForm((prev) => ({
                        ...prev,
                        isTableSide: c,
                        isOrderStation: c,
                        isMenuStation: c,
                      }))
                    }
                  />
                </div>
                {(form.isTableSide || form.isOrderStation || form.isMenuStation) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {([
                      { key: 'isTableSide' as const, label: 'Table Side' },
                      { key: 'isOrderStation' as const, label: 'Order Station' },
                      { key: 'isMenuStation' as const, label: 'Menu Station' },
                    ]).map((opt) => (
                      <div key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="checkbox"
                          id={`kiosk-${opt.key}`}
                          checked={form[opt.key]}
                          onChange={(e) => patch(opt.key, e.target.checked)}
                          style={{ accentColor: 'var(--accent, #B89550)', width: 16, height: 16, cursor: 'pointer' }}
                        />
                        <label
                          htmlFor={`kiosk-${opt.key}`}
                          style={{ fontSize: 12, color: 'var(--t1, #453F39)', cursor: 'pointer', fontFamily: 'var(--font-primary)', fontWeight: 500 }}
                        >
                          {opt.label}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, border: '1px solid var(--card-border, #E6DFD3)', borderRadius: 2, padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--t2, #6E665D)' }}>qr_code_scanner</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1, #453F39)', fontFamily: 'var(--font-primary)' }}>Contactless Dine-in</span>
                </div>
                <Toggle
                  checked={form.isCdMenu}
                  onChange={(c) => patch('isCdMenu', c)}
                />
              </div>
            </div>

            <div style={mobileWhiteCard}>
              <h2 style={S.cardTitle}>Pricing</h2>
              {form.itemType === 'event' && (
                <div style={{ marginBottom: 16, padding: 12, borderRadius: 2, border: `1px solid ${form.isFreeEvent ? 'rgba(95,122,85,0.25)' : 'var(--card-border, #E6DFD3)'}`, background: form.isFreeEvent ? 'rgba(95,122,85,0.06)' : 'var(--bg, #FFFFFF)' }}>
                  <Toggle checked={form.isFreeEvent} onChange={(v) => { patch('isFreeEvent', v); if (v) patch('basePrice', 0); }} label="This is a free event" />
                  <p style={{ fontSize: 10, color: 'var(--t3, #9A9084)', marginTop: 6, marginLeft: 44, fontFamily: 'var(--font-primary)' }}>No payment required --- customers register for free</p>
                  {form.isFreeEvent && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, fontFamily: 'var(--font-primary)' }}>Registration button label</div>
                      <div style={S.chipRow}>
                        {REGISTRATION_LABELS.map((lbl) => (
                          <button
                            key={lbl}
                            type="button"
                            onClick={() => patch('registrationLabel', lbl)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 2,
                              fontSize: 10,
                              fontWeight: 600,
                              border: `1px solid ${form.registrationLabel === lbl ? 'var(--accent, #B89550)' : 'var(--card-border, #E6DFD3)'}`,
                              background: form.registrationLabel === lbl ? 'rgba(184,149,80,0.06)' : 'var(--surface, #FFFFFF)',
                              color: form.registrationLabel === lbl ? 'var(--accent, #B89550)' : 'var(--t2, #6E665D)',
                              cursor: 'pointer',
                              fontFamily: 'var(--font-primary)',
                            }}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {form.itemType === 'event' && form.isFreeEvent ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', maxWidth: 220, background: '#EDF3EB', border: '1px solid rgba(95,122,85,0.3)', borderRadius: 2, marginBottom: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#5F7A55', fontFamily: 'var(--font-primary)' }}>FREE</span>
                  <span style={{ fontSize: 10, color: 'var(--t3, #9A9084)' }}>($0.00)</span>
                </div>
              ) : (
              <div id="item-field-basePrice">
              <NumberField
                  label={form.itemType === 'event' ? 'Ticket price' : 'Base price'}
                value={form.basePrice}
                onChange={(v) => { patch('basePrice', v === '' ? '' : Number(v)); setErrors((prev) => { const n = { ...prev }; delete n.basePrice; return n; }); }}
                required
                prefix="$"
                min={0}
                step={1}
                error={displayErrors.basePrice}
                priceFormat
              />
              {!displayErrors.basePrice && form.basePrice === '' && (
                <p style={{ color: 'var(--orange, #B07A2A)', fontSize: 11, marginTop: 4, fontFamily: 'var(--font-primary)' }}>Base price is mandatory</p>
              )}
              </div>
              )}
              <div style={{ marginTop: 16 }}>
                <NumberField
                  label="Cost price (optional)"
                  value={form.costPrice}
                  onChange={(v) => { patch('costPrice', v === '' ? '' : Number(v)); setErrors((prev) => { const n = { ...prev }; delete n.costPrice; return n; }); }}
                  prefix="$"
                  min={0}
                  step={1}
                  error={displayErrors.costPrice}
                  priceFormat
                />
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {form.costPrice !== '' && form.basePrice !== '' && (() => {
                    const sell = Number(form.basePrice);
                    const cost = Number(form.costPrice);
                    const marginAmt = sell - cost;
                    const showPct = sell > 0;
                    const marginPct = showPct ? (marginAmt / sell) * 100 : null;
                    const color = marginAmt > 0 ? 'var(--green, #5F7A55)' : marginAmt === 0 ? 'var(--t3, #9A9084)' : 'var(--red, #A63D2F)';
                    return (
                      <span style={{ fontSize: 11, fontWeight: 600, color, fontFamily: 'var(--font-primary)' }}>
                        Margin: ${marginAmt.toFixed(2)}{marginPct !== null ? ` (${marginPct.toFixed(2)}%)` : ''}
                      </span>
                    );
                  })()}
                  {(form.costPrice === '' || form.basePrice === '') && (
                    <span style={{ fontSize: 10, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)' }}>Enter cost for margin tracking</span>
                  )}
                </div>
              </div>
              {/* PCF-12: Pricing Strategy */}
              {/* <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--t2, #6E665D)', display: 'block', marginBottom: 8, fontFamily: 'var(--font-primary)' }}>Pricing Strategy</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {(['standard', 'menu_specific'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        if (s === 'standard' && form.pricingStrategy === 'menu_specific') {
                          if (!window.confirm('This will remove all menu-specific price overrides. Continue?')) return;
                        }
                        patch('pricingStrategy', s);
                        if (s === 'standard') patch('menuPriceOverrides', []);
                      }}
                      style={{
                        padding: '6px 14px', borderRadius: 2, fontSize: 12, fontWeight: 600,
                        border: form.pricingStrategy === s ? '1.5px solid var(--accent, #B89550)' : '1px solid #E6DFD3',
                        background: form.pricingStrategy === s ? 'rgba(184,149,80,0.06)' : '#fff',
                        color: form.pricingStrategy === s ? 'var(--accent, #B89550)' : 'var(--t2, #6E665D)',
                        cursor: 'pointer', fontFamily: 'var(--font-primary)',
                      }}
                    >
                      {s === 'standard' ? 'Standard' : 'Menu-Specific'}
                    </button>
                  ))}
                </div>
                {form.pricingStrategy === 'menu_specific' && (() => {
                  const itemMenus = menus.filter((m) =>
                    m.categoryIds.some((cid) => form.categoryIds.includes(cid)) ||
                    (m.individualItemIds ?? []).includes(id ?? '')
                  );
                  if (itemMenus.length === 0) return (
                    <div style={{ padding: 12, borderRadius: 2, background: '#F7EFDF', border: '1px solid #E9D8B5', fontSize: 12, color: '#8A6D33', fontFamily: 'var(--font-primary)' }}>
                      This item isn't in any menu yet. Add it to a menu first, then set menu-specific prices.
                    </div>
                  );
                  return (
                    <div style={{ padding: 14, borderRadius: 2, border: '1px solid #E6DFD3', background: '#FDFCF9' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#6E665D', marginBottom: 10, fontFamily: 'var(--font-primary)' }}>Menu Prices</p>
                      <p style={{ fontSize: 10, color: '#9A9084', margin: '0 0 10px' }}>Default Price: ${form.basePrice || 0} --- used when no menu override exists.</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {itemMenus.map((menu) => {
                          const override = form.menuPriceOverrides.find((o) => o.menuId === menu.id);
                          const menuPrice = override?.price ?? '';
                          const base = Number(form.basePrice) || 0;
                          const mp = Number(menuPrice) || base;
                          const pctDiff = base > 0 ? ((mp - base) / base * 100) : 0;
                          const sessionNames = (menu.sessionIds ?? []).map((sid) => sessions.find((s) => s.id === sid)?.name).filter(Boolean).join(', ');
                          return (
                            <div key={menu.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 2, background: '#fff', border: '1px solid #E6DFD3' }}>
                              <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#B89550' }}>restaurant_menu</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#453F39', fontFamily: 'var(--font-primary)' }}>{menu.name}</div>
                                {sessionNames && <div style={{ fontSize: 10, color: '#9A9084' }}>{sessionNames}</div>}
                              </div>
                              <div style={{ position: 'relative', width: 100 }}>
                                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9A9084' }}>$</span>
                                <input
                                  type="number" min={0} step={1}
                                  value={menuPrice}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? '' : Number(e.target.value);
                                    const next = form.menuPriceOverrides.filter((o) => o.menuId !== menu.id);
                                    if (val !== '') next.push({ menuId: menu.id, price: val });
                                    patch('menuPriceOverrides', next);
                                  }}
                                  placeholder={String(base)}
                                  style={{ width: '100%', fontSize: 12, padding: '6px 8px 6px 22px', border: '1px solid #E6DFD3', borderRadius: 2, outline: 'none', fontFamily: 'var(--font-primary)', boxSizing: 'border-box' as const }}
                                />
                              </div>
                              {menuPrice !== '' && (
                                <span style={{
                                  fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                                  background: pctDiff === 0 ? '#F4F0E8' : pctDiff > 0 ? '#16A34A15' : '#DC262615',
                                  color: pctDiff === 0 ? '#6E665D' : pctDiff > 0 ? '#5F7A55' : '#A63D2F',
                                }}>
                                  {pctDiff === 0 ? '= Base' : `${pctDiff > 0 ? '+' : ''}${pctDiff.toFixed(1)}%`}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div> */}

              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  id="sameCh"
                  checked={form.useSamePriceAllChannels}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    if (!checked) {
                      setForm((prev) => {
                        const seed: Partial<Record<string, number | ''>> = {};
                        pricingOrderTypeRows.forEach((row) => {
                          const existing = prev.channelPrices[row.orderTypeId];
                          seed[row.orderTypeId] = existing !== undefined && existing !== '' ? existing : '';
                        });
                        return { ...prev, useSamePriceAllChannels: false, channelPrices: seed };
                      });
                      setErrors((prev) => { const n = { ...prev }; delete n.channelPrices; return n; });
                    } else {
                      patch('useSamePriceAllChannels', true);
                    }
                  }}
                  style={{ accentColor: 'var(--accent, #B89550)', width: 16, height: 16 }}
                />
                <label htmlFor="sameCh" style={{ fontSize: 12, color: 'var(--t1, #453F39)', cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
                  Use same price for all channels
                </label>
              </div>
              {!form.useSamePriceAllChannels && (
                <div id="item-field-channel-prices" style={{ marginTop: 12, padding: 16, borderRadius: 2, border: '1px solid var(--card-border, #E6DFD3)', background: 'var(--bg, #FFFFFF)' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2, #6E665D)', marginBottom: 12, fontFamily: 'var(--font-primary)' }}>Per-channel pricing</p>
                  <p style={{ fontSize: 10, color: 'var(--t3, #9A9084)', margin: '0 0 10px', fontFamily: 'var(--font-primary)' }}>
                    Prices can be entered only for order types enabled in Order type visibility.
                    {visiblePricingOrderTypes.length === 0 ? ' Enable at least one order type to set channel prices.' : ''}
                  </p>
                  {displayErrors.channelPrices && (
                    <p style={{ color: 'var(--red)', fontSize: 11, marginTop: 0, marginBottom: 10, fontFamily: 'var(--font-primary)' }}>{displayErrors.channelPrices}</p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {pricingOrderTypeRows.map((row) => {
                      const pct = getChannelPctDiff(row.orderTypeId);
                      const channelEnabled = form.orderVisibilityByOutletId[row.orderTypeId] !== false;
                      return (
                        <div key={row.orderTypeId} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 4 : 12, flexWrap: 'wrap' }}>
                          <span style={{ width: isMobile ? '100%' : 120, fontSize: 12, color: 'var(--t2, #6E665D)', fontFamily: 'var(--font-primary)' }}>{row.label}</span>
                          <div style={{ width: isMobile ? '100%' : 160, opacity: channelEnabled ? 1 : 0.55, pointerEvents: channelEnabled ? 'auto' : 'none' }}>
                    <NumberField
                              label=""
                      value={form.channelPrices[row.orderTypeId] ?? ''}
                      onChange={(v) => setChannelPrice(row.orderTypeId, v === '' ? '' : Number(v))}
                      prefix="$"
                      min={0}
                      step={1}
                      priceFormat
                    />
                          </div>
                          {!channelEnabled && (
                            <span style={{ fontSize: 10, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)' }}>
                              Enable this order type in visibility to edit price
                            </span>
                          )}
                          {pct !== null && pct !== 0 && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: pct > 0 ? '#5F7A55' : '#A63D2F', fontFamily: 'var(--font-primary)' }}>
                              {pct > 0 ? '\u2191' : '\u2193'} {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--card-border, #E6DFD3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1, #453F39)', fontFamily: 'var(--font-primary)' }}>Variations</div>
                    <p style={{ fontSize: 10, color: 'var(--t3, #9A9084)', marginTop: 4, fontFamily: 'var(--font-primary)', maxWidth: 420 }}>
                      Create multiple versions (e.g. Small, Medium, Large) with individual prices
                    </p>
                  </div>
                  <Toggle
                    checked={form.hasVariations}
                    onChange={(on) => {
                      if (!on && form.variations.length > 0) {
                        setRemoveVariationsOpen(true);
                        return;
                      }
                      patch('hasVariations', on);
                      if (on && form.variations.length === 0) {
                        patch('variations', [{ id: `var-${Date.now()}`, name: '', price: 0 }]);
                      }
                    }}
                  />
                </div>
                {form.hasVariations && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ border: '1px solid var(--card-border, #E6DFD3)', borderRadius: 2, overflow: 'hidden' }}>
                      {form.variations.map((v, idx) => (
                        <div
                          key={v.id}
                          draggable
                          onDragStart={() => setDragVariationId(v.id)}
                          onDragEnd={() => setDragVariationId(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (!dragVariationId || dragVariationId === v.id) return;
                            setForm((prev) => {
                              const ids = prev.variations.map((x) => x.id);
                              const from = ids.indexOf(dragVariationId);
                              const to = ids.indexOf(v.id);
                              if (from < 0 || to < 0) return prev;
                              const next = [...prev.variations];
                              const [moved] = next.splice(from, 1);
                              next.splice(to, 0, moved);
                              return { ...prev, variations: next };
                            });
                            setDragVariationId(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 12px',
                            borderBottom: idx < form.variations.length - 1 ? '1px solid var(--card-border, #E6DFD3)' : 'none',
                            background: 'var(--surface, #FFFFFF)',
                            cursor: 'grab',
                          }}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--t3, #9A9084)' }}>drag_indicator</span>
                          <input
                            value={v.name}
                            onChange={(e) => {
                              const name = e.target.value;
                              setForm((prev) => ({
                                ...prev,
                                variations: prev.variations.map((x) => (x.id === v.id ? { ...x, name } : x)),
                              }));
                            }}
                            placeholder="e.g. Small"
                            style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 2, border: '1px solid var(--card-border, #E6DFD3)', fontSize: 12, fontFamily: 'var(--font-primary)' }}
                          />
                          <div style={{ width: 100 }}>
                            <NumberField
                              label=""
                              value={v.price}
                              onChange={(n) => {
                                setForm((prev) => ({
                                  ...prev,
                                  variations: prev.variations.map((x) => (x.id === v.id ? { ...x, price: n === '' ? 0 : Number(n) } : x)),
                                }));
                              }}
                              prefix="$"
                              min={0}
                              step={1}
                              priceFormat
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, variations: prev.variations.filter((x) => x.id !== v.id) }))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3, #9A9084)', padding: 4 }}
                            aria-label="Remove variation"
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: 20 }}>close</span>
                          </button>
                        </div>
                  ))}
                </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setShowVariationSetPicker(!showVariationSetPicker)}
                        style={{ fontSize: 11, fontWeight: 600, padding: '8px 12px', borderRadius: 2, border: '1px solid var(--card-border, #E6DFD3)', background: 'var(--surface, #FFFFFF)', cursor: 'pointer', fontFamily: 'var(--font-primary)', color: 'var(--t2, #6E665D)' }}
                      >
                        Add from variation set
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            variations: [...prev.variations, { id: `var-${Date.now()}`, name: '', price: 0 }],
                          }));
                        }}
                        style={{ fontSize: 11, fontWeight: 600, padding: '8px 12px', borderRadius: 2, border: 'none', background: 'var(--accent, #B89550)', color: '#FFF', cursor: 'pointer', fontFamily: 'var(--font-primary)' }}
                      >
                        + Add variation
                      </button>
                    </div>
                    {showVariationSetPicker && (
                      <div style={{ padding: 12, borderRadius: 2, border: '1px solid var(--card-border, #E6DFD3)', background: 'var(--bg, #FFFFFF)' }}>
                        <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: 'var(--t2, #6E665D)', fontFamily: 'var(--font-primary)' }}>Select a variation set</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                          {variationSets.map((os) => (
                            <button
                              key={os.id}
                              type="button"
                              onClick={() => {
                                setForm((prev) => {
                                  const existing = new Set(prev.variations.map((x) => x.name));
                                  const add = os.options.filter((o) => !existing.has(o.name)).map((o, i) => ({
                                    id: `var-os-${Date.now()}-${i}`,
                                    name: o.name,
                                    price: o.price ?? 0,
                                  }));
                                  return { ...prev, variations: [...prev.variations, ...add] };
                                });
                                setShowVariationSetPicker(false);
                              }}
                              style={{ textAlign: 'left', padding: 12, borderRadius: 2, border: '1px solid var(--card-border, #E6DFD3)', background: 'var(--surface, #FFFFFF)', cursor: 'pointer', fontFamily: 'var(--font-primary)' }}
                            >
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1, #453F39)' }}>{os.name}</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                {os.options.map((o) => (
                                  <span key={o.id} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#F4F0E8', color: 'var(--t2, #6E665D)' }}>{o.name}</span>
                                ))}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div> */}
            </div>

            {form.itemType === 'prepared_food_beverage' && (
              <div id="item-field-kitchen" style={mobileWhiteCard}>
                <h2 style={S.cardTitle}>Kitchen details</h2>
                <p style={S.cardSubtitle}>Configure kitchen routing, prep time, and KOT settings for this item.</p>
                <div style={{ marginTop: 4 }}>
                  <ItemAssignmentSection
                    title="Kitchen stations"
                    titleCountBadge={dedupeKitchenIds(form.kitchenStationSelectedIds).length > 0 ? String(dedupeKitchenIds(form.kitchenStationSelectedIds).length) : undefined}
                    icon="restaurant"
                    items={kitchenStationItemsForAssignment}
                    selectedIds={form.kitchenStationSelectedIds}
                    selectedItems={kitchenStationAssignmentPills}
                    onToggle={toggleKitchenStation}
                    onRemove={(stationId) => {
                      setForm((prev) => ({
                        ...prev,
                        kitchenStationSelectedIds: prev.kitchenStationSelectedIds.filter((x) => x !== stationId),
                      }));
                    }}
                    collapsible={false}
                    searchPlaceholder="Search kitchen stations..."
                    emptyLabel="No kitchen stations selected yet."
                    addButtonLabel="Add kitchen stations"
                    persistedSelectedIds={initialKitchenStationIdsRef.current}
                    noResultsLabel="No stations match your search."
                  />
                </div>

                <div id="item-field-kitchen-print" style={{ marginTop: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--t2, #6E665D)', display: 'block', marginBottom: 8, fontFamily: 'var(--font-primary)' }}>
                    Print to kitchen for
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => patch('kitchenPrintMode', 'all')}
                      style={{
                        padding: '6px 14px', borderRadius: 2, fontSize: 12, fontWeight: 600,
                        border: form.kitchenPrintMode === 'all' ? '1.5px solid var(--accent, #B89550)' : '1px solid #E6DFD3',
                        background: form.kitchenPrintMode === 'all' ? 'rgba(184,149,80,0.06)' : '#fff',
                        color: form.kitchenPrintMode === 'all' ? 'var(--accent, #B89550)' : 'var(--t2, #6E665D)',
                        cursor: 'pointer', fontFamily: 'var(--font-primary)',
                      }}
                    >
                      Follow outlet default (All order types)
                    </button>
                    <button
                      type="button"
                      onClick={() => patch('kitchenPrintMode', 'selected')}
                      style={{
                        padding: '6px 14px', borderRadius: 2, fontSize: 12, fontWeight: 600,
                        border: form.kitchenPrintMode === 'selected' ? '1.5px solid var(--accent, #B89550)' : '1px solid #E6DFD3',
                        background: form.kitchenPrintMode === 'selected' ? 'rgba(184,149,80,0.06)' : '#fff',
                        color: form.kitchenPrintMode === 'selected' ? 'var(--accent, #B89550)' : 'var(--t2, #6E665D)',
                        cursor: 'pointer', fontFamily: 'var(--font-primary)',
                      }}
                    >
                      Custom order types
                    </button>
                  </div>
                  {form.kitchenPrintMode === 'selected' && (
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {kitchenPrintRows.map((row) => {
                        // Every order type is checked (prints) by default. Unchecking one adds it
                        // to the excluded list — all others stay checked/selected.
                        const isExcluded = form.kitchenPrintExcludedOrderTypeIds.includes(row.orderTypeId);
                        const on = !isExcluded;
                        return (
                          <button
                            key={row.orderTypeId}
                            type="button"
                            onClick={() => {
                              const next = isExcluded
                                ? form.kitchenPrintExcludedOrderTypeIds.filter((id) => id !== row.orderTypeId)
                                : [...form.kitchenPrintExcludedOrderTypeIds, row.orderTypeId];
                              patch('kitchenPrintExcludedOrderTypeIds', next);
                            }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                              border: on ? '1.5px solid var(--accent, #B89550)' : '1px solid #E6DFD3',
                              background: on ? 'rgba(184,149,80,0.06)' : '#fff',
                              color: on ? 'var(--accent, #B89550)' : 'var(--t2, #6E665D)',
                              cursor: 'pointer', fontFamily: 'var(--font-primary)',
                            }}
                          >
                            {on && <span className="material-symbols-rounded" style={{ fontSize: 14 }}>check</span>}
                            {row.label}
                            {/delivery/i.test(row.label) && ' (incl. third-party)'}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {displayErrors.kitchenPrintOrderTypes && (
                    <p style={{ color: 'var(--red)', fontSize: 11, marginTop: 8, fontFamily: 'var(--font-primary)' }}>
                      {displayErrors.kitchenPrintOrderTypes}
                    </p>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginTop: 16 }}>
                  {/* <TextField
                    label="Kitchen item name"
                    value={form.kitchenName}
                    onChange={(v) => patch('kitchenName', v)}
                    placeholder="Same as item name if blank"
                    maxLength={30}
                  /> */}
                  <Select
                    label="Prep time"
                    value={String(form.prepTime)}
                    onChange={(v) => patch('prepTime', v === '' ? '' : Number(v))}
                    options={PREP_TIMES.map((t) => ({ value: String(t), label: `${t} min` }))}
                  />
                </div>
                {/* PCF-1: Master KOT toggle */}
                <div style={{ marginTop: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--t2, #6E665D)', display: 'block', marginBottom: 8, fontFamily: 'var(--font-primary)' }}>
                    Print in Master KOT
                  </label>
                  {/* <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['all', 'none', 'selected'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          patch('masterKotMode', mode);
                          if (mode !== 'selected') patch('masterKotOrderTypes', []);
                        }}
                        style={{
                          padding: '6px 14px', borderRadius: 2, fontSize: 12, fontWeight: 600,
                          border: form.masterKotMode === mode ? '1.5px solid var(--accent, #B89550)' : '1px solid #E6DFD3',
                          background: form.masterKotMode === mode ? 'rgba(184,149,80,0.06)' : '#fff',
                          color: form.masterKotMode === mode ? 'var(--accent, #B89550)' : 'var(--t2, #6E665D)',
                          cursor: 'pointer', fontFamily: 'var(--font-primary)',
                        }}
                      >
                        {mode === 'all' ? 'All Order Types' : mode === 'none' ? 'No Order Types' : 'Selected Order Types'}
                      </button>
                    ))}
                  </div>
                  {form.masterKotMode === 'selected' && (
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {pricingOrderTypeRows.map((row) => (
                        <label key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-primary)' }}>
                          <input
                            type="checkbox"
                            checked={form.masterKotOrderTypes.includes(row.key)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...form.masterKotOrderTypes, row.key]
                                : form.masterKotOrderTypes.filter((t) => t !== row.key);
                              patch('masterKotOrderTypes', next);
                            }}
                            style={{ accentColor: 'var(--accent, #B89550)', width: 14, height: 14 }}
                          />
                          {row.label}
                        </label>
                      ))}
                    </div>
                  )} */}

                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--t1, #453F39)', fontFamily: 'var(--font-primary)' }}>
                    <input
                      type="checkbox"
                      checked={form.masterKot}
                      onChange={(e) => patch('masterKot', e.target.checked)}
                      style={{ accentColor: 'var(--accent, #B89550)', width: 14, height: 14 }}
                    />
                    Don't print the item in Master KOT
                  </label>
                </div>
              </div>
            )}

            {/* PCF-2: Inventory Tracking — hidden for weight-based units */}
            {form.soldBy !== 'weight' && <div style={mobileWhiteCard}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#5E8C7B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, fontFamily: 'var(--font-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#5E8C7B' }}>inventory_2</span>
                Inventory & Availability
              </div>
              <p style={{ fontSize: 11, color: 'var(--t3, #9A9084)', margin: '0 0 10px', fontFamily: 'var(--font-primary)', lineHeight: 1.5, paddingLeft: 10, borderLeft: '2px solid rgba(13,148,136,0.2)' }}>
                Use quantity tracking to control this item&apos;s stock availability.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-primary)', color: 'var(--t1)' }}>Track Inventory</span>
                <Toggle checked={form.inventoryEnabled} onChange={(c) => patch('inventoryEnabled', c)} />
              </div>

              {form.inventoryEnabled && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div style={{ pointerEvents: 'none' }}>
                      <TextField
                        label="Unit Type"
                        value={String(form.unitOfMeasure || 'Each')}
                        onChange={() => {}}
                      />
                    </div>
                    <TextField
                      label={form.inventoryStockResetMode === 'auto_reset' ? 'Default Stock Quantity *' : 'Default Stock Quantity'}
                      value={form.defaultStockQuantity}
                      onChange={(v) => {
                        const allowDecimal = form.soldBy !== 'each';
                        const max = allowDecimal ? 9999.999 : 9999;
                        const normalized = normalizeInventoryDecimalInput(v, allowDecimal);
                        const pattern = allowDecimal ? /^\d*(\.\d{0,3})?$/ : /^\d*$/;
                        if (pattern.test(normalized) && (normalized === '' || Number(normalized) <= max)) patch('defaultStockQuantity', normalized);
                      }}
                      placeholder={form.inventoryStockResetMode === 'auto_reset' ? '' : 'Optional'}
                      error={displayErrors.defaultStockQuantity}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <TextField
                      label="Current Stock"
                      value={form.currentStock}
                      onChange={(v) => {
                        const allowDecimal = form.soldBy !== 'each';
                        const max = allowDecimal ? 9999.999 : 9999;
                        const normalized = normalizeInventoryDecimalInput(v, allowDecimal);
                        const pattern = allowDecimal ? /^\d*(\.\d{0,3})?$/ : /^\d*$/;
                        if (pattern.test(normalized) && (normalized === '' || Number(normalized) <= max)) patch('currentStock', normalized);
                      }}
                      placeholder="0"
                      error={displayErrors.currentStock}
                    />
                    <TextField
                      label="Low Stock Alert"
                      value={form.lowStockThreshold}
                      onChange={(v) => {
                        const allowDecimal = form.soldBy !== 'each';
                        const max = allowDecimal ? 9999.999 : 9999;
                        const normalized = normalizeInventoryDecimalInput(v, allowDecimal);
                        const pattern = allowDecimal ? /^\d*(\.\d{0,3})?$/ : /^\d*$/;
                        if (pattern.test(normalized) && (normalized === '' || Number(normalized) <= max)) patch('lowStockThreshold', normalized);
                      }}
                      placeholder="Optional"
                      error={displayErrors.lowStockThreshold}
                    />
                  </div>
                  <div>
                    <Select
                      label="Stock Reset Behavior"
                      value={form.inventoryStockResetMode}
                      onChange={(v) => {
                        const next =
                          v === 'auto_reset' || v === 'clear_stocks' || v === 'carry_forward'
                            ? v
                            : 'carry_forward';
                        patch('inventoryStockResetMode', next);
                      }}
                      options={[
                        { value: 'auto_reset', label: 'Auto reset to default' },
                        { value: 'clear_stocks', label: 'Clear stocks daily' },
                        { value: 'carry_forward', label: 'No reset (carry forward)' },
                      ]}
                    />
                    <p
                      style={{
                        fontSize: 11,
                        color: 'var(--t3, #9A9084)',
                        marginTop: 6,
                        marginBottom: 0,
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      {stockResetHelperText(form.inventoryStockResetMode, form.defaultStockQuantity)}
                    </p>
                  </div>
                </>
              )}
            </div>}

            <div style={{ ...mobileWhiteCard, padding: 0, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: isMobile ? 16 : 24,
                  border: 'none',
                  background: 'var(--surface, #FFFFFF)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                <div>
                  <h2 style={{ ...S.cardTitle, marginBottom: 4 }}>Advanced options <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--t3, #9A9084)' }}>(optional)</span></h2>
                  <p style={{ fontSize: 11, color: 'var(--t2, #6E665D)', margin: 0 }}>Images, modifiers, allergens, sessions, and more</p>
                </div>
                <span className="material-symbols-rounded" style={{ fontSize: 22, color: 'var(--t3, #9A9084)', transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>expand_more</span>
              </button>
              {showAdvanced && (
                <div style={{ borderTop: '1px solid var(--card-border, #E6DFD3)', padding: isMobile ? 16 : 24, display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 24 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, fontFamily: 'var(--font-primary)' }}>Additional images</div>
                    <div
                      style={
                        isMobile
                          ? {
                              display: 'flex',
                              gap: 8,
                              overflowX: 'auto',
                              paddingBottom: 2,
                            }
                          : {
                              display: 'grid',
                              gridTemplateColumns: 'repeat(5, 1fr)',
                              gap: 8,
                              maxWidth: 400,
                            }
                      }
                    >
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          style={{
                            position: 'relative',
                            aspectRatio: '1',
                            width: isMobile ? 70 : undefined,
                            minWidth: isMobile ? 70 : undefined,
                            flexShrink: isMobile ? 0 : undefined,
                          }}
                        >
                          <input
                            ref={(el) => { additionalImageInputRefs.current[i] = el; }}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg"
                            onChange={(e) => handleAdditionalImageSelect(i, e)}
                            style={{ display: 'none' }}
                          />
                          {additionalImagePreviews[i] ? (
                            <>
                              <img
                                src={additionalImagePreviews[i] ?? ''}
                                alt={`Additional ${i + 1}`}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  borderRadius: 2,
                                  border: '1px solid var(--card-border, #E6DFD3)',
                                }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 4,
                                  right: 4,
                                  display: 'flex',
                                  flexDirection: isMobile ? 'column' : 'row',
                                  gap: 4,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => additionalImageInputRefs.current[i]?.click()}
                                  style={{
                                    width: isMobile ? 20 : 24,
                                    height: isMobile ? 20 : 24,
                                    borderRadius: 2,
                                    border: '1px solid rgba(255,255,255,0.8)',
                                    background: 'rgba(17,24,39,0.5)',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                  title="Replace image"
                                >
                                  <span className="material-symbols-rounded" style={{ fontSize: isMobile ? 12 : 14 }}>edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAdditionalImage(i)}
                                  style={{
                                    width: isMobile ? 20 : 24,
                                    height: isMobile ? 20 : 24,
                                    borderRadius: 2,
                                    border: '1px solid rgba(255,255,255,0.8)',
                                    background: 'rgba(166,61,47,0.65)',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                  title="Remove image"
                                >
                                  <span className="material-symbols-rounded" style={{ fontSize: isMobile ? 12 : 14 }}>delete</span>
                                </button>
                              </div>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => additionalImageInputRefs.current[i]?.click()}
                              style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: 2,
                                border: '2px dashed var(--card-border, #E6DFD3)',
                                background: 'var(--bg, #FFFFFF)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                              title="Add image"
                            >
                              <span className="material-symbols-rounded" style={{ color: 'var(--t3, #9A9084)', fontSize: isMobile ? 24 : 28 }}>add</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--t3, #9A9084)', marginTop: 8, fontFamily: 'var(--font-primary)' }}>Up to 5 additional images</p>
                  </div>
                  {form.itemType === 'prepared_food_beverage' && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, fontFamily: 'var(--font-primary)' }}>Alcohol & age restriction</div>
                      <Toggle checked={form.containsAlcohol} onChange={(c) => patch('containsAlcohol', c)} label="Contains alcohol" />
                      <div style={{ marginTop: 12 }}>
                        <Toggle checked={form.isAgeRestricted} onChange={(c) => {
                          patch('isAgeRestricted', c);
                          if (c && form.containsAlcohol) patch('minAge', 18);
                        }} label="Age restricted" />
                      </div>
                      {form.isAgeRestricted && (() => {
                        const PRESET_AGES = [16, 18, 21, 25];
                        const mergedAgeSet = new Set<number>([...PRESET_AGES, ...locationCustomAges]);
                        if (form.minAge > 0 && form.minAge <= 99) mergedAgeSet.add(form.minAge);
                        const ageOptions = Array.from(mergedAgeSet)
                          .filter((n) => n >= 1 && n <= 99)
                          .sort((a, b) => a - b);

                        const parsedInputAge = (() => {
                          const raw = customAgeInput.trim();
                          if (!raw) return null;
                          const n = Math.floor(Number(raw));
                          if (!Number.isInteger(n) || n < 1 || n > 99) return null;
                          return n;
                        })();
                        const isDuplicateInput =
                          parsedInputAge !== null &&
                          (locationCustomAges.includes(parsedInputAge) || PRESET_AGES.includes(parsedInputAge));

                        const inlineAddError =
                          customAgeError
                          ?? (customAgeInput.trim() !== '' && parsedInputAge === null
                            ? 'Enter a valid age (1–99)'
                            : isDuplicateInput && !customAgeBusy
                            ? 'Already in list'
                            : null);

                        const canSubmitAdd =
                          parsedInputAge !== null && !isDuplicateInput && !customAgeBusy;

                        const triggerLabel = form.minAge > 0
                          ? `${form.minAge}+`
                          : 'Select age';

                        const submitCustomAge = async () => {
                          // Clear any sticky error from a previous attempt up front, so
                          // every click is evaluated against the current input + current
                          // location list. Validation below re-sets it if needed.
                          setCustomAgeError(null);

                          const raw = customAgeInput.trim();
                          if (!raw) {
                            setCustomAgeError('Enter an age');
                            return;
                          }
                          const n = Math.floor(Number(raw));
                          if (!Number.isInteger(n) || n < 1 || n > 99) {
                            setCustomAgeError('Enter a whole number 1–99');
                            return;
                          }
                          // Snapshot the current persisted list at the moment of click.
                          const currentList = Array.isArray(locationCustomAges)
                            ? locationCustomAges
                            : [];
                          if (currentList.includes(n) || PRESET_AGES.includes(n)) {
                            // Already exists — select it instead of erroring.
                            patch('minAge', n);
                            setCustomAgeInput('');
                            return;
                          }
                          setCustomAgeBusy(true);
                          try {
                            const result = await addLocationAge(n);
                            if (!result.ok) {
                              setCustomAgeError(result.message ?? 'Failed to add age');
                              return;
                            }
                            // Re-read the canonical list from the server so the
                            // dropdown reflects exactly what's persisted.
                            await refetchLocationAges();
                            patch('minAge', n);
                            setCustomAgeInput('');
                          } finally {
                            setCustomAgeBusy(false);
                          }
                        };

                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                            <Select
                              label="Minimum Age"
                              value={ageOptions.includes(form.minAge) ? String(form.minAge) : ''}
                              triggerLabel={triggerLabel}
                              onChange={(v) => {
                                patch('minAge', Number(v));
                                setCustomAgeInput('');
                                setCustomAgeError(null);
                              }}
                              options={ageOptions.map((a) => ({ value: String(a), label: `${a}+` }))}
                              scrollToValue={isDuplicateInput && parsedInputAge !== null ? String(parsedInputAge) : undefined}
                              highlightValue={isDuplicateInput && parsedInputAge !== null ? String(parsedInputAge) : undefined}
                              topSlot={
                                <div onMouseDown={(e) => e.stopPropagation()}>
                                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--t3, #9A9084)', marginBottom: 4, fontFamily: 'var(--font-primary, Jost, sans-serif)' }}>
                                    Add custom age
                                  </div>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                                    <div className="age-spinner-wrapper">
                                    <input
                                      type="number"
                                      className={`age-custom-input${inlineAddError ? ' age-custom-input--error' : ''}`}
                                      min={1}
                                      max={99}
                                      maxLength={2}
                                      inputMode="numeric"
                                      placeholder="1–99"
                                      value={customAgeInput}
                                      disabled={customAgeBusy}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        // Strip non-digits + cap to 2 chars (max is 99).
                                        const digitsOnly = raw.replace(/[^0-9]/g, '').slice(0, 2);
                                        setCustomAgeInput(digitsOnly);
                                        if (customAgeError) setCustomAgeError(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault();
                                        if (
                                          /^\d$/.test(e.key) &&
                                          !e.metaKey &&
                                          !e.ctrlKey &&
                                          !e.altKey &&
                                          customAgeInput.length >= 2 &&
                                          (e.currentTarget as HTMLInputElement).selectionStart ===
                                            (e.currentTarget as HTMLInputElement).selectionEnd
                                        ) {
                                          e.preventDefault();
                                        }
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          if (canSubmitAdd) void submitCustomAge();
                                        }
                                      }}
                                    />
                                    <div className="age-spinner-btns">
                                      <button
                                        type="button"
                                        tabIndex={-1}
                                        onMouseDown={(e) => e.preventDefault()}
                                        disabled={parsedInputAge === null || parsedInputAge >= 99 || customAgeBusy}
                                        className="age-spinner-btn age-spinner-btn--up"
                                        onClick={() => {
                                          if (parsedInputAge !== null && parsedInputAge < 99) {
                                            setCustomAgeInput(String(parsedInputAge + 1));
                                            if (customAgeError) setCustomAgeError(null);
                                          }
                                        }}
                                      >
                                        <span className="material-symbols-rounded">arrow_drop_up</span>
                                      </button>
                                      <button
                                        type="button"
                                        tabIndex={-1}
                                        onMouseDown={(e) => e.preventDefault()}
                                        disabled={parsedInputAge === null || parsedInputAge <= 1 || customAgeBusy}
                                        className="age-spinner-btn"
                                        onClick={() => {
                                          if (parsedInputAge !== null && parsedInputAge > 1) {
                                            setCustomAgeInput(String(parsedInputAge - 1));
                                            if (customAgeError) setCustomAgeError(null);
                                          }
                                        }}
                                      >
                                        <span className="material-symbols-rounded">arrow_drop_down</span>
                                      </button>
                                    </div>
                                    </div>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => void submitCustomAge()}
                                      disabled={!canSubmitAdd}
                                      title={isDuplicateInput && !customAgeBusy ? 'Select existing age' : 'Add custom age'}
                                      aria-label="Add custom age"
                                      style={{
                                        flexShrink: 0,
                                        width: 36,
                                        height: 36,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 18,
                                        fontWeight: 600,
                                        fontFamily: 'var(--font-primary, Jost, sans-serif)',
                                        color: '#fff',
                                        background: !canSubmitAdd ? 'var(--t3, #9A9084)' : 'var(--accent, #B89550)',
                                        border: 'none',
                                        borderRadius: 2,
                                        cursor: !canSubmitAdd ? 'not-allowed' : 'pointer',
                                        opacity: !canSubmitAdd ? 0.7 : 1,
                                      }}
                                    >
                                      {customAgeBusy ? (
                                        '…'
                                      ) : (
                                        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add</span>
                                      )}
                                    </button>
                                  </div>
                                  {inlineAddError && (
                                    <div style={{ fontSize: 11, color: 'var(--red, #A63D2F)', marginTop: 4, fontFamily: 'var(--font-primary, Jost, sans-serif)' }}>
                                      {inlineAddError}
                                    </div>
                                  )}
                                </div>
                              }
                            />
                          </div>
                        );
                      })()}
                      <div style={{ marginTop: 12 }}>
                        {(() => {
                          const taxChipOptions = TAX_OPTIONS.map((o) => ({ id: o.value, name: o.label }));
                          const selectedTaxChips = form.taxIds
                            .map((id) => {
                              const match = taxChipOptions.find((o) => o.id === id);
                              return match ?? { id, name: id };
                            });
                          return (
                            <ChipSelectList
                              label="Tax configuration"
                              options={taxChipOptions}
                              selected={selectedTaxChips}
                              onChange={(next) => {
                                const ids = Array.from(new Set(next.map((n) => n.id).filter(Boolean)));
                                patch('taxIds', ids);
                              }}
                              emptyText={hasTaxOptions ? undefined : 'No taxes available'}
                              marginTop={0}
                              searchable
                              searchPlaceholder="Search taxes..."
                            />
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  {/* ── Catering ─────────────────────────────── */}
                  {isStoreCateringEnabled && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: form.cateringEnabled ? 16 : 0 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-primary)' }}>Catering</div>
                        <p style={{ fontSize: 11, color: 'var(--t3, #9A9084)', margin: '4px 0 0', fontFamily: 'var(--font-primary)' }}>
                          Sell this item in catering.
                        </p>
                      </div>
                      <Toggle
                        checked={form.cateringEnabled}
                        onChange={(c) => patch('cateringEnabled', c)}
                        label="Enable for catering"
                      />
                    </div>

                    {form.cateringEnabled && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, borderTop: '1px dashed var(--card-border, #E6DFD3)' }}>
                        {/* Serves per unit */}
                        <div style={{ maxWidth: 280 }}>
                          <NumberField
                            label="Serves (per unit)"
                            value={form.cateringServesCount}
                            onChange={(v) => patch('cateringServesCount', v === '' ? '' : Number(v))}
                            min={1}
                            step={1}
                            integer
                          />
                          <p style={{ fontSize: 10, color: 'var(--t3, #9A9084)', margin: '4px 0 0', fontFamily: 'var(--font-primary)' }}>
                            1 = per-person · higher = one unit feeds this many.
                          </p>
                        </div>

                        {/* Bulk tray sizes — truly optional */}
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2, #6E665D)', marginBottom: 8, fontFamily: 'var(--font-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Bulk Tray Sizes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--t3, #9A9084)' }}>(optional)</span>
                          </div>
                          <p style={{ fontSize: 11, color: 'var(--t3, #9A9084)', margin: '0 0 10px', fontFamily: 'var(--font-primary)' }}>
                            Offer trays at bulk sizes and prices. Customers can still order individual units at the Base price.
                          </p>

                          {form.cateringPricingTiers.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                              {form.cateringPricingTiers.map((tier, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? '1fr auto' : '1fr 120px 130px auto',
                                    gridTemplateAreas: isMobile
                                      ? `"label delete" "size size" "price price"`
                                      : `"label size price delete"`,
                                    columnGap: 10,
                                    rowGap: 8,
                                    alignItems: 'flex-start',
                                  }}
                                >
                                  <div style={{ gridArea: 'label' }}>
                                    <TextField
                                      label="Label"
                                      value={tier.label ?? ''}
                                      onChange={(v) => {
                                        setForm((prev) => {
                                          const next = [...prev.cateringPricingTiers];
                                          next[idx] = { ...next[idx], label: v };
                                          return { ...prev, cateringPricingTiers: next };
                                        });
                                      }}
                                      placeholder="e.g. Small, Medium, Large"
                                      maxLength={60}
                                      hideCounter
                                      error={displayErrors[`cateringTray_${idx}_label`]}
                                    />
                                  </div>
                                  <div style={{ gridArea: 'size' }}>
                                    <NumberField
                                      label="Size (serves)"
                                      value={tier.servesCount ?? ''}
                                      onChange={(v) => {
                                        setForm((prev) => {
                                          const next = [...prev.cateringPricingTiers];
                                          next[idx] = {
                                            ...next[idx],
                                            servesCount: v === '' ? undefined : Number(v),
                                          };
                                          return { ...prev, cateringPricingTiers: next };
                                        });
                                      }}
                                      min={1}
                                      step={1}
                                      integer
                                      error={displayErrors[`cateringTray_${idx}_size`]}
                                    />
                                  </div>
                                  <div style={{ gridArea: 'price' }}>
                                    <NumberField
                                      label="Price"
                                      value={tier.price ?? ''}
                                      onChange={(v) => {
                                        setForm((prev) => {
                                          const next = [...prev.cateringPricingTiers];
                                          next[idx] = {
                                            ...next[idx],
                                            price: v === '' ? 0 : Number(v),
                                          };
                                          return { ...prev, cateringPricingTiers: next };
                                        });
                                      }}
                                      min={0}
                                      step={0.01}
                                      prefix="$"
                                      priceFormat
                                      error={displayErrors[`cateringTray_${idx}_price`]}
                                    />
                                  </div>
                                  <div style={{ gridArea: 'delete', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', marginTop: 22 }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setForm((prev) => ({
                                          ...prev,
                                          cateringPricingTiers: prev.cateringPricingTiers.filter((_, i) => i !== idx),
                                        }));
                                      }}
                                      title="Remove tray size"
                                      style={{
                                        height: 36,
                                        width: 36,
                                        borderRadius: 2,
                                        border: '1px solid var(--card-border, #E6DFD3)',
                                        background: 'var(--surface, #FFFFFF)',
                                        color: 'var(--red, #A63D2F)',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>delete</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setForm((prev) => ({
                                ...prev,
                                cateringPricingTiers: [
                                  ...prev.cateringPricingTiers,
                                  { servesCount: undefined, price: 0 },
                                ],
                              }));
                            }}
                            style={{ ...S.addCatBtn }}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>add</span>
                            Add Tray Size
                          </button>
                        </div>

                        {/* Min / Max order qty — temporarily hidden
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '160px 160px', gap: 12 }}>
                          <NumberField
                            label="Min order qty"
                            value={form.cateringMinOrderQty}
                            onChange={(v) => patch('cateringMinOrderQty', v === '' ? '' : Number(v))}
                            min={0}
                            step={1}
                            integer
                          />
                          <NumberField
                            label="Max order qty"
                            value={form.cateringMaxOrderQty}
                            onChange={(v) => patch('cateringMaxOrderQty', v === '' ? '' : Number(v))}
                            min={0}
                            step={1}
                            integer
                          />
                        </div>
                        */}

                        {/* Catering tax rate — temporarily hidden; catering uses the item's regular (item-level) tax.
                        <div style={{ maxWidth: 280 }}>
                          <Select
                            label="Catering tax rate (optional)"
                            value={form.cateringTaxRateId}
                            onChange={(v) => patch('cateringTaxRateId', v)}
                            options={[
                              { value: '', label: 'Use item default tax' },
                              ...cateringTaxOptions,
                            ]}
                            placeholder="Use item default tax"
                          />
                          <p style={{ fontSize: 10, color: 'var(--t3, #9A9084)', margin: '4px 0 0', fontFamily: 'var(--font-primary)' }}>
                            Leave blank to use the item's regular tax.
                          </p>
                        </div>
                        */}
                      </div>
                    )}
                  </div>
                  )}
                  {/* ── End Catering ─────────────────────────── */}
                  <div style={{ marginTop: 12 }}>
                    <ItemAssignmentSection
                      title="Modifiers"
                      titleCountBadge={`${form.modifierIds.length}/${MAX_MODIFIERS}`}
                      icon="tune"
                      items={modifierItemsForAssignment}
                      selectedIds={form.modifierIds}
                      selectedItems={modifierAssignmentPills}
                      onToggle={toggleModifier}
                      onRemove={(id) => {
                        setForm((prev) => ({ ...prev, modifierIds: prev.modifierIds.filter((x) => x !== id) }));
                      }}
                      onReorder={(ids) => setForm((prev) => ({ ...prev, modifierIds: ids }))}
                      collapsible={false}
                      searchPlaceholder="Search modifiers..."
                      emptyLabel="No modifiers selected yet."
                      addButtonLabel="Add modifiers"
                      persistedSelectedIds={initialModifierIdsRef.current}
                      noResultsLabel="No modifiers match your search."
                      maxSelections={MAX_MODIFIERS}
                    />
                  </div>
                  {form.itemType !== 'prepared_food_beverage' && (
                    <div id="item-field-kitchen">
                      <ItemAssignmentSection
                        title="Kitchen stations"
                        titleCountBadge={dedupeKitchenIds(form.kitchenStationSelectedIds).length > 0 ? String(dedupeKitchenIds(form.kitchenStationSelectedIds).length) : undefined}
                        icon="restaurant"
                        items={kitchenStationItemsForAssignment}
                        selectedIds={form.kitchenStationSelectedIds}
                        selectedItems={kitchenStationAssignmentPills}
                        onToggle={toggleKitchenStation}
                        onRemove={(stationId) => {
                          setForm((prev) => ({
                            ...prev,
                            kitchenStationSelectedIds: prev.kitchenStationSelectedIds.filter((x) => x !== stationId),
                          }));
                        }}
                        collapsible={false}
                        searchPlaceholder="Search kitchen stations..."
                        emptyLabel="No kitchen stations selected yet."
                        addButtonLabel="Add kitchen stations"
                        persistedSelectedIds={initialKitchenStationIdsRef.current}
                        noResultsLabel="No stations match your search."
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginTop: 16 }}>
                        <Select
                          label="Prep time"
                          value={String(form.prepTime)}
                          onChange={(v) => patch('prepTime', v === '' ? '' : Number(v))}
                          options={PREP_TIMES.map((t) => ({ value: String(t), label: `${t} min` }))}
                        />
                      </div>
                    </div>
                  )}
                  <div
                    id="item-field-sessions"
                    style={{
                      padding: displayErrors.sessionIds ? '12px 12px 10px' : undefined,
                      borderRadius: 2,
                      border: displayErrors.sessionIds ? '1px solid rgba(166,61,47, 0.45)' : undefined,
                      background: displayErrors.sessionIds ? 'rgba(166,61,47, 0.04)' : undefined,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, fontFamily: 'var(--font-primary)' }}>Sessions & availability</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-primary)', marginBottom: 12 }}>
                      <input
                        type="checkbox"
                        checked={form.useDefaultSession}
                        onChange={(e) => {
                          patch('useDefaultSession', e.target.checked);
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.sessionIds;
                            return next;
                          });
                        }}
                        style={{ accentColor: 'var(--accent, #B89550)', width: 16, height: 16 }}
                      />
                      Default "All Day" session selected
                    </label>
                    {form.useDefaultSession ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 2, background: 'rgba(95,122,85,0.08)', border: '1px solid rgba(95,122,85,0.2)', marginBottom: 12 }}>
                        <span className="material-symbols-rounded" style={{ color: '#5F7A55', fontSize: 20 }}>check_circle</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#5F7A55', fontFamily: 'var(--font-primary)' }}>Default "All Day" session auto-assigned</span>
                      </div>
                    ) : (
                      <div style={{ marginBottom: 12 }}>
                        <ItemAssignmentSection
                          title="Sessions"
                          icon="schedule"
                          description={sessions.length === 0 ? 'Create sessions under Product Catalog > Sessions, then assign them here.' : undefined}
                          items={sessionItemsForAssignment}
                          selectedIds={form.sessionIds}
                          selectedItems={sessionAssignmentPills}
                          onToggle={toggleSession}
                          onRemove={(id) => {
                            setForm((prev) => ({ ...prev, sessionIds: prev.sessionIds.filter((x) => x !== id) }));
                            setErrors((prev) => {
                              const next = { ...prev };
                              delete next.sessionIds;
                              return next;
                            });
                          }}
                          collapsible={false}
                          searchPlaceholder="Search sessions..."
                          emptyLabel="No sessions assigned yet."
                          addButtonLabel="Add sessions"
                          persistedSelectedIds={initialSessionIdsRef.current}
                          noResultsLabel="No sessions match your search."
                        />
                      </div>
                    )}
                    {displayErrors.sessionIds && (
                      <p style={{ fontSize: 11, color: 'var(--red, #A63D2F)', margin: '6px 0 0', fontFamily: 'var(--font-primary)' }}>
                        {displayErrors.sessionIds}
                      </p>
                    )}
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--card-border, #E6DFD3)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-primary)' }}>
                        <input
                          type="checkbox"
                          checked={form.isSeasonal}
                          onChange={(e) => patch('isSeasonal', e.target.checked)}
                          style={{ accentColor: 'var(--accent, #B89550)', width: 16, height: 16 }}
                        />
                        Mark as seasonal item
                      </label>
                      {cloneSeasonalPastEndBanner && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: '12px 14px',
                            borderRadius: 2,
                            background: 'rgba(176,122,42,0.08)',
                            border: '1px solid rgba(176,122,42,0.35)',
                            fontSize: 12,
                            color: '#8A6D33',
                            fontFamily: 'var(--font-primary)',
                            lineHeight: 1.45,
                          }}
                        >
                          The seasonal end date ({form.seasonEnd}) has already passed. Update the dates or uncheck 'Seasonal Item' before saving.
                        </div>
                      )}
                      {form.isSeasonal && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            flexWrap: 'nowrap',
                            gap: isMobile ? 8 : 12,
                            marginTop: 12,
                            alignItems: 'flex-start',
                          }}
                        >
                          <div id="item-field-seasonStart" style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: isMobile ? 9 : 10,
                                color: 'var(--t3, #9A9084)',
                                marginBottom: isMobile ? 3 : 4,
                                fontFamily: 'var(--font-primary)',
                              }}
                            >
                              Start date
                            </div>
                            <CatalogDatePicker
                              value={form.seasonStart}
                              onChange={(iso) => {
                                patch('seasonStart', iso);
                                if (form.seasonEnd && iso && iso > form.seasonEnd) patch('seasonEnd', '');
                                setErrors((prev) => {
                                  const n = { ...prev };
                                  delete n.seasonStart;
                                  if (form.seasonEnd && iso && iso > form.seasonEnd) delete n.seasonEnd;
                                  return n;
                                });
                              }}
                              isMobile={isMobile}
                              minDate={todayIso}
                              zIndex={320}
                            />
                            {displayErrors.seasonStart && <p style={{ color: 'var(--red)', fontSize: 11, marginTop: 4 }}>{displayErrors.seasonStart}</p>}
                          </div>
                          <div id="item-field-seasonEnd" style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: isMobile ? 9 : 10,
                                color: 'var(--t3, #9A9084)',
                                marginBottom: isMobile ? 3 : 4,
                                fontFamily: 'var(--font-primary)',
                              }}
                            >
                              End date
                            </div>
                            <CatalogDatePicker
                              value={form.seasonEnd}
                              onChange={(iso) => { patch('seasonEnd', iso); setErrors((prev) => { const n = { ...prev }; delete n.seasonEnd; return n; }); }}
                              isMobile={isMobile}
                              minDate={seasonEndMinDate}
                              zIndex={320}
                            />
                            {displayErrors.seasonEnd && <p style={{ color: 'var(--red)', fontSize: 11, marginTop: 4 }}>{displayErrors.seasonEnd}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <ChipSelectList
                      label="Allergens"
                      options={allergenOptionsSorted}
                      selected={form.allergens}
                      onChange={(next) => patch('allergens', next)}
                      activeColor="#A63D2F"
                      activeBorder="1px solid rgba(166,61,47,0.35)"
                      activeBg="rgba(166,61,47,0.08)"
                      emptyText="No allergens configured"
                      marginTop={0}
                      searchable
                      allowCustom
                      customPlaceholder="Add allergen..."
                    />
                    <ChipSelectList
                      label="Dietary labels"
                      options={dietaryOptionsSorted}
                      selected={form.dietaryLabels}
                      onChange={(next) => patch('dietaryLabels', next)}
                      activeColor="#5F7A55"
                      activeBorder="1px solid rgba(95,122,85,0.35)"
                      activeBg="rgba(95,122,85,0.08)"
                      emptyText="No dietary labels configured"
                      searchable
                      allowCustom
                      customPlaceholder="Add dietary label..."
                    />
                    <ChipSelectList
                      label="Ingredients"
                      options={ingredientOptionsSorted}
                      selected={form.ingredients}
                      onChange={(next) => patch('ingredients', next)}
                      activeColor="#8A6D33"
                      activeBorder="1px solid rgba(184,149,80,0.45)"
                      activeBg="rgba(184,149,80,0.08)"
                      emptyText="No ingredients configured"
                      searchable
                      allowCustom
                      customPlaceholder="Add ingredient..."
                    />
                    <ChipSelectList
                      label="Tags"
                      options={tagOptionsSorted}
                      selected={form.tags}
                      onChange={(next) => patch('tags', toSingleTagSelection(next))}
                      activeColor="#B89550"
                      activeBorder="1px solid rgba(184,149,80,0.35)"
                      activeBg="rgba(184,149,80,0.08)"
                      emptyText="No tags configured"
                      searchable
                      allowCustom
                      customPlaceholder="Add tag..."
                    />
                    {/* Nutritional Information */}
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2, #6E665D)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '24px 0 10px', fontFamily: 'var(--font-primary)' }}>Nutritional Information</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr 1fr', gap: 12, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--t3, #9A9084)', marginBottom: 6, fontFamily: 'var(--font-primary)' }}>Basis</div>
                        <input
                          value={form.nutrition.basis ?? ''}
                          onChange={(e) => patch('nutrition', { ...form.nutrition, basis: e.target.value.slice(0, 30) })}
                          placeholder="e.g. per 100g"
                          maxLength={30}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 2, border: '1px solid var(--card-border, #E6DFD3)', fontSize: 12, fontFamily: 'var(--font-primary)', boxSizing: 'border-box' as const }}
                        />
                      </div>
                      {([
                        { key: 'calories', label: 'Calories', placeholder: 'kcal' },
                        { key: 'protein',  label: 'Protein (g)', placeholder: 'g' },
                        { key: 'carbs',    label: 'Carbs (g)', placeholder: 'g' },
                        { key: 'fat',      label: 'Fat (g)', placeholder: 'g' },
                      ] as const).map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <div style={{ fontSize: 10, color: 'var(--t3, #9A9084)', marginBottom: 6, fontFamily: 'var(--font-primary)' }}>{label}</div>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={form.nutrition[key] ?? ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === '') { patch('nutrition', { ...form.nutrition, [key]: undefined }); return; }
                              if (!/^\d{0,4}(\.\d{0,2})?$/.test(raw)) return;
                              patch('nutrition', { ...form.nutrition, [key]: raw.endsWith('.') ? raw as any : parseFloat(raw) });
                            }}
                            onBlur={(e) => {
                              const raw = e.target.value;
                              if (raw === '' || raw === '.') { patch('nutrition', { ...form.nutrition, [key]: undefined }); return; }
                              const num = parseFloat(raw);
                              if (!isNaN(num)) patch('nutrition', { ...form.nutrition, [key]: Math.round(num * 100) / 100 });
                            }}
                            placeholder={placeholder}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 2, border: '1px solid var(--card-border, #E6DFD3)', fontSize: 12, fontFamily: 'var(--font-primary)', boxSizing: 'border-box' as const }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* PCF-14: Half-and-Half Split */}
                    {/* <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2, #6E665D)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '16px 0 8px', fontFamily: 'var(--font-primary)' }}>Half-and-Half</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 2, border: '1px solid var(--card-border, #E6DFD3)', background: '#FDFCF9' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1, #453F39)', fontFamily: 'var(--font-primary)' }}>Allow Half-and-Half</div>
                        <div style={{ fontSize: 10, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)', marginTop: 2 }}>Customers can order two halves with independent toppings</div>
                      </div>
                      <Toggle checked={(form as any).allowSplit ?? false} onChange={(v) => patch('allowSplit' as any, v)} />
                    </div>
                    {(form as any).allowSplit && (
                      <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                        <Select
                          label="Split Pricing"
                          value={(form as any).splitPricingModel ?? 'higher'}
                          onChange={(v) => patch('splitPricingModel' as any, v)}
                          options={[
                            { value: 'higher', label: 'Higher price wins (industry standard)' },
                            { value: 'average', label: 'Average of both halves' },
                          ]}
                        />
                      </div>
                    )} */}

                    {/* Revenue Class */}
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2, #6E665D)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px', fontFamily: 'var(--font-primary)', lineHeight: 1.3 }}>Revenue Class</div>
                      <Select
                        label=""
                        value={form.revenueClassId}
                        onChange={(v) => {
                          const found = revenueClassOptions.find((r) => r.id === v);
                          patch('revenueClassId', v);
                          patch('revenueClass', found?.name ?? '');
                        }}
                        options={revenueClassOptions.map((r) => ({ value: r.id, label: r.name }))}
                        placeholder="Select revenue class"
                      />
                    </div>

                    {/* Unit of Measure — moved to Basic Information section */}

                    <div id="item-field-best-paired" style={{ marginTop: 20 }}>
                      <ItemAssignmentSection
                        title="Best paired"
                        titleCountBadge={`${form.bestPairedItemIds.length}/${BEST_PAIRED_MAX}`}
                        items={bestPairedPickerItems}
                        categories={categories}
                        selectedIds={form.bestPairedItemIds}
                        selectedItems={bestPairedItemsForPills}
                        onToggle={toggleBestPairedItem}
                        onRemove={removeBestPairedItem}
                        onReorder={(ids) => setForm((prev) => ({ ...prev, bestPairedItemIds: ids }))}
                        collapsible={false}
                        searchPlaceholder="Search items to pair..."
                        emptyLabel="No paired items yet."
                        addButtonLabel="Add items"
                        persistedSelectedIds={initialBestPairedItemIdsRef.current}
                      />
                      {displayErrors.bestPaired && (
                        <p style={{ fontSize: 11, color: 'var(--red, #A63D2F)', marginTop: 8, fontFamily: 'var(--font-primary)' }}>
                          {displayErrors.bestPaired}
                        </p>
                      )}
                    </div>

                    {/* Special Instructions */}
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2, #6E665D)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '20px 0 8px', fontFamily: 'var(--font-primary)' }}>Special Instructions</div>
                    <TextArea
                      label=""
                      value={form.specialInstructions}
                      onChange={(v) => patch('specialInstructions', v.slice(0, SPECIAL_INSTRUCTIONS_MAX))}
                      placeholder="Add any special notes or instructions for this item..."
                      counterWarnAfter={950}
                      maxLength={SPECIAL_INSTRUCTIONS_MAX}
                      rows={3}
                    />
                  </div>
                </div>
              )}
          </div>
        </div>

          <aside style={isMobile ? { width: '100%', order: -1, marginBottom: 16 } : S.rightRail} aria-label="Item preview">
            <div style={isMobile ? { ...S.previewCard, position: 'relative' as const } : S.previewCard}>
              <div style={{ ...S.previewImage, position: 'relative', overflow: 'hidden' }}>
                {previewImageSrc ? (
                  <img
                    src={previewImageSrc}
                    alt=""
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : null}
                {!previewImageSrc ? (
                  <span className="material-symbols-rounded" style={{ fontSize: 48, opacity: 0.5 }}>
                    image
                  </span>
                ) : null}
              </div>
              <div style={S.previewBody}>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: 'var(--t1, #453F39)',
                    fontFamily: 'var(--font-primary)',
                    lineHeight: 1.3,
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}
                >
                  {form.name.trim() || 'Item Name'}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    fontStyle: form.description.trim() ? 'normal' as const : 'italic',
                    color: form.description.trim() ? 'var(--t2, #6E665D)' : 'var(--t3, #9A9084)',
                    fontFamily: 'var(--font-primary)',
                    lineHeight: 1.45,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {form.description.trim() || 'No description yet'}
                </div>
                <div
                  style={{
                    marginTop: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap' as const,
                  }}
                >
                  <span
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: 'var(--t1, #453F39)',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    {form.itemType === 'event' && form.isFreeEvent ? (
                      <span style={{ color: '#5F7A55' }}>FREE</span>
                    ) : (
                      <>${priceStr}</>
                    )}
                  </span>
                  {/* <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: previewBadge.bg,
                      color: previewBadge.color,
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    {previewBadge.label}
                  </span> */}
                </div>
                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 14,
                    borderTop: '1px solid var(--card-border, #E6DFD3)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--t3, #9A9084)',
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.04em',
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      Completeness
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: mandatoryComplete ? '#5F7A55' : 'var(--t2, #6E665D)',
                        fontFamily: 'var(--font-primary)',
                        transition: 'color 0.2s ease',
                      }}
                    >
                      {completeness}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 999,
                      background: '#F1ECE2',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${completeness}%`,
                        borderRadius: 999,
                        backgroundColor: barColor,
                        transition: 'width 0.2s ease, background-color 0.2s ease',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: 'var(--t3, #9A9084)',
                      fontFamily: 'var(--font-primary)',
                      lineHeight: 1.4,
                    }}
                  >
                    {itemHint}
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 11,
                    color: 'var(--t3, #9A9084)',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  {codeLine}
                </div>
              </div>
            </div>
          </aside>
        </div>
        </div>

        <div style={isMobile ? { ...formStickyActionBarFooterStyle, position: 'fixed' as const, bottom: 0, left: 0, right: 0, zIndex: 100, padding: 16 } : formStickyActionBarFooterStyle}>
          <button type="button" style={formCancelButtonStyle} onClick={handleDiscardCancel}>
            Cancel
          </button>
          <button
            type="button"
            style={{ ...formSaveButtonStyle, minWidth: 132, opacity: saving || !canSave ? 0.5 : 1, cursor: !canSave ? 'not-allowed' : 'pointer' }}
            onClick={handleSave}
            disabled={saving || !canSave}
          >
            {saving ? saveLoadingLabel : saveIdleLabel}
          </button>
        </div>

        {showOptionSetPicker && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              background: 'rgba(15,23,42,0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setShowOptionSetPicker(false)}
          >
            <div
              style={{
                width: 'min(760px, 96vw)',
                maxHeight: '78vh',
                overflow: 'hidden',
                borderRadius: 2,
                border: '1px solid var(--card-border, #E6DFD3)',
                background: 'var(--surface, #FFFFFF)',
                boxShadow: '0 14px 34px rgba(15, 23, 42, 0.18)',
                display: 'flex',
                flexDirection: 'column',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--card-border, #E6DFD3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-primary)' }}>Select Option Set</div>
                <button type="button" onClick={() => setShowOptionSetPicker(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--t3, #9A9084)' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 20 }}>close</span>
                </button>
              </div>

              <div style={{ overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {optionSetsLoading ? (
                  <div style={{ padding: '10px 4px', fontSize: 12, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)' }}>
                    Loading option sets...
                  </div>
                ) : optionSets.length === 0 ? (
                  <div style={{ padding: '10px 4px', fontSize: 12, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)' }}>
                    No option sets found for this location.
                  </div>
                ) : (
                  optionSets.map((os) => {
                    const expanded = expandedOptionSetId === os.id;
                    return (
                      <div
                        key={os.id}
                        style={{
                          border: '1px solid var(--card-border, #E6DFD3)',
                          borderRadius: 2,
                          background: 'var(--surface, #FFFFFF)',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px' }}>
                          <button
                            type="button"
                            onClick={() => setExpandedOptionSetId((prev) => (prev === os.id ? null : os.id))}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--t3, #9A9084)', padding: 0, display: 'inline-flex' }}
                            aria-label={expanded ? 'Collapse options' : 'Expand options'}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
                              {expanded ? 'expand_more' : 'chevron_right'}
                            </span>
                          </button>
                          <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--t3, #9A9084)' }}>checklist</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1, #453F39)', fontFamily: 'var(--font-primary)' }}>{os.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)' }}>
                              {os.options.length} options
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setForm((prev) => {
                                const existing = new Set(prev.variations.map((x) => x.name.toLowerCase().trim()));
                                const add = os.options
                                  .filter((o) => !existing.has(o.name.toLowerCase().trim()))
                                  .map((o, i) => ({
                                    id: `var-os-${Date.now()}-${i}`,
                                    name: o.name,
                                    price: o.price ?? 0,
                                  }));
                                return { ...prev, variations: [...prev.variations, ...add] };
                              });
                              setShowOptionSetPicker(false);
                            }}
                            style={{ border: 'none', background: 'transparent', color: 'var(--accent, #B89550)', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                            aria-label={`Add ${os.name}`}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: 20 }}>add</span>
                          </button>
                        </div>
                        {expanded && (
                          <div style={{ borderTop: '1px solid var(--card-border, #E6DFD3)', background: '#FAFBFD', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {os.options.map((o) => (
                              <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                <span style={{ fontSize: 11, color: 'var(--t1, #453F39)', fontFamily: 'var(--font-primary)' }}>
                                  {o.name}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--t2, #6E665D)', fontFamily: 'var(--font-primary)', whiteSpace: 'nowrap' }}>
                                  ${Number(o.price ?? 0).toFixed(2)}
                                </span>
                              </div>
                            ))}
                            {os.options.length === 0 && (
                              <span style={{ fontSize: 11, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)' }}>
                                No options in this set.
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        <DeleteConfirmationModal
          open={pendingItemType !== null}
          onClose={() => setPendingItemType(null)}
          onConfirm={() => {
            if (pendingItemType) patch('itemType', pendingItemType);
            setPendingItemType(null);
          }}
          title="Change item type?"
          description="Some sections may move; your data is kept if you switch back."
          confirmLabel="Continue"
          cancelLabel="Cancel"
          confirmButtonVariant="primary"
        />
        <DeleteConfirmationModal
          open={removeVariationsOpen}
          onClose={() => setRemoveVariationsOpen(false)}
          onConfirm={() => {
            patch('variations', []);
            patch('hasVariations', false);
            setRemoveVariationsOpen(false);
          }}
          title={`Remove all ${form.variations.length} variation(s)?`}
          description="Variation names and prices will be cleared. You can turn this back on and add variations again later."
          confirmLabel="Remove all"
          cancelLabel="Cancel"
        />
        <DeleteConfirmationModal
          open={showPastSeasonEndModal}
          onClose={() => {
            setShowPastSeasonEndModal(false);
            skipPastSeasonEndCheckRef.current = false;
          }}
          onConfirm={() => {
            setShowPastSeasonEndModal(false);
            skipPastSeasonEndCheckRef.current = true;
            void handleSave();
          }}
          title="Seasonal end date is in the past"
          description={`This item has an end date (${form.seasonEnd}) that is earlier than today. Do you want to save anyway?`}
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          confirmButtonVariant="primary"
        />
        <DeleteConfirmationModal
          open={showZeroPriceModal}
          onClose={() => {
            setShowZeroPriceModal(false);
            setZeroPriceModalDetail({ mode: 'base', channelLabels: [] });
          }}
          onConfirm={() => {
            setShowZeroPriceModal(false);
            setZeroPriceModalDetail({ mode: 'base', channelLabels: [] });
            skipZeroPriceCheckRef.current = true;
            void handleSave();
          }}
          title={
            zeroPriceModalDetail.mode === 'channels' && zeroPriceModalDetail.channelLabels.length > 0
              ? 'A channel price is $0.00'
              : 'This item has a $0.00 price'
          }
          description={
            zeroPriceModalDetail.mode === 'channels' && zeroPriceModalDetail.channelLabels.length > 0 ? (
              <>
                The following channel{zeroPriceModalDetail.channelLabels.length > 1 ? 's have' : ' has'} a zero price:{' '}
                <strong>{zeroPriceModalDetail.channelLabels.join(', ')}</strong>. Are you sure you want to save?
              </>
            ) : (
              'Are you sure you want to save with a zero price?'
            )
          }
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          confirmButtonVariant="primary"
        />
      </div>
  );

  if (isEditRoute && !editingItemId) {
    return <Navigate to={pcPaths.items} replace />;
  }

  if (isMobile) {
    return (
      <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif" }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span onClick={handleDiscardCancel} className="material-symbols-rounded" style={{ fontSize: 22, color: '#453F39', cursor: 'pointer' }}>arrow_back</span>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: 0, overflowWrap: 'anywhere' }}>{pageTitle}</h1>
            </div>
          </div>
        </div>
        {formContent}
      </div>
    );
  }

  return (
    <DesktopLayout>
      {formContent}
      <DiscardChangesModal open={showDiscardModal} onKeepEditing={handleKeepEditing} onConfirm={handleConfirmDiscard} />
    </DesktopLayout>
  );
}