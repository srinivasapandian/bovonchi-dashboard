export type ItemStatus = 'active' | 'draft' | 'out_of_stock' | 'hidden' | 'archived';
export type ItemType = 'prepared_food_beverage' | 'event' | 'physical_good' | 'merchandise' | 'service' | 'digital';
export type OrderType = 'dine_in' | 'takeout' | 'delivery' | 'online_ordering' | 'catering';
export type MenuStatus = 'live' | 'scheduled' | 'draft';
export type ModifierType = 'options_list' | 'text_field';
export type SyncStatus = 'updated' | 'pending' | 'failed';

/** Shared {id, name} shape for tags, allergens, dietary labels, ingredients. */
export interface ItemAttribute {
  id: string;
  name: string;
}

export interface NutritionInfo {
  basis?: string;
  calories?: number | string;
  protein?: number | string;
  carbs?: number | string;
  fat?: number | string;
}

/** Optional variation row for list pricing range (mock / demo). */
export interface ItemVariationPreview {
  id: string;
  name: string;
  price: number;
}

/** PCF-12: Menu-specific price override */
export interface MenuItemPrice {
  menuId: string;
  itemId: string;
  variationId?: string;
  overridePrice: number;
  channelPrices?: Partial<Record<OrderType, number>>;
}

export interface ItemMediaPreview {
  id: string;
  fileName: string;
  type?: string;
  imageUrl?: string;
  imageId?: string;
  imageType?: string;
  sortOrder: number;
}

export interface MenuItem {
  id: string;
  name: string;
  itemCode: string;
  itemType?: ItemType;
  basePrice: number;
  channelPrices: Partial<Record<OrderType, number>>;
  /** PCF-12: Pricing strategy */
  pricingStrategy?: 'standard' | 'menu_specific';
  categoryIds: string[];
  status?: ItemStatus;
  imageUrl?: string;
  mediaResponseList?: ItemMediaPreview[];
  description: string;
  allergens: ItemAttribute[];
  dietaryLabels: ItemAttribute[];
  tags: ItemAttribute[];
  ingredients: ItemAttribute[];
  nutrition?: NutritionInfo;
  prepTime: number;
  kitchenStationId?: string;
  kitchenStationIds?: string[];
  createdAt: string;
  performanceBadge?: 'star' | 'steady' | 'underperformer' | 'new';
  modifierIds?: string[];
  variationCount?: number;
  /** When set, items list can show min–max price like the reference catalog. */
  variations?: ItemVariationPreview[];
  sessionIds?: string[];
  sessionSlotIdsBySessionGroupId?: Record<string, string[]>;
  sessionNames?: string[];
  availability?: 'available' | 'unavailable' | 'scheduled';
  unitsSold7d?: number;
  unitsSold30d?: number;
  revenue30d?: number;
  /** Optional cost for margin tracking (mock / UI). */
  costPrice?: number;
  /** Per-channel visibility; omitted keys default to visible in UI. */
  visibilityPerOrderType?: Partial<Record<OrderType, boolean>>;
  /** Per-channel availability from API (`availabilityEnabled`). */
  availabilityPerOrderType?: Partial<Record<OrderType, boolean>>;
  inactiveModePerOrderType?: Partial<Record<OrderType, string | null>>;
  inactiveUntilTimePerOrderType?: Partial<Record<OrderType, string | null>>;
  /**
   * Per-outlet channel state keyed by `orderTypeId` (UUID). Preserves per-third-party state
   * that the OrderType-grouped fields above collapse (e.g. DoorDash, GrubHub, Ubereats all
   * map to `online_ordering`). Populated from API `pricing.channels[]`.
   */
  channelsByOrderTypeId?: Record<string, {
    enabled: boolean;
    availabilityEnabled: boolean;
    inactiveMode?: string | null;
    inactiveUntilTime?: string | null;
    price?: number;
    name?: string;
  }>;
  /** Legacy alias kept for backward compatibility with older payloads. */
  orderTypeVisibility?: Partial<Record<OrderType, boolean>>;
  kitchenName?: string;
  containsAlcohol?: boolean;
  /** Kitchen / staff notes; API `specialInstructions` (also accepts singular/snake_case on read). */
  specialInstructions?: string;
  /** Tax IDs linked to this item (zero or more). */
  taxIds?: string[];
  /** @deprecated single-tax field; kept for back-compat with older payloads. Prefer `taxIds`. */
  taxGroup?: string;
  eventIsFree?: boolean;
  eventRegistrationLabel?: string;
  /** PCF-8: Per-category sort position. Key = categoryId, value = sort index. */
  categorySortPositions?: Record<string, number>;
  /** PCF-10: Out of stock duration configuration. */
  outOfStockConfig?: {
    durationMode: 'manual' | 'next_session' | 'specific_time';
    reEnableAt?: string;
    reEnableSessionId?: string;
  };
  /** PCF-1: Master KOT print mode. */
  masterKotMode?: 'all' | 'none' | 'selected';
  /** PCF-1: Order type IDs to print on Master KOT (only when masterKotMode='selected'). */
  masterKotOrderTypes?: OrderType[];
  /** Order type IDs this item is NOT printed to the kitchen for. Empty/missing = prints for all order types. */
  kotExcludedOrderTypeIds?: string[];
  /** PCF-2: Inventory tracking config. */
  inventoryTracking?: {
    enabled?: boolean;
    trackingMode: 'count' | 'availability';
    currentStock?: number;
    lowStockThreshold?: number;
    unitType?: string;
    defaultStockQuantity?: number;
    stockResetMode?: 'carry_forward' | 'auto_reset' | 'clear_stocks';
  };
  /** PCF-3: Age restriction. */
  isAgeRestricted?: boolean;
  minAge?: number;
  restrictionReasons?: string[];
  requireIdVerification?: boolean;
  /** PCF-7: Whether this item was explicitly assigned to its kitchen station. */
  explicitlyAssignedStation?: boolean;
  /** Kiosk device visibility flags. Default true. */
  isTableSide?: boolean;
  isOrderStation?: boolean;
  isMenuStation?: boolean;
  /** Contactless Dine-in menu visibility. Default true. */
  isCdMenu?: boolean;
  /** PCF-9: Dietary color dots. */
  dietaryColorOverrides?: Record<string, string>;
  printInMasterKOT?: boolean;
  revenueClass?: { id: string; name: string };
  bestPairedItems?: { itemId: string; sortOrder: number }[];
  unit?: { unitId: string; type: string };
  seasonalDateRange?: { from: string; to: string } | null;
  /** PCF-14: Half-and-Half split support */
  allowSplit?: boolean;
  splitPricingModel?: 'higher' | 'average';
  splitPartnerIds?: string[];
  /** PCF-16: Per-variation modifier rule overrides keyed by modifier set ID */
  variationModifierOverrides?: Record<string, VariationModifierOverride>;
  /** Catering: sell this item in catering with per-unit serves and optional bulk tray pricing */
  cateringEnabled?: boolean;
  cateringServesCount?: number;
  cateringPricingTiers?: ItemPricingTier[];
  cateringMinOrderQty?: number;
  cateringMaxOrderQty?: number;
  cateringTaxRateId?: string;
}

/** Outlet-wide kitchen printing default (client-side only; no backend field yet). */
export interface KitchenPrintOutletDefault {
  excludedOrderTypeIds: string[];
}

export type KitchenPrintMode = 'all' | 'selected';

/** Form value for the outlet-default / bulk kitchen printing modals. `orderTypeIds` = order types that print, only used when mode is 'selected'. */
export interface KitchenPrintFormValue {
  mode: KitchenPrintMode;
  orderTypeIds: string[];
}

/** A bulk tray size/price tier for catering. `price` is required; label and serves are optional. */
export interface ItemPricingTier {
  /** mhc_item_bulkprice.id — present once persisted; absent for a newly-added tier. */
  id?: string;
  label?: string;
  servesCount?: number;
  price: number;
}

export interface CategoryChannelVisibility {
  orderTypeId: string;
  enabled: boolean;
  availabilityEnabled?: boolean;
  avaliblityEnable?: boolean;
  inactiveUntilTime?: string | null;
  inactiveMode?: string | null;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  parentCategoryId?: string;
  itemCount: number;
  isVisible: boolean;
  sortPosition: number;
  orderTypeVisibility: Record<OrderType, boolean>;
  children?: Category[];
  imageUrl?: string;
  channelVisibility?: CategoryChannelVisibility[];
  /** Item IDs from API (populated after fetch). */
  itemIds?: string[];
  assignedItems?: Array<{ id: string; name: string }>;
}

export interface Menu {
  id: string;
  name: string;
  icon?: string;
  status: MenuStatus;
  categoryIds: string[];
  deviceIds: string[];
  lastUpdated: string;
  description?: string;
  channels?: OrderType[];
  assignedOrderTypeIds?: string[];
  itemCount?: number;
  categoryCount?: number;
  /** Item IDs added explicitly (not only via categories). */
  individualItemIds?: string[];
  sessionIds?: string[];
  goLiveDate?: string | null;
}

export interface ComboEligibleItem {
  itemId: string;
  supplementPrice: number;
}

/** PCF-13: Sub-group within a combo slot */
export interface ComboSlotSubGroup {
  id: string;
  label: string;
  selectionQuantity: number;
  sortPosition: number;
  eligibleItems: ComboEligibleItem[];
}

export interface ComboSlot {
  id: string;
  slotName: string;
  slotType: 'required' | 'optional';
  minSelections: number;
  maxSelections: number;
  defaultItemId?: string;
  defaultVariationId?: string;
  sortPosition: number;
  eligibleItems: ComboEligibleItem[];
  /** PCF-13: When true, items are organised into sub-groups */
  hasSubGroups?: boolean;
  subGroups?: ComboSlotSubGroup[];
}

export interface Combo {
  id: string;
  itemId?: string;
  name: string;
  displayName?: string;
  description?: string;
  comboCode: string;
  pricingModel: 'fixed' | 'dynamic';
  basePrice: number;
  costPrice?: number;
  status: ItemStatus;
  orderTypeVisibility?: Partial<Record<OrderType, boolean>>;
  orderTypeAvailability?: Array<{ orderTypeId: string; isEnable: boolean }>;
  channelPrices?: Partial<Record<OrderType, number>>;
  modifierIds?: string[];
  sessionIds?: string[];
  slots: ComboSlot[];
  createdAt: string;
}

/** POS / tablet / kiosk devices for menu assignment (mock catalog). */
export interface CatalogDevice {
  id: string;
  name: string;
  type: 'pos' | 'tablet' | 'kiosk';
  station: string;
  currentMenuId: string | null;
}

export interface ModifierOption {
  id: string;
  name: string;
  isAvailable: boolean;
  price?: number;
  kitchenName?: string;
  isDefault?: boolean;
  isOnline?: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  displayName: string;
  type: ModifierType;
  isRequired: boolean;
  allowMultiple: boolean;
  minSelection: number;
  maxSelection: number;
  options: ModifierOption[];
  appliedItemCount?: number;
  assignedItems?: Array<{ id: string; name: string }>;
  channelVisibility?: Array<{ orderTypeId: string; enabled: boolean }>;
}

export interface OptionSetOption {
  id: string;
  name: string;
  price?: number;
}

export interface OptionSet {
  id: string;
  name: string;
  displayName?: string;
  options: OptionSetOption[];
  itemCount?: number;
}

/** Backward-compatible alias used by variation screens. */
export type VariationSetOption = OptionSetOption;

/** Backward-compatible alias used by variation screens. */
export type VariationSet = OptionSet;

export interface KitchenStation {
  id: string;
  name: string;
  code: string;
  description: string;
  color: string;
  itemCount?: number;
  assignedItemIds?: string[];
  assignedItems?: Array<{ id: string; name: string; productCode?: string | null }>;
  /** When true, station cannot be deleted (Copy UX). */
  isDefault?: boolean;
  displayOrder?: number;
}

export interface Printer {
  id: string;
  name: string;
  type: 'kot' | 'label' | 'receipt';
  connectionType: 'network' | 'usb' | 'bluetooth';
  connectionDetails: string;
  isMasterKot: boolean;
  stationIds: string[];
  status?: 'online' | 'offline';
}

/** One schedule row: one or more weekdays + time range (matches portal Copy sessions UX). */
export interface SessionSlot {
  id: string;
  days: string[];
  startTime: string;
  endTime: string;
}

export interface Session {
  id: string;
  name: string;
  slots: SessionSlot[];
  assignedItemCount: number;
  /** Item IDs explicitly assigned; list/detail UIs also sync from `MenuItem.sessionIds`. */
  assignedItemIds?: string[];
  assignedSessionItems?: Array<{ id: string; name: string; sessionPrice?: number }>;
  /** Group id from session catalog when distinct from `id` (items use this in `timeBasedAvailability.sessionGroupId`). */
  sessionGroupId?: string;
  /** All trimmed ids returned for this session (group id, UUID, etc.) — used to match `MenuItem.sessionIds`. */
  sessionMatchIds?: string[];
  color?: string;
  description?: string;
  isDefault?: boolean;
  deviceCount?: number;
  weeklyHours?: number;
}

/** PCF-5: Set Menu / Prix Fixe */
export interface SetMenuCourseItem {
  itemId: string;
  supplementPrice: number;
}

export interface SetMenuCourse {
  id: string;
  label: string;
  categoryId?: string;
  minSelections: number;
  maxSelections: number;
  sortPosition: number;
  eligibleItems: SetMenuCourseItem[];
  /** PCF-15: Modifier sets attached to this course (appear for any item selected) */
  courseModifierIds?: string[];
}

/** PCF-16: Per-variation modifier rule overrides */
export interface VariationModifierOverride {
  variationId: string;
  minSelections?: number;
  maxSelections?: number;
  allowQuantities?: boolean;
  hiddenOptionIds?: string[];
}

export interface SetMenu {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price: number;
  courseCount: number;
  courses: SetMenuCourse[];
  status: ItemStatus;
  createdAt: string;
}

/** PCF-9: Dietary type color config */
export interface DietaryTypeColor {
  tagName: string;
  colorHex: string;
  showOnPos: boolean;
  showOnListing: boolean;
}

export interface SyncIntegrationReasonEntry {
  key: string;
  value: string;
}

export interface SyncIntegration {
  name: string;
  type: string;
  status: SyncStatus;
  lastUpdatedAt?: string;
  reasonEntries?: SyncIntegrationReasonEntry[];
  /** Human readable state of the latest push to this channel, e.g. "Synced", "Provider rejected". */
  statusLabel?: string;
  /** Row id of the latest attempt; sent to POST /sync/third-party/retry. */
  thirdPartySyncId?: string;
  /** 1 = original push, 2 = first retry, ... */
  attempt?: number;
  /** Backend says this channel can be retried now. */
  canRetry?: boolean;
  /** Push sent, provider result (webhook) still expected: keep polling. */
  inFlight?: boolean;
}

export interface SyncDevice {
  name: string;
  type: 'pos' | 'kds' | 'kiosk';
  status: SyncStatus;
  lastUpdatedAt?: string;
  enabled?: boolean;
}

export interface SyncEntry {
  id: string;
  timestamp: string;
  overallStatus: SyncStatus;
  devices: SyncDevice[];
  changesSummary: string;
  devicesSummary: string;
  thirdPartySummary: string;
  initiator?: string;
  integrations?: SyncIntegration[];
}

/** PCF-18: Per-channel 86 (temporary operational override) */
export interface EntityChannel86 {
  id: string;
  entityType: 'item' | 'combo' | 'set_menu' | 'category';
  entityId: string;
  outletId: string;
  channel: OrderType;
  durationMode: 'manual' | 'next_session' | 'specific_time';
  reEnableAt?: string;
  reEnableSessionId?: string;
  createdBy: string;
  createdAt: string;
}

/** PCF-18: Resolution chain result for effective state diagnostic */
export type EffectiveStateResult = {
  visible: boolean;
  available: boolean;
  effective: 'showing' | 'sold_out' | 'hidden' | 'blocked';
  reasons: Array<{
    step: string;
    label: string;
    passed: boolean;
    detail?: string;
    fixPath?: string;
  }>;
};
