import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useNavigate, useSearchParams, useLocation, Navigate } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSetMenusStore, useItemsStore, useCategoriesStore, useModifiersStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import type { SetMenu, SetMenuCourse, ItemStatus } from '../../data/types';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { pcPaths } from '../../paths';
import { withCloneNameLabel } from '../../catalogEntityActions';
import {
  formPageOuterStyle,
  formPageMainScrollStyle,
  formStickyActionBarFooterStyle,
  formCancelButtonStyle,
  formSaveButtonStyle,
} from '../../formLayout';
import Select from '../../components/forms/Select';
import BottomNav from '../../../BottomNav';

/* ── Style constants (matching ModifierFormPage) ── */

const sectionTitle: CSSProperties = {
  fontSize: 13, fontWeight: 600, textTransform: 'uppercase',
  color: '#9A9084', letterSpacing: '0.5px', margin: '0 0 16px',
};

const cardStyle: CSSProperties = {
  background: '#FFFFFF', border: '1px solid #E6DFD3',
  borderRadius: 2, padding: 24,
};

const inputBase: CSSProperties = {
  fontSize: 13, fontFamily: 'var(--font-primary, "Jost", sans-serif)',
  color: 'var(--t1, #453F39)', border: '1px solid #E6DFD3', borderRadius: 2,
  padding: '10px 12px', outline: 'none', background: 'var(--surface, #FFFFFF)',
  transition: 'border-color 0.15s ease', width: '100%', boxSizing: 'border-box' as const,
};

const compactInput: CSSProperties = { ...inputBase, fontSize: 12, borderRadius: 2, padding: '7px 10px' };

const labelStyle: CSSProperties = {
  fontSize: 12, fontWeight: 500, color: 'var(--t2, #6E665D)',
  fontFamily: 'var(--font-primary)', display: 'block', marginBottom: 6,
};

const divider: CSSProperties = { height: 1, background: '#E6DFD3', margin: '20px 0', border: 'none' };

const ACCENT = '#B89550';

/* ── Default course labels ── */

const LABELS_3 = ['Starter', 'Main Course', 'Dessert'];
const LABELS_5 = ['Amuse-Bouche', 'Soup', 'Starter', 'Main Course', 'Dessert'];

function getDefaultLabels(count: number): string[] {
  if (count === 3) return [...LABELS_3];
  if (count === 5) return [...LABELS_5];
  return Array.from({ length: count }, (_, i) => `Course ${i + 1}`);
}

/* ── Form state types ── */

interface EligibleItemForm { itemId: string; supplementPrice: number | ''; }

interface CourseForm {
  id: string;
  label: string;
  categoryId: string;
  minSelections: number;
  maxSelections: number;
  eligibleItems: EligibleItemForm[];
  /** PCF-15: Modifier sets attached to this course */
  courseModifierIds: string[];
}

interface FormState {
  name: string;
  description: string;
  price: number | '';
  courseCount: number;
  courses: CourseForm[];
  status: ItemStatus;
}

function makeCourse(index: number, label: string): CourseForm {
  return {
    id: `course-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    label, courseModifierIds: [],
    categoryId: '',
    minSelections: 1,
    maxSelections: 1,
    eligibleItems: [],
  };
}

function buildDefaultCourses(count: number): CourseForm[] {
  return getDefaultLabels(count).map((label, i) => makeCourse(i, label));
}

const emptyForm: FormState = {
  name: '',
  description: '',
  price: '',
  courseCount: 3,
  courses: buildDefaultCourses(3),
  status: 'draft',
};

function menuToForm(menu: SetMenu, isClone: boolean): FormState {
  return {
    name: isClone ? withCloneNameLabel(menu.name) : menu.name,
    description: menu.description ?? '',
    price: menu.price,
    courseCount: menu.courseCount,
    courses: menu.courses.map((c) => ({
      id: isClone ? `course-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : c.id,
      label: c.label,
      categoryId: c.categoryId ?? '',
      minSelections: c.minSelections,
      maxSelections: c.maxSelections,
      eligibleItems: c.eligibleItems.map((ei) => ({ itemId: ei.itemId, supplementPrice: ei.supplementPrice })),
      courseModifierIds: c.courseModifierIds ?? [],
    })),
    status: isClone ? 'draft' : menu.status,
  };
}

/* ── Drag handle ── */

function DragHandle({ listeners, attributes }: { listeners?: any; attributes?: any }) {
  return (
    <span
      {...listeners}
      {...attributes}
      style={{ cursor: 'grab', color: '#9A9084', display: 'flex', alignItems: 'center', touchAction: 'none' }}
    >
      <span className="material-symbols-rounded" style={{ fontSize: 20 }}>drag_indicator</span>
    </span>
  );
}

/* ── Sortable Course Row ── */

function SortableCourseRow({
  course, index, categories, allItems, modifiers, onUpdate, onRemove, canRemove, isMobile,
}: {
  course: CourseForm;
  index: number;
  categories: { id: string; name: string }[];
  allItems: { id: string; name: string; categoryIds: string[]; status: string }[];
  modifiers: { id: string; name: string }[];
  onUpdate: (updates: Partial<CourseForm>) => void;
  onRemove: () => void;
  canRemove: boolean;
  isMobile: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: course.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: '#FDFCF9',
    border: '1px solid #E6DFD3',
    borderRadius: 2,
    padding: isMobile ? 14 : 18,
    marginBottom: 12,
  };

  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');

  const filteredItems = useMemo(() => {
    let pool = allItems.filter((it) => it.status === 'active');
    if (course.categoryId) pool = pool.filter((it) => it.categoryIds.includes(course.categoryId));
    if (search.trim()) {
      const q = search.toLowerCase();
      pool = pool.filter((it) => it.name.toLowerCase().includes(q));
    }
    const selectedIds = new Set(course.eligibleItems.map((e) => e.itemId));
    return pool.filter((it) => !selectedIds.has(it.id)).slice(0, 30);
  }, [allItems, course.categoryId, course.eligibleItems, search]);

  const handleCategoryChange = (catId: string) => {
    onUpdate({ categoryId: catId });
    if (catId) {
      const catItems = allItems
        .filter((it) => it.status === 'active' && it.categoryIds.includes(catId))
        .slice(0, 20)
        .map((it) => ({ itemId: it.id, supplementPrice: 0 as number | '' }));
      onUpdate({ categoryId: catId, eligibleItems: catItems });
    }
  };

  const addItem = (itemId: string) => {
    onUpdate({ eligibleItems: [...course.eligibleItems, { itemId, supplementPrice: '' }] });
  };

  const removeItem = (itemId: string) => {
    onUpdate({ eligibleItems: course.eligibleItems.filter((e) => e.itemId !== itemId) });
  };

  const updateSupplement = (itemId: string, val: number | '') => {
    onUpdate({
      eligibleItems: course.eligibleItems.map((e) =>
        e.itemId === itemId ? { ...e, supplementPrice: val } : e
      ),
    });
  };

  const catOptions = [{ value: '', label: 'All Categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))];

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <DragHandle listeners={listeners} attributes={attributes} />
        <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, minWidth: 24 }}>#{index + 1}</span>
        <input
          value={course.label}
          onChange={(e) => onUpdate({ label: e.target.value.slice(0, 30) })}
          placeholder="Course label"
          style={{ ...compactInput, flex: 1, fontWeight: 600 }}
        />
        {canRemove && (
          <button type="button" onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A63D2F', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-primary)' }}>
            Remove
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 100px 100px', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Category (optional)</label>
          <select
            value={course.categoryId}
            onChange={(e) => handleCategoryChange(e.target.value)}
            style={{ ...compactInput, cursor: 'pointer' }}
          >
            {catOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Min select</label>
          <input
            type="number" min={0} max={20}
            value={course.minSelections}
            onChange={(e) => onUpdate({ minSelections: Math.max(0, Number(e.target.value)) })}
            style={compactInput}
          />
        </div>
        <div>
          <label style={labelStyle}>Max select</label>
          <input
            type="number" min={1} max={20}
            value={course.maxSelections}
            onChange={(e) => onUpdate({ maxSelections: Math.max(1, Number(e.target.value)) })}
            style={compactInput}
          />
        </div>
      </div>

      {/* Eligible items chips */}
      <label style={labelStyle}>{/* was: Eligible Items */}Eligible Products ({course.eligibleItems.length})</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {course.eligibleItems.length === 0 && (
          <span style={{ fontSize: 11, color: '#9A9084', fontStyle: 'italic' }}>{/* was: No items added yet */}No products added yet</span>
        )}
        {course.eligibleItems.map((ei) => {
          const item = allItems.find((it) => it.id === ei.itemId);
          return (
            <span key={ei.itemId} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
              padding: '4px 8px', borderRadius: 2, background: '#F4F0E8', color: '#453F39',
              fontFamily: 'var(--font-primary)',
            }}>
              {item?.name ?? ei.itemId}
              <input
                type="number"
                value={ei.supplementPrice}
                onChange={(e) => updateSupplement(ei.itemId, e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="$0"
                style={{
                  width: 48, fontSize: 10, padding: '2px 4px', border: '1px solid #E6DFD3',
                  borderRadius: 4, outline: 'none', textAlign: 'right', background: '#fff',
                }}
                title="Supplement price"
              />
              <span
                onClick={() => removeItem(ei.itemId)}
                className="material-symbols-rounded"
                style={{ fontSize: 13, color: '#A63D2F', cursor: 'pointer' }}
              >close</span>
            </span>
          );
        })}
      </div>

      {/* Add items picker */}
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px',
          borderRadius: 2, border: `1.5px dashed ${ACCENT}`, background: 'transparent',
          color: ACCENT, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)',
        }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: 14 }}>add</span>
        {/* was: Add Items */}Add Products
      </button>

      {showPicker && (
        <div style={{
          marginTop: 8, maxHeight: 180, overflowY: 'auto', border: '1px solid #E6DFD3',
          borderRadius: 2, padding: 6, background: '#fff',
        }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..." /* was: placeholder="Search items..." */
            style={{ ...compactInput, marginBottom: 4 }}
          />
          {filteredItems.length === 0 && (
            <div style={{ fontSize: 11, color: '#9A9084', padding: 8, textAlign: 'center' }}>{/* was: No items found */}No products found</div>
          )}
          {filteredItems.map((it) => (
            <div
              key={it.id}
              onClick={() => addItem(it.id)}
              style={{
                padding: '6px 8px', borderRadius: 2, cursor: 'pointer', fontSize: 12,
                fontFamily: 'var(--font-primary)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#F4F0E8'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              {it.name}
            </div>
          ))}
        </div>
      )}

      {/* PCF-15: Course-level modifiers */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3, #9A9084)', marginBottom: 6, fontFamily: 'var(--font-primary)' }}>
          Course Modifiers
          <span style={{ fontWeight: 400, marginLeft: 4 }}>{/* was: (appear for any item in this course) */}(appear for any product in this course)</span>
        </div>
        {course.courseModifierIds.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {course.courseModifierIds.map((mid) => {
              const mod = modifiers.find((m: any) => m.id === mid);
              return (
                <span key={mid} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 8px', borderRadius: 2, background: 'rgba(139,92,246,0.08)', color: '#8C6A7A', fontFamily: 'var(--font-primary)' }}>
                  {mod?.name ?? mid}
                  <span className="material-symbols-rounded" style={{ fontSize: 13, cursor: 'pointer', color: '#A63D2F' }}
                    onClick={() => onUpdate({ courseModifierIds: course.courseModifierIds.filter((id: string) => id !== mid) })}>close</span>
                </span>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            // Add first available modifier not already assigned
            const available = modifiers.filter((m: any) => !course.courseModifierIds.includes(m.id));
            if (available.length > 0) {
              onUpdate({ courseModifierIds: [...course.courseModifierIds, available[0].id] });
            }
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 2, border: '1px dashed #8C6A7A', background: 'transparent', color: '#8C6A7A', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>add</span>
          Add Modifier
        </button>
      </div>
    </div>
  );
}

/* ── Main form component ── */

export default function SetMenuFormPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { setMenus, editingSetMenuId, addSetMenu, updateSetMenu } = useSetMenusStore();
  const { items } = useItemsStore();
  const { categories } = useCategoriesStore();
  const { modifiers } = useModifiersStore();
  const { addToast } = useToastStore();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const isEditRoute = location.pathname === pcPaths.setMenuEdit;
  const id = isEditRoute ? editingSetMenuId : null;
  const isEdit = Boolean(id);
  const existing = isEdit ? setMenus.find((m) => m.id === id) : null;
  const cloneId = !isEdit ? searchParams.get('clone')?.trim() || null : null;
  const cloneSource = useMemo(
    () => (!isEdit && cloneId ? setMenus.find((m) => m.id === cloneId) ?? null : null),
    [isEdit, cloneId, setMenus],
  );

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({
      title: isEdit ? 'Edit Set Menu' : 'New Set Menu',
      breadcrumbs: 'Product Catalog > Set Menus',
    });
  }, [setTopBarProps, isEdit]);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hydrateKeyRef = useRef('');

  useEffect(() => {
    if (isEdit && existing) {
      const key = `edit:${id}`;
      if (hydrateKeyRef.current === key) return;
      hydrateKeyRef.current = key;
      setForm(menuToForm(existing, false));
      return;
    }
    if (cloneSource) {
      const key = `clone:${cloneId}`;
      if (hydrateKeyRef.current === key) return;
      hydrateKeyRef.current = key;
      setForm(menuToForm(cloneSource, true));
      return;
    }
    if (!isEdit && hydrateKeyRef.current !== 'new') {
      hydrateKeyRef.current = 'new';
      setForm(emptyForm);
    }
  }, [isEdit, id, existing, cloneId, cloneSource]);

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  /* Course count adjustment */
  const setCourseCount = (count: number) => {
    const clamped = Math.max(2, Math.min(10, count));
    setForm((prev) => {
      const current = prev.courses;
      let next: CourseForm[];
      if (clamped > current.length) {
        const labels = getDefaultLabels(clamped);
        const additions = labels.slice(current.length).map((lbl, i) => makeCourse(current.length + i, lbl));
        next = [...current, ...additions];
      } else {
        next = current.slice(0, clamped);
      }
      return { ...prev, courseCount: clamped, courses: next };
    });
  };

  /* Course helpers */
  const updateCourse = (idx: number, updates: Partial<CourseForm>) => {
    setForm((prev) => ({
      ...prev,
      courses: prev.courses.map((c, i) => (i === idx ? { ...c, ...updates } : c)),
    }));
  };

  const removeCourse = (idx: number) => {
    setForm((prev) => {
      const next = prev.courses.filter((_, i) => i !== idx);
      return { ...prev, courseCount: next.length, courses: next };
    });
  };

  /* DnD */
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setForm((prev) => {
      const oldIdx = prev.courses.findIndex((c) => c.id === active.id);
      const newIdx = prev.courses.findIndex((c) => c.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return { ...prev, courses: arrayMove(prev.courses, oldIdx, newIdx) };
    });
  };

  /* Validation */
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (form.name.length > 30) errs.name = 'Name must be 30 characters or less';
    if (!form.price || Number(form.price) <= 0) errs.price = 'Price is required';
    form.courses.forEach((c, i) => {
      if (c.eligibleItems.length === 0) errs[`course_${i}`] = `${c.label || `Course ${i + 1}`} needs at least 1 product`; /* was: needs at least 1 item */
      if (c.maxSelections < c.minSelections) errs[`course_sel_${i}`] = `${c.label}: max must be ≥ min`;
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* Save */
  const handleSave = () => {
    if (!validate()) {
      addToast('Please fix the errors before saving', 'error');
      return;
    }
    const courses: SetMenuCourse[] = form.courses.map((c, i) => ({
      id: c.id,
      label: c.label,
      categoryId: c.categoryId || undefined,
      minSelections: c.minSelections,
      maxSelections: c.maxSelections,
      sortPosition: i,
      eligibleItems: c.eligibleItems.map((ei) => ({
        itemId: ei.itemId,
        supplementPrice: Number(ei.supplementPrice) || 0,
      })),
    }));

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price: Number(form.price),
      courseCount: form.courseCount,
      courses,
      status: form.status,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    if (isEdit && id) {
      updateSetMenu(id, payload);
      addToast('Set menu updated', 'success');
    } else {
      addSetMenu(payload);
      addToast('Set menu created', 'success');
    }
    navigate(pcPaths.setMenus);
  };

  /* Category options for course rows */
  const catList = useMemo(() => categories.map((c) => ({ id: c.id, name: c.name })), [categories]);
  const itemList = useMemo(
    () => items.map((it) => ({ id: it.id, name: it.name, categoryIds: it.categoryIds, status: it.status })),
    [items],
  );

  const courseIds = useMemo(() => form.courses.map((c) => c.id), [form.courses]);

  /* Render */
  const content = (
    <div style={isMobile ? { ...formPageOuterStyle, height: 'auto' } : formPageOuterStyle}>
      {/* Mobile header */}
      {isMobile && (
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span onClick={() => navigate(pcPaths.setMenus)} className="material-symbols-rounded" style={{ fontSize: 22, color: '#453F39', cursor: 'pointer' }}>arrow_back</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: 0 }}>{isEdit ? 'Edit Set Menu' : 'New Set Menu'}</h1>
        </div>
      )}

      <div style={formPageMainScrollStyle}>
        <div style={{ padding: isMobile ? 16 : 32 }}>
          <div style={cardStyle}>

            {/* ── Identity ── */}
            <p style={sectionTitle}>SET MENU DETAILS</p>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => patch('name', e.target.value.slice(0, 30))}
                  placeholder="e.g. Sunday Brunch Prix Fixe"
                  style={{ ...inputBase, borderColor: errors.name ? '#A63D2F' : '#E6DFD3' }}
                />
                {errors.name && <span style={{ fontSize: 11, color: '#A63D2F', marginTop: 2, display: 'block' }}>{errors.name}</span>}
                <span style={{ fontSize: 10, color: '#9A9084', float: 'right' }}>{form.name.length}/30</span>
              </div>
              <div>
                <label style={labelStyle}>Price *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9A9084' }}>$</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={form.price}
                    onChange={(e) => patch('price', e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0.00"
                    style={{ ...inputBase, paddingLeft: 28, borderColor: errors.price ? '#A63D2F' : '#E6DFD3' }}
                  />
                </div>
                {errors.price && <span style={{ fontSize: 11, color: '#A63D2F', marginTop: 2, display: 'block' }}>{errors.price}</span>}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => patch('description', e.target.value)}
                placeholder="Describe the set menu experience..."
                rows={3}
                style={{ ...inputBase, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <div>
                <label style={labelStyle}>Status</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['draft', 'active'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => patch('status', s)}
                      style={{
                        padding: '6px 14px', borderRadius: 2, fontSize: 12, fontWeight: 600,
                        border: form.status === s ? `1.5px solid ${ACCENT}` : '1px solid #E6DFD3',
                        background: form.status === s ? `${ACCENT}08` : '#fff',
                        color: form.status === s ? ACCENT : '#6E665D',
                        cursor: 'pointer', fontFamily: 'var(--font-primary)', textTransform: 'capitalize',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <hr style={divider} />

            {/* ── Courses ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ ...sectionTitle, margin: 0 }}>COURSES ({form.courseCount})</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  disabled={form.courseCount <= 2}
                  onClick={() => setCourseCount(form.courseCount - 1)}
                  style={{
                    width: 28, height: 28, borderRadius: 2, border: '1px solid #E6DFD3',
                    background: '#fff', cursor: form.courseCount <= 2 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: form.courseCount <= 2 ? '#D6CCBB' : '#453F39', fontSize: 16, fontWeight: 700,
                  }}
                >−</button>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#453F39', minWidth: 20, textAlign: 'center' }}>
                  {form.courseCount}
                </span>
                <button
                  type="button"
                  disabled={form.courseCount >= 10}
                  onClick={() => setCourseCount(form.courseCount + 1)}
                  style={{
                    width: 28, height: 28, borderRadius: 2, border: '1px solid #E6DFD3',
                    background: '#fff', cursor: form.courseCount >= 10 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: form.courseCount >= 10 ? '#D6CCBB' : '#453F39', fontSize: 16, fontWeight: 700,
                  }}
                >+</button>
              </div>
            </div>

            {/* Validation errors for courses */}
            {Object.entries(errors).filter(([k]) => k.startsWith('course')).map(([k, v]) => (
              <div key={k} style={{ fontSize: 11, color: '#A63D2F', marginBottom: 6 }}>{v}</div>
            ))}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={courseIds} strategy={verticalListSortingStrategy}>
                {form.courses.map((course, idx) => (
                  <SortableCourseRow
                    key={course.id}
                    course={course}
                    index={idx}
                    categories={catList}
                    allItems={itemList}
                    modifiers={modifiers.map((m) => ({ id: m.id, name: m.name }))}
                    onUpdate={(updates) => updateCourse(idx, updates)}
                    onRemove={() => removeCourse(idx)}
                    canRemove={form.courseCount > 2}
                    isMobile={isMobile}
                  />
                ))}
              </SortableContext>
            </DndContext>

          </div>
        </div>
      </div>

      {/* Footer action bar */}
      <div style={isMobile ? { ...formStickyActionBarFooterStyle, position: 'fixed' as const, bottom: 0, left: 0, right: 0, zIndex: 100, padding: 16 } : formStickyActionBarFooterStyle}>
        <button type="button" style={formCancelButtonStyle} onClick={() => navigate(pcPaths.setMenus)}>
          Cancel
        </button>
        <button type="button" style={formSaveButtonStyle} onClick={handleSave}>
          {isEdit ? 'Update Set Menu' : 'Create Set Menu'}
        </button>
      </div>
    </div>
  );

  if (isEditRoute && !editingSetMenuId) {
    return <Navigate to={pcPaths.setMenus} replace />;
  }

  if (isMobile) {
    return (
      <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif", paddingBottom: 80 }}>
        {content}
      </div>
    );
  }

  return <DesktopLayout>{content}</DesktopLayout>;
}
