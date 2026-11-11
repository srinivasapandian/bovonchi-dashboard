import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useCategoriesStore, useItemsStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import { useErrorToast } from '../../hooks/useErrorToast';
import type { ModuleListItem, CreateCategoryPayload, UpdateCategoryPayload } from '../../../../services/categoryCatalogApi';
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
import Select from '../../components/forms/Select';
import { Toggle } from '../../components/ui/Toggle';
import { ItemAssignmentSection } from '../../components/ui/ItemAssignmentSection';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useFormDiscardGuard } from '../../hooks/useFormDiscardGuard';
import { DiscardChangesModal } from '../../components/ui/DiscardChangesModal';
import type { Category } from '../../data/types';

const CATEGORY_NAME_MAX = 60;
const CATEGORY_DESCRIPTION_MAX = 100;

/* ── Dynamic order types from outlet (same pattern as ModifierFormPage) ── */

/** Child categories cannot expose a channel unless the parent allows it (visible + channel on). */
function isParentChannelAllowedForOrderType(parent: Category, orderTypeId: string): boolean {
  if (!parent.isVisible) return false;
  const row = (parent.channelVisibility ?? []).find((r) => r.orderTypeId === orderTypeId);
  return row?.enabled === true;
}

interface OutletOrderType {
  id: string;
  typeName: string;
  typeGroup?: string;
  isEnabled?: number | boolean;
  locationId?: string;
}

function getChannelDisplayName(typeName: string): string {
  const n = (typeName ?? '').toLowerCase();
  if (n.includes('dining') || n.includes('dinein') || n.includes('dine-in') || n.includes('walk-in') || n.includes('walkin')) return 'Dine-in';
  if (!typeName) return '';
  return typeName.charAt(0).toUpperCase() + typeName.slice(1).toLowerCase();
}

function getOrderTypesForBranch(selectedBranch: Record<string, any> | null | undefined): OutletOrderType[] {
  if (!selectedBranch) return [];
  const raw: any[] = selectedBranch.orderTypes ?? [];
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.filter((ot: any) => {
    // Include disabled (isEnabled: 0) order types too; still exclude in-store.
    const notInstore = (ot?.typeGroup ?? 'T') !== 'I';
    return notInstore;
  });
}

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

/* ─── styles ─── */

const S = {
  center: {
    padding: '12px 24px 24px',
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
  dropZone: {
    border: '2px dashed var(--card-border, #E6DFD3)',
    borderRadius: 2,
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
    transition: 'border-color 0.15s ease, background 0.15s ease',
    background: 'var(--hover, #F7F4EC)',
  } as React.CSSProperties,
  infoBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '12px 14px',
    borderRadius: 2,
    background: 'var(--accent-soft, rgba(184,149,80,0.05))',
    border: '1px solid var(--accent-soft, rgba(184,149,80,0.15))',
    marginTop: 12,
  } as React.CSSProperties,
  orderTypeGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  } as React.CSSProperties,
};

export default function CategoryFormPage() {
  const navigate = useNavigate();
  const {
    categories,
    fetchCategories,
    clearCategoriesCache,
    fetchModuleListOnServer,
    createCategoryOnServer,
    updateCategoryOnServer,
    editingCategoryId,
    setEditingCategoryId,
    saving: storeSaving,
    error,
  } = useCategoriesStore();
  const location = useLocation();
  const isEditRoute = location.pathname === pcPaths.categoryEdit;
  const id = isEditRoute ? editingCategoryId : null;
  const { addToast } = useToastStore();
  const { items: storeItems, loading: itemsLoading, clearItemsCache, fetchItems } = useItemsStore();
  const { auth } = useAuth();
  const { selectedBranch } = useBranch();
  useErrorToast(error, { fallbackMessage: 'Failed to load categories' });

  const isMobile = useMediaQuery('(max-width: 768px)');
  const isEdit = Boolean(id) && id !== 'new';
  const existing = isEdit ? categories.find((c) => c.id === id) : null;
  const isParentCategory = isEdit && id ? categories.some((c) => c.parentCategoryId === id) : false;
  const hydrateKeyRef = useRef('');
  const initialAssignedItemIdsRef = useRef<string[]>([]);
  const initialChannelVisibilityRef = useRef<Record<string, boolean>>({});

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({ title: isEdit ? 'Edit Category' : 'New Category', breadcrumbs: 'Product Catalog > Categories' });
  }, [setTopBarProps, isEdit]);

  // Derive auth token and locationId
  const token = (auth as any)?.accessToken ?? (auth as any)?.access_token ?? null;
  const locationId = selectedBranch?.id ?? (selectedBranch as any)?.locationId ?? '';

  // Get dynamic order types from branch
  const outletOrderTypes = useMemo(() => getOrderTypesForBranch(selectedBranch), [selectedBranch]);

  const moduleItems = useMemo(() => {
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    return [...storeItems]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))
      .map((i) => {
        const catName = (i.categoryIds ?? [])
          .map((cid) => catMap.get(cid))
          .filter(Boolean)
          .join(', ');
        const subtitleParts: string[] = [];
        if (i.itemCode) subtitleParts.push(i.itemCode);
        if (catName) subtitleParts.push(catName);
        return {
          id: i.id,
          name: i.name,
          subtitle: subtitleParts.length > 0 ? subtitleParts.join(' · ') : undefined,
          categoryIds: i.categoryIds ?? [],
          categorySortPositions: i.categorySortPositions,
          trailing: `$${i.basePrice.toFixed(2)}`,
        };
      });
  }, [storeItems, categories]);

  // --- Module API: Parent Categories ---
  const [rawModuleCategories, setRawModuleCategories] = useState<Array<{ id: string; name: string }>>([]);
  const categoriesFetchedRef = useRef('');

  const fetchModuleCategories = useCallback(async () => {
    if (!locationId || categoriesFetchedRef.current === locationId) return;
    categoriesFetchedRef.current = locationId;
    try {
      const raw = await fetchModuleListOnServer('CATEGORY', { location_id: locationId }, token);
      const mapped = raw.map((cat: ModuleListItem) => ({
        id: String(cat.id || cat.category_id || cat.categoryId || ''),
        name: String(cat.name || cat.categoryName || ''),
      })).filter((c) => c.id);
      // Sort alphabetically by name (matching old portal)
      mapped.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
      setRawModuleCategories(mapped);
    } catch {
      // silent — parent categories will be empty
    }
  }, [locationId, token]);

  // Merge item counts from store categories (get-categories API has items[] arrays)
  const moduleCategories = useMemo(() => {
    return rawModuleCategories.map((mc) => {
      const storeCat = categories.find((c) => c.id === mc.id);
      return { ...mc, itemCount: storeCat?.itemCount ?? 0 };
    });
  }, [rawModuleCategories, categories]);

  // Fetch categories (for store), module items, and module categories on mount
  useEffect(() => {
    if (locationId) {
      fetchCategories(locationId, token);
      fetchModuleCategories();
      fetchItems(locationId, token, { skipDuplicateMs: 60_000 });
    }
  }, [locationId, token, fetchCategories, fetchModuleCategories, fetchItems]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const [channelVisibility, setChannelVisibility] = useState<Record<string, boolean>>({});
  const [assignedItemIds, setAssignedItemIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pendingParentId, setPendingParentId] = useState<string | null>(null);
  const [showParentChangeModal, setShowParentChangeModal] = useState(false);
  const [pendingChannelOff, setPendingChannelOff] = useState<{ orderTypeId: string; channelName: string; affectedSubs: string[] } | null>(null);
  const saveIdleLabel = isEdit ? 'Update' : 'Create';
  const saveLoadingLabel = isEdit ? 'Updating' : 'Creating';
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Initialize channel visibility defaults when order types are available
  useEffect(() => {
    if (outletOrderTypes.length > 0 && Object.keys(channelVisibility).length === 0 && !isEdit) {
      const defaults: Record<string, boolean> = {};
      outletOrderTypes.forEach((ot) => {
        defaults[ot.id] = true; // Default all to enabled
      });
      setChannelVisibility(defaults);
    }
  }, [outletOrderTypes, channelVisibility, isEdit]);

  const isDirty = useMemo(() => {
    if (!isEdit) {
      const visibilityChanged = Object.values(channelVisibility).some((v) => !v);
      return !!(name.trim() || description.trim() || parentCategoryId || assignedItemIds.length || imageFile || visibilityChanged);
    }
    if (!existing) return false;
    const initialCv = initialChannelVisibilityRef.current;
    const cvChanged = Object.keys(channelVisibility).some((k) => channelVisibility[k] !== initialCv[k]);
    return (
      name !== (existing.name ?? '') ||
      description !== (existing.description ?? '') ||
      parentCategoryId !== (existing.parentCategoryId ?? '') ||
      JSON.stringify([...assignedItemIds].sort()) !== JSON.stringify([...initialAssignedItemIdsRef.current].sort()) ||
      imageFile !== null ||
      cvChanged
    );
  }, [isEdit, existing, name, description, parentCategoryId, assignedItemIds, imageFile, channelVisibility]);

  const { showDiscardModal, handleCancel, handleConfirmDiscard, handleKeepEditing } =
    useFormDiscardGuard(isDirty, pcPaths.categories);

  const isFormValid = useMemo(() => {
    const trimmedName = name.trim();
    return (
      trimmedName.length > 0 &&
      trimmedName.length <= CATEGORY_NAME_MAX &&
      /[A-Za-z0-9]/.test(trimmedName) &&
      description.trim().length <= CATEGORY_DESCRIPTION_MAX
    );
  }, [name, description]);

  // Parent categories from module API, excluding self.
  const parentOptions = useMemo(() => {
    return [
      { value: '', label: 'None (top-level)' },
      ...moduleCategories
        .filter((c) => c.id !== id)
        .filter((c) => !categories.find((sc) => sc.id === c.id)?.parentCategoryId)
        .map((c) => ({ value: c.id, label: c.name })),
    ];
  }, [moduleCategories, id, categories]);

  const getParentCategoryItemCount = useCallback((parentId: string): number => {
    if (!parentId) return 0;
    const liveMappedCount = storeItems.filter((item) => (item.categoryIds ?? []).includes(parentId)).length;
    if (liveMappedCount > 0) return liveMappedCount;
    const fromStore = categories.find((c) => c.id === parentId)?.itemCount;
    if (typeof fromStore === 'number') return fromStore;
    const fromModule = moduleCategories.find((c) => c.id === parentId)?.itemCount;
    return fromModule ?? 0;
  }, [storeItems, categories, moduleCategories]);

  const pendingParentItemCount = useMemo(() => {
    if (!pendingParentId) return 0;
    return getParentCategoryItemCount(pendingParentId);
  }, [pendingParentId, getParentCategoryItemCount]);

  const parentCat = parentCategoryId
    ? moduleCategories.find((c) => c.id === parentCategoryId) || categories.find((c) => c.id === parentCategoryId)
    : null;

  const parentCategoryFromStore = useMemo(() => {
    if (!parentCategoryId || isParentCategory) return null;
    return categories.find((c) => c.id === parentCategoryId) ?? null;
  }, [parentCategoryId, isParentCategory, categories]);

  /** When parent hides a channel or does not have it, force child channel off (cannot override upward). */
  useEffect(() => {
    const p = parentCategoryFromStore;
    if (!p) return;
    setChannelVisibility((prev) => {
      let changed = false;
      const next = { ...prev };
      outletOrderTypes.forEach((ot) => {
        if (!isParentChannelAllowedForOrderType(p, ot.id) && next[ot.id] !== false) {
          next[ot.id] = false;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [parentCategoryFromStore, outletOrderTypes]);

  const resetNewCategoryForm = () => {
    setName('');
    setDescription('');
    setParentCategoryId('');
    setIsVisible(true);
    const defaults: Record<string, boolean> = {};
    outletOrderTypes.forEach((ot) => {
      defaults[ot.id] = true;
    });
    setChannelVisibility(defaults);
    setAssignedItemIds([]);
    setImagePreview(null);
    setImageFile(null);
  };

  useEffect(() => {
    if (isEdit) {
      if (!existing || !id) return;
      const key = `edit:${id}`;
      if (hydrateKeyRef.current !== key) {
        hydrateKeyRef.current = key;
        setName(existing.name);
        setDescription(existing.description);
        setParentCategoryId(existing.parentCategoryId || '');
        setIsVisible(existing.isVisible);

        // Populate channel visibility from API data
        const cv: Record<string, boolean> = {};
        outletOrderTypes.forEach((ot) => {
          cv[ot.id] = false; // missing channel in API means disabled
        });
        (existing.channelVisibility ?? []).forEach((item) => {
          if (!item.orderTypeId) return;
          cv[item.orderTypeId] = item.enabled === true;
        });
        setChannelVisibility(cv);
        initialChannelVisibilityRef.current = { ...cv };

        // Populate assigned items from API data
        if (existing.itemIds && existing.itemIds.length > 0) {
          setAssignedItemIds(existing.itemIds);
          initialAssignedItemIdsRef.current = [...existing.itemIds];
        } else {
          initialAssignedItemIdsRef.current = [];
        }

        // Set image preview if available
        if (existing.imageUrl) {
          setImagePreview(existing.imageUrl);
        }
      }
      return;
    }
    if (hydrateKeyRef.current !== 'new') {
      hydrateKeyRef.current = 'new';
      resetNewCategoryForm();
      const params = new URLSearchParams(location.search);
      const presetParent = params.get('parent');
      if (presetParent) setParentCategoryId(presetParent);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id, existing, outletOrderTypes, location.search]);

  const removeItem = (itemId: string) => {
    setAssignedItemIds((prev) => prev.filter((i) => i !== itemId));
  };

  const toggleItem = (itemId: string) => {
    setAssignedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((i) => i !== itemId) : [...prev, itemId]
    );
  };

  const assignedItemsForPills = useMemo(() => {
    const existingMap = new Map((existing?.assignedItems ?? []).map((i) => [i.id, i.name]));
    return assignedItemIds.map((aid) => {
      if (existingMap.has(aid)) return { id: aid, name: existingMap.get(aid)! };
      const fromModule = moduleItems.find((i) => i.id === aid);
      if (fromModule) return { id: fromModule.id, name: fromModule.name };
      const fromStore = storeItems.find((i) => i.id === aid);
      if (fromStore) return { id: fromStore.id, name: fromStore.name };
      return { id: aid, name: 'Item' };
    });
  }, [assignedItemIds, existing, moduleItems, storeItems]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = 'Category name is required';
    } else if (trimmedName.length > CATEGORY_NAME_MAX) {
      newErrors.name = `Category name cannot exceed ${CATEGORY_NAME_MAX} characters`;
    } else if (!/[A-Za-z0-9]/.test(trimmedName)) {
      newErrors.name = 'Category name must contain at least one letter or number';
    }
    if (description.trim().length > CATEGORY_DESCRIPTION_MAX) {
      newErrors.description = `Description must be ${CATEGORY_DESCRIPTION_MAX} characters or less`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      // Validate file size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        addToast('Image must be less than 2MB', 'error');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleImageSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/jpg';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          addToast('Image must be less than 2MB', 'error');
          return;
        }
        setImageFile(file);
        const reader = new FileReader();
        reader.onload = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      // Transform channelVisibility from Record<string, boolean> → Array<{orderTypeId, enabled}>
      const channelVisibilityPayload = Object.entries(channelVisibility).map(
        ([orderTypeId, enabled]) => ({ orderTypeId, enabled })
      );

      if (isEdit && id) {
        // Compute item assignment diff
        const initialItemIds = initialAssignedItemIdsRef.current;
        const addedItemIds = assignedItemIds.filter((iid) => !initialItemIds.includes(iid));
        const removedItemIds = initialItemIds.filter((iid) => !assignedItemIds.includes(iid));

        // Update flow
        const payload: UpdateCategoryPayload = {
          categoryId: id,
          locationId,
          name: name.trim(),
          description: description.trim(),
          parentCategoryId: parentCategoryId || null,
          channelVisibility: channelVisibilityPayload,
          items: addedItemIds.map((itemId, idx) => ({
            itemID: itemId,
            sortOrder: initialItemIds.length + idx + 1,
          })),
          ...(removedItemIds.length > 0 ? { deleteFields: { items: removedItemIds } } : {}),
        };
        await updateCategoryOnServer(payload, imageFile, token);
        addToast('Category updated', 'success');
        clearItemsCache();
        clearCategoriesCache();
        navigate(`${pcPaths.categories}?highlight=${encodeURIComponent(id)}`);
      } else {
        // Create flow
        const payload: CreateCategoryPayload = {
          name: name.trim(),
          description: description.trim(),
          locationId,
          parentCategoryId: parentCategoryId || null,
          channelVisibility: channelVisibilityPayload,
          items: assignedItemIds,
        };
        const resp = await createCategoryOnServer(payload, imageFile, token);
        const newCategoryId = typeof resp === 'string' ? resp : '';
        addToast('Category created', 'success');
        clearItemsCache();
        clearCategoriesCache();
        navigate(
          newCategoryId
            ? `${pcPaths.categories}?highlight=${encodeURIComponent(newCategoryId)}`
            : pcPaths.categories,
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save category';
      addToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = isEdit ? 'Edit Category' : 'New Category';
  const isSaving = saving || storeSaving;

  const formContent = (
      <div style={isMobile ? { ...formPageOuterStyle, height: 'auto', minHeight: 0 } : formPageOuterStyle}>
        <div style={isMobile ? { ...formPageMainScrollStyle, paddingBottom: 80 } : formPageMainScrollStyle}>
          <div style={{ ...S.center, padding: isMobile ? '12px 16px 16px' : S.center.padding }}>
            <div style={{ ...S.card, padding: isMobile ? 16 : S.card.padding }}>
            {/* ── Section 1: Basic Information ── */}
            <div style={S.section}>
              <div style={S.sectionTitle}>Basic Information</div>

              {/* Profile Image drop zone */}
              {/* <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t2, #6E665D)', marginBottom: 8, fontFamily: 'var(--font-primary)' }}>
                  Profile Image
                </div>
                <div
                  style={{
                    ...S.dropZone,
                    minHeight: imagePreview ? 140 : undefined,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onDrop={handleImageDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={handleImageSelect}
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Category"
                      onError={() => { setImagePreview(null); setImageFile(null); }}
                      style={{
                        width: '100%',
                        height: 140,
                        objectFit: 'cover',
                        borderRadius: 2,
                      }}
                    />
                  ) : (
                    <>
                      <span className="material-symbols-rounded" style={{ fontSize: 32, color: 'var(--t3, #9A9084)' }}>
                        cloud_upload
                      </span>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t2, #6E665D)', fontFamily: 'var(--font-primary)' }}>
                        Drop or browse
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)' }}>
                        PNG, JPG up to 2MB
                      </div>
                    </>
                  )}
                </div>
                {imagePreview && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setImagePreview(null); setImageFile(null); }}
                    style={{
                      marginTop: 8,
                      background: 'none',
                      border: 'none',
                      color: 'var(--red, #A63D2F)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: 14 }}>delete</span>
                    Remove image
                  </button>
                )}
              </div> */}

              <TextField
                label="Category Name"
                value={name}
                onChange={(v) => {
                  setName(v.slice(0, CATEGORY_NAME_MAX));
                  setErrors((p) => { const n = { ...p }; delete n.name; return n; });
                }}
                required
                error={errors.name}
                placeholder="e.g. Appetizers"
                maxLength={CATEGORY_NAME_MAX}
                counterWarnAfter={CATEGORY_NAME_MAX - 5}
              />
              <TextArea
                label="Description"
                value={description}
                onChange={(v) => {
                  setDescription(v);
                  setErrors((p) => {
                    const n = { ...p };
                    delete n.description;
                    return n;
                  });
                }}
                placeholder="Describe this category..."
                rows={3}
                counterWarnAfter={90}
                maxLength={CATEGORY_DESCRIPTION_MAX}
                error={errors.description}
              />
            </div>

            {/* ── Section 2: Hierarchy ── */}
            <div style={S.section}>
              <div style={S.sectionTitle}>Hierarchy</div>
              {isParentCategory ? (
                <div style={S.infoBox}>
                  <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--orange, #B89550)', flexShrink: 0, marginTop: 1 }}>
                    account_tree
                  </span>
                  <div style={{ fontSize: 12, color: 'var(--t2, #6E665D)', fontFamily: 'var(--font-primary)', lineHeight: 1.5 }}>
                    This is a <strong>parent category</strong>. Parent categories cannot be made a child of another category.
                  </div>
                </div>
              ) : (
                <>
                  <Select
                    label="Parent Category"
                    value={parentCategoryId}
                    onChange={(newVal) => {
                      if (newVal !== parentCategoryId && getParentCategoryItemCount(newVal) > 0) {
                        setPendingParentId(newVal);
                        setShowParentChangeModal(true);
                      } else {
                        setParentCategoryId(newVal);
                      }
                    }}
                    options={parentOptions}
                    placeholder="None (top-level category)"
                  />
                  {parentCat && (
                    <div style={S.infoBox}>
                      <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--accent, #B89550)', flexShrink: 0, marginTop: 1 }}>
                        info
                      </span>
                      <div style={{ fontSize: 12, color: 'var(--t2, #6E665D)', fontFamily: 'var(--font-primary)', lineHeight: 1.5 }}>
                        This category is a subcategory of <strong>{parentCat.name}</strong>. It will inherit the parent's visibility and order type settings unless overridden here.
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Section 3: Visibility (merged — single section for all order types) ── */}
            <div style={S.section}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8C6A7A', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, fontFamily: 'var(--font-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#8C6A7A' }}>visibility</span>
                Channel Visibility
              </div>
              <p style={{ fontSize: 11, color: 'var(--t3, #9A9084)', margin: '0 0 12px', fontFamily: 'var(--font-primary)', lineHeight: 1.5, paddingLeft: 10, borderLeft: '2px solid rgba(124,58,237,0.2)' }}>
                This is a parent control. Turning a channel OFF here blocks all items in this category from that channel.
                {parentCategoryFromStore && (
                  <> Subcategories cannot enable channels the parent category has hidden or does not use.</>
                )}
              </p>
              {outletOrderTypes.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)' }}>
                  No order types configured for this outlet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {outletOrderTypes.map((ot) => {
                    const parentBlocksChannel =
                      parentCategoryFromStore !== null &&
                      !isParentChannelAllowedForOrderType(parentCategoryFromStore, ot.id);
                    const channelOn = parentBlocksChannel ? false : (channelVisibility[ot.id] ?? false);
                    return (
                    <div
                      key={ot.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 2,
                        border: '1px solid var(--card-border, #E6DFD3)',
                        background: 'var(--surface, #FFFFFF)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--t2, #6E665D)' }}>
                            {getChannelIcon(ot.typeGroup)}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1, #453F39)', fontFamily: 'var(--font-primary)' }}>
                            {getChannelDisplayName(ot.typeName)}
                          </span>
                        </div>
                        {parentBlocksChannel && (
                          <span style={{ fontSize: 11, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)', paddingLeft: 28 }}>
                            Unavailable: parent category has this channel off or does not include it.
                          </span>
                        )}
                      </div>
                      <Toggle
                        checked={channelOn}
                        disabled={parentBlocksChannel}
                        onChange={(v) => {
                          if (!v) {
                            const affectedSubs = categories
                              .filter((c) => c.parentCategoryId === id)
                              .filter((c) => {
                                const cvRow = (c.channelVisibility ?? []).find((cv) => cv.orderTypeId === ot.id);
                                return cvRow?.enabled === true;
                              })
                              .map((c) => c.name);
                            if (affectedSubs.length > 0) {
                              setPendingChannelOff({ orderTypeId: ot.id, channelName: getChannelDisplayName(ot.typeName), affectedSubs });
                              return;
                            }
                          }
                          setChannelVisibility((prev) => ({ ...prev, [ot.id]: v }));
                        }}
                      />
                    </div>
                    );
                  })}
                </div>
              )}
              {/* PCF-19.2: Impact preview */}
              {isEdit && (() => {
                const disabledChannels = outletOrderTypes.filter((ot) => channelVisibility[ot.id] === false);
                if (disabledChannels.length === 0) return null;
                const catItems = storeItems.filter((it) => it.categoryIds.includes(id ?? ''));
                const affectedCount = catItems.length;
                if (affectedCount === 0) return (
                  <p style={{ fontSize: 10, color: '#9A9084', fontStyle: 'italic', marginTop: 8, fontFamily: 'var(--font-primary)' }}>
                    No items in this category yet. This setting will apply to items added later.
                  </p>
                );
                return (
                  <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 2, background: 'rgba(176,122,42,0.06)', border: '1px solid rgba(176,122,42,0.15)' }}>
                    <p style={{ fontSize: 11, color: '#8A6D33', margin: 0, fontFamily: 'var(--font-primary)', lineHeight: 1.5 }}>
                      <span className="material-symbols-rounded" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>info</span>
                      Hiding {disabledChannels.map((c) => getChannelDisplayName(c.typeName)).join(', ')} will affect <strong>{affectedCount} item{affectedCount !== 1 ? 's' : ''}</strong> in this category.
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* ── Section 4: Subcategories (parent only) or Item Assignment ── */}
            <div style={S.sectionLast}>
              {isParentCategory ? (
                <>
                  {/* Subcategories list — read only */}
                  {(() => {
                    const subCategories = categories.filter((c) => c.parentCategoryId === id);
                    return (
                      <div style={{ marginBottom: 16 }}>
                        <div style={S.sectionTitle}>Subcategories</div>
                        {subCategories.length === 0 ? (
                          <p style={{ fontSize: 12, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)', margin: 0 }}>
                            No subcategories found.
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                            {subCategories.map((sub) => (
                              <div
                                key={sub.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  padding: '8px 12px',
                                  borderRadius: 'var(--radius-input, 8px)',
                                  background: 'var(--surface, #FFFFFF)',
                                  border: '1px solid var(--card-border, #E5E7EF)',
                                }}
                              >
                                <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--t3, #9A9084)' }}>
                                  subdirectory_arrow_right
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1, #453F39)', fontFamily: 'var(--font-primary)', flex: 1 }}>
                                  {sub.name}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)' }}>
                                  {sub.itemCount} item{sub.itemCount !== 1 ? 's' : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => navigate(pcPaths.categoriesCreate + '?parent=' + editingCategoryId)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '6px 12px', borderRadius: 2, marginTop: 12,
                            border: '1px dashed var(--accent, #B89550)', background: 'transparent',
                            color: 'var(--accent, #B89550)', fontSize: 12, fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'var(--font-primary)',
                          }}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>add</span>
                          Add Sub-category
                        </button>
                      </div>                      
                    );
                  })()}

                  {/* Item assignment not available for parent categories */}
                  <div style={{ ...S.infoBox, alignItems: 'flex-start' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--orange, #B89550)', flexShrink: 0, marginTop: 1 }}>
                      package_2
                    </span>
                    <div style={{ fontSize: 12, color: 'var(--t2, #6E665D)', fontFamily: 'var(--font-primary)', lineHeight: 1.5 }}>
                      <strong>Item Assignment</strong>
                      <br />
                      Items cannot be assigned to parent categories. Add items to the subcategories under this category instead.
                    </div>
                  </div>
                </>
              ) : (
                <ItemAssignmentSection
                  items={moduleItems}
                  categories={categories}
                  selectedIds={assignedItemIds}
                  selectedItems={assignedItemsForPills}
                  onToggle={toggleItem}
                  onRemove={removeItem}
                  itemsLoading={itemsLoading}
                  defaultOpen={false}
                  persistedSelectedIds={initialAssignedItemIdsRef.current}
                />
              )}
            </div>
          </div>
          </div>
        </div>

        <div style={isMobile ? { ...formStickyActionBarFooterStyle, position: 'fixed' as const, bottom: 0, left: 0, right: 0, zIndex: 100, padding: 16 } : formStickyActionBarFooterStyle}>
          <button type="button" style={formCancelButtonStyle} onClick={handleCancel}>
            Cancel
          </button>
          <button
            type="button"
            style={{ ...formSaveButtonStyle, minWidth: 132, opacity: isSaving || !isFormValid ? 0.5 : 1, cursor: !isFormValid ? 'not-allowed' : 'pointer' }}
            onClick={handleSave}
            disabled={isSaving || !isFormValid}
          >
            {isSaving ? saveLoadingLabel : saveIdleLabel}
          </button>
        </div>
      </div>
  );

  /* ── Confirmation modals (inline, no extra dependency) ── */
  const modalOverlayStyle = {
    position: 'fixed' as const, inset: 0, zIndex: 10000,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center' as const, justifyContent: 'center' as const,
    padding: 16,
  };
  const modalBoxStyle = {
    background: '#fff', borderRadius: 2, padding: 24,
    maxWidth: 400, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    fontFamily: 'var(--font-primary)',
  };

  const parentChangeModal = showParentChangeModal && (
    <div style={modalOverlayStyle} onClick={() => { setShowParentChangeModal(false); setPendingParentId(null); }}>
      <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 22, color: 'var(--orange, #B89550)' }}>account_tree</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1, #453F39)' }}>Assign Parent Category</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--t2, #6E665D)', margin: '0 0 20px', lineHeight: 1.6 }}>
          {pendingParentItemCount > 0 && (
            <>
              The selected parent category currently has <strong>{pendingParentItemCount} item{pendingParentItemCount !== 1 ? 's' : ''}</strong>.{' '}
              If you continue, <strong>{pendingParentItemCount} item{pendingParentItemCount !== 1 ? 's' : ''} will become unassigned</strong>.{' '}
            </>
          )}
          Assigning a parent may also alter channel visibility for items in this category.
          Continue?
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" style={{ ...formCancelButtonStyle, border: '1px solid var(--card-border, #E6DFD3)', borderRadius: 2 }}
            onClick={() => { setShowParentChangeModal(false); setPendingParentId(null); }}>
            Cancel
          </button>
          <button type="button" style={{ ...formSaveButtonStyle, borderRadius: 2 }}
            onClick={() => {
              if (pendingParentId !== null) setParentCategoryId(pendingParentId);
              setShowParentChangeModal(false);
              setPendingParentId(null);
            }}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );

  const channelOffModal = pendingChannelOff && (
    <div style={modalOverlayStyle} onClick={() => setPendingChannelOff(null)}>
      <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 22, color: 'var(--red, #A63D2F)' }}>visibility_off</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1, #453F39)' }}>Turn off {pendingChannelOff.channelName}?</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--t2, #6E665D)', margin: '0 0 8px', lineHeight: 1.6 }}>
          Turning off <strong>{pendingChannelOff.channelName}</strong> will also disable it for{' '}
          <strong>{pendingChannelOff.affectedSubs.length} subcategor{pendingChannelOff.affectedSubs.length !== 1 ? 'ies' : 'y'}</strong>:
        </p>
        <ul style={{ margin: '0 0 20px', paddingLeft: 20, fontSize: 12, color: 'var(--t2, #6E665D)', lineHeight: 1.7 }}>
          {pendingChannelOff.affectedSubs.map((name) => <li key={name}>{name}</li>)}
        </ul>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" style={{ ...formCancelButtonStyle, border: '1px solid var(--card-border, #E6DFD3)', borderRadius: 2 }}
            onClick={() => setPendingChannelOff(null)}>
            Cancel
          </button>
          <button type="button"
            style={{ ...formSaveButtonStyle, background: 'var(--red, #A63D2F)', borderRadius: 2 }}
            onClick={() => {
              setChannelVisibility((prev) => ({ ...prev, [pendingChannelOff.orderTypeId]: false }));
              setPendingChannelOff(null);
            }}>
            Turn Off
          </button>
        </div>
      </div>
    </div>
  );

  if (isEditRoute && !editingCategoryId) {
    return <Navigate to={pcPaths.categories} replace />;
  }

  const discardModal = <DiscardChangesModal open={showDiscardModal} onKeepEditing={handleKeepEditing} onConfirm={handleConfirmDiscard} />;

  if (isMobile) {
    return (
      <>
        {parentChangeModal}
        {channelOffModal}
        {discardModal}
        <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif" }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span onClick={handleCancel} className="material-symbols-rounded" style={{ fontSize: 22, color: '#453F39', cursor: 'pointer' }}>arrow_back</span>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: 0 }}>{pageTitle}</h1>
            </div>
          </div>
          {formContent}
        </div>
      </>
    );
  }

  return (
    <>
      {parentChangeModal}
      {channelOffModal}
      {discardModal}
      <DesktopLayout>
        {formContent}
      </DesktopLayout>
    </>
  );
}
