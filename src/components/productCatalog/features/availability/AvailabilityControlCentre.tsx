import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../../../redux/hooks';
import { invalidateFetchCache } from '../../../../redux/productCatalog/productCatalogActions';
import { useItemsStore, useCategoriesStore, useSessionsStore, useMenusStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import PageHeader from '../../components/layout/PageHeader';
import SearchInput from '../../components/forms/SearchInput';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import DesktopLayout from '../../../layout/DesktopLayout';
import BottomNav from '../../../BottomNav';
import { pcPaths, PC_BASE } from '../../paths';
import { resolveEffectiveState, EFFECTIVE_COLORS, categoryChannelState, itemCategoryVisibilityAllowsChannel } from './resolveEffectiveState';
import ControlCentreTutorial from '../../components/tutorials/control-centre-tutorial';
import ControlCentreMobile from './ControlCentreMobile';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import { bulkEditItemApi, partialUpdateItemApi, updateItemApi } from '../../../../services/itemCatalogApi';
import { bulkEditCategoryAvailabilityApi, partialUpdateCategoryAvailabilityApi } from '../../../../services/categoryCatalogApi';
import { updateCategoryApi } from '../../../../services/categoryCatalogApi';
import ProductCatalogOverviewTutorial from '../../components/tutorials/product-catalog-overview-tutorial';
import type { OrderType, MenuItem, Category, EffectiveStateResult } from '../../data/types';
import {
  getItemAvailabilityBucket,
  itemInSelectedCategoryTree,
  collectCategoryTreeIds,
  getSessionMatchIdSet,
  itemMatchesSessionFilter,
  getCategoryVisibilityBucketForCategory,
  getSubCategoryVisibilityBucket,
  normalizeCategoryFilterId,
  countItemsMatchingSession,
  findSessionByFilterSelectionValue,
  normalizeSessionFilterId,
  buildCategoryFilterOptions,
  itemMatchesItemsTabSearchQuery,
  categoryMatchesCategoriesTabSearchQuery,
  channelEffectiveTooltipLabel,
  blockingCategoryNameFromReasons,
  getItemsTabHasActiveFilters,
  getCategoriesTabHasActiveFilters,
  categoriesTabHasVisibleParentRow,
  formatItemCodeListDisplay,
  truncateControlCentreLabel,
} from './controlCentreFilterHelpers';
import { computeEndOfSessionInactiveUntil, computeEndOfDayInactiveUntil, formatInactiveUntilLocal, formatInactiveUntilFromDate } from './endOfSessionInactive';
import {
  ControlCentreFilterDropdown,
  CONTROL_CENTRE_FILTER_MAX_WIDTH_PX,
  type ControlCentreFilterOption,
  ITEMS_TAB_AVAILABILITY_OPTIONS,
  CATEGORY_TAB_VISIBILITY_OPTIONS,
} from './ControlCentreFilterDropdown';
import { CatalogDateTimePicker, todayIsoLocal } from '../../components/ui/CatalogDateTimePicker';
import { ProductCatalogSyncBanner } from '../../components/ui/ProductCatalogSyncBanner';
import { markProductCatalogSyncNeeded } from '../../store/syncNeeded';
import { formatInStoreTimeZone } from '../../../../utils/dateTimeUtils';

/* ─── Design tokens (Maghil design system) ─── */
const ACCENT = '#B89550';
const ACCENT_SOFT = 'rgba(184,149,80,0.08)';
const T1 = '#453F39';
const T2 = '#6E665D';
const T3 = '#9A9084';
const GREEN = '#5F7A55';
const RED = '#A63D2F';
const ORANGE = '#B07A2A';
const BORDER = '#E6DFD3';
const CARD_BG = '#FFFFFF';
const PAGE_BG = '#FFFFFF';
const HOVER = '#F4F0E8';
const SHADOW = '0 1px 4px rgba(0,0,0,0.05)';

/** Order-type column width — shared by Items + Categories tabs (fits long outlet names e.g. Gloriafood). */
const CONTROL_CENTRE_CHANNEL_COL_PX = 108;

/** Shared channel header label — single line; ellipsis if outlet name is longer than column. */
const CONTROL_CENTRE_CHANNEL_HEADER_LABEL: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: T3,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  display: 'block',
  lineHeight: 1.25,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const CHANNELS: { key: OrderType; label: string; icon: string }[] = [
  // E-commerce storefront: Pickup is the only channel (others hidden for now).
  // { key: 'dine_in', label: 'Dine-in', icon: 'restaurant' },
  // { key: 'takeout', label: 'Takeout', icon: 'takeout_dining' },
  // { key: 'delivery', label: 'Delivery', icon: 'delivery_dining' },
  // { key: 'online_ordering', label: 'Online', icon: 'language' },
  // { key: 'catering', label: 'Catering', icon: 'room_service' },
  // { key: 'takeout', label: 'Pickup', icon: 'takeout_dining' },
  { key: 'takeout', label: 'Online', icon: 'takeout_dining' },
];

function itemCountLabel(n: number): string {
  return `${n} item${n === 1 ? '' : 's'}`;
}

/** Normalise snake_case inactive mode to human-readable label (e.g. "until_manually_enabled" → "Until Manually Enabled"). */
function formatInactiveMode(mode: string): string {
  return mode
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
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

type OutletOrderType = {
  id?: string;
  typeName?: string;
  typeGroup?: string;
  isEnabled?: number | boolean;
};

function normalizeOrderTypeText(value: string): string {
  return value.toLowerCase().replace(/[\s-]+/g, '_').trim();
}

function isOrderTypeKey(value: string): value is OrderType {
  return value === 'dine_in' || value === 'takeout' || value === 'delivery' || value === 'online_ordering' || value === 'catering';
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

function getOutletOrderTypeIdByKey(
  selectedBranch: Record<string, any> | null | undefined,
): Partial<Record<OrderType, string>> {
  const raw = selectedBranch?.orderTypes;
  if (!Array.isArray(raw) || raw.length === 0) return {};
  const out: Partial<Record<OrderType, string>> = {};
  raw.forEach((entry: OutletOrderType) => {
    // Include all outlet order types regardless of isEnabled (disabled ones are shown too).
    const key = mapOutletOrderTypeToKey(entry);
    const id = String(entry?.id ?? '').trim();
    if (!key || !id || out[key]) return;
    out[key] = id;
  });
  return out;
}

function getOutletOrderTypeRows(
  selectedBranch: Record<string, any> | null | undefined,
): Array<{ key: OrderType; label: string; id: string }> {
  const raw = selectedBranch?.orderTypes;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  // Deduplicate by (key + normalized label) — same service with multiple outlet UUIDs shows once.
  const seenLabels = new Set<string>();
  const rows: Array<{ key: OrderType; label: string; id: string }> = [];
  raw.forEach((entry: OutletOrderType) => {
    // Include all outlet order types regardless of isEnabled (disabled ones are shown too).
    const key = mapOutletOrderTypeToKey(entry);
    const entryId = String(entry?.id ?? '').trim();
    if (!key || !entryId) return;
    // Only Pickup is supported — skip Dine-in, Delivery, etc.
    if (key !== 'takeout') return;
    // const baseLabel = CHANNELS.find((c) => c.key === key)?.label ?? key;
    // const typeName = String(entry?.typeName ?? '').trim();
    // const label = typeName || baseLabel;
    // const label = 'Pickup';
    const label = 'Online';
    const dedupeKey = `${key}:${label.toLowerCase().replace(/[\s-]+/g, '')}`;
    if (seenLabels.has(dedupeKey)) return;
    seenLabels.add(dedupeKey);
    rows.push({ key, id: entryId, label });
  });
  return rows;
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

type ChannelPopoverDiagnostics = {
  categoryVisibility: boolean;
  sessionLabel: string;
  inactiveMode: string | null;
  inactiveUntilTime: string | null;
  storeTimeZone: string | undefined;
};

function getChannelPopoverDiagnostics(
  item: MenuItem,
  channel: OrderType,
  categories: Category[],
  orderTypeIdByKey: Partial<Record<OrderType, string>>,
  storeTimeZone: string | undefined,
  outletOrderTypeId?: string,
): ChannelPopoverDiagnostics {
  const { allows: categoryVisibility } = itemCategoryVisibilityAllowsChannel(item, channel, categories, orderTypeIdByKey, outletOrderTypeId);

  const names = item.sessionNames?.length ? item.sessionNames : [];
  const sessionLabel = names.length > 0 ? names.join(', ') : 'Available all day';

  // Prefer per-outlet UUID lookup — same collapse issue as availability would otherwise mean
  // all third parties share the OrderType-keyed legacy fields (which are missing for them).
  const perOutlet = outletOrderTypeId ? item.channelsByOrderTypeId?.[outletOrderTypeId] : undefined;
  const inactiveMode = perOutlet
    ? perOutlet.inactiveMode ?? null
    : item.inactiveModePerOrderType?.[channel] ?? null;
  const inactiveUntilTime = perOutlet
    ? perOutlet.inactiveUntilTime ?? null
    : item.inactiveUntilTimePerOrderType?.[channel] ?? null;

  return {
    categoryVisibility,
    sessionLabel,
    inactiveMode,
    inactiveUntilTime,
    storeTimeZone,
  };
}

type EntityTab = 'items' | 'categories';

const PURPLE = '#8C6A7A';
const TEAL = '#5E8C7B';

/* ─── Cell indicator: adapts based on viewMode ─── */
function CellIndicator({ visible, available, blocked, mode }: { visible: boolean; available: boolean; blocked?: boolean; mode: 'both' | 'visibility' | 'availability' }) {
  // Treat blocked as not-visible for all display purposes (category off overrides API visible state)
  const effectivelyVisible = visible && !blocked;

  if (mode === 'visibility') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {effectivelyVisible ? (
          <span className="material-symbols-rounded" style={{ fontSize: 16, color: PURPLE }} title="Visible">visibility</span>
        ) : (
          <span className="material-symbols-rounded" style={{ fontSize: 16, color: T3, opacity: blocked ? 0.4 : 0.6 }} title={blocked ? channelEffectiveTooltipLabel('blocked') : 'Not visible'}>visibility_off</span>
        )}
      </div>
    );
  }
  if (mode === 'availability') {
    // Show availability — but if not visible or blocked, show eye-off icon instead
    if (!effectivelyVisible) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={blocked ? channelEffectiveTooltipLabel('blocked') : 'Not visible on this channel'}>
          <span className="material-symbols-rounded" style={{ fontSize: 16, color: T3, opacity: 0.4 }}>visibility_off</span>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{
          width: 10, height: 10, borderRadius: '50%',
          background: available ? TEAL : ORANGE,
        }} title={available ? 'Available' : channelEffectiveTooltipLabel('sold_out')} />
      </div>
    );
  }
  // Both mode — dual dots
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: effectivelyVisible ? PURPLE : 'transparent',
        border: effectivelyVisible ? 'none' : `1.5px solid ${T3}`,
        boxSizing: 'border-box', opacity: blocked ? 0.3 : 1,
      }} title={effectivelyVisible ? 'Visible' : blocked ? channelEffectiveTooltipLabel('blocked') : 'Not visible'} />
      {!effectivelyVisible ? (
        <span className="material-symbols-rounded" style={{ fontSize: 10, color: T3, opacity: 0.3 }}>visibility_off</span>
      ) : (
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: available ? TEAL : ORANGE,
        }} title={available ? 'Available' : channelEffectiveTooltipLabel('sold_out')} />
      )}
    </div>
  );
}

// Keep DualCell as alias for backward compat
function DualCell({ visible, available, blocked }: { visible: boolean; available: boolean; blocked?: boolean }) {
  return <CellIndicator visible={visible} available={available} blocked={blocked} mode="both" />;
}

function DesktopShimmerRow({ height = 72, radius = 12 }: { height?: number; radius?: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: radius,
        marginBottom: 8,
        background: 'linear-gradient(90deg, #ECE5D8 25%, #F4F0E8 50%, #ECE5D8 75%)',
        backgroundSize: '200% 100%',
        animation: 'controlCentreShimmer 1.4s ease-in-out infinite',
      }}
    />
  );
}

function AvailabilityToggle({
  checked,
  onToggle,
  disabled,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        width: 34,
        height: 20,
        borderRadius: 999,
        border: 'none',
        background: checked ? ORANGE : '#D6CCBB',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 0.15s ease',
      }}
      title={checked ? 'Available' : channelEffectiveTooltipLabel('sold_out')}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 16 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          transition: 'left 0.15s ease',
        }}
      />
    </button>
  );
}

/* ─── Two-section inline edit popover ─── */
function CellPopover({ result, channelLabel, diagnostics, onClose, onToggleVisibility, onToggleAvailability, actionsDisabled = false, anchorRect }: {
  result: EffectiveStateResult;
  channelLabel: string;
  diagnostics: ChannelPopoverDiagnostics;
  onClose: () => void;
  onToggleVisibility?: () => void;
  onToggleAvailability?: () => void;
  /** Block primary actions while an API request is in flight (prevents double submits). */
  actionsDisabled?: boolean;
  anchorRect?: DOMRect | null;
}) {
  const [showDiag, setShowDiag] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [flipAbove, setFlipAbove] = useState(false);
  const isVisible = result.visible;
  const isAvailable = result.available;
  const blockReason = result.reasons.find((r) => !r.passed);
  // Only surface failures that are actually about visibility (not availability) in the VISIBILITY section
  const visibilityBlockReason = result.reasons.find(
    (r) => !r.passed && (r.step === 'item_visibility' || r.step === 'category_visibility'),
  );
  const isBlocked = result.effective === 'blocked' || !diagnostics.categoryVisibility;
  const categoryBlocked = !isVisible && !diagnostics.categoryVisibility;
  const blockingName = blockingCategoryNameFromReasons(result.reasons);
  const hasMultipleBlockingNames = (blockingName?.includes(',') ?? false);
  const blockingNameParts = (blockingName ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const POPOVER_WIDTH = 300;
  const GAP = 4;

  useEffect(() => {
    if (!popoverRef.current || !anchorRect) return;
    const popH = popoverRef.current.offsetHeight;
    const viewH = window.innerHeight;
    const spaceBelow = viewH - anchorRect.bottom - GAP;
    const spaceAbove = anchorRect.top - GAP;
    setFlipAbove(spaceBelow < popH && spaceAbove > spaceBelow);
  }, [anchorRect, showDiag]);

  const fixedTop = anchorRect
    ? flipAbove
      ? anchorRect.top - GAP
      : anchorRect.bottom + GAP
    : 0;
  const fixedLeft = anchorRect
    ? Math.max(8, Math.min(
        anchorRect.left + anchorRect.width / 2 - POPOVER_WIDTH / 2,
        (typeof window !== 'undefined' ? window.innerWidth : 1200) - POPOVER_WIDTH - 8,
      ))
    : 0;

  return (
    <>
      {/* Transparent backdrop to close on outside click */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={onClose} />
    <div ref={popoverRef} style={{
      position: 'fixed',
      top: fixedTop,
      left: fixedLeft,
      transform: flipAbove ? 'translateY(-100%)' : undefined,
      zIndex: 1000, background: CARD_BG, borderRadius: 2, border: `1px solid ${BORDER}`,
      boxShadow: '0 8px 30px rgba(0,0,0,0.12)', padding: 0, width: POPOVER_WIDTH,
      overflow: 'hidden',
    }} onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T1, fontFamily: 'var(--font-primary)' }}>{channelLabel}</span>
        <span className="material-symbols-rounded" style={{ fontSize: 16, cursor: 'pointer', color: T3 }} onClick={onClose}>close</span>
      </div>

      {isBlocked ? (
        <div style={{ padding: '14px 14px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 24, color: ORANGE, lineHeight: 1, marginBottom: 12 }}>lock</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: T1, fontFamily: 'var(--font-primary)', textAlign: 'center' }}>
              {channelEffectiveTooltipLabel('blocked')}
            </div>
            <p style={{ fontSize: 11, color: T2, margin: '8px 0 0', lineHeight: 1.45, fontFamily: 'var(--font-primary)', textAlign: 'center' }}>
              {blockingName ? (
                <>
                  {hasMultipleBlockingNames ? `Enable ${channelLabel} in any one of these categories: ` : `Enable ${channelLabel} in `}
                  {blockingNameParts.map((name, idx) => (
                    <span key={`${name}-${idx}`}>
                      <span style={{ fontWeight: 700, color: T1 }}>{name}</span>
                      {idx < blockingNameParts.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                  {hasMultipleBlockingNames
                    ? '. Item visibility and OOS stay disabled until at least one assigned category is on for this channel.'
                    : '. Item visibility and OOS stay disabled until this category is on for this channel.'}
                </>
              ) : (
                `Enable ${channelLabel} for at least one category assigned to the item. Until a category is enabled for this channel, the item’s visibility and Out-of-Stock (OOS) status will remain disabled.`
              )}
            </p>
          </div>
        </div>
      ) : (
      <>
      {/* Section 1: Availability (teal) — shown first */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, opacity: isVisible ? 1 : 0.4 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: TEAL, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, fontFamily: 'var(--font-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: TEAL }} />
          Availability
        </div>
        {!isVisible ? (
          <p style={{ fontSize: 10, color: T3, margin: 0, fontFamily: 'var(--font-primary)', fontStyle: 'italic' }}>
            Enable visibility first to manage availability.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: T1, fontFamily: 'var(--font-primary)' }}>
                {isAvailable ? 'Available' : channelEffectiveTooltipLabel('sold_out')}
              </span>
              {onToggleAvailability && (
                <button type="button" disabled={actionsDisabled} onClick={onToggleAvailability} style={{
                  padding: '3px 10px', borderRadius: 2, fontSize: 10, fontWeight: 600, cursor: actionsDisabled ? 'not-allowed' : 'pointer', border: 'none',
                  background: isAvailable ? `${TEAL}15` : `${ORANGE}15`, color: isAvailable ? TEAL : ORANGE,
                  fontFamily: 'var(--font-primary)',
                  opacity: actionsDisabled ? 0.5 : 1,
                }}>
                  {isAvailable ? 'Mark OOS' : 'Restore'}
                </button>
              )}
            </div>
            {!isAvailable && diagnostics.inactiveMode && (
              <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 2, background: `${ORANGE}08`, border: `1px solid ${ORANGE}20` }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: ORANGE, fontFamily: 'var(--font-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 12 }}>schedule</span>
                  {formatInactiveMode(diagnostics.inactiveMode)}
                </div>
                {diagnostics.inactiveMode !== 'until_manually_enabled' && diagnostics.inactiveUntilTime && (
                  <div style={{ fontSize: 10, color: T2, fontFamily: 'var(--font-primary)', marginTop: 3 }}>
                    Until: {formatInStoreTimeZone(diagnostics.inactiveUntilTime, diagnostics.storeTimeZone)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Section 2: Visibility (purple) */}
      <div style={{ padding: '10px 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: PURPLE, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, fontFamily: 'var(--font-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: PURPLE }} />
          Visibility
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: T1, fontFamily: 'var(--font-primary)' }}>
            Visible on {channelLabel}
          </span>
          {onToggleVisibility ? (
            <button type="button" disabled={actionsDisabled || categoryBlocked} onClick={onToggleVisibility} style={{
              padding: '3px 10px', borderRadius: 2, fontSize: 10, fontWeight: 600, cursor: (actionsDisabled || categoryBlocked) ? 'not-allowed' : 'pointer', border: 'none',
              background: isVisible ? `${PURPLE}15` : `${GREEN}12`, color: isVisible ? PURPLE : GREEN,
              fontFamily: 'var(--font-primary)',
              opacity: (actionsDisabled || categoryBlocked) ? 0.5 : 1,
            }}>
              {isVisible ? 'Turn OFF' : 'Turn ON'}
            </button>
          ) : (
            <span style={{ fontSize: 10, color: T3, fontFamily: 'var(--font-primary)' }}>
              {isVisible ? 'ON' : 'OFF'}
            </span>
          )}
        </div>
        {categoryBlocked && (
          <div style={{ fontSize: 10, color: ORANGE, marginTop: 4, fontFamily: 'var(--font-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 12 }}>lock</span>
            Enable category visibility first
          </div>
        )}
        {!categoryBlocked && visibilityBlockReason && (
          <div style={{ fontSize: 10, color: ORANGE, marginTop: 4, fontFamily: 'var(--font-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 12 }}>lock</span>
            {visibilityBlockReason.detail}
          </div>
        )}
      </div>
      </>
      )}

      {/* Diagnostic (collapsible) */}
      <div style={{ borderTop: `1px solid ${BORDER}`, padding: '8px 14px' }}>
        <button type="button" onClick={() => setShowDiag(!showDiag)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: 10, fontWeight: 600, color: T3, fontFamily: 'var(--font-primary)',
          display: 'flex', alignItems: 'center', gap: 4, width: '100%',
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: 14, transform: showDiag ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>chevron_right</span>
          Details
        </button>
        {showDiag && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {([
              [`Category visibility (${channelLabel})`, diagnostics.categoryVisibility],
            ] as const).map(([label, v]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 10, color: T2, fontFamily: 'var(--font-primary)' }}>
                <span style={{ fontWeight: 600 }}>{label}</span>
                <span style={{ color: v ? GREEN : RED, fontWeight: 600, flexShrink: 0 }}>{v ? 'Yes' : 'No'}</span>
              </div>
            ))}
            <div style={{ fontSize: 10, color: T2, fontFamily: 'var(--font-primary)', lineHeight: 1.35 }}>
              <span style={{ fontWeight: 600 }}>Sessions</span>
              <span style={{ display: 'block', marginTop: 4, color: T1, fontWeight: 500 }}>{diagnostics.sessionLabel}</span>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

/* ─── Mock data for preview ─── */
const mockItem = (id: string, name: string, code: string, catIds: string[], status: string, vis: Partial<Record<OrderType, boolean>>): MenuItem => ({
  id, name, itemCode: code, itemType: 'prepared_food_beverage', basePrice: 0, channelPrices: {}, categoryIds: catIds,
  status: status as any, description: '', allergens: [], dietaryLabels: [], tags: [], ingredients: [], prepTime: 15, createdAt: '',
  visibilityPerOrderType: vis as any,
});

const MOCK_ITEMS: MenuItem[] = [
  // Tandoori items
  mockItem('mock-1', 'Chicken Tikka', 'TND-001', ['cat-1', 'cat-1a'], 'active', { dine_in: true, takeout: true, delivery: true, online_ordering: true, catering: false }),
  mockItem('mock-2', 'Paneer Tikka', 'TND-002', ['cat-1', 'cat-1b'], 'active', { dine_in: true, takeout: true, delivery: false, online_ordering: true, catering: true }),
  mockItem('mock-3', 'Seekh Kebab', 'TND-003', ['cat-1', 'cat-1a'], 'active', { dine_in: true, takeout: true, delivery: true, online_ordering: false, catering: true }),
  mockItem('mock-4', 'Malai Tikka', 'TND-004', ['cat-1', 'cat-1a'], 'active', { dine_in: true, takeout: true, delivery: false, online_ordering: true, catering: false }),
  // Breads
  mockItem('mock-5', 'Butter Naan', 'BRD-001', ['cat-2'], 'active', { dine_in: true, takeout: true, delivery: true, online_ordering: true, catering: true }),
  mockItem('mock-6', 'Garlic Naan', 'BRD-002', ['cat-2'], 'active', { dine_in: true, takeout: true, delivery: true, online_ordering: true, catering: true }),
  mockItem('mock-7', 'Parotta', 'BRD-003', ['cat-2'], 'out_of_stock', { dine_in: true, takeout: true, delivery: true, online_ordering: false, catering: false }),
  // Beverages
  mockItem('mock-8', 'Mango Lassi', 'BEV-001', ['cat-3', 'cat-3a'], 'out_of_stock', { dine_in: true, takeout: true, delivery: true, online_ordering: true, catering: false }),
  mockItem('mock-9', 'Masala Chai', 'BEV-002', ['cat-3', 'cat-3b'], 'active', { dine_in: true, takeout: true, delivery: false, online_ordering: true, catering: false }),
  mockItem('mock-10', 'Fresh Lime Soda', 'BEV-003', ['cat-3', 'cat-3a'], 'active', { dine_in: true, takeout: true, delivery: true, online_ordering: true, catering: true }),
  mockItem('mock-11', 'Kingfisher Beer', 'BEV-004', ['cat-3', 'cat-3b'], 'active', { dine_in: true, takeout: false, delivery: false, online_ordering: false, catering: false }),
  // Rice & Biryani
  mockItem('mock-12', 'Chicken Biryani', 'RCE-001', ['cat-4'], 'active', { dine_in: true, takeout: true, delivery: true, online_ordering: true, catering: true }),
  mockItem('mock-13', 'Veg Pulav', 'RCE-002', ['cat-4'], 'active', { dine_in: true, takeout: true, delivery: true, online_ordering: false, catering: true }),
  mockItem('mock-14', 'Mutton Biryani', 'RCE-003', ['cat-4'], 'out_of_stock', { dine_in: true, takeout: true, delivery: true, online_ordering: true, catering: true }),
  // Desserts
  mockItem('mock-15', 'Gulab Jamun', 'DST-001', ['cat-5'], 'active', { dine_in: true, takeout: false, delivery: false, online_ordering: false, catering: false }),
  mockItem('mock-16', 'Rasmalai', 'DST-002', ['cat-5'], 'active', { dine_in: true, takeout: true, delivery: true, online_ordering: true, catering: false }),
  mockItem('mock-17', 'Kulfi', 'DST-003', ['cat-5'], 'out_of_stock', { dine_in: true, takeout: true, delivery: false, online_ordering: false, catering: false }),
];

const MOCK_CATEGORIES: Category[] = [
  // Parent categories
  { id: 'cat-1', name: 'Tandoori', description: 'Grilled items from the clay oven', itemCount: 4, isVisible: true, sortPosition: 0, orderTypeVisibility: { dine_in: true, takeout: true, delivery: true, online_ordering: true, catering: true } },
  // Subcategories of Tandoori
  { id: 'cat-1a', name: 'Non-Veg Tandoor', description: '', parentCategoryId: 'cat-1', itemCount: 3, isVisible: true, sortPosition: 1, orderTypeVisibility: { dine_in: true, takeout: true, delivery: true, online_ordering: true, catering: true } },
  { id: 'cat-1b', name: 'Veg Tandoor', description: '', parentCategoryId: 'cat-1', itemCount: 1, isVisible: true, sortPosition: 2, orderTypeVisibility: { dine_in: true, takeout: true, delivery: true, online_ordering: true, catering: false } },
  // Breads
  { id: 'cat-2', name: 'Breads', description: 'Naan, parotta, chapati', itemCount: 3, isVisible: true, sortPosition: 3, orderTypeVisibility: { dine_in: true, takeout: true, delivery: true, online_ordering: true, catering: true } },
  // Beverages with subcategories
  { id: 'cat-3', name: 'Beverages', description: '', itemCount: 4, isVisible: true, sortPosition: 4, orderTypeVisibility: { dine_in: true, takeout: true, delivery: true, online_ordering: true, catering: false } },
  { id: 'cat-3a', name: 'Cold Drinks', description: '', parentCategoryId: 'cat-3', itemCount: 2, isVisible: true, sortPosition: 5, orderTypeVisibility: { dine_in: true, takeout: true, delivery: true, online_ordering: true, catering: false } },
  { id: 'cat-3b', name: 'Hot Drinks & Alcohol', description: '', parentCategoryId: 'cat-3', itemCount: 2, isVisible: true, sortPosition: 6, orderTypeVisibility: { dine_in: true, takeout: true, delivery: false, online_ordering: false, catering: false } },
  // Rice & Biryani
  { id: 'cat-4', name: 'Rice & Biryani', description: '', itemCount: 3, isVisible: true, sortPosition: 7, orderTypeVisibility: { dine_in: true, takeout: true, delivery: true, online_ordering: true, catering: true } },
  // Desserts
  { id: 'cat-5', name: 'Desserts', description: '', itemCount: 3, isVisible: true, sortPosition: 8, orderTypeVisibility: { dine_in: true, takeout: true, delivery: false, online_ordering: false, catering: false } },
];

/* ─── Main component ─── */
export default function AvailabilityControlCentre() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { auth } = useAuth();
  const { selectedBranch } = useBranch();
  const { items, updateItem, fetchItems, loading: itemsLoading } = useItemsStore();
  const { categories, fetchCategories, loading: categoriesLoading } = useCategoriesStore();
  const { sessions, fetchSessions } = useSessionsStore();
  const { fetchMenus } = useMenusStore();
  const { addToast } = useToastStore();

  const locationId = String(selectedBranch?.id ?? selectedBranch?.locationId ?? '').trim();
  const token = auth?.accessToken ?? auth?.access_token ?? null;
  const storeTimeZone: string | undefined =
    selectedBranch?.timeZoneCd ?? selectedBranch?.timeZone ?? undefined;
  const dispatch = useAppDispatch();

  /** Invalidate catalog fetch markers + saga caches, then await fresh GETs so takeLatest cannot replay stale items. */
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

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({ title: 'Control Center', breadcrumbs: 'Product Catalog' });
  }, [setTopBarProps]);

  useEffect(() => {
    if (!locationId) return;
    void fetchItems(locationId, token, { skipDuplicateMs: 750 });
    void fetchCategories(locationId, token, { skipDuplicateMs: 750 });
    void fetchSessions(locationId, token, { skipDuplicateMs: 750 });
  }, [
    locationId,
    auth?.accessToken,
    auth?.access_token,
    fetchItems,
    fetchCategories,
    fetchSessions,
  ]);

  const [activeTab, setActiveTab] = useState<EntityTab>('items');
  const [searchItems, setSearchItems] = useState('');
  const [searchCategories, setSearchCategories] = useState('');

  // Barcode scanner: route the scanned code into the items search bar.
  // Barcodes are item-level, so we also force the active tab to "items"
  // before applying the filter (so the user sees the match immediately).
  useBarcodeScanner({
    onScan: (code) => {
      setActiveTab('items');
      setSearchItems(code);
      addToast(`Scanned: ${code}`, 'success');
    },
  });
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedParentCats, setExpandedParentCats] = useState<Set<string>>(new Set());
  const [diagnosticCell, setDiagnosticCell] = useState<{ cellKey: string; entityId: string; channel: OrderType } | null>(null);
  /** DOM node for the open cell button — used to reposition the popover on scroll without closing it. */
  const diagnosticAnchorRef = useRef<HTMLButtonElement | null>(null);
  /** Synchronous guard so rapid clicks cannot start overlapping API calls. */
  const mutationLockRef = useRef(false);
  const [mutationBusy, setMutationBusy] = useState(false);
  const itemsTableSelectAllRef = useRef<HTMLInputElement | null>(null);
  const [viewMode, setViewMode] = useState<'both' | 'visibility' | 'availability'>('availability');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectedCategoryRows, setSelectedCategoryRows] = useState<Set<string>>(new Set());
  const [bulkModal, setBulkModal] = useState<'visibility' | '86' | 'restore' | null>(null);
  const [categoryAvailabilityConfirm, setCategoryAvailabilityConfirm] = useState<{
    ids: string[];
    enable: boolean;
  } | null>(null);
  const [categoryVisibilityConfirm, setCategoryVisibilityConfirm] = useState<{
    categoryId: string;
    channel: OrderType;
    orderTypeId: string;
    enable: boolean;
  } | null>(null);
  const [bulkDuration, setBulkDuration] = useState<'manual' | 'next_session' | 'specific_time' | 'end_of_day'>('next_session');
  const [bulkSpecificUntil, setBulkSpecificUntil] = useState<string>('');
  const [bulkScope, setBulkScope] = useState<'all' | 'specific'>('all');
  const [bulkChannels, setBulkChannels] = useState<Set<string>>(new Set());
  const [availabilityTargetItemIds, setAvailabilityTargetItemIds] = useState<string[] | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showOverviewTutorial, setShowOverviewTutorial] = useState(false);
  // Mobile-specific state
  const [mobileExpandedCats, setMobileExpandedCats] = useState<Set<string>>(new Set());
  const [mobileSheet, setMobileSheet] = useState<{ id: string; channel?: OrderType } | null>(null);
  const [sessionFilter, setSessionFilter] = useState<string>('all');
  const [itemsCategoryFilter, setItemsCategoryFilter] = useState<string>('all');
  const [itemsAvailabilityFilter, setItemsAvailabilityFilter] = useState<
    'all' | 'fully_available' | 'partially_available' | 'not_available'
  >('all');
  const [categoryVisibilityFilter, setCategoryVisibilityFilter] = useState<'all' | 'full' | 'partial' | 'none'>('all');
  const channelRows = useMemo(() => {
    const outletRows = getOutletOrderTypeRows(selectedBranch as Record<string, any> | null | undefined);
    if (outletRows.length === 0) return CHANNELS.map((c) => ({ ...c, id: c.key }));
    return outletRows.map((row) => ({
      key: row.key,
      id: row.id,
      label: row.label,
      icon: CHANNELS.find((c) => c.key === row.key)?.icon ?? 'tune',
    }));
  }, [selectedBranch]);
  const outletOrderTypeIdByKey = useMemo(
    () => getOutletOrderTypeIdByKey(selectedBranch as Record<string, any> | null | undefined),
    [selectedBranch],
  );

  useEffect(() => {
    setExpandedCategories((prev) => {
      if (prev.size > 0) return prev;
      return new Set(categories.map((c) => c.id));
    });
  }, [categories]);

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

  /** Close popover if the anchor button scrolls out of view or gets unmounted. */
  useEffect(() => {
    if (!diagnosticCell?.cellKey) {
      diagnosticAnchorRef.current = null;
      return;
    }

    const checkAnchorConnected = () => {
      const el = diagnosticAnchorRef.current;
      if (!el || !el.isConnected) {
        diagnosticAnchorRef.current = null;
        setDiagnosticCell(null);
      }
    };

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(checkAnchorConnected);
    };

    const scrollEl = document.querySelector('[data-desktop-main-scroll]');
    scrollEl?.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      scrollEl?.removeEventListener('scroll', onScroll);
    };
  }, [diagnosticCell?.cellKey]);

  const activeChannels = useMemo(() => channelRows, [channelRows]);

  const channelRowsForAvailability = useMemo(() => channelRows.map((r) => ({ key: r.key, id: r.id })), [channelRows]);

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
          label: `${s.name} (${n} items)`,
        };
      }),
    ],
    [sessions, items],
  );

  const itemsTabHasActiveFilters = useMemo(
    () =>
      getItemsTabHasActiveFilters(
        itemsCategoryFilter,
        categories,
        sessionFilter,
        sessions,
        itemsAvailabilityFilter,
        searchItems,
      ),
    [itemsCategoryFilter, categories, sessionFilter, sessions, itemsAvailabilityFilter, searchItems],
  );

  const categoriesTabHasActiveFilters = useMemo(
    () => getCategoriesTabHasActiveFilters(categoryVisibilityFilter, searchCategories),
    [categoryVisibilityFilter, searchCategories],
  );

  const categoriesTabHasVisibleRows = useMemo(
    () =>
      categoriesTabHasVisibleParentRow(categories, {
        categoryVisibilityFilter,
        searchQueryLower: searchCategories.trim().toLowerCase(),
        channels: channelRows,
        orderTypeIdByKey: outletOrderTypeIdByKey,
      }),
    [categories, categoryVisibilityFilter, searchCategories, channelRows, outletOrderTypeIdByKey],
  );

  const filteredItems = useMemo(() => {
    let result = items;
    const categoryId = normalizeCategoryFilterId(itemsCategoryFilter, categories);
    const sessionId = normalizeSessionFilterId(sessionFilter, sessions);
    if (categoryId !== 'all') {
      result = result.filter((it) => itemInSelectedCategoryTree(it, categoryId, categories));
    }
    if (sessionId !== 'all') {
      const sess = findSessionByFilterSelectionValue(sessions, sessionId);
      result = sess ? result.filter((it) => itemMatchesSessionFilter(it, sessionId, sess)) : [];
    }
    if (itemsAvailabilityFilter !== 'all') {
      result = result.filter((it) => {
        const b = getItemAvailabilityBucket(it, channelRowsForAvailability, categories, outletOrderTypeIdByKey);
        if (itemsAvailabilityFilter === 'fully_available') return b === 'fully';
        if (itemsAvailabilityFilter === 'partially_available') return b === 'partial';
        if (itemsAvailabilityFilter === 'not_available') return b === 'none';
        return true;
      });
    }
    if (searchItems.trim()) {
      const q = searchItems.toLowerCase();
      result = result.filter((it) => itemMatchesItemsTabSearchQuery(it, q));
    }
    return result;
  }, [
    items,
    itemsCategoryFilter,
    sessionFilter,
    itemsAvailabilityFilter,
    searchItems,
    categories,
    sessions,
    channelRowsForAvailability,
    outletOrderTypeIdByKey,
  ]);

  const filteredItemIds = useMemo(() => new Set(filteredItems.map((i) => i.id)), [filteredItems]);

  const orderedTopLevelCategories = useMemo(
    () =>
      categories
        .filter((c) => !c.parentCategoryId)
        .slice()
        .sort(compareCategoriesBySortPosition),
    [categories],
  );

  // When a specific category is selected, keep its parent chain visible as context,
  // plus the selected node's subtree.
  // Null means "all categories" — no restriction.
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

  const hasRenderableFilteredItems = useMemo(() => {
    if (filteredItems.length === 0) return false;
    for (const parent of orderedTopLevelCategories) {
      if (activeCategoryFilterIds !== null && !activeCategoryFilterIds.has(parent.id)) continue;
      const childIds = new Set(
        categories
          .filter((c) => c.parentCategoryId === parent.id)
          .map((c) => c.id),
      );
      const hasItemsInRenderedGroups = filteredItems.some(
        (it) => it.categoryIds.includes(parent.id) || it.categoryIds.some((cid) => childIds.has(cid)),
      );
      if (hasItemsInRenderedGroups) return true;
    }
    return false;
  }, [filteredItems, orderedTopLevelCategories, activeCategoryFilterIds, categories]);

  const orderedItemCategories = useMemo(() => {
    const childrenByParent = new Map<string, Category[]>();
    categories.forEach((category) => {
      if (!category.parentCategoryId) return;
      const parentId = category.parentCategoryId;
      const children = childrenByParent.get(parentId);
      if (children) children.push(category);
      else childrenByParent.set(parentId, [category]);
    });

    const ordered: Category[] = [];
    const seen = new Set<string>();
    orderedTopLevelCategories.forEach((parent) => {
      ordered.push(parent);
      seen.add(parent.id);
      const children = (childrenByParent.get(parent.id) ?? []).slice().sort(compareCategoriesBySortPosition);
      children.forEach((child) => {
        ordered.push(child);
        seen.add(child.id);
      });
    });

    categories
      .slice()
      .sort(compareCategoriesBySortPosition)
      .forEach((category) => {
        if (seen.has(category.id)) return;
        ordered.push(category);
      });

    return ordered;
  }, [categories, orderedTopLevelCategories]);

  const selectedVisibleCount = useMemo(
    () => filteredItems.reduce((n, it) => (selectedRows.has(it.id) ? n + 1 : n), 0),
    [filteredItems, selectedRows],
  );

  /** Drop selections that are not in the current filtered list so “select all” only ever applies to visible rows. */
  useEffect(() => {
    setSelectedRows((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (filteredItemIds.has(id)) next.add(id);
      });
      if (next.size === prev.size) {
        let changed = false;
        prev.forEach((id) => {
          if (!next.has(id)) changed = true;
        });
        if (!changed) return prev;
      }
      return next;
    });
  }, [filteredItemIds]);

  useEffect(() => {
    const el = itemsTableSelectAllRef.current;
    if (!el) return;
    const all = filteredItems.length > 0 && selectedVisibleCount === filteredItems.length;
    const some = selectedVisibleCount > 0 && !all;
    el.indeterminate = some;
  }, [filteredItems.length, selectedVisibleCount]);

  const mobileTopCats = categories.filter((c) => !c.parentCategoryId);
  const mobileAllExpanded = mobileTopCats.length > 0 && mobileTopCats.every((c) => mobileExpandedCats.has(c.id));

  const mobileSheetItem = mobileSheet ? items.find((it) => it.id === mobileSheet.id) : null;
  const isMobileAllChannelSheet = mobileSheet && !mobileSheet.channel;

  /** When a session is selected, dim rows outside that session (set matches API + item.sessionIds). */
  const sessionItemIds = useMemo(() => {
    const sessionId = normalizeSessionFilterId(sessionFilter, sessions);
    if (sessionId === 'all') return null;
    const sess = findSessionByFilterSelectionValue(sessions, sessionId);
    if (!sess) return new Set<string>();
    const ids = new Set<string>((sess.assignedItemIds ?? []).map((x) => String(x).trim()).filter(Boolean));
    const matchIds = getSessionMatchIdSet(sess);
    items.forEach((it) => {
      if (it.sessionIds?.some((x) => matchIds.has(String(x).trim()))) ids.add(it.id);
    });
    return ids;
  }, [sessionFilter, sessions, items]);

  const getItemState = useCallback((item: MenuItem, channel: OrderType, outletId?: string): EffectiveStateResult => {
    const resolvedOutletId = outletId && !isOrderTypeKey(outletId)
      ? outletId
      : outletOrderTypeIdByKey[channel];
    const localOtk = resolvedOutletId
      ? { ...outletOrderTypeIdByKey, [channel]: resolvedOutletId }
      : outletOrderTypeIdByKey;
    return resolveEffectiveState(item, channel, {
      categories,
      channel86Records: [],
      orderTypeIdByKey: localOtk,
      outletOrderTypeId: resolvedOutletId,
    });
  }, [categories, outletOrderTypeIdByKey]);

  // Toggle visibility for an item on a specific channel
  const toggleItemVisibility = useCallback(async (itemId: string, channel: OrderType, outletId?: string) => {
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    const userId = String(auth?.userId ?? auth?.id ?? auth?.staff_id ?? auth?.authUserId ?? '').trim();
    if (!locationId) {
      addToast('No location selected', 'error');
      return;
    }
    const orderTypeIdByKey = getOutletOrderTypeIdByKey(selectedBranch as Record<string, any>);
    const toggleOutletId = outletId && !isOrderTypeKey(outletId) ? outletId : orderTypeIdByKey[channel];
    // Read current visibility per outlet UUID when available (handles DoorDash/GrubHub/Ubereats collapse).
    const perOutletCurrent = toggleOutletId ? item.channelsByOrderTypeId?.[toggleOutletId]?.enabled : undefined;
    const currentVis = perOutletCurrent !== undefined
      ? perOutletCurrent
      : item.visibilityPerOrderType?.[channel] ?? true;
    const newVis = !currentVis;
    const nextVisibility = { ...item.visibilityPerOrderType, [channel]: newVis };
    if (mutationLockRef.current) return;
    mutationLockRef.current = true;
    setMutationBusy(true);
    try {
      // Build payload per outlet UUID. Only the toggled UUID changes; others keep their existing state
      // from the API (channelsByOrderTypeId) so we don't accidentally overwrite sibling third parties.
      const channelsPayload = channelRows
        .map((ch) => {
          const orderTypeId = ch.id;
          if (!orderTypeId) return null;
          const existing = item.channelsByOrderTypeId?.[orderTypeId];
          const enabled =
            orderTypeId === toggleOutletId
              ? newVis
              : existing !== undefined
                ? existing.enabled
                : nextVisibility[ch.key] ?? true;
          const availabilityEnabled = existing !== undefined ? existing.availabilityEnabled : enabled;
          return { orderTypeId, enabled, availabilityEnabled };
        })
        .filter((row): row is { orderTypeId: string; enabled: boolean; availabilityEnabled: boolean } => row !== null);
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
      const nextChannelsByOrderTypeId = { ...(item.channelsByOrderTypeId ?? {}) };
      if (toggleOutletId) {
        const prev = nextChannelsByOrderTypeId[toggleOutletId];
        nextChannelsByOrderTypeId[toggleOutletId] = {
          enabled: newVis,
          availabilityEnabled: prev?.availabilityEnabled ?? newVis,
          inactiveMode: prev?.inactiveMode ?? null,
          inactiveUntilTime: prev?.inactiveUntilTime ?? null,
          price: prev?.price,
          name: prev?.name,
        };
      }
      updateItem(itemId, {
        visibilityPerOrderType: nextVisibility,
        channelsByOrderTypeId: nextChannelsByOrderTypeId,
      });
      const chLabel = channelRows.find((c) => c.id === toggleOutletId)?.label ?? channelRows.find((c) => c.key === channel)?.label ?? channel;
      addToast(`${chLabel} ${newVis ? 'enabled' : 'disabled'} for '${item.name}'`, 'success');
      diagnosticAnchorRef.current = null;
      setDiagnosticCell(null);
      await refreshAll();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to update visibility', 'error');
    } finally {
      mutationLockRef.current = false;
      setMutationBusy(false);
    }
  }, [items, selectedBranch, auth, channelRows, updateItem, addToast, refreshAll]);

  // Toggle per-channel availability (86) without changing item creation status.
  const toggleItemAvailability = useCallback(async (itemId: string, channel: OrderType, outletId?: string, currentlyAvailable?: boolean) => {
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    const userId = String(auth?.userId ?? auth?.id ?? auth?.staff_id ?? auth?.authUserId ?? '').trim();
    if (!locationId) {
      addToast('No location selected', 'error');
      return;
    }
    const orderTypeIdByKey = getOutletOrderTypeIdByKey(selectedBranch as Record<string, any>);
    const orderTypeId = outletId ?? orderTypeIdByKey[channel];
    if (!orderTypeId) {
      addToast('Channel not available for this location', 'error');
      return;
    }
    const currentAvail = currentlyAvailable !== undefined
      ? currentlyAvailable
      : (() => {
          const perOutletAvail = item.channelsByOrderTypeId?.[orderTypeId]?.availabilityEnabled;
          return perOutletAvail !== undefined
            ? perOutletAvail
            : item.availabilityPerOrderType?.[channel] ?? (item.status !== 'out_of_stock');
        })();
    const nextAvail = !currentAvail;
    if (!nextAvail) {
      diagnosticAnchorRef.current = null;
      setDiagnosticCell(null);
      setAvailabilityTargetItemIds([itemId]);
      setBulkScope('specific');
      setBulkChannels(new Set([orderTypeId]));
      setBulkDuration('next_session');
      setBulkSpecificUntil('');
      setBulkModal('86');
      return;
    }
    if (mutationLockRef.current) return;
    mutationLockRef.current = true;
    setMutationBusy(true);
    try {
      await partialUpdateItemApi(
        {
          itemId,
          locationId,
          ...(userId ? { userId } : {}),
          availabilityChanges: [
            {
              orderTypeId,
              isEnable: nextAvail,
              inactiveUntil: nextAvail ? null : '9999-01-01T00:00:00',
              inactiveMode: nextAvail ? null : 'until_manually_enabled',
            },
          ],
        },
        token,
      );
      // Update the per-outlet entry (read path) so only the toggled third party changes; keep the
      // collapsed legacy field in sync for any remaining consumers.
      const nextChannelsByOrderTypeId = { ...(item.channelsByOrderTypeId ?? {}) };
      const prevOutlet = nextChannelsByOrderTypeId[orderTypeId];
      nextChannelsByOrderTypeId[orderTypeId] = {
        enabled: prevOutlet?.enabled ?? true,
        availabilityEnabled: nextAvail,
        inactiveMode: nextAvail ? null : (prevOutlet?.inactiveMode ?? null),
        inactiveUntilTime: nextAvail ? null : (prevOutlet?.inactiveUntilTime ?? null),
        price: prevOutlet?.price,
        name: prevOutlet?.name,
      };
      updateItem(itemId, {
        availabilityPerOrderType: { ...(item.availabilityPerOrderType ?? {}), [channel]: nextAvail },
        channelsByOrderTypeId: nextChannelsByOrderTypeId,
      });
      const chLabel = channelRows.find((c) => c.id === orderTypeId)?.label ?? channelRows.find((c) => c.key === channel)?.label ?? channel;
      addToast(`'${item.name}' ${nextAvail ? 'restored' : 'marked out of stock'} on ${chLabel}`, 'success');
      markProductCatalogSyncNeeded();
      diagnosticAnchorRef.current = null;
      setDiagnosticCell(null);
      await refreshAll();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to update availability', 'error');
    } finally {
      mutationLockRef.current = false;
      setMutationBusy(false);
    }
  }, [items, selectedBranch, auth, updateItem, addToast, channelRows, refreshAll]);

  // Bulk selection helpers
  const toggleRowSelect = useCallback((id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedRows(new Set(filteredItems.map((it) => it.id)));
  }, [filteredItems]);

  const clearSelection = useCallback(() => setSelectedRows(new Set()), []);
  const toggleCategoryRowSelect = useCallback((id: string) => {
    setSelectedCategoryRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const clearCategorySelection = useCallback(() => setSelectedCategoryRows(new Set()), []);

  /** Leaving Items tab: clear item bulk selection (banner/modal must not appear on Categories). */
  useEffect(() => {
    if (activeTab !== 'items') {
      clearSelection();
      setBulkModal(null);
      setAvailabilityTargetItemIds(null);
    }
  }, [activeTab, clearSelection]);

  const modalTargetIds = availabilityTargetItemIds ?? Array.from(selectedRows);
  const modalTargetCount = modalTargetIds.length;

  const computeInactiveWindow = useCallback((): { inactiveMode: string; inactiveUntil: string } => {
    if (bulkDuration === 'manual') {
      return { inactiveMode: 'until_manually_enabled', inactiveUntil: '9999-01-01T00:00:00' };
    }
    if (bulkDuration === 'specific_time') {
      return {
        inactiveMode: 'until_specific_time',
        inactiveUntil: bulkSpecificUntil
          ? formatInactiveUntilLocal(bulkSpecificUntil)
          : formatInactiveUntilFromDate(new Date(Date.now() + 60 * 60 * 1000)),
      };
    }
    if (bulkDuration === 'end_of_day') {
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
  }, [bulkDuration, bulkSpecificUntil, sessions, selectedBranch]);

  // Bulk actions
  const bulkMarkOOS = useCallback(async () => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    const userId = String(auth?.userId ?? auth?.id ?? auth?.staff_id ?? auth?.authUserId ?? '').trim();
    if (!locationId) {
      addToast('No location selected', 'error');
      return;
    }
    const selectedRowList = bulkScope === 'all'
      ? channelRows
      : channelRows.filter((c) => bulkChannels.has(c.id));
    const { inactiveMode, inactiveUntil } = computeInactiveWindow();
    const channelAvailability = selectedRowList
      .map((row) => {
        const orderTypeId = row.id;
        if (!orderTypeId) return null;
        return { orderTypeId, isEnable: false, inactiveMode, inactiveUntil };
      })
      .filter(Boolean);
    if (channelAvailability.length === 0) {
      addToast('No enabled channels found for this branch', 'error');
      return;
    }

    const payload = {
      locationId,
      userId,
      itemIds: modalTargetIds,
      channelAvailability,
    };
    if (mutationLockRef.current) return;
    mutationLockRef.current = true;
    setMutationBusy(true);
    try {
      await bulkEditItemApi('availability', payload, token);
      const affectedKeys = Array.from(new Set(selectedRowList.map((r) => r.key)));
      const affectedOutletIds = selectedRowList.map((r) => r.id).filter(Boolean);
      modalTargetIds.forEach((id) => {
        const item = items.find((it) => it.id === id);
        if (!item) return;
        const nextAvail = { ...(item.availabilityPerOrderType ?? {}) };
        affectedKeys.forEach((key) => {
          nextAvail[key] = false;
        });
        // Update each affected per-outlet entry (read path) so only the selected third parties change.
        const nextChannelsByOrderTypeId = { ...(item.channelsByOrderTypeId ?? {}) };
        affectedOutletIds.forEach((outletId) => {
          const prev = nextChannelsByOrderTypeId[outletId];
          nextChannelsByOrderTypeId[outletId] = {
            enabled: prev?.enabled ?? true,
            availabilityEnabled: false,
            inactiveMode: prev?.inactiveMode ?? inactiveMode ?? null,
            inactiveUntilTime: prev?.inactiveUntilTime ?? inactiveUntil ?? null,
            price: prev?.price,
            name: prev?.name,
          };
        });
        updateItem(id, { availabilityPerOrderType: nextAvail, channelsByOrderTypeId: nextChannelsByOrderTypeId });
      });
      addToast(`${itemCountLabel(modalTargetIds.length)} marked out of stock (${bulkDuration})`, 'success');
      markProductCatalogSyncNeeded();
      if (!availabilityTargetItemIds) clearSelection();
      setAvailabilityTargetItemIds(null);
      diagnosticAnchorRef.current = null;
      setDiagnosticCell(null);
      setBulkModal(null);
      await refreshAll();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to mark products out of stock' /* was: 'Failed to mark items out of stock' */;
      addToast(message, 'error');
    } finally {
      mutationLockRef.current = false;
      setMutationBusy(false);
    }
  }, [selectedBranch, auth, bulkScope, bulkChannels, computeInactiveWindow, modalTargetIds, bulkDuration, items, updateItem, addToast, availabilityTargetItemIds, clearSelection, refreshAll, channelRows]);

  const bulkRestore = useCallback(async () => {
    const locId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const tok = auth?.accessToken ?? auth?.access_token ?? null;
    const userId = String(auth?.userId ?? auth?.id ?? auth?.staff_id ?? auth?.authUserId ?? '').trim();
    if (!locId) {
      addToast('No location selected', 'error');
      return;
    }
    const ids = Array.from(selectedRows);
    if (ids.length === 0) return;
    const orderTypeIdByKey = getOutletOrderTypeIdByKey(selectedBranch as Record<string, any>);
    const channelAvailability = channelRows
      .map((ch) => {
        const orderTypeId = ch.id;
        if (!orderTypeId) return null;
        return { orderTypeId, isEnable: true, inactiveUntil: null, inactiveMode: null };
      })
      .filter((row): row is { orderTypeId: string; isEnable: boolean; inactiveUntil: null; inactiveMode: null } => row !== null);
    if (channelAvailability.length === 0) {
      addToast('No enabled channels found for this branch', 'error');
      return;
    }
    if (mutationLockRef.current) return;
    mutationLockRef.current = true;
    setMutationBusy(true);
    try {
      await bulkEditItemApi('availability', { locationId: locId, itemIds: ids, channelAvailability, ...(userId ? { userId } : {}) }, tok);
      ids.forEach((id) => {
        const item = items.find((it) => it.id === id);
        if (!item) return;
        const nextAvail = { ...(item.availabilityPerOrderType ?? {}) };
        const nextChannelsByOrderTypeId = { ...(item.channelsByOrderTypeId ?? {}) };
        channelRows.forEach((ch) => {
          nextAvail[ch.key] = true;
          if (!ch.id) return;
          const prev = nextChannelsByOrderTypeId[ch.id];
          nextChannelsByOrderTypeId[ch.id] = {
            enabled: prev?.enabled ?? true,
            availabilityEnabled: true,
            inactiveMode: null,
            inactiveUntilTime: null,
            price: prev?.price,
            name: prev?.name,
          };
        });
        updateItem(id, { availabilityPerOrderType: nextAvail, channelsByOrderTypeId: nextChannelsByOrderTypeId, status: 'active' as any });
      });
      addToast(`${itemCountLabel(ids.length)} restored`, 'success');
      markProductCatalogSyncNeeded();
      clearSelection();
      setBulkModal(null);
      await refreshAll();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to restore products' /* was: 'Failed to restore items' */, 'error');
    } finally {
      mutationLockRef.current = false;
      setMutationBusy(false);
    }
  }, [selectedRows, selectedBranch, auth, items, channelRows, updateItem, addToast, clearSelection, refreshAll]);

  const buildCategoryOrderTypesPayload = useCallback((enable: boolean) => {
    const inactiveUntil = enable ? null : '9999-01-01T00:00:00';
    const inactiveMode = enable ? null : 'until_manually_enabled';
    return {
      inactiveUntil,
      inactiveMode,
      orderTypes: channelRows
        .map((ch) => {
          const orderTypeId = outletOrderTypeIdByKey[ch.key];
          if (!orderTypeId) return null;
          return { orderTypeId, inactiveUntil, inactiveMode };
        })
        .filter((row): row is { orderTypeId: string; inactiveUntil: string | null; inactiveMode: string | null } => row !== null),
    };
  }, [channelRows, outletOrderTypeIdByKey]);

  const applyCategoryAvailability = useCallback(async (ids: string[], enable: boolean) => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    const userId = String(auth?.userId ?? auth?.id ?? auth?.staff_id ?? auth?.authUserId ?? '').trim();
    if (!locationId) {
      addToast('No location selected', 'error');
      return;
    }
    const { inactiveUntil, inactiveMode, orderTypes } = buildCategoryOrderTypesPayload(enable);
    if (orderTypes.length === 0) {
      addToast('No enabled channels found for this branch', 'error');
      return;
    }
    if (mutationLockRef.current) return;
    mutationLockRef.current = true;
    setMutationBusy(true);
    try {
      if (ids.length === 1) {
        await partialUpdateCategoryAvailabilityApi(
          {
            categoryId: ids[0],
            locationId,
            ...(userId ? { userId } : {}),
            inactiveUntil,
            inactiveMode,
            orderTypes,
          },
          token,
        );
      } else {
        await bulkEditCategoryAvailabilityApi(
          {
            categoryIds: ids,
            locationId,
            ...(userId ? { userId } : {}),
            orderTypes,
          },
          token,
        );
      }
      const names = categories.filter((c) => ids.includes(c.id)).map((c) => c.name);
      addToast(
        ids.length === 1
          ? `Category '${names[0] ?? ids[0]}' ${enable ? 'restored' : 'marked out of stock'}`
          : `${ids.length} categories ${enable ? 'restored' : 'marked out of stock'}`,
        'success',
      );
      clearCategorySelection();
      setCategoryAvailabilityConfirm(null);
      markProductCatalogSyncNeeded();
      await refreshAll();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to update category availability', 'error');
    } finally {
      mutationLockRef.current = false;
      setMutationBusy(false);
    }
  }, [selectedBranch, auth, buildCategoryOrderTypesPayload, categories, addToast, clearCategorySelection, refreshAll]);

  const toggleCategoryChannelVisibility = useCallback(async (categoryId: string, channel: OrderType, toggleOrderTypeId: string) => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    const userId = String(auth?.userId ?? auth?.id ?? auth?.staff_id ?? auth?.authUserId ?? '').trim();
    if (!locationId) {
      addToast('No location selected', 'error');
      return;
    }
    const target = categories.find((c) => c.id === categoryId);
    if (!target) return;
    // Read current state of the specific outlet being toggled
    const existingRow = (target.channelVisibility ?? []).find(
      (cv) => String(cv.orderTypeId ?? '').trim() === toggleOrderTypeId,
    );
    const current = existingRow ? existingRow.enabled !== false : false;
    // Send only the toggled orderTypeId — backend does a partial update per entry
    const channelVisibility = [{ orderTypeId: toggleOrderTypeId, enabled: !current }];
    if (mutationLockRef.current) return;
    mutationLockRef.current = true;
    setMutationBusy(true);
    try {
      await updateCategoryApi(
        {
          categoryId,
          locationId,
          channelVisibility,
          ...(userId ? ({ userId } as any) : {}),
        } as any,
        token,
      );
      addToast(`'${target.name}' ${!current ? 'shown' : 'hidden'} on ${channelRows.find((c) => c.id === toggleOrderTypeId)?.label ?? channelRows.find((c) => c.key === channel)?.label ?? channel}`, 'success');
      markProductCatalogSyncNeeded();
      await refreshAll();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to update category visibility', 'error');
    } finally {
      mutationLockRef.current = false;
      setMutationBusy(false);
    }
  }, [selectedBranch, auth, categories, channelRows, addToast, refreshAll]);

  const mobileToggleVisibility = useCallback((itemId: string, channel: OrderType) => {
    const item = items.find((it) => it.id === itemId); if (!item) return;
    const vis = item.visibilityPerOrderType?.[channel] ?? true;
    updateItem(itemId, { visibilityPerOrderType: { ...item.visibilityPerOrderType, [channel]: !vis } });
    const chLabel = channelRows.find((c) => c.key === channel)?.label ?? channel;
    addToast(`'${item.name}' ${!vis ? 'visible' : 'hidden'} on ${chLabel}`, 'success');
  }, [items, updateItem, addToast, channelRows]);

  const mobileToggleAvailability = useCallback((itemId: string) => {
    const item = items.find((it) => it.id === itemId); if (!item) return;
    const next = item.status === 'active' ? 'out_of_stock' : 'active';
    updateItem(itemId, { status: next as any });
    addToast(`'${item.name}' ${next === 'active' ? 'restored' : 'marked out of stock'}`, 'success');
  }, [items, updateItem, addToast]);

  const mobileOosAll = useCallback((itemId: string) => {
    const item = items.find((it) => it.id === itemId); if (!item) return;
    updateItem(itemId, { status: 'out_of_stock' as any });
    addToast(`'${item.name}' marked OOS on all channels`, 'success');
    setMobileSheet(null);
  }, [items, updateItem, addToast]);

  const mobileRestoreAll = useCallback((itemId: string) => {
    const item = items.find((it) => it.id === itemId); if (!item) return;
    updateItem(itemId, { status: 'active' as any });
    addToast(`'${item.name}' restored on all channels`, 'success');
    setMobileSheet(null);
  }, [items, updateItem, addToast]);

  const mobileHideAll = useCallback((itemId: string) => {
    const item = items.find((it) => it.id === itemId); if (!item) return;
    const vis: Record<string, boolean> = {};
    channelRows.forEach((ch) => { vis[ch.key] = false; });
    updateItem(itemId, { visibilityPerOrderType: vis as any });
    addToast(`'${item.name}' hidden from all channels`, 'success');
    setMobileSheet(null);
  }, [items, updateItem, addToast, channelRows]);

  const mobileShowAll = useCallback((itemId: string) => {
    const item = items.find((it) => it.id === itemId); if (!item) return;
    const vis: Record<string, boolean> = {};
    channelRows.forEach((ch) => { vis[ch.key] = true; });
    updateItem(itemId, { visibilityPerOrderType: vis as any });
    addToast(`'${item.name}' visible on all channels`, 'success');
    setMobileSheet(null);
  }, [items, updateItem, addToast, channelRows]);

  const toggleExpand = (catId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };

  const toggleParentCat = (catId: string) => {
    setExpandedParentCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };

  const tabs: { id: EntityTab; label: string; icon: string; count: number }[] = [
    { id: 'items', label: 'Products' /* was: label: 'Items' */, icon: 'inventory_2', count: items.length },
    { id: 'categories', label: 'Categories', icon: 'category', count: categories.filter((c) => !c.parentCategoryId).length },
  ];

  // Summary KPIs
  const summary = useMemo(() => {
    let showing = 0, soldOut = 0, hidden = 0;
    filteredItems.forEach((it) => {
      if (it.status === 'active') showing++;
      else if (it.status === 'out_of_stock') soldOut++;
      else hidden++;
    });
    return { showing, soldOut, hidden, total: filteredItems.length };
  }, [filteredItems]);

  const content = (
    <div style={{ padding: isMobile ? 16 : 25, paddingBottom: activeTab === 'items' && selectedRows.size > 0 ? 80 : undefined }}>
      {/* Page header — same pattern as other catalog pages */}
      {!isMobile && (
        <PageHeader
          icon={<span className="material-symbols-rounded" style={{ fontSize: 24, color: 'rgba(255,255,255,0.95)' }}>dashboard</span>}
          title="Control Center"
          subtitle="Manage where everything appears and whether it's available"
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setShowOverviewTutorial(true)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 2,
                border: `1px solid ${BORDER}`, background: CARD_BG, cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: T2, fontFamily: 'var(--font-primary)',
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: 16, color: ACCENT }}>map</span>
                Product Catalog Tour
              </button>
              <button type="button" onClick={() => setShowTutorial(true)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 2,
                border: `1px solid ${BORDER}`, background: CARD_BG, cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: T2, fontFamily: 'var(--font-primary)',
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: 16, color: ACCENT }}>help</span>
                How Control Center Works
              </button>
            </div>
          }
        />
      )}
      {!isMobile && <ProductCatalogSyncBanner />}

      {isMobile && (
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: CARD_BG, borderBottom: `1px solid ${BORDER}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, margin: '-16px -16px 16px' }}>
          <span onClick={() => navigate(PC_BASE)} className="material-symbols-rounded" style={{ fontSize: 22, color: T1, cursor: 'pointer' }}>arrow_back</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: T1, margin: 0, fontFamily: 'var(--font-primary)' }}>Control Center</h1>
        </div>
      )}

      {/* KPI Summary Row (hidden on FE for now) */}
      {false && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Active', value: summary.showing, color: GREEN, bg: 'rgba(95,122,85,0.06)' },
            { label: 'Out of Stock', value: summary.soldOut, color: ORANGE, bg: 'rgba(176,122,42,0.06)' },
            { label: 'Hidden / Draft', value: summary.hidden, color: T3, bg: HOVER },
            { label: 'Total Items', value: summary.total, color: T1, bg: ACCENT_SOFT },
          ].map((kpi) => (
            <div key={kpi.label} style={{
              flex: '1 1 140px', padding: '14px 18px', borderRadius: 2,
              background: CARD_BG, border: `1px solid ${BORDER}`, boxShadow: SHADOW,
            }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: T2, textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-primary)' }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: kpi.color, fontFamily: 'var(--font-primary)', marginTop: 4 }}>
                {kpi.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View mode toggle (hidden on FE for now) */}
      {false && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: HOVER, borderRadius: 2, padding: 3, width: 'fit-content' }}>
          {([
            { id: 'availability' as const, label: 'Availability', icon: 'toggle_on' },
            { id: 'visibility' as const, label: 'Visibility', icon: 'visibility' },
            { id: 'both' as const, label: 'Both', icon: 'view_column' },
          ]).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setViewMode(m.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 2,
                border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                background: viewMode === m.id ? CARD_BG : 'transparent',
                color: viewMode === m.id ? (m.id === 'visibility' ? PURPLE : m.id === 'availability' ? TEAL : T1) : T3,
                boxShadow: viewMode === m.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                fontFamily: 'var(--font-primary)', transition: 'all 0.15s',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab strip */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `1px solid ${BORDER}` }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
              border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.id ? `2px solid ${ACCENT}` : '2px solid transparent',
              color: activeTab === tab.id ? ACCENT : T2,
              fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-primary)',
              transition: 'all 0.15s',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{tab.icon}</span>
            {tab.label}
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
              background: activeTab === tab.id ? ACCENT_SOFT : HOVER,
              color: activeTab === tab.id ? ACCENT : T3,
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Category / session / availability filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {activeTab === 'items' && (
          <>
            <div style={{ flex: '1 1 0', minWidth: 0, maxWidth: CONTROL_CENTRE_FILTER_MAX_WIDTH_PX }}>
              <ControlCentreFilterDropdown
                value={itemsCategoryFilter}
                onChange={setItemsCategoryFilter}
                options={itemsCategoryDropdownOptions}
                ariaLabel="Filter by category"
                variant="purple"
                isActive={itemsCategoryFilter !== 'all'}
              />
            </div>
            <div style={{ flex: '1 1 0', minWidth: 0, maxWidth: CONTROL_CENTRE_FILTER_MAX_WIDTH_PX }}>
              <ControlCentreFilterDropdown
                value={sessionFilter}
                onChange={setSessionFilter}
                options={sessionDropdownOptions}
                ariaLabel="Filter by session"
                variant="purple"
                isActive={sessionFilter !== 'all'}
              />
            </div>
            <div style={{ flex: '1 1 0', minWidth: 0, maxWidth: CONTROL_CENTRE_FILTER_MAX_WIDTH_PX }}>
              <ControlCentreFilterDropdown
                value={itemsAvailabilityFilter}
                onChange={(v) => {
                  if (v === 'all' || v === 'fully_available' || v === 'partially_available' || v === 'not_available') {
                    setItemsAvailabilityFilter(v);
                  }
                }}
                options={ITEMS_TAB_AVAILABILITY_OPTIONS}
                ariaLabel="Filter by product availability" /* was: ariaLabel="Filter by item availability" */
                variant="teal"
                isActive={itemsAvailabilityFilter !== 'all'}
              />
            </div>
          </>
        )}
        {activeTab === 'categories' && (
          <div style={{ flex: '0 1 auto', minWidth: 0, width: '100%', maxWidth: CONTROL_CENTRE_FILTER_MAX_WIDTH_PX }}>
            <ControlCentreFilterDropdown
              value={categoryVisibilityFilter}
              onChange={(v) => {
                if (v === 'all' || v === 'full' || v === 'partial' || v === 'none') setCategoryVisibilityFilter(v);
              }}
              options={CATEGORY_TAB_VISIBILITY_OPTIONS}
              ariaLabel="Filter by channel visibility"
              variant="purple"
              isActive={categoryVisibilityFilter !== 'all'}
            />
          </div>
        )}
      </div>

      {/* Search + Legend (same line) — search width fixed (no flex-grow) so it does not jump when filtering/reflowing */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap', width: '100%' }}>
        <div style={{ width: 'min(100%, 320px)', maxWidth: 320, flex: '0 0 auto', minWidth: 0 }}>
          <SearchInput
            value={activeTab === 'categories' ? searchCategories : searchItems}
            onChange={(v) => (activeTab === 'categories' ? setSearchCategories(v) : setSearchItems(v))}
            placeholder={activeTab === 'categories' ? 'Search categories…' : 'Search by name or code…'}
          />
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: T2, fontFamily: 'var(--font-primary)' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 13, color: PURPLE }}>visibility</span>
            Visible
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: T2, fontFamily: 'var(--font-primary)' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 13, color: T3, opacity: 0.5 }}>visibility_off</span>
            Hidden
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: T2, fontFamily: 'var(--font-primary)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: TEAL, flexShrink: 0 }} />
            Available
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: T2, fontFamily: 'var(--font-primary)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: ORANGE, flexShrink: 0 }} />
            OOS
          </div>
        </div>
      </div>

      {(itemsLoading || categoriesLoading) && (
        <div style={{ marginTop: 4 }}>
          <style>{`@keyframes controlCentreShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <DesktopShimmerRow key={i} height={i % 3 === 0 ? 110 : 72} />
          ))}
        </div>
      )}

      {/* Items Matrix */}
      {!itemsLoading && !categoriesLoading && activeTab === 'items' && !hasRenderableFilteredItems && (
        <div
          style={{
            background: CARD_BG,
            borderRadius: 2,
            border: `1px solid ${BORDER}`,
            boxShadow: SHADOW,
            padding: '48px 28px',
            textAlign: 'center',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 44, color: T3, display: 'block', marginBottom: 12 }}>
            {items.length === 0 ? 'inventory_2' : 'filter_alt_off'}
          </span>
          <div style={{ fontSize: 15, fontWeight: 600, color: T1, marginBottom: 6 }}>
            {items.length === 0 ? 'No products in this catalog' /* was: 'No items in this catalog' */ : 'No products for this filter' /* was: 'No items for this filter' */}
          </div>
          <div style={{ fontSize: 12, color: T3, maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>
            {items.length === 0
              ? 'Products for this location will appear here once they are added.' /* was: 'Items for this location will appear here once they are added.' */
              : itemsTabHasActiveFilters
                ? 'Try adjusting category, session, availability, or search.'
                : 'No products match the current view.' /* was: 'No items match the current view.' */}
          </div>
        </div>
      )}
      {!itemsLoading && !categoriesLoading && activeTab === 'items' && hasRenderableFilteredItems && (
        <div style={{ background: CARD_BG, borderRadius: 2, border: `1px solid ${BORDER}`, boxShadow: SHADOW, overflow: 'visible' }}>
          <div style={{ overflow: 'visible' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 12, fontFamily: 'var(--font-primary)' }}>
              <colgroup>
                <col style={{ width: 32 }} />
                <col />
                {activeChannels.map((ch) => (
                  <col key={ch.id} style={{ width: CONTROL_CENTRE_CHANNEL_COL_PX }} />
                ))}
              </colgroup>
              <thead>
                <tr style={{ background: PAGE_BG }}>
                  <th style={{ padding: '12px 8px', borderBottom: `1px solid ${BORDER}`, width: 32 }}>
                    <input
                      ref={itemsTableSelectAllRef}
                      type="checkbox"
                      checked={filteredItems.length > 0 && selectedVisibleCount === filteredItems.length}
                      onChange={(e) => (e.target.checked ? selectAll() : clearSelection())}
                      style={{ accentColor: ACCENT, width: 14, height: 14, cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, position: 'sticky', left: 32, background: PAGE_BG, zIndex: 2, minWidth: 0, fontWeight: 600, fontSize: 11, color: T2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Item
                  </th>
                  {/* Status column (hidden on FE for now) */}
                  {false && (
                    <th style={{ padding: '12px 8px', borderBottom: `1px solid ${BORDER}`, fontWeight: 600, fontSize: 11, color: T2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                  )}
                  {activeChannels.map((ch) => (
                    <th key={ch.id} style={{ padding: '12px 8px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center', width: CONTROL_CENTRE_CHANNEL_COL_PX, minWidth: CONTROL_CENTRE_CHANNEL_COL_PX, maxWidth: CONTROL_CENTRE_CHANNEL_COL_PX, boxSizing: 'border-box', overflow: 'hidden', verticalAlign: 'bottom' }}>
                      <span className="material-symbols-rounded" style={{ fontSize: 18, color: T2, display: 'block', marginBottom: 2 }}>{ch.icon}</span>
                      <span style={CONTROL_CENTRE_CHANNEL_HEADER_LABEL} title={ch.label}>{ch.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderedTopLevelCategories.map((parent) => {
                  // Skip parent categories outside the active category filter tree
                  if (activeCategoryFilterIds !== null && !activeCategoryFilterIds.has(parent.id)) return null;
                  const childCategories = categories
                    .filter((c) => c.parentCategoryId === parent.id)
                    .slice()
                    .sort(compareCategoriesBySortPosition);
                  const parentItems = sortItemsByCategoryPosition(
                    filteredItems.filter((it) => it.categoryIds.includes(parent.id)),
                    parent.id,
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
                  const parentAllItems = [...parentItems, ...childGroups.flatMap((group) => group.items)];
                  if (parentAllItems.length === 0) return null;
                  const isExpanded = expandedCategories.has(parent.id);
                  const parentNameLabel = truncateControlCentreLabel(parent.name);

                  return [
                    <tr key={`cat-${parent.id}`} onClick={() => toggleExpand(parent.id)} style={{ cursor: 'pointer', background: HOVER }}>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={parentAllItems.every((it) => selectedRows.has(it.id))}
                          onChange={(e) => {
                            e.stopPropagation();
                            parentAllItems.forEach((it) => {
                              setSelectedRows((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(it.id);
                                else next.delete(it.id);
                                return next;
                              });
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{ accentColor: ACCENT, width: 14, height: 14, cursor: 'pointer' }}
                        />
                      </td>
                      <td
                        colSpan={1 + activeChannels.length}
                        style={{ padding: '10px 16px', fontWeight: 600, color: T1, position: 'sticky', left: 32, background: HOVER, zIndex: 1, fontSize: 13, whiteSpace: 'normal', wordBreak: 'break-word', overflow: 'visible', lineHeight: 1.35 }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 8, color: T3, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s', display: 'inline-block' }}>
                          chevron_right
                        </span>
                        <span title={parentNameLabel.title}>{parentNameLabel.display}</span>
                        <span style={{ fontSize: 13, color: T3, fontWeight: 500, marginLeft: 8 }}>{parentAllItems.length} items</span>
                      </td>
                    </tr>,
                    ...(isExpanded
                      ? [
                        ...parentItems.map((item) => {
                          const outsideSession = sessionItemIds !== null && !sessionItemIds.has(item.id);
                          const itemNameLabel = truncateControlCentreLabel(item.name);
                          return (
                            <tr key={`${parent.id}-${item.id}`} style={{ borderBottom: `1px solid ${PAGE_BG}`, opacity: outsideSession ? 0.4 : 1 }}>
                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                <input type="checkbox" checked={selectedRows.has(item.id)} onChange={() => toggleRowSelect(item.id)} onClick={(e) => e.stopPropagation()} style={{ accentColor: ACCENT, width: 14, height: 14, cursor: 'pointer' }} />
                              </td>
                              <td style={{ padding: '8px 16px 8px 12px', color: T1, position: 'sticky', left: 32, background: CARD_BG, zIndex: 1, fontSize: 12, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35 }}>
                                <span style={{ fontWeight: 500 }} title={itemNameLabel.title}>{itemNameLabel.display}</span>
                                <span style={{ color: T3, marginLeft: 6 }}>{formatItemCodeListDisplay(item.itemCode)}</span>
                                {outsideSession && <span style={{ fontSize: 8, color: ORANGE, marginLeft: 6, fontWeight: 600 }}>Outside session</span>}
                              </td>
                              {false && <td />}
                              {activeChannels.map((ch) => {
                                const result = getItemState(item, ch.key, ch.id);
                                const cellKey = `${parent.id}-${item.id}-${ch.id}`;
                                const isOpen = diagnosticCell?.cellKey === cellKey;
                                const isVis = result.visible;
                                const isAvail = result.available;
                                const { allows: catAllows } = itemCategoryVisibilityAllowsChannel(item, ch.key, categories, outletOrderTypeIdByKey, ch.id);
                                const isBlocked = result.effective === 'blocked' || !catAllows;
                                return (
                                  <td key={ch.id} style={{ textAlign: 'center', padding: '6px 8px', width: CONTROL_CENTRE_CHANNEL_COL_PX, minWidth: CONTROL_CENTRE_CHANNEL_COL_PX, maxWidth: CONTROL_CENTRE_CHANNEL_COL_PX, boxSizing: 'border-box', overflow: 'visible', verticalAlign: 'middle', position: 'relative' }}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (e.shiftKey) {
                                          if (isBlocked) return;
                                          toggleItemVisibility(item.id, ch.key, ch.id);
                                          return;
                                        }
                                        if (isOpen) {
                                          diagnosticAnchorRef.current = null;
                                          setDiagnosticCell(null);
                                        } else {
                                          diagnosticAnchorRef.current = e.currentTarget;
                                          setDiagnosticCell({ cellKey, entityId: item.id, channel: ch.key });
                                        }
                                      }}
                                      style={{ background: 'none', border: isOpen ? '2px solid #000000' : 'none', boxSizing: 'border-box', cursor: 'pointer', padding: 0, borderRadius: 2, maxWidth: '100%', transition: 'background 0.15s, border-color 0.15s' }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = HOVER; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                                      title={isBlocked ? `${ch.label}: ${channelEffectiveTooltipLabel(result.effective)}` : `${ch.label}: ${channelEffectiveTooltipLabel(result.effective)} (Shift+click to quick toggle)`}
                                    >
                                      <CellIndicator visible={isVis} available={isAvail} blocked={isBlocked} mode={viewMode} />
                                    </button>
                                    {isOpen && diagnosticCell && (
                                      <CellPopover
                                        result={result}
                                        channelLabel={ch.label}
                                        diagnostics={getChannelPopoverDiagnostics(item, ch.key, categories, outletOrderTypeIdByKey, storeTimeZone, ch.id)}
                                        onClose={() => {
                                          diagnosticAnchorRef.current = null;
                                          setDiagnosticCell(null);
                                        }}
                                        onToggleVisibility={isBlocked ? undefined : () => toggleItemVisibility(item.id, ch.key, ch.id)}
                                        onToggleAvailability={isBlocked || !isVis ? undefined : () => toggleItemAvailability(item.id, ch.key, ch.id, isAvail)}
                                        actionsDisabled={mutationBusy}
                                        anchorRect={diagnosticAnchorRef.current?.getBoundingClientRect() ?? null}
                                      />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        }),
                        ...childGroups.flatMap(({ child, items: childItems }) => {
                          const childNameLabel = truncateControlCentreLabel(child.name);
                          return [
                          <tr key={`child-${child.id}`} style={{ background: '#F7F4EC' }}>
                            <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={childItems.every((it) => selectedRows.has(it.id))}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  childItems.forEach((it) => {
                                    setSelectedRows((prev) => {
                                      const next = new Set(prev);
                                      if (e.target.checked) next.add(it.id);
                                      else next.delete(it.id);
                                      return next;
                                    });
                                  });
                                }}
                                onClick={(e) => e.stopPropagation()}
                                style={{ accentColor: ACCENT, width: 14, height: 14, cursor: 'pointer' }}
                              />
                            </td>
                            <td
                              colSpan={1 + activeChannels.length}
                              style={{ padding: '8px 16px 8px 28px', fontWeight: 600, color: T2, position: 'sticky', left: 32, background: '#F7F4EC', zIndex: 1, fontSize: 12, whiteSpace: 'normal', wordBreak: 'break-word', overflow: 'visible', lineHeight: 1.35 }}
                            >
                              <span title={childNameLabel.title}>{childNameLabel.display}</span>
                              <span style={{ fontSize: 12, color: T3, fontWeight: 500, marginLeft: 8 }}>{childItems.length} items</span>
                            </td>
                          </tr>,
                          ...childItems.map((item) => {
                            const outsideSession = sessionItemIds !== null && !sessionItemIds.has(item.id);
                            const itemNameLabel = truncateControlCentreLabel(item.name);
                            return (
                              <tr key={`${child.id}-${item.id}`} style={{ borderBottom: `1px solid ${PAGE_BG}`, opacity: outsideSession ? 0.4 : 1 }}>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                  <input type="checkbox" checked={selectedRows.has(item.id)} onChange={() => toggleRowSelect(item.id)} onClick={(e) => e.stopPropagation()} style={{ accentColor: ACCENT, width: 14, height: 14, cursor: 'pointer' }} />
                                </td>
                                <td style={{ padding: '8px 16px 8px 24px', color: T1, position: 'sticky', left: 32, background: CARD_BG, zIndex: 1, fontSize: 12, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35 }}>
                                  <span style={{ fontWeight: 500 }} title={itemNameLabel.title}>{itemNameLabel.display}</span>
                                  <span style={{ color: T3, marginLeft: 6 }}>{formatItemCodeListDisplay(item.itemCode)}</span>
                                  {outsideSession && <span style={{ fontSize: 8, color: ORANGE, marginLeft: 6, fontWeight: 600 }}>Outside session</span>}
                                </td>
                                {false && <td />}
                                {activeChannels.map((ch) => {
                                  const result = getItemState(item, ch.key, ch.id);
                                  const cellKey = `${child.id}-${item.id}-${ch.id}`;
                                  const isOpen = diagnosticCell?.cellKey === cellKey;
                                  const isVis = result.visible;
                                  const isAvail = result.available;
                                  const { allows: catAllows } = itemCategoryVisibilityAllowsChannel(item, ch.key, categories, outletOrderTypeIdByKey, ch.id);
                                  const isBlocked = result.effective === 'blocked' || !catAllows;
                                  return (
                                    <td key={ch.id} style={{ textAlign: 'center', padding: '6px 8px', width: CONTROL_CENTRE_CHANNEL_COL_PX, minWidth: CONTROL_CENTRE_CHANNEL_COL_PX, maxWidth: CONTROL_CENTRE_CHANNEL_COL_PX, boxSizing: 'border-box', overflow: 'visible', verticalAlign: 'middle', position: 'relative' }}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (e.shiftKey) {
                                            if (isBlocked) return;
                                            toggleItemVisibility(item.id, ch.key, ch.id);
                                            return;
                                          }
                                          if (isOpen) {
                                            diagnosticAnchorRef.current = null;
                                            setDiagnosticCell(null);
                                          } else {
                                            diagnosticAnchorRef.current = e.currentTarget;
                                            setDiagnosticCell({ cellKey, entityId: item.id, channel: ch.key });
                                          }
                                        }}
                                        style={{ background: 'none', border: isOpen ? '2px solid #000000' : 'none', boxSizing: 'border-box', cursor: 'pointer', padding: 0, borderRadius: 2, maxWidth: '100%', transition: 'background 0.15s, border-color 0.15s' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = HOVER; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                                        title={isBlocked ? `${ch.label}: ${channelEffectiveTooltipLabel(result.effective)}` : `${ch.label}: ${channelEffectiveTooltipLabel(result.effective)} (Shift+click to quick toggle)`}
                                      >
                                        <CellIndicator visible={isVis} available={isAvail} blocked={isBlocked} mode={viewMode} />
                                      </button>
                                      {isOpen && diagnosticCell && (
                                        <CellPopover
                                          result={result}
                                          channelLabel={ch.label}
                                          diagnostics={getChannelPopoverDiagnostics(item, ch.key, categories, outletOrderTypeIdByKey, storeTimeZone, ch.id)}
                                          onClose={() => {
                                            diagnosticAnchorRef.current = null;
                                            setDiagnosticCell(null);
                                          }}
                                          onToggleVisibility={isBlocked ? undefined : () => toggleItemVisibility(item.id, ch.key, ch.id)}
                                          onToggleAvailability={isBlocked || !isVis ? undefined : () => toggleItemAvailability(item.id, ch.key, ch.id, isAvail)}
                                          actionsDisabled={mutationBusy}
                                          anchorRect={diagnosticAnchorRef.current?.getBoundingClientRect() ?? null}
                                        />
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          }),
                        ];
                      }),
                      ]
                      : []),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Categories Tab — parent → child accordion table */}
      {!itemsLoading && !categoriesLoading && activeTab === 'categories' && !categoriesTabHasVisibleRows && (
        <div
          style={{
            background: CARD_BG,
            borderRadius: 2,
            border: `1px solid ${BORDER}`,
            boxShadow: SHADOW,
            padding: '48px 28px',
            textAlign: 'center',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 44, color: T3, display: 'block', marginBottom: 12 }}>
            {categories.length === 0 ? 'category' : 'filter_alt_off'}
          </span>
          <div style={{ fontSize: 15, fontWeight: 600, color: T1, marginBottom: 6 }}>
            {categories.length === 0 ? 'No categories in this catalog' : 'No categories for this filter'}
          </div>
          <div style={{ fontSize: 12, color: T3, maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>
            {categories.length === 0
              ? 'Categories will appear here once they are added for this location.'
              : categoriesTabHasActiveFilters
                ? 'Try adjusting visibility or search.'
                : 'No categories match the current view.'}
          </div>
        </div>
      )}
      {!itemsLoading && !categoriesLoading && activeTab === 'categories' && categoriesTabHasVisibleRows && (
        <div style={{ background: CARD_BG, borderRadius: 2, border: `1px solid ${BORDER}`, boxShadow: SHADOW, overflow: 'visible' }}>
          <div style={{ overflow: 'visible' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 12, fontFamily: 'var(--font-primary)' }}>
              <colgroup>
                <col />
                {activeChannels.map((ch) => (
                  <col key={ch.id} style={{ width: CONTROL_CENTRE_CHANNEL_COL_PX }} />
                ))}
              </colgroup>
              <thead>
                <tr style={{ background: PAGE_BG }}>
                  {/* Category row checkboxes (hidden on FE for now) */}
                  {false && (
                    <th style={{ width: 32, textAlign: 'center', padding: '12px 8px', borderBottom: `1px solid ${BORDER}` }}>
                      <input
                        type="checkbox"
                        checked={selectedCategoryRows.size > 0 && selectedCategoryRows.size === categories.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedCategoryRows(new Set(categories.map((c) => c.id)));
                          else clearCategorySelection();
                        }}
                        style={{ accentColor: ACCENT, width: 14, height: 14, cursor: 'pointer' }}
                      />
                    </th>
                  )}
                  <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, position: 'sticky', left: 0, background: PAGE_BG, zIndex: 2, minWidth: 0, fontWeight: 600, fontSize: 11, color: T2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Category
                  </th>
                  {activeChannels.map((ch) => (
                    <th key={ch.id} style={{ padding: '12px 8px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center', width: CONTROL_CENTRE_CHANNEL_COL_PX, minWidth: CONTROL_CENTRE_CHANNEL_COL_PX, maxWidth: CONTROL_CENTRE_CHANNEL_COL_PX, boxSizing: 'border-box', overflow: 'hidden', verticalAlign: 'bottom' }}>
                      <span className="material-symbols-rounded" style={{ fontSize: 18, color: T2, display: 'block', marginBottom: 2 }}>{ch.icon}</span>
                      <span style={CONTROL_CENTRE_CHANNEL_HEADER_LABEL} title={ch.label}>{ch.label}</span>
                    </th>
                  ))}
                  {/* Category availability (OOS) column (hidden on FE for now) */}
                  {false && (
                    <th style={{ padding: '12px 8px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center', minWidth: 90 }}>
                      <span className="material-symbols-rounded" style={{ fontSize: 18, color: ORANGE, display: 'block', marginBottom: 2 }}>block</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.03em' }}>OOS</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {orderedTopLevelCategories.map((parent) => {
                  const subCats = categories
                    .filter((c) => c.parentCategoryId === parent.id)
                    .slice()
                    .sort(compareCategoriesBySortPosition);
                  const subCatItemTotal = subCats.reduce((sum, sub) => sum + (Number(sub.itemCount ?? 0) || 0), 0);
                  const q = searchCategories.trim().toLowerCase();
                  const parentVisBucket = getCategoryVisibilityBucketForCategory(parent, channelRows, outletOrderTypeIdByKey);
                  const parentVisPasses = categoryVisibilityFilter === 'all' || categoryVisibilityFilter === parentVisBucket;
                  const parentRowPassesFilters = parentVisPasses;
                  const subsAfterMeta = subCats.filter((sub) => {
                    const subVisBucket = getSubCategoryVisibilityBucket(parent, sub, channelRows, outletOrderTypeIdByKey);
                    const subVisOk = categoryVisibilityFilter === 'all' || categoryVisibilityFilter === subVisBucket;
                    return subVisOk;
                  });
                  const parentMatchesSearch = !q || categoryMatchesCategoriesTabSearchQuery(parent, q);
                  const filteredSubCats = (q && !parentMatchesSearch)
                    ? subsAfterMeta.filter((s) => categoryMatchesCategoriesTabSearchQuery(s, q))
                    : subsAfterMeta;
                  const hasSubCategories = subCats.length > 0;
                  const searchShowsThisParent = !q || parentMatchesSearch || filteredSubCats.length > 0;
                  if (!parentRowPassesFilters && filteredSubCats.length === 0) return null;
                  if (!searchShowsThisParent) return null;
                  const isExpanded = expandedParentCats.has(parent.id);
                  const parentNameLabel = truncateControlCentreLabel(parent.name);
                  return [
                    <tr
                      key={`parent-${parent.id}`}
                      onClick={() => { if (hasSubCategories) toggleParentCat(parent.id); }}
                      style={{ cursor: hasSubCategories ? 'pointer' : 'default', background: HOVER }}
                    >
                      {false && (
                        <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                          <input
                            type="checkbox"
                            checked={selectedCategoryRows.has(parent.id) || subCats.some((s) => selectedCategoryRows.has(s.id))}
                            onChange={(e) => {
                              e.stopPropagation();
                              const checked = e.target.checked;
                              setSelectedCategoryRows((prev) => {
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
                            style={{ accentColor: ACCENT, width: 14, height: 14, cursor: 'pointer' }}
                          />
                        </td>
                      )}
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: T1, position: 'sticky', left: 0, background: HOVER, zIndex: 1, fontSize: 13 }}>
                        {hasSubCategories && (
                          <span className="material-symbols-rounded" style={{
                            fontSize: 16, verticalAlign: 'middle', marginRight: 8, color: T3,
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s', display: 'inline-block',
                          }}>
                            chevron_right
                          </span>
                        )}
                        <span title={parentNameLabel.title}>{parentNameLabel.display}</span>
                        <span style={{ fontSize: 13, color: T3, fontWeight: 500, marginLeft: 8 }}>
                          {subCats.length > 0 ? (
                            <>
                              {subCats.length} sub-categor{subCats.length === 1 ? 'y' : 'ies'}
                              <span style={{ marginLeft: 4 }}>· {subCatItemTotal} items</span>
                            </>
                          ) : (
                            `${parent.itemCount} items`
                          )}
                        </span>
                      </td>
                      {activeChannels.map((ch) => {
                        const vis = categoryChannelState(parent, ch.key, outletOrderTypeIdByKey, ch.id).enabled;
                        return (
                          <td
                            key={ch.id}
                            style={{
                              textAlign: 'center',
                              padding: '10px 8px',
                              width: CONTROL_CENTRE_CHANNEL_COL_PX,
                              minWidth: CONTROL_CENTRE_CHANNEL_COL_PX,
                              maxWidth: CONTROL_CENTRE_CHANNEL_COL_PX,
                              boxSizing: 'border-box',
                              overflow: 'hidden',
                              verticalAlign: 'middle',
                            }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextEnable = !vis;
                                setCategoryVisibilityConfirm({ categoryId: parent.id, channel: ch.key, orderTypeId: ch.id, enable: nextEnable });
                              }}
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', maxWidth: '100%' }}
                            >
                              <CellIndicator visible={vis} available={true} mode="visibility" />
                            </button>
                          </td>
                        );
                      })}
                      {false && (
                        <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                          <AvailabilityToggle
                            checked={getCategorySharedAvailability(parent, channelRows)}
                            onToggle={() => {
                              const available = getCategorySharedAvailability(parent, channelRows);
                              setCategoryAvailabilityConfirm({ ids: [parent.id], enable: !available });
                            }}
                          />
                        </td>
                      )}
                    </tr>,
                    ...(isExpanded ? filteredSubCats.map((sub) => {
                      const subNameLabel = truncateControlCentreLabel(sub.name);
                      return (
                      <tr key={`sub-${sub.id}`} style={{ borderBottom: `1px solid ${PAGE_BG}` }}>
                        {false && (
                          <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                            <input
                              type="checkbox"
                              checked={selectedCategoryRows.has(sub.id)}
                              onChange={(e) => { e.stopPropagation(); toggleCategoryRowSelect(sub.id); }}
                              onClick={(e) => e.stopPropagation()}
                              style={{ accentColor: ACCENT, width: 14, height: 14, cursor: 'pointer' }}
                            />
                          </td>
                        )}
                        <td style={{ padding: '8px 16px 8px 40px', color: T1, position: 'sticky', left: 0, background: CARD_BG, zIndex: 1, fontSize: 12 }}>
                          <span className="material-symbols-rounded" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 6, color: T3 }}>subdirectory_arrow_right</span>
                          <span style={{ fontWeight: 500 }} title={subNameLabel.title}>{subNameLabel.display}</span>
                          <span style={{ color: T3, marginLeft: 6 }}>· {sub.itemCount} items</span>
                        </td>
                        {activeChannels.map((ch) => {
                          const parentVis = categoryChannelState(parent, ch.key, outletOrderTypeIdByKey, ch.id).enabled;
                          const subVis = categoryChannelState(sub, ch.key, outletOrderTypeIdByKey, ch.id).enabled;
                          const blocked = !parentVis;
                          return (
                            <td
                              key={ch.id}
                              style={{
                                textAlign: 'center',
                                padding: '6px 8px',
                                width: CONTROL_CENTRE_CHANNEL_COL_PX,
                                minWidth: CONTROL_CENTRE_CHANNEL_COL_PX,
                                maxWidth: CONTROL_CENTRE_CHANNEL_COL_PX,
                                boxSizing: 'border-box',
                                overflow: 'hidden',
                                verticalAlign: 'middle',
                              }}
                            >
                              <button
                                type="button"
                                disabled={blocked}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextEnable = !subVis;
                                  setCategoryVisibilityConfirm({ categoryId: sub.id, channel: ch.key, orderTypeId: ch.id, enable: nextEnable });
                                }}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: blocked ? 'not-allowed' : 'pointer', opacity: blocked ? 0.6 : 1, maxWidth: '100%' }}
                                title={blocked ? 'Enable parent visibility first' : 'Toggle visibility'}
                              >
                                <CellIndicator visible={blocked ? false : subVis} available={true} blocked={blocked} mode="visibility" />
                              </button>
                            </td>
                          );
                        })}
                        {false && (
                          <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                            <AvailabilityToggle
                              checked={getCategorySharedAvailability(sub, channelRows)}
                              onToggle={() => {
                                const available = getCategorySharedAvailability(sub, channelRows);
                                setCategoryAvailabilityConfirm({ ids: [sub.id], enable: !available });
                              }}
                            />
                          </td>
                        )}
                      </tr>
                      );
                    }) : []),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Floating Action Bar — PCF-18.10 (items tab only; guard avoids flash before effect clears selection) */}
      {activeTab === 'items' && selectedRows.size > 0 && !itemsLoading && !categoriesLoading && (
        <div style={{
          position: 'fixed', bottom: 0, left: 250, right: 0, zIndex: 50,
          background: CARD_BG, borderTop: `1px solid ${BORDER}`,
          padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T1, fontFamily: 'var(--font-primary)' }}>
              {selectedRows.size} item{selectedRows.size !== 1 ? 's' : ''} selected
            </span>
            <button type="button" onClick={clearSelection} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: T3, textDecoration: 'underline', fontFamily: 'var(--font-primary)' }}>
              Clear
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Edit Visibility (hidden on FE for now) */}
            {false && (
              <button type="button" onClick={() => setBulkModal('visibility')} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 2,
                border: `1px solid ${PURPLE}30`, background: `${PURPLE}06`, color: PURPLE,
                fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)',
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: 14 }}>visibility</span>
                Edit Visibility
              </button>
            )}
            <button type="button" disabled={mutationBusy} onClick={() => { setAvailabilityTargetItemIds(null); setBulkModal('86'); }} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 2,
              border: `1px solid ${ORANGE}30`, background: `${ORANGE}06`, color: ORANGE,
              fontSize: 11, fontWeight: 600, cursor: mutationBusy ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-primary)',
              opacity: mutationBusy ? 0.55 : 1,
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>block</span>
              Mark Out of Stock
            </button>
            <button type="button" disabled={mutationBusy} onClick={() => setBulkModal('restore')} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 2,
              border: `1px solid ${TEAL}30`, background: `${TEAL}06`, color: TEAL,
              fontSize: 11, fontWeight: 600, cursor: mutationBusy ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-primary)',
              opacity: mutationBusy ? 0.55 : 1,
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>refresh</span>
              Restore
            </button>
          </div>
        </div>
      )}

      {/* Category bulk selection bar (hidden on FE for now — no row checkboxes) */}
      {false && activeTab === 'categories' && selectedCategoryRows.size > 0 && !itemsLoading && !categoriesLoading && (
        <div style={{
          position: 'sticky', bottom: 0, left: 0, right: 0, zIndex: 50,
          background: CARD_BG, borderTop: `1px solid ${BORDER}`,
          padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T1, fontFamily: 'var(--font-primary)' }}>
              {selectedCategoryRows.size} categor{selectedCategoryRows.size !== 1 ? 'ies' : 'y'} selected
            </span>
            <button type="button" onClick={clearCategorySelection} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: T3, textDecoration: 'underline', fontFamily: 'var(--font-primary)' }}>
              Clear
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setCategoryAvailabilityConfirm({ ids: Array.from(selectedCategoryRows), enable: false })}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 2, border: `1px solid ${ORANGE}30`, background: `${ORANGE}06`, color: ORANGE, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>block</span>
              Mark OOS
            </button>
            <button
              type="button"
              onClick={() => setCategoryAvailabilityConfirm({ ids: Array.from(selectedCategoryRows), enable: true })}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 2, border: `1px solid ${TEAL}30`, background: `${TEAL}06`, color: TEAL, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>refresh</span>
              Restore
            </button>
          </div>
        </div>
      )}

      {/* Bulk Modal Overlay (items tab only) */}
      {bulkModal && activeTab === 'items' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: '16px' }}>
          <div style={{ background: CARD_BG, borderRadius: 2, padding: 24, maxWidth: 440, width: '100%', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
            {bulkModal === 'visibility' && (
              <>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: T1, margin: '0 0 16px', fontFamily: 'var(--font-primary)' }}>
                  Edit channel visibility for {itemCountLabel(selectedRows.size)}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {channelRows.map((ch) => (
                    <div key={ch.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 2, border: `1px solid ${BORDER}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="material-symbols-rounded" style={{ fontSize: 16, color: T2 }}>{ch.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: T1, fontFamily: 'var(--font-primary)' }}>{ch.label}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {['ON', 'OFF', '—'].map((state) => (
                          <button key={state} type="button" style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                            border: `1px solid ${BORDER}`, background: CARD_BG,
                            color: state === 'ON' ? GREEN : state === 'OFF' ? RED : T3,
                            fontFamily: 'var(--font-primary)',
                          }}>
                            {state === '—' ? 'No change' : state}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setBulkModal(null)} style={{ padding: '8px 16px', borderRadius: 2, border: `1px solid ${BORDER}`, background: CARD_BG, color: T2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>Cancel</button>
                  <button type="button" disabled={mutationBusy} onClick={() => { addToast(`Visibility updated for ${itemCountLabel(selectedRows.size)}`, 'success'); clearSelection(); setBulkModal(null); }} style={{ padding: '8px 16px', borderRadius: 2, border: 'none', background: ACCENT, color: '#fff', fontSize: 12, fontWeight: 600, cursor: mutationBusy ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-primary)', opacity: mutationBusy ? 0.55 : 1 }}>Apply</button>
                </div>
              </>
            )}
            {bulkModal === '86' && (
              <>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: T1, margin: '0 0 16px', fontFamily: 'var(--font-primary)' }}>
                  Mark {itemCountLabel(modalTargetCount)} as out of stock
                </h3>

                {/* Step 1: Scope selector */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T2, marginBottom: 8, fontFamily: 'var(--font-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Scope</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {([
                      { id: 'all' as const, icon: 'public', label: 'All channels', desc: 'Mark out of stock everywhere' },
                      { id: 'specific' as const, icon: 'tune', label: 'Specific channels', desc: 'OOS only on selected channels' },
                    ]).map((opt) => (
                      <button key={opt.id} type="button" onClick={() => { setBulkScope(opt.id); if (opt.id === 'all') setBulkChannels(new Set()); }} style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 2, cursor: 'pointer', textAlign: 'left',
                        border: bulkScope === opt.id ? `1.5px solid ${ORANGE}` : `1px solid ${BORDER}`,
                        background: bulkScope === opt.id ? `${ORANGE}06` : CARD_BG,
                      }}>
                        <span className="material-symbols-rounded" style={{ fontSize: 20, color: bulkScope === opt.id ? ORANGE : T3 }}>{opt.icon}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: bulkScope === opt.id ? ORANGE : T1, fontFamily: 'var(--font-primary)' }}>{opt.label}</div>
                          <div style={{ fontSize: 9, color: T2, fontFamily: 'var(--font-primary)' }}>{opt.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Channel picker (only for specific channels) */}
                {bulkScope === 'specific' && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T2, marginBottom: 8, fontFamily: 'var(--font-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Select channels</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {channelRows.map((ch) => {
                        const selected = bulkChannels.has(ch.id);
                        return (
                          <button key={ch.id} type="button" onClick={() => {
                            setBulkChannels((prev) => {
                              const next = new Set(prev);
                              if (next.has(ch.id)) next.delete(ch.id); else next.add(ch.id);
                              return next;
                            });
                          }} style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 2,
                            border: selected ? `1.5px solid ${ORANGE}` : `1px solid ${BORDER}`,
                            background: selected ? `${ORANGE}08` : CARD_BG,
                            color: selected ? ORANGE : T2,
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)',
                          }}>
                            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>{ch.icon}</span>
                            {ch.label}
                          </button>
                        );
                      })}
                    </div>
                    {bulkScope === 'specific' && bulkChannels.size > 0 && (
                      <p style={{ fontSize: 10, color: TEAL, marginTop: 6, fontFamily: 'var(--font-primary)' }}>
                        Items will remain available on other channels not selected above.
                      </p>
                    )}
                  </div>
                )}

                {/* Duration, then specific end time (same order as mobile) */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T2, marginBottom: 8, fontFamily: 'var(--font-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Duration</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {([
                      { id: 'manual' as const, icon: 'lock', label: 'Until re-enabled', desc: 'Stays out of stock until manually restored' },
                      { id: 'next_session' as const, icon: 'update', label: 'Until next session', desc: 'Auto-restores when next session starts' },
                      { id: 'specific_time' as const, icon: 'schedule', label: 'Until specific time', desc: 'Pick a date and time to auto-restore' },
                      { id: 'end_of_day' as const, icon: 'today', label: 'End of day', desc: "Auto-restores at today's closing time" },
                    ]).map((opt) => (
                      <button key={opt.id} type="button" onClick={() => setBulkDuration(opt.id)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 2, cursor: 'pointer', textAlign: 'left',
                        border: bulkDuration === opt.id ? `1.5px solid ${TEAL}` : `1px solid ${BORDER}`,
                        background: bulkDuration === opt.id ? `${TEAL}06` : CARD_BG,
                      }}>
                        <span className="material-symbols-rounded" style={{ fontSize: 20, color: bulkDuration === opt.id ? TEAL : T3 }}>{opt.icon}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: bulkDuration === opt.id ? TEAL : T1, fontFamily: 'var(--font-primary)' }}>{opt.label}</div>
                          <div style={{ fontSize: 10, color: T2, fontFamily: 'var(--font-primary)' }}>{opt.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {bulkDuration === 'specific_time' && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T2, marginBottom: 8, fontFamily: 'var(--font-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Specific end time</div>
                    <div style={{ maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
                      <CatalogDateTimePicker
                        value={bulkSpecificUntil}
                        onChange={(v) => setBulkSpecificUntil(v)}
                        min={todayIsoLocal()}
                        placeholder="Pick date & time"
                        zIndex={1000}
                      />
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div style={{ padding: '10px 12px', borderRadius: 2, background: `${ORANGE}06`, border: `1px solid ${ORANGE}15`, marginBottom: 16 }}>
                  <p style={{ fontSize: 11, color: T1, margin: 0, fontFamily: 'var(--font-primary)', lineHeight: 1.5 }}>
                    <strong>{itemCountLabel(modalTargetCount)}</strong> will be marked out of stock
                    {bulkScope === 'specific' && bulkChannels.size > 0
                      ? ` on ${Array.from(bulkChannels).map((id) => channelRows.find((c) => c.id === id)?.label).filter(Boolean).join(', ')}${bulkChannels.size === 1 ? ' only' : ''}`
                      : ' on all channels'
                    }
                    {bulkDuration === 'next_session'
                      ? ', restoring at current session end.'
                      : bulkDuration === 'manual'
                        ? ', until manually restored.'
                        : bulkDuration === 'end_of_day'
                          ? ', until end of day.'
                          : ', until specified time.'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => { setBulkModal(null); setBulkScope('all'); setBulkChannels(new Set()); setBulkSpecificUntil(''); setAvailabilityTargetItemIds(null); }} style={{ padding: '8px 16px', borderRadius: 2, border: `1px solid ${BORDER}`, background: CARD_BG, color: T2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>Cancel</button>
                  <button type="button" disabled={mutationBusy || modalTargetCount === 0 || (bulkScope === 'specific' && bulkChannels.size === 0) || (bulkDuration === 'specific_time' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(bulkSpecificUntil))} onClick={() => { void bulkMarkOOS(); setBulkScope('all'); setBulkChannels(new Set()); setBulkSpecificUntil(''); }} style={{
                    padding: '8px 16px', borderRadius: 2, border: 'none', fontSize: 12, fontWeight: 600, cursor: (mutationBusy || modalTargetCount === 0 || (bulkScope === 'specific' && bulkChannels.size === 0) || (bulkDuration === 'specific_time' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(bulkSpecificUntil))) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-primary)',
                    background: (modalTargetCount === 0 || (bulkScope === 'specific' && bulkChannels.size === 0) || (bulkDuration === 'specific_time' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(bulkSpecificUntil))) ? T3 : ORANGE, color: '#fff',
                    opacity: (mutationBusy || modalTargetCount === 0 || (bulkScope === 'specific' && bulkChannels.size === 0) || (bulkDuration === 'specific_time' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(bulkSpecificUntil))) ? 0.5 : 1,
                  }}>Apply</button>
                </div>
              </>
            )}
            {bulkModal === 'restore' && (
              <>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: T1, margin: '0 0 16px', fontFamily: 'var(--font-primary)' }}>
                  Restore {itemCountLabel(selectedRows.size)}
                </h3>
                <p style={{ fontSize: 12, color: T2, margin: '0 0 16px', fontFamily: 'var(--font-primary)', lineHeight: 1.5 }}>
                  This will set {selectedRows.size === 1 ? 'the selected item' : 'all selected items'} back to Active status and clear {selectedRows.size === 1 ? 'its' : 'their'} per-channel out-of-stock {selectedRows.size === 1 ? 'override' : 'overrides'}.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setBulkModal(null)} style={{ padding: '8px 16px', borderRadius: 2, border: `1px solid ${BORDER}`, background: CARD_BG, color: T2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>Cancel</button>
                  <button type="button" disabled={mutationBusy} onClick={() => { void bulkRestore(); }} style={{ padding: '8px 16px', borderRadius: 2, border: 'none', background: TEAL, color: '#fff', fontSize: 12, fontWeight: 600, cursor: mutationBusy ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-primary)', opacity: mutationBusy ? 0.55 : 1 }}>{selectedRows.size === 1 ? 'Restore' : 'Restore all'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {categoryAvailabilityConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: '16px' }}>
          <div style={{ background: CARD_BG, borderRadius: 2, padding: 24, maxWidth: 440, width: '100%', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T1, margin: '0 0 12px', fontFamily: 'var(--font-primary)' }}>
              {categoryAvailabilityConfirm.enable ? 'Turn category availability ON' : 'Turn category availability OFF'}
            </h3>
            <p style={{ fontSize: 12, color: T2, margin: '0 0 16px', fontFamily: 'var(--font-primary)', lineHeight: 1.5 }}>
              {categoryAvailabilityConfirm.ids.length} categor{categoryAvailabilityConfirm.ids.length !== 1 ? 'ies' : 'y'} will be updated across all channels for this outlet.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setCategoryAvailabilityConfirm(null)} style={{ padding: '8px 16px', borderRadius: 2, border: `1px solid ${BORDER}`, background: CARD_BG, color: T2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
                Cancel
              </button>
              <button
                type="button"
                disabled={mutationBusy}
                onClick={() => { void applyCategoryAvailability(categoryAvailabilityConfirm.ids, categoryAvailabilityConfirm.enable); }}
                style={{ padding: '8px 16px', borderRadius: 2, border: 'none', background: categoryAvailabilityConfirm.enable ? TEAL : ORANGE, color: '#fff', fontSize: 12, fontWeight: 600, cursor: mutationBusy ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-primary)', opacity: mutationBusy ? 0.55 : 1 }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {categoryVisibilityConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: '16px' }}>
          <div style={{ background: CARD_BG, borderRadius: 2, padding: 24, maxWidth: 440, width: '100%', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T1, margin: '0 0 12px', fontFamily: 'var(--font-primary)' }}>
              {categoryVisibilityConfirm.enable ? 'Turn visibility ON' : 'Turn visibility OFF'}
            </h3>
            <p style={{ fontSize: 12, color: T2, margin: '0 0 16px', fontFamily: 'var(--font-primary)', lineHeight: 1.5 }}>
              This will update category visibility for the selected channel.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setCategoryVisibilityConfirm(null)} style={{ padding: '8px 16px', borderRadius: 2, border: `1px solid ${BORDER}`, background: CARD_BG, color: T2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
                Cancel
              </button>
              <button
                type="button"
                disabled={mutationBusy}
                onClick={() => {
                  void toggleCategoryChannelVisibility(categoryVisibilityConfirm.categoryId, categoryVisibilityConfirm.channel, categoryVisibilityConfirm.orderTypeId);
                  setCategoryVisibilityConfirm(null);
                }}
                style={{ padding: '8px 16px', borderRadius: 2, border: 'none', background: categoryVisibilityConfirm.enable ? PURPLE : RED, color: '#fff', fontSize: 12, fontWeight: 600, cursor: mutationBusy ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-primary)', opacity: mutationBusy ? 0.55 : 1 }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const tutorial = (
    <>
      <ControlCentreTutorial open={showTutorial} onClose={() => setShowTutorial(false)} />
      <ProductCatalogOverviewTutorial open={showOverviewTutorial} onClose={() => setShowOverviewTutorial(false)} />
    </>
  );

  if (isMobile) {
    return (
      <>
        <ControlCentreMobile
          items={items}
          categories={categories}
          addToast={addToast}
          updateItem={updateItem}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
        <BottomNav />
        {tutorial}
      </>
    );
  }

  return <DesktopLayout>{content}{tutorial}</DesktopLayout>;
}

      // {/* Combos Tab — PCF-18.7: with component health */}
      // {activeTab === 'combos' && (
      //   <div style={{ background: CARD_BG, borderRadius: 2, border: `1px solid ${BORDER}`, boxShadow: SHADOW, overflow: 'hidden' }}>
      //     <div style={{ overflowX: 'auto' }}>
      //       <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-primary)' }}>
      //         <thead>
      //           <tr style={{ background: PAGE_BG }}>
      //             <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, position: 'sticky', left: 0, background: PAGE_BG, zIndex: 2, minWidth: 240, fontWeight: 600, fontSize: 11, color: T2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Combo</th>
      //             <th style={{ padding: '12px 8px', borderBottom: `1px solid ${BORDER}`, fontWeight: 600, fontSize: 11, color: T2, textTransform: 'uppercase' }}>Status</th>
      //             <th style={{ padding: '12px 8px', borderBottom: `1px solid ${BORDER}`, fontWeight: 600, fontSize: 11, color: T2, textTransform: 'uppercase' }}>Health</th>
      //             {channelRows.map((ch) => (
      //               <th key={ch.key} style={{ padding: '12px 8px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center', minWidth: 80 }}>
      //                 <span className="material-symbols-rounded" style={{ fontSize: 18, color: T2, display: 'block', marginBottom: 2 }}>{ch.icon}</span>
      //                 <span style={{ fontSize: 10, fontWeight: 600, color: T3, textTransform: 'uppercase' }}>{ch.label}</span>
      //               </th>
      //             ))}
      //           </tr>
      //         </thead>
      //         <tbody>
      //           {displayCombos.map((combo) => {
      //             // Component health: check each required slot has items
      //             const reqSlots = combo.slots.filter((s) => s.slotType === 'required');
      //             const emptySlots = reqSlots.filter((s) => s.eligibleItems.length === 0);
      //             const healthOk = emptySlots.length === 0;
      //             return (
      //               <tr key={combo.id} style={{ borderBottom: `1px solid ${PAGE_BG}` }}>
      //                 <td style={{ padding: '10px 16px', position: 'sticky', left: 0, background: CARD_BG, zIndex: 1 }}>
      //                   <div style={{ fontWeight: 600, color: T1 }}>{combo.name}</div>
      //                   <div style={{ fontSize: 10, color: T3, marginTop: 2 }}>
      //                     {combo.slots.map((s) => s.slotName || 'Slot').join(' + ')} · ${combo.basePrice.toFixed(2)}
      //                   </div>
      //                 </td>
      //                 <td style={{ textAlign: 'center', padding: '10px 8px' }}>
      //                   <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: combo.status === 'active' ? 'rgba(95,122,85,0.08)' : combo.status === 'draft' ? HOVER : `${ORANGE}08`, color: combo.status === 'active' ? GREEN : combo.status === 'draft' ? T3 : ORANGE, textTransform: 'capitalize' }}>
      //                     {combo.status}
      //                   </span>
      //                 </td>
      //                 <td style={{ textAlign: 'center', padding: '10px 8px' }}>
      //                   {healthOk ? (
      //                     <span className="material-symbols-rounded" style={{ fontSize: 16, color: GREEN }}>check_circle</span>
      //                   ) : (
      //                     <span className="material-symbols-rounded" style={{ fontSize: 16, color: ORANGE }} title={`${emptySlots.length} slot(s) have no items`}>warning</span>
      //                   )}
      //                 </td>
      //                 {channelRows.map((ch) => {
      //                   const vis = (combo.orderTypeVisibility as any)?.[ch.key] !== false;
      //                   const avail = combo.status === 'active';
      //                   const cellKey = `combo-${combo.id}-${ch.key}`;
      //                   const isOpen = diagnosticCell?.cellKey === cellKey;
      //                   return (
      //                     <td key={ch.key} style={{ textAlign: 'center', padding: '6px 8px', position: 'relative' }}>
      //                       <button
      //                         type="button"
      //                         onClick={(e) => {
      //                           e.stopPropagation();
      //                           setDiagnosticCell(isOpen ? null : { cellKey, entityId: combo.id, channel: ch.key });
      //                         }}
      //                         style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 2 }}
      //                         onMouseEnter={(e) => { e.currentTarget.style.background = HOVER; }}
      //                         onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
      //                       >
      //                         <CellIndicator visible={vis} available={avail && vis} mode={viewMode} />
      //                       </button>
      //                       {isOpen && (
      //                         <div style={{
      //                           position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
      //                           zIndex: 100, background: CARD_BG, borderRadius: 2, border: `1px solid ${BORDER}`,
      //                           boxShadow: '0 8px 30px rgba(0,0,0,0.12)', padding: 0, width: 260, marginTop: 4, overflow: 'hidden',
      //                         }} onClick={(e) => e.stopPropagation()}>
      //                           <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      //                             <span style={{ fontSize: 12, fontWeight: 700, color: T1, fontFamily: 'var(--font-primary)' }}>{ch.label} — {combo.name}</span>
      //                             <span className="material-symbols-rounded" style={{ fontSize: 16, cursor: 'pointer', color: T3 }} onClick={() => setDiagnosticCell(null)}>close</span>
      //                           </div>
      //                           <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>
      //                             <div style={{ fontSize: 10, fontWeight: 600, color: PURPLE, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, fontFamily: 'var(--font-primary)' }}>Visibility</div>
      //                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      //                               <span style={{ fontSize: 12, color: T1, fontFamily: 'var(--font-primary)' }}>Visible on {ch.label}</span>
      //                               <button type="button" onClick={() => { addToast(`${ch.label} ${vis ? 'disabled' : 'enabled'} for '${combo.name}'`, 'success'); setDiagnosticCell(null); }} style={{ padding: '3px 10px', borderRadius: 2, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: 'none', background: vis ? `${PURPLE}15` : HOVER, color: vis ? PURPLE : T3, fontFamily: 'var(--font-primary)' }}>
      //                                 {vis ? 'ON' : 'OFF'}
      //                               </button>
      //                             </div>
      //                           </div>
      //                           <div style={{ padding: '10px 14px', opacity: vis ? 1 : 0.4 }}>
      //                             <div style={{ fontSize: 10, fontWeight: 600, color: TEAL, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, fontFamily: 'var(--font-primary)' }}>Availability</div>
      //                             {!vis ? (
      //                               <p style={{ fontSize: 10, color: T3, margin: 0, fontStyle: 'italic', fontFamily: 'var(--font-primary)' }}>Enable visibility first.</p>
      //                             ) : (
      //                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      //                                 <span style={{ fontSize: 12, color: T1, fontFamily: 'var(--font-primary)' }}>{avail ? 'Available' : 'Unavailable'}</span>
      //                                 <button type="button" onClick={() => { addToast(`'${combo.name}' ${avail ? '86\'d' : 'restored'} on ${ch.label}`, 'success'); setDiagnosticCell(null); }} style={{ padding: '3px 10px', borderRadius: 2, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: 'none', background: avail ? `${TEAL}15` : `${ORANGE}15`, color: avail ? TEAL : ORANGE, fontFamily: 'var(--font-primary)' }}>
      //                                   {avail ? '86 this' : 'Restore'}
      //                                 </button>
      //                               </div>
      //                             )}
      //                           </div>
      //                         </div>
      //                       )}
      //                     </td>
      //                   );
      //                 })}
      //               </tr>
      //             );
      //           })}
      //         </tbody>
      //       </table>
      //     </div>
      //   </div>
      // )}

      {/* Set Menus Tab — PCF-18.8: with course health + visibility/availability controls */}
      // {activeTab === 'set_menus' && (
      //   <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      //     {displaySetMenus.map((sm) => {
      //       const emptyCourses = sm.courses.filter((c) => c.eligibleItems.length === 0);
      //       const healthOk = emptyCourses.length === 0;
      //       return (
      //         <div key={sm.id} style={{ borderRadius: 2, border: `1px solid ${BORDER}`, background: CARD_BG, boxShadow: SHADOW, overflow: 'hidden' }}>
      //           <div style={{ padding: '16px 20px' }}>
      //             {/* Header */}
      //             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      //               <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      //                 <span className="material-symbols-rounded" style={{ fontSize: 18, color: ACCENT }}>restaurant</span>
      //                 <div>
      //                   <span style={{ fontSize: 14, fontWeight: 600, color: T1, fontFamily: 'var(--font-primary)' }}>{sm.name}</span>
      //                   <span style={{ fontSize: 10, color: T3, marginLeft: 8 }}>{sm.courseCount} courses · ${sm.price.toFixed(2)}</span>
      //                 </div>
      //               </div>
      //               <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      //                 {!healthOk && <span className="material-symbols-rounded" style={{ fontSize: 16, color: ORANGE }} title={`${emptyCourses.length} course(s) need items`}>warning</span>}
      //                 <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: sm.status === 'active' ? `${GREEN}08` : HOVER, color: sm.status === 'active' ? GREEN : T3, textTransform: 'capitalize' }}>
      //                   {sm.status}
      //                 </span>
      //               </div>
      //             </div>
      //             {sm.description && <p style={{ fontSize: 11, color: T2, margin: '0 0 10px', fontFamily: 'var(--font-primary)' }}>{sm.description}</p>}

      //             {/* Visibility section (purple) */}
      //             <div style={{ marginBottom: 10 }}>
      //               <div style={{ fontSize: 10, fontWeight: 600, color: PURPLE, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, fontFamily: 'var(--font-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
      //                 <span style={{ width: 6, height: 6, borderRadius: '50%', background: PURPLE }} />
      //                 Channel Visibility
      //               </div>
      //               <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      //                 {channelRows.slice(0, 3).map((ch) => {
      //                   const vis = true; // Set menus don't have per-channel visibility in current model — default ON
      //                   return (
      //                     <button key={ch.key} type="button" onClick={() => addToast(`${ch.label} ${vis ? 'disabled' : 'enabled'} for '${sm.name}'`, 'success')} style={{
      //                       fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 2, cursor: 'pointer',
      //                       border: vis ? `1px solid ${GREEN}30` : `1px solid ${BORDER}`,
      //                       background: vis ? `${GREEN}06` : PAGE_BG,
      //                       color: vis ? GREEN : T3, display: 'inline-flex', alignItems: 'center', gap: 4,
      //                     }}>
      //                       <span className="material-symbols-rounded" style={{ fontSize: 13 }}>{ch.icon}</span>
      //                       {ch.label}
      //                     </button>
      //                   );
      //                 })}
      //               </div>
      //             </div>

      //             {/* Availability section (teal) */}
      //             <div style={{ marginBottom: 10 }}>
      //               <div style={{ fontSize: 10, fontWeight: 600, color: TEAL, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, fontFamily: 'var(--font-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
      //                 <span style={{ width: 6, height: 6, borderRadius: '50%', background: TEAL }} />
      //                 Availability
      //               </div>
      //               <div style={{ display: 'flex', gap: 8 }}>
      //                 {sm.status === 'active' ? (
      //                   <button type="button" onClick={() => addToast(`'${sm.name}' marked as unavailable`, 'success')} style={{
      //                     fontSize: 10, fontWeight: 600, padding: '4px 12px', borderRadius: 2, cursor: 'pointer',
      //                     border: `1px solid ${ORANGE}30`, background: `${ORANGE}06`, color: ORANGE,
      //                     display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-primary)',
      //                   }}>
      //                     <span className="material-symbols-rounded" style={{ fontSize: 13 }}>block</span>
      //                     86 Set Menu
      //                   </button>
      //                 ) : (
      //                   <button type="button" onClick={() => addToast(`'${sm.name}' published and available`, 'success')} style={{
      //                     fontSize: 10, fontWeight: 600, padding: '4px 12px', borderRadius: 2, cursor: 'pointer',
      //                     border: `1px solid ${TEAL}30`, background: `${TEAL}06`, color: TEAL,
      //                     display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-primary)',
      //                   }}>
      //                     <span className="material-symbols-rounded" style={{ fontSize: 13 }}>publish</span>
      //                     Publish
      //                   </button>
      //                 )}
      //               </div>
      //             </div>

      //             {/* Course health pills */}
      //             <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      //               {sm.courses.map((c, i) => (
      //                 <span key={c.id} style={{
      //                   fontSize: 9, fontWeight: 500, padding: '3px 8px', borderRadius: 4,
      //                   background: c.eligibleItems.length > 0 ? `${GREEN}06` : `${ORANGE}06`,
      //                   color: c.eligibleItems.length > 0 ? GREEN : ORANGE,
      //                   border: `1px solid ${c.eligibleItems.length > 0 ? GREEN : ORANGE}15`,
      //                   fontFamily: 'var(--font-primary)',
      //                 }}>
      //                   {i + 1}. {c.label} ({c.eligibleItems.length} items)
      //                 </span>
      //               ))}
      //             </div>
      //           </div>
      //         </div>
      //       );
      //     })}
      //   </div>
      // )}
