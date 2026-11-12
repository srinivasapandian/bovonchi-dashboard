import { useState, useEffect, useMemo, useRef, useCallback, type CSSProperties } from 'react';
import { useNavigate, useSearchParams, useLocation, Navigate } from 'react-router-dom';
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCombosStore, useItemsStore, useModifiersStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import type { Combo, ComboSlot, OrderType, ItemStatus } from '../../data/types';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { pcPaths } from '../../paths';
import { withCloneNameLabel } from '../../catalogEntityActions';
import {
  formPageOuterStyle, formPageMainScrollStyle, formStickyActionBarFooterStyle,
  formCancelButtonStyle, formSaveButtonStyle,
} from '../../formLayout';
import { ItemAssignmentSection } from '../../components/ui/ItemAssignmentSection';
import BottomNav from '../../../BottomNav';

/* ── Style constants ── */
const sectionTitle: CSSProperties = { fontSize: 13, fontWeight: 600, textTransform: 'uppercase', color: '#9A9084', letterSpacing: '0.5px', margin: '0 0 16px' };
const cardStyle: CSSProperties = { background: '#FFFFFF', border: '1px solid #E6DFD3', borderRadius: 2, padding: 24, marginBottom: 20 };
const inputBase: CSSProperties = { fontSize: 13, fontFamily: 'var(--font-primary)', color: '#453F39', border: '1px solid #E6DFD3', borderRadius: 2, padding: '10px 12px', outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box' as const };
const compactInput: CSSProperties = { ...inputBase, fontSize: 12, borderRadius: 2, padding: '7px 10px' };
const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 500, color: '#6E665D', fontFamily: 'var(--font-primary)', display: 'block', marginBottom: 6 };
const ACCENT = '#B89550';

const allOrderTypes: OrderType[] = ['dine_in', 'takeout', 'delivery', 'online_ordering', 'catering'];
const channelLabels: Record<OrderType, string> = { dine_in: 'Dine In', takeout: 'Online', delivery: 'Delivery', online_ordering: 'Online', catering: 'Catering' };

type OutletOrderType = {
  id?: string | number;
  typeName?: string;
  typeGroup?: string;
  isEnabled?: boolean | number;
};

function mapOutletOrderTypeToKey(entry: OutletOrderType): OrderType | null {
  const name = String(entry?.typeName ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  const fromId = String(entry?.id ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  const source = `${name} ${fromId}`;
  if (/(dine|dining|walk_in|walkin|eat_in)/.test(source)) return 'dine_in';
  if (/(takeout|take_out|pickup|pick_up)/.test(source)) return 'takeout';
  if (/delivery/.test(source)) return 'delivery';
  if (/(online|gloriafood|web|app|digital)/.test(source)) return 'online_ordering';
  if (/(catering|cater)/.test(source)) return 'catering';
  switch ((entry?.typeGroup ?? '').toUpperCase()) {
    case 'D': return 'dine_in';
    case 'P': return 'takeout';
    case 'S': return 'delivery';
    case 'O': return 'online_ordering';
    default: return null;
  }
}

import { isPickupOrderType } from '../../utils/outletOrderTypes';

function getOutletOrderVisibilityRows(
  selectedBranch: Record<string, any> | null | undefined,
): Array<{ key: OrderType; label: string }> {
  const raw = selectedBranch?.orderTypes;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const seen = new Set<OrderType>();
  const rows: Array<{ key: OrderType; label: string }> = [];
  raw.forEach((entry: OutletOrderType) => {
    // Include disabled (isEnabled: 0) order types too; still exclude in-store.
    const notInstore = (entry?.typeGroup ?? 'T') !== 'I';
    if (!notInstore || !isPickupOrderType(entry)) return;
    const key = mapOutletOrderTypeToKey(entry);
    if (!key || seen.has(key)) return;
    seen.add(key);
    // rows.push({ key, label: String(entry?.typeName ?? '').trim() || channelLabels[key] });
    rows.push({ key, label: 'Online' }); // only the Pickup channel is shown, labelled "Online"
  });
  return rows;
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

function invertOutletOrderTypeIds(
  selectedBranch: Record<string, any> | null | undefined,
): Partial<Record<string, OrderType>> {
  const idByKey = getOutletOrderTypeIdByKey(selectedBranch);
  const out: Partial<Record<string, OrderType>> = {};
  allOrderTypes.forEach((ot) => {
    const oid = idByKey[ot];
    if (oid) out[oid] = ot;
  });
  return out;
}

function resolveComboOrderTypeVisibility(
  combo: Combo,
  selectedBranch: Record<string, any> | null | undefined,
): Record<OrderType, boolean> {
  const next = { ...defaultVisibility(), ...(combo.orderTypeVisibility ?? {}) };
  const idToKey = invertOutletOrderTypeIds(selectedBranch);
  for (const row of combo.orderTypeAvailability ?? []) {
    const id = String(row.orderTypeId ?? '').trim();
    const key = idToKey[id];
    if (key) next[key] = Boolean(row.isEnable);
  }
  return next;
}

/* ── Form state types ── */
interface SlotItemForm { itemId: string; supplementPrice: number | ''; }
interface SubGroupForm {
  id: string; label: string; selectionQuantity: number; eligibleItems: SlotItemForm[];
}
interface SlotForm {
  id: string; slotName: string; slotType: 'required' | 'optional';
  minSelections: number; maxSelections: number; defaultItemId: string;
  eligibleItems: SlotItemForm[];
  hasSubGroups: boolean; subGroups: SubGroupForm[];
}
interface FormState {
  name: string; displayName: string; description: string; comboCode: string;
  pricingModel: 'fixed' | 'dynamic'; basePrice: number | ''; costPrice: number | '';
  useChannelPrices: boolean; channelPrices: Partial<Record<OrderType, number | ''>>;
  status: ItemStatus; slots: SlotForm[]; modifierIds: string[];
  orderTypeVisibility: Record<OrderType, boolean>; sessionIds: string[];
}

function makeSubGroup(): SubGroupForm {
  return { id: `sg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, label: '', selectionQuantity: 1, eligibleItems: [] };
}
function makeSlot(index: number): SlotForm {
  return {
    id: `slot-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 5)}`,
    slotName: '', slotType: 'required', minSelections: 1, maxSelections: 1,
    defaultItemId: '', eligibleItems: [], hasSubGroups: false, subGroups: [],
  };
}

function generateCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function clampNonNegative(value: number | '' | string): number {
  if (value === '' || value == null) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

const defaultVisibility = (): Record<OrderType, boolean> =>
  Object.fromEntries(allOrderTypes.map((ot) => [ot, true])) as Record<OrderType, boolean>;

const emptyForm: FormState = {
  name: '', displayName: '', description: '', comboCode: generateCode(),
  pricingModel: 'dynamic', basePrice: '', costPrice: '',
  useChannelPrices: false, channelPrices: {},
  status: 'draft', slots: [makeSlot(0)], modifierIds: [],
  orderTypeVisibility: defaultVisibility(), sessionIds: [],
};

function comboToForm(
  combo: Combo,
  isClone: boolean,
  selectedBranch?: Record<string, any> | null,
): FormState {
  return {
    name: isClone ? withCloneNameLabel(combo.name) : combo.name,
    displayName: combo.displayName ?? '',
    description: combo.description ?? '',
    comboCode: isClone ? generateCode() : combo.comboCode,
    pricingModel: combo.pricingModel,
    basePrice: combo.basePrice,
    costPrice: combo.costPrice ?? '',
    useChannelPrices: !!combo.channelPrices && Object.keys(combo.channelPrices).length > 0,
    channelPrices: combo.channelPrices ?? {},
    status: isClone ? 'draft' : combo.status,
    slots: combo.slots.map((s) => ({
      id: isClone ? `slot-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` : s.id,
      slotName: s.slotName, slotType: s.slotType,
      minSelections: s.minSelections, maxSelections: s.maxSelections,
      defaultItemId: s.defaultItemId ?? '',
      eligibleItems: s.eligibleItems.map((ei) => ({ itemId: ei.itemId, supplementPrice: ei.supplementPrice })),
      hasSubGroups: s.hasSubGroups ?? false,
      subGroups: (s.subGroups ?? []).map((sg) => ({
        id: sg.id, label: sg.label, selectionQuantity: sg.selectionQuantity,
        eligibleItems: sg.eligibleItems.map((ei) => ({ itemId: ei.itemId, supplementPrice: ei.supplementPrice })),
      })),
    })),
    modifierIds: [...(combo.modifierIds ?? [])],
    orderTypeVisibility: resolveComboOrderTypeVisibility(combo, selectedBranch ?? null),
    sessionIds: [...(combo.sessionIds ?? [])],
  };
}

/* ── Drag handle ── */
function DragHandle({ listeners, attributes }: { listeners?: any; attributes?: any }) {
  return (
    <span {...listeners} {...attributes} style={{ cursor: 'grab', color: '#9A9084', display: 'flex', alignItems: 'center', touchAction: 'none' }}>
      <span className="material-symbols-rounded" style={{ fontSize: 20 }}>drag_indicator</span>
    </span>
  );
}

/* ── Sortable Slot Row ── */
function SortableSlotRow({ slot, index, allItems, pricingModel, onUpdate, onRemove, canRemove, isMobile, allSlotItemIds }: {
  slot: SlotForm; index: number;
  allItems: { id: string; name: string; categoryIds: string[]; status: string; basePrice: number }[];
  pricingModel: 'fixed' | 'dynamic';
  onUpdate: (updates: Partial<SlotForm>) => void; onRemove: () => void;
  canRemove: boolean; isMobile: boolean; allSlotItemIds: Set<string>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1,
    background: '#FDFCF9', border: '1px solid #E6DFD3', borderRadius: 2, padding: isMobile ? 14 : 18, marginBottom: 12,
  };

  const selectedIds = useMemo(() => slot.eligibleItems.map((ei) => ei.itemId), [slot.eligibleItems]);

  /* Items available for this slot: exclude items already in OTHER slots */
  const availableItems = useMemo(() => {
    return allItems
      .filter((it) => !allSlotItemIds.has(it.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((it) => ({ id: it.id, name: it.name, subtitle: `$${it.basePrice.toFixed(2)}` }));
  }, [allItems, allSlotItemIds]);

  const handleToggle = useCallback((itemId: string) => {
    const exists = slot.eligibleItems.find((ei) => ei.itemId === itemId);
    if (exists) {
      onUpdate({ eligibleItems: slot.eligibleItems.filter((x) => x.itemId !== itemId) });
    } else if (slot.eligibleItems.length < 20) {
      onUpdate({ eligibleItems: [...slot.eligibleItems, { itemId, supplementPrice: 0 }] });
    }
  }, [slot.eligibleItems, onUpdate]);

  const handleRemove = useCallback((itemId: string) => {
    onUpdate({ eligibleItems: slot.eligibleItems.filter((x) => x.itemId !== itemId) });
  }, [slot.eligibleItems, onUpdate]);

  return (
    <div ref={setNodeRef} style={style}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <DragHandle listeners={listeners} attributes={attributes} />
        <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, minWidth: 24 }}>#{index + 1}</span>
        <input value={slot.slotName} onChange={(e) => onUpdate({ slotName: e.target.value.slice(0, 30) })}
          placeholder="e.g. Choose your Burger" style={{ ...compactInput, flex: 1, fontWeight: 600 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {(['required', 'optional'] as const).map((t) => (
            <button key={t} type="button" onClick={() => onUpdate({ slotType: t, minSelections: t === 'optional' ? 0 : 1 })}
              style={{
                padding: '4px 10px', borderRadius: 2, fontSize: 10, fontWeight: 600, textTransform: 'capitalize',
                border: slot.slotType === t ? `1.5px solid ${ACCENT}` : '1px solid #E6DFD3',
                background: slot.slotType === t ? `${ACCENT}08` : '#fff',
                color: slot.slotType === t ? ACCENT : '#6E665D', cursor: 'pointer', fontFamily: 'var(--font-primary)',
              }}>{t}</button>
          ))}
        </div>
        {canRemove && (
          <button type="button" onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A63D2F', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-primary)' }}>Remove</button>
        )}
      </div>

      {/* Min/Max */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '100px 100px 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Min</label>
          <input type="number" min={0} max={5} value={slot.minSelections}
            onChange={(e) => onUpdate({ minSelections: Math.max(0, Number(e.target.value)) })} style={compactInput} />
        </div>
        <div>
          <label style={labelStyle}>Max</label>
          <input type="number" min={1} max={5} value={slot.maxSelections}
            onChange={(e) => onUpdate({ maxSelections: Math.max(1, Number(e.target.value)) })} style={compactInput} />
        </div>
        {slot.eligibleItems.length > 0 && (
          <div>
            <label style={labelStyle}>{/* was: Default item */}Default product</label>
            <select value={slot.defaultItemId} onChange={(e) => onUpdate({ defaultItemId: e.target.value })} style={{ ...compactInput, cursor: 'pointer' }}>
              <option value="">None</option>
              {slot.eligibleItems.map((ei) => {
                const item = allItems.find((i) => i.id === ei.itemId);
                return <option key={ei.itemId} value={ei.itemId}>{item?.name ?? ei.itemId}</option>;
              })}
            </select>
          </div>
        )}
      </div>

      {/* Eligible items with supplement pricing */}
      <label style={labelStyle}>Eligible Items ({slot.eligibleItems.length}/20)</label>
      {pricingModel === 'dynamic' && slot.eligibleItems.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {slot.eligibleItems.map((ei) => {
            const item = allItems.find((it) => it.id === ei.itemId);
            return (
              <span key={ei.itemId} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, padding: '4px 8px', borderRadius: 2, background: 'var(--accent-soft, rgba(184,149,80,0.08))', color: 'var(--t1, #453F39)', fontFamily: 'var(--font-primary)' }}>
                {item?.name ?? ei.itemId}
                <input type="number" min={0} step={1} value={ei.supplementPrice} placeholder="$0"
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : clampNonNegative(e.target.value);
                    onUpdate({ eligibleItems: slot.eligibleItems.map((x) => x.itemId === ei.itemId ? { ...x, supplementPrice: val } : x) });
                  }}
                  style={{ width: 48, fontSize: 10, padding: '2px 4px', border: '1px solid var(--card-border, #E6DFD3)', borderRadius: 4, outline: 'none', textAlign: 'right', background: 'var(--surface, #fff)' }}
                  title="Supplement price" />
              </span>
            );
          })}
        </div>
      )}

      {/* Sub-Groups toggle (PCF-13) */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 500, color: 'var(--t2, #6E665D)', cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
          <input type="checkbox" checked={slot.hasSubGroups} onChange={(e) => {
            if (e.target.checked) {
              onUpdate({ hasSubGroups: true, eligibleItems: [], subGroups: [makeSubGroup(), makeSubGroup()] });
            } else {
              onUpdate({ hasSubGroups: false, subGroups: [], eligibleItems: [] });
            }
          }} style={{ accentColor: 'var(--accent, #B89550)', width: 14, height: 14 }} />
          Sub-Groups
          <span style={{ fontSize: 10, color: 'var(--t3, #9A9084)' }}>(e.g., "1 Rice OR 2 Breads")</span>
        </label>
      </div>

      {!slot.hasSubGroups ? (
        <>
          {/* Shared item picker (showPills handles non-dynamic display) */}
          <ItemAssignmentSection
            title=""
            items={availableItems}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            onRemove={handleRemove}
            collapsible={false}
            showPills={pricingModel !== 'dynamic'}
            emptyLabel="No products added yet" /* was: emptyLabel="No items added yet" */
            searchPlaceholder="Search products..." /* was: searchPlaceholder="Search items..." */
            persistedSelectedIds={[]}
          />
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Sub-group header preview */}
          {slot.subGroups.length >= 2 && (
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent, #B89550)', fontFamily: 'var(--font-primary)', padding: '6px 10px', borderRadius: 2, background: 'rgba(184,149,80,0.04)', border: '1px solid rgba(184,149,80,0.12)' }}>
              {slot.slotName || 'This slot'}: {slot.subGroups.map((sg, i) => `${sg.selectionQuantity} ${sg.label || `Group ${i + 1}`}`).join(' or ')}
            </div>
          )}
          {slot.subGroups.map((sg, sgIdx) => (
            <div key={sg.id} style={{ padding: 12, borderRadius: 2, border: '1px solid var(--card-border, #E6DFD3)', background: '#FDFCF9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2, #6E665D)', fontFamily: 'var(--font-primary)' }}>
                  Sub-Group {sgIdx + 1}
                </span>
                {slot.subGroups.length > 2 && (
                  <button type="button" onClick={() => onUpdate({ subGroups: slot.subGroups.filter((_, i) => i !== sgIdx) })}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#A63D2F', fontSize: 11, fontFamily: 'var(--font-primary)' }}>
                    Remove
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
                <input
                  value={sg.label} placeholder="Label (e.g., Rice, Breads)"
                  onChange={(e) => {
                    const next = [...slot.subGroups];
                    next[sgIdx] = { ...sg, label: e.target.value.slice(0, 20) };
                    onUpdate({ subGroups: next });
                  }}
                  style={{ padding: '6px 10px', borderRadius: 2, border: '1px solid var(--card-border, #E6DFD3)', fontSize: 12, fontFamily: 'var(--font-primary)', outline: 'none' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)' }}>Qty:</span>
                  <input type="number" value={sg.selectionQuantity} min={1} max={10}
                    onChange={(e) => {
                      const next = [...slot.subGroups];
                      next[sgIdx] = { ...sg, selectionQuantity: Math.max(1, Number(e.target.value) || 1) };
                      onUpdate({ subGroups: next });
                    }}
                    style={{ width: 48, padding: '6px 8px', borderRadius: 2, border: '1px solid var(--card-border, #E6DFD3)', fontSize: 12, textAlign: 'center', outline: 'none' }}
                  />
                </div>
              </div>
              <ItemAssignmentSection
                title=""
                items={availableItems}
                selectedIds={sg.eligibleItems.map((ei) => ei.itemId)}
                onToggle={(id) => {
                  const next = [...slot.subGroups];
                  const items = [...sg.eligibleItems];
                  const idx = items.findIndex((ei) => ei.itemId === id);
                  if (idx >= 0) items.splice(idx, 1);
                  else items.push({ itemId: id, supplementPrice: 0 });
                  next[sgIdx] = { ...sg, eligibleItems: items };
                  onUpdate({ subGroups: next });
                }}
                onRemove={(id) => {
                  const next = [...slot.subGroups];
                  next[sgIdx] = { ...sg, eligibleItems: sg.eligibleItems.filter((ei) => ei.itemId !== id) };
                  onUpdate({ subGroups: next });
                }}
                collapsible={false}
                emptyLabel="No products" /* was: emptyLabel="No items" */
                searchPlaceholder="Search products..." /* was: searchPlaceholder="Search items..." */
                addButtonLabel="Add Products" /* was: addButtonLabel="Add Items" */
                persistedSelectedIds={[]}
              />
            </div>
          ))}
          {slot.subGroups.length < 5 && (
            <button type="button" onClick={() => onUpdate({ subGroups: [...slot.subGroups, makeSubGroup()] })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 2, border: '1px dashed var(--accent, #B89550)', background: 'transparent', color: 'var(--accent, #B89550)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)', alignSelf: 'flex-start' }}>
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>add</span>
              Add Sub-Group
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main form ── */
export default function ComboFormPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { auth } = useAuth();
  const { selectedBranch } = useBranch();
  const { combos, editingComboId, fetchCombos, createComboOnServer, updateComboOnServer } = useCombosStore();
  const { items, fetchItems } = useItemsStore();
  const { modifiers, fetchModifiers } = useModifiersStore();
  const { addToast } = useToastStore();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const isEditRoute = location.pathname === pcPaths.comboEdit;
  const id = isEditRoute ? editingComboId : null;
  const isEdit = Boolean(id);
  const existing = isEdit ? combos.find((c) => c.id === id) : null;
  const cloneId = !isEdit ? searchParams.get('clone')?.trim() || null : null;
  const cloneSource = useMemo(() => (!isEdit && cloneId ? combos.find((c) => c.id === cloneId) ?? null : null), [isEdit, cloneId, combos]);

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => { setTopBarProps({ title: isEdit ? 'Edit Combo' : 'New Combo', breadcrumbs: 'Product Catalog > Combos' }); }, [setTopBarProps, isEdit]);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const saveIdleLabel = isEdit ? 'Update' : 'Create';
  const saveLoadingLabel = isEdit ? 'Updating' : 'Creating';
  const hydrateKeyRef = useRef('');

  const outletOrderTypeIdMapKey = useMemo(
    () => JSON.stringify(getOutletOrderTypeIdByKey(selectedBranch)),
    [selectedBranch],
  );

  useEffect(() => {
    if (isEdit && existing) {
      const key = `edit:${id}:${outletOrderTypeIdMapKey}`;
      if (hydrateKeyRef.current === key) return;
      hydrateKeyRef.current = key;
      setForm(comboToForm(existing, false, selectedBranch));
      return;
    }
    if (cloneSource) {
      const key = `clone:${cloneId}:${outletOrderTypeIdMapKey}`;
      if (hydrateKeyRef.current === key) return;
      hydrateKeyRef.current = key;
      setForm(comboToForm(cloneSource, true, selectedBranch));
      return;
    }
    if (!isEdit && hydrateKeyRef.current !== 'new') {
      hydrateKeyRef.current = 'new';
      setForm(emptyForm);
    }
  }, [isEdit, id, existing, cloneId, cloneSource, selectedBranch, outletOrderTypeIdMapKey]);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    if (!locationId) return;
    const token = auth?.accessToken ?? auth?.access_token ?? '';
    const needsComboListForHydration = (isEdit && !existing) || (!!cloneId && !cloneSource);
    if (needsComboListForHydration) {
      void fetchCombos(locationId, token, { skipDuplicateMs: 750 });
    }
    void fetchItems(locationId, token, { skipDuplicateMs: 750 });
    void fetchModifiers(locationId, token, { skipDuplicateMs: 750 });
  }, [
    selectedBranch?.id,
    selectedBranch?.locationId,
    auth?.accessToken,
    auth?.access_token,
    isEdit,
    existing,
    cloneId,
    cloneSource,
    fetchCombos,
    fetchItems,
    fetchModifiers,
  ]);

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const updateSlot = (idx: number, updates: Partial<SlotForm>) => {
    setForm((prev) => ({ ...prev, slots: prev.slots.map((s, i) => (i === idx ? { ...s, ...updates } : s)) }));
  };
  const removeSlot = (idx: number) => { setForm((prev) => ({ ...prev, slots: prev.slots.filter((_, i) => i !== idx) })); };
  const addSlot = () => { if (form.slots.length < 5) setForm((prev) => ({ ...prev, slots: [...prev.slots, makeSlot(prev.slots.length)] })); };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setForm((prev) => {
      const oldIdx = prev.slots.findIndex((s) => s.id === active.id);
      const newIdx = prev.slots.findIndex((s) => s.id === over.id);
      return { ...prev, slots: arrayMove(prev.slots, oldIdx, newIdx) };
    });
  };

  // Collect all item IDs across slots (for duplicate prevention)
  const allSlotItemIdsBySlot = useMemo(() => {
    const map = new Map<number, Set<string>>();
    form.slots.forEach((slot, idx) => {
      const otherIds = new Set<string>();
      form.slots.forEach((s, i) => { if (i !== idx) s.eligibleItems.forEach((ei) => otherIds.add(ei.itemId)); });
      map.set(idx, otherIds);
    });
    return map;
  }, [form.slots]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (form.name.length > 30) errs.name = 'Max 30 characters';
    if (!form.basePrice || Number(form.basePrice) < 0) errs.basePrice = 'Price is required';
    if (form.costPrice !== '' && Number(form.costPrice) < 0) errs.costPrice = 'Cost price cannot be below 0';
    if (form.slots.length === 0) errs.slots = 'Add at least one component slot';
    form.slots.forEach((s, i) => {
      if (!s.slotName.trim()) errs[`slot_name_${i}`] = `Slot ${i + 1} needs a name`;
      if (s.slotType === 'required' && s.eligibleItems.length === 0) errs[`slot_items_${i}`] = `"${s.slotName || `Slot ${i + 1}`}" needs at least 1 item`;
      if (s.maxSelections < s.minSelections) errs[`slot_sel_${i}`] = `"${s.slotName}": max must be >= min`;
      if (s.eligibleItems.some((ei) => Number(ei.supplementPrice) < 0)) {
        errs[`slot_price_${i}`] = `"${s.slotName || `Slot ${i + 1}`}" has supplement price below 0`;
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (saving) return;
    if (!validate()) { addToast('Please fix errors before saving', 'error'); return; }
    if (Number(form.basePrice) === 0 && !window.confirm('This combo has a $0.00 price. Are you sure?')) return;
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? '';
    if (!locationId) {
      addToast('Select a branch before saving combo', 'error');
      return;
    }

    const slots: ComboSlot[] = form.slots.map((s, i) => ({
      id: s.id, slotName: s.slotName, slotType: s.slotType,
      minSelections: s.minSelections, maxSelections: s.maxSelections,
      defaultItemId: s.defaultItemId || undefined, sortPosition: i,
      eligibleItems: s.eligibleItems.map((ei) => ({ itemId: ei.itemId, supplementPrice: clampNonNegative(ei.supplementPrice) })),
    }));

    const orderTypeIdByKey = getOutletOrderTypeIdByKey(selectedBranch);
    // Expand each OrderType group to all enabled outlet UUIDs so every third party
    // (DoorDash/GrubHub/Ubereats) lands in the payload with the group's visibility flag.
    const branchOrderTypes = Array.isArray((selectedBranch as Record<string, unknown>)?.orderTypes)
      ? ((selectedBranch as Record<string, unknown>).orderTypes as Array<{
          id?: string;
          typeName?: string;
          typeGroup?: string;
          isEnabled?: number | boolean;
        }>)
      : [];
    // Include disabled order types too so their availability is still persisted on save.
    const branchOtsForChannels = branchOrderTypes;
    const orderTypeAvailability = orderTypeRowsOrFallback.flatMap(({ key }) => {
      const isEnable = Boolean(form.orderTypeVisibility[key]);
      const matchingIds = branchOtsForChannels
        .filter((ot) => mapOutletOrderTypeToKey(ot) === key)
        .map((ot) => String(ot.id ?? '').trim())
        .filter(Boolean);
      if (matchingIds.length > 0) {
        return matchingIds.map((orderTypeId) => ({ orderTypeId, isEnable }));
      }
      const fallbackId = orderTypeIdByKey[key] ?? key;
      return fallbackId ? [{ orderTypeId: String(fallbackId), isEnable }] : [];
    });

    const slotsPayload = slots.map((s) => ({
      slotId: s.id,
      slotName: s.slotName,
      slotType: s.slotType === 'optional' ? 'OPTIONAL' as const : 'REQUIRED' as const,
      minSelections: s.minSelections,
      maxSelections: s.maxSelections,
      defaultItemId: s.defaultItemId,
      sortOrder: s.sortPosition,
      eligibleItems: s.eligibleItems.map((ei) => ({
        itemId: ei.itemId,
        supplementPrice: clampNonNegative(ei.supplementPrice),
      })),
    }));

    const basePayload = {
      locationId,
      name: form.name.trim(),
      displayName: form.displayName.trim() || undefined,
      description: form.description.trim() || undefined,
      comboCode: form.comboCode || generateCode(),
      pricingModel: form.pricingModel === 'dynamic' ? 'DYNAMIC' as const : 'FIXED' as const,
      basePrice: Number(form.basePrice),
      status: form.status === 'active' ? 'ACTIVE' as const : form.status === 'archived' ? 'ARCHIVED' as const : 'DRAFT' as const,
      orderTypeAvailability,
      modifiers: form.modifierIds.map((modifierId, index) => ({ modifierId, sortOrder: index })),
      sessionSlotIds: form.sessionIds,
      slots: slotsPayload,
    };

    setSaving(true);
    try {
      if (isEdit && id) {
        const existingSlotIds = new Set((existing?.slots ?? []).map((s) => s.id));
        const currentSlotIds = new Set(slots.map((s) => s.id));
        const removedSlotIds = Array.from(existingSlotIds).filter((slotId) => !currentSlotIds.has(slotId));
        const removedModifierIds = (existing?.modifierIds ?? []).filter(
          (modifierId) => !form.modifierIds.includes(modifierId),
        );
        const deleteFields: NonNullable<Parameters<typeof updateComboOnServer>[0]['deleteFields']> = {};
        if (removedSlotIds.length > 0) deleteFields.slots = removedSlotIds;
        if (removedModifierIds.length > 0) deleteFields.modifiers = removedModifierIds;
        await updateComboOnServer(
          {
            comboId: id,
            ...basePayload,
            ...(Object.keys(deleteFields).length > 0 ? { deleteFields } : {}),
          },
          token,
        );
        addToast('Combo updated', 'success');
      } else {
        await createComboOnServer(basePayload, token);
        addToast('Combo created', 'success');
      }
      navigate(pcPaths.combos);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to save combo', 'error');
    } finally {
      setSaving(false);
    }
  };

  const itemList = useMemo(() => items.map((it) => ({ id: it.id, name: it.name, categoryIds: it.categoryIds, status: it.status, basePrice: it.basePrice })), [items]);
  const slotIds = useMemo(() => form.slots.map((s) => s.id), [form.slots]);
  const orderTypeRows = useMemo(() => getOutletOrderVisibilityRows(selectedBranch), [selectedBranch]);
  const orderTypeRowsOrFallback = orderTypeRows.length
    ? orderTypeRows
    : allOrderTypes.map((key) => ({ key, label: channelLabels[key] }));
  const modifierItemsForPicker = useMemo(
    () => modifiers.map((m) => ({ id: m.id, name: m.name })),
    [modifiers],
  );

  const toggleModifier = useCallback((modId: string) => {
    setForm((prev) => ({
      ...prev,
      modifierIds: prev.modifierIds.includes(modId)
        ? prev.modifierIds.filter((x) => x !== modId)
        : [...prev.modifierIds, modId],
    }));
  }, []);

  const removeModifier = useCallback((modId: string) => {
    setForm((prev) => ({ ...prev, modifierIds: prev.modifierIds.filter((x) => x !== modId) }));
  }, []);

  const isFormValid = useMemo(() => {
    if (!form.name.trim()) return false;
    if (form.name.length > 30) return false;
    if (form.basePrice === '' || Number(form.basePrice) < 0) return false;
    if (form.costPrice !== '' && Number(form.costPrice) < 0) return false;
    if (form.slots.length === 0) return false;
    for (const s of form.slots) {
      if (!s.slotName.trim()) return false;
      if (s.slotType === 'required' && s.eligibleItems.length === 0) return false;
      if (s.maxSelections < s.minSelections) return false;
      if (s.eligibleItems.some((ei) => Number(ei.supplementPrice) < 0)) return false;
    }
    return true;
  }, [form]);

  const content = (
    <div style={isMobile ? { ...formPageOuterStyle, height: 'auto' } : formPageOuterStyle}>
      {isMobile && (
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span onClick={() => navigate(pcPaths.combos)} className="material-symbols-rounded" style={{ fontSize: 22, color: '#453F39', cursor: 'pointer' }}>arrow_back</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: 0 }}>{isEdit ? 'Edit Combo' : 'New Combo'}</h1>
        </div>
      )}

      <div style={formPageMainScrollStyle}>
        <div style={{ padding: isMobile ? 16 : 32 }}>

          {/* Identity */}
          <div style={cardStyle}>
            <p style={sectionTitle}>COMBO IDENTITY</p>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Combo Name *</label>
                <input value={form.name} onChange={(e) => patch('name', e.target.value.slice(0, 30))} placeholder="e.g. Happy Meal" style={{ ...inputBase, borderColor: errors.name ? '#A63D2F' : '#E6DFD3' }} />
                {errors.name && <span style={{ fontSize: 11, color: '#A63D2F' }}>{errors.name}</span>}
                <span style={{ fontSize: 10, color: '#9A9084', float: 'right' }}>{form.name.length}/30</span>
              </div>
              <div>
                <label style={labelStyle}>Display Name</label>
                <input value={form.displayName} onChange={(e) => patch('displayName', e.target.value)} placeholder="Customer-facing name" style={inputBase} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={form.description} onChange={(e) => patch('description', e.target.value.slice(0, 200))} placeholder="Describe this combo..." rows={2} style={{ ...inputBase, resize: 'vertical' }} />
                <span style={{ fontSize: 10, color: '#9A9084', float: 'right' }}>{form.description.length}/200</span>
              </div>
              <div>
                <label style={labelStyle}>Combo Code</label>
                <input value={form.comboCode} onChange={(e) => patch('comboCode', e.target.value.slice(0, 6).toUpperCase())} style={inputBase} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['draft', 'active', 'archived'] as const).map((s) => (
                <button key={s} type="button" onClick={() => patch('status', s)}
                  style={{ padding: '6px 14px', borderRadius: 2, fontSize: 12, fontWeight: 600, textTransform: 'capitalize', border: form.status === s ? `1.5px solid ${ACCENT}` : '1px solid #E6DFD3', background: form.status === s ? `${ACCENT}08` : '#fff', color: form.status === s ? ACCENT : '#6E665D', cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div style={cardStyle}>
            <p style={sectionTitle}>PRICING</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['fixed', 'dynamic'] as const).map((m) => (
                <button key={m} type="button" onClick={() => patch('pricingModel', m)}
                  style={{ padding: '8px 18px', borderRadius: 2, fontSize: 12, fontWeight: 600, border: form.pricingModel === m ? `1.5px solid ${ACCENT}` : '1px solid #E6DFD3', background: form.pricingModel === m ? `${ACCENT}08` : '#fff', color: form.pricingModel === m ? ACCENT : '#6E665D', cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
                  {m === 'fixed' ? 'Fixed Price' : 'Dynamic Price'}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#9A9084', margin: '0 0 12px' }}>
              {form.pricingModel === 'fixed' ? 'Single bundle price regardless of selections.' : 'Base price + supplement charges for premium selections.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>Base Price *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9A9084' }}>$</span>
                  <input type="number" min={0} step={1} value={form.basePrice} onChange={(e) => patch('basePrice', e.target.value === '' ? '' : clampNonNegative(e.target.value))} placeholder="0.00" style={{ ...inputBase, paddingLeft: 28, borderColor: errors.basePrice ? '#A63D2F' : '#E6DFD3' }} />
                </div>
                {errors.basePrice && <span style={{ fontSize: 11, color: '#A63D2F' }}>{errors.basePrice}</span>}
              </div>
              <div>
                <label style={labelStyle}>Cost Price</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9A9084' }}>$</span>
                  <input type="number" min={0} step={1} value={form.costPrice} onChange={(e) => patch('costPrice', e.target.value === '' ? '' : clampNonNegative(e.target.value))} placeholder="Optional" style={{ ...inputBase, paddingLeft: 28, borderColor: errors.costPrice ? '#A63D2F' : '#E6DFD3' }} />
                </div>
                {errors.costPrice && <span style={{ fontSize: 11, color: '#A63D2F' }}>{errors.costPrice}</span>}
              </div>
            </div>
          </div>

          {/* Component Slots */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ ...sectionTitle, margin: 0 }}>COMPONENT SLOTS ({form.slots.length}/5)</p>
              {form.slots.length < 5 && (
                <button type="button" onClick={addSlot}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 2, border: `1.5px solid ${ACCENT}`, background: 'transparent', color: ACCENT, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 14 }}>add</span>Add Slot
                </button>
              )}
            </div>
            {errors.slots && <div style={{ fontSize: 11, color: '#A63D2F', marginBottom: 8 }}>{errors.slots}</div>}
            {Object.entries(errors).filter(([k]) => k.startsWith('slot_')).map(([k, v]) => (
              <div key={k} style={{ fontSize: 11, color: '#A63D2F', marginBottom: 4 }}>{v}</div>
            ))}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={slotIds} strategy={verticalListSortingStrategy}>
                {form.slots.map((slot, idx) => (
                  <SortableSlotRow
                    key={slot.id} slot={slot} index={idx}
                    allItems={itemList}
                    pricingModel={form.pricingModel}
                    onUpdate={(u) => updateSlot(idx, u)} onRemove={() => removeSlot(idx)}
                    canRemove={form.slots.length > 1} isMobile={isMobile}
                    allSlotItemIds={allSlotItemIdsBySlot.get(idx) ?? new Set()}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          {/* Combo-Level Modifiers */}
          <div style={cardStyle}>
            <ItemAssignmentSection
              title="Combo-Level Product Options" /* was: "Combo-Level Modifiers" */
              description="Product options that apply to the entire combo (e.g., &quot;Make it Large&quot;)." /* was: "Modifiers that apply to the entire combo (e.g., &quot;Make it Large&quot;)." */
              icon="tune"
              items={modifierItemsForPicker}
              selectedIds={form.modifierIds}
              onToggle={toggleModifier}
              onRemove={removeModifier}
              collapsible={false}
              emptyLabel="None added"
              searchPlaceholder="Search product options..." /* was: "Search modifiers..." */
              addButtonLabel="Add Product Options" /* was: "Add Modifiers" */
              noResultsLabel="No product options found." /* was: "No modifiers found." */
              persistedSelectedIds={[]}
            />
          </div>

          {/* Availability */}
          <div style={cardStyle}>
            <p style={sectionTitle}>AVAILABILITY</p>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8C6A7A', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, fontFamily: 'var(--font-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#8C6A7A' }}>visibility</span>
              Channel Visibility
            </div>
            <p style={{ fontSize: 11, color: 'var(--t3, #9A9084)', margin: '0 0 10px', fontFamily: 'var(--font-primary)', lineHeight: 1.5, paddingLeft: 10, borderLeft: '2px solid rgba(124,58,237,0.2)' }}>
              Choose which channels this combo appears on.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              {orderTypeRowsOrFallback.map((row) => (
                <label key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-primary)' }}>
                  <input type="checkbox" checked={form.orderTypeVisibility[row.key]} onChange={(e) => patch('orderTypeVisibility', { ...form.orderTypeVisibility, [row.key]: e.target.checked })} style={{ accentColor: ACCENT, width: 14, height: 14 }} />
                  {row.label}
                </label>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div style={isMobile ? { ...formStickyActionBarFooterStyle, position: 'fixed' as const, bottom: 0, left: 0, right: 0, zIndex: 100, padding: 16 } : formStickyActionBarFooterStyle}>
        <button type="button" style={formCancelButtonStyle} onClick={() => navigate(pcPaths.combos)}>Cancel</button>
        <button
          type="button"
          style={{ ...formSaveButtonStyle, minWidth: 132, opacity: !isFormValid || saving ? 0.5 : 1, cursor: !isFormValid || saving ? 'not-allowed' : 'pointer' }}
          onClick={() => { void handleSave(); }}
          disabled={!isFormValid || saving}
        >
          {saving ? saveLoadingLabel : saveIdleLabel}
        </button>
      </div>
    </div>
  );

  if (isEditRoute && !editingComboId) {
    return <Navigate to={pcPaths.combos} replace />;
  }

  if (isMobile) return <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif", paddingBottom: 80 }}>{content}</div>;
  return <DesktopLayout>{content}</DesktopLayout>;
}
