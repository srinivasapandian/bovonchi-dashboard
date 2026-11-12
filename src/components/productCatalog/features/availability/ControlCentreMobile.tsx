import { useState, useMemo, useCallback, useEffect } from 'react';
import { resolveEffectiveState, categoryChannelState } from './resolveEffectiveState';
import type { OrderType, MenuItem, Category, EffectiveStateResult } from '../../data/types';
import {
  getItemAvailabilityBucket,
  itemInSelectedCategoryTree,
  countItemsMatchingSession,
  itemMatchesSessionFilter,
  getCategoryVisibilityBucketForCategory,
  getSubCategoryVisibilityBucket,
  normalizeCategoryFilterId,
  collectCategoryTreeIds,
  findSessionByFilterSelectionValue,
  normalizeSessionFilterId,
  buildCategoryFilterOptions,
  channelEffectiveTooltipLabel,
  blockingCategoryNameFromReasons,
  itemMatchesItemsTabSearchQuery,
  categoryMatchesCategoriesTabSearchQuery,
  formatItemCodeListDisplay,
  truncateControlCentreLabel,
} from './controlCentreFilterHelpers';
import { computeEndOfSessionInactiveUntil, computeEndOfDayInactiveUntil, formatInactiveUntilLocal, formatInactiveUntilFromDate } from './endOfSessionInactive';
import {
  ControlCentreFilterDropdown,
  ITEMS_TAB_AVAILABILITY_OPTIONS,
  CATEGORY_TAB_VISIBILITY_OPTIONS,
  type ControlCentreFilterOption,
} from './ControlCentreFilterDropdown';
import { useBranch } from '../../../../context/BranchContext';
import { useAuth } from '../../../../context/AuthContext';
import { CatalogDateTimePicker, todayIsoLocal } from '../../components/ui/CatalogDateTimePicker';
import { updateItemApi, partialUpdateItemApi, bulkEditItemApi } from '../../../../services/itemCatalogApi';
import { updateCategoryApi, partialUpdateCategoryAvailabilityApi, bulkEditCategoryAvailabilityApi } from '../../../../services/categoryCatalogApi';
import { useAppDispatch } from '../../../../redux/hooks';
import { invalidateFetchCache } from '../../../../redux/productCatalog/productCatalogActions';
import { useSessionsStore, useCategoriesStore, useItemsStore, useMenusStore } from '../../../../redux/productCatalog/productCatalogHooks';
import { ProductCatalogSyncBanner } from '../../components/ui/ProductCatalogSyncBanner';
import { markProductCatalogSyncNeeded } from '../../store/syncNeeded';

/* ─── Design tokens ─── */
const ACCENT  = '#B89550';
const PURPLE  = '#8C6A7A';
const TEAL    = '#5E8C7B';
const GREEN   = '#5F7A55';
const RED     = '#A63D2F';
const ORANGE  = '#B07A2A';
const T1      = '#453F39';
const T2      = '#6E665D';
const T3      = '#9A9084';
const BORDER  = '#E6DFD3';
const CARD_BG = '#FFFFFF';
const PAGE_BG = '#FFFFFF';

const CHANNELS: { key: OrderType; label: string; abbr: string; icon: string }[] = [
  // Hidden for now — Pickup is the only channel for the e-commerce storefront.
  // { key: 'dine_in',         label: 'Dine-in',  abbr: 'Dine',  icon: 'restaurant'     },
  // { key: 'takeout',         label: 'Takeout',   abbr: 'T/A',   icon: 'takeout_dining' },
  // { key: 'delivery',        label: 'Delivery',  abbr: 'Del',   icon: 'delivery_dining'},
  // { key: 'online_ordering', label: 'Online',    abbr: 'Web',   icon: 'language'       },
  // { key: 'catering',        label: 'Catering',  abbr: 'Cater', icon: 'room_service'   },
  // { key: 'takeout',         label: 'Pickup',    abbr: 'Pickup', icon: 'takeout_dining' },
  { key: 'takeout',         label: 'Online',    abbr: 'Online', icon: 'takeout_dining' },
];
/** Channel row with a stable `id` — equals the outlet orderTypeId UUID when loaded from branch, or `key` for the fallback list. */
type ChannelRow = { key: OrderType; label: string; abbr: string; icon: string; id: string };

type OutletOrderType = {
  id?: string;
  typeName?: string;
  typeGroup?: string;
  isEnabled?: number | boolean;
};

function isOrderTypeKey(value: string): value is OrderType {
  return value === 'dine_in' || value === 'takeout' || value === 'delivery' || value === 'online_ordering' || value === 'catering';
}

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
  if (/(online|gloria[_\s-]?food|web|app|digital|third[_\s-]?party)/.test(source)) return 'online_ordering';
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

function getCategorySharedAvailability(
  category: Category,
  channelRows: Array<{ id: string }>,
): boolean {
  const validIds = new Set(channelRows.map((c) => String(c.id ?? '').trim().toLowerCase()).filter(Boolean));
  const rows = (category.channelVisibility ?? []).filter((cv) =>
    validIds.has(String(cv.orderTypeId ?? '').trim().toLowerCase()),
  );
  const enabledRows = rows.filter((r) => r.enabled !== false);
  if (enabledRows.length === 0) return false;
  return enabledRows.every((r) => (r.availabilityEnabled ?? r.avaliblityEnable ?? true) !== false);
}

function getCategorySortPosition(category: Category): number {
  const value = Number(category.sortPosition);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function compareCategoriesBySortPosition(a: Category, b: Category): number {
  const byPosition = getCategorySortPosition(a) - getCategorySortPosition(b);
  if (byPosition !== 0) return byPosition;
  return a.name.localeCompare(b.name);
}

function sortItemsByCategoryPosition(items: MenuItem[], categoryId: string): MenuItem[] {
  return items
    .slice()
    .sort((a, b) => {
      const aPos = a.categorySortPositions?.[categoryId];
      const bPos = b.categorySortPositions?.[categoryId];
      const aHasPos = Number.isFinite(aPos);
      const bHasPos = Number.isFinite(bPos);
      if (aHasPos && bHasPos) {
        const diff = Number(aPos) - Number(bPos);
        if (diff !== 0) return diff;
      } else if (aHasPos) {
        return -1;
      } else if (bHasPos) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
}

function AvailabilityToggle({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{ width: 34, height: 20, borderRadius: 999, border: 'none', background: checked ? ORANGE : '#D6CCBB', position: 'relative', cursor: 'pointer', flexShrink: 0 }}
    >
      <span style={{ position: 'absolute', top: 2, left: checked ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left 0.15s ease' }} />
    </button>
  );
}

const STATE_CFG = {
  showing:  { label: 'Active',   icon: 'check_circle',  color: GREEN,  bg: `${GREEN}12`,  border: `${GREEN}30`  },
  sold_out: { label: 'OOS',      icon: 'cancel',         color: RED,    bg: `${RED}10`,    border: `${RED}25`    },
  hidden:   { label: 'Hidden',   icon: 'visibility_off', color: T3,     bg: '#F4F0E8',     border: BORDER        },
  /** Parent category not visible on this channel — item actions are hidden until category is on */
  blocked:  { label: 'Category off', icon: 'lock',       color: ORANGE, bg: `${ORANGE}10`, border: `${ORANGE}25` },
} as const;

type EntityTab    = 'items' | 'categories';

/* ═══════════════════════════════════════════════════
   Sub-components
═══════════════════════════════════════════════════ */

/* ── Bottom Sheet ── */
function BottomSheet({ open, onClose, children }: {
  open: boolean; onClose: () => void; children: React.ReactNode;
}) {
  if (!open) return null;
  /** Above fixed BottomNav (z-index 1000) so sheet content is not covered */
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: CARD_BG, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: '88vh', overflowY: 'auto',
        boxShadow: '0 -4px 40px rgba(0,0,0,0.14)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 8px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#D6CCBB' }} />
        </div>
        {/* Close control lives in each sheet header (aligned with title) */}
        <div style={{ padding: '0 20px 8px' }}>{children}</div>
      </div>
    </div>
  );
}

/* ── Channel pill (item card) ── */
function ChannelPill({ channel, state, onTap, disabled }: {
  channel: ChannelRow;
  state: EffectiveStateResult['effective'];
  onTap: () => void;
  disabled?: boolean;
}) {
  const cfg = STATE_CFG[state];
  const tip = `${channel.label}: ${channelEffectiveTooltipLabel(state)}`;
  return (
    <button
      type="button"
      disabled={disabled}
      title={tip}
      onClick={(e) => { e.stopPropagation(); onTap(); }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        padding: '8px 2px', borderRadius: 2, flex: '1 1 0', minWidth: 0,
        maxWidth: '100%', boxSizing: 'border-box',
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <div style={{ position: 'relative', lineHeight: 1 }}>
        <span className="material-symbols-rounded" style={{ fontSize: 18, color: state === 'hidden' ? T3 : T2, display: 'block' }}>
          {channel.icon}
        </span>
        <span className="material-symbols-rounded" style={{
          fontSize: 10, color: cfg.color,
          position: 'absolute', bottom: -3, right: -5,
          background: CARD_BG, borderRadius: '50%', lineHeight: 1,
        }}>
          {cfg.icon}
        </span>
      </div>
      <span style={{
        fontSize: 8, fontWeight: 700, color: state === 'hidden' ? T3 : T1, fontFamily: 'var(--font-primary)', letterSpacing: '0.2px',
        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center',
      }}
      >
        {channel.abbr}
      </span>
    </button>
  );
}

/* ── Action row (bottom sheet) ── */
function ActionRow({ icon, iconColor, label, sublabel, actionLabel, actionColor, actionBg, onTap, disabled }: {
  icon: string; iconColor: string; label: string; sublabel?: string;
  actionLabel: string; actionColor: string; actionBg: string;
  onTap: () => void; disabled?: boolean;
}) {
  return (
    <button
      type="button" onClick={onTap} disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '12px 14px', borderRadius: 2,
        border: `1px solid ${BORDER}`, background: disabled ? '#FFFFFF' : CARD_BG,
        cursor: disabled ? 'default' : 'pointer', textAlign: 'left',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 2, background: `${iconColor}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span className="material-symbols-rounded" style={{ fontSize: 20, color: iconColor }}>{icon}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T1, fontFamily: 'var(--font-primary)' }}>{label}</div>
        {sublabel && <div style={{ fontSize: 11, color: T3, fontFamily: 'var(--font-primary)', marginTop: 1 }}>{sublabel}</div>}
      </div>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '5px 11px', borderRadius: 2,
        background: actionBg, color: actionColor, fontFamily: 'var(--font-primary)', whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        {actionLabel}
      </span>
    </button>
  );
}

/* ── Item card ── */
function ItemCard({
  item,
  categories,
  channels,
  orderTypeIdByKey,
  selected,
  onToggleSelected,
  onChannelTap,
  onAllChannelsTap,
}: {
  item: MenuItem;
  categories: Category[];
  channels: ChannelRow[];
  orderTypeIdByKey: Partial<Record<OrderType, string>>;
  selected: boolean;
  onToggleSelected: () => void;
  onChannelTap: (ch: OrderType, outletId: string) => void;
  onAllChannelsTap: () => void;
}) {
  const states = useMemo(() => {
    const r: Record<string, EffectiveStateResult> = {};
    channels.forEach((ch) => {
      // Override orderTypeIdByKey for this specific outlet so resolveEffectiveState
      // looks up the correct channelVisibility row (important for T-type channels
      // where multiple outlets share the same OrderType key).
      const localOtk = isOrderTypeKey(ch.id)
        ? orderTypeIdByKey
        : { ...orderTypeIdByKey, [ch.key]: ch.id };
      r[ch.id] = resolveEffectiveState(item, ch.key, {
        categories,
        channel86Records: [],
        orderTypeIdByKey: localOtk,
        outletOrderTypeId: isOrderTypeKey(ch.id) ? orderTypeIdByKey[ch.key] : ch.id,
      });
    });
    return r;
  }, [item, categories, channels, orderTypeIdByKey]);

  const dominated = useMemo(() => {
    const effs = channels.map((ch) => states[ch.id].effective);
    if (effs.every((e) => e === 'showing')) return 'showing';
    if (effs.some((e) => e === 'sold_out')) return 'sold_out';
    if (effs.some((e) => e === 'showing')) return 'showing';
    return 'hidden';
  }, [states, channels]);

  const stripeColor = dominated === 'showing' ? GREEN : dominated === 'sold_out' ? RED : T3;
  const itemNameLabel = truncateControlCentreLabel(item.name);

  return (
    <div style={{
      margin: '0 0 6px 0', borderRadius: 2, background: CARD_BG,
      border: `1px solid ${BORDER}`, overflow: 'hidden',
      display: 'flex', maxWidth: '100%', boxSizing: 'border-box',
    }}>
      {/* Left state stripe */}
      <div style={{ width: 4, background: stripeColor, flexShrink: 0 }} />

      <div style={{ flex: '1 1 0', padding: '11px 10px', minWidth: 0 }}>
        {/* Row 1: Name | price + ⋮ — price replaces former status badge slot */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelected()}
                style={{ width: 16, height: 16, accentColor: ACCENT, cursor: 'pointer', flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}
              />
              <div title={itemNameLabel.title} style={{ fontSize: 13, fontWeight: 700, color: T1, fontFamily: 'var(--font-primary)', lineHeight: 1.3, whiteSpace: 'normal', wordBreak: 'break-word', flex: '1 1 0', minWidth: 0 }}>
                {itemNameLabel.display}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{
              fontSize: 13,
              fontWeight: 700,
              color: T2,
              fontFamily: 'var(--font-primary)',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
            }}>
              ${item.basePrice.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={onAllChannelsTap}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', borderRadius: 2 }}
              title="Manage all channels"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18, color: T3 }}>more_vert</span>
            </button>
          </div>
        </div>

        {/* Row 2: Channel pills */}
        <div style={{ display: 'flex', gap: 4, width: '100%', minWidth: 0 }}>
          {channels.map((ch) => (
            <ChannelPill key={ch.id} channel={ch} state={states[ch.id].effective} onTap={() => onChannelTap(ch.key, ch.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Category card (for categories tab) ── */
function CategoryCard({
  cat,
  parentCat,
  channels,
  orderTypeIdByKey,
  selected,
  onToggleSelected,
  onChannelTap,
  onAvailabilityTap,
}: {
  cat: Category;
  parentCat: Category;
  channels: ChannelRow[];
  orderTypeIdByKey: Partial<Record<OrderType, string>>;
  selected: boolean;
  onToggleSelected: () => void;
  onChannelTap: (ch: OrderType, outletId: string) => void;
  onAvailabilityTap: () => void;
}) {
  const dominated = channels.every((ch) => {
    const parentVis = categoryChannelState(parentCat, ch.key, orderTypeIdByKey, ch.id).enabled;
    return parentVis && categoryChannelState(cat, ch.key, orderTypeIdByKey, ch.id).enabled;
  }) ? 'showing' : 'hidden';
  const stripeColor = dominated === 'showing' ? GREEN : T3;
  const categoryAvailable = getCategorySharedAvailability(cat, channels);
  const catNameLabel = truncateControlCentreLabel(cat.name);

  return (
    <div style={{
      margin: '0 0 6px 0', borderRadius: 2, background: CARD_BG,
      border: `1px solid ${BORDER}`, overflow: 'hidden', display: 'flex', maxWidth: '100%', boxSizing: 'border-box',
    }}>
      <div style={{ width: 4, background: stripeColor, flexShrink: 0 }} />
      <div style={{ flex: '1 1 0', padding: '11px 10px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {/* Category row checkbox (hidden on FE for now) */}
              {false && (
                <input type="checkbox" checked={selected} onChange={() => onToggleSelected()} onClick={(e) => e.stopPropagation()} style={{ width: 14, height: 14, accentColor: ACCENT, cursor: 'pointer', flexShrink: 0 }} />
              )}
              <span className="material-symbols-rounded" style={{ fontSize: 14, color: T3, flexShrink: 0 }}>subdirectory_arrow_right</span>
              <div title={catNameLabel.title} style={{ fontSize: 13, fontWeight: 700, color: T1, fontFamily: 'var(--font-primary)', lineHeight: 1.3, whiteSpace: 'normal', wordBreak: 'break-word', flex: '1 1 0', minWidth: 0 }}>
                {catNameLabel.display}
              </div>
              {/* Category availability toggle (hidden on FE for now) */}
              {false && <AvailabilityToggle checked={categoryAvailable} onToggle={onAvailabilityTap} />}
            </div>
            <div style={{ fontSize: 13, color: T3, fontFamily: 'var(--font-primary)', marginTop: 2, paddingLeft: 0 }}>
              {cat.itemCount} item{cat.itemCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, width: '100%', minWidth: 0 }}>
          {channels.map((ch) => {
            const parentVis = categoryChannelState(parentCat, ch.key, orderTypeIdByKey, ch.id).enabled;
            const vis = categoryChannelState(cat, ch.key, orderTypeIdByKey, ch.id).enabled;
            const blocked = !parentVis;
            const state: 'showing' | 'hidden' = !blocked && vis ? 'showing' : 'hidden';
            return (
              <ChannelPill key={ch.id} channel={ch} state={state} disabled={blocked} onTap={() => onChannelTap(ch.key, ch.id)} />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Shimmer loader ── */
function ShimmerRow({ height = 72, radius = 12 }: { height?: number; radius?: number }) {
  return (
    <div style={{
      height, borderRadius: radius, marginBottom: 8,
      background: 'linear-gradient(90deg, #ECE5D8 25%, #F4F0E8 50%, #ECE5D8 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease-in-out infinite',
    }} />
  );
}

/* ═══════════════════════════════════════════════════
   Main mobile component
═══════════════════════════════════════════════════ */
export default function ControlCentreMobile({
  items, categories, addToast, updateItem, activeTab, setActiveTab,
}: {
  items: MenuItem[];
  categories: Category[];
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  updateItem: (id: string, updates: Partial<MenuItem>) => void;
  activeTab: EntityTab;
  setActiveTab: (tab: EntityTab) => void;
}) {
  const [expandedCats,      setExpandedCats]      = useState<Set<string>>(new Set());
  const [expandedParentCats, setExpandedParentCats] = useState<Set<string>>(new Set());
  const [searchItems, setSearchItems] = useState('');
  const [searchCategories, setSearchCategories] = useState('');
  const [itemsCategoryFilter, setItemsCategoryFilter] = useState<string>('all');
  const [sessionFilter, setSessionFilter] = useState<string>('all');
  const [itemsAvailabilityFilter, setItemsAvailabilityFilter] = useState<
    'all' | 'fully_available' | 'partially_available' | 'not_available'
  >('all');
  const [categoryVisibilityFilter, setCategoryVisibilityFilter] = useState<'all' | 'full' | 'partial' | 'none'>('all');

  const { selectedBranch } = useBranch();
  const { auth } = useAuth();
  const { sessions, fetchSessions } = useSessionsStore();
  const { fetchCategories, loading: categoriesLoading } = useCategoriesStore();
  const { fetchItems, loading: itemsLoading } = useItemsStore();
  const { fetchMenus } = useMenusStore();
  const channels = useMemo((): ChannelRow[] => {
    const raw = (selectedBranch as any)?.orderTypes;
    if (!Array.isArray(raw)) return CHANNELS.map((c) => ({ ...c, id: c.key }));

    const out: ChannelRow[] = [];
    // Deduplicate by (key + normalized label) so "DoorDash" from two different outlet IDs
    // only appears once. We keep the first outlet ID encountered for each (key, label) pair.
    const seenLabels = new Set<string>();

    raw.forEach((entry: OutletOrderType) => {
      // Include all outlet order types regardless of isEnabled (disabled ones are shown too).
      const key = mapOutletOrderTypeToKey(entry);
      if (!key || !isOrderTypeKey(key)) return;

      const entryId = String(entry?.id ?? '').trim();
      if (!entryId) return;

      const base = CHANNELS.find((c) => c.key === key);
      if (!base) return;

      // const typeName = String(entry?.typeName ?? '').trim();
      // const label = typeName || base.label;
      const label = base.label;
      const dedupeKey = `${key}:${label.toLowerCase().replace(/[\s-]+/g, '')}`;
      if (seenLabels.has(dedupeKey)) return;
      seenLabels.add(dedupeKey);

      out.push({ key, label, abbr: label, icon: base.icon, id: entryId });
    });

    return out.length > 0 ? out : CHANNELS.map((c) => ({ ...c, id: c.key }));
  }, [selectedBranch]);

  /* sheet: { id, channel?, outletId? } — channel present = single-channel, absent = all-channel */
  const [sheet, setSheet] = useState<{ id: string; channel?: OrderType; outletId?: string } | null>(null);
  const locationId = String(selectedBranch?.id ?? selectedBranch?.locationId ?? '').trim();
  const token = auth?.accessToken ?? auth?.access_token ?? null;
  const userId = String(auth?.userId ?? auth?.id ?? auth?.staff_id ?? auth?.authUserId ?? '').trim();
  const dispatch = useAppDispatch();

  /* ── Force re-fetch all APIs (invalidate + await so saga takeLatest cannot replay stale items) ── */
  const refreshAll = useCallback(async () => {
    if (!locationId) return;
    dispatch(invalidateFetchCache());
    await Promise.all([
      fetchItems(locationId, token, { force: true }),
      fetchCategories(locationId, token, { force: true }),
      fetchMenus(locationId, token, { force: true }),
      fetchSessions(locationId, token, { force: true }),
    ]);
  }, [dispatch, locationId, token, fetchItems, fetchCategories, fetchMenus, fetchSessions]);

  /* ── Multi-select for bulk ops ── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedCount = selectedIds.size;
  const [availabilityModalOpen, setAvailabilityModalOpen] = useState(false);
  const [availabilityTargetIds, setAvailabilityTargetIds] = useState<string[]>([]);
  const [availabilityScope, setAvailabilityScope] = useState<'all' | 'specific'>('all');
  const [availabilityChannels, setAvailabilityChannels] = useState<Set<string>>(new Set());
  const [availabilityDuration, setAvailabilityDuration] = useState<'manual' | 'next_session' | 'specific_time' | 'end_of_day'>('next_session');
  const [availabilitySpecificUntil, setAvailabilitySpecificUntil] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [categoryVisibilityConfirm, setCategoryVisibilityConfirm] = useState<{ categoryId: string; channel: OrderType; orderTypeId: string; enable: boolean } | null>(null);
  const [categoryAvailabilityConfirm, setCategoryAvailabilityConfirm] = useState<{ ids: string[]; enable: boolean } | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<{ itemId: string; channel: OrderType; outletId?: string; channelLabel: string; itemName: string } | null>(null);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const setSelectionForIds = useCallback((ids: string[], checked: boolean) => {
    if (ids.length === 0) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }, []);

  const clearSelected = useCallback(() => setSelectedIds(new Set()), []);
  const openAvailabilityModal = useCallback((itemIds: string[], scope: 'all' | 'specific', preselectedOrderTypeIds?: string[]) => {
    setAvailabilityTargetIds(itemIds);
    setAvailabilityScope(scope);
    setAvailabilityChannels(new Set(preselectedOrderTypeIds ?? []));
    setAvailabilityDuration('next_session');
    setAvailabilitySpecificUntil('');
    setAvailabilityModalOpen(true);
  }, []);
  const closeAvailabilityModal = useCallback(() => {
    setAvailabilityModalOpen(false);
    setAvailabilityTargetIds([]);
    setAvailabilityScope('all');
    setAvailabilityChannels(new Set());
    setAvailabilityDuration('next_session');
    setAvailabilitySpecificUntil('');
  }, []);
  const toggleCategorySelected = useCallback((id: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const clearSelectedCategories = useCallback(() => setSelectedCategoryIds(new Set()), []);

  const computeInactiveWindow = useCallback((): { inactiveMode: string; inactiveUntil: string } => {
    if (availabilityDuration === 'manual') {
      return { inactiveMode: 'until_manually_enabled', inactiveUntil: '9999-01-01T00:00:00' };
    }
    if (availabilityDuration === 'specific_time') {
      return {
        inactiveMode: 'until_specific_time',
        inactiveUntil: availabilitySpecificUntil
          ? formatInactiveUntilLocal(availabilitySpecificUntil)
          : formatInactiveUntilFromDate(new Date(Date.now() + 60 * 60 * 1000)),
      };
    }
    if (availabilityDuration === 'end_of_day') {
      const branch = selectedBranch as Record<string, any> | null | undefined;
      return computeEndOfDayInactiveUntil({
        timeZoneCd: branch?.timeZoneCd ?? branch?.timeZone,
        workingHours: branch?.workingHours,
      });
    }
    const branch = selectedBranch as Record<string, any> | null | undefined;
    return computeEndOfSessionInactiveUntil({
      timeZoneCd: branch?.timeZoneCd ?? branch?.timeZone,
      workingHours: branch?.workingHours,
    });
  }, [availabilityDuration, availabilitySpecificUntil, sessions, selectedBranch]);

  const channelRowsForAvailability = useMemo(() => channels.map((c) => ({ key: c.key, id: c.id })), [channels]);

  const orderTypeIdByKey = useMemo(() => {
    const raw = (selectedBranch as any)?.orderTypes;
    const map: Partial<Record<OrderType, string>> = {};
    if (!Array.isArray(raw)) return map;
    raw.forEach((entry: OutletOrderType) => {
      // Include all outlet order types regardless of isEnabled (disabled ones are shown too).
      const key = mapOutletOrderTypeToKey(entry);
      const id = String(entry?.id ?? '').trim();
      if (!key || !id || map[key]) return;
      map[key] = id;
    });
    return map;
  }, [selectedBranch]);

  /** Outlet orderTypeId UUID for a channel row — its own id, or the key's UUID when the row is a fallback key. */
  const resolveOrderTypeId = useCallback(
    (key: OrderType, id?: string): string | undefined => (id && !isOrderTypeKey(id) ? id : orderTypeIdByKey[key]),
    [orderTypeIdByKey],
  );

  const itemsCategoryDropdownOptions = useMemo(
    (): ControlCentreFilterOption[] => buildCategoryFilterOptions(categories),
    [categories],
  );

  const sessionDropdownOptions = useMemo(
    (): ControlCentreFilterOption[] => [
      { value: 'all', label: 'All sessions' },
      ...sessions.map((s) => {
        const value = String(s.id).trim();
        const n = countItemsMatchingSession(s, items);
        return {
          value,
          label: `${s.name} (${n} products)` /* was: `${s.name} (${n} items)` */,
        };
      }),
    ],
    [sessions, items],
  );

  useEffect(() => {
    if (normalizeCategoryFilterId(itemsCategoryFilter, categories) === 'all' && itemsCategoryFilter !== 'all') {
      setItemsCategoryFilter('all');
    }
  }, [categories, itemsCategoryFilter]);

  useEffect(() => {
    if (normalizeSessionFilterId(sessionFilter, sessions) === 'all' && sessionFilter !== 'all') {
      setSessionFilter('all');
    }
  }, [sessions, sessionFilter]);

  /* ── Filtered items ── */
  const filteredItems = useMemo(() => {
    let list = items;
    const categoryId = normalizeCategoryFilterId(itemsCategoryFilter, categories);
    const sessionId = normalizeSessionFilterId(sessionFilter, sessions);
    if (categoryId !== 'all') {
      list = list.filter((it) => itemInSelectedCategoryTree(it, categoryId, categories));
    }
    if (sessionId !== 'all') {
      const sess = findSessionByFilterSelectionValue(sessions, sessionId);
      list = sess ? list.filter((it) => itemMatchesSessionFilter(it, sessionId, sess)) : [];
    }
    if (itemsAvailabilityFilter !== 'all') {
      list = list.filter((it) => {
        const b = getItemAvailabilityBucket(it, channelRowsForAvailability, categories, orderTypeIdByKey);
        if (itemsAvailabilityFilter === 'fully_available') return b === 'fully';
        if (itemsAvailabilityFilter === 'partially_available') return b === 'partial';
        if (itemsAvailabilityFilter === 'not_available') return b === 'none';
        return true;
      });
    }
    if (searchItems.trim()) {
      const q = searchItems.toLowerCase();
      list = list.filter((it) => itemMatchesItemsTabSearchQuery(it, q));
    }
    return list;
  }, [
    items,
    itemsCategoryFilter,
    sessionFilter,
    itemsAvailabilityFilter,
    searchItems,
    categories,
    sessions,
    channelRowsForAvailability,
    orderTypeIdByKey,
  ]);

  const sheetItem         = sheet ? items.find((it) => it.id === sheet.id) : null;
  const isAllChannelSheet = sheet && !sheet.channel;

  const topCategories = useMemo(
    () =>
      categories
        .filter((c) => !c.parentCategoryId)
        .slice()
        .sort(compareCategoriesBySortPosition),
    [categories],
  );
  const allCatsExpanded = topCategories.length > 0 && topCategories.every((c) => expandedCats.has(c.id));

  // When a specific category is selected, keep its parent chain visible as context,
  // plus the selected node's subtree.
  const activeCategoryFilterIds = useMemo(() => {
    const categoryId = normalizeCategoryFilterId(itemsCategoryFilter, categories);
    if (categoryId === 'all') return null;
    const visibleIds = collectCategoryTreeIds(categoryId, categories);
    const byId = new Map(categories.map((c) => [String(c.id).trim(), c]));
    let cursor = byId.get(categoryId);
    while (cursor?.parentCategoryId) {
      const parentId = String(cursor.parentCategoryId).trim();
      if (!parentId) break;
      visibleIds.add(parentId);
      cursor = byId.get(parentId);
    }
    return visibleIds;
  }, [itemsCategoryFilter, categories]);

  const renderableFilteredItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const cat of topCategories) {
      if (activeCategoryFilterIds !== null && !activeCategoryFilterIds.has(cat.id)) continue;
      const childIds = new Set(
        categories
          .filter((c) => c.parentCategoryId === cat.id)
          .map((c) => c.id),
      );
      filteredItems.forEach((item) => {
        if (item.categoryIds.includes(cat.id) || item.categoryIds.some((cid) => childIds.has(cid))) {
          ids.add(item.id);
        }
      });
    }
    filteredItems.forEach((item) => {
      if ((item.categoryIds ?? []).length === 0) ids.add(item.id);
    });
    return ids;
  }, [filteredItems, topCategories, activeCategoryFilterIds, categories]);

  const toggleCategoryVisibility = useCallback(async (categoryId: string, channel: OrderType, toggleOrderTypeId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;
    if (!locationId) { addToast('No location selected', 'error'); return; }
    const existingRow = (category.channelVisibility ?? []).find(
      (cv) => String(cv.orderTypeId ?? '').trim() === toggleOrderTypeId,
    );
    const current = existingRow ? existingRow.enabled !== false : false;
    // Send only the toggled orderTypeId — backend does a partial update per entry
    const channelVisibility = [{ orderTypeId: toggleOrderTypeId, enabled: !current }];
    try {
      await updateCategoryApi({ categoryId, locationId, channelVisibility, ...(userId ? ({ userId } as any) : {}) } as any, token);
      addToast(`'${category.name}' ${!current ? 'shown' : 'hidden'} on ${channels.find((c) => resolveOrderTypeId(c.key, c.id) === toggleOrderTypeId)?.label ?? channels.find((c) => c.key === channel)?.label ?? channel}`, 'success');
      markProductCatalogSyncNeeded();
      await refreshAll();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to update category visibility', 'error');
    }
  }, [categories, locationId, channels, resolveOrderTypeId, userId, token, addToast, refreshAll]);

  const applyCategoryAvailability = useCallback(async (ids: string[], enable: boolean) => {
    if (!locationId) { addToast('No location selected', 'error'); return; }
    const inactiveUntil = enable ? null : '9999-01-01T00:00:00';
    const inactiveMode = enable ? null : 'until_manually_enabled';
    const orderTypes = channels
      .map((ch) => {
        const orderTypeId = orderTypeIdByKey[ch.key];
        if (!orderTypeId) return null;
        return { orderTypeId, inactiveUntil, inactiveMode };
      })
      .filter((r): r is { orderTypeId: string; inactiveUntil: string | null; inactiveMode: string | null } => r !== null);
    if (orderTypes.length === 0) { addToast('No enabled channels found for this branch', 'error'); return; }
    try {
      if (ids.length === 1) {
        await partialUpdateCategoryAvailabilityApi({ categoryId: ids[0], locationId, ...(userId ? { userId } : {}), inactiveUntil, inactiveMode, orderTypes }, token);
      } else {
        await bulkEditCategoryAvailabilityApi({ categoryIds: ids, locationId, ...(userId ? { userId } : {}), orderTypes }, token);
      }
      addToast(`${ids.length} categor${ids.length !== 1 ? 'ies' : 'y'} ${enable ? 'restored' : 'marked OOS'}`, 'success');
      clearSelectedCategories();
      setCategoryAvailabilityConfirm(null);
      markProductCatalogSyncNeeded();
      await refreshAll();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to update category availability', 'error');
    }
  }, [locationId, channels, orderTypeIdByKey, userId, token, addToast, clearSelectedCategories, refreshAll]);

  /* ── Actions ── */
  const toggleVisibility = useCallback(async (itemId: string, channel: OrderType, outletId?: string) => {
    const item = items.find((it) => it.id === itemId); if (!item) return;
    if (!locationId) { addToast('No location selected', 'error'); return; }
    const toggleOrderTypeId = resolveOrderTypeId(channel, outletId);
    if (!toggleOrderTypeId) { addToast('Channel not available for this location', 'error'); return; }
    // Read current visibility per outlet UUID — third parties (DoorDash/UberEats/Grubhub) share one OrderType key.
    const perOutletCurrent = item.channelsByOrderTypeId?.[toggleOrderTypeId]?.enabled;
    const vis = perOutletCurrent !== undefined ? perOutletCurrent : item.visibilityPerOrderType?.[channel] ?? true;
    const newVis = !vis;
    const nextVisibility = { ...(item.visibilityPerOrderType ?? {}), [channel]: newVis };

    try {
      // One row per outlet UUID. Only the toggled UUID changes; siblings keep their existing state.
      const seen = new Set<string>();
      const channelsPayload = channels
        .map((ch) => {
          const orderTypeId = resolveOrderTypeId(ch.key, ch.id);
          if (!orderTypeId || seen.has(orderTypeId)) return null;
          seen.add(orderTypeId);
          const existing = item.channelsByOrderTypeId?.[orderTypeId];
          const enabled =
            orderTypeId === toggleOrderTypeId
              ? newVis
              : existing !== undefined
                ? existing.enabled
                : item.visibilityPerOrderType?.[ch.key] ?? true;
          const availabilityEnabled = existing !== undefined ? existing.availabilityEnabled : enabled;
          return { orderTypeId, enabled, availabilityEnabled };
        })
        .filter((row): row is { orderTypeId: string; enabled: boolean; availabilityEnabled: boolean } => row !== null);
      if (channelsPayload.length === 0) {
        addToast('No valid channels found for this branch', 'error');
        return;
      }

      await updateItemApi(
        {
          itemId,
          locationId,
          ...(userId ? { userId } : {}),
          channels: channelsPayload,
          orderTypeAvailability: channelsPayload.map((r) => ({ orderTypeId: r.orderTypeId, isEnable: r.enabled })),
        },
        token,
      );
      const prev = item.channelsByOrderTypeId?.[toggleOrderTypeId];
      updateItem(itemId, {
        visibilityPerOrderType: nextVisibility,
        channelsByOrderTypeId: {
          ...(item.channelsByOrderTypeId ?? {}),
          [toggleOrderTypeId]: {
            enabled: newVis,
            availabilityEnabled: prev?.availabilityEnabled ?? newVis,
            inactiveMode: prev?.inactiveMode ?? null,
            inactiveUntilTime: prev?.inactiveUntilTime ?? null,
            price: prev?.price,
            name: prev?.name,
          },
        },
      });
      const chLabel = channels.find((c) => resolveOrderTypeId(c.key, c.id) === toggleOrderTypeId)?.label ?? channel;
      addToast(`'${item.name}' ${newVis ? 'visible' : 'hidden'} on ${chLabel}`, 'success');
      setSheet(null);
      await refreshAll();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to update visibility', 'error');
    }
  }, [items, locationId, userId, channels, resolveOrderTypeId, token, updateItem, addToast, refreshAll, setSheet]);

  const toggleAvailability = useCallback((itemId: string, channel: OrderType, outletId?: string, currentlyAvailable?: boolean) => {
    const item = items.find((it) => it.id === itemId); if (!item) return;
    if (!locationId) { addToast('No location selected', 'error'); return; }
    const orderTypeId = resolveOrderTypeId(channel, outletId);
    if (!orderTypeId) { addToast('Channel not available for this location', 'error'); return; }

    if (currentlyAvailable) {
      openAvailabilityModal([itemId], 'specific', [orderTypeId]);
      return;
    }

    const ch = channels.find((c) => c.id === outletId) ?? channels.find((c) => c.key === channel);
    setRestoreConfirm({ itemId, channel, outletId, channelLabel: ch?.label ?? channel, itemName: item.name });
  }, [items, locationId, resolveOrderTypeId, openAvailabilityModal, channels, addToast]);

  const doRestore = useCallback(async () => {
    if (!restoreConfirm) return;
    const { itemId, channel, outletId } = restoreConfirm;
    const item = items.find((it) => it.id === itemId); if (!item) return;
    const orderTypeId = resolveOrderTypeId(channel, outletId);
    if (!orderTypeId) return;
    setRestoreConfirm(null);
    try {
      await partialUpdateItemApi(
        {
          itemId,
          locationId,
          ...(userId ? { userId } : {}),
          availabilityChanges: [{ orderTypeId, isEnable: true, inactiveUntil: null, inactiveMode: null }],
        },
        token,
      );
      updateItem(itemId, { status: 'active' as any });
      addToast(`'${item.name}' restored`, 'success');
      markProductCatalogSyncNeeded();
      await refreshAll();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to restore availability', 'error');
    }
  }, [restoreConfirm, items, locationId, resolveOrderTypeId, userId, token, updateItem, addToast, refreshAll]);

  const oosAll = useCallback((itemId: string) => {
    openAvailabilityModal([itemId], 'all');
  }, [openAvailabilityModal]);

  const restoreAll = useCallback(async (itemId: string) => {
    if (!locationId) { addToast('No location selected', 'error'); return; }
    const item = items.find((it) => it.id === itemId); if (!item) return;
    const channelAvailability = channels
      .map((ch) => {
        const orderTypeId = resolveOrderTypeId(ch.key, ch.id);
        if (!orderTypeId) return null;
        return { orderTypeId, isEnable: true, inactiveUntil: null, inactiveMode: null };
      })
      .filter((row): row is { orderTypeId: string; isEnable: boolean; inactiveUntil: null; inactiveMode: null } => row !== null);
    if (channelAvailability.length === 0) { addToast('No channels available for this location', 'error'); return; }
    try {
      await bulkEditItemApi('availability', { locationId, itemIds: [itemId], channelAvailability, ...(userId ? { userId } : {}) }, token);
      updateItem(itemId, { status: 'active' as any });
      addToast(`'${item.name}' restored on all channels`, 'success');
      markProductCatalogSyncNeeded();
      setSheet(null);
      await refreshAll();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to update availability', 'error');
    }
  }, [locationId, items, channels, resolveOrderTypeId, userId, token, updateItem, addToast, refreshAll]);

  const bulkMarkOosSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    openAvailabilityModal(Array.from(selectedIds), 'all');
  }, [selectedIds, openAvailabilityModal]);

  const bulkRestoreSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!locationId) { addToast('No location selected', 'error'); return; }
    const ids = Array.from(selectedIds);
    const channelAvailability = channels
      .map((ch) => {
        const orderTypeId = resolveOrderTypeId(ch.key, ch.id);
        if (!orderTypeId) return null;
        return { orderTypeId, isEnable: true, inactiveUntil: null, inactiveMode: null };
      })
      .filter((row): row is { orderTypeId: string; isEnable: boolean; inactiveUntil: null; inactiveMode: null } => row !== null);
    if (channelAvailability.length === 0) { addToast('No channels available for this location', 'error'); return; }
    try {
      await bulkEditItemApi('availability', { locationId, itemIds: ids, channelAvailability, ...(userId ? { userId } : {}) }, token);
      ids.forEach((id) => updateItem(id, { status: 'active' as any }));
      addToast(`${ids.length} products restored` /* was: `${ids.length} items restored` */, 'success');
      markProductCatalogSyncNeeded();
      setSheet(null);
      clearSelected();
      await refreshAll();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed bulk availability update', 'error');
    }
  }, [selectedIds, locationId, channels, resolveOrderTypeId, userId, token, updateItem, addToast, clearSelected, refreshAll]);

  const applyAvailabilityOos = useCallback(async () => {
    if (availabilityTargetIds.length === 0) return;
    if (!locationId) { addToast('No location selected', 'error'); return; }
    const selectedRows = availabilityScope === 'all'
      ? channels
      : channels.filter((c) => availabilityChannels.has(c.id) || availabilityChannels.has(resolveOrderTypeId(c.key, c.id) ?? c.id));
    if (selectedRows.length === 0) { addToast('Select at least one channel', 'error'); return; }
    const { inactiveMode, inactiveUntil } = computeInactiveWindow();
    const channelAvailability = selectedRows
      .map((row) => {
        const orderTypeId = resolveOrderTypeId(row.key, row.id);
        if (!orderTypeId) return null;
        return { orderTypeId, isEnable: false, inactiveUntil, inactiveMode };
      })
      .filter((row): row is { orderTypeId: string; isEnable: boolean; inactiveUntil: string; inactiveMode: string } => row !== null);
    if (channelAvailability.length === 0) { addToast('No channels available for this location', 'error'); return; }
    try {
      await bulkEditItemApi('availability', { locationId, itemIds: availabilityTargetIds, channelAvailability, ...(userId ? { userId } : {}) }, token);
      availabilityTargetIds.forEach((id) => updateItem(id, { status: 'out_of_stock' as any }));
      addToast(`${availabilityTargetIds.length} product(s) marked out of stock` /* was: `${availabilityTargetIds.length} item(s) marked out of stock` */, 'success');
      markProductCatalogSyncNeeded();
      if (selectedIds.size > 0 && availabilityTargetIds.length === selectedIds.size) clearSelected();
      closeAvailabilityModal();
      setSheet(null);
      await refreshAll();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed availability update', 'error');
    }
  }, [availabilityTargetIds, availabilityScope, availabilityChannels, locationId, channels, computeInactiveWindow, resolveOrderTypeId, userId, token, updateItem, addToast, selectedIds.size, clearSelected, closeAvailabilityModal, refreshAll, setSheet]);

  const tabs: { id: EntityTab; label: string; icon: string; count: number }[] = [
    { id: 'items',      label: 'Products' /* was: label: 'Items' */,      icon: 'inventory_2', count: items.length },
    { id: 'categories', label: 'Categories', icon: 'category',    count: topCategories.length },
  ];

  /* ─────────────────────────────────────────────── */
  return (
    <div style={{ background: PAGE_BG, minHeight: '100vh', fontFamily: "'Jost', sans-serif", paddingBottom: 100, overflowX: 'hidden', width: '100%' }}>

      {/* ── Sticky header ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: CARD_BG }}>

        {/* Row 1: Title */}
        <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: T1, fontFamily: 'var(--font-primary)', flexShrink: 0 }}>Control Center</span>
        </div>

        {/* Row 2: Search + expand toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 12px' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16, color: T3, position: 'absolute', left: 10, pointerEvents: 'none' }}>search</span>
            <input
              type="text"
              value={activeTab === 'categories' ? searchCategories : searchItems}
              onChange={(e) => (activeTab === 'categories' ? setSearchCategories : setSearchItems)(e.target.value)}
              placeholder={activeTab === 'categories' ? 'Search categories…' : 'Search…'}
              style={{ width: '100%', padding: '7px 30px 7px 32px', borderRadius: 2, border: `1px solid ${BORDER}`, fontSize: 13, fontFamily: 'var(--font-primary)', outline: 'none', background: PAGE_BG, color: T1 }}
            />
            {(activeTab === 'categories' ? searchCategories : searchItems) && (
              <button type="button" onClick={() => (activeTab === 'categories' ? setSearchCategories : setSearchItems)('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', position: 'absolute', right: 8 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 16, color: T3 }}>cancel</span>
              </button>
            )}
          </div>
          {activeTab === 'items' && (
            <button type="button" onClick={() => setExpandedCats(allCatsExpanded ? new Set() : new Set(topCategories.map((c) => c.id)))} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 600, color: T3, fontFamily: 'var(--font-primary)', padding: 0, flexShrink: 0 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>{allCatsExpanded ? 'unfold_less' : 'unfold_more'}</span>
              {allCatsExpanded ? 'Collapse' : 'Expand'}
            </button>
          )}
          {activeTab === 'categories' && (() => {
            const topCats = topCategories;
            const allExpanded = topCats.length > 0 && topCats.every((c) => expandedParentCats.has(c.id));
            return (
              <button type="button" onClick={() => setExpandedParentCats(allExpanded ? new Set() : new Set(topCats.map((c) => c.id)))} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 600, color: T3, fontFamily: 'var(--font-primary)', padding: 0, flexShrink: 0 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>{allExpanded ? 'unfold_less' : 'unfold_more'}</span>
                {allExpanded ? 'Collapse' : 'Expand'}
              </button>
            );
          })()}
        </div>

        <div style={{ padding: '0 16px 12px' }}>
          <ProductCatalogSyncBanner compact />
        </div>

      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', background: CARD_BG, borderBottom: `1px solid ${BORDER}` }}>
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '10px 12px', whiteSpace: 'nowrap',
            border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: activeTab === tab.id ? `2px solid ${ACCENT}` : '2px solid transparent',
            color: activeTab === tab.id ? ACCENT : T3,
            fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-primary)',
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>{tab.icon}</span>
            {tab.label}
            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: activeTab === tab.id ? `${ACCENT}12` : '#F4F0E8', color: activeTab === tab.id ? ACCENT : T3, fontWeight: 700 }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '12px 16px', minWidth: 0, boxSizing: 'border-box' }}>

        {/* ── Filters (items / categories) ── */}
        {!itemsLoading && !categoriesLoading && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            {activeTab === 'items' && (
              <>
                <div style={{ flex: '1 1 100%', minWidth: 0 }}>
                  <ControlCentreFilterDropdown
                    fullWidth
                    value={itemsCategoryFilter}
                    onChange={setItemsCategoryFilter}
                    options={itemsCategoryDropdownOptions}
                    ariaLabel="Filter by category"
                    variant="purple"
                    isActive={itemsCategoryFilter !== 'all'}
                  />
                </div>
                <div style={{ flex: '1 1 calc(50% - 4px)', minWidth: 0 }}>
                  <ControlCentreFilterDropdown
                    fullWidth
                    value={sessionFilter}
                    onChange={setSessionFilter}
                    options={sessionDropdownOptions}
                    ariaLabel="Filter by session"
                    variant="purple"
                    isActive={sessionFilter !== 'all'}
                  />
                </div>
                <div style={{ flex: '1 1 calc(50% - 4px)', minWidth: 0 }}>
                  <ControlCentreFilterDropdown
                    fullWidth
                    value={itemsAvailabilityFilter}
                    onChange={(v) => {
                      if (v === 'all' || v === 'fully_available' || v === 'partially_available' || v === 'not_available') {
                        setItemsAvailabilityFilter(v);
                      }
                    }}
                    options={ITEMS_TAB_AVAILABILITY_OPTIONS}
                    ariaLabel="Filter by availability"
                    variant="teal"
                    isActive={itemsAvailabilityFilter !== 'all'}
                  />
                </div>
              </>
            )}
            {activeTab === 'categories' && (
              <div style={{ flex: '1 1 100%', minWidth: 0 }}>
                <ControlCentreFilterDropdown
                  fullWidth
                  value={categoryVisibilityFilter}
                  onChange={(v) => {
                    if (v === 'all' || v === 'full' || v === 'partial' || v === 'none') setCategoryVisibilityFilter(v);
                  }}
                  options={CATEGORY_TAB_VISIBILITY_OPTIONS}
                  ariaLabel="Channel visibility"
                  variant="purple"
                  isActive={categoryVisibilityFilter !== 'all'}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Shimmer loader ── */}
        {(itemsLoading || categoriesLoading) && (
          <>
            <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
            {[1, 2, 3, 4, 5, 6].map((i) => <ShimmerRow key={i} height={i % 3 === 0 ? 110 : 72} />)}
          </>
        )}

        {/* ── Items tab ── */}
        {!itemsLoading && !categoriesLoading && activeTab === 'items' && (() => {
          const allVisibleIds = Array.from(renderableFilteredItemIds);
          const allVisibleSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));
          return (
            <>
              {allVisibleIds.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => setSelectionForIds(allVisibleIds, !allVisibleSelected)}
                    style={{
                      border: `1px solid ${BORDER}`,
                      background: allVisibleSelected ? `${TEAL}14` : CARD_BG,
                      color: allVisibleSelected ? TEAL : T2,
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    {allVisibleSelected ? 'Clear all selected' : 'Select all products' /* was: 'Select all items' */}
                  </button>
                </div>
              )}
              {topCategories.map((cat) => {
                // Skip parent categories outside the active category filter tree
                if (activeCategoryFilterIds !== null && !activeCategoryFilterIds.has(cat.id)) return null;
                const childCategories = categories
                  .filter((c) => c.parentCategoryId === cat.id)
                  .slice()
                  .sort(compareCategoriesBySortPosition);
                const parentItems = sortItemsByCategoryPosition(
                  filteredItems.filter((it) => it.categoryIds.includes(cat.id)),
                  cat.id,
                );
                const childGroups = childCategories
                  .map((child) => ({
                    child,
                    items: sortItemsByCategoryPosition(
                      filteredItems.filter((it) => it.categoryIds.includes(child.id)),
                      child.id,
                    ),
                  }))
                  .filter((group) => group.items.length > 0);
                const parentGroupItemIds = Array.from(
                  new Set([
                    ...parentItems.map((item) => item.id),
                    ...childGroups.flatMap((group) => group.items.map((item) => item.id)),
                  ]),
                );
                const totalItems = parentGroupItemIds.length;
                if (totalItems === 0) return null;
                const allParentSelected = parentGroupItemIds.every((id) => selectedIds.has(id));
                const isExpanded = expandedCats.has(cat.id);
                const catNameLabel = truncateControlCentreLabel(cat.name);

                return (
                  <div key={cat.id} style={{ marginBottom: 10, minWidth: 0, maxWidth: '100%' }}>
                    <button
                      type="button"
                      onClick={() => setExpandedCats((p) => { const n = new Set(p); n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id); return n; })}
                      style={{
                        width: '100%', maxWidth: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
                        padding: '11px 12px', borderRadius: 2, background: CARD_BG,
                        border: `1px solid ${BORDER}`, cursor: 'pointer', textAlign: 'left',
                        marginBottom: isExpanded ? 6 : 0,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={allParentSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          setSelectionForIds(parentGroupItemIds, e.target.checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ accentColor: ACCENT, width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
                      />
                      <span title={catNameLabel.title} style={{
                        flex: '1 1 0', minWidth: 0, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3,
                        fontSize: 13, fontWeight: 700, color: T1, fontFamily: 'var(--font-primary)',
                      }}
                      >
                        {catNameLabel.display}
                      </span>
                      <span style={{ fontSize: 13, color: T3, fontFamily: 'var(--font-primary)', flexShrink: 0, whiteSpace: 'nowrap' }}>{totalItems} {/* was: item */}product{totalItems !== 1 ? 's' : ''}</span>
                      <span className="material-symbols-rounded" style={{ fontSize: 18, color: T3, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>expand_more</span>
                    </button>

                    {isExpanded && (
                      <>
                        {parentItems.map((item) => (
                          <ItemCard
                            key={item.id} item={item} categories={categories}
                            channels={channels}
                            orderTypeIdByKey={orderTypeIdByKey}
                            selected={selectedIds.has(item.id)}
                            onToggleSelected={() => toggleSelected(item.id)}
                            onChannelTap={(ch, outletId) => setSheet({ id: item.id, channel: ch, outletId })}
                            onAllChannelsTap={() => setSheet({ id: item.id })}
                          />
                        ))}

                        {childGroups.map(({ child, items: childItems }) => {
                          const childNameLabel = truncateControlCentreLabel(child.name);
                          return (
                          <div key={child.id} style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: T2, margin: '6px 4px', fontFamily: 'var(--font-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input
                                type="checkbox"
                                checked={childItems.every((item) => selectedIds.has(item.id))}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const childIds = childItems.map((item) => item.id);
                                  setSelectionForIds(childIds, e.target.checked);
                                }}
                                style={{ accentColor: ACCENT, width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
                              />
                              <span title={childNameLabel.title} style={{ flex: 1, minWidth: 0 }}>
                                {childNameLabel.display}
                                <span style={{ marginLeft: 6, fontWeight: 600, color: T3 }}>{childItems.length} {/* was: item */}product{childItems.length !== 1 ? 's' : ''}</span>
                              </span>
                            </div>
                            {childItems.map((item) => (
                              <ItemCard
                                key={item.id} item={item} categories={categories}
                                channels={channels}
                                orderTypeIdByKey={orderTypeIdByKey}
                                selected={selectedIds.has(item.id)}
                                onToggleSelected={() => toggleSelected(item.id)}
                                onChannelTap={(ch, outletId) => setSheet({ id: item.id, channel: ch, outletId })}
                                onAllChannelsTap={() => setSheet({ id: item.id })}
                              />
                            ))}
                          </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              })}


              {allVisibleIds.length === 0 && (
                <div style={{ textAlign: 'center', padding: '56px 24px', color: T3, fontFamily: 'var(--font-primary)' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 44, display: 'block', marginBottom: 10 }}>search_off</span>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T2 }}>{/* was: No items found */}No products found</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Try a different search or filter</div>
                </div>
              )}
            </>
          );
        })()}

        {/* ── Categories tab — parent → child accordion ── */}
        {!itemsLoading && !categoriesLoading && activeTab === 'categories' && (() => {
          const topCats = topCategories;
          return (
            <>
              {topCats.map((parent) => {
                const subCats = categories
                  .filter((c) => c.parentCategoryId === parent.id)
                  .slice()
                  .sort(compareCategoriesBySortPosition);
                const q = searchCategories.trim().toLowerCase();
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
                const hasSubCategories = subCats.length > 0;
                const searchShowsThisParent = !q || parentMatchesSearch || filteredSubCats.length > 0;
                if (!parentRowPassesFilters && filteredSubCats.length === 0) return null;
                if (!searchShowsThisParent) return null;

                const isExpanded = expandedParentCats.has(parent.id);
                const parentNameLabel = truncateControlCentreLabel(parent.name);

                return (
                  <div key={parent.id} style={{ marginBottom: 10, minWidth: 0, maxWidth: '100%' }}>
                    <div
                      style={{
                        width: '100%', maxWidth: '100%', boxSizing: 'border-box', borderRadius: 2, background: CARD_BG,
                        border: `1px solid ${BORDER}`, padding: '11px 12px',
                        marginBottom: isExpanded ? 6 : 0,
                      }}
                    >
                      {/* Title row */}
                      <div
                        onClick={() => {
                          if (!hasSubCategories) return;
                          setExpandedParentCats((p) => { const n = new Set(p); n.has(parent.id) ? n.delete(parent.id) : n.add(parent.id); return n; });
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, cursor: hasSubCategories ? 'pointer' : 'default', marginBottom: 10 }}
                      >
                        {/* Category row checkbox (hidden on FE for now) */}
                        {false && (
                          <input
                            type="checkbox"
                            checked={selectedCategoryIds.has(parent.id) || subCats.some((s) => selectedCategoryIds.has(s.id))}
                            onChange={(e) => {
                              e.stopPropagation();
                              const checked = e.target.checked;
                              setSelectedCategoryIds((prev) => {
                                const next = new Set(prev);
                                if (checked) {
                                  next.add(parent.id);
                                  subCats.forEach((s) => next.add(s.id));
                                } else {
                                  next.delete(parent.id);
                                  subCats.forEach((s) => next.delete(s.id));
                                }
                                return next;
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: 14, height: 14, accentColor: ACCENT, cursor: 'pointer', flexShrink: 0 }}
                          />
                        )}
                        <span title={parentNameLabel.title} style={{
                          flex: '1 1 0', minWidth: 0, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3,
                          fontSize: 13, fontWeight: 700, color: T1, fontFamily: 'var(--font-primary)',
                        }}
                        >
                          {parentNameLabel.display}
                        </span>
                        {subCats.length > 0 ? (
                          <span style={{ fontSize: 13, color: T3, fontFamily: 'var(--font-primary)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                            {subCats.length} sub-cat{subCats.length !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span style={{ fontSize: 13, color: T3, fontFamily: 'var(--font-primary)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                            {parent.itemCount} item{parent.itemCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {/* Category availability toggle (hidden on FE for now) */}
                        {false && (
                          <AvailabilityToggle
                            checked={getCategorySharedAvailability(parent, channels)}
                            onToggle={() => {
                              const available = getCategorySharedAvailability(parent, channels);
                              setCategoryAvailabilityConfirm({ ids: [parent.id], enable: !available });
                            }}
                          />
                        )}
                        {hasSubCategories && (
                          <span className="material-symbols-rounded" style={{ fontSize: 18, color: T3, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>expand_more</span>
                        )}
                      </div>
                      {/* Channel pills row */}
                      <div style={{ display: 'flex', gap: 4, width: '100%', minWidth: 0 }}>
                        {channels.map((ch) => {
                          const vis = categoryChannelState(parent, ch.key, orderTypeIdByKey, ch.id).enabled;
                          const state: 'showing' | 'hidden' = vis ? 'showing' : 'hidden';
                          return (
                            <ChannelPill
                              key={ch.id}
                              channel={ch}
                              state={state}
                              onTap={() => {
                                const current = categoryChannelState(parent, ch.key, orderTypeIdByKey, ch.id).enabled;
                                setCategoryVisibilityConfirm({ categoryId: parent.id, channel: ch.key, orderTypeId: ch.id, enable: !current });
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {hasSubCategories && isExpanded && filteredSubCats.map((sub) => (
                      <CategoryCard
                        key={sub.id}
                        cat={sub}
                        parentCat={parent}
                        channels={channels}
                        orderTypeIdByKey={orderTypeIdByKey}
                        selected={selectedCategoryIds.has(sub.id)}
                        onToggleSelected={() => toggleCategorySelected(sub.id)}
                        onChannelTap={(ch, outletId) => {
                          const current = categoryChannelState(sub, ch, orderTypeIdByKey, outletId).enabled;
                          setCategoryVisibilityConfirm({ categoryId: sub.id, channel: ch, orderTypeId: outletId, enable: !current });
                        }}
                        onAvailabilityTap={() => {
                          const available = getCategorySharedAvailability(sub, channels);
                          setCategoryAvailabilityConfirm({ ids: [sub.id], enable: !available });
                        }}
                      />
                    ))}

                    {hasSubCategories && isExpanded && filteredSubCats.length === 0 && (
                      <div style={{ padding: '14px', textAlign: 'center', color: T3, fontFamily: 'var(--font-primary)', fontSize: 12, background: CARD_BG, borderRadius: 2, border: `1px solid ${BORDER}` }}>
                        No subcategories
                      </div>
                    )}
                  </div>
                );
              })}

              {topCats.length === 0 && (
                <div style={{ textAlign: 'center', padding: '56px 24px', color: T3, fontFamily: 'var(--font-primary)' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 44, display: 'block', marginBottom: 10 }}>category</span>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T2 }}>No categories found</div>
                </div>
              )}
            </>
          );
        })()}

      </div>

      {selectedCount > 0 && activeTab === 'items' && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 'calc(72px + env(safe-area-inset-bottom))', zIndex: 60,
          background: CARD_BG, borderTop: `1px solid ${BORDER}`,
          boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
          padding: '10px 16px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T1, fontFamily: 'var(--font-primary)' }}>
                {selectedCount} selected
              </div>
              <div style={{ fontSize: 11, color: T3, fontFamily: 'var(--font-primary)' }}>
                {/* was: Bulk actions apply to selected items */}Bulk actions apply to selected products
              </div>
            </div>
            <button
              type="button"
              onClick={clearSelected}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: T3, textDecoration: 'underline', fontFamily: 'var(--font-primary)', whiteSpace: 'nowrap' }}
            >
              Clear
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            <button type="button" onClick={bulkMarkOosSelected} style={{
              padding: '12px 10px', borderRadius: 2, border: `1px solid ${RED}30`,
              background: `${RED}08`, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: RED, fontFamily: 'var(--font-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>block</span>
              OOS
            </button>
            <button type="button" onClick={bulkRestoreSelected} style={{
              padding: '12px 10px', borderRadius: 2, border: `1px solid ${TEAL}30`,
              background: `${TEAL}06`, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: TEAL, fontFamily: 'var(--font-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>refresh</span>
              Restore
            </button>
          </div>
        </div>
      )}
      {/* Category bulk selection bar (hidden on FE for now — no row checkboxes) */}
      {false && selectedCategoryIds.size > 0 && activeTab === 'categories' && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 'calc(72px + env(safe-area-inset-bottom))', zIndex: 60,
          background: CARD_BG, borderTop: `1px solid ${BORDER}`, boxShadow: '0 -4px 12px rgba(0,0,0,0.08)', padding: '10px 16px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T1, fontFamily: 'var(--font-primary)' }}>{selectedCategoryIds.size} categories selected</div>
            <button type="button" onClick={clearSelectedCategories} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: T3, textDecoration: 'underline', fontFamily: 'var(--font-primary)' }}>Clear</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            <button type="button" onClick={() => setCategoryAvailabilityConfirm({ ids: Array.from(selectedCategoryIds), enable: false })} style={{ padding: '12px 10px', borderRadius: 2, border: `1px solid ${RED}30`, background: `${RED}08`, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: RED, fontFamily: 'var(--font-primary)' }}>Mark OOS</button>
            <button type="button" onClick={() => setCategoryAvailabilityConfirm({ ids: Array.from(selectedCategoryIds), enable: true })} style={{ padding: '12px 10px', borderRadius: 2, border: `1px solid ${TEAL}30`, background: `${TEAL}06`, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: TEAL, fontFamily: 'var(--font-primary)' }}>Restore</button>
          </div>
        </div>
      )}

      {availabilityModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 12 }}>
          <div style={{ background: CARD_BG, borderRadius: 2, padding: 20, width: '100%', maxWidth: 640, boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T1, margin: '0 0 14px', fontFamily: 'var(--font-primary)' }}>
              {/* was: Mark {availabilityTargetIds.length} item{availabilityTargetIds.length !== 1 ? 's' : ''} as out of stock */}Mark {availabilityTargetIds.length} product{availabilityTargetIds.length !== 1 ? 's' : ''} as out of stock
            </h3>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T2, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-primary)' }}>Scope</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {([{ id: 'all' as const, label: 'All channels' }, { id: 'specific' as const, label: 'Specific channels' }]).map((opt) => (
                  <button key={opt.id} type="button" onClick={() => { setAvailabilityScope(opt.id); if (opt.id === 'all') setAvailabilityChannels(new Set()); }} style={{ flex: 1, padding: '10px 12px', borderRadius: 2, border: availabilityScope === opt.id ? `1.5px solid ${ORANGE}` : `1px solid ${BORDER}`, background: availabilityScope === opt.id ? `${ORANGE}06` : CARD_BG, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-primary)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: availabilityScope === opt.id ? ORANGE : T1 }}>{opt.label}</div>
                  </button>
                ))}
              </div>
            </div>
            {availabilityScope === 'specific' && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {channels.map((ch) => {
                    const selected = availabilityChannels.has(ch.id) || availabilityChannels.has(resolveOrderTypeId(ch.key, ch.id) ?? ch.id);
                    return (
                      <button key={ch.id} type="button" onClick={() => setAvailabilityChannels((prev) => {
                        const next = new Set(prev); if (next.has(ch.id)) next.delete(ch.id); else next.add(ch.id); return next;
                      })} style={{ padding: '6px 10px', borderRadius: 2, border: selected ? `1.5px solid ${ORANGE}` : `1px solid ${BORDER}`, background: selected ? `${ORANGE}08` : CARD_BG, color: selected ? ORANGE : T2, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T2, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-primary)' }}>Duration</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {([
                  { id: 'manual' as const, label: 'Until re-enabled' },
                  { id: 'next_session' as const, label: 'Until next session' },
                  { id: 'specific_time' as const, label: 'Until specific time' },
                  { id: 'end_of_day' as const, label: 'End of day' },
                ]).map((opt) => (
                  <button key={opt.id} type="button" onClick={() => setAvailabilityDuration(opt.id)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 2, border: availabilityDuration === opt.id ? `1.5px solid ${TEAL}` : `1px solid ${BORDER}`, background: availabilityDuration === opt.id ? `${TEAL}06` : CARD_BG, fontSize: 12, fontWeight: 600, color: availabilityDuration === opt.id ? TEAL : T1, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {availabilityDuration === 'specific_time' && (
              <div style={{ marginBottom: 12 }}>
                <CatalogDateTimePicker
                  value={availabilitySpecificUntil}
                  onChange={(v) => setAvailabilitySpecificUntil(v)}
                  min={todayIsoLocal()}
                  placeholder="Pick date & time"
                  zIndex={1000}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeAvailabilityModal} style={{ padding: '8px 16px', borderRadius: 2, border: `1px solid ${BORDER}`, background: CARD_BG, color: T2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>Cancel</button>
              <button type="button" disabled={availabilityTargetIds.length === 0 || (availabilityScope === 'specific' && availabilityChannels.size === 0) || (availabilityDuration === 'specific_time' && !availabilitySpecificUntil)} onClick={() => { void applyAvailabilityOos(); }} style={{ padding: '8px 16px', borderRadius: 2, border: 'none', background: ORANGE, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>Apply</button>
            </div>
          </div>
        </div>
      )}
      {categoryVisibilityConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 12 }}>
          <div style={{ background: CARD_BG, borderRadius: 2, padding: 20, width: '100%', maxWidth: 420, boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T1, margin: '0 0 10px', fontFamily: 'var(--font-primary)' }}>
              {categoryVisibilityConfirm.enable ? 'Turn visibility ON' : 'Turn visibility OFF'}
            </h3>
            <p style={{ fontSize: 12, color: T2, margin: '0 0 14px', fontFamily: 'var(--font-primary)' }}>This updates category visibility on selected channel.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setCategoryVisibilityConfirm(null)} style={{ padding: '8px 16px', borderRadius: 2, border: `1px solid ${BORDER}`, background: CARD_BG, color: T2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>Cancel</button>
              <button type="button" onClick={() => { void toggleCategoryVisibility(categoryVisibilityConfirm.categoryId, categoryVisibilityConfirm.channel, categoryVisibilityConfirm.orderTypeId); setCategoryVisibilityConfirm(null); }} style={{ padding: '8px 16px', borderRadius: 2, border: 'none', background: PURPLE, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      {categoryAvailabilityConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 12 }}>
          <div style={{ background: CARD_BG, borderRadius: 2, padding: 20, width: '100%', maxWidth: 420, boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T1, margin: '0 0 10px', fontFamily: 'var(--font-primary)' }}>
              {categoryAvailabilityConfirm.enable ? 'Restore category availability' : 'Mark category OOS'}
            </h3>
            <p style={{ fontSize: 12, color: T2, margin: '0 0 14px', fontFamily: 'var(--font-primary)' }}>{categoryAvailabilityConfirm.ids.length} categories will be updated for all channels.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setCategoryAvailabilityConfirm(null)} style={{ padding: '8px 16px', borderRadius: 2, border: `1px solid ${BORDER}`, background: CARD_BG, color: T2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>Cancel</button>
              <button type="button" onClick={() => { void applyCategoryAvailability(categoryAvailabilityConfirm.ids, categoryAvailabilityConfirm.enable); }} style={{ padding: '8px 16px', borderRadius: 2, border: 'none', background: ORANGE, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      {restoreConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 12 }}>
          <div style={{ background: CARD_BG, borderRadius: 2, padding: 20, width: '100%', maxWidth: 420, boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T1, margin: '0 0 10px', fontFamily: 'var(--font-primary)' }}>Restore availability</h3>
            <p style={{ fontSize: 12, color: T2, margin: '0 0 14px', fontFamily: 'var(--font-primary)' }}>
              Restore <strong>{restoreConfirm.itemName}</strong> on <strong>{restoreConfirm.channelLabel}</strong>? This will mark it as in stock.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setRestoreConfirm(null)} style={{ padding: '8px 16px', borderRadius: 2, border: `1px solid ${BORDER}`, background: CARD_BG, color: T2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>Cancel</button>
              <button type="button" onClick={() => { void doRestore(); }} style={{ padding: '8px 16px', borderRadius: 2, border: 'none', background: GREEN, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>Restore</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          Single-channel bottom sheet
      ══════════════════════════════════════════════ */}
      <BottomSheet open={!!sheet?.channel && !!sheetItem} onClose={() => setSheet(null)}>
        {sheetItem && sheet?.channel && (() => {
          const ch    = (sheet.outletId ? channels.find((c) => c.id === sheet.outletId) : null) ?? channels.find((c) => c.key === sheet.channel)!;
          const sheetOtk = sheet.outletId && !isOrderTypeKey(sheet.outletId)
            ? { ...orderTypeIdByKey, [sheet.channel!]: sheet.outletId }
            : orderTypeIdByKey;
          const state = resolveEffectiveState(sheetItem, sheet.channel, {
            categories,
            channel86Records: [],
            orderTypeIdByKey: sheetOtk,
            outletOrderTypeId: sheet.outletId && !isOrderTypeKey(sheet.outletId) ? sheet.outletId : orderTypeIdByKey[sheet.channel],
          });
          const cfg   = STATE_CFG[state.effective];
          return (
            <>
              {/* Header — close aligns with title row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 42, height: 42, borderRadius: 2, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 24, color: T2 }}>{ch.icon}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T1, fontFamily: 'var(--font-primary)' }}>{ch.label}</div>
                  <div style={{ fontSize: 12, color: T3, fontFamily: 'var(--font-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sheetItem.name}</div>
                </div>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 2,
                  background: cfg.bg, color: cfg.color, fontFamily: 'var(--font-primary)', flexShrink: 0,
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 13 }}>{cfg.icon}</span>
                  {cfg.label}
                </span>
                <button
                  type="button"
                  onClick={() => setSheet(null)}
                  aria-label="Close"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 40, height: 40, flexShrink: 0, border: 'none', borderRadius: 2,
                    background: 'transparent', cursor: 'pointer', color: T2,
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 22 }}>close</span>
                </button>
              </div>

              {/* Toggle rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <ActionRow
                  icon={state.visible ? 'visibility' : 'visibility_off'} iconColor={PURPLE}
                  label="Visibility"
                  sublabel={state.visible ? `Visible on ${ch.label}` : `Not visible on ${ch.label}`}
                  actionLabel={state.visible ? 'Hide' : 'Show'}
                  actionColor={state.visible ? PURPLE : GREEN}
                  actionBg={state.visible ? `${PURPLE}12` : `${GREEN}12`}
                  onTap={() => { toggleVisibility(sheetItem.id, sheet.channel!, sheet.outletId); setSheet(null); }}
                />
                <ActionRow
                  icon={state.available ? 'inventory' : 'remove_shopping_cart'} iconColor={TEAL}
                  label="Availability"
                  sublabel={!state.visible ? 'Enable visibility first' : state.available ? 'In stock' : channelEffectiveTooltipLabel('sold_out')}
                  actionLabel={state.available ? 'Mark OOS' : 'Restore'}
                  actionColor={state.available ? ORANGE : TEAL}
                  actionBg={state.available ? `${ORANGE}12` : `${TEAL}12`}
                  onTap={() => { if (!state.visible) return; setSheet(null); toggleAvailability(sheetItem.id, sheet.channel!, sheet.outletId, state.available); }}
                  disabled={!state.visible}
                />
              </div>

              {/* Link to all-channel */}
              <button
                type="button"
                onClick={() => setSheet({ id: sheetItem.id })}
                style={{
                  width: '100%', padding: '13px', borderRadius: 2,
                  border: `1px solid ${BORDER}`, background: PAGE_BG,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', color: T2,
                  fontFamily: 'var(--font-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>tune</span>
                Manage all channels
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>chevron_right</span>
              </button>
            </>
          );
        })()}
      </BottomSheet>

      {/* ══════════════════════════════════════════════
          All-channel bottom sheet
      ══════════════════════════════════════════════ */}
      <BottomSheet open={!!isAllChannelSheet && !!sheetItem} onClose={() => setSheet(null)}>
        {sheetItem && isAllChannelSheet && (
          <>
            {/* Header — X on same row as item name */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: T1, fontFamily: 'var(--font-primary)', lineHeight: 1.3 }}>{sheetItem.name}</div>
                <div style={{ fontSize: 12, color: T3, fontFamily: 'var(--font-primary)', marginTop: 3 }}>
                  {formatItemCodeListDisplay(sheetItem.itemCode)} · ${sheetItem.basePrice.toFixed(2)} · All channels
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSheet(null)}
                aria-label="Close"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 40, height: 40, flexShrink: 0, marginTop: -2, border: 'none', borderRadius: 2,
                  background: 'transparent', cursor: 'pointer', color: T2,
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 22 }}>close</span>
              </button>
            </div>

            {/* Per-channel rows */}
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 18, borderRadius: 2, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
              {channels.map((ch, i) => {
                const localOtk = isOrderTypeKey(ch.id) ? orderTypeIdByKey : { ...orderTypeIdByKey, [ch.key]: ch.id };
                const state = resolveEffectiveState(sheetItem, ch.key, {
                  categories,
                  channel86Records: [],
                  orderTypeIdByKey: localOtk,
                  outletOrderTypeId: isOrderTypeKey(ch.id) ? orderTypeIdByKey[ch.key] : ch.id,
                });
                const cfg   = STATE_CFG[state.effective];
                const isBlocked = state.effective === 'blocked';
                const blockingCatName = blockingCategoryNameFromReasons(state.reasons);
                const hasMultipleBlockingNames = (blockingCatName?.includes(',') ?? false);
                return (
                  <div key={ch.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                    borderBottom: i < channels.length - 1 ? `1px solid ${BORDER}` : 'none',
                    background: CARD_BG,
                  }}>
                    {/* Icon */}
                    <div style={{ width: 30, height: 30, borderRadius: 2, background: PAGE_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="material-symbols-rounded" style={{ fontSize: 16, color: T2 }}>{ch.icon}</span>
                    </div>

                    {/* Name + optional blocking message */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: T1, fontFamily: 'var(--font-primary)' }}>{ch.label}</span>
                      {isBlocked && (
                        <div style={{ fontSize: 11, fontWeight: 400, color: T3, fontFamily: 'var(--font-primary)', marginTop: 2, lineHeight: 1.35 }}>
                          {blockingCatName
                            ? hasMultipleBlockingNames
                              ? `Enable in any one of: ${blockingCatName}.`
                              : `Enable in ${blockingCatName}.`
                            : `Enable in any assigned category.`}
                        </div>
                      )}
                    </div>

                    {/* Status badge */}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: cfg.color, fontFamily: 'var(--font-primary)', flexShrink: 0 }}>
                      {!isBlocked && <span className="material-symbols-rounded" style={{ fontSize: 13 }}>{cfg.icon}</span>}
                      {cfg.label}
                    </span>

                    {/* Action buttons (active channels only) */}
                    {!isBlocked && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleVisibility(sheetItem.id, ch.key, ch.id)}
                          title={state.visible ? 'Visible on channel — tap to hide' : 'Hidden — tap to show'}
                          aria-label={state.visible ? 'Hide from channel' : 'Show on channel'}
                          style={{
                            padding: '6px 8px', borderRadius: 2, border: 'none', cursor: 'pointer', flexShrink: 0,
                            background: state.visible ? `${PURPLE}12` : '#F4F0E8',
                            color: state.visible ? PURPLE : T3,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                            {state.visible ? 'visibility' : 'visibility_off'}
                          </span>
                        </button>
                        {state.visible && (
                          <button
                            type="button"
                            onClick={() => { setSheet(null); toggleAvailability(sheetItem.id, ch.key, ch.id, state.available); }}
                            title={state.available ? 'In stock — tap to open mark OOS' : 'Out of stock — tap to restore'}
                            aria-label={state.available ? 'Mark out of stock' : 'Restore availability'}
                            style={{
                              padding: '6px 10px', borderRadius: 2, border: 'none', cursor: 'pointer', flexShrink: 0,
                              background: state.available ? `${TEAL}12` : `${ORANGE}12`,
                              color: state.available ? TEAL : ORANGE,
                              fontFamily: 'var(--font-primary)', fontSize: 11, fontWeight: 800,
                              letterSpacing: '0.04em', whiteSpace: 'nowrap',
                            }}
                          >
                            {state.available ? 'OOS' : 'Restore'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bulk actions */}
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font-primary)', marginBottom: 10 }}>
                Bulk Actions
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <BulkBtn label="OOS All" color={RED} bg={`${RED}08`} bordered onClick={() => oosAll(sheetItem.id)} />
                <BulkBtn icon="refresh" label="Restore All" color={GREEN} bg={`${GREEN}08`} onClick={() => restoreAll(sheetItem.id)} />
              </div>
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  );
}

/* ─── Tiny helpers ─── */
function BulkBtn({ icon, label, color, bg, onClick, bordered }: {
  icon?: string; label: string; color: string; bg: string;
  onClick: () => void; bordered?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '12px', borderRadius: 2,
      border: bordered ? `1px solid ${RED}35` : 'none',
      background: bg, fontSize: 12, fontWeight: 700, cursor: 'pointer',
      color, fontFamily: 'var(--font-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: icon ? 6 : 0,
    }}>
      {icon ? <span className="material-symbols-rounded" style={{ fontSize: 16 }}>{icon}</span> : null}
      {label}
    </button>
  );
}

function EmptyTab({ icon, label, sublabel }: { icon: string; label: string; sublabel: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 24px', fontFamily: 'var(--font-primary)' }}>
      <span className="material-symbols-rounded" style={{ fontSize: 44, color: '#D6CCBB', display: 'block', marginBottom: 10 }}>{icon}</span>
      <div style={{ fontSize: 14, fontWeight: 600, color: T2 }}>{label}</div>
      <div style={{ fontSize: 12, color: T3, marginTop: 4 }}>{sublabel}</div>
    </div>
  );
}
