import { Fragment, useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPortal, flushSync } from 'react-dom';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '../../components/ui/Button';
import { DeleteConfirmationModal, deleteConfirmTitle } from '../../components/ui/DeleteConfirmationModal';
import { Modal } from '../../components/ui/Modal';
import { OutOfStockDurationModal, type DurationMode } from '../../components/ui/OutOfStockDurationModal';
import { EmptyState } from '../../components/ui/EmptyState';
import { CatalogListEmptyState } from '../../components/ui/CatalogListEmptyState';
import PageHeader from '../../components/layout/PageHeader';
import CatalogHelpLink from '../../components/layout/CatalogHelpLink';
import ItemsTutorial from '../../components/tutorials/items-tutorial';
import SearchInput from '../../components/forms/SearchInput';
import { CatalogDropdown } from '../../components/forms/CatalogDropdown';
/** List hydration: `useItemsStore.fetchItems` --- `itemCatalogApi` (GET items + category/get-categories, maghil-backend-v3 ItemController / CategoryController). */
import { useItemsStore, useCategoriesStore, useMenusStore, useSessionsStore, useKitchenStationsStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import { pcPaths, PC_BASE } from '../../paths';
import {
  catalogListActionButtonStyle,
  catalogListActionEnterDefault,
  catalogListActionLeaveDefault,
  catalogListActionEnterDanger,
  catalogListActionLeaveDanger,
  CATALOG_LIST_ACTION_ICON_PX,
} from '../../catalogEntityActions';
import type { OrderType, MenuItem, Category, Menu, ItemStatus } from '../../data/types';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useErrorToast } from '../../hooks/useErrorToast';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import BottomNav from '../../../BottomNav';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import { resolveCatalogItemImageUrl } from '../../../../constants';
import {
  feItemTypeToBackendCode,
  itemCreationStatusApiFromFeStatus,
  ITEMS_API_BASE,
  updateExclusiveItemsSortOrderApi,
  getExclusiveItemsApi,
} from '../../../../services/itemCatalogApi';
import ItemsShimmer from '../../components/ui/ItemsShimmer';
import { ProductCatalogSyncBanner } from '../../components/ui/ProductCatalogSyncBanner';
import { BulkActionsMenu, type BulkAction } from '../../components/ui/BulkActionsMenu';
import { BulkKitchenPrintModal } from '../../components/ui/BulkKitchenPrintModal';
import { useBulkKitchenPrint } from '../../hooks/useBulkKitchenPrint';
import { itemStationIds } from '../../utils/kitchenPrintRouting';
import { isThirdPartyTypeGroup, isPickupOrderType } from '../../utils/outletOrderTypes';
import type { KitchenPrintFormValue } from '../../data/types';

/* ------ helpers ------------------------------------------------------------------------------------------------------------------------------------------ */

const orderTypeLabels: Record<OrderType, string> = {
  dine_in: 'Dine-in',
  // takeout: 'Takeaway',
  takeout: 'Online',
  delivery: 'Delivery',
  online_ordering: 'Online',
  catering: 'Catering',
};

type OutletOrderType = {
  id?: string;
  typeName?: string;
  typeGroup?: string;
  isEnabled?: number | boolean;
};

function normalizeOrderTypeText(value: string): string {
  return value.toLowerCase().replace(/[\s-]+/g, '_').trim();
}

function mapOutletOrderTypeToKey(ot: OutletOrderType): OrderType | null {
  const fromTypeName = normalizeOrderTypeText(ot.typeName ?? '');
  const fromId = normalizeOrderTypeText(ot.id ?? '');
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
    default: return null;
  }
}

function getOutletOrderTypeRows(
  selectedBranch: Record<string, unknown> | null | undefined,
): Array<{ key: OrderType; id: string; label: string }> {
  const raw = selectedBranch?.orderTypes;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  // One row per outlet UUID (no dedupe by OrderType key) so DoorDash/GrubHub/Ubereats each
  // get their own column in the Grid Edit price table.
  const seenLabels = new Set<string>();
  const rows: Array<{ key: OrderType; id: string; label: string }> = [];
  raw.forEach((entry) => {
    const ot = entry as OutletOrderType;
    // Include disabled (isEnabled: 0) order types too; still exclude in-store.
    const notInStore = (ot.typeGroup ?? 'T') !== 'I';
    if (!notInStore || !isPickupOrderType(ot)) return;
    const key = mapOutletOrderTypeToKey(ot);
    if (!key) return;
    const id = String(ot.id ?? '').trim();
    if (!id) return;
    // const baseLabel = (ot.typeName ?? '').trim() || orderTypeLabels[key];
    const baseLabel = 'Online'; // only the Pickup channel is shown, labelled "Online"
    const dedupeKey = `${key}:${baseLabel.toLowerCase().replace(/[\s-]+/g, '')}`;
    if (seenLabels.has(dedupeKey)) return;
    seenLabels.add(dedupeKey);
    rows.push({ key, id, label: baseLabel });
  });
  return rows;
}

/** Items listing: show code without `#`; blank or whitespace → `-`. */
function formatItemCodeListDisplay(code: string | undefined | null): string {
  const t = (code ?? '').trim();
  return t.length > 0 ? t : '-';
}

/** Branch order types (same filter as CategoriesPage) — pair with `category.channelVisibility`. */
type BranchOutletOrderType = {
  id: string;
  typeName: string;
  typeGroup?: string;
};

function getChannelDisplayName(typeName: string): string {
  const n = (typeName ?? '').toLowerCase();
  // Pickup channel is shown to users as "Online" (original name kept in the data).
  if (/(takeout|take_out|takeaway|take_away|pickup|pick_up)/.test(n.replace(/[\s-]+/g, '_'))) return 'Online';
  if (n.includes('dining') || n.includes('dinein') || n.includes('dine-in') || n.includes('walk-in') || n.includes('walkin')) return 'Dine-in';
  if (!typeName) return '';
  return typeName.charAt(0).toUpperCase() + typeName.slice(1).toLowerCase();
}

function getOrderTypesForBranch(selectedBranch: Record<string, unknown> | null | undefined): BranchOutletOrderType[] {
  if (!selectedBranch) return [];
  const raw = selectedBranch.orderTypes;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.filter((ot: { isEnabled?: number | boolean; typeGroup?: string }) => {
    // Include disabled (isEnabled: 0) order types too; still exclude in-store.
    const notInstore = (ot?.typeGroup ?? 'T') !== 'I';
    return notInstore && isPickupOrderType(ot);
  }) as BranchOutletOrderType[];
}

/** Enabled channel pills for a category — mirrors CategoriesPage `CategoryCardBody` / `enabledChannels`. */
function getCategoryEnabledChannelDescriptors(
  cat: Category,
  outletOrderTypes: BranchOutletOrderType[],
): Array<{ id: string; label: string }> {
  const cvMap = new Map((cat.channelVisibility ?? []).map((cv) => [String(cv.orderTypeId), cv.enabled]));
  return outletOrderTypes
    .filter((ot) => cvMap.get(String(ot.id)) === true)
    .map((ot) => {
      const label = getChannelDisplayName(ot.typeName) || (ot.typeName ?? '').trim();
      return { id: String(ot.id), label };
    })
    .filter((x) => x.label.length > 0);
}

/** Tree for items list: parents are folders; items only under leaves. */
type CategoryDisplayEntry =
  | { mode: 'single'; category: Category; items: MenuItem[] }
  | { mode: 'nest'; parent: Category; entries: CategoryDisplayEntry[] };

function subtreeHasActiveMenu(
  categories: Category[],
  rootId: string,
  menuActiveIds: Set<string>,
): boolean {
  if (menuActiveIds.has(rootId)) return true;
  return categories.some(
    (c) =>
      c.parentCategoryId === rootId && subtreeHasActiveMenu(categories, c.id, menuActiveIds),
  );
}

function buildCategoryDisplayEntry(
  category: Category,
  categories: Category[],
  filteredItems: MenuItem[],
  menuActiveIds: Set<string>,
): CategoryDisplayEntry | null {
  const children = categories
    .filter((c) => c.parentCategoryId === category.id)
    .sort((a, b) => a.sortPosition - b.sortPosition || a.name.localeCompare(b.name));
  if (children.length === 0) {
    if (!menuActiveIds.has(category.id)) return null;
    return {
      mode: 'single',
      category,
      items: filteredItems
        .filter((i) => i.categoryIds.includes(category.id))
        .sort((a, b) => {
          const sa = a.categorySortPositions?.[category.id] ?? Infinity;
          const sb = b.categorySortPositions?.[category.id] ?? Infinity;
          return sa - sb;
        }),
    };
  }
  const entries = children
    .map((ch) => buildCategoryDisplayEntry(ch, categories, filteredItems, menuActiveIds))
    .filter((e): e is CategoryDisplayEntry => e != null);
  if (entries.length === 0) return null;
  return { mode: 'nest', parent: category, entries };
}

function buildCategoryDisplayRoots(
  categories: Category[],
  filteredItems: MenuItem[],
  menuActiveIds: Set<string>,
): CategoryDisplayEntry[] {
  const roots = categories
    .filter((c) => !c.parentCategoryId)
    .sort((a, b) => a.sortPosition - b.sortPosition || a.name.localeCompare(b.name));
  return roots
    .map((r) => {
      if (!subtreeHasActiveMenu(categories, r.id, menuActiveIds)) return null;
      return buildCategoryDisplayEntry(r, categories, filteredItems, menuActiveIds);
    })
    .filter((e): e is CategoryDisplayEntry => e != null);
}

function flattenCategoryLeaves(
  entries: CategoryDisplayEntry[],
): { category: Category; items: MenuItem[] }[] {
  const out: { category: Category; items: MenuItem[] }[] = [];
  function walk(entry: CategoryDisplayEntry) {
    if (entry.mode === 'single') out.push({ category: entry.category, items: entry.items });
    else entry.entries.forEach(walk);
  }
  entries.forEach(walk);
  return out;
}

function countItemsInDisplayEntry(entry: CategoryDisplayEntry): number {
  if (entry.mode === 'single') return entry.items.length;
  return entry.entries.reduce((sum, e) => sum + countItemsInDisplayEntry(e), 0);
}

/** Hide leaf categories and parent folders that have no items (after filtering). */
function pruneDisplayWithoutItems(entries: CategoryDisplayEntry[]): CategoryDisplayEntry[] {
  function prune(entry: CategoryDisplayEntry): CategoryDisplayEntry | null {
    if (entry.mode === 'single') return entry.items.length > 0 ? entry : null;
    const prunedChildren = entry.entries
      .map(prune)
      .filter((x): x is CategoryDisplayEntry => x != null);
    if (prunedChildren.length === 0) return null;
    const total = prunedChildren.reduce((sum, e) => sum + countItemsInDisplayEntry(e), 0);
    if (total === 0) return null;
    return { mode: 'nest', parent: entry.parent, entries: prunedChildren };
  }
  return entries.map(prune).filter((x): x is CategoryDisplayEntry => x != null);
}

function pruneDisplayBySearch(
  entries: CategoryDisplayEntry[],
  q: string,
): CategoryDisplayEntry[] {
  if (!q.trim()) return entries;
  function prune(entry: CategoryDisplayEntry): CategoryDisplayEntry | null {
    if (entry.mode === 'single') return entry.items.length > 0 ? entry : null;
    const pruned = entry.entries.map(prune).filter((x): x is CategoryDisplayEntry => x != null);
    return pruned.length > 0 ? { mode: 'nest', parent: entry.parent, entries: pruned } : null;
  }
  return entries.map(prune).filter((x): x is CategoryDisplayEntry => x != null);
}

function collectExpandIdsFromDisplay(entries: CategoryDisplayEntry[]): Set<string> {
  const ids = new Set<string>();
  const walk = (e: CategoryDisplayEntry): boolean => {
    if (e.mode === 'single') {
      if (e.items.length > 0) ids.add(e.category.id);
      return e.items.length > 0;
    }
    let any = false;
    for (const sub of e.entries) {
      if (walk(sub)) any = true;
    }
    if (any) ids.add(`nest:${e.parent.id}`);
    return any;
  };
  entries.forEach((ent) => walk(ent));
  return ids;
}

/** All item IDs under a category tree node (parent nest or leaf section). */
function collectItemIdsFromDisplayEntry(entry: CategoryDisplayEntry): string[] {
  if (entry.mode === 'single') return entry.items.map((i) => i.id);
  return entry.entries.flatMap(collectItemIdsFromDisplayEntry);
}

/** Matches Copy menu scope: categories on the menu plus individually assigned items. */
function itemVisibleInMenu(menu: Menu, item: MenuItem): boolean {
  if (item.categoryIds.some((cid) => menu.categoryIds.includes(cid))) return true;
  if (menu.individualItemIds?.includes(item.id)) return true;
  return false;
}

const ITEM_STATUS_OPTIONS: { value: ItemStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'archived', label: 'Archived' },
];

/** Per-channel fallback columns in Grid Edit when location order types are missing. */
const GRID_CHANNEL_TYPES_FALLBACK: OrderType[] = ['dine_in', 'takeout', 'delivery', 'online_ordering', 'catering'];
const MAX_VISIBLE_CATEGORY_ORDER_TYPES = 4;

function channelPriceValue(item: MenuItem, ot: OrderType, outletId?: string): number {
  // Prefer per-outlet UUID price from API when present — legacy `channelPrices` collapses
  // same-group third parties (DoorDash/GrubHub/Ubereats) into one value.
  if (outletId) {
    const perOutlet = item.channelsByOrderTypeId?.[outletId]?.price;
    if (perOutlet !== undefined && !Number.isNaN(Number(perOutlet))) return Number(perOutlet);
  }
  const c = item.channelPrices[ot];
  return c !== undefined && !Number.isNaN(Number(c)) ? Number(c) : item.basePrice;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 48%)`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function priceRangeLabel(item: MenuItem): string {
  // Listing always shows item base price from API payload.
  return formatCurrency(item.basePrice);
}

function PerformanceGlyph({ badge }: { badge: MenuItem['performanceBadge'] }) {
  if (!badge) return null;
  const icon =
    badge === 'star'
      ? 'star'
      : badge === 'underperformer'
        ? 'trending_down'
        : badge === 'new'
          ? 'auto_awesome'
          : 'horizontal_rule';
  const color =
    badge === 'star' ? '#B07A2A' : badge === 'underperformer' ? '#A63D2F' : badge === 'new' ? '#B89550' : '#9A9084';
  return (
    <span className="material-symbols-rounded" style={{ fontSize: 16, color, flexShrink: 0 }}>
      {icon}
    </span>
  );
}

function CategoryHeaderCheckbox({
  fullySelected,
  partiallySelected,
  onToggle,
}: {
  fullySelected: boolean;
  partiallySelected: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.indeterminate = partiallySelected && !fullySelected;
  }, [partiallySelected, fullySelected]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={fullySelected}
      onChange={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      style={{ width: 16, height: 16, margin: 0, accentColor: '#B89550', cursor: 'pointer', flexShrink: 0 }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

/* ------ Column definitions ------------------------------------------------------------------------------------------------ */

interface ColumnDef {
  key: string;
  label: string;
  locked?: boolean;
  defaultVisible: boolean;
  group: 'always' | 'standard' | 'extended';
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'selection', label: 'Selection', locked: true, defaultVisible: true, group: 'always' },
  { key: 'item', label: 'Item', locked: true, defaultVisible: true, group: 'always' },
  { key: 'code', label: 'Code', defaultVisible: true, group: 'standard' },
  { key: 'price', label: 'Price', defaultVisible: true, group: 'standard' },
  // { key: 'status', label: 'Status', defaultVisible: true, group: 'standard' },
  { key: 'actions', label: 'Actions', defaultVisible: true, group: 'standard' },
  // { key: 'age_restriction', label: 'Age', defaultVisible: false, group: 'extended' },
  // Hidden for now (e-commerce storefront):
  // { key: 'kitchen_station', label: 'Kitchen Station', defaultVisible: false, group: 'extended' },
  { key: 'modifiers', label: 'Product Options' /* was: 'Modifiers' */, defaultVisible: false, group: 'extended' },
  // { key: 'variations', label: 'Variations', defaultVisible: false, group: 'extended' },
  { key: 'sessions', label: 'Sessions', defaultVisible: false, group: 'extended' },
  // { key: 'order_types', label: 'Order Types', defaultVisible: false, group: 'extended' },
  { key: 'created_date', label: 'Created Date', defaultVisible: false, group: 'extended' },
];

/* ------ component ------------------------------------------------------------------------------------------------------------------------------------ */

type ViewMode = 'standard' | 'grid' | 'performance';
const MAX_VISIBLE_COLUMNS = 9;
/** Columns hidden from the UI; also stripped from any previously persisted selection. */
const HIDDEN_COLUMN_KEYS = new Set(['kitchen_station', 'order_types', 'age_restriction']);

/* PCF-8: Sortable wrapper for item rows in reorder mode */
function SortableItemRow({ item, renderItemRow }: { item: MenuItem; renderItemRow: (item: MenuItem) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...listeners}
        {...attributes}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '8px 4px 8px 12px', cursor: 'grab', color: '#9A9084',
          flexShrink: 0, touchAction: 'none',
        }}
        title="Drag to reorder"
      >
        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
          <circle cx="3" cy="2" r="1.2" /><circle cx="7" cy="2" r="1.2" />
          <circle cx="3" cy="6" r="1.2" /><circle cx="7" cy="6" r="1.2" />
          <circle cx="3" cy="10" r="1.2" /><circle cx="7" cy="10" r="1.2" />
          <circle cx="3" cy="14" r="1.2" /><circle cx="7" cy="14" r="1.2" />
        </svg>
      </div>
      <div style={{ flex: 1 }}>{renderItemRow(item)}</div>
    </div>
  );
}

export default function ItemsPage() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    items,
    removeItem,
    updateItem,
    reorderItemsInCategory,
    fetchItems,
    clearItemsCache,
    createItemOnServer,
    updateItemOnServer,
    deleteItemOnServer,
    bulkDeleteItemsOnServer,
    loading: itemsLoading,
    loadedLocationId: itemsLoadedLocationId,
    error: itemsError,
    setEditingItemId,
    visibleColumns: visibleColumnsArray,
    setVisibleColumns: setVisibleColumnsRedux,
  } = useItemsStore();
  // const { getColorForTag } = useDietaryColorsStore(); // dietary dots hidden
  const {
    categories,
    loading: categoriesLoading,
    loadedLocationId: categoriesLoadedLocationId,
    error: categoriesError,
    clearCategoriesCache,
    updateCategoryOnServer,
    fetchCategories,
  } = useCategoriesStore();
  const { menus, fetchMenus, error: menusError, setEditingMenuId } = useMenusStore();
  const { sessions } = useSessionsStore();
  const { stations } = useKitchenStationsStore();
  const { addToast } = useToastStore();
  const { auth } = useAuth();
  const { selectedBranch } = useBranch();
  const token = auth?.accessToken ?? auth?.access_token ?? null;

  // Kitchen printing by order type: bulk-apply writes the real PATCH /items/bulk/kot-exception
  // endpoint. "Follow outlet default" always reads "All order types" here, same static label
  // as the item edit page (Section 1 of the API guide) — not the outlet's actual saved default.
  const kitchenPrintLocationId = String(selectedBranch?.id ?? selectedBranch?.locationId ?? '').trim();
  const kitchenPrintOrderTypes = useMemo(
    () => getOrderTypesForBranch(selectedBranch).filter((ot) => !isThirdPartyTypeGroup(ot.typeGroup)),
    [selectedBranch],
  );
  const { apply: applyBulkKitchenPrintToIds } = useBulkKitchenPrint(
    kitchenPrintLocationId,
    token,
    kitchenPrintOrderTypes,
    updateItem,
  );
  useErrorToast(itemsError, { fallbackMessage: 'Failed to load items' });
  useErrorToast(categoriesError, { fallbackMessage: 'Failed to load categories' });
  useErrorToast(menusError, { fallbackMessage: 'Failed to load menus' });

  const branchLocationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
  const catalogReadyForBranch = useMemo(
    () =>
      Boolean(branchLocationId) &&
      itemsLoadedLocationId === branchLocationId &&
      categoriesLoadedLocationId === branchLocationId,
    [branchLocationId, itemsLoadedLocationId, categoriesLoadedLocationId],
  );
  /** Shimmer until items + categories have been loaded for the selected branch (avoids empty-state flash before fetch and stale UI on branch switch). */
  const showCatalogListShimmer = useMemo(
    () =>
      Boolean(branchLocationId) &&
      !itemsError &&
      !categoriesError &&
      !catalogReadyForBranch,
    [branchLocationId, itemsError, categoriesError, catalogReadyForBranch],
  );

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({ title: 'Items', breadcrumbs: 'Product Catalog' });
  }, [setTopBarProps]);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) return;
    void fetchItems(locationId, token, { skipDuplicateMs: 750 });
    void fetchCategories(locationId, token, { skipDuplicateMs: 750 });
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token, fetchItems, fetchCategories]);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) return;
    void fetchMenus(locationId, token, { skipDuplicateMs: 750 });
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token, fetchMenus]);

  /* state */
  const [activeMenu, setActiveMenu] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set());
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);
  const [pendingHighlightId, setPendingHighlightId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  useBarcodeScanner({
    onScan: (code) => {
      setSearch(code);
      addToast(`Scanned: ${code}`, 'success');
    },
  });
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(() => new Set());
  const [bulkKitchenPrintOpen, setBulkKitchenPrintOpen] = useState(false);
  // Only ever apply the bulk kitchen-print change to ids that belong to the outlet whose items
  // are actually loaded right now --- guards against writing the previous outlet's item ids under
  // the new `kitchenPrintLocationId` while the new outlet's items are still loading.
  const bulkKitchenPrintIds = useMemo(() => {
    if (itemsLoadedLocationId !== kitchenPrintLocationId) return [];
    const loadedItemIds = new Set(items.map((i) => i.id));
    return Array.from(selectedItems).filter((id) => loadedItemIds.has(id));
  }, [selectedItems, items, itemsLoadedLocationId, kitchenPrintLocationId]);
  // The bulk modal must never stay open once nothing is selected (Clear selection, an outlet
  // switch, etc.).
  useEffect(() => {
    if (selectedItems.size === 0) setBulkKitchenPrintOpen(false);
  }, [selectedItems]);
  const applyBulkKitchenPrint = async (value: KitchenPrintFormValue) => {
    try {
      const { updatedCount, requestedCount } = await applyBulkKitchenPrintToIds(bulkKitchenPrintIds, value);
      // Same flow as bulk delete: close popup once the API succeeds, clear list caches (Redux + saga)
      // so stale `kotExcludedOrderTypeIds` never reach the item form, then refetch with the loader.
      setBulkKitchenPrintOpen(false);
      setSelectedItems(new Set());
      clearItemsCache();
      clearCategoriesCache();
      addToast(`Kitchen printing updated for ${updatedCount} item${updatedCount === 1 ? '' : 's'}`, 'success');
      if (updatedCount < requestedCount) {
        addToast(`${requestedCount - updatedCount} item${requestedCount - updatedCount === 1 ? '' : 's'} could not be updated`, 'error');
      }
      void fetchItems(kitchenPrintLocationId, token, { force: true });
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to update kitchen printing', 'error');
    }
    setBulkKitchenPrintOpen(false);
  };
  const bulkKitchenPrintModal = bulkKitchenPrintOpen ? (
    <BulkKitchenPrintModal
      open
      onClose={() => setBulkKitchenPrintOpen(false)}
      itemCount={bulkKitchenPrintIds.length}
      noStationCount={items.filter((i) => bulkKitchenPrintIds.includes(i.id) && itemStationIds(i).length === 0).length}
      orderTypes={kitchenPrintOrderTypes}
      onApply={applyBulkKitchenPrint}
    />
  ) : null;
  const [showColumnsPanel, setShowColumnsPanel] = useState(false);
  const visibleColumns = useMemo(
    () => new Set(visibleColumnsArray.filter((k: string) => !HIDDEN_COLUMN_KEYS.has(k))),
    [visibleColumnsArray],
  );
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [deletingItems, setDeletingItems] = useState(false);
  const deletingItemsRef = useRef(false);
  const [mobileMenuItemId, setMobileMenuItemId] = useState<string | null>(null);
  const [bulkToggleTarget, setBulkToggleTarget] = useState<{ catId: string; action: 'enable' | 'disable'; includeSubcategories: boolean } | null>(null);
  const [reorderCategoryId, setReorderCategoryId] = useState<string | null>(null);
  const [savingReorderCatId, setSavingReorderCatId] = useState<string | null>(null);
  const [reorderCategorySnapshots, setReorderCategorySnapshots] = useState<Record<string, string[]>>({});
  const [outOfStockItemId, setOutOfStockItemId] = useState<string | null>(null);

  /* Exclusive Items state */
  const [exclusiveItems, setExclusiveItems] = useState<Array<{ itemId: string; itemName: string; sortOrder: number }>>([]);
  const [exclusiveBaselineItems, setExclusiveBaselineItems] = useState<Array<{ itemId: string; itemName: string; sortOrder: number }>>([]);
  const [exclusiveCategoryId, setExclusiveCategoryId] = useState<string | null>(null);
  const [exclusiveLoading, setExclusiveLoading] = useState(false);
  const [exclusiveError, setExclusiveError] = useState<string | null>(null);
  const [savingExclusiveOrder, setSavingExclusiveOrder] = useState(false);
  const prevActiveMenuRef = useRef<string>('all');

  /* Fetch exclusive items in parallel with items/categories */
  useEffect(() => {
    const locationId = selectedBranch?.id ?? (selectedBranch as any)?.locationId ?? '';
    const token = (auth as any)?.accessToken ?? (auth as any)?.access_token ?? null;
    if (!locationId) return;
    setExclusiveLoading(true);
    setExclusiveError(null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    fetch(`${ITEMS_API_BASE}/exclusive/${encodeURIComponent(locationId)}`, { headers })
      .then(async (res) => {
        const data = await res.json() as { exclusiveCategoryId?: string; items?: Array<{ itemId: string; itemName: string; sortOrder: number }> };
        if (!res.ok) throw new Error((data as any)?.message ?? 'Failed to load exclusive items');
        setExclusiveCategoryId(data.exclusiveCategoryId ?? null);
        const arr = Array.isArray(data.items) ? data.items : [];
        // Normalize ids/types so DnD-kit IDs match our state comparisons (numbers vs strings).
        const normalized = arr
          .map((x: any) => ({
            itemId: String(x?.itemId ?? x?.itemID ?? x?.id ?? '').trim(),
            itemName: String(x?.itemName ?? x?.itemName ?? x?.name ?? '').trim(),
            sortOrder: Number(x?.sortOrder ?? 0),
          }))
          .filter((x: any) => Boolean(x.itemId));
        normalized.sort((a: any, b: any) => Number(a.sortOrder) - Number(b.sortOrder));
        setExclusiveItems(normalized);
        setExclusiveBaselineItems(normalized);
      })
      .catch((err: Error) => setExclusiveError(err.message ?? 'Failed to load exclusive items'))
      .finally(() => setExclusiveLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token]);

  // Consume URL highlight param once (remove from URL), then do DOM-based scroll+highlight.
  useEffect(() => {
    const hid = searchParams.get('highlight')?.trim();
    if (!hid || !catalogReadyForBranch) return;
    if (pendingHighlightId === hid) return;

    setPendingHighlightId(hid);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('highlight');
      return next;
    }, { replace: true });
  }, [searchParams, catalogReadyForBranch, pendingHighlightId, setSearchParams]);

  useEffect(() => {
    const hid = pendingHighlightId;
    if (!hid) return;

    // Expand the section containing the target item when we have it.
    const matched = items.find((i) => String(i.id) === String(hid));
    if (matched && matched.categoryIds.length > 0) {
      setExpandedCategories((prev) => {
        const next = new Set(prev);
        const categoryById = new Map(categories.map((c) => [c.id, c]));
        const parentIdsWithChildren = new Set(categories.filter((c) => c.parentCategoryId).map((c) => c.parentCategoryId!));
        matched.categoryIds.forEach((cid) => {
          next.add(cid);
          let cursor = categoryById.get(cid);
          while (cursor?.parentCategoryId) {
            const parentId = cursor.parentCategoryId;
            // Nested category groups are keyed as `nest:<parentId>` in the rendered tree.
            next.add(`nest:${parentId}`);
            // Keep existing direct category expansion behavior for non-nested sections.
            if (!parentIdsWithChildren.has(parentId)) next.add(parentId);
            cursor = categoryById.get(parentId);
          }
        });
        return next;
      });
    } else if (matched && matched.categoryIds.length === 0) {
      setExpandedCategories((prev) => {
        const next = new Set(prev);
        next.add('__uncategorized__');
        return next;
      });
    }

    setHighlightItemId(hid);

    let rafId = 0;
    let attempts = 0;
    const maxAttempts = 300; // ~5s at 60fps
    const startWhenRowRendered = () => {
      const row = document.getElementById(`catalog-item-row-${hid}`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) rafId = window.requestAnimationFrame(startWhenRowRendered);
    };
    rafId = window.requestAnimationFrame(startWhenRowRendered);

    const clearTimer = window.setTimeout(() => {
      setHighlightItemId(null);
      setPendingHighlightId(null);
    }, 2000);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      clearTimeout(clearTimer);
    };
  }, [pendingHighlightId, items, categories]);

  const columnsPanelRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  // Close columns panel on outside click
  useEffect(() => {
    if (!showColumnsPanel) return;
    const handler = (e: MouseEvent) => {
      if (columnsPanelRef.current && !columnsPanelRef.current.contains(e.target as Node)) {
        setShowColumnsPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColumnsPanel]);

  const toggleColumn = useCallback((key: string) => {
    const next = new Set(visibleColumnsArray.filter((k: string) => !HIDDEN_COLUMN_KEYS.has(k)));
    if (next.has(key)) next.delete(key);
    else {
      if (next.size >= MAX_VISIBLE_COLUMNS) return;
      next.add(key);
    }
    setVisibleColumnsRedux(Array.from(next));
  }, [visibleColumnsArray, setVisibleColumnsRedux]);

  const columnLimitReached = visibleColumns.size >= MAX_VISIBLE_COLUMNS;

  const resetColumns = useCallback(() => {
    setVisibleColumnsRedux(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));
  }, [setVisibleColumnsRedux]);

  const openItemDeleteConfirm = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setPendingDeleteIds(ids);
  }, []);

  const bulkActions: BulkAction[] = [
    { key: 'kitchen-printing', label: 'Kitchen printing', icon: 'print', onSelect: () => setBulkKitchenPrintOpen(true) },
    { key: 'delete', label: 'Delete', icon: 'delete', danger: true, onSelect: () => openItemDeleteConfirm(Array.from(selectedItems)) },
  ];

  const confirmPendingDeletes = useCallback(async () => {
    if (!pendingDeleteIds?.length) return;
    // Immediate guard to prevent rapid double-click re-entry before re-render.
    if (deletingItemsRef.current) return;
    deletingItemsRef.current = true;
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) {
      addToast('Select a location first', 'error');
      deletingItemsRef.current = false;
      return;
    }
    const n = pendingDeleteIds.length;
    flushSync(() => setDeletingItems(true));
    try {
      if (pendingDeleteIds.length === 1) {
        await deleteItemOnServer({ itemId: pendingDeleteIds[0], locationId }, token);
      } else {
        await bulkDeleteItemsOnServer({ locationId, itemIds: pendingDeleteIds }, token);
      }
      // Close popup as soon as delete API succeeds; refresh list in background.
      setSelectedItems(new Set());
      setPendingDeleteIds(null);
      // Clear list caches immediately so stale rows are not shown while fresh data is loading.
      clearItemsCache();
      clearCategoriesCache();
      addToast(
        n === 1 ? '1 item has been successfully deleted' : `${n} items have been successfully deleted`,
        'success',
      );
      void fetchItems(locationId, token, { force: true });
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to delete items', 'error');
    } finally {
      deletingItemsRef.current = false;
      setDeletingItems(false);
    }
  }, [pendingDeleteIds, addToast, selectedBranch, auth, fetchItems, clearItemsCache, clearCategoriesCache, deleteItemOnServer, bulkDeleteItemsOnServer]);

  const handleItemStatusChange = useCallback(
    async (item: MenuItem, nextStatus: ItemStatus) => {
      if (item.status === nextStatus) return;
      const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
      const token = auth?.accessToken ?? auth?.access_token ?? null;
      if (!locationId) {
        addToast('Select a location first', 'error');
        return;
      }

      // Optimistic local update for instant UI feedback.
      updateItem(item.id, { status: nextStatus });
      try {
        await updateItemOnServer(
          {
            locationId,
            itemId: item.id,
            itemCreationStatus: itemCreationStatusApiFromFeStatus(nextStatus),
          },
          token,
        );
        await fetchItems(locationId, token, { force: true });
      } catch (e) {
        // Roll back to server truth when update fails.
        await fetchItems(locationId, token, { force: true });
        addToast(e instanceof Error ? e.message : 'Failed to update item status', 'error');
      }
    },
    [selectedBranch, auth, addToast, updateItem, fetchItems],
  );

  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }, []);

  const handleDuplicateItem = useCallback(
    (item: MenuItem) => {
      navigate(`${pcPaths.itemsCreate}?clone=${encodeURIComponent(item.id)}`);
    },
    [navigate],
  );
  const isNestFullySelected = useCallback(
    (entry: CategoryDisplayEntry) => {
      const ids = collectItemIdsFromDisplayEntry(entry);
      return ids.length > 0 && ids.every((id) => selectedItems.has(id));
    },
    [selectedItems],
  );
  const isNestPartiallySelected = useCallback(
    (entry: CategoryDisplayEntry) => {
      const ids = collectItemIdsFromDisplayEntry(entry);
      if (ids.length === 0) return false;
      const selected = ids.filter((id) => selectedItems.has(id)).length;
      return selected > 0 && selected < ids.length;
    },
    [selectedItems],
  );
  const toggleNestSelection = useCallback((entry: CategoryDisplayEntry) => {
    const ids = collectItemIdsFromDisplayEntry(entry);
    if (!ids.length) return;
    setSelectedItems((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      ids.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  }, []);

  /* derived maps */
  const categoryMap = useMemo(() => {
    const map: Record<string, Category> = {};
    categories.forEach((c) => { map[c.id] = c; });
    return map;
  }, [categories]);

  const stationNameById = useMemo(() => {
    const map: Record<string, string> = {};
    stations.forEach((s) => { map[s.id] = s.name; });
    return map;
  }, [stations]);

  /* active menu's category ids */
  const activeCategoryIds = useMemo(() => {
    if (activeMenu === 'all') return categories.map((c) => c.id);
    const menu = menus.find((m) => m.id === activeMenu);
    return menu ? menu.categoryIds : [];
  }, [activeMenu, menus, categories]);

  const categoryDescendantLeafIds = useMemo(() => {
    const hasChildren = new Set<string>();
    for (const c of categories) {
      if (c.parentCategoryId) hasChildren.add(c.parentCategoryId);
    }
    const memo = new Map<string, Set<string>>();
    function leavesUnder(catId: string): Set<string> {
      if (memo.has(catId)) return memo.get(catId)!;
      const out = new Set<string>();
      if (!hasChildren.has(catId)) {
        out.add(catId);
      } else {
        for (const ch of categories.filter((c) => c.parentCategoryId === catId)) {
          leavesUnder(ch.id).forEach((id) => out.add(id));
        }
      }
      memo.set(catId, out);
      return out;
    }
    return { leavesUnder };
  }, [categories]);

  const filterCategoryLeafIds = useMemo(() => {
    if (categoryFilter === 'all') return null;
    return categoryDescendantLeafIds.leavesUnder(categoryFilter);
  }, [categoryFilter, categoryDescendantLeafIds]);

  /* filtered items */
  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((item) => {
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.itemCode.toLowerCase().includes(q);
      const matchCategory =
        categoryFilter === 'all' ||
        (filterCategoryLeafIds
          ? item.categoryIds.some((id) => filterCategoryLeafIds.has(id))
          : item.categoryIds.includes(categoryFilter));
      const menu = menus.find((m) => m.id === activeMenu);
      const matchMenu =
        activeMenu === 'all' || (menu ? itemVisibleInMenu(menu, item) : false);
      return matchSearch && matchCategory && matchMenu;
    });
  }, [items, search, categoryFilter, activeMenu, filterCategoryLeafIds, menus]);

  const menuActiveIdSet = useMemo(() => new Set<string>(activeCategoryIds), [activeCategoryIds]);
  const displayActiveIdSet = useMemo(() => {
    if (categoryFilter === 'all') return menuActiveIdSet;
    return new Set<string>([categoryFilter]);
  }, [categoryFilter, menuActiveIdSet]);

  const categoryDisplayRoots = useMemo(
    () =>
      pruneDisplayWithoutItems(
        buildCategoryDisplayRoots(categories, filteredItems, displayActiveIdSet),
      ),
    [categories, filteredItems, displayActiveIdSet],
  );

  const visibleCategoryDisplayRoots = useMemo(
    () => pruneDisplayBySearch(categoryDisplayRoots, search),
    [categoryDisplayRoots, search],
  );

  const flatLeafGroups = useMemo(
    () => flattenCategoryLeaves(categoryDisplayRoots),
    [categoryDisplayRoots],
  );
  const groupedByCategory = flatLeafGroups;

  const visibleFlatLeafGroups = useMemo(
    () => flattenCategoryLeaves(visibleCategoryDisplayRoots),
    [visibleCategoryDisplayRoots],
  );

  const uncategorizedItems = useMemo(() => {
    if (activeMenu !== 'all') return [];
    return filteredItems.filter((item) => item.categoryIds.length === 0);
  }, [activeMenu, filteredItems]);

  const effectiveExpanded = useMemo(() => {
    if (search.trim()) {
      const ids = collectExpandIdsFromDisplay(visibleCategoryDisplayRoots);
      if (activeMenu === 'all' && uncategorizedItems.length > 0) ids.add('__uncategorized__');
      return ids;
    }
    return expandedCategories;
  }, [search, visibleCategoryDisplayRoots, expandedCategories, activeMenu, uncategorizedItems.length]);

  const toggleCategorySelection = useCallback(
    (catId: string) => {
      const catItems = flatLeafGroups.find((g) => g.category.id === catId)?.items ?? [];
      const itemIds = catItems.map((i) => i.id);
      const allSel = itemIds.length > 0 && itemIds.every((id) => selectedItems.has(id));
      setSelectedItems((prev) => {
        const next = new Set(prev);
        if (allSel) itemIds.forEach((id) => next.delete(id));
        else itemIds.forEach((id) => next.add(id));
        return next;
      });
    },
    [flatLeafGroups, selectedItems],
  );

  const isCategoryFullySelected = useCallback(
    (catId: string) => {
      const catItems = flatLeafGroups.find((g) => g.category.id === catId)?.items ?? [];
      return catItems.length > 0 && catItems.every((i) => selectedItems.has(i.id));
    },
    [flatLeafGroups, selectedItems],
  );

  const isCategoryPartiallySelected = useCallback(
    (catId: string) => {
      const catItems = flatLeafGroups.find((g) => g.category.id === catId)?.items ?? [];
      const some = catItems.some((i) => selectedItems.has(i.id));
      const all = catItems.every((i) => selectedItems.has(i.id));
      return some && !all;
    },
    [flatLeafGroups, selectedItems],
  );

  /* ------ PCF-4: Bulk toggle all items in a category ------ */
  const getItemsInCategory = useCallback(
    (catId: string, includeSubcategories: boolean): MenuItem[] => {
      const catIds = new Set<string>([catId]);
      if (includeSubcategories) {
        // collect all descendant category ids
        const addChildren = (parentId: string) => {
          categories.filter((c) => c.parentCategoryId === parentId).forEach((c) => {
            catIds.add(c.id);
            addChildren(c.id);
          });
        };
        addChildren(catId);
      }
      return items.filter((item) => item.categoryIds.some((cid) => catIds.has(cid)));
    },
    [items, categories],
  );

  const hasSubcategories = useCallback(
    (catId: string) => categories.some((c) => c.parentCategoryId === catId),
    [categories],
  );

  const confirmBulkToggle = useCallback(() => {
    if (!bulkToggleTarget) return;
    const { catId, action, includeSubcategories } = bulkToggleTarget;
    const affectedItems = getItemsInCategory(catId, includeSubcategories);
    const newStatus: ItemStatus = action === 'disable' ? 'hidden' : 'active';

    let successCount = 0;
    let failCount = 0;
    affectedItems.forEach((item) => {
      if (action === 'enable' && !item.name.trim()) {
        failCount++;
        return;
      }
      updateItem(item.id, { status: newStatus });
      successCount++;
    });

    const catName = categories.find((c) => c.id === catId)?.name ?? 'category';
    if (action === 'disable') {
      addToast(`${successCount} items in '${catName}' disabled`, 'success');
    } else {
      const msg = failCount > 0
        ? `${successCount} items enabled, ${failCount} items failed --- missing required fields`
        : `${successCount} items in '${catName}' enabled`;
      addToast(msg, failCount > 0 ? 'info' : 'success');
    }
    setBulkToggleTarget(null);
  }, [bulkToggleTarget, getItemsInCategory, updateItem, addToast, categories]);

  /* ------ PCF-10: Out of Stock Duration ------ */
  const handleStatusChange = useCallback(
    (itemId: string, newStatus: string) => {
      if (newStatus === 'out_of_stock') {
        setOutOfStockItemId(itemId);
        return;
      }
      // Clear any existing out-of-stock config when changing away from out_of_stock
      updateItem(itemId, { status: newStatus as ItemStatus, outOfStockConfig: undefined });
    },
    [updateItem],
  );

  const confirmOutOfStock = useCallback(
    (mode: DurationMode, reEnableAt?: string) => {
      if (!outOfStockItemId) return;
      updateItem(outOfStockItemId, {
        status: 'out_of_stock',
        outOfStockConfig: {
          durationMode: mode,
          reEnableAt,
        },
      });
      const item = items.find((i) => i.id === outOfStockItemId);
      const modeLabel = mode === 'manual' ? 'until manually re-enabled'
        : mode === 'next_session' ? 'until next session'
        : `until ${reEnableAt ? new Date(reEnableAt).toLocaleString() : 'specified time'}`;
      addToast(`'${item?.name ?? 'Item'}' marked out of stock ${modeLabel}`, 'success');
      setOutOfStockItemId(null);
    },
    [outOfStockItemId, updateItem, items, addToast],
  );

  /* ------ PCF-8: Item reorder drag-and-drop ------ */
  const reorderSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleItemReorderDragEnd = useCallback(
    (catId: string) => (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const group = groupedByCategory.find((g) => g.category.id === catId);
      if (!group) return;
      const oldIndex = group.items.findIndex((i) => i.id === active.id);
      const newIndex = group.items.findIndex((i) => i.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(group.items, oldIndex, newIndex);
      reorderItemsInCategory(catId, reordered.map((i) => i.id));
    },
    [groupedByCategory, reorderItemsInCategory],
  );

  const saveReorder = useCallback(
    async (catId: string) => {
      const cat = categories.find((c) => c.id === catId);
      const catName = cat?.name ?? '';
      const locationId = selectedBranch?.id ?? (selectedBranch as any)?.locationId ?? '';
      const token = (auth as any)?.accessToken ?? (auth as any)?.access_token ?? null;

      // Build items payload with new sort orders from current display order
      const group = groupedByCategory.find((g) => g.category.id === catId);
      if (group && locationId) {
        const itemsPayload = group.items.map((item, idx) => ({
          itemID: item.id,
          sortOrder: idx + 1,
        }));
        setSavingReorderCatId(catId);
        try {
          await updateCategoryOnServer(
            { categoryId: catId, locationId, items: itemsPayload },
            null,
            token,
          );
          addToast(`Item order updated for '${catName}'`, 'success');
          // Clear cached responses so the next fetch reflects the new sort order.
          clearItemsCache();
          clearCategoriesCache();
          void fetchItems(locationId, token, { force: true });
        } catch {
          addToast(`Failed to save item order for '${catName}'`, 'error');
        } finally {
          setSavingReorderCatId(null);
        }
      } else {
        addToast(`Item order updated for '${catName}'`, 'success');
      }
      setReorderCategorySnapshots((prev) => {
        if (!prev[catId]) return prev;
        const next = { ...prev };
        delete next[catId];
        return next;
      });
      setReorderCategoryId(null);
    },
    [categories, addToast, groupedByCategory, selectedBranch, auth, updateCategoryOnServer, clearItemsCache, clearCategoriesCache, fetchItems],
  );

  const cancelReorder = useCallback((catId: string) => {
    const snapshot = reorderCategorySnapshots[catId];
    if (snapshot && snapshot.length > 0) {
      reorderItemsInCategory(catId, snapshot);
    }
    setReorderCategorySnapshots((prev) => {
      if (!prev[catId]) return prev;
      const next = { ...prev };
      delete next[catId];
      return next;
    });
    setReorderCategoryId(null);
  }, [reorderCategorySnapshots, reorderItemsInCategory]);

  /* Exclusive items drag-and-drop reorder */
  const handleExclusiveDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setExclusiveItems((prev) => {
      const oldIndex = prev.findIndex((i) => String(i.itemId) === String(active.id));
      const newIndex = prev.findIndex((i) => String(i.itemId) === String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const saveExclusiveOrder = useCallback(async () => {
    const locationId = selectedBranch?.id ?? (selectedBranch as any)?.locationId ?? '';
    const token = (auth as any)?.accessToken ?? (auth as any)?.access_token ?? null;
    const userId = (auth as any)?.userId ?? (auth as any)?.id ?? (auth as any)?.authUserId ?? '';
    if (!locationId || !exclusiveCategoryId) return;
    const payload = {
      exclusiveCategoryId,
      locationId,
      exclusiveItems: exclusiveItems.map((item, idx) => ({ itemId: item.itemId, sortOrder: idx + 1 })),
      userId,
    };
    setSavingExclusiveOrder(true);
    try {
      await updateExclusiveItemsSortOrderApi(payload, token);
      // Refresh exclusive list so the UI matches server order.
      try {
        const data = await getExclusiveItemsApi(locationId, token) as { exclusiveCategoryId?: string; items?: Array<any> };
        setExclusiveCategoryId(data.exclusiveCategoryId ?? null);
        const arr = Array.isArray(data.items) ? data.items : [];
        const normalized = arr
          .map((x: any) => ({
            itemId: String(x?.itemId ?? x?.itemID ?? x?.id ?? '').trim(),
            itemName: String(x?.itemName ?? x?.name ?? '').trim(),
            sortOrder: Number(x?.sortOrder ?? 0),
          }))
          .filter((x: any) => Boolean(x.itemId));
        normalized.sort((a: any, b: any) => Number(a.sortOrder) - Number(b.sortOrder));
        setExclusiveItems(normalized);
        setExclusiveBaselineItems(normalized);
      } catch {
        setExclusiveBaselineItems(exclusiveItems.map((item, idx) => ({ ...item, sortOrder: idx + 1 })));
      }
      addToast('Exclusive items order saved', 'success');
    } catch (err: unknown) {
      addToast((err as Error)?.message ?? 'Failed to save order', 'error');
    } finally {
      setSavingExclusiveOrder(false);
    }
  }, [exclusiveItems, exclusiveCategoryId, selectedBranch, auth, addToast]);

  const exclusiveOrderDirty = useMemo(() => {
    if (exclusiveItems.length !== exclusiveBaselineItems.length) return true;
    for (let i = 0; i < exclusiveItems.length; i += 1) {
      if (String(exclusiveItems[i].itemId) !== String(exclusiveBaselineItems[i].itemId)) return true;
    }
    return false;
  }, [exclusiveItems, exclusiveBaselineItems]);

  const cancelExclusiveOrder = useCallback(() => {
    setExclusiveItems(exclusiveBaselineItems.map((item) => ({ ...item })));
  }, [exclusiveBaselineItems]);

  useEffect(() => {
    const prevActiveMenu = prevActiveMenuRef.current;
    if (prevActiveMenu !== activeMenu) {
      if (Object.keys(reorderCategorySnapshots).length > 0) {
        Object.entries(reorderCategorySnapshots).forEach(([catId, itemIds]) => {
          if (itemIds.length > 0) reorderItemsInCategory(catId, itemIds);
        });
        setReorderCategorySnapshots({});
        setReorderCategoryId(null);
      }
      if (prevActiveMenu === 'exclusive' && exclusiveOrderDirty) {
        setExclusiveItems(exclusiveBaselineItems.map((item) => ({ ...item })));
      }
    }
    prevActiveMenuRef.current = activeMenu;
  }, [activeMenu, reorderCategorySnapshots, reorderItemsInCategory, exclusiveOrderDirty, exclusiveBaselineItems]);

  /* menu tab counts */
  const allItemCount = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((item) => {
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.itemCode.toLowerCase().includes(q)
      );
    }).length;
  }, [items, search]);

  const menuItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const q = search.toLowerCase().trim();
    menus.forEach((menu) => {
      counts[menu.id] = items.filter((item) => {
        const matchSearch =
          !q ||
          item.name.toLowerCase().includes(q) ||
          item.itemCode.toLowerCase().includes(q);
        return matchSearch && itemVisibleInMenu(menu, item);
      }).length;
    });
    return counts;
  }, [menus, items, search]);

  /* Exclusive items matched against the items store, sorted by sortOrder */
  const exclusiveMenuItems = useMemo(() => {
    const itemMap = new Map(items.map((i) => [String(i.id), i]));
    // IMPORTANT: preserve current state order for drag-and-drop.
    // We only sort by `sortOrder` once when hydrating from API; during DnD we reorder the array.
    return exclusiveItems
      .map((ei) => itemMap.get(String(ei.itemId)))
      .filter((i): i is MenuItem => i != null);
  }, [exclusiveItems, items]);

  const exclusiveFilteredMenuItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return exclusiveMenuItems;
    return exclusiveMenuItems.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      item.itemCode.toLowerCase().includes(q),
    );
  }, [exclusiveMenuItems, search]);

  const allTabBadgeCount = activeMenu === 'all' && search.trim() ? allItemCount : items.length;
  const exclusiveTabCount = activeMenu === 'exclusive' && search.trim() ? exclusiveFilteredMenuItems.length : exclusiveItems.length;

  const menuTabBadgeCount = useCallback(
    (menu: Menu) => {
      if (activeMenu === menu.id && search.trim()) return menuItemCounts[menu.id] ?? 0;
      if (menu.itemCount != null) return menu.itemCount;
      return menuItemCounts[menu.id] ?? 0;
    },
    [menuItemCounts, search, activeMenu],
  );

  /* category filter options --- show only leaf categories (no parents), sorted A---Z */
  const categoryOptions = useMemo(() => {
    const parentIds = new Set(categories.filter((c) => c.parentCategoryId).map((c) => c.parentCategoryId!));
    const leafOpts: { value: string; label: string }[] = [];
    activeCategoryIds.forEach((cid) => {
      const cat = categoryMap[cid];
      if (!cat) return;
      if (parentIds.has(cid)) return; /* skip parent categories */
      leafOpts.push({ value: cat.id, label: cat.name });
    });
    leafOpts.sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: 'all', label: 'All Categories' }, ...leafOpts];
  }, [activeCategoryIds, categoryMap, categories]);

  const orderTypeRows = useMemo(() => {
    const fromBranch = getOutletOrderTypeRows(selectedBranch as Record<string, unknown> | null | undefined);
    if (fromBranch.length > 0) return fromBranch;
    return GRID_CHANNEL_TYPES_FALLBACK.map((key) => ({ key, id: '', label: orderTypeLabels[key] }));
  }, [selectedBranch]);

  const outletOrderTypes = useMemo(
    () => getOrderTypesForBranch(selectedBranch as Record<string, unknown> | null | undefined),
    [selectedBranch],
  );

  /* expand / collapse */
  const toggleCategory = useCallback((catId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const base = search.trim() ? visibleCategoryDisplayRoots : categoryDisplayRoots;
    const ids = new Set<string>();
    const walk = (e: CategoryDisplayEntry) => {
      if (e.mode === 'single') ids.add(e.category.id);
      else {
        ids.add(`nest:${e.parent.id}`);
        e.entries.forEach(walk);
      }
    };
    base.forEach(walk);
    if (activeMenu === 'all' && uncategorizedItems.length > 0) {
      ids.add('__uncategorized__');
    }
    setExpandedCategories(ids);
  }, [categoryDisplayRoots, visibleCategoryDisplayRoots, search, activeMenu, uncategorizedItems.length]);

  // Auto-expand all categories on first data load
  const hasAutoExpanded = useRef(false);
  useEffect(() => {
    if (hasAutoExpanded.current || categoryDisplayRoots.length === 0) return;
    hasAutoExpanded.current = true;
    expandAll();
  }, [categoryDisplayRoots, expandAll]);

  const collapseAll = useCallback(() => {
    setExpandedCategories(new Set());
  }, []);

  const allExpanded = useMemo(() => {
    const base = search.trim() ? visibleCategoryDisplayRoots : categoryDisplayRoots;
    const ids = new Set<string>();
    const walk = (e: CategoryDisplayEntry) => {
      if (e.mode === 'single') ids.add(e.category.id);
      else {
        ids.add(`nest:${e.parent.id}`);
        e.entries.forEach(walk);
      }
    };
    base.forEach(walk);
    if (activeMenu === 'all' && uncategorizedItems.length > 0) {
      ids.add('__uncategorized__');
    }
    if (ids.size === 0) return false;
    return Array.from(ids).every((id) => expandedCategories.has(id));
  }, [categoryDisplayRoots, visibleCategoryDisplayRoots, search, activeMenu, uncategorizedItems.length, expandedCategories]);

  const leafGroupsForFooter = search.trim() ? visibleFlatLeafGroups : flatLeafGroups;

  /* total items across active view */
  const totalItemsInView = useMemo(() => {
    const catItemCount = flatLeafGroups.reduce((sum, g) => sum + g.items.length, 0);
    return catItemCount + uncategorizedItems.length;
  }, [flatLeafGroups, uncategorizedItems]);

  const categoriesWithItems = leafGroupsForFooter.filter((g) => g.items.length > 0).length;

  /* ------ styles --------------------------------------------------------------------------------------------------------------------------------------- */

  const tabBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 2,
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
    border: 'none',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  };

  const activeTabStyle: React.CSSProperties = {
    ...tabBase,
    background: '#B89550',
    color: '#fff',
    fontWeight: 600,
  };

  const inactiveTabStyle: React.CSSProperties = {
    ...tabBase,
    background: 'transparent',
    color: 'var(--t2)',
  };

  const countBadge = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    height: 18,
    padding: '0 5px',
    borderRadius: 9,
    fontSize: 10,
    fontWeight: 700,
    background: active ? 'rgba(255,255,255,0.25)' : 'var(--hover)',
    color: active ? '#fff' : 'var(--t3)',
  });

  const viewToggleBtn = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    borderRadius: 2,
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
    border: active ? '1px solid var(--accent)' : '1px solid var(--card-border, #E6DFD3)',
    background: active ? 'var(--accent-soft)' : 'var(--surface)',
    color: active ? 'var(--accent)' : 'var(--t2)',
    transition: 'all 0.15s ease',
  });

  const iconBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    borderRadius: 2,
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
    border: '1px solid var(--card-border, #E6DFD3)',
    background: 'var(--surface)',
    color: 'var(--t2)',
    transition: 'all 0.15s ease',
  };

  const catHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    cursor: 'pointer',
    transition: 'background 0.12s ease',
    userSelect: 'none',
  };

  const avatarStyle = (name: string): React.CSSProperties => ({
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: nameToColor(name),
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: 'var(--font-primary)',
  });

  const renderItemAvatar = (
    item: MenuItem,
    overrides: Pick<React.CSSProperties, 'width' | 'height' | 'fontSize' | 'borderRadius'>,
  ) => {
    const url = resolveCatalogItemImageUrl(item.imageUrl);
    const base: React.CSSProperties = {
      ...avatarStyle(item.name),
      ...overrides,
      overflow: 'hidden',
    };
    if (url) {
      return (
        <div style={base}>
          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      );
    }
    return <div style={base}>{getInitials(item.name)}</div>;
  };

  const orderTypePill: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 2,
    fontSize: 10,
    fontWeight: 600,
    background: 'rgba(184,149,80, 0.08)',
    color: '#B89550',
    whiteSpace: 'nowrap',
  };

  const gridNumInputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: '#FFFFFF',
    border: '1px solid #E6DFD3',
    borderRadius: 2,
    padding: '6px 8px',
    fontSize: 12,
    fontWeight: 600,
    color: '#453F39',
    textAlign: 'center',
    fontFamily: 'var(--font-primary)',
    outline: 'none',
  };

  /* ------ Grid Edit (Copy-style): editable price columns --------------------------------------------------- */

  const renderGridEditRows = (catItems: MenuItem[]) => {
    const gridHeaderCell: React.CSSProperties = {
      fontSize: 10,
      fontWeight: 700,
      color: '#9A9084',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      fontFamily: 'var(--font-primary)',
    };
    const rowFlex: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      padding: '10px 16px',
      borderBottom: '1px solid #F4F0E8',
      transition: 'background 0.12s ease',
    };

    return (
      <div style={{ overflowX: 'auto' }}>
        <div
          style={{
            ...rowFlex,
            background: '#FFFFFF',
            borderBottom: '1px solid #ECE5D8',
            paddingTop: 8,
            paddingBottom: 8,
          }}
        >
          <div style={{ width: 32, flexShrink: 0 }} />
          <div style={{ width: 200, flexShrink: 0, ...gridHeaderCell }}>Item</div>
          {visibleColumns.has('code') && (
            <div style={{ width: 128, flexShrink: 0, textAlign: 'center', ...gridHeaderCell }}>Code</div>
          )}
          {visibleColumns.has('price') && (
            <div style={{ width: 88, flexShrink: 0, textAlign: 'center', ...gridHeaderCell }}>Base</div>
          )}
          {orderTypeRows.map(({ key, id, label }) => (
            <div
              key={id || key}
              style={{
                width: 86,
                flexShrink: 0,
                textAlign: 'center',
                ...gridHeaderCell,
                paddingLeft: 4,
                paddingRight: 4,
                lineHeight: 1.2,
              }}
            >
              {label}
            </div>
          ))}
          {/* {visibleColumns.has('status') && (
            <div style={{ width: 104, flexShrink: 0, textAlign: 'center', ...gridHeaderCell }}>Status</div>
          )} */}
          {visibleColumns.has('actions') && <div style={{ width: 108, flexShrink: 0 }} />}
        </div>

        {catItems.map((item, idx) => {
          const statusDotColor =
            item.status === 'active'
              ? '#5F7A55'
              : item.status === 'draft'
                ? '#9A9084'
                : item.status === 'out_of_stock'
                  ? '#A63D2F'
                  : '#B07A2A';
          const firstSession =
            (item.sessionIds ?? []).length > 0
              ? sessions.find((s) => s.id === item.sessionIds![0])
              : undefined;
          const sessionLabel =
            firstSession && firstSession.name.length > 9
              ? `${firstSession.name.slice(0, 9)}---`
              : (firstSession?.name ?? '');

          return (
            <div
              key={item.id}
              id={`catalog-item-row-${item.id}`}
              style={{
                ...rowFlex,
                ...(idx === catItems.length - 1 ? { borderBottom: 'none' } : {}),
                ...(highlightItemId === item.id
                  ? { boxShadow: 'inset 0 0 0 2px rgba(184,149,80,0.9)', borderRadius: 2 }
                  : {}),
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ width: 32, flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={selectedItems.has(item.id)}
                  onChange={() => toggleItemSelection(item.id)}
                  style={{ width: 16, height: 16, margin: 0, accentColor: '#B89550', cursor: 'pointer' }}
                />
              </div>

              <div
                style={{
                  width: 200,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  minWidth: 0,
                  paddingRight: 8,
                }}
              >
                {renderItemAvatar(item, { width: 32, height: 32, fontSize: 12, borderRadius: 2 })}
                <div style={{ minWidth: 0 }}>
                  <div
                   
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--t1)',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                      lineHeight: 1.3,
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    {item.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#9A9084', fontFamily: 'var(--font-mono)' }}>
                    {formatItemCodeListDisplay(item.itemCode)}
                  </div>
                </div>
              </div>

              {visibleColumns.has('code') && (
                <div
                  style={{
                    width: 72,
                    flexShrink: 0,
                    textAlign: 'center',
                    fontSize: 12,
                    color: '#6E665D',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {formatItemCodeListDisplay(item.itemCode)}
                </div>
              )}

              {visibleColumns.has('price') && (
                <div style={{ width: 88, flexShrink: 0, padding: '0 6px' }}>
                  <input
                    type="number"
                    step="1"
                    key={`grid-base-${item.id}-${item.basePrice}`}
                    defaultValue={item.basePrice.toFixed(2)}
                    style={gridNumInputStyle}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v) && v >= 0) updateItem(item.id, { basePrice: v });
                    }}
                  />
                </div>
              )}

              {orderTypeRows.map(({ key, id }) => {
                const outletId = id || undefined;
                const currentPrice = channelPriceValue(item, key, outletId);
                return (
                  <div key={outletId || key} style={{ width: 86, flexShrink: 0, padding: '0 4px' }}>
                    <input
                      type="number"
                      step="1"
                      key={`grid-ch-${item.id}-${outletId || key}-${currentPrice}`}
                      defaultValue={currentPrice.toFixed(2)}
                      style={gridNumInputStyle}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        if (Number.isNaN(v) || v < 0) return;
                        // Update per-UUID (channelsByOrderTypeId) when available so sibling third parties
                        // keep their distinct prices. Also mirror into legacy `channelPrices[key]` so the
                        // form + save paths that still read OrderType-keyed price stay consistent.
                        const prevByOrderTypeId = item.channelsByOrderTypeId ?? {};
                        const nextByOrderTypeId = outletId
                          ? {
                              ...prevByOrderTypeId,
                              [outletId]: {
                                enabled: prevByOrderTypeId[outletId]?.enabled ?? true,
                                availabilityEnabled: prevByOrderTypeId[outletId]?.availabilityEnabled ?? true,
                                inactiveMode: prevByOrderTypeId[outletId]?.inactiveMode ?? null,
                                inactiveUntilTime: prevByOrderTypeId[outletId]?.inactiveUntilTime ?? null,
                                price: v,
                                name: prevByOrderTypeId[outletId]?.name,
                              },
                            }
                          : prevByOrderTypeId;
                        updateItem(item.id, {
                          channelPrices: { ...item.channelPrices, [key]: v },
                          ...(outletId ? { channelsByOrderTypeId: nextByOrderTypeId } : {}),
                        });
                      }}
                    />
                  </div>
                );
              })}

              {/* {visibleColumns.has('status') && (
                <div style={{ width: 104, flexShrink: 0, textAlign: 'center', padding: '0 4px' }}>
                  <CatalogDropdown
                    value={item.status}
                    onChange={(v) => handleStatusChange(item.id, v)}
                    options={ITEM_STATUS_OPTIONS}
                    ariaLabel="Item status"
                    menuMaxHeight={240}
                    triggerStyle={{
                      fontSize: 10,
                      fontWeight: 600,
                      fontFamily: 'var(--font-primary)',
                      color: statusDotColor,
                      border: `1px solid ${statusDotColor}44`,
                      borderRadius: 2,
                      padding: '4px 8px',
                      paddingRight: 28,
                      background: '#fff',
                      cursor: 'pointer',
                      maxWidth: '100%',
                      boxShadow: 'none',
                    }}
                  />
                </div>
              )} */}

              {visibleColumns.has('actions') && (
                <div
                  style={{
                    width: 108,
                    flexShrink: 0,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 2,
                  }}
                >
                  <button
                    type="button"
                    title="Edit"
                    style={catalogListActionButtonStyle}
                    onClick={() => { setEditingItemId(item.id); navigate(pcPaths.itemEdit); }}
                    onMouseEnter={catalogListActionEnterDefault}
                    onMouseLeave={catalogListActionLeaveDefault}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>edit</span>
                  </button>
                  <button
                    type="button"
                    title="Clone"
                    style={catalogListActionButtonStyle}
                    onClick={() => { void handleDuplicateItem(item); }}
                    onMouseEnter={catalogListActionEnterDefault}
                    onMouseLeave={catalogListActionLeaveDefault}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>content_copy</span>
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    style={catalogListActionButtonStyle}
                    onClick={(e) => {
                      e.stopPropagation();
                      openItemDeleteConfirm([item.id]);
                    }}
                    onMouseEnter={catalogListActionEnterDanger}
                    onMouseLeave={catalogListActionLeaveDanger}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>delete</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  /* close mobile three-dot menu on outside click */
  useEffect(() => {
    if (!mobileMenuItemId) return;
    const onDoc = (e: MouseEvent) => {
      if (mobileMenuRef.current?.contains(e.target as Node)) return;
      setMobileMenuItemId(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [mobileMenuItemId]);

  const mobileMenuBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const renderMobileItemRow = (item: MenuItem) => {
    const isMenuOpen = mobileMenuItemId === item.id;
    const btnEl = mobileMenuBtnRefs.current[item.id];
    const btnRect = btnEl?.getBoundingClientRect();

    return (
      <div
        key={item.id}
        id={`catalog-item-row-${item.id}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 12px',
          borderBottom: '1px solid #F4F0E8',
          gap: 10,
          ...(highlightItemId === item.id
            ? { boxShadow: 'inset 0 0 0 2px rgba(184,149,80,0.9)', borderRadius: 2 }
            : {}),
        }}
      >
        <input
          type="checkbox"
          checked={selectedItems.has(item.id)}
          onChange={() => toggleItemSelection(item.id)}
          style={{ width: 16, height: 16, accentColor: '#B89550', cursor: 'pointer', flexShrink: 0 }}
        />

        {renderItemAvatar(item, { width: 36, height: 36, fontSize: 12, borderRadius: 2 })}

        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', display: 'block', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3 }}>
            {item.name}
          </span>
          <span style={{ fontSize: 12, color: 'var(--t2)', fontFamily: 'var(--font-primary)' }}>
            {priceRangeLabel(item)}
          </span>
        </div>

        {/* Three-dot menu trigger */}
        <button
          ref={(el) => { mobileMenuBtnRefs.current[item.id] = el; }}
          type="button"
          onClick={(e) => { e.stopPropagation(); setMobileMenuItemId(isMenuOpen ? null : item.id); }}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--t3)' }}>more_vert</span>
        </button>

        {/* Portal-based popup so it's not clipped by overflow:hidden */}
        {isMenuOpen && btnRect && createPortal(
          <div
            ref={mobileMenuRef}
            style={{
              position: 'fixed',
              top: btnRect.bottom + 4,
              right: window.innerWidth - btnRect.right,
              zIndex: 10050,
              background: '#fff',
              borderRadius: 2,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
              border: '1px solid #E6DFD3',
              minWidth: 150,
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => { setMobileMenuItemId(null); setEditingItemId(item.id); navigate(pcPaths.itemEdit); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                border: 'none', background: 'transparent', cursor: 'pointer',
                padding: '10px 14px', fontSize: 13, fontWeight: 500, color: 'var(--t1)',
                fontFamily: 'var(--font-primary)',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--t2)' }}>edit</span>
              Edit
            </button>
            <button
              type="button"
              onClick={() => { setMobileMenuItemId(null); void handleDuplicateItem(item); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                border: 'none', background: 'transparent', cursor: 'pointer',
                padding: '10px 14px', fontSize: 13, fontWeight: 500, color: 'var(--t1)',
                fontFamily: 'var(--font-primary)',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--t2)' }}>content_copy</span>
              Clone
            </button>
            <div style={{ height: 1, background: '#F4F0E8' }} />
            <button
              type="button"
              onClick={() => { setMobileMenuItemId(null); openItemDeleteConfirm([item.id]); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                border: 'none', background: 'transparent', cursor: 'pointer',
                padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#A63D2F',
                fontFamily: 'var(--font-primary)',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18, color: '#A63D2F' }}>delete</span>
              Delete
            </button>
          </div>,
          document.body,
        )}
      </div>
    );
  };

  /* ------ render --------------------------------------------------------------------------------------------------------------------------------------- */

  const renderCategoryCard = (category: Category, catItems: MenuItem[], isUncategorized = false) => {
    const catId = isUncategorized ? '__uncategorized__' : category.id;
    const isExpanded = effectiveExpanded.has(catId);
    const categoryChannelPills = isUncategorized
      ? []
      : getCategoryEnabledChannelDescriptors(category, outletOrderTypes);

    return (
      <div
        key={catId}
        style={{
          background: 'var(--surface)',
          borderRadius: 2,
          border: '1px solid #E6DFD3',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          opacity: isUncategorized ? 0.92 : 1,
        }}
      >
        {/* Category Header */}
        <div
          style={catHeaderStyle}
          onClick={() => toggleCategory(catId)}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#FDFCF9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {!isMobile && !isUncategorized && (
            <CategoryHeaderCheckbox
              fullySelected={isCategoryFullySelected(category.id)}
              partiallySelected={isCategoryPartiallySelected(category.id)}
              onToggle={() => toggleCategorySelection(category.id)}
            />
          )}

          <span
            className="material-symbols-rounded"
            style={{
              fontSize: 20,
              color: 'var(--t3)',
              transition: 'transform 0.2s ease',
              transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            }}
          >
            expand_more
          </span>

          {isUncategorized && (
            <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--t3)' }}>language</span>
          )}

          <span style={{
            fontWeight: isUncategorized ? 600 : 700,
            fontSize: 14,
            color: isUncategorized ? 'var(--t3)' : 'var(--t1)',
            fontFamily: 'var(--font-primary)',
          }}>
            {category.name}
          </span>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px 8px',
              borderRadius: 2,
              fontSize: 12,
              fontWeight: 500,
              background: 'var(--hover)',
              color: 'var(--t2)',
            }}
          >
            {isMobile ? catItems.length : `${catItems.length} item${catItems.length !== 1 ? 's' : ''}`}
          </span>

          <div style={{ flex: 1 }} />

          {/* Channel pills (API channelVisibility + branch order types) — same as Categories listing */}
          {!isMobile && !isUncategorized && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              {categoryChannelPills.slice(0, MAX_VISIBLE_CATEGORY_ORDER_TYPES).map((ch) => (
                <span key={ch.id} style={orderTypePill}>
                  {ch.label}
                </span>
              ))}
              {categoryChannelPills.length > MAX_VISIBLE_CATEGORY_ORDER_TYPES && (
                <span
                  style={{ ...orderTypePill, background: 'var(--hover)', color: 'var(--t2)' }}
                  title={categoryChannelPills.slice(MAX_VISIBLE_CATEGORY_ORDER_TYPES).map((ch) => ch.label).join(', ')}
                >
                  +{categoryChannelPills.length - MAX_VISIBLE_CATEGORY_ORDER_TYPES}
                </span>
              )}
            </div>
          )}

          {/* Reorder icon — only when 2+ items (nothing to reorder with one) */}
          {!isUncategorized && catItems.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setReorderCategorySnapshots((prev) => (
                  prev[category.id] ? prev : { ...prev, [category.id]: catItems.map((item) => item.id) }
                ));
                setReorderCategoryId(category.id);
                setExpandedCategories((prev) => new Set(prev).add(category.id));
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                lineHeight: 0,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 4,
                color: 'var(--t3)',
              }}
              title="Reorder items"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 20 }}>swap_vert</span>
            </button>
          )}
        </div>

        {/* Expanded: Item rows */}
        {isExpanded && (
          <div style={{ borderTop: '1px solid #ECE5D8' }}>
            {/* PCF-8: Reorder mode banner */}
            {reorderCategoryId === catId && catItems.length > 1 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 16px', background: 'rgba(176,122,42, 0.08)',
                borderBottom: '1px solid rgba(176,122,42, 0.2)',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#B07A2A', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 16 }}>swap_vert</span>
                  Reorder mode --- drag items to rearrange
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => cancelReorder(catId)} style={{
                    padding: '4px 12px', borderRadius: 2, border: '1px solid #E6DFD3',
                    background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--t2)',
                  }}>Cancel</button>
                  <button type="button" onClick={() => saveReorder(catId)} disabled={savingReorderCatId === catId} style={{
                    padding: '4px 12px', borderRadius: 2, border: 'none',
                    background: '#B07A2A', cursor: savingReorderCatId === catId ? 'not-allowed' : 'pointer',
                    fontSize: 12, fontWeight: 600, color: '#fff',
                    opacity: savingReorderCatId === catId ? 0.6 : 1,
                  }}>{savingReorderCatId === catId ? 'Saving…' : 'Save Order'}</button>
                </div>
              </div>
            )}
            {catItems.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 32, color: '#E6DFD3', display: 'block', marginBottom: 8 }}>inventory_2</span>
                <p style={{ fontSize: 12, color: 'var(--t3)', margin: 0 }}>
                  {isUncategorized
                    ? 'No uncategorized items. Items without a category appear here.'
                    : 'No items in this category.'}
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              renderGridEditRows(catItems)
            ) : reorderCategoryId === catId && catItems.length > 1 ? (
              <DndContext sensors={reorderSensors} collisionDetection={closestCenter} onDragEnd={handleItemReorderDragEnd(catId)}>
                <SortableContext items={catItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  {catItems.map((item) => (
                    <SortableItemRow key={item.id} item={item} renderItemRow={renderItemRow} />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              <>
                {renderStandardHeaderRow()}
                {catItems.map((item) => isMobile ? renderMobileItemRow(item) : renderItemRow(item))}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const listCategoryDisplayRoots = search.trim() ? visibleCategoryDisplayRoots : categoryDisplayRoots;

  const renderCategoryDisplayEntry = (entry: CategoryDisplayEntry) => {
    if (entry.mode === 'single') {
      return renderCategoryCard(entry.category, entry.items, false);
    }
    const parentChannelPills = getCategoryEnabledChannelDescriptors(entry.parent, outletOrderTypes);
    const nestKey = `nest:${entry.parent.id}`;
    const isNestExpanded = effectiveExpanded.has(nestKey);
    const nItems = countItemsInDisplayEntry(entry);
    return (
      <div
        key={nestKey}
        style={{
          background: 'var(--surface)',
          borderRadius: 2,
          border: '1px solid #E6DFD3',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div
          style={catHeaderStyle}
          onClick={() => toggleCategory(nestKey)}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#FDFCF9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {!isMobile && (
            <CategoryHeaderCheckbox
              fullySelected={isNestFullySelected(entry)}
              partiallySelected={isNestPartiallySelected(entry)}
              onToggle={() => toggleNestSelection(entry)}
            />
          )}
          <span
            className="material-symbols-rounded"
            style={{
              fontSize: 20,
              color: 'var(--t3)',
              transition: 'transform 0.2s ease',
              transform: isNestExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            }}
          >
            expand_more
          </span>
          <span
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--t1)',
              fontFamily: 'var(--font-primary)',
            }}
          >
            {entry.parent.name}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px 8px',
              borderRadius: 2,
              fontSize: 12,
              fontWeight: 500,
              background: 'var(--hover)',
              color: 'var(--t2)',
            }}
          >
            {nItems} item{nItems !== 1 ? 's' : ''}
          </span>
          <div style={{ flex: 1 }} />
          {!isMobile && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              {parentChannelPills.slice(0, MAX_VISIBLE_CATEGORY_ORDER_TYPES).map((ch) => (
                <span key={ch.id} style={orderTypePill}>
                  {ch.label}
                </span>
              ))}
              {parentChannelPills.length > MAX_VISIBLE_CATEGORY_ORDER_TYPES && (
                <span
                  style={{ ...orderTypePill, background: 'var(--hover)', color: 'var(--t2)' }}
                  title={parentChannelPills.slice(MAX_VISIBLE_CATEGORY_ORDER_TYPES).map((ch) => ch.label).join(', ')}
                >
                  +{parentChannelPills.length - MAX_VISIBLE_CATEGORY_ORDER_TYPES}
                </span>
              )}
            </div>
          )}
        </div>
        {isNestExpanded && (
          <div
            style={{
              borderTop: '1px solid #ECE5D8',
              padding: '10px 10px 10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              background: '#FDFCF9',
            }}
          >
            {entry.entries.map((e) => (
              <Fragment key={e.mode === 'single' ? e.category.id : `nest:${e.parent.id}`}>
                {renderCategoryDisplayEntry(e)}
              </Fragment>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderItemRow = (item: MenuItem) => {
    const statusDotColor = item.status === 'active' ? '#5F7A55' : item.status === 'draft' ? '#9A9084' : item.status === 'out_of_stock' ? '#A63D2F' : '#B07A2A';
    const varCount = item.variations?.length ?? item.variationCount ?? 0;
    const stationTagIds =
      item.kitchenStationIds && item.kitchenStationIds.length > 0
        ? item.kitchenStationIds
        : item.kitchenStationId
          ? [item.kitchenStationId]
          : [];
    const stationLabel =
      stationTagIds.length > 0
        ? stationTagIds.map((kid) => stationNameById[kid] ?? kid).join(', ')
        : item.kitchenName ?? '---';

    if (viewMode === 'performance') {
      return (
        <div
          key={item.id}
          id={`catalog-item-row-${item.id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 16px',
            borderBottom: '1px solid #F4F0E8',
            cursor: 'pointer',
            transition: 'background 0.1s ease',
            gap: 12,
            ...(highlightItemId === item.id
              ? { boxShadow: 'inset 0 0 0 2px rgba(184,149,80,0.9)', borderRadius: 2 }
              : {}),
          }}
          onClick={() => { setEditingItemId(item.id); navigate(pcPaths.itemEdit); }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.015)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <input
            type="checkbox"
            checked={selectedItems.has(item.id)}
            onChange={() => toggleItemSelection(item.id)}
            style={{ width: 16, height: 16, margin: 0, accentColor: '#B89550', cursor: 'pointer', flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          />
          <PerformanceGlyph badge={item.performanceBadge} />
          {renderItemAvatar(item, { width: 36, height: 36, fontSize: 12, borderRadius: 2 })}
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', display: 'block', wordBreak: 'break-word' }}>{item.name}</span>
            <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>{formatItemCodeListDisplay(item.itemCode)}</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, width: 72, textAlign: 'right', flexShrink: 0 }} title={item.pricingStrategy === 'menu_specific' ? `Price varies by menu. Base: $${item.basePrice.toFixed(2)}` : undefined}>
            {priceRangeLabel(item)}
            {item.pricingStrategy === 'menu_specific' && (
              <span className="material-symbols-rounded" style={{ fontSize: 12, color: '#B07A2A', marginLeft: 3, verticalAlign: 'middle' }}>sell</span>
            )}
          </span>
          <div style={{ width: 56, textAlign: 'right', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{item.unitsSold7d ?? '---'}</span>
            <span style={{ display: 'block', fontSize: 9, color: 'var(--t3)' }}>7d</span>
          </div>
          <div style={{ width: 56, textAlign: 'right', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{item.unitsSold30d ?? '---'}</span>
            <span style={{ display: 'block', fontSize: 9, color: 'var(--t3)' }}>30d</span>
          </div>
          <div style={{ width: 72, textAlign: 'right', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#5F7A55' }}>
              {item.revenue30d != null ? `$${item.revenue30d.toLocaleString()}` : '---'}
            </span>
            <span style={{ display: 'block', fontSize: 9, color: 'var(--t3)' }}>30d rev</span>
          </div>
        </div>
      );
    }

    return (
      <div
        key={item.id}
        id={`catalog-item-row-${item.id}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 16px',
          borderBottom: '1px solid #F4F0E8',
          cursor: viewMode === 'grid' ? 'default' : 'pointer',
          transition: 'background 0.1s ease',
          gap: 12,
          ...(highlightItemId === item.id
            ? { boxShadow: 'inset 0 0 0 2px rgba(184,149,80,0.9)', borderRadius: 2 }
            : {}),
        }}
        onClick={viewMode === 'grid' ? undefined : () => { setEditingItemId(item.id); navigate(pcPaths.itemEdit); }}
        onMouseEnter={(e) => { if (viewMode !== 'grid') e.currentTarget.style.background = 'rgba(0,0,0,0.015)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        {visibleColumns.has('selection') && (
          <input
            type="checkbox"
            checked={selectedItems.has(item.id)}
            onChange={() => toggleItemSelection(item.id)}
            style={{ width: 16, height: 16, margin: 0, accentColor: '#B89550', cursor: 'pointer', flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {visibleColumns.has('item') && (
          <>
            {renderItemAvatar(item, { width: 40, height: 40, fontSize: 14, borderRadius: 2 })}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', fontFamily: 'var(--font-primary)', minWidth: 0, wordBreak: 'break-word' }}>
                  {item.name}
                </span>
                {/* PCF-9: Dietary color dots — hidden
                {item.dietaryLabels?.length > 0 && (
                  <span style={{ display: 'inline-flex', gap: 3 }}>
                    {item.dietaryLabels.slice(0, 3).map((label) => {
                      const labelName = typeof label === 'string' ? label : label.name;
                      const dotColor = getColorForTag(labelName);
                      return dotColor ? (
                        <span key={labelName} title={labelName} style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                      ) : null;
                    })}
                  </span>
                )}
                */}
                <PerformanceGlyph badge={item.performanceBadge} />
              </div>
            </div>
          </>
        )}

        {visibleColumns.has('code') && (() => {
          const display = formatItemCodeListDisplay(item.itemCode);
          return (
            <div style={{ width: 128, textAlign: 'center', flexShrink: 0, overflow: 'hidden' }} title={display}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--t2)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {display}
              </span>
            </div>
          );
        })()}

        {visibleColumns.has('age_restriction') && (
          <div style={{ width: 56, textAlign: 'center', flexShrink: 0 }}>
            {item.isAgeRestricted
              ? <span style={{ fontSize: 11, color: 'var(--t2)' }}>{item.minAge}+</span>
              : <span style={{ fontSize: 12, color: 'var(--t3)' }}>-</span>
            }
          </div>
        )}

        {visibleColumns.has('kitchen_station') && (
          <div style={{ width: 76, textAlign: 'center', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: 'var(--t3)' }} title={stationLabel}>
            {stationLabel}
          </div>
        )}

        {visibleColumns.has('modifiers') && (
          <div style={{ width: 72, textAlign: 'center', flexShrink: 0, fontSize: 11, color: 'var(--t2)' }}>
            {item.modifierIds?.length ?? 0}
          </div>
        )}

        {visibleColumns.has('variations') && (
          <div style={{ width: 72, textAlign: 'center', flexShrink: 0, fontSize: 11, color: 'var(--t2)' }}>
            {varCount}
          </div>
        )}

        {visibleColumns.has('sessions') && (
          <div style={{ width: 72, textAlign: 'center', flexShrink: 0, fontSize: 11, color: 'var(--t2)' }}>
            {item.sessionIds?.length ?? 0}
          </div>
        )}

        {visibleColumns.has('order_types') && (
          <div style={{ width: 84, textAlign: 'center', flexShrink: 0, fontSize: 11, color: 'var(--t2)' }}>
            {Object.values(item.visibilityPerOrderType ?? {}).filter(Boolean).length}
          </div>
        )}

        {visibleColumns.has('created_date') && (
          <div style={{ width: 106, textAlign: 'center', flexShrink: 0, fontSize: 11, color: 'var(--t2)' }}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '---'}
          </div>
        )}

        {visibleColumns.has('price') && (
          <div style={{ width: 108, textAlign: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', fontFamily: 'var(--font-primary)' }}>
              {priceRangeLabel(item)}
            </span>
          </div>
        )}

        {/* {visibleColumns.has('status') && (
          <div style={{ width: 112, textAlign: 'center', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            <CatalogDropdown
              value={item.status}
              onChange={(v) => handleStatusChange(item.id, v)}
              options={ITEM_STATUS_OPTIONS}
              ariaLabel="Item status"
              menuMaxHeight={240}
              triggerStyle={{
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                color: statusDotColor,
                border: `1px solid ${statusDotColor}40`,
                borderRadius: 2,
                padding: '4px 4px',
                paddingRight: 28,
                background: '#fff',
                cursor: 'pointer',
                maxWidth: '100%',
                boxShadow: 'none',
              }}
            />
            {item.status === 'out_of_stock' && item.outOfStockConfig && item.outOfStockConfig.durationMode !== 'manual' && (
              <div style={{ fontSize: 9, color: '#B07A2A', marginTop: 2, fontWeight: 500 }} title={
                item.outOfStockConfig.durationMode === 'specific_time' && item.outOfStockConfig.reEnableAt
                  ? `Until ${new Date(item.outOfStockConfig.reEnableAt).toLocaleString()}`
                  : 'Until next session'
              }>
                {item.outOfStockConfig.durationMode === 'next_session' ? '--- Next session' : `--- ${item.outOfStockConfig.reEnableAt ? new Date(item.outOfStockConfig.reEnableAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`}
              </div>
            )}
          </div>
        )} */}

        {visibleColumns.has('actions') && (
          <div
            style={{ width: 108, display: 'flex', justifyContent: 'center', gap: 2, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              style={catalogListActionButtonStyle}
              title="Edit"
              onClick={() => { setEditingItemId(item.id); navigate(pcPaths.itemEdit); }}
              onMouseEnter={catalogListActionEnterDefault}
              onMouseLeave={catalogListActionLeaveDefault}
            >
              <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>edit</span>
            </button>
            <button
              type="button"
              style={catalogListActionButtonStyle}
              title="Clone"
              onClick={() => { void handleDuplicateItem(item); }}
              onMouseEnter={catalogListActionEnterDefault}
              onMouseLeave={catalogListActionLeaveDefault}
            >
              <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>content_copy</span>
            </button>
            <button
              type="button"
              style={catalogListActionButtonStyle}
              title="Delete"
              onClick={() => openItemDeleteConfirm([item.id])}
              onMouseEnter={catalogListActionEnterDanger}
              onMouseLeave={catalogListActionLeaveDanger}
            >
              <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>delete</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderStandardHeaderRow = () => {
    if (isMobile || viewMode !== 'standard') return null;
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          borderBottom: '1px solid #ECE5D8',
          background: '#FFFFFF',
        }}
      >
        {visibleColumns.has('selection') && (
          <div style={{ width: 16, flexShrink: 0 }} />
        )}
        {visibleColumns.has('item') && (
          <>
            {/* Align header with rows: rows render an avatar before the item name */}
            <div style={{ width: 40, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Item
            </div>
          </>
        )}
        {visibleColumns.has('code') && (
          <div style={{ width: 128, textAlign: 'center', flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Code
          </div>
        )}
        {visibleColumns.has('age_restriction') && (
          <div style={{ width: 56, textAlign: 'center', flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Age
          </div>
        )}
        {visibleColumns.has('kitchen_station') && (
          <div style={{ width: 76, textAlign: 'center', flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Kitchen Station
          </div>
        )}
        {visibleColumns.has('modifiers') && (
          <div style={{ width: 72, textAlign: 'center', flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Modifiers
          </div>
        )}
        {visibleColumns.has('variations') && (
          <div style={{ width: 72, textAlign: 'center', flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Variations
          </div>
        )}
        {visibleColumns.has('sessions') && (
          <div style={{ width: 72, textAlign: 'center', flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Sessions
          </div>
        )}
        {visibleColumns.has('order_types') && (
          <div style={{ width: 84, textAlign: 'center', flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Order Types
          </div>
        )}
        {visibleColumns.has('created_date') && (
          <div style={{ width: 106, textAlign: 'center', flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Created Date
          </div>
        )}
        {visibleColumns.has('price') && (
          <div style={{ width: 108, textAlign: 'center', flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Price
          </div>
        )}
        {/* {visibleColumns.has('status') && (
          <div style={{ width: 128, textAlign: 'center', flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Status
          </div>
        )} */}
        {visibleColumns.has('actions') && (
          <div style={{ width: 108, textAlign: 'center', flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Actions
          </div>
        )}
      </div>
    );
  };

  // Exclusive list uses the same (standard) column layout as the main items table.
  const renderColumnHeader = () => renderStandardHeaderRow();

  /* ------ desktop layout ------ */
  const desktopLayout = (
    <DesktopLayout>
      <div style={{ padding: 25 }}>
        {/* Page Header */}
        <PageHeader
          icon={
            <span className="material-symbols-rounded" style={{ fontSize: 24, color: 'rgba(255,255,255,0.95)' }}>
              inventory_2
            </span>
          }
          title="Items"
          subtitle="Manage your menus, categories, and menu items"
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <CatalogHelpLink topic="Items" Tutorial={ItemsTutorial} createPath={pcPaths.itemsCreate} />
            <Button
              icon={
                <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'rgba(255,255,255,0.95)' }}>
                  add
                </span>
              }
                onClick={() => navigate(pcPaths.itemsCreate)}
            >
              Add Item
            </Button>
            </div>
          }
        />

        <ProductCatalogSyncBanner syncOnly />

        {/* Menu Tab Strip */}
        <div
          style={{
            background: 'var(--card, #fff)',
            border: '1px solid var(--card-border, #E6DFD3)',
            borderRadius: 2,
            padding: '8px 12px',
            marginBottom: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              overflowX: 'auto',
              scrollbarWidth: 'none',
            }}
          >
            <button
              style={activeMenu === 'all' ? activeTabStyle : inactiveTabStyle}
              onClick={() => { setActiveMenu('all'); setCategoryFilter('all'); setSearch(''); }}
              onMouseEnter={(e) => { if (activeMenu !== 'all') e.currentTarget.style.background = 'var(--hover)'; }}
              onMouseLeave={(e) => { if (activeMenu !== 'all') e.currentTarget.style.background = 'transparent'; }}
            >
              All Items
              <span style={countBadge(activeMenu === 'all')}>{allTabBadgeCount}</span>
            </button>
            <button
              style={activeMenu === 'exclusive' ? activeTabStyle : inactiveTabStyle}
              onClick={() => { setActiveMenu('exclusive'); setCategoryFilter('all'); setSearch(''); }}
              onMouseEnter={(e) => { if (activeMenu !== 'exclusive') e.currentTarget.style.background = 'var(--hover)'; }}
              onMouseLeave={(e) => { if (activeMenu !== 'exclusive') e.currentTarget.style.background = 'transparent'; }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>star</span>
              Exclusive
              <span style={countBadge(activeMenu === 'exclusive')}>{exclusiveTabCount}</span>
            </button>
            {/* {menus.map((menu) => {
              const isActive = activeMenu === menu.id;
              const isDraft = menu.status === 'draft';
              return (
                <button
                  key={menu.id}
                  style={{ ...isActive ? activeTabStyle : inactiveTabStyle, position: 'relative' }}
                  onClick={() => { setActiveMenu(menu.id); setCategoryFilter('all'); }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--hover)'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  {menu.name}
                  <span style={countBadge(isActive)}>{menuTabBadgeCount(menu)}</span>
                  {isDraft && (
                    <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: '#B07A2A' }} />
                  )}
                </button>
              );
            })}

            <button
              style={{ ...inactiveTabStyle, color: 'var(--t3)', gap: 4 }}
              onClick={() => navigate(pcPaths.menusCreate)}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--t1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t3)'; }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>add</span>
              New Menu
            </button> */}
          </div>

          {/* {activeMenu !== 'all' && activeMenu !== 'exclusive' && (() => {
            const selectedMenu = menus.find((m) => m.id === activeMenu);
            if (!selectedMenu) return null;
            const statusColors: Record<string, { bg: string; color: string }> = {
              live: { bg: 'rgba(95,122,85,0.1)', color: '#5F7A55' },
              scheduled: { bg: 'rgba(176,122,42,0.1)', color: '#B07A2A' },
              draft: { bg: 'rgba(156,163,184,0.1)', color: '#9A9084' },
            };
            const sc = statusColors[selectedMenu.status] || statusColors.draft;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid var(--divider, #ECE5D8)', marginTop: 8 }}>
                {(selectedMenu.channels || []).map((ch) => (
                  <span key={ch} style={orderTypePill}>{orderTypeLabels[ch] || ch}</span>
                ))}
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 2, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color, textTransform: 'capitalize' }}>
                  {selectedMenu.status}
                </span>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  title="Menu settings"
                  onClick={() => { setEditingMenuId(selectedMenu.id); navigate(pcPaths.menuEdit); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 4,
                    borderRadius: 2,
                    color: 'var(--t3)',
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 20 }}>settings</span>
                </button>
              </div>
            );
          })()} */}
        </div>

        {/* Toolbar Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            padding: '10px 16px',
            minHeight: 56,
            background: 'var(--card, #fff)',
            border: '1px solid var(--card-border, #E6DFD3)',
            borderRadius: 2,
            marginTop: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ width: 280, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <SearchInput
              value={search}
              onChange={(v) => setSearch(v)}
              placeholder="Search items by name, code"
            />
          </div>
          {activeMenu !== 'exclusive' && (
            <div style={{ width: 180, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <CatalogDropdown
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={categoryOptions}
                ariaLabel="Filter items by category"
                triggerStyle={{
                  fontSize: 13,
                  fontFamily: 'var(--font-primary)',
                  color: 'var(--t1)',
                  backgroundColor: 'var(--surface, #fff)',
                  border: '1px solid var(--card-border, #E6DFD3)',
                  borderRadius: 2,
                  padding: '8px 32px 8px 14px',
                  width: '100%',
                  cursor: 'pointer',
                  boxShadow: 'none',
                }}
              />
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* View Mode Toggle — hidden, kept for future use */}
          {/* <div style={{ display: 'flex', gap: 0, border: '1px solid var(--card-border, #E6DFD3)', borderRadius: 2, overflow: 'hidden' }}>
            <button
              style={{ ...viewToggleBtn(viewMode === 'standard'), border: 'none', borderRadius: 0, borderRight: '1px solid var(--card-border, #E6DFD3)' }}
              onClick={() => setViewMode('standard')}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>view_list</span>
              Standard
            </button>
            <button
              style={{ ...viewToggleBtn(viewMode === 'grid'), border: 'none', borderRadius: 0, borderRight: '1px solid var(--card-border, #E6DFD3)' }}
              onClick={() => setViewMode('grid')}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>grid_view</span>
              Grid Edit
            </button>
            <button
              style={{ ...viewToggleBtn(viewMode === 'performance'), border: 'none', borderRadius: 0 }}
              onClick={() => setViewMode('performance')}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>bar_chart</span>
              Performance
            </button>
          </div> */}

          {/* Columns button */}
          <div style={{ position: 'relative' }} ref={columnsPanelRef}>
            <button
              style={{
                ...iconBtnStyle,
                ...(showColumnsPanel ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-soft)' } : {}),
              }}
              onClick={() => setShowColumnsPanel((p) => !p)}
            >
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>tune</span>
              Columns <span style={{ color: 'var(--t3)', fontSize: 11 }}>({visibleColumns.size}/{MAX_VISIBLE_COLUMNS})</span>
          </button>

            {/* Columns Panel Dropdown */}
            {showColumnsPanel && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: 280,
                  background: 'var(--card, #fff)',
                  border: '1px solid var(--card-border, #E6DFD3)',
                  borderRadius: 2,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  zIndex: 100,
                  padding: '16px 0',
                  maxHeight: 420,
                  overflowY: 'auto',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '0 16px 12px',
                    borderBottom: '1px solid #ECE5D8',
                  }}
                >
                  <span
                    style={{
                      flex: '1 1 auto',
                      minWidth: 0,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--t1)',
                      lineHeight: 1.35,
                    }}
                  >
                    Show / Hide Columns
                  </span>
                  <button
                    type="button"
                    onClick={resetColumns}
                    style={{
                      flex: '0 0 auto',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500,
                      color: '#B89550',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      whiteSpace: 'nowrap',
                      padding: '2px 0',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: 16, lineHeight: 1 }}>refresh</span>
                    Reset to default
                  </button>
                </div>

                {/* Always Visible */}
                <div style={{ padding: '12px 16px 4px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Always Visible</span>
                </div>
                {ALL_COLUMNS.filter((c) => c.group === 'always').map((col) => (
                  <div key={col.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px' }}>
                    <span style={{ fontSize: 13, color: 'var(--t2)' }}>{col.label}</span>
                    <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--t3)', opacity: 0.4 }}>lock</span>
                  </div>
                ))}

                {/* Standard Columns */}
                <div style={{ padding: '12px 16px 4px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Standard Columns</span>
                </div>
                {ALL_COLUMNS.filter((c) => c.group === 'standard').map((col) => {
                  const isOn = visibleColumns.has(col.key);
                  const toggleBlocked = columnLimitReached && !isOn;
                  return (
                  <div key={col.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px' }}>
                    <span style={{ fontSize: 13, color: 'var(--t1)', opacity: toggleBlocked ? 0.55 : 1 }}>{col.label}</span>
                    <button
                      type="button"
                      disabled={toggleBlocked}
                      aria-pressed={isOn}
                      title={toggleBlocked ? `Maximum ${MAX_VISIBLE_COLUMNS} columns are shown. Turn off another column to add this one.` : undefined}
                      aria-label={toggleBlocked ? `${col.label}: cannot enable, column limit reached` : `${col.label}, ${isOn ? 'on' : 'off'}`}
                      onClick={() => toggleColumn(col.key)}
                      style={{
                        width: 36, height: 20, borderRadius: 2, border: 'none', cursor: toggleBlocked ? 'not-allowed' : 'pointer',
                        background: isOn ? '#B89550' : '#D6CCBB',
                        position: 'relative', transition: 'background 0.2s ease',
                        padding: 0,
                        opacity: toggleBlocked ? 0.45 : 1,
                      }}
                    >
                      <span style={{
                        position: 'absolute',
                        top: 2, left: isOn ? 18 : 2,
                        width: 16, height: 16, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                      }} />
                    </button>
                  </div>
                  );
                })}

                {/* Extended Columns */}
                <div style={{ padding: '12px 16px 4px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Extended Columns</span>
                </div>
                {ALL_COLUMNS.filter((c) => c.group === 'extended').map((col) => {
                  const isOn = visibleColumns.has(col.key);
                  const toggleBlocked = columnLimitReached && !isOn;
                  return (
                  <div key={col.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px' }}>
                    <span style={{ fontSize: 13, color: 'var(--t1)', opacity: toggleBlocked ? 0.55 : 1 }}>{col.label}</span>
                    <button
                      type="button"
                      disabled={toggleBlocked}
                      aria-pressed={isOn}
                      title={toggleBlocked ? `Maximum ${MAX_VISIBLE_COLUMNS} columns are shown. Turn off another column to add this one.` : undefined}
                      aria-label={toggleBlocked ? `${col.label}: cannot enable, column limit reached` : `${col.label}, ${isOn ? 'on' : 'off'}`}
                      onClick={() => toggleColumn(col.key)}
                      style={{
                        width: 36, height: 20, borderRadius: 2, border: 'none', cursor: toggleBlocked ? 'not-allowed' : 'pointer',
                        background: isOn ? '#B89550' : '#D6CCBB',
                        position: 'relative', transition: 'background 0.2s ease',
                        padding: 0,
                        opacity: toggleBlocked ? 0.45 : 1,
                      }}
                    >
                      <span style={{
                        position: 'absolute',
                        top: 2, left: isOn ? 18 : 2,
                        width: 16, height: 16, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                      }} />
                    </button>
                  </div>
                  );
                })}
                <div
                  role={columnLimitReached ? 'status' : undefined}
                  style={{
                    marginTop: 8,
                    padding: columnLimitReached ? '10px 16px 12px' : '10px 16px 0',
                    borderTop: columnLimitReached ? '1px solid rgba(184,149,80, 0.2)' : '1px solid #ECE5D8',
                    background: columnLimitReached ? 'rgba(184,149,80, 0.07)' : 'transparent',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-primary)',
                      lineHeight: 1.45,
                      display: 'block',
                      color: columnLimitReached ? 'var(--t1)' : 'var(--t3)',
                    }}
                  >
                    {columnLimitReached
                      ? `Limit reached (${MAX_VISIBLE_COLUMNS}/${MAX_VISIBLE_COLUMNS}). Turn off a column to choose a different one.`
                      : `You can show up to ${MAX_VISIBLE_COLUMNS} columns (${visibleColumns.size}/${MAX_VISIBLE_COLUMNS} in use).`}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Expand / Collapse All — not applicable on Exclusive tab */}
          {activeMenu !== 'exclusive' && (
            <button style={iconBtnStyle} onClick={allExpanded ? collapseAll : expandAll}>
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>{allExpanded ? 'unfold_less' : 'unfold_more'}</span>
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedItems.size > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            padding: '10px 16px', marginBottom: 16, borderRadius: 2,
            background: 'rgba(184,149,80,0.06)', border: '1px solid rgba(184,149,80,0.15)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>
              {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
            </span>
            <span style={{ width: 1, height: 20, background: 'rgba(184,149,80,0.2)' }} />
            <BulkActionsMenu actions={bulkActions} />
            <div style={{ flex: 1 }} />
            <button
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 13, fontWeight: 500, color: 'var(--t2)', padding: '4px 8px',
              }}
              onClick={() => setSelectedItems(new Set())}
            >
              Clear selection
            </button>
          </div>
        )}
        {bulkKitchenPrintModal}

        {/* Exclusive Items List */}
        {activeMenu === 'exclusive' && (
          <div>
            {exclusiveLoading && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)', fontSize: 14 }}>Loading exclusive items…</div>
            )}
            {exclusiveError && (
              <div style={{ marginBottom: 16, padding: 12, background: '#F6E9E5', borderRadius: 2, color: '#8E3226', fontSize: 13 }}>
                {exclusiveError}
              </div>
            )}
            {!exclusiveLoading && !exclusiveError && exclusiveFilteredMenuItems.length === 0 && (
              <EmptyState
                title={search.trim() ? 'No exclusive items found' : 'No exclusive items'}
                description={search.trim() ? 'Try adjusting your search.' : 'No items have been marked as exclusive.'}
              />
            )}
            {!exclusiveLoading && exclusiveFilteredMenuItems.length > 0 && (
              <>
                {!search.trim() && exclusiveOrderDirty && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 14px', background: 'rgba(176,122,42, 0.08)',
                    border: '1px solid rgba(176,122,42, 0.2)', borderRadius: 2, marginBottom: 12,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#B07A2A', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-symbols-rounded" style={{ fontSize: 16 }}>swap_vert</span>
                      Exclusive order changed. Save or cancel.
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={cancelExclusiveOrder} style={{
                        padding: '4px 12px', borderRadius: 2, border: '1px solid #E6DFD3',
                        background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--t2)',
                      }}>Cancel</button>
                      <button type="button" onClick={saveExclusiveOrder} disabled={savingExclusiveOrder} style={{
                        padding: '4px 12px', borderRadius: 2, border: 'none',
                        background: '#B07A2A', cursor: savingExclusiveOrder ? 'not-allowed' : 'pointer',
                        fontSize: 12, fontWeight: 600, color: '#fff',
                        opacity: savingExclusiveOrder ? 0.7 : 1,
                      }}>{savingExclusiveOrder ? 'Saving…' : 'Save Order'}</button>
                    </div>
                  </div>
                )}
                <div style={{
                  background: 'var(--card, #fff)',
                  border: '1px solid var(--card-border, #E6DFD3)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  {renderColumnHeader()}
                  {search.trim() ? (
                    <>
                      {exclusiveFilteredMenuItems.map((item) => isMobile ? renderMobileItemRow(item) : renderItemRow(item))}
                    </>
                  ) : (
                    <DndContext sensors={reorderSensors} collisionDetection={closestCenter} onDragEnd={handleExclusiveDragEnd}>
                      <SortableContext items={exclusiveFilteredMenuItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                        {exclusiveFilteredMenuItems.map((item) => (
                          <SortableItemRow key={item.id} item={item} renderItemRow={renderItemRow} />
                        ))}
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Category Accordion List */}
        {activeMenu !== 'exclusive' && showCatalogListShimmer ? <ItemsShimmer /> : null}
        {activeMenu !== 'exclusive' && (itemsError || categoriesError) && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              background: '#F6E9E5',
              borderRadius: 2,
              color: '#8E3226',
              fontSize: 13,
            }}
          >
            {itemsError || categoriesError}
          </div>
        )}
        {activeMenu !== 'exclusive' && (
          showCatalogListShimmer ? null : catalogReadyForBranch && totalItemsInView === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #E6DFD3', borderRadius: 2 }}>
              <CatalogListEmptyState
                icon="inventory_2"
                name="items"
                description={
                  search || categoryFilter !== 'all' || activeMenu !== 'all'
                    ? 'Try adjusting your search, filter.'
                    : 'Create your first item to get started.'
                }
                action={
                  !search && categoryFilter === 'all' && activeMenu === 'all' ? (
                    <Button onClick={() => navigate(pcPaths.itemsCreate)}>Add Item</Button>
                  ) : undefined
                }
              />
            </div>
          ) : catalogReadyForBranch ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {listCategoryDisplayRoots.map((entry) => (
                <Fragment key={entry.mode === 'single' ? entry.category.id : `rootnest:${entry.parent.id}`}>
                  {renderCategoryDisplayEntry(entry)}
                </Fragment>
              ))}

              {/* Uncategorized --- only when there are uncategorized items */}
              {activeMenu === 'all' && uncategorizedItems.length > 0 &&
                renderCategoryCard(
                  {
                    id: '__uncategorized__',
                    name: 'Uncategorized',
                    description: '',
                    itemCount: 0,
                    isVisible: true,
                    sortPosition: 999,
                    orderTypeVisibility: {
                      dine_in: false,
                      takeout: false,
                      delivery: false,
                      online_ordering: false,
                      catering: false,
                    },
                  },
                  uncategorizedItems,
                  true,
                )}
            </div>
          ) : null
        )}

        {/* Footer summary */}
        {activeMenu !== 'exclusive' && catalogReadyForBranch && (leafGroupsForFooter.length > 0 || uncategorizedItems.length > 0) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '0 4px' }}>
            <span style={{ fontSize: 12, color: 'var(--t2)' }}>
              {categoriesWithItems}{' '}
              categor
              {(leafGroupsForFooter.length +
                (activeMenu === 'all' && uncategorizedItems.length > 0 ? 1 : 0)) ===
              1
                ? 'y'
                : 'ies'}{' '}
              -- {totalItemsInView} items total
            </span>
            {/* {activeMenu !== 'all' && (() => {
              const selectedMenu = menus.find((m) => m.id === activeMenu);
              return selectedMenu ? (
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>
                  Viewing: <strong style={{ color: 'var(--t1)' }}>{selectedMenu.name}</strong>
                </span>
              ) : null;
            })()} */}
          </div>
        )}
      </div>

      <DeleteConfirmationModal
        open={Boolean(pendingDeleteIds?.length)}
        onClose={() => setPendingDeleteIds(null)}
        onConfirm={confirmPendingDeletes}
        confirmLoading={deletingItems}
        title={(() => {
          const ids = pendingDeleteIds;
          if (!ids?.length) return deleteConfirmTitle('this item');
          if (ids.length === 1) {
            const one = items.find((i) => i.id === ids[0]);
            return deleteConfirmTitle(one?.name ?? 'this item');
          }
          return `Delete ${ids.length} items?`;
        })()}
        description={(() => {
          const ids = pendingDeleteIds;
          if (!ids?.length) return null;
          if (ids.length === 1) {
            return 'This will remove the item from categories and anywhere it is linked. This cannot be undone.';
          }
          return `This will permanently delete ${ids.length} items from your catalog and remove them from categories. This cannot be undone.`;
        })()}
      />

      {/* PCF-4: Bulk Toggle Confirmation Modal */}
      <Modal
        open={!!bulkToggleTarget}
        onClose={() => setBulkToggleTarget(null)}
        title={bulkToggleTarget?.action === 'disable' ? 'Disable All Items in Category' : 'Enable All Items in Category'}
        width={440}
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setBulkToggleTarget(null)}
              style={{
                padding: '8px 20px', borderRadius: 2, border: '1px solid #E6DFD3',
                background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                color: 'var(--t1)', fontFamily: 'var(--font-primary)',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmBulkToggle}
              style={{
                padding: '8px 20px', borderRadius: 2, border: 'none',
                background: bulkToggleTarget?.action === 'disable' ? '#A63D2F' : '#5F7A55',
                cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff',
                fontFamily: 'var(--font-primary)',
              }}
            >
              {bulkToggleTarget?.action === 'disable' ? 'Disable Items' : 'Enable Items'}
            </button>
          </div>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--t2)', margin: '0 0 16px', lineHeight: 1.5 }}>
          {bulkToggleTarget?.action === 'disable'
            ? `This will set ${getItemsInCategory(bulkToggleTarget?.catId ?? '', bulkToggleTarget?.includeSubcategories ?? false).length} items in '${categories.find((c) => c.id === bulkToggleTarget?.catId)?.name ?? ''}' to Hidden. They will not appear on any customer-facing channel.`
            : `This will set eligible items in '${categories.find((c) => c.id === bulkToggleTarget?.catId)?.name ?? ''}' to Active. Items missing required fields will remain at their current status.`}
        </p>
        {bulkToggleTarget && hasSubcategories(bulkToggleTarget.catId) && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--t1)', fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={bulkToggleTarget.includeSubcategories}
              onChange={(e) => setBulkToggleTarget({ ...bulkToggleTarget, includeSubcategories: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: '#B89550' }}
            />
            Include subcategories
          </label>
        )}
      </Modal>

      {/* PCF-10: Out of Stock Duration Modal */}
      <OutOfStockDurationModal
        open={!!outOfStockItemId}
        onClose={() => setOutOfStockItemId(null)}
        onConfirm={confirmOutOfStock}
        itemName={items.find((i) => i.id === outOfStockItemId)?.name ?? ''}
        defaultMode="manual"
      />
    </DesktopLayout>
  );

  /* ------ mobile layout ------ */
  const mobileLayout = (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif" }}>
      {/* mobile header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span onClick={() => navigate(PC_BASE)} className="material-symbols-rounded" style={{ fontSize: 22, color: '#453F39', cursor: 'pointer' }}>arrow_back</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: 0 }}>Items</h1>
        </div>
        <CatalogHelpLink topic="Items" Tutorial={ItemsTutorial} createPath={pcPaths.itemsCreate} />
      </div>

      <div style={{ padding: 16 }}>
        <ProductCatalogSyncBanner compact syncOnly />

        {/* Menu Tab Strip */}
        <div style={{ background: '#fff', border: '1px solid #E6DFD3', borderRadius: 2, padding: '8px 10px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', scrollbarWidth: 'none' }}>
            <button
              style={activeMenu === 'all' ? activeTabStyle : inactiveTabStyle}
              onClick={() => { setActiveMenu('all'); setCategoryFilter('all'); setSearch(''); }}
            >
              All
              <span style={countBadge(activeMenu === 'all')}>{allTabBadgeCount}</span>
            </button>
            <button
              style={activeMenu === 'exclusive' ? activeTabStyle : inactiveTabStyle}
              onClick={() => { setActiveMenu('exclusive'); setCategoryFilter('all'); setSearch(''); }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 13 }}>star</span>
              Exclusive
              <span style={countBadge(activeMenu === 'exclusive')}>{exclusiveTabCount}</span>
            </button>
            {/* {menus.map((menu) => {
              const isActive = activeMenu === menu.id;
              return (
                <button
                  key={menu.id}
                  style={isActive ? activeTabStyle : inactiveTabStyle}
                  onClick={() => { setActiveMenu(menu.id); setCategoryFilter('all'); }}
                >
                  {menu.name}
                  <span style={countBadge(isActive)}>{menuTabBadgeCount(menu)}</span>
                </button>
              );
            })} */}
          </div>
        </div>

        {/* Search + Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          <SearchInput value={search} onChange={(v) => setSearch(v)} placeholder="Search items..." />
          {activeMenu !== 'exclusive' && (
            <CatalogDropdown
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categoryOptions}
              ariaLabel="Filter items by category"
              triggerStyle={{
                fontSize: 13, fontFamily: 'var(--font-primary)', color: 'var(--t1)',
                backgroundColor: '#fff', border: '1px solid #E6DFD3', borderRadius: 2,
                padding: '8px 32px 8px 14px', width: '100%', cursor: 'pointer', boxShadow: 'none',
              }}
            />
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedItems.size > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            padding: '8px 12px', marginBottom: 12, borderRadius: 2,
            background: 'rgba(184,149,80,0.06)', border: '1px solid rgba(184,149,80,0.15)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>
              {selectedItems.size} selected
            </span>
            <div style={{ flex: 1 }} />
            <BulkActionsMenu compact actions={bulkActions} />
            <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--t2)', padding: 4 }}
              onClick={() => setSelectedItems(new Set())}>
              Clear
            </button>
          </div>
        )}
        {bulkKitchenPrintModal}

        {/* Exclusive Items List --- Mobile */}
        {activeMenu === 'exclusive' && (
          <div>
            {exclusiveLoading && (
              <div style={{ textAlign: 'center', padding: 32, color: '#9A9084', fontSize: 14 }}>Loading exclusive items…</div>
            )}
            {exclusiveError && (
              <div style={{ marginBottom: 12, padding: 12, background: '#F6E9E5', borderRadius: 2, color: '#8E3226', fontSize: 13 }}>
                {exclusiveError}
              </div>
            )}
            {!exclusiveLoading && !exclusiveError && exclusiveFilteredMenuItems.length === 0 && (
              <EmptyState
                title={search.trim() ? 'No exclusive items found' : 'No exclusive items'}
                description={search.trim() ? 'Try adjusting your search.' : 'No items have been marked as exclusive.'}
              />
            )}
            {!exclusiveLoading && exclusiveFilteredMenuItems.length > 0 && (
              <>
                {!search.trim() && exclusiveOrderDirty && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    padding: '8px 10px', marginBottom: 10, borderRadius: 2,
                    background: 'rgba(176,122,42, 0.08)', border: '1px solid rgba(176,122,42, 0.2)',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#B07A2A' }}>Exclusive order changed</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" onClick={cancelExclusiveOrder} style={{
                        padding: '4px 10px', borderRadius: 2, border: '1px solid #E6DFD3',
                        background: '#fff', fontSize: 11, fontWeight: 600, color: '#6E665D',
                      }}>Cancel</button>
                      <button type="button" onClick={saveExclusiveOrder} disabled={savingExclusiveOrder} style={{
                        padding: '4px 10px', borderRadius: 2, border: 'none',
                        background: '#B07A2A', color: '#fff', fontSize: 11, fontWeight: 600,
                        opacity: savingExclusiveOrder ? 0.7 : 1,
                      }}>{savingExclusiveOrder ? 'Saving…' : 'Save'}</button>
                    </div>
                  </div>
                )}
                {search.trim() ? (
                  <>
                    {exclusiveFilteredMenuItems.map((item) => renderMobileItemRow(item))}
                  </>
                ) : (
                  <DndContext sensors={reorderSensors} collisionDetection={closestCenter} onDragEnd={handleExclusiveDragEnd}>
                    <SortableContext items={exclusiveFilteredMenuItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                      {exclusiveFilteredMenuItems.map((item) => (
                        <SortableItemRow key={item.id} item={item} renderItemRow={renderMobileItemRow} />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </>
            )}
          </div>
        )}

        {/* Category Accordion List --- Mobile Cards */}
        {activeMenu !== 'exclusive' && showCatalogListShimmer ? <ItemsShimmer isMobile /> : null}
        {activeMenu !== 'exclusive' && (itemsError || categoriesError) && (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              background: '#F6E9E5',
              borderRadius: 2,
              color: '#8E3226',
              fontSize: 13,
            }}
          >
            {itemsError || categoriesError}
          </div>
        )}
        {activeMenu !== 'exclusive' && (
          showCatalogListShimmer ? null : catalogReadyForBranch && totalItemsInView === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #E6DFD3', borderRadius: 2 }}>
              <CatalogListEmptyState
                icon="inventory_2"
                name="items"
                description={
                  search || categoryFilter !== 'all' || activeMenu !== 'all'
                    ? 'Try adjusting your search or filter.'
                    : 'Create your first item to get started.'
                }
                action={
                  !search && categoryFilter === 'all' && activeMenu === 'all' ? (
                    <Button onClick={() => navigate(pcPaths.itemsCreate)}>Add Item</Button>
                  ) : undefined
                }
              />
            </div>
          ) : catalogReadyForBranch ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {listCategoryDisplayRoots.map((entry) => (
                <Fragment key={entry.mode === 'single' ? entry.category.id : `rootnest:${entry.parent.id}`}>
                  {renderCategoryDisplayEntry(entry)}
                </Fragment>
              ))}

              {activeMenu === 'all' && uncategorizedItems.length > 0 &&
                renderCategoryCard(
                  {
                    id: '__uncategorized__',
                    name: 'Uncategorized',
                    description: '',
                    itemCount: 0,
                    isVisible: true,
                    sortPosition: 999,
                    orderTypeVisibility: {
                      dine_in: false,
                      takeout: false,
                      delivery: false,
                      online_ordering: false,
                      catering: false,
                    },
                  },
                  uncategorizedItems,
                  true,
                )}
            </div>
          ) : null
        )}

        {/* Footer */}
        {activeMenu !== 'exclusive' && catalogReadyForBranch && totalItemsInView > 0 && (
          <div style={{ marginTop: 12, padding: '0 4px' }}>
            <span style={{ fontSize: 12, color: 'var(--t2)' }}>
              {categoriesWithItems} categor{categoriesWithItems === 1 ? 'y' : 'ies'} -- {totalItemsInView} items
            </span>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate(pcPaths.itemsCreate)}
        style={{
          position: 'fixed', bottom: 80, right: 16, width: 56, height: 56,
          background: '#B89550', color: '#fff', border: 'none', borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(184,149,80,0.35)', zIndex: 999, cursor: 'pointer',
        }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: 28 }}>add</span>
      </button>

      <DeleteConfirmationModal
        open={Boolean(pendingDeleteIds?.length)}
        onClose={() => setPendingDeleteIds(null)}
        onConfirm={confirmPendingDeletes}
        confirmLoading={deletingItems}
        title={(() => {
          const ids = pendingDeleteIds;
          if (!ids?.length) return deleteConfirmTitle('this item');
          if (ids.length === 1) {
            const one = items.find((i) => i.id === ids[0]);
            return deleteConfirmTitle(one?.name ?? 'this item');
          }
          return `Delete ${ids.length} items?`;
        })()}
        description={(() => {
          const ids = pendingDeleteIds;
          if (!ids?.length) return null;
          if (ids.length === 1) return 'This will remove the item from categories and anywhere it is linked. This cannot be undone.';
          return `This will permanently delete ${ids.length} items from your catalog and remove them from categories. This cannot be undone.`;
        })()}
      />
      <BottomNav />
    </div>
  );

  return isMobile ? mobileLayout : desktopLayout;
}
