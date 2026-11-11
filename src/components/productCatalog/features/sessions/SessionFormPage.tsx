import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
/* Drag-and-drop (reorder slots) — disabled for now
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
*/
import { useSessionsStore, useItemsStore, useCategoriesStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import type { SessionSlot } from '../../data/types';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { pcPaths } from '../../paths';
import { pickHighlightIdFromApiResponse } from '../../utils/pickHighlightIdFromApiResponse';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import { useErrorToast } from '../../hooks/useErrorToast';
import type { ModuleListItem } from '../../../../services/categoryCatalogApi';
import { isPersistedSessionSlotId, sessionSlotLookupKey } from '../../../../services/sessionCatalogApi';
import { markProductCatalogSyncNeeded } from '../../store/syncNeeded';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useFormDiscardGuard } from '../../hooks/useFormDiscardGuard';
import { DiscardChangesModal } from '../../components/ui/DiscardChangesModal';
import TextArea from '../../components/forms/TextArea';
import { ItemAssignmentSection } from '../../components/ui/ItemAssignmentSection';
import { CatalogTimePicker } from '../../components/ui/CatalogTimePicker';
import {
  formPageOuterStyle,
  formPageMainScrollStyle,
  formStickyActionBarFooterStyle,
  formCancelButtonStyle,
  formSaveButtonStyle,
} from '../../formLayout';
import {
  formatSlotSummaryLine,
  formatTime12h,
  sortSessionSlotsByWeekdayOrder,
  timeToDecimal,
  DAY_SHORT,
  ALL_DAYS,
  SESSION_GRID_HOURS,
} from './sessionFormatting';

type WeekdayName = (typeof ALL_DAYS)[number];
/** One choice per row: all seven days, or a single weekday (`transformSlots` expands "all" into 7 API rows). */
type SlotDaySelection = 'all' | WeekdayName;

interface LocalSlot {
  id: string;
  daySelection: SlotDaySelection;
  startTime: string;
  endTime: string;
}

function slotDaysExpanded(slot: LocalSlot): string[] {
  if (slot.daySelection === 'all') return [...ALL_DAYS];
  return [slot.daySelection];
}

/** Mon → Sun display order; tie-break by start then end time (same rules as `sortSessionSlotsByWeekdayOrder`). */
function sortLocalSlotsByWeekdayOrder(slots: LocalSlot[]): LocalSlot[] {
  const asSession = (s: LocalSlot) => ({
    id: s.id,
    days: slotDaysExpanded(s),
    startTime: s.startTime,
    endTime: s.endTime,
  });
  const sorted = sortSessionSlotsByWeekdayOrder(slots.map(asSession));
  const byId = new Map(slots.map((s) => [s.id, s] as const));
  return sorted.map((ss) => byId.get(ss.id)!);
}

function sessionSlotToLocalSlot(s: SessionSlot): LocalSlot {
  const days = [...s.days];
  const covered = ALL_DAYS.filter((d) => days.includes(d));
  if (covered.length === 7) {
    return { id: s.id, daySelection: 'all', startTime: s.startTime, endTime: s.endTime };
  }
  if (days.length === 1 && ALL_DAYS.includes(days[0] as WeekdayName)) {
    return { id: s.id, daySelection: days[0] as WeekdayName, startTime: s.startTime, endTime: s.endTime };
  }
  const first = ALL_DAYS.find((d) => days.includes(d)) ?? 'Monday';
  return { id: s.id, daySelection: first, startTime: s.startTime, endTime: s.endTime };
}

/** Map from server load so expanded rows (e.g. Fri → All days) can reuse ids for unchanged day+time. */
function buildInitialSlotIdLookup(slots: SessionSlot[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const s of slots) {
    if (!isPersistedSessionSlotId(s.id)) continue;
    for (const day of s.days) {
      map[sessionSlotLookupKey(day, s.startTime, s.endTime)] = s.id;
    }
  }
  return map;
}

/** Accent for slot day toggles and form preview timeline (session list uses neutral styling). */
const SLOT_UI_ACCENT = '#B89550';

function formatHour(h: number): string {
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}

function generateSlotId(): string {
  return `slot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildTimeOptions(): string[] {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      out.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }
  return out;
}

const TIME_OPTIONS = buildTimeOptions();

/** Default slot content for a brand-new session — mirrored in `initialSlotsSnapshotRef` so create-mode dirty detection catches any time/day edit to this row. */
const DEFAULT_NEW_SLOT_CONTENT = {
  daySelection: 'Monday' as SlotDaySelection,
  startTime: '09:00',
  endTime: '17:00',
};

/* function SlotDragHandle({
  listeners,
  attributes,
}: {
  listeners: DraggableSyntheticListeners;
  attributes: DraggableAttributes;
}) {
  return (
    <div
      {...listeners}
      {...attributes}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 4px',
        marginTop: 4,
        cursor: 'grab',
  color: '#9A9084',
        borderRadius: 4,
        flexShrink: 0,
        touchAction: 'none',
      }}
      title="Drag to reorder slots"
    >
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
        <circle cx="3" cy="2" r="1.2" />
        <circle cx="7" cy="2" r="1.2" />
        <circle cx="3" cy="6" r="1.2" />
        <circle cx="7" cy="6" r="1.2" />
        <circle cx="3" cy="10" r="1.2" />
        <circle cx="7" cy="10" r="1.2" />
        <circle cx="3" cy="14" r="1.2" />
        <circle cx="7" cy="14" r="1.2" />
      </svg>
    </div>
  );
} */

type SortableSessionSlotRowProps = {
  slot: LocalSlot;
  /** Index in `slots` state — matches validation keys `slot-${i}-*`. */
  slotIndex: number;
  /** 1-based label in Mon → Sun display order. */
  slotLabelNumber: number;
  color: string;
  errors: Record<string, string>;
  onRemove: (id: string) => void;
  updateSlot: (id: string, field: keyof LocalSlot, value: unknown) => void;
  setSlotDay: (id: string, selection: SlotDaySelection) => void;
};

function SortableSessionSlotRow({
  slot,
  slotIndex,
  slotLabelNumber,
  color,
  errors,
  onRemove,
  updateSlot,
  setSlotDay,
}: SortableSessionSlotRowProps) {
  /* const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 2 : undefined,
    position: 'relative' as const,
  }; */

  const overnight = timeToDecimal(slot.startTime) > timeToDecimal(slot.endTime);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* <SlotDragHandle listeners={listeners} attributes={attributes} /> */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: '#FFFFFF',
            borderRadius: 2,
            border: '1px solid #ECE5D8',
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9A9084', textTransform: 'uppercase' }}>
              Slot {slotLabelNumber}
            </span>
            <button
              type="button"
              onClick={() => onRemove(slot.id)}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: 4,
                color: '#9A9084',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6E665D' }}>Day</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                type="button"
                onClick={() => setSlotDay(slot.id, 'all')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 2,
                  fontSize: 11,
                  fontWeight: 700,
                  border: slot.daySelection === 'all' ? 'none' : '1px solid #E6DFD3',
                  background: slot.daySelection === 'all' ? color : '#FFFFFF',
                  color: slot.daySelection === 'all' ? '#FFFFFF' : '#6E665D',
                  cursor: 'pointer',
                }}
              >
                All days
              </button>
              {ALL_DAYS.map((day) => {
                const on = slot.daySelection === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSlotDay(slot.id, day)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 2,
                      fontSize: 11,
                      fontWeight: 700,
                      border: on ? 'none' : '1px solid #E6DFD3',
                      background: on ? color : '#FFFFFF',
                      color: on ? '#FFFFFF' : '#6E665D',
                      cursor: 'pointer',
                    }}
                  >
                    {DAY_SHORT[day]}
                  </button>
                );
              })}
            </div>
            {errors[`slot-${slotIndex}-days`] && (
              <p style={{ fontSize: 10, color: '#A63D2F', margin: '6px 0 0' }}>{errors[`slot-${slotIndex}-days`]}</p>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 10,
              flexWrap: 'nowrap',
              width: '100%',
            }}
          >
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <CatalogTimePicker
                label="Start"
                value={slot.startTime}
                onChange={(v) => updateSlot(slot.id, 'startTime', v)}
              />
            </div>
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#D6CCBB',
                paddingBottom: 12,
                flexShrink: 0,
              }}
            >
              →
            </span>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <CatalogTimePicker
                label="End"
                value={slot.endTime}
                onChange={(v) => updateSlot(slot.id, 'endTime', v)}
              />
            </div>
          </div>
          {errors[`slot-${slotIndex}-time`] && (
            <p style={{ fontSize: 10, color: '#A63D2F', margin: '8px 0 0' }}>{errors[`slot-${slotIndex}-time`]}</p>
          )}
          {overnight && !errors[`slot-${slotIndex}-time`] && (
            <p style={{ fontSize: 10, color: '#A63D2F', margin: '8px 0 0' }}>
              End time is before start time. Please select a valid end time.
            </p>
          )}
          <p style={{ fontSize: 11, color: '#6E665D', marginTop: 10, fontWeight: 600 }}>
            {formatSlotSummaryLine(slotDaysExpanded(slot), slot.startTime, slot.endTime)}
          </p>
        </div>
      </div>
    </div>
  );
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function rangesForSlot(start: string, end: string): Array<{ start: number; end: number }> {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  if (endMin > startMin) return [{ start: startMin, end: endMin }];
  // Overnight slot: split at midnight so overlap checks still work.
  return [
    { start: startMin, end: 24 * 60 },
    { start: 0, end: endMin },
  ];
}

function rangesOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

function getIntraSlotOverlapErrors(slots: LocalSlot[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const daysI = slotDaysExpanded(slots[i]);
      const daysJ = slotDaysExpanded(slots[j]);
      const commonDays = daysI.filter((d) => daysJ.includes(d));
      if (commonDays.length === 0) continue;
      const aRanges = rangesForSlot(slots[i].startTime, slots[i].endTime);
      const bRanges = rangesForSlot(slots[j].startTime, slots[j].endTime);
      const overlap = aRanges.some((a) => bRanges.some((b) => rangesOverlap(a, b)));
      if (overlap) {
        out[`slot-${j}-time`] = 'Time slot overlaps with another slot.';
      }
    }
  }
  return out;
}

function sectionCardStyle(): React.CSSProperties {
  return {
  background: '#FFFFFF',
    borderRadius: 2,
  border: '1px solid #E6DFD3',
    padding: '20px 22px',
    marginBottom: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
  };
}


export default function SessionFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const {
    sessions,
    updateSession,
    clearSessionsCache,
    editingSessionId,
    setEditingSessionId,
    createSessionOnServer,
    updateSessionOnServer,
    error,
  } = useSessionsStore();
  const { fetchModuleListOnServer, categories, fetchCategories } = useCategoriesStore();
  const { items, fetchItems } = useItemsStore();
  const { addToast } = useToastStore();
  const { auth } = useAuth();
  const { selectedBranch } = useBranch();
  const token = auth?.accessToken ?? auth?.access_token ?? null;
  const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
  useErrorToast(error, { fallbackMessage: 'Failed to load sessions' });

  const isEditRoute = location.pathname === pcPaths.sessionEdit;
  const id = isEditRoute ? editingSessionId : null;

  const isEdit = Boolean(id);
  const existing = isEdit ? sessions.find((s) => s.id === id) : null;
  const isDefaultSession = Boolean(existing?.isDefault);

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({ title: isEdit ? 'Edit Session' : 'New Session', breadcrumbs: 'Product Catalog > Sessions' });
  }, [setTopBarProps, isEdit]);

  const goToSessionsList = useCallback(
    (highlightSessionId?: string | null) => {
      setEditingSessionId(null);
      const hid = highlightSessionId?.trim();
      if (hid) {
        navigate(`${pcPaths.sessions}?highlight=${encodeURIComponent(hid)}`);
      } else {
        navigate(pcPaths.sessions);
      }
    },
    [navigate, setEditingSessionId],
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [slots, setSlots] = useState<LocalSlot[]>(() => [
    { id: generateSlotId(), ...DEFAULT_NEW_SLOT_CONTENT },
  ]);
  const [assignedItemIds, setAssignedItemIds] = useState<string[]>([]);
  const [sessionPrices, setSessionPrices] = useState<Record<string, string>>({});
  const initialSessionPricesRef = useRef<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const saveIdleLabel = isEdit ? 'Update' : 'Create';
  const saveLoadingLabel = isEdit ? 'Updating' : 'Creating';
  const [isLinkedItemsLoading, setIsLinkedItemsLoading] = useState(Boolean(isEdit));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hydratedAssigned = useRef(false);
  const initialAssignedItemIdsRef = useRef<string[]>([]);
  /** Server slot UUIDs when the form loaded — used to compute `deletedSlots` on update. */
  const initialPersistedSlotIdsRef = useRef<string[]>([]);
  /** Full slot content snapshot when the form loaded — used to detect dirty time/day edits. Seeded with the create-mode default so edits to that row are caught before hydration overwrites it. */
  const initialSlotsSnapshotRef = useRef<Array<{ daySelection: string; startTime: string; endTime: string }>>([
    { ...DEFAULT_NEW_SLOT_CONTENT },
  ]);
  /** Guards against re-hydrating slots from Redux if `existing` gets a new reference after user edits. */
  const slotsHydratedRef = useRef(false);
  /** Initial `sessionSlotLookupKey(day, start, end)` → server slot id (reuse when expanding to All days). */
  const initialSlotIdLookupRef = useRef<Record<string, string>>({});

  const [moduleItems, setModuleItems] = useState<Array<{ id: string; name: string; defaultPrice?: number; categoryIds?: string[] }>>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const itemsFetchedRef = useRef('');

  const fetchModuleItems = useCallback(async () => {
    if (!locationId || itemsFetchedRef.current === locationId) return;
    itemsFetchedRef.current = locationId;
    setItemsLoading(true);
    try {
      const raw = await fetchModuleListOnServer('ITEM', { location_id: locationId }, token);
      const mapped = raw
        .map((item: ModuleListItem) => {
          const dineIn = item.dineInPrice != null ? Number(item.dineInPrice) : NaN;
          const sell = item.sell_price != null ? Number(item.sell_price) : NaN;
          const defaultPrice = !Number.isNaN(dineIn) && dineIn >= 0
            ? dineIn
            : !Number.isNaN(sell) && sell >= 0
              ? sell
              : undefined;
          return {
            id: String(item.id || item.itemId || ''),
            name: String(item.name || item.itemName || ''),
            defaultPrice,
          };
        })
        .filter((i) => i.id);
      mapped.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
      setModuleItems(mapped);
    } catch {
      // silent — picker empty
    } finally {
      setItemsLoading(false);
    }
  }, [locationId, token, fetchModuleListOnServer]);

  useEffect(() => {
    if (!locationId) return;
    void fetchModuleItems();
    // Items + categories from the store power the grouped picker (categoryIds + group names)
    void fetchItems(locationId, token, { skipDuplicateMs: 750 });
    void fetchCategories(locationId, token, { skipDuplicateMs: 750 });
  }, [locationId, fetchModuleItems, fetchItems, fetchCategories, token]);

  useEffect(() => {
    hydratedAssigned.current = false;
    slotsHydratedRef.current = false;
    initialAssignedItemIdsRef.current = [];
    initialPersistedSlotIdsRef.current = [];
    initialSlotIdLookupRef.current = {};
    initialSlotsSnapshotRef.current = [{ ...DEFAULT_NEW_SLOT_CONTENT }];
    initialSessionPricesRef.current = {};
    if (!id) {
      setAssignedItemIds([]);
      setSessionPrices({});
    }
  }, [id]);

  useEffect(() => {
    if (existing && !slotsHydratedRef.current) {
      slotsHydratedRef.current = true;
      setName(existing.name);
      setDescription((existing.description ?? '').slice(0, 100));
      const localSlots = sortLocalSlotsByWeekdayOrder(existing.slots.map(sessionSlotToLocalSlot));
      setSlots(localSlots);
      initialSlotsSnapshotRef.current = localSlots.map(({ daySelection, startTime, endTime }) => ({ daySelection, startTime, endTime }));
      initialPersistedSlotIdsRef.current = existing.slots.map((s) => s.id).filter(isPersistedSessionSlotId);
      initialSlotIdLookupRef.current = buildInitialSlotIdLookup(existing.slots);
    }
  }, [existing]);

  useEffect(() => {
    if (!isEdit || !id || hydratedAssigned.current) return;
    const fromCatalog = items.filter((i) => i.sessionIds?.includes(id)).map((i) => i.id);
    const next =
      existing?.assignedItemIds !== undefined ? [...existing.assignedItemIds] : [...fromCatalog];
    setAssignedItemIds(next);
    initialAssignedItemIdsRef.current = [...next];
    const priceMap: Record<string, string> = {};
    if (existing?.assignedSessionItems) {
      for (const si of existing.assignedSessionItems) {
        if (si.id && si.sessionPrice != null) priceMap[si.id] = String(si.sessionPrice);
      }
    }
    setSessionPrices(priceMap);
    initialSessionPricesRef.current = { ...priceMap };
    hydratedAssigned.current = true;
    setIsLinkedItemsLoading(false);
  }, [isEdit, id, items, existing]);

  const isDirty = useMemo(() => {
    const slotsChanged =
      slots.length !== initialSlotsSnapshotRef.current.length ||
      slots.some((s, i) => {
        const snap = initialSlotsSnapshotRef.current[i];
        return !snap || s.daySelection !== snap.daySelection || s.startTime !== snap.startTime || s.endTime !== snap.endTime;
      });
    if (!isEdit) {
      return !!(name.trim() || description.trim() || slotsChanged || assignedItemIds.length);
    }
    if (!existing) return false;
    const pricesChanged =
      JSON.stringify(sessionPrices) !== JSON.stringify(initialSessionPricesRef.current);
    return (
      name !== (existing.name ?? '') ||
      description !== (existing.description ?? '') ||
      JSON.stringify([...assignedItemIds].sort()) !==
        JSON.stringify([...initialAssignedItemIdsRef.current].sort()) ||
      slotsChanged ||
      pricesChanged
    );
  }, [isEdit, existing, name, description, slots, assignedItemIds]);

  const { showDiscardModal, handleCancel, handleConfirmDiscard, handleKeepEditing } =
    useFormDiscardGuard(isDirty, pcPaths.sessions);

  const removeItem = useCallback((itemId: string) => {
    setAssignedItemIds((prev) => prev.filter((x) => x !== itemId));
    setSessionPrices((prev) => {
      if (!(itemId in prev)) return prev;
      const { [itemId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const toggleItem = useCallback((itemId: string) => {
    setAssignedItemIds((prev) => {
      const isAdding = !prev.includes(itemId);
      if (isAdding) {
        setSessionPrices((prices) => {
          if (prices[itemId] !== undefined) return prices;
          const moduleItem = moduleItems.find((i) => i.id === itemId);
          if (moduleItem?.defaultPrice != null && moduleItem.defaultPrice >= 0) {
            return { ...prices, [itemId]: moduleItem.defaultPrice.toFixed(2) };
          }
          return prices;
        });
      }
      return isAdding ? [...prev, itemId] : prev.filter((x) => x !== itemId);
    });
  }, [moduleItems]);

  const assignedItemsForPills = useMemo(() => {
    return assignedItemIds
      .map((itemId) => {
        const m = moduleItems.find((i) => i.id === itemId);
        if (m) return m;
        const st = items.find((i) => i.id === itemId);
        if (st) return { id: st.id, name: st.name };
        const sn = existing?.assignedSessionItems?.find((x) => x.id === itemId);
        if (sn) return { id: sn.id, name: sn.name };
        return { id: itemId, name: 'Item' };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
  }, [assignedItemIds, moduleItems, items, existing?.assignedSessionItems]);

  /* Picker items enriched with categoryIds from the items store (module API has none) */
  const pickerItems = useMemo(() => {
    const itemsById = new Map(items.map((i) => [i.id, i]));
    return moduleItems.map((mi) => ({
      id: mi.id,
      name: mi.name,
      categoryIds: itemsById.get(mi.id)?.categoryIds ?? [],
      categorySortPositions: itemsById.get(mi.id)?.categorySortPositions,
      trailing: mi.defaultPrice != null ? `$${mi.defaultPrice.toFixed(2)}` : undefined,
    }));
  }, [moduleItems, items]);

  const weeklyHours = useMemo(() => {
    let totalMinutes = 0;
    for (const slot of slots) {
      const [sh, sm] = slot.startTime.split(':').map(Number);
      const [eh, em] = slot.endTime.split(':').map(Number);
      let startMin = (sh ?? 0) * 60 + (sm ?? 0);
      let endMin = (eh ?? 0) * 60 + (em ?? 0);
      if (endMin <= startMin) endMin += 24 * 60;
      totalMinutes += (endMin - startMin) * slotDaysExpanded(slot).length;
    }
    return Math.round((totalMinutes / 60) * 10) / 10;
  }, [slots]);

  const activeDaysCount = useMemo(() => {
    const d = new Set<string>();
    slots.forEach((s) => slotDaysExpanded(s).forEach((x) => d.add(x)));
    return d.size;
  }, [slots]);

  const slotsDisplayOrder = useMemo(() => sortLocalSlotsByWeekdayOrder(slots), [slots]);

  const addSlot = () => {
    if (slots.length >= 10 || isDefaultSession) return;
    setSlots((prev) => [...prev, { id: generateSlotId(), daySelection: 'Monday', startTime: '09:00', endTime: '17:00' }]);
  };

  const removeSlot = (slotId: string) => {
    if (isDefaultSession) return;
    setSlots((prev) => prev.filter((s) => s.id !== slotId));
  };

  const updateSlot = (slotId: string, field: keyof LocalSlot, value: unknown) => {
    setSlots((prev) => prev.map((s) => {
      if (s.id !== slotId) return s;
      const updated = { ...s, [field]: value };
      return updated;
    }));
    setErrors((prev) => {
      const slot = slots.find((s) => s.id === slotId);
      if (!slot) return prev;
      const updated = { ...slot, [field]: value };
      const slotIndex = slots.findIndex((s) => s.id === slotId);
      const key = `slot-${slotIndex}-time`;
      if ((field === 'startTime' || field === 'endTime') && typeof updated.startTime === 'string' && typeof updated.endTime === 'string') {
        if (timeToMinutes(updated.startTime) >= timeToMinutes(updated.endTime)) {
          return { ...prev, [key]: 'End time must be greater than start time.' };
        }
        const { [key]: _removed, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  };

  const setSlotDay = (slotId: string, selection: SlotDaySelection) => {
    if (isDefaultSession) return;
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, daySelection: selection } : s)));
  };

  /* const slotIds = useMemo(() => slots.map((s) => s.id), [slots]);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );
  const handleSlotsDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSlots((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []); */

  const crossSessionWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (isDefaultSession) return warnings;
    slots.forEach((slot) => {
      const slotDays = slotDaysExpanded(slot);
      sessions.forEach((other) => {
        if (other.id === id) return;
        other.slots.forEach((otherSlot) => {
          const commonDays = slotDays.filter((d) => otherSlot.days.includes(d));
          if (commonDays.length === 0) return;
          const s1Start = timeToDecimal(slot.startTime);
          const s1End = timeToDecimal(slot.endTime);
          const s2Start = timeToDecimal(otherSlot.startTime);
          const s2End = timeToDecimal(otherSlot.endTime);
          const overlapStart = Math.max(s1Start, s2Start);
          const overlapEnd = Math.min(s1End, s2End);
          if (overlapStart < overlapEnd) {
            warnings.push(
              `Overlaps with "${other.name}" on ${commonDays.map((d) => DAY_SHORT[d] || d).join(', ')}`,
            );
          }
        });
      });
    });
    return Array.from(new Set(warnings));
  }, [slots, sessions, id, isDefaultSession]);

  const liveOverlapErrors = useMemo(() => getIntraSlotOverlapErrors(slots), [slots]);
  const displayErrors = useMemo(() => ({ ...errors, ...liveOverlapErrors }), [errors, liveOverlapErrors]);

  const isFormValid = useMemo(() => {
    if (isDefaultSession) return true;
    if (!name.trim()) return false;
    if (slots.length === 0) return false;
    if (slots.some((s) => timeToMinutes(s.startTime) >= timeToMinutes(s.endTime))) return false;
    if (Object.keys(liveOverlapErrors).length > 0) return false;
    return true;
  }, [isDefaultSession, name, slots, liveOverlapErrors]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!isDefaultSession) {
      if (!name.trim()) newErrors.name = 'Session name is required.';
      if (name.length > 30) newErrors.name = 'Session name must be 30 characters or less.';
      const dup = sessions.find(
        (s) => s.name.toLowerCase() === name.trim().toLowerCase() && s.id !== id,
      );
      if (dup) newErrors.name = `A session named "${name.trim()}" already exists.`;
      if (description.length > 100) newErrors.description = 'Description must be 100 characters or less.';
      if (slots.length === 0) newErrors.slots = 'Add at least one time slot before saving.';
      slots.forEach((slot, i) => {
        if (timeToMinutes(slot.startTime) >= timeToMinutes(slot.endTime)) newErrors[`slot-${i}-time`] = 'End time must be after start time.';
      });
      Object.assign(newErrors, getIntraSlotOverlapErrors(slots));
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (isSaving) return;
    setIsSaving(true);

    const sessionSlots: SessionSlot[] = sortLocalSlotsByWeekdayOrder(slots).map((s) => ({
      id: s.id,
      days: slotDaysExpanded(s),
      startTime: s.startTime,
      endTime: s.endTime,
    }));
    const currentPersistedSlotIds = new Set(slots.map((s) => s.id).filter(isPersistedSessionSlotId));
    const deletedSlots = initialPersistedSlotIdsRef.current.filter((sid) => !currentPersistedSlotIds.has(sid));
    const count = assignedItemIds.length;
    const buildItems = (ids: string[]) =>
      ids.map((itemId) => {
        const raw = sessionPrices[itemId];
        const parsed = raw ? parseFloat(raw) : NaN;
        return { id: itemId, sessionPrice: !Number.isNaN(parsed) && parsed >= 0 ? parsed : null };
      });
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;

    try {
      if (isDefaultSession && id) {
        let updateResp: unknown;
        if (locationId) {
          const initial = initialAssignedItemIdsRef.current;
          const toRemove = initial.filter((itemId) => !assignedItemIds.includes(itemId));
          updateResp = await updateSessionOnServer(
            {
              locationId,
              sessionId: id,
              name: existing?.name ?? name.trim(),
              description: description.trim() || null,
              sessionSlot: sessionSlots,
              slotIdLookup: { ...initialSlotIdLookupRef.current },
              ...(assignedItemIds.length > 0 ? { items: buildItems(assignedItemIds) } : {}),
              ...(toRemove.length > 0 ? { deleteFields: { items: toRemove } } : {}),
              ...(deletedSlots.length > 0 ? { deletedSlots } : {}),
            },
            token,
          );
        } else {
          updateSession(id, {
            description: description.trim(),
            assignedItemCount: count,
            assignedItemIds: [...assignedItemIds],
          });
        }
        clearSessionsCache();
        markProductCatalogSyncNeeded();
        addToast('Session updated', 'success');
        goToSessionsList(
          locationId ? pickHighlightIdFromApiResponse(updateResp) || id : id,
        );
        return;
      }

      let highlightAfterSave: string | null = null;

      if (isEdit && id) {
        if (locationId) {
          const initial = initialAssignedItemIdsRef.current;
          const toRemove = initial.filter((itemId) => !assignedItemIds.includes(itemId));
          const updateResp = await updateSessionOnServer(
            {
              locationId,
              sessionId: id,
              name: name.trim(),
              description: description.trim() || null,
              sessionSlot: sessionSlots,
              slotIdLookup: { ...initialSlotIdLookupRef.current },
              ...(assignedItemIds.length > 0 ? { items: buildItems(assignedItemIds) } : {}),
              ...(toRemove.length > 0 ? { deleteFields: { items: toRemove } } : {}),
              ...(deletedSlots.length > 0 ? { deletedSlots } : {}),
            },
            token,
          );
          highlightAfterSave = pickHighlightIdFromApiResponse(updateResp) || id;
        } else {
          highlightAfterSave = id;
        }
        addToast('Session updated', 'success');
      } else {
        if (locationId) {
          const createResp = await createSessionOnServer(
            {
              locationId,
              name: name.trim(),
              description: description.trim() || undefined,
              sessionSlot: sessionSlots,
              ...(assignedItemIds.length > 0 ? { items: buildItems(assignedItemIds) } : {}),
            },
            token,
          );
          highlightAfterSave = pickHighlightIdFromApiResponse(createResp) || null;
        }
        addToast('Session created', 'success');
      }
      clearSessionsCache();
      markProductCatalogSyncNeeded();
      goToSessionsList(highlightAfterSave);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save session.';
      addToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const itemAssignCardStyle: React.CSSProperties = {
    ...sectionCardStyle(),
    marginBottom: 8,
    ...(isMobile ? { maxWidth: '100%' } : {}),
  };

  const sessionPriceRows = assignedItemsForPills.length > 0 && (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--divider, #F4F0E8)', paddingTop: 14 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3, #9A9084)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' }}>
        Session Prices
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {assignedItemsForPills.map((item) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--t1, #453F39)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.name}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E6DFD3', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
              <span style={{ padding: '6px 7px 6px 8px', fontSize: 12, fontWeight: 600, color: '#9A9084', background: '#FFFFFF', borderRight: '1px solid #E6DFD3', userSelect: 'none', lineHeight: 1 }}>
                $
              </span>
              <input
                type="number"
                min="0"
                max="9999.99"
                step="0.01"
                value={sessionPrices[item.id] ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw !== '' && !/^\d{0,4}(\.\d{0,2})?$/.test(raw)) return;
                  setSessionPrices((prev) => ({ ...prev, [item.id]: raw }));
                }}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v) && v >= 0) {
                    setSessionPrices((prev) => ({ ...prev, [item.id]: v.toFixed(2) }));
                  }
                }}
                placeholder="-"
                style={{
                  width: 72,
                  boxSizing: 'border-box',
                  border: 'none',
                  outline: 'none',
                  padding: '6px 8px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#453F39',
                  textAlign: 'center',
                  fontFamily: 'var(--font-primary)',
                  background: '#FFFFFF',
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 10, color: 'var(--t3, #9A9084)', margin: '8px 0 0' }}>
        Leave blank to use the item's base price during this session.
      </p>
    </div>
  );

  const sessionItemAssignmentSection = (
    <div style={itemAssignCardStyle}>
      <ItemAssignmentSection
        items={pickerItems}
        categories={categories}
        selectedIds={assignedItemIds}
        selectedItems={assignedItemsForPills}
        onToggle={toggleItem}
        onRemove={removeItem}
        loading={isLinkedItemsLoading}
        itemsLoading={itemsLoading}
        persistedSelectedIds={initialAssignedItemIdsRef.current}
      />
      {sessionPriceRows}
    </div>
  );

  if (isEditRoute && !editingSessionId) {
    return <Navigate to={pcPaths.sessions} replace />;
  }

  const discardModal = <DiscardChangesModal open={showDiscardModal} onKeepEditing={handleKeepEditing} onConfirm={handleConfirmDiscard} />;

  if (isMobile) return (
    <>
      {discardModal}
      <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif", display: 'flex', flexDirection: 'column' }}>
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span onClick={handleCancel} className="material-symbols-rounded" style={{ fontSize: 22, color: '#453F39', cursor: 'pointer' }}>arrow_back</span>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: 0 }}>
          {isDefaultSession ? 'Edit Default Session' : isEdit ? 'Edit Session' : 'New Session'}
        </h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: 80 }}>
        {/* Session Identity */}
        <div style={{ ...sectionCardStyle(), maxWidth: '100%' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#453F39', margin: '0 0 4px' }}>Session identity</h2>
          <p style={{ fontSize: 12, color: '#9A9084', margin: '0 0 20px' }}>Basic information for this session</p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#453F39', display: 'block', marginBottom: 8 }}>
              Session name <span style={{ color: 'var(--accent, #B89550)' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isDefaultSession}
              maxLength={30}
              placeholder="e.g. Breakfast, Happy Hour"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '12px 14px',
                borderRadius: 2, border: `1px solid ${errors.name ? '#A63D2F' : '#E6DFD3'}`,
                fontSize: 13, background: isDefaultSession ? '#FFFFFF' : '#FFFFFF', color: '#453F39',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {errors.name ? <span style={{ fontSize: 11, color: '#A63D2F' }}>{errors.name}</span> : <span />}
              <span style={{ fontSize: 10, color: '#9A9084' }}>{name.length}/30</span>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <TextArea
              label="Description (optional)"
              value={description}
              onChange={setDescription}
              rows={2}
              placeholder="When this session runs and what it covers"
              maxLength={100}
              counterWarnAfter={90}
              error={errors.description}
            />
          </div>
        </div>

        {/* Time slots */}
        <div style={{ ...sectionCardStyle(), maxWidth: '100%' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#453F39', margin: '0 0 4px' }}>Time slots</h2>
          <p style={{ fontSize: 12, color: '#9A9084', margin: '0 0 16px' }}>
            When this session is active. Pick one day or All days per row.
          </p>

          {isDefaultSession ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortSessionSlotsByWeekdayOrder(existing?.slots ?? []).map((slot) => (
                <div key={slot.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#FFFFFF', borderRadius: 2 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#9A9084' }}>schedule</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#453F39', lineHeight: 1.4 }}>
                    {formatSlotSummaryLine(slot.days, slot.startTime, slot.endTime)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSlotsDragEnd}>
                <SortableContext items={slotIds} strategy={verticalListSortingStrategy}> */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {slots.map((slot, index) => (
                  <SortableSessionSlotRow
                    key={slot.id}
                    slot={slot}
                    slotIndex={index}
                    slotLabelNumber={index + 1}
                    color={SLOT_UI_ACCENT}
                    errors={displayErrors}
                    onRemove={removeSlot}
                    updateSlot={updateSlot}
                    setSlotDay={setSlotDay}
                  />
                ))}
              </div>
              {/* </SortableContext>
              </DndContext> */}
              {slots.length < 10 && (
                <button
                  type="button"
                  onClick={addSlot}
                  style={{
                    marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
                    border: 'none', background: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, color: '#B89550', fontFamily: 'var(--font-primary)',
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add</span>
                  Add time slot
                </button>
              )}
              {displayErrors.slots && <p style={{ fontSize: 11, color: '#A63D2F', marginTop: 10 }}>{displayErrors.slots}</p>}
            </>
          )}
        </div>

        {sessionItemAssignmentSection}
      </div>

      {/* Fixed bottom action bar */}
      <div style={{ ...formStickyActionBarFooterStyle, position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, padding: 16 }}>
        <button type="button" style={formCancelButtonStyle} onClick={handleCancel}>
          Cancel
        </button>
        <button type="button" style={{ ...formSaveButtonStyle, minWidth: 132, opacity: !isFormValid || isSaving ? 0.5 : 1, cursor: !isFormValid || isSaving ? 'not-allowed' : 'pointer' }} onClick={handleSave} disabled={!isFormValid || isSaving}>
          {isSaving ? saveLoadingLabel : saveIdleLabel}
        </button>
      </div>
    </div>
  </>
  );

  return (
    <>
      {discardModal}
      <DesktopLayout>
      <div style={formPageOuterStyle}>
        <div style={{ ...formPageMainScrollStyle, background: '#FFFFFF' }}>
          <div style={{ padding: 25, paddingBottom: 24 }}>
            {/* Session Identity */}
            <div style={sectionCardStyle()}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#453F39', margin: '0 0 4px' }}>Session identity</h2>
              <p style={{ fontSize: 12, color: '#9A9084', margin: '0 0 20px' }}>Basic information for this session</p>

          <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#453F39', display: 'block', marginBottom: 8 }}>
                  Session name <span style={{ color: 'var(--accent, #B89550)' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isDefaultSession}
                  maxLength={30}
                  placeholder="e.g. Breakfast, Happy Hour"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px 14px',
                    borderRadius: 2,
                    border: `1px solid ${errors.name ? '#A63D2F' : '#E6DFD3'}`,
                    fontSize: 13,
                    background: isDefaultSession ? '#FFFFFF' : '#FFFFFF',
                    color: '#453F39',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  {errors.name ? (
                    <span style={{ fontSize: 11, color: '#A63D2F' }}>{errors.name}</span>
                  ) : (
                    <span />
                  )}
                  <span style={{ fontSize: 10, color: '#9A9084' }}>{name.length}/30</span>
                </div>
                {isDefaultSession && (
                  <p style={{ fontSize: 11, color: '#9A9084', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 14 }}>info</span>
                    System default — name cannot be changed
                  </p>
                )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <TextArea
              label="Description (optional)"
              value={description}
              onChange={setDescription}
              rows={2}
              placeholder="When this session runs and what it covers"
              maxLength={100}
              counterWarnAfter={90}
              error={errors.description}
            />
          </div>
            </div>

            {/* Time slots */}
            <div style={sectionCardStyle()}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#453F39', margin: '0 0 4px' }}>Time slots</h2>
              <p style={{ fontSize: 12, color: '#9A9084', margin: '0 0 16px' }}>
                When this session is active. Each row is one day or all days (saved as separate schedule rows).
              </p>

              {isDefaultSession ? (
                <div style={{ marginBottom: 12, padding: 12, background: '#EDF3EB', border: '1px solid #CFDCC6', borderRadius: 2 }}>
                  <p style={{ fontSize: 11, color: '#6F8260', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 16 }}>info</span>
                    Default session schedule is fixed — only item assignments can be changed.
                  </p>
                </div>
              ) : null}

              {isDefaultSession ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sortSessionSlotsByWeekdayOrder(existing?.slots ?? []).map((slot) => (
                    <div
                      key={slot.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 14px',
                        background: '#FFFFFF',
                        borderRadius: 2,
                      }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#9A9084' }}>schedule</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#453F39', lineHeight: 1.4 }}>
                        {formatSlotSummaryLine(slot.days, slot.startTime, slot.endTime)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* <p style={{ fontSize: 11, color: '#9A9084', margin: '0 0 14px' }}>
                    Drag the handle to reorder slots. Saved order is used for display and scheduling.
                  </p> */}
                  {/* <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSlotsDragEnd}>
                    <SortableContext items={slotIds} strategy={verticalListSortingStrategy}> */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {slots.map((slot, index) => (
                      <SortableSessionSlotRow
                        key={slot.id}
                        slot={slot}
                        slotIndex={index}
                        slotLabelNumber={index + 1}
                        color={SLOT_UI_ACCENT}
                        errors={displayErrors}
                        onRemove={removeSlot}
                        updateSlot={updateSlot}
                        setSlotDay={setSlotDay}
                      />
                    ))}
                  </div>
                  {/* </SortableContext>
                  </DndContext> */}

                  {slots.length < 10 ? (
                    <button
                      type="button"
                      onClick={addSlot}
                      style={{
                        marginTop: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#B89550',
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add</span>
                      Add time slot
                    </button>
                  ) : (
                    <p style={{ fontSize: 11, color: '#9A9084', marginTop: 12 }}>Maximum 10 time slots per session.</p>
                  )}

                  {displayErrors.slots && (
                    <p style={{ fontSize: 11, color: '#A63D2F', marginTop: 10 }}>{displayErrors.slots}</p>
                  )}

                  {crossSessionWarnings.length > 0 && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        background: '#F7EFDF',
                        border: '1px solid #E9D8B5',
                        borderRadius: 2,
                      }}
                    >
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#8A6D33', margin: '0 0 6px' }}>Cross-session overlap</p>
                      {crossSessionWarnings.map((w) => (
                        <p key={w} style={{ fontSize: 10, color: '#8A6D33', margin: '2px 0' }}>
                          {w}
                        </p>
                      ))}
                    </div>
                  )}

                  {slots.length > 0 && (
                    <p style={{ fontSize: 11, color: '#6E665D', marginTop: 12 }}>
                      Active: <strong>{weeklyHours} hours/week</strong> across <strong>{activeDaysCount} days</strong>
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Preview */}
            {!isDefaultSession && slots.length > 0 && (
              <div style={sectionCardStyle()}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#453F39', margin: '0 0 4px' }}>Preview</h2>
                <p style={{ fontSize: 12, color: '#9A9084', margin: '0 0 16px' }}>Weekly timeline for this session</p>
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ minWidth: 620 }}>
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: 44, flexShrink: 0 }} />
                      {SESSION_GRID_HOURS.map((hour) => (
                        <div key={hour} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#9A9084', paddingBottom: 4 }}>
                          {formatHour(hour)}
                        </div>
                      ))}
                    </div>
                    {ALL_DAYS.map((day) => {
                      const matching = sortLocalSlotsByWeekdayOrder(
                        slots.filter((s) => slotDaysExpanded(s).includes(day)),
                      );
                      return (
                        <div key={day} style={{ display: 'flex', alignItems: 'center', height: 28, borderTop: '1px solid #F4F0E8' }}>
                          <div style={{ width: 44, flexShrink: 0, fontSize: 11, fontWeight: 600, color: '#9A9084' }}>
                            {DAY_SHORT[day]}
          </div>
                          <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
                            {SESSION_GRID_HOURS.map((hour) => (
                              <div key={hour} style={{ flex: 1, borderLeft: '1px solid #F7F4EC', height: 20 }} />
                            ))}
                            {matching.map((slot) => {
                              const startDec = timeToDecimal(slot.startTime);
                              const endDec = timeToDecimal(slot.endTime);
                              const gridStart = SESSION_GRID_HOURS[0];
                              const gridEnd = SESSION_GRID_HOURS[SESSION_GRID_HOURS.length - 1] + 1;
                              const total = gridEnd - gridStart;
                              const leftPct = ((Math.max(startDec, gridStart) - gridStart) / total) * 100;
                              const widthPct = ((Math.min(endDec, gridEnd) - Math.max(startDec, gridStart)) / total) * 100;
                              if (widthPct <= 0) return null;
                              return (
            <div
              key={slot.id}
              style={{
                                    position: 'absolute',
                                    left: `${leftPct}%`,
                                    width: `${widthPct}%`,
                                    top: 4,
                                    height: 14,
                                    borderRadius: 3,
                                    background: `${SLOT_UI_ACCENT}35`,
                                    border: `1.5px solid ${SLOT_UI_ACCENT}80`,
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {sessionItemAssignmentSection}
          </div>
        </div>

        <div style={formStickyActionBarFooterStyle}>
          <button type="button" style={formCancelButtonStyle} onClick={handleCancel}>
            Cancel
          </button>
          <button type="button" style={{ ...formSaveButtonStyle, minWidth: 132, opacity: !isFormValid || isSaving ? 0.5 : 1, cursor: !isFormValid || isSaving ? 'not-allowed' : 'pointer' }} onClick={handleSave} disabled={!isFormValid || isSaving}>
            {isSaving ? saveLoadingLabel : saveIdleLabel}
          </button>
        </div>
      </div>
    </DesktopLayout>
    </>
  );
}
