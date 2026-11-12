import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import { useNavigate, useLocation, Navigate, useSearchParams } from 'react-router-dom';
import { useModifiersStore, useKitchenStationsStore, useItemsStore, useCategoriesStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import { useErrorToast } from '../../hooks/useErrorToast';
import type { ModifierGroup, ModifierOption, ModifierType } from '../../data/types';
import type { CreateModifierPayload, UpdateModifierPayload } from '../../../../services/modifierCatalogApi';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { pcPaths } from '../../paths';
import { pickHighlightIdFromApiResponse } from '../../utils/pickHighlightIdFromApiResponse';
import { generateCopyName } from '../../catalogEntityActions';
import {
  formPageOuterStyle,
  formPageMainScrollStyle,
  formStickyActionBarFooterStyle,
  formCancelButtonStyle,
  formSaveButtonStyle,
} from '../../formLayout';
import Select from '../../components/forms/Select';
import { DeleteConfirmationModal, deleteConfirmTitle } from '../../components/ui/DeleteConfirmationModal';
import { ItemAssignmentSection } from '../../components/ui/ItemAssignmentSection';
import { DiscardChangesModal } from '../../components/ui/DiscardChangesModal';
import { useFormDiscardGuard } from '../../hooks/useFormDiscardGuard';

const MAX_MODIFIERS_PER_ITEM = 30;
const MAX_OPTIONS_PER_MODIFIER = 128;

/* ── Dynamic order types from outlet ── */

interface OutletOrderType {
  id: string;
  typeName: string;
  typeGroup?: string;
  isEnabled?: number | boolean;
  locationId?: string;
}

/** Normalize channel display name (matches maghil-portal channelUtils) */
function getChannelDisplayName(typeName: string): string {
  const n = (typeName ?? '').toLowerCase();
  if (n.includes('dining') || n.includes('dinein') || n.includes('dine-in') || n.includes('walk-in') || n.includes('walkin')) return 'Dine-in';
  if (!typeName) return '';
  return typeName.charAt(0).toUpperCase() + typeName.slice(1).toLowerCase();
}

import { isPickupOrderType } from '../../utils/outletOrderTypes';

/** Get enabled, non-instore order types for the current branch (matches maghil-portal) */
function getOrderTypesForBranch(selectedBranch: Record<string, any> | null | undefined): OutletOrderType[] {
  if (!selectedBranch) return [];
  const raw: any[] = selectedBranch.orderTypes ?? [];
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.filter((ot: any) => {
    // Include disabled (isEnabled: 0) order types too; still exclude in-store.
    const notInstore = (ot?.typeGroup ?? 'T') !== 'I';
    return notInstore && isPickupOrderType(ot);
  });
}

/** Material Symbols icon name based on typeGroup */
function getChannelIcon(typeGroup?: string): string {
  switch (typeGroup) {
    case 'D': return 'restaurant';
    case 'P': return 'shopping_bag';
    case 'S': return 'delivery_dining';
    case 'T': return 'storefront';
    case 'O': return 'language';
    default: return 'storefront';
  }
}

interface FormState {
  name: string;
  displayName: string;
  type: ModifierType;
  isRequired: boolean;
  allowMultiple: boolean;
  minSelection: number;
  maxSelection: number;
  options: ModifierOption[];
  charLimit: number | '';
  placeholder: string;
  hideOnReceipt: boolean;
  kitchenStationId: string;
  channelVisibility: Record<string, boolean>;
}

function modifierToFormState(mod: ModifierGroup, isClone: boolean, existingNames: string[] = []): FormState {
  const ts = Date.now();
  return {
    name: isClone ? generateCopyName(mod.name, existingNames, 128) : mod.name,
    displayName: mod.displayName ?? '',
    type: mod.type,
    isRequired: mod.isRequired,
    allowMultiple: mod.allowMultiple,
    minSelection: mod.minSelection,
    maxSelection: mod.maxSelection,
    options: mod.options.map((o, i) =>
      isClone
        ? { ...o, id: `opt-${ts}-${i}-${Math.random().toString(36).slice(2, 7)}` }
        : { ...o },
    ),
    charLimit: '',
    placeholder: '',
    hideOnReceipt: false,
    kitchenStationId: '',
    channelVisibility: {}, // populated dynamically from outlet order types
  };
}

const emptyForm: FormState = {
  name: '',
  displayName: '',
  type: 'options_list',
  isRequired: false,
  allowMultiple: false,
  minSelection: 0,
  maxSelection: 1,
  options: [],
  charLimit: '',
  placeholder: '',
  hideOnReceipt: false,
  kitchenStationId: '',
  channelVisibility: {}, // populated dynamically from outlet order types
};

/* ── shared inline-style constants ── */
const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  textTransform: 'uppercase',
  color: '#9A9084',
  letterSpacing: '0.5px',
  margin: '0 0 16px',
};

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E6DFD3',
  borderRadius: 2,
  padding: 24,
};

const inputBase: React.CSSProperties = {
  fontSize: 13,
  fontFamily: 'var(--font-primary, "Jost", sans-serif)',
  color: 'var(--t1, #453F39)',
  border: '1px solid #E6DFD3',
  borderRadius: 2,
  padding: '10px 12px',
  outline: 'none',
  background: 'var(--surface, #FFFFFF)',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  width: '100%',
  boxSizing: 'border-box' as const,
};

const inputErrorBorder = 'var(--red, #A63D2F)';

const compactInput: React.CSSProperties = {
  ...inputBase,
  fontSize: 12,
  borderRadius: 2,
  padding: '7px 10px',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--t2, #6E665D)',
  fontFamily: 'var(--font-primary)',
  display: 'block',
  marginBottom: 6,
};

const errorTextStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--red, #A63D2F)',
  marginTop: 4,
};

const fieldHintStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--t3, #9A9084)',
  fontFamily: 'var(--font-primary)',
  margin: '4px 0 0',
};

const colHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: '#9A9084',
  whiteSpace: 'nowrap',
};

const optRowInput: React.CSSProperties = {
  fontSize: 13,
  fontFamily: 'var(--font-primary, "Jost", sans-serif)',
  color: 'var(--t1, #453F39)',
  border: '1px solid #E6DFD3',
  borderRadius: 2,
  padding: '10px 12px',
  outline: 'none',
  background: 'var(--surface, #FFFFFF)',
  transition: 'border-color 0.15s ease',
  width: '100%',
  boxSizing: 'border-box' as const,
  minHeight: 42,
};

const divider: React.CSSProperties = {
  height: 1,
  background: '#E6DFD3',
  margin: '20px 0',
  border: 'none',
};

const uiOnlyBadge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  fontSize: 10,
  fontWeight: 600,
  color: '#B07A2A',
  background: 'rgba(176,122,42, 0.08)',
  borderRadius: 100,
  padding: '2px 6px',
  marginLeft: 6,
};

/* ── Toggle switch (inline) ── */
function ToggleSwitch({ checked, onChange, label, size = 'default', disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label?: string; size?: 'default' | 'large'; disabled?: boolean }) {
  const isLarge = size === 'large';
  const trackW = isLarge ? 44 : 36;
  const trackH = isLarge ? 24 : 20;
  const thumbD = isLarge ? 18 : 14;
  const travel = trackW - thumbD - 4; // 4 = 2*padding
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => { if (!disabled) onChange(!checked); }}
        disabled={disabled}
        style={{
          width: trackW, height: trackH, borderRadius: trackH / 2, padding: 2,
          background: checked ? 'var(--green, #5F7A55)' : 'var(--hover, #F4F0E8)',
          border: `1px solid ${checked ? 'var(--green, #5F7A55)' : '#E6DFD3'}`,
          cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
          transition: 'all 0.2s ease', flexShrink: 0,
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <span style={{
          width: thumbD, height: thumbD, borderRadius: '50%',
          background: checked ? '#FFFFFF' : 'var(--t3, #8E95A9)',
          transform: checked ? `translateX(${travel}px)` : 'translateX(0)',
          transition: 'transform 0.2s ease', boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        }} />
      </button>
      {label && (
        <span
          style={{
            fontSize: 13,
            color: 'var(--t1, #453F39)',
            fontWeight: 500,
            fontFamily: 'var(--font-primary)',
            opacity: disabled ? 0.7 : 1,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export default function ModifierFormPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { modifiers, addModifier, updateModifier, createModifierOnServer, updateModifierOnServer, saving, fetchModifiers, editingModifierId, error } = useModifiersStore();
  const { stations } = useKitchenStationsStore();
  const { items, fetchItems } = useItemsStore();
  const { categories } = useCategoriesStore();
  const { addToast } = useToastStore();
  const { auth } = useAuth();
  const { selectedBranch } = useBranch();
  useErrorToast(error, { fallbackMessage: 'Failed to load modifiers' });

  const location = useLocation();
  const isEditRoute = location.pathname === pcPaths.modifierEdit;
  const id = isEditRoute ? editingModifierId : null;

  /* PCF-11: Item assignment — local state tracks selections, sent in payload on save */
  const [assignedItemIds, setAssignedItemIds] = useState<string[]>([]);
  const initialAssignedItemIdsRef = useRef<string[]>([]);
  const hydratedAssignedRef = useRef(false);

  const toggleAssignedItem = useCallback((itemId: string) => {
    setAssignedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId],
    );
  }, []);

  const removeAssignedItem = useCallback((itemId: string) => {
    setAssignedItemIds((prev) => prev.filter((x) => x !== itemId));
  }, []);

  /* All items for picker (with category subtitle) */
  const allItemsForPicker = useMemo(() => {
    const persistedIds = initialAssignedItemIdsRef.current;
    return items.map((item) => {
      const catName = categories.find((c) => item.categoryIds.includes(c.id))?.name ?? '';
      const modifierCount = item.modifierIds?.length ?? 0;
      const alreadyAssignedHere = persistedIds.includes(item.id);
      const atLimit = modifierCount >= MAX_MODIFIERS_PER_ITEM && !alreadyAssignedHere;
      return {
        id: item.id,
        name: item.name,
        subtitle: catName,
        categoryIds: item.categoryIds,
        categorySortPositions: item.categorySortPositions,
        trailing: `$${item.basePrice.toFixed(2)}`,
        disabled: atLimit,
        disabledReason: atLimit ? `${modifierCount}/${MAX_MODIFIERS_PER_ITEM} modifiers` : undefined,
      };
    });
  }, [items, categories]);

  const assignedItemsForPills = useMemo(() => {
    const existing = modifiers.find((m) => m.id === id);
    const apiItems = existing?.assignedItems ?? [];
    return assignedItemIds.map((aid) => {
      const fromStore = items.find((i) => i.id === aid);
      if (fromStore) return { id: fromStore.id, name: fromStore.name };
      const fromApi = apiItems.find((i) => i.id === aid);
      if (fromApi) return { id: fromApi.id, name: fromApi.name };
      return { id: aid, name: 'Item' };
    });
  }, [assignedItemIds, items, modifiers, id]);

  const isMobile = useMediaQuery('(max-width: 768px)');

  // Dynamic order types from the outlet/branch
  const outletOrderTypes = useMemo(() => getOrderTypesForBranch(selectedBranch), [selectedBranch]);

  const isEdit = Boolean(id);
  const existing = isEdit ? modifiers.find((m) => m.id === id) : null;
  const cloneId = !isEdit ? searchParams.get('clone')?.trim() || null : null;
  const cloneSource = useMemo(
    () => (!isEdit && cloneId ? modifiers.find((m) => m.id === cloneId) ?? null : null),
    [isEdit, cloneId, modifiers],
  );
  const isCloneHydrate = Boolean(!isEdit && cloneSource);
  const hydrateKeyRef = useRef('');

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({
      title: isEdit ? 'Edit Modifier' : isCloneHydrate ? 'New Modifier (clone)' : 'New Modifier',
      breadcrumbs: 'Product Catalog > Modifiers',
    });
  }, [setTopBarProps, isEdit, isCloneHydrate]);

  // Fetch modifiers + items if not loaded yet (e.g. direct URL navigation)
  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) return;
    void fetchModifiers(locationId, token, { skipDuplicateMs: 750 });
    void fetchItems(locationId, token, { skipDuplicateMs: 750 });
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token, fetchModifiers, fetchItems]);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [optionDeleteIdx, setOptionDeleteIdx] = useState<number | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [dragOptionId, setDragOptionId] = useState<string | null>(null);
  const [dragOverOptionId, setDragOverOptionId] = useState<string | null>(null);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [editWarningOpen, setEditWarningOpen] = useState(false);
  const skipEditWarningRef = useRef(false);
  const [cloneNameWarningOpen, setCloneNameWarningOpen] = useState(false);
  const skipCloneWarningRef = useRef(false);

  // Initialize defaults for new modifiers: all current outlet order types enabled.
  useEffect(() => {
    if (outletOrderTypes.length === 0 || isEdit) return;
    setForm((prev) => {
      const next = { ...prev.channelVisibility };
      let changed = false;
      outletOrderTypes.forEach((ot) => {
        if (!(ot.id in next)) {
          next[ot.id] = true;
          changed = true;
        }
      });
      if (!changed) return prev;
      return { ...prev, channelVisibility: next };
    });
  }, [outletOrderTypes, isEdit]);

  useEffect(() => {
    if (isEdit) {
      if (!existing || !id) return;
      const key = `edit:${id}`;
      if (hydrateKeyRef.current === key) return;
      hydrateKeyRef.current = key;
      setForm(modifierToFormState(existing, false));
      const channelVisibilityMap: Record<string, boolean> = {};
      if (existing.channelVisibility && existing.channelVisibility.length > 0) {
        existing.channelVisibility.forEach((item) => {
          channelVisibilityMap[item.orderTypeId] = item.enabled;
        });
      } else {
        outletOrderTypes.forEach((ot) => {
          channelVisibilityMap[ot.id] = true;
        });
      }
      setForm((prev) => ({ ...prev, channelVisibility: channelVisibilityMap }));
      // Hydrate assigned items from API response
      const ids = (existing.assignedItems ?? []).map((i) => i.id);
      setAssignedItemIds(ids);
      initialAssignedItemIdsRef.current = [...ids];
      hydratedAssignedRef.current = true;
      return;
    }
    if (cloneId) {
      if (cloneSource) {
        const key = `clone:${cloneId}`;
        if (hydrateKeyRef.current === key) return;
        hydrateKeyRef.current = key;
        setForm(modifierToFormState(cloneSource, true, modifiers.map((m) => m.name)));
        setAssignedItemIds([]);
        initialAssignedItemIdsRef.current = [];
        return;
      }
      if (hydrateKeyRef.current !== 'new') {
        hydrateKeyRef.current = 'new';
        setForm(emptyForm);
        setAssignedItemIds([]);
        initialAssignedItemIdsRef.current = [];
      }
      return;
    }
    if (hydrateKeyRef.current !== 'new') {
      hydrateKeyRef.current = 'new';
      setForm(emptyForm);
      setAssignedItemIds([]);
      initialAssignedItemIdsRef.current = [];
    }
  }, [isEdit, id, existing, cloneId, cloneSource, outletOrderTypes]);

  // Snapshot of form at hydration time — used for dirty detection
  const initialFormRef = useRef<FormState | null>(null);
  useEffect(() => {
    // Reset snapshot whenever the hydrate key changes (new form, edit, or clone)
    initialFormRef.current = null;
  }, [hydrateKeyRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Capture snapshot on first stable render after hydration
  useEffect(() => {
    if (initialFormRef.current === null && (isEdit ? !!existing : true)) {
      initialFormRef.current = form;
    }
  });

  const isDirty = useMemo(() => {
    if (!isEdit) {
      return !!(
        form.name.trim() ||
        form.displayName.trim() ||
        form.options.length > 0 ||
        assignedItemIds.length > 0
      );
    }
    if (!initialFormRef.current) return false;
    const initial = initialFormRef.current;
    return (
      form.name !== initial.name ||
      form.displayName !== initial.displayName ||
      form.type !== initial.type ||
      form.isRequired !== initial.isRequired ||
      form.allowMultiple !== initial.allowMultiple ||
      form.minSelection !== initial.minSelection ||
      form.maxSelection !== initial.maxSelection ||
      JSON.stringify(form.options) !== JSON.stringify(initial.options) ||
      form.kitchenStationId !== initial.kitchenStationId ||
      JSON.stringify(form.channelVisibility) !== JSON.stringify(initial.channelVisibility) ||
      JSON.stringify([...assignedItemIds].sort()) !== JSON.stringify([...initialAssignedItemIdsRef.current].sort())
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existing, form, assignedItemIds]);

  // Active list search term carried over from the Modifiers listing page (?q=).
  // Routing back with it intact keeps the user on their filtered results.
  const listSearchQuery = searchParams.get('q') ?? '';
  const buildModifiersListPath = useCallback(
    (highlightId?: string) => {
      const params = new URLSearchParams();
      if (highlightId) params.set('highlight', highlightId);
      if (listSearchQuery) params.set('q', listSearchQuery);
      const qs = params.toString();
      return qs ? `${pcPaths.modifiers}?${qs}` : pcPaths.modifiers;
    },
    [listSearchQuery],
  );

  const { showDiscardModal, handleCancel, handleConfirmDiscard, handleKeepEditing } = useFormDiscardGuard(isDirty, buildModifiersListPath());

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  /* ── option helpers ── */
  const addOption = () => {
    const opt: ModifierOption = {
      id: `opt-${Date.now()}`,
      name: '',
      isAvailable: true,
      price: undefined,
      kitchenName: '',
      isDefault: false,
      isOnline: true,
    };
    patch('options', [...form.options, opt]);
  };

  const updateOption = (idx: number, updates: Partial<ModifierOption>) => {
    patch('options', form.options.map((o, i) => (i === idx ? { ...o, ...updates } : o)));
  };

  const removeOptionAt = (idx: number) => {
    setForm((prev) => {
      const newOptions = prev.options.filter((_, i) => i !== idx);
      const optionCount = newOptions.length;
      if (optionCount < 2) {
        return { ...prev, options: newOptions, allowMultiple: false, minSelection: 0, maxSelection: 1 };
      }
      const clampedMax = Math.max(2, Math.min(prev.maxSelection, optionCount));
      return { ...prev, options: newOptions, maxSelection: clampedMax };
    });
    setErrors((prev) => { const n = { ...prev }; delete n.options; return n; });
  };

  /** Radio-button behavior: only one option can be default */
  const setDefaultOption = (idx: number) => {
    patch('options', form.options.map((o, i) => ({ ...o, isDefault: i === idx })));
  };

  const clearDefaultOption = () => {
    patch('options', form.options.map((o) => ({ ...o, isDefault: false })));
  };

  const reorderOptions = useCallback((fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    const fromIdx = form.options.findIndex((o) => o.id === fromId);
    const toIdx = form.options.findIndex((o) => o.id === toId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    const next = [...form.options];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    patch('options', next);
  }, [form.options]);

  const isEffectivelyRequired = form.type === 'options_list' && (form.isRequired || form.minSelection >= 1);

  const confirmRemoveOption = () => {
    if (optionDeleteIdx == null) return;
    removeOptionAt(optionDeleteIdx);
    setOptionDeleteIdx(null);
  };

  /* ── Real-time validation (runs on every form change) ── */
  const liveErrors = useMemo(() => {
    const errs: Record<string, string> = {};

    // Name is required. Duplicate names are allowed.
    if (!form.name.trim()) {
      errs.name = 'Modifier name is required';
    }

    if (form.type === 'options_list') {
      // At least one option required
      if (form.options.length === 0) errs.options = 'At least one option is required';

      // Each option must have a name
      form.options.forEach((o, i) => {
        if (!o.name.trim()) errs[`option_${i}`] = 'Option name is required';
      });

      // Check for duplicate option names
      const optNames = form.options.map((o) => o.name.trim().toLowerCase()).filter(Boolean);
      const seen = new Set<string>();
      optNames.forEach((name, i) => {
        if (seen.has(name)) errs[`option_${i}_dup`] = `Duplicate option name "${form.options[i].name.trim()}"`;
        seen.add(name);
      });

      // Selection rules validation — always run live
      if (form.allowMultiple) {
        if (form.minSelection < 0) errs.minSelection = 'Min selection cannot be negative';
        if (isEffectivelyRequired && form.minSelection < 1) {
          errs.minSelection = 'Min selection must be at least 1 when required';
        }
        if (form.maxSelection < 2) errs.maxSelection = 'Max selection must be at least 2 when multiple is enabled';
        if (form.minSelection > form.maxSelection) errs.minSelection = 'Min cannot exceed max selection';
        if (form.maxSelection > form.options.length && form.options.length > 0) {
          errs.maxSelection = `Max selection cannot exceed number of options (${form.options.length})`;
        }
      }

      form.options.forEach((o, i) => {
        if (o.price == null) return;
        if (!Number.isFinite(o.price)) errs[`option_${i}_price`] = 'Enter a valid price';
      });

      if ((form.isRequired || form.minSelection >= 1) && form.options.length > 0) {
        const allOos = form.options.every((o) => !o.isAvailable);
        if (allOos) errs.allOos = 'A Required modifier set cannot have all options Out of Stock';
      }
    }

    if (form.type === 'text_field') {
      if (form.charLimit !== '' && Number(form.charLimit) < 0) errs.charLimit = 'Character limit cannot be negative';
    }

    return errs;
  }, [form, isEffectivelyRequired]);

  // Update displayed errors in real-time
  useEffect(() => {
    setErrors(liveErrors);
  }, [liveErrors]);

  const isFormValid = Object.keys(liveErrors).length === 0;
  const isSubmitDisabled = !isFormValid || saving || submitLocked;
  const saveIdleLabel = isEdit ? 'Update' : 'Create';
  const saveLoadingLabel = isEdit ? 'Updating' : 'Creating';

  /* ── Build API payload (only fields the API supports) ── */
  const buildPayload = (): CreateModifierPayload => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const channelVisibilityPayload = outletOrderTypes.map((ot) => ({
      orderTypeId: ot.id,
      enabled: form.channelVisibility[ot.id] ?? true,
    }));
    return {
      name: form.name.trim(),
      displayName: form.displayName.trim() || form.name.trim(),
      locationId,
      modifierOption: form.options.map((opt, idx) => ({
        modifierOption_id: opt.id.startsWith('opt-') ? '' : opt.id,
        name: opt.name.trim(),
        kitchenName: opt.kitchenName ?? '',
        price: Number.isFinite(Number(opt.price)) ? Number(opt.price) : 0,
        isDefault: opt.isDefault ? 1 : 0,
        isVisible: opt.isOnline !== false ? 1 : 0,  // eye icon = isVisible
        enable: opt.isAvailable ? 1 : 0,             // toggle = enable
        sortOrder: idx + 1,                           // starts from 1
      })),
      behaviorOptions: {
        maximumSelection: form.type === 'options_list'
          ? (form.allowMultiple ? form.maxSelection : 1)
          : 1,
        minimumSelection: form.type === 'options_list'
          ? (isEffectivelyRequired ? Math.max(form.minSelection, 1) : form.minSelection)
          : 0,
        isRequired: isEffectivelyRequired,
      },
      channelVisibility: channelVisibilityPayload,
      assignedItems: assignedItemIds,
    };
  };

  const handleSave = async () => {
    // Mark all fields as touched
    setTouched({ name: true, displayName: true, options: true });
    if (!isFormValid) {
      addToast('Please fix the errors before saving', 'error');
      return;
    }

    if (isEdit && assignedItemIds.length > 0 && !skipEditWarningRef.current) {
      setEditWarningOpen(true);
      return;
    }
    skipEditWarningRef.current = false;
    setEditWarningOpen(false);

    if (!isEdit && isCloneHydrate && /\(Copy.*?\)/.test(form.name) && !skipCloneWarningRef.current) {
      setCloneNameWarningOpen(true);
      return;
    }
    skipCloneWarningRef.current = false;
    setCloneNameWarningOpen(false);

    setSubmitLocked(true);

    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;

    // If we have a locationId, use the real API
    if (locationId) {
      try {
        if (isEdit && id) {
          // Find deleted options (options that existed in the original but are now removed)
          const originalOptionIds = existing?.options.map((o) => o.id).filter((oid) => !oid.startsWith('opt-')) ?? [];
          const currentOptionIds = form.options.map((o) => o.id).filter((oid) => !oid.startsWith('opt-'));
          const deletedOptionIds = originalOptionIds.filter((oid) => !currentOptionIds.includes(oid));
          // Compute item assignment diff
          const initialItemIds = initialAssignedItemIdsRef.current;
          const addedItemIds = assignedItemIds.filter((iid) => !initialItemIds.includes(iid));
          const removedItemIds = initialItemIds.filter((iid) => !assignedItemIds.includes(iid));

          const deleteFields: Record<string, string[]> = {};
          if (deletedOptionIds.length > 0) deleteFields.modifierOption = deletedOptionIds;
          if (removedItemIds.length > 0) deleteFields.assignedItems = removedItemIds;

          const payload: UpdateModifierPayload = {
            ...buildPayload(),
            modifierId: id,
            assignedItems: addedItemIds,
            ...(Object.keys(deleteFields).length > 0 ? { deleteFields } : {}),
          };
          await updateModifierOnServer(payload, token);
          addToast('Modifier updated successfully', 'success');
          navigate(buildModifiersListPath(id));
          return;
        }
        const payload = buildPayload();
        const createResp = await createModifierOnServer(payload, token);
        const newId = pickHighlightIdFromApiResponse(createResp);
        addToast('Modifier created successfully', 'success');
        navigate(buildModifiersListPath(newId));
        return;
      } catch (e) {
        setSubmitLocked(false);
        addToast(e instanceof Error ? e.message : 'Failed to save modifier', 'error');
      }
    } else {
      // Fallback: local-only (no API)
      const localPayload = {
        name: form.name.trim(),
        displayName: form.displayName.trim() || form.name.trim(),
        type: form.type,
        isRequired: isEffectivelyRequired,
        allowMultiple: form.type === 'options_list' ? form.allowMultiple : false,
        minSelection: form.type === 'options_list'
          ? (isEffectivelyRequired ? Math.max(form.minSelection, 1) : form.minSelection)
          : 0,
        maxSelection: form.type === 'options_list' ? form.maxSelection : 1,
        options: form.type === 'options_list' ? form.options : [],
      };
      if (isEdit && id) {
        updateModifier(id, localPayload);
        addToast('Modifier updated successfully', 'success');
      } else {
        addModifier(localPayload);
        // For local-only, pending items can't be easily applied without a real ID
        addToast('Modifier created successfully', 'success');
      }
      navigate(buildModifiersListPath());
    }
  };

  const stationOptions = [
    { value: '', label: 'None' },
    ...stations.map((s) => ({ value: s.id, label: s.name })),
  ];

  const Wrapper = isMobile ? ({ children }: { children: ReactNode }) => <>{children}</> : DesktopLayout;

  if (isEditRoute && !editingModifierId) {
    return <Navigate to={pcPaths.modifiers} replace />;
  }

  return (
    <Wrapper>
      {isMobile && (
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span onClick={handleCancel} className="material-symbols-rounded" style={{ fontSize: 22, color: '#453F39', cursor: 'pointer' }}>arrow_back</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: 0 }}>{isEdit ? 'Edit Modifier' : 'New Modifier'}</h1>
        </div>
      )}
      <div style={isMobile ? { background: '#FFFFFF', minHeight: '100vh', display: 'flex', flexDirection: 'column' as const } : formPageOuterStyle}>
        <div style={isMobile ? { flex: 1, overflowY: 'auto' as const, paddingBottom: 80 } : formPageMainScrollStyle}>
          <div style={{ padding: isMobile ? '12px 16px 24px' : 25, paddingBottom: 24 }}>
            <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
          {/* ── Section 1: Identity ── */}
          <p style={sectionTitle}>IDENTITY</p>

          {/* Set Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              Display Name <span style={{ color: 'var(--accent, #B89550)' }}>*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => { if (e.target.value.length <= 128) patch('name', e.target.value); }}
              onBlur={() => markTouched('name')}
              placeholder="e.g. Choice"
              style={{ ...inputBase, borderColor: (errors.name && touched.name) ? inputErrorBorder : '#E6DFD3' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {errors.name && touched.name
                ? <span style={errorTextStyle}>{errors.name}</span>
                : <span style={{ ...fieldHintStyle, margin: 0 }}>This name is shown to customers.</span>}
              <span style={{ fontSize: 11, color: form.name.length > 118 ? '#B07A2A' : '#9A9084' }}>{form.name.length}/128</span>
            </div>
          </div>

          {/* Reference Name (functionally the display name) */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Reference Name</label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => { if (e.target.value.length <= 128) patch('displayName', e.target.value); }}
              onBlur={() => markTouched('displayName')}
              placeholder="Used for internal reference"
              style={{ ...inputBase, borderColor: (errors.displayName && touched.displayName) ? inputErrorBorder : '#E6DFD3' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {errors.displayName && touched.displayName
                ? <span style={errorTextStyle}>{errors.displayName}</span>
                : <span style={{ ...fieldHintStyle, margin: 0 }}>Defaults to Display Name when left empty.</span>}
              <span style={{ fontSize: 11, color: form.displayName.length > 118 ? '#B07A2A' : '#9A9084' }}>{form.displayName.length}/128</span>
            </div>
          </div>

          {/* ── Section 2: Options ── */}
          <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <p style={{ ...sectionTitle, margin: 0 }}>OPTIONS</p>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--accent, #B89550)',
                  background: 'rgba(184,149,80,0.08)', borderRadius: 2,
                  padding: '2px 8px', lineHeight: '18px',
                }}>
                  {form.options.length}
                </span>
              </div>

              {errors.options && (
                <p style={{ ...errorTextStyle, margin: '0 0 12px', fontWeight: 500 }}>{errors.options}</p>
              )}
              {errors.allOos && (
                <p style={{ ...errorTextStyle, margin: '0 0 12px', fontWeight: 500 }}>{errors.allOos}</p>
              )}

              {/* Column headers (desktop only) */}
              {!isMobile && form.options.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '0 0 8px',
                  borderBottom: '1px solid var(--card-border, #E6DFD3)',
                }}>
                  {/* Drag spacer */}
                  <div style={{ width: 22, flexShrink: 0 }} />
                  {/* Name header */}
                  <div style={{ ...colHeaderStyle, flex: 2 }}>Name <span style={{ color: 'var(--accent, #B89550)' }}>*</span></div>
                  {/* Kitchen Name header — commented out */}
                  {/* <div style={{ ...colHeaderStyle, flex: 2 }}>Kitchen Name</div> */}
                  {/* Price header */}
                  <div style={{ ...colHeaderStyle, flex: 1, minWidth: 90 }}>Price ($)</div>
                  {/* Default header */}
                  <div style={{ ...colHeaderStyle, width: 56, textAlign: 'center' as const }}>Default</div>
                  {/* Visible header */}
                  <div style={{ ...colHeaderStyle, width: 48, textAlign: 'center' as const }}>Visible</div>
                  {/* Stock header */}
                  <div style={{ ...colHeaderStyle, width: 44, textAlign: 'center' as const }}>Stock</div>
                  {/* Delete header */}
                  <div style={{ ...colHeaderStyle, width: 40, textAlign: 'center' as const }}>Delete</div>
                </div>
              )}

              {/* Option rows */}
              {form.options.map((opt, idx) => {
                const optNameErr = errors[`option_${idx}`];
                const optDupErr = errors[`option_${idx}_dup`];
                const optPriceErr = errors[`option_${idx}_price`];
                const optErr = optNameErr || optDupErr;
                const isEnabled = opt.isOnline !== false;

                return (
                  <div
                    key={opt.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverOptionId !== opt.id) setDragOverOptionId(opt.id);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragOptionId) reorderOptions(dragOptionId, opt.id);
                      setDragOptionId(null);
                      setDragOverOptionId(null);
                    }}
                    style={{
                      borderRadius: 2,
                      background: dragOverOptionId === opt.id ? 'rgba(184,149,80,0.06)' : 'transparent',
                      transition: 'background 0.12s ease',
                    }}
                  >
                    {/* MOBILE layout */}
                    {isMobile ? (
                      <div style={{ padding: '12px 0', borderBottom: idx < form.options.length - 1 ? '1px solid #F4F0E8' : undefined, opacity: isEnabled ? 1 : 0.5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span
                            className="material-symbols-rounded"
                            draggable
                            onDragStart={(e) => {
                              setDragOptionId(opt.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => {
                              setDragOptionId(null);
                              setDragOverOptionId(null);
                            }}
                            style={{ fontSize: 18, color: '#D6CCBB', cursor: 'grab', flexShrink: 0 }}
                          >
                            drag_indicator
                          </span>
                          {/* Enable eye */}
                          <button type="button" onClick={() => updateOption(idx, { isOnline: !isEnabled })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0, flexShrink: 0 }}>
                            <span className="material-symbols-rounded" style={{ fontSize: 22, color: isEnabled ? 'var(--green, #5F7A55)' : 'var(--t3, #9A9084)' }}>
                              {isEnabled ? 'visibility' : 'visibility_off'}
                            </span>
                          </button>
                          <input type="text" value={opt.name} onChange={(e) => updateOption(idx, { name: e.target.value })} placeholder="Name" maxLength={30} style={{ ...optRowInput, flex: 1, borderColor: optErr ? inputErrorBorder : '#E6DFD3' }} />
                          {/* Delete */}
                          <button type="button" onClick={() => setOptionDeleteIdx(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0, flexShrink: 0 }}>
                            <span className="material-symbols-rounded" style={{ fontSize: 22, color: 'var(--red, #A63D2F)' }}>close</span>
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 30 }}>
                          {/* Kitchen Name — commented out */}
                          {/* <input type="text" value={opt.kitchenName ?? ''} onChange={(e) => updateOption(idx, { kitchenName: e.target.value })} placeholder="Kitchen Name" maxLength={30} style={{ ...optRowInput, flex: 2 }} /> */}
                          <div style={{ position: 'relative', flex: 1, minWidth: 70 }}>
                            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9A9084' }}>$</span>
                            <input type="number" value={opt.price ?? ''} onChange={(e) => { const raw = e.target.value; if (raw === '') { updateOption(idx, { price: undefined }); return; } if (!/^\d{0,4}(\.\d{0,2})?$/.test(raw)) return; updateOption(idx, { price: Number(raw) }); }} placeholder="0.00" step="0.01" min="0" max="9999.99" style={{ ...optRowInput, paddingLeft: 24, fontFamily: 'var(--font-mono, SF Mono, monospace)', borderColor: optPriceErr ? inputErrorBorder : '#E6DFD3' }} />
                          </div>
                          {/* Default (radio look, but can be cleared by clicking again) */}
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
                            <input
                              type="radio"
                              name="defaultOption"
                              checked={opt.isDefault ?? false}
                              onClick={(e) => {
                                if (opt.isDefault) {
                                  e.preventDefault(); // allow "unselect" behavior
                                  clearDefaultOption();
                                }
                              }}
                              onChange={() => setDefaultOption(idx)}
                              style={{ accentColor: 'var(--accent)', width: 18, height: 18, cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: 11, color: '#9A9084' }}>Default</span>
                          </label>
                          {/* Stock toggle */}
                          <ToggleSwitch checked={opt.isAvailable} onChange={(v) => updateOption(idx, { isAvailable: v })} />
                        </div>
                        {optErr && <span style={{ ...errorTextStyle, display: 'block', paddingLeft: 30, marginTop: 4 }}>{optErr}</span>}
                        {optPriceErr && <span style={{ ...errorTextStyle, display: 'block', paddingLeft: 30, marginTop: 2 }}>{optPriceErr}</span>}
                      </div>
                    ) : (
                      /* DESKTOP layout — single row matching column headers */
                      <>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          minHeight: 48, padding: '6px 0',
                          borderBottom: idx < form.options.length - 1 ? '1px solid #F4F0E8' : undefined,
                          opacity: isEnabled ? 1 : 0.5,
                          transition: 'opacity 0.15s ease',
                        }}>
                          {/* Drag handle */}
                          <span
                            className="material-symbols-rounded"
                            draggable
                            onDragStart={(e) => {
                              setDragOptionId(opt.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => {
                              setDragOptionId(null);
                              setDragOverOptionId(null);
                            }}
                            style={{ fontSize: 18, color: '#D6CCBB', cursor: 'grab', flexShrink: 0, width: 22, textAlign: 'center' as const }}
                          >
                            drag_indicator
                          </span>

                          {/* Name */}
                          <input type="text" value={opt.name} onChange={(e) => updateOption(idx, { name: e.target.value })} placeholder="Option name" maxLength={30} style={{ ...optRowInput, flex: 2, borderColor: optErr ? inputErrorBorder : '#E6DFD3' }} />

                          {/* Kitchen Name — commented out */}
                          {/* <input type="text" value={opt.kitchenName ?? ''} onChange={(e) => updateOption(idx, { kitchenName: e.target.value })} placeholder="Kitchen name" maxLength={30} style={{ ...optRowInput, flex: 2 }} /> */}

                          <div style={{ position: 'relative', flex: 1, minWidth: 90 }}>
                            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9A9084' }}>$</span>
                            <input type="number" value={opt.price ?? ''} onChange={(e) => { const raw = e.target.value; if (raw === '') { updateOption(idx, { price: undefined }); return; } if (!/^\d{0,4}(\.\d{0,2})?$/.test(raw)) return; updateOption(idx, { price: Number(raw) }); }} placeholder="0.00" step="0.01" min="0" max="9999.99" style={{ ...optRowInput, paddingLeft: 24, fontFamily: 'var(--font-mono, SF Mono, monospace)', borderColor: optPriceErr ? inputErrorBorder : '#E6DFD3' }} />
                          </div>

                          {/* Default (radio look, but can be cleared by clicking again) */}
                          <div style={{ width: 56, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                            <input
                              type="radio"
                              name="defaultOption"
                              checked={opt.isDefault ?? false}
                              onClick={(e) => {
                                if (opt.isDefault) {
                                  e.preventDefault(); // allow "unselect" behavior
                                  clearDefaultOption();
                                }
                              }}
                              onChange={() => setDefaultOption(idx)}
                              style={{ accentColor: 'var(--accent)', width: 18, height: 18, cursor: 'pointer', margin: 0 }}
                            />
                          </div>

                          {/* Online / eye icon */}
                          <div style={{ width: 48, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                            <button type="button" onClick={() => updateOption(idx, { isOnline: !isEnabled })} title={isEnabled ? 'Visible online' : 'Hidden online'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0, borderRadius: 4, margin: 0 }}>
                              <span className="material-symbols-rounded" style={{ fontSize: 22, color: isEnabled ? 'var(--green, #5F7A55)' : 'var(--t3, #9A9084)' }}>
                                {isEnabled ? 'visibility' : 'visibility_off'}
                              </span>
                            </button>
                          </div>

                          {/* Stock / Available toggle */}
                          <div style={{ width: 44, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                            <ToggleSwitch
                              checked={opt.isAvailable}
                              onChange={(v) => updateOption(idx, { isAvailable: v })}
                            />
                          </div>

                          {/* Delete */}
                          <div style={{ width: 40, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                            <button type="button" onClick={() => setOptionDeleteIdx(idx)} title="Delete option" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0 }}>
                              <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--red, #A63D2F)' }}>close</span>
                            </button>
                          </div>
                        </div>
                        {/* Inline errors */}
                        {optErr && <span style={{ ...errorTextStyle, display: 'block', paddingLeft: 32, marginBottom: 2 }}>{optErr}</span>}
                        {optPriceErr && <span style={{ ...errorTextStyle, display: 'block', paddingLeft: 32, marginBottom: 2 }}>{optPriceErr}</span>}
                      </>
                    )}
                  </div>
                );
              })}

              {/* Add Option button — M2: capped at 128 options */}
              {form.options.length >= MAX_OPTIONS_PER_MODIFIER ? (
                <div style={{
                  width: '100%', minHeight: 40, marginTop: 12,
                  border: '1.5px dashed var(--card-border, #E6DFD3)', borderRadius: 2,
                  background: 'var(--hover, #F4F0E8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontSize: 12, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)',
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 16 }}>block</span>
                  Max 128 options reached
                </div>
              ) : (
                <button
                  type="button"
                  onClick={addOption}
                  style={{
                    width: '100%', minHeight: 48, marginTop: 12,
                    border: '1.5px dashed var(--accent, #B89550)', borderRadius: 2,
                    background: 'transparent', cursor: 'pointer',
                    color: 'var(--accent, #B89550)', fontSize: 13, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add</span>
                  Add Option
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--t3, #9A9084)', marginLeft: 4 }}>
                    ({form.options.length}/128)
                  </span>
                </button>
              )}

              {/* Selection Rules */}
              <div style={{ marginTop: 20 }}>
                <p style={{ ...sectionTitle, fontSize: 12 }}>SELECTION RULES</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <ToggleSwitch
                    checked={form.isRequired}
                    onChange={(v) => {
                      patch('isRequired', v);
                      if (v) {
                        if (form.minSelection < 1) patch('minSelection', 1);
                      } else {
                        if (form.minSelection >= 1) patch('minSelection', 0);
                      }
                    }}
                    label="Required"
                  />
                  <ToggleSwitch
                    checked={form.allowMultiple}
                    onChange={(v) => {
                      if (!v) {
                        // B4: reset min/max when multi-select is turned off
                        setForm((prev) => ({
                          ...prev,
                          allowMultiple: false,
                          minSelection: 0,
                          maxSelection: 1,
                        }));
                      } else {
                        setForm((prev) => ({
                          ...prev,
                          allowMultiple: true,
                          maxSelection: Math.max(2, Math.min(prev.maxSelection, prev.options.length)),
                        }));
                      }
                    }}
                    label="Allow Multiple"
                    disabled={form.options.length < 2}
                  />
                  {form.allowMultiple && (
                    <div style={{ display: 'flex', gap: 16, paddingLeft: 44 }}>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Min</label>
                        <input
                          type="number"
                          value={form.minSelection}
                          onChange={(e) => {
                            const parsed = Number(e.target.value);
                            const minAllowed = isEffectivelyRequired ? 1 : 0;
                            const next = Number.isFinite(parsed) ? Math.max(parsed, minAllowed) : minAllowed;
                            patch('minSelection', next);
                            if (next >= 1 && !form.isRequired) patch('isRequired', true);
                          }}
                          min={isEffectivelyRequired ? 1 : 0}
                          style={{ ...inputBase, borderColor: errors.minSelection ? inputErrorBorder : '#E6DFD3' }}
                        />
                        {errors.minSelection && <span style={errorTextStyle}>{errors.minSelection}</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Max</label>
                        <input
                          type="number"
                          value={form.maxSelection}
                          onChange={(e) => patch('maxSelection', Number(e.target.value) || 2)}
                          min={2}
                          style={{ ...inputBase, borderColor: errors.maxSelection ? inputErrorBorder : '#E6DFD3' }}
                        />
                        {errors.maxSelection && <span style={errorTextStyle}>{errors.maxSelection}</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <hr style={divider} />
          </>



          {/* ── Section 3: Settings ── */}
          {/* <p style={sectionTitle}>SETTINGS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 8 }}>
            <div>
              <Select
                label="Kitchen Station"
                value={form.kitchenStationId}
                onChange={(v) => patch('kitchenStationId', v)}
                options={stationOptions}
                placeholder="None"
              />
              <span style={{ ...uiOnlyBadge, marginTop: 4, marginLeft: 0 }} title="Kitchen Station is not sent to the server API">
                <span className="material-symbols-rounded" style={{ fontSize: 10 }}>info</span>
                UI only
              </span>
            </div>
          </div>

          <hr style={divider} /> */}

          {/* ── Section 4: Channel Visibility (dynamic from outlet) ── */}
          <p style={sectionTitle}>CHANNEL VISIBILITY</p>
          {outletOrderTypes.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--t3, #9A9084)', fontStyle: 'italic' }}>
              No order types configured for this outlet.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
              {outletOrderTypes.map((ot) => (
                <div key={ot.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ToggleSwitch
                    checked={form.channelVisibility[ot.id] ?? true}
                    onChange={(v) =>
                      patch('channelVisibility', { ...form.channelVisibility, [ot.id]: v })
                    }
                  />
                  <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--t2, #6E665D)' }}>
                    {getChannelIcon(ot.typeGroup)}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--t1, #453F39)', fontWeight: 500 }}>
                    {getChannelDisplayName(ot.typeName)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* PCF-11: Applied To / Item Assignment section */}
          <hr style={divider} />
          <ItemAssignmentSection
            items={allItemsForPicker}
            categories={categories}
            selectedIds={assignedItemIds}
            selectedItems={assignedItemsForPills}
            onToggle={toggleAssignedItem}
            onRemove={removeAssignedItem}
            defaultOpen={false}
            emptyLabel="No items using this modifier yet."
            persistedSelectedIds={initialAssignedItemIdsRef.current}
            hideSubtitle
          />

            </div>
          </div>
        </div>

        <div style={isMobile ? { ...formStickyActionBarFooterStyle, position: 'fixed' as const, bottom: 0, left: 0, right: 0, zIndex: 100, padding: 16 } : formStickyActionBarFooterStyle}>
          <button type="button" style={formCancelButtonStyle} onClick={handleCancel}>
            Cancel
          </button>
          <button
            type="button"
            style={{
              ...formSaveButtonStyle,
              fontSize: isMobile ? 14 : undefined,
              padding: isMobile ? '10px 20px' : undefined,
              minWidth: isMobile ? 120 : 132,
              opacity: isSubmitDisabled ? 0.5 : 1,
              cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSave}
            disabled={isSubmitDisabled}
          >
            {(saving || submitLocked) ? saveLoadingLabel : saveIdleLabel}
          </button>
        </div>
      </div>

      <DeleteConfirmationModal
        open={optionDeleteIdx !== null}
        onClose={() => setOptionDeleteIdx(null)}
        onConfirm={confirmRemoveOption}
        title={
          optionDeleteIdx != null && form.options[optionDeleteIdx]?.name.trim()
            ? deleteConfirmTitle(form.options[optionDeleteIdx].name.trim(), 'Remove')
            : deleteConfirmTitle('this option', 'Remove')
        }
        description="This option will be removed from the modifier. This cannot be undone."
        confirmLabel="Remove"
      />

      {/* M3: Edit warning — changes apply to all assigned items */}
      <DeleteConfirmationModal
        open={editWarningOpen}
        onClose={() => setEditWarningOpen(false)}
        onConfirm={() => {
          skipEditWarningRef.current = true;
          setEditWarningOpen(false);
          void handleSave();
        }}
        title="Apply Changes to All Items?"
        description={`This modifier is applied to ${assignedItemIds.length} item${assignedItemIds.length !== 1 ? 's' : ''}. Your changes will apply to all of them.`}
        confirmLabel="Save Changes"
      />

      {/* U3: Clone rename warning — shown when saving a copy without renaming */}
      <DeleteConfirmationModal
        open={cloneNameWarningOpen}
        onClose={() => setCloneNameWarningOpen(false)}
        onConfirm={() => {
          skipCloneWarningRef.current = true;
          setCloneNameWarningOpen(false);
          void handleSave();
        }}
        title="Rename Before Saving?"
        description={`The modifier name still contains "(Copy)". It's recommended to rename it to avoid confusion. Save anyway?`}
        confirmLabel="Save Anyway"
      />
      <DiscardChangesModal open={showDiscardModal} onKeepEditing={handleKeepEditing} onConfirm={handleConfirmDiscard} />
    </Wrapper>
  );
}
