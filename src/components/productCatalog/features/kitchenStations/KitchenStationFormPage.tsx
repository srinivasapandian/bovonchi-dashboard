import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useItemsStore, useKitchenStationsStore, useCategoriesStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import { useErrorToast } from '../../hooks/useErrorToast';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { pcPaths } from '../../paths';
import { pickHighlightIdFromApiResponse } from '../../utils/pickHighlightIdFromApiResponse';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { DiscardChangesModal } from '../../components/ui/DiscardChangesModal';
import { ItemAssignmentSection, type AssignableItem } from '../../components/ui/ItemAssignmentSection';
import { useFormDiscardGuard } from '../../hooks/useFormDiscardGuard';
import TextArea from '../../components/forms/TextArea';
import {
  formPageOuterStyle,
  formPageMainScrollStyle,
  formStickyActionBarFooterStyle,
  formCancelButtonStyle,
  formSaveButtonStyle,
} from '../../formLayout';

const ACCENT = '#B89550';
const T1 = '#453F39';
const T2 = '#6E665D';
const T3 = '#9A9084';
const RED = '#A63D2F';
const BORDER = '#E6DFD3';
const CARD_BG = '#FFFFFF';

function generateCode(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .map((w) => w.slice(0, 4))
    .join('')
    .toUpperCase()
    .slice(0, 6);
}

export default function KitchenStationFormPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { stations, fetchStations, createStationOnServer, updateStationOnServer, editingStationId, error } = useKitchenStationsStore();
  const { items, fetchItems, loading: itemsLoading } = useItemsStore();
  const { categories, fetchCategories } = useCategoriesStore();
  const { addToast } = useToastStore();
  const { auth } = useAuth();
  const { selectedBranch } = useBranch();

  useErrorToast(error, { fallbackMessage: 'Failed to load kitchen stations' });

  const location = useLocation();
  const isEditRoute = location.pathname === pcPaths.kitchenStationEdit;
  const id = isEditRoute ? editingStationId : null;

  const isEdit = Boolean(id) && id !== 'new';
  const existing = isEdit ? stations.find((s) => s.id === id) : null;

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({ title: isEdit ? 'Edit Kitchen Station' : 'New Kitchen Station', breadcrumbs: 'Product Catalog > Kitchen Stations' });
  }, [setTopBarProps, isEdit]);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) return;
    void fetchStations(locationId, token, { skipDuplicateMs: 750 });
    void fetchItems(locationId, token, { skipDuplicateMs: 750 });
    void fetchCategories(locationId, token, { skipDuplicateMs: 750 });
  }, [
    selectedBranch?.id,
    selectedBranch?.locationId,
    auth?.accessToken,
    auth?.access_token,
    fetchStations,
    fetchItems,
    fetchCategories,
  ]);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [persistedItemIds, setPersistedItemIds] = useState<string[]>([]);
  const saveIdleLabel = isEdit ? 'Update' : 'Create';
  const saveLoadingLabel = isEdit ? 'Updating' : 'Creating';

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setCode(existing.code);
      setDescription(existing.description);
      const existingIds = existing.assignedItemIds ?? [];
      setSelectedItemIds(existingIds);
      setPersistedItemIds(existingIds);
    } else {
      setName('');
      setCode('');
      setDescription('');
      setSelectedItemIds([]);
      setPersistedItemIds([]);
    }
  }, [existing]);

  const isDirty = useMemo(() => {
    if (!isEdit) {
      return !!(name.trim() || code.trim() || description.trim());
    }
    if (!existing) return false;
    return (
      name !== existing.name ||
      code !== existing.code ||
      description !== existing.description ||
      selectedItemIds.join('|') !== persistedItemIds.join('|')
    );
  }, [isEdit, existing, name, code, description, selectedItemIds, persistedItemIds]);

  const assignableItems = useMemo<AssignableItem[]>(
    () =>
      items.map((item) => ({
        id: item.id,
        name: item.name,
        categoryIds: item.categoryIds,
        categorySortPositions: item.categorySortPositions,
        trailing: `$${item.basePrice.toFixed(2)}`,
      })),
    [items],
  );

  // Register dirty state with global guard (sidebar + browser back)
  const { pendingSidebarPath: ksPendingSidebarPath } = useFormDiscardGuard(isDirty, pcPaths.kitchenStations, {
    onBrowserBack: () => setShowDiscardConfirm(true),
  });

  const handleCancel = useCallback(() => {
    if (isDirty) setShowDiscardConfirm(true);
    else navigate(pcPaths.kitchenStations);
  }, [isDirty, navigate]);

  const handleKsDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
    navigate(ksPendingSidebarPath.current ?? pcPaths.kitchenStations);
    ksPendingSidebarPath.current = null;
  }, [navigate, ksPendingSidebarPath]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!code.trim()) newErrors.code = 'Code is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (saving) return;
    if (!validate()) return;
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) {
      addToast('Select a location before saving', 'error');
      return;
    }
    const base = {
      stationName: name.trim(),
      stationCode: code.trim(),
      description: description.trim(),
    };
    const itemIdsToAdd = selectedItemIds.filter((itemId) => !persistedItemIds.includes(itemId));
    const itemIdsToRemove = persistedItemIds.filter((itemId) => !selectedItemIds.includes(itemId));
    void (async () => {
      try {
        setSaving(true);
        if (isEdit && id) {
          await updateStationOnServer(
            {
              id,
              locationId,
              ...base,
              itemIds: itemIdsToAdd,
              deleteFields: { itemIds: itemIdsToRemove },
            },
            token,
          );
          addToast('Station updated', 'success');
          navigate(`${pcPaths.kitchenStations}?highlight=${encodeURIComponent(id)}`);
        } else {
          const createResp = await createStationOnServer({ locationId, ...base, itemIds: selectedItemIds }, token);
          const newId = pickHighlightIdFromApiResponse(createResp);
          addToast('Station created', 'success');
          navigate(
            newId
              ? `${pcPaths.kitchenStations}?highlight=${encodeURIComponent(newId)}`
              : pcPaths.kitchenStations,
          );
        }
      } catch (e) {
        addToast(e instanceof Error ? e.message : 'Failed to save station', 'error');
      } finally {
        setSaving(false);
      }
    })();
  };

  const inputBase: CSSProperties = {
    fontSize: 13,
    fontFamily: 'var(--font-primary, "Jost", sans-serif)',
    color: T1,
    border: `1px solid ${BORDER}`,
    borderRadius: 2,
    padding: '10px 12px',
    outline: 'none',
    background: CARD_BG,
    width: '100%',
    boxSizing: 'border-box',
  };

  const labelBlock: CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: T1,
    display: 'block',
    marginBottom: 6,
  };

  if (isEditRoute && !editingStationId) {
    return <Navigate to={pcPaths.kitchenStations} replace />;
  }

  if (isMobile) return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif", display: 'flex', flexDirection: 'column' }}>
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span onClick={handleCancel} className="material-symbols-rounded" style={{ fontSize: 22, color: T1, cursor: 'pointer' }}>arrow_back</span>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: T1, margin: 0 }}>
          {isEdit ? 'Edit Kitchen Station' : 'Add Kitchen Station'}
        </h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: 80 }}>
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '20px 16px 28px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={labelBlock}>
                Station Name <span style={{ color: ACCENT }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                maxLength={30}
                onChange={(e) => {
                  const v = e.target.value.slice(0, 30);
                  setName(v);
                  setErrors((p) => { const n = { ...p }; delete n.name; return n; });
                  if (!isEdit) setCode(generateCode(v));
                }}
                placeholder="e.g. Grill Station"
                style={{ ...inputBase, borderColor: errors.name ? RED : BORDER }}
              />
              <span style={{ fontSize: 11, color: T3, marginTop: 4, display: 'block' }}>{name.length}/30 characters</span>
              {errors.name && <span style={{ fontSize: 11, color: RED, marginTop: 4, display: 'block' }}>{errors.name}</span>}
            </div>

            <div>
              <label style={labelBlock}>Station Code</label>
              <input
                type="text"
                value={code}
                maxLength={6}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().slice(0, 6));
                  setErrors((p) => { const n = { ...p }; delete n.code; return n; });
                }}
                placeholder="Auto-generated"
                style={{ ...inputBase, fontFamily: 'monospace', textTransform: 'uppercase', borderColor: errors.code ? RED : BORDER }}
              />
              <span style={{ fontSize: 11, color: T3, marginTop: 4, display: 'block' }}>{code.length}/6 characters</span>
              {errors.code && <span style={{ fontSize: 11, color: RED, marginTop: 4, display: 'block' }}>{errors.code}</span>}
            </div>

            <TextArea
              label="Description"
              value={description}
              onChange={setDescription}
              placeholder="Describe what this station prepares..."
              maxLength={100}
              counterWarnAfter={90}
              rows={3}
            />

            <ItemAssignmentSection
              title="Assign Items"
              icon="package_2"
              items={assignableItems}
              categories={categories}
              selectedIds={selectedItemIds}
              onToggle={(itemId) =>
                setSelectedItemIds((prev) =>
                  prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
                )
              }
              onRemove={(itemId) => setSelectedItemIds((prev) => prev.filter((id) => id !== itemId))}
              loading={itemsLoading}
              itemsLoading={itemsLoading}
              emptyLabel="No items assigned to this station"
              addButtonLabel="Add Items"
              noResultsLabel="No items found"
              collapsible={false}
              persistedSelectedIds={persistedItemIds}
              titleCountBadge={`${selectedItemIds.length} selected`}
            />
          </div>
        </div>
      </div>

      {/* Fixed bottom action bar */}
      <div style={{ ...formStickyActionBarFooterStyle, position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, padding: 16 }}>
        <button type="button" style={{ ...formCancelButtonStyle, opacity: saving ? 0.6 : 1 }} onClick={handleCancel} disabled={saving}>Cancel</button>
        <button
          type="button"
          style={{ ...formSaveButtonStyle, minWidth: 132, opacity: !name.trim() || saving ? 0.5 : 1 }}
          disabled={!name.trim() || saving}
          onClick={handleSave}
        >
          {saving ? saveLoadingLabel : saveIdleLabel}
        </button>
      </div>

      <DiscardChangesModal open={showDiscardConfirm} onKeepEditing={() => setShowDiscardConfirm(false)} onConfirm={handleKsDiscard} />
    </div>
  );

  return (
    <DesktopLayout>
      <div style={formPageOuterStyle}>
        <div style={formPageMainScrollStyle}>
          <div style={{ padding: '24px 25px 32px' }}>

            <div
              style={{
                background: CARD_BG,
                border: `1px solid ${BORDER}`,
                borderRadius: 2,
                padding: '20px 24px 28px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={labelBlock}>
                    Station Name <span style={{ color: ACCENT }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    maxLength={30}
                    onChange={(e) => {
                      const v = e.target.value.slice(0, 30);
                      setName(v);
                      setErrors((p) => {
                        const n = { ...p };
                        delete n.name;
                        return n;
                      });
                      if (!isEdit) setCode(generateCode(v));
                    }}
                    placeholder="e.g. Grill Station"
                    style={{ ...inputBase, borderColor: errors.name ? RED : BORDER }}
                  />
                  <span style={{ fontSize: 11, color: T3, marginTop: 4, display: 'block' }}>
                    {name.length}/30 characters
                  </span>
                  {errors.name ? (
                    <span style={{ fontSize: 11, color: RED, marginTop: 4, display: 'block' }}>{errors.name}</span>
                  ) : null}
                </div>

                <div>
                  <label style={labelBlock}>Station Code</label>
                  <input
                    type="text"
                    value={code}
                    maxLength={6}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase().slice(0, 6));
                      setErrors((p) => {
                        const n = { ...p };
                        delete n.code;
                        return n;
                      });
                    }}
                    placeholder="Auto-generated"
                    style={{
                      ...inputBase,
                      fontFamily: 'monospace',
                      textTransform: 'uppercase',
                      borderColor: errors.code ? RED : BORDER,
                    }}
                  />
                  <span style={{ fontSize: 11, color: T3, marginTop: 4, display: 'block' }}>
                    {code.length}/6 characters · uppercase only
                  </span>
                  {errors.code ? (
                    <span style={{ fontSize: 11, color: RED, marginTop: 4, display: 'block' }}>{errors.code}</span>
                  ) : null}
                </div>

                <TextArea
                  label="Description"
                  value={description}
                  onChange={setDescription}
                  placeholder="Describe what this station prepares..."
                  maxLength={100}
                  counterWarnAfter={90}
                  rows={3}
                />

                <ItemAssignmentSection
                  title="Assign Items"
                  icon="package_2"
                  items={assignableItems}
                  categories={categories}
                  selectedIds={selectedItemIds}
                  onToggle={(itemId) =>
                    setSelectedItemIds((prev) =>
                      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
                    )
                  }
                  onRemove={(itemId) => setSelectedItemIds((prev) => prev.filter((id) => id !== itemId))}
                  loading={itemsLoading}
                  itemsLoading={itemsLoading}
                  emptyLabel="No items assigned to this station"
                  addButtonLabel="Add Items"
                  noResultsLabel="No items found"
                  collapsible={false}
                  persistedSelectedIds={persistedItemIds}
                  titleCountBadge={`${selectedItemIds.length} selected`}
                />
              </div>
            </div>
          </div>
        </div>

        <div style={formStickyActionBarFooterStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" style={{ ...formCancelButtonStyle, opacity: saving ? 0.6 : 1 }} onClick={handleCancel} disabled={saving}>
              Cancel
            </button>
            <button type="button" style={{ ...formSaveButtonStyle, minWidth: 132, opacity: !name.trim() || saving ? 0.5 : 1 }} disabled={!name.trim() || saving} onClick={handleSave}>
              {saving ? saveLoadingLabel : saveIdleLabel}
            </button>
          </div>
        </div>
      </div>

      <DiscardChangesModal open={showDiscardConfirm} onKeepEditing={() => setShowDiscardConfirm(false)} onConfirm={handleKsDiscard} />
    </DesktopLayout>
  );
}
