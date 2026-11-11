import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
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
import { useVariationSetsStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import type { VariationSetOption } from '../../data/types';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { pcPaths } from '../../paths';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import { useErrorToast } from '../../hooks/useErrorToast';
import {
  formPageOuterStyle,
  formPageMainScrollStyle,
  formStickyActionBarFooterStyle,
  formCancelButtonStyle,
  formSaveButtonStyle,
} from '../../formLayout';

const OPTION_NAME_MAX = 30;

interface LocalOption {
  id: string;
  name: string;
  price: number | string;
}

function normalizeOptionPrice(value: number | string): number {
  if (value === '' || value == null) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

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

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--t2, #6E665D)',
  fontFamily: 'var(--font-primary)',
  display: 'block',
  marginBottom: 6,
};

const divider: React.CSSProperties = {
  height: 1,
  background: '#E6DFD3',
  margin: '20px 0',
  border: 'none',
};

function OptionDragHandle({
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
        padding: '6px 4px',
        cursor: 'grab',
        color: '#9A9084',
        borderRadius: 4,
        flexShrink: 0,
        touchAction: 'none',
      }}
      title="Drag to reorder"
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
}

function SortableOptionRow({
  opt,
  idx,
  total,
  inputBase,
  canRemove,
  onName,
  onPrice,
  onRemove,
  nameError,
  priceError,
}: {
  opt: LocalOption;
  idx: number;
  total: number;
  inputBase: React.CSSProperties;
  canRemove: boolean;
  onName: (v: string) => void;
  onPrice: (v: string) => void;
  onRemove: () => void;
  nameError?: string;
  priceError?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: opt.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 2 : undefined,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 0',
          borderBottom: idx < total - 1 ? '1px solid #F4F0E8' : undefined,
        }}
      >
        <OptionDragHandle listeners={listeners} attributes={attributes} />

        <input
          type="text"
          value={opt.name}
          maxLength={OPTION_NAME_MAX}
          onChange={(e) => onName(e.target.value.slice(0, OPTION_NAME_MAX))}
          placeholder={`Option ${idx + 1} name`}
          style={{
            ...inputBase,
            flex: 2,
            borderColor: nameError ? 'var(--red, #A63D2F)' : inputBase.borderColor ?? '#E6DFD3',
          }}
        />

        <div style={{ position: 'relative', flex: 1, minWidth: 100 }}>
          <span
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 12,
              color: '#9A9084',
            }}
          >
            $
          </span>
          <input
            type="number"
            value={opt.price}
            onChange={(e) => onPrice(e.target.value)}
            placeholder="0.00"
            min={0}
            step={1}
            style={{
              ...inputBase,
              paddingLeft: 24,
              borderColor: priceError ? 'var(--red, #A63D2F)' : inputBase.borderColor ?? '#E6DFD3',
            }}
          />
        </div>

        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          style={{
            background: 'none',
            border: 'none',
            cursor: canRemove ? 'pointer' : 'not-allowed',
            padding: 4,
            lineHeight: 0,
            opacity: canRemove ? 1 : 0.3,
            flexShrink: 0,
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--red, #A63D2F)' }}>
            close
          </span>
        </button>
      </div>
      {(nameError || priceError) && (
        <div style={{ fontSize: 11, color: 'var(--red, #A63D2F)', paddingLeft: 32, paddingBottom: 6 }}>
          {nameError ? <div>{nameError}</div> : null}
          {priceError ? <div>{priceError}</div> : null}
        </div>
      )}
    </div>
  );
}

export default function OptionSetFormPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { variationSets, fetchVariationSets, createVariationSetOnServer, updateVariationSetOnServer, setEditingVariationSetId, editingOptionSetId, error } = useVariationSetsStore();
  const { addToast } = useToastStore();
  const { auth } = useAuth();
  const { selectedBranch } = useBranch();

  useErrorToast(error, { fallbackMessage: 'Failed to load option sets' });

  const location = useLocation();
  const isEditRoute = location.pathname === pcPaths.optionSetEdit;
  const id = isEditRoute ? editingOptionSetId : null;

  const isEdit = Boolean(id) && id !== 'new';
  const existing = isEdit ? variationSets.find((o) => o.id === id) : null;

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({ title: isEdit ? 'Edit Variation Set' : 'New Variation Set', breadcrumbs: 'Product Catalog > Variations' });
  }, [setTopBarProps, isEdit]);

  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [options, setOptions] = useState<LocalOption[]>([{ id: `opt-${Date.now()}`, name: '', price: '' }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const saveIdleLabel = isEdit ? 'Update' : 'Create';
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDisplayName(existing.displayName || '');
      setOptions(existing.options.map((o) => ({ id: o.id, name: o.name, price: o.price ?? '' })));
    }
  }, [existing]);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) return;
    void fetchVariationSets(locationId, token, { skipDuplicateMs: 750 });
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token, fetchVariationSets]);

  const addOption = () => {
    setOptions((prev) => [...prev, { id: `opt-${Date.now()}`, name: '', price: '' }]);
  };

  const removeOption = (optId: string) => {
    setOptions((prev) => prev.filter((o) => o.id !== optId));
  };

  const updateOption = (optId: string, field: keyof LocalOption, value: string | number) => {
    setOptions((prev) => prev.map((o) => (o.id === optId ? { ...o, [field]: value } : o)));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const optionIds = useMemo(() => options.map((o) => o.id), [options]);

  const handleOptionsDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOptions((prev) => {
      const oldIndex = prev.findIndex((o) => o.id === active.id);
      const newIndex = prev.findIndex((o) => o.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const isFormValid = useMemo(() => {
    if (!name.trim()) return false;
    if (options.length === 0) return false;
    for (const o of options) {
      if (!o.name.trim()) return false;
      if (o.name.trim().length > OPTION_NAME_MAX) return false;
      if (o.price !== '' && o.price != null) {
        const n = Number(o.price);
        if (!Number.isFinite(n) || n < 0) return false;
      }
    }
    return true;
  }, [name, options]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (options.length === 0) newErrors.options = 'At least one option is required';
    const emptyOpts = options.filter((o) => !o.name.trim());
    if (emptyOpts.length > 0) newErrors.options = 'All options must have a name';
    options.forEach((o, i) => {
      if (o.name.trim().length > OPTION_NAME_MAX) {
        newErrors[`option_${i}_name`] = `Option name must be ${OPTION_NAME_MAX} characters or less`;
      }
      if (o.price !== '' && o.price != null) {
        const n = Number(o.price);
        if (!Number.isFinite(n) || n < 0) {
          newErrors[`option_${i}_price`] = 'Enter a valid price (0 or greater)';
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const optionSetOptions: VariationSetOption[] = options.map((o) => ({
      id: o.id,
      name: o.name.trim(),
      price: normalizeOptionPrice(o.price),
    }));

    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) {
      addToast('Select a location before saving', 'error');
      return;
    }
    setSaving(true);

    void (async () => {
      try {
        if (isEdit && id) {
          await updateVariationSetOnServer(
            {
              templateId: id,
              locationId,
              name: name.trim(),
              displayName: displayName.trim() || undefined,
              options: optionSetOptions.map((o, idx) => ({
                name: o.name,
                price: normalizeOptionPrice(o.price ?? 0),
                sortOrder: idx + 1,
                ...(o.id.startsWith('opt-') ? {} : { optionId: o.id }),
              })),
            },
            token,
          );
          addToast('Variation set updated', 'success');
        } else {
          await createVariationSetOnServer(
            {
              locationId,
              name: name.trim(),
              displayName: displayName.trim() || undefined,
              options: optionSetOptions.map((o, idx) => ({
                name: o.name,
                price: normalizeOptionPrice(o.price ?? 0),
                sortOrder: idx + 1,
              })),
            },
            token,
          );
          addToast('Variation set created', 'success');
        }
        setEditingVariationSetId(null);
        navigate(pcPaths.variations);
      } catch (e) {
        addToast(e instanceof Error ? e.message : 'Failed to save variation set', 'error');
      } finally {
        setSaving(false);
      }
    })();
  };

  if (isEditRoute && !editingOptionSetId) {
    return <Navigate to={pcPaths.variations} replace />;
  }

  if (isMobile) return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif", display: 'flex', flexDirection: 'column' }}>
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span onClick={() => navigate(pcPaths.variations)} className="material-symbols-rounded" style={{ fontSize: 22, color: '#453F39', cursor: 'pointer' }}>arrow_back</span>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: 0 }}>{isEdit ? 'Edit Variation Set' : 'New Variation Set'}</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: 80 }}>
        <div style={{ ...cardStyle, maxWidth: '100%' }}>
          {/* Basic Information */}
          <p style={sectionTitle}>BASIC INFORMATION</p>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              Name <span style={{ color: 'var(--accent, #B89550)' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((p) => { const n = { ...p }; delete n.name; return n; }); }}
              placeholder="e.g. Size"
              style={{ ...inputBase, borderColor: errors.name ? 'var(--red, #A63D2F)' : '#E6DFD3' }}
            />
            {errors.name && <span style={{ fontSize: 11, color: 'var(--red, #A63D2F)', marginTop: 4, display: 'block' }}>{errors.name}</span>}
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Choose Your Size"
              style={inputBase}
            />
          </div>

          <hr style={divider} />

          {/* Options */}
          <p style={sectionTitle}>OPTIONS</p>

          {errors.options && (
            <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--red, #A63D2F)', margin: '0 0 12px' }}>{errors.options}</p>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleOptionsDragEnd}>
            <SortableContext items={optionIds} strategy={verticalListSortingStrategy}>
              {options.map((opt, idx) => (
                <SortableOptionRow
                  key={opt.id}
                  opt={opt}
                  idx={idx}
                  total={options.length}
                  inputBase={inputBase}
                  canRemove={options.length > 1}
                  onName={(v) => updateOption(opt.id, 'name', v)}
                  onPrice={(v) => updateOption(opt.id, 'price', v)}
                  onRemove={() => removeOption(opt.id)}
                  nameError={errors[`option_${idx}_name`]}
                  priceError={errors[`option_${idx}_price`]}
                />
              ))}
            </SortableContext>
          </DndContext>

          <button
            type="button"
            onClick={addOption}
            style={{
              width: '100%', padding: '12px 0', marginTop: 12,
              border: '1.5px dashed var(--accent, #B89550)', borderRadius: 2,
              background: 'transparent', cursor: 'pointer',
              color: 'var(--accent, #B89550)', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontFamily: 'var(--font-primary)',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add</span>
            Add Option
          </button>
        </div>
      </div>

      {/* Fixed bottom action bar */}
      <div style={{ ...formStickyActionBarFooterStyle, position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, padding: 16 }}>
        <button type="button" style={formCancelButtonStyle} onClick={() => navigate(pcPaths.variations)}>
          Cancel
        </button>
        <button type="button" style={{ ...formSaveButtonStyle, minWidth: 132, opacity: !isFormValid || saving ? 0.5 : 1, cursor: !isFormValid ? 'not-allowed' : 'pointer' }} onClick={handleSave} disabled={!isFormValid || saving}>
          {saveIdleLabel}
        </button>
      </div>
    </div>
  );

  return (
    <DesktopLayout>
      <div style={formPageOuterStyle}>
        <div style={formPageMainScrollStyle}>
          <div style={{ padding: 25, paddingBottom: 24 }}>
            <div style={cardStyle}>
          {/* ── Section 1: Basic Information ── */}
          <p style={sectionTitle}>BASIC INFORMATION</p>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              Name <span style={{ color: 'var(--accent, #B89550)' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((p) => { const n = { ...p }; delete n.name; return n; }); }}
              placeholder="e.g. Size"
              style={{ ...inputBase, borderColor: errors.name ? 'var(--red, #A63D2F)' : '#E6DFD3' }}
            />
            {errors.name && <span style={{ fontSize: 11, color: 'var(--red, #A63D2F)', marginTop: 4, display: 'block' }}>{errors.name}</span>}
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Choose Your Size"
              style={inputBase}
            />
          </div>

          <hr style={divider} />

          {/* ── Section 2: Options ── */}
          <p style={sectionTitle}>OPTIONS</p>

          {errors.options && (
            <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--red, #A63D2F)', margin: '0 0 12px' }}>{errors.options}</p>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleOptionsDragEnd}>
            <SortableContext items={optionIds} strategy={verticalListSortingStrategy}>
              {options.map((opt, idx) => (
                <SortableOptionRow
                  key={opt.id}
                  opt={opt}
                  idx={idx}
                  total={options.length}
                  inputBase={inputBase}
                  canRemove={options.length > 1}
                  onName={(v) => updateOption(opt.id, 'name', v)}
                  onPrice={(v) => updateOption(opt.id, 'price', v)}
                  onRemove={() => removeOption(opt.id)}
                  nameError={errors[`option_${idx}_name`]}
                  priceError={errors[`option_${idx}_price`]}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* Add Option */}
          <button
            type="button"
            onClick={addOption}
            style={{
              width: '100%', padding: '12px 0', marginTop: 12,
              border: '1.5px dashed var(--accent, #B89550)', borderRadius: 2,
              background: 'transparent', cursor: 'pointer',
              color: 'var(--accent, #B89550)', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontFamily: 'var(--font-primary)',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add</span>
            Add Option
          </button>

            </div>
          </div>
        </div>

        <div style={formStickyActionBarFooterStyle}>
          <button type="button" style={formCancelButtonStyle} onClick={() => navigate(pcPaths.variations)}>
            Cancel
          </button>
          <button type="button" style={{ ...formSaveButtonStyle, minWidth: 132, opacity: !isFormValid || saving ? 0.5 : 1, cursor: !isFormValid ? 'not-allowed' : 'pointer' }} onClick={handleSave} disabled={!isFormValid || saving}>
            {saveIdleLabel}
          </button>
        </div>
      </div>
    </DesktopLayout>
  );
}
