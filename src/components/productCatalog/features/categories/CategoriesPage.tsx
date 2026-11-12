import { useState, useMemo, useEffect, useCallback, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type Modifier,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCategoriesStore, useItemsStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import { useErrorToast } from '../../hooks/useErrorToast';
import PageHeader from '../../components/layout/PageHeader';
import CatalogHelpLink from '../../components/layout/CatalogHelpLink';
import CategoriesTutorial from '../../components/tutorials/categories-tutorial';
import SearchInput from '../../components/forms/SearchInput';
import { Button } from '../../components/ui/Button';
import { CatalogListEmptyState } from '../../components/ui/CatalogListEmptyState';
import { DeleteConfirmationModal, deleteConfirmTitle } from '../../components/ui/DeleteConfirmationModal';
import type { Category } from '../../data/types';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { pcPaths, PC_BASE } from '../../paths';
import BottomNav from '../../../BottomNav';
import {
  catalogListActionButtonStyle,
  catalogListActionEnterDefault,
  catalogListActionLeaveDefault,
  catalogListActionEnterDanger,
  catalogListActionLeaveDanger,
  CATALOG_LIST_ACTION_ICON_PX,
} from '../../catalogEntityActions';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Bone } from '../../../../components/Shimmer';
import { ProductCatalogSyncBanner } from '../../components/ui/ProductCatalogSyncBanner';

// Restrict drag to vertical axis only (no sideways jitter)
const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});

/* ─── tokens (aligned with MenusPage / Copy) ─── */

const ACCENT = '#B89550';
const ACCENT_BG = 'rgba(184,149,80,0.08)';
const T1 = '#453F39';
const T2 = '#6E665D';
const T3 = '#9A9084';
// const GREEN = '#5F7A55';
// const RED = '#A63D2F';
const BORDER = '#E6DFD3';
const MAX_VISIBLE_ORDER_TYPES = 4;

import { isPickupOrderType } from '../../utils/outletOrderTypes';

interface OutletOrderType {
  id: string;
  typeName: string;
  typeGroup?: string;
}

function getChannelDisplayName(typeName: string): string {
  const n = (typeName ?? '').toLowerCase();
  // Pickup channel is shown to users as "Online" (original name kept in the data).
  if (/(takeout|take_out|takeaway|take_away|pickup|pick_up)/.test(n.replace(/[\s-]+/g, '_'))) return 'Online';
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
    return notInstore && isPickupOrderType(ot);
  });
}

interface TreeNode {
  category: Category;
  depth: number;
}

function buildTree(categories: Category[]): TreeNode[] {
  const parentMap = new Map<string | undefined, Category[]>();
  for (const cat of categories) {
    const key = cat.parentCategoryId || '__root__';
    if (!parentMap.has(key)) parentMap.set(key, []);
    parentMap.get(key)!.push(cat);
  }

  const result: TreeNode[] = [];

  function addChildren(parentId: string | undefined, depth: number) {
    const key = parentId || '__root__';
    const children = parentMap.get(key) || [];
    const sorted = [...children].sort((a, b) => a.sortPosition - b.sortPosition);
    for (const cat of sorted) {
      result.push({ category: cat, depth });
      addChildren(cat.id, depth + 1);
    }
  }

  addChildren(undefined, 0);
  return result;
}

function siblingKey(cat: Category): string {
  return cat.parentCategoryId ?? '__root__';
}

function sortedSiblings(categories: Category[], parentCategoryId: string | undefined): Category[] {
  return categories
    .filter((c) =>
      parentCategoryId === undefined ? !c.parentCategoryId : c.parentCategoryId === parentCategoryId,
    )
    .sort((a, b) => a.sortPosition - b.sortPosition);
}

function buildCategoryTotalItemCountMap(categories: Category[]): Map<string, number> {
  const childrenByParent = new Map<string, Category[]>();
  categories.forEach((cat) => {
    if (!cat.parentCategoryId) return;
    const siblings = childrenByParent.get(cat.parentCategoryId);
    if (siblings) siblings.push(cat);
    else childrenByParent.set(cat.parentCategoryId, [cat]);
  });

  const totals = new Map<string, number>();
  const dfs = (category: Category): number => {
    const own = Number(category.itemCount ?? 0) || 0;
    const children = childrenByParent.get(category.id) ?? [];
    const childTotal = children.reduce((sum, child) => sum + dfs(child), 0);
    const total = children.length > 0 ? childTotal : own;
    totals.set(category.id, total);
    return total;
  };

  categories.forEach((cat) => {
    if (!totals.has(cat.id)) dfs(cat);
  });

  return totals;
}

/* ─── 6-dot drag handle (RewardsCatalog-style) ─── */

function DragHandle({
  listeners,
  attributes,
  disabled,
}: {
  listeners?: DraggableSyntheticListeners;
  attributes?: DraggableAttributes;
  disabled?: boolean;
}) {
  return (
    <div
      {...(disabled ? {} : listeners)}
      {...(disabled ? {} : attributes)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px 4px',
        cursor: disabled ? 'default' : 'grab',
        color: T3,
        borderRadius: 4,
        flexShrink: 0,
        touchAction: 'none',
        opacity: disabled ? 0.45 : 1,
      }}
      title={disabled ? 'Clear search to reorder' : 'Drag to reorder'}
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

type RowCallbacks = {
  navigate: ReturnType<typeof useNavigate>;
  setEditingCategoryId: (id: string) => void;
  getParentName: (parentId?: string) => string | null;
  getDisplayItemCount: (category: Category) => number;
  handleDelete: (id: string) => void;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  outletOrderTypes: OutletOrderType[];
  highlightId: string | null;
};

function CategoryCardBody({
  cat,
  depth,
  isSm,
  isMd,
  cb,
  cardBaseShadow,
  cardHoverShadow,
  dragHandle,
}: {
  cat: Category;
  depth: number;
  isSm: boolean;
  isMd: boolean;
  cb: RowCallbacks;
  cardBaseShadow: string;
  cardHoverShadow: string;
  dragHandle: ReactNode;
}) {
  const isSubcategory = depth > 0;
  const parentName = cb.getParentName(cat.parentCategoryId);
  const displayItemCount = cb.getDisplayItemCount(cat);
  // Derive enabled channels from API data: match cat.channelVisibility against location's order types
  const enabledChannels = useMemo(() => {
    const cvMap = new Map((cat.channelVisibility ?? []).map((cv) => [cv.orderTypeId, cv.enabled]));
    return cb.outletOrderTypes.filter((ot) => {
      const enabled = cvMap.get(ot.id);
      return enabled === true;
    });
  }, [cat.channelVisibility, cb.outletOrderTypes]);
  const isHovered = cb.hoveredId === cat.id;
  const desc = cat.description?.trim();

  return (
    <div
      id={`catalog-category-row-${cat.id}`}
      style={{
        position: 'relative',
        marginLeft: isSubcategory ? 32 : 0,
      }}
    >
      {isSubcategory && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 12,
            bottom: 12,
            width: 3,
            borderRadius: 999,
            background: ACCENT,
          }}
        />
      )}
      <div
        onMouseEnter={() => cb.setHoveredId(cat.id)}
        onMouseLeave={() => cb.setHoveredId(null)}
        style={{
          background: '#FFFFFF',
          border: `1px solid ${BORDER}`,
          borderRadius: 2,
          boxShadow: String(cb.highlightId) === String(cat.id)
            ? 'inset 0 0 0 2px rgba(184,149,80,0.9)'
            : isHovered ? cardHoverShadow : cardBaseShadow,
          paddingLeft: isSubcategory ? 16 : 0,
          transition: 'box-shadow 0.15s ease',
        }}
      >
        <div style={{ padding: isSm ? '14px 16px' : '12px 14px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: isSm ? 'center' : 'flex-start',
              gap: isSm ? 14 : 8,
            }}
          >
            {dragHandle}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginBottom: desc ? 4 : 0,
                }}
              >
                <span
                 
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: T1,
                    fontFamily: 'var(--font-primary, Jost, sans-serif)',
                    minWidth: 0,
                    wordBreak: 'break-word',
                  }}
                >
                  {cat.name.length > 60 ? cat.name.slice(0, 60) + '...' : cat.name}
                </span>

                {isSubcategory && parentName && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 500,
                      color: T2,
                      background: '#F4F0E8',
                      border: `1px solid ${BORDER}`,
                      borderRadius: 2,
                      padding: '2px 8px',
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: 13 }}>
                      account_tree
                    </span>
                    {parentName}
                  </span>
                )}

                {/* Visible / Hidden badge — hidden until isVisible is wired from API / product wants it shown */}
                {/* <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: 11,
                    fontWeight: 500,
                    borderRadius: 2,
                    padding: '2px 8px',
                    background: cat.isVisible ? 'rgba(95,122,85,0.08)' : 'rgba(166,61,47,0.08)',
                    color: cat.isVisible ? GREEN : RED,
                  }}
                >
                  {cat.isVisible ? 'Visible' : 'Hidden'}
                </span> */}
              </div>

              {desc ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: T2,
                    fontFamily: 'var(--font-primary)',
                    lineHeight: 1.45,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={desc}
                >
                  {desc}
                </p>
              ) : null}
            </div>

            {isSm ? (
              <span
                style={{
                  fontSize: 13,
                  color: T2,
                  fontFamily: 'var(--font-primary)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontWeight: 600, color: T1 }}>{displayItemCount}</span> items
              </span>
            ) : null}

            {isMd ? (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
                {enabledChannels.slice(0, MAX_VISIBLE_ORDER_TYPES).map((ot) => (
                  <span
                    key={ot.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontSize: 11,
                      fontWeight: 600,
                      color: ACCENT,
                      background: ACCENT_BG,
                      borderRadius: 2,
                      padding: '2px 8px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getChannelDisplayName(ot.typeName)}
                  </span>
                ))}
                {enabledChannels.length > MAX_VISIBLE_ORDER_TYPES && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontSize: 11,
                      fontWeight: 600,
                      color: T2,
                      background: '#F4F0E8',
                      borderRadius: 2,
                      padding: '2px 8px',
                      whiteSpace: 'nowrap',
                    }}
                    title={enabledChannels.slice(MAX_VISIBLE_ORDER_TYPES).map((ot) => getChannelDisplayName(ot.typeName)).join(', ')}
                  >
                    +{enabledChannels.length - MAX_VISIBLE_ORDER_TYPES}
                  </span>
                )}
              </div>
            ) : null}

            {isSm ? (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => { cb.setEditingCategoryId(cat.id); cb.navigate(pcPaths.categoryEdit); }}
                  style={catalogListActionButtonStyle}
                  title="Edit"
                  onMouseEnter={catalogListActionEnterDefault}
                  onMouseLeave={catalogListActionLeaveDefault}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>
                    edit
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => cb.handleDelete(cat.id)}
                  style={catalogListActionButtonStyle}
                  title="Delete"
                  onMouseEnter={catalogListActionEnterDanger}
                  onMouseLeave={catalogListActionLeaveDanger}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>delete</span>
                </button>
              </div>
            ) : null}
          </div>

          {!isSm ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 10,
                paddingLeft: 28,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <span style={{ fontSize: 12, color: T2, fontFamily: 'var(--font-primary)' }}>
                <span style={{ fontWeight: 600, color: T1 }}>{displayItemCount}</span> items
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => { cb.setEditingCategoryId(cat.id); cb.navigate(pcPaths.categoryEdit); }}
                  style={catalogListActionButtonStyle}
                  title="Edit"
                  onMouseEnter={catalogListActionEnterDefault}
                  onMouseLeave={catalogListActionLeaveDefault}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>
                    edit
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => cb.handleDelete(cat.id)}
                  style={catalogListActionButtonStyle}
                  title="Delete"
                  onMouseEnter={catalogListActionEnterDanger}
                  onMouseLeave={catalogListActionLeaveDanger}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>delete</span>
                </button>
              </div>
            </div>
          ) : null}

          {!isMd && enabledChannels.length > 0 ? (
            <div
              style={{
                display: 'flex',
                gap: 4,
                flexWrap: 'wrap',
                marginTop: 10,
                paddingLeft: 28,
              }}
            >
              {enabledChannels.map((ot) => (
                <span
                  key={ot.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: 10,
                    fontWeight: 600,
                    color: ACCENT,
                    background: ACCENT_BG,
                    borderRadius: 2,
                    padding: '2px 8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {getChannelDisplayName(ot.typeName)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SortableCategoryRow({
  cat,
  depth,
  isSm,
  isMd,
  cb,
  cardBaseShadow,
  cardHoverShadow,
}: {
  cat: Category;
  depth: number;
  isSm: boolean;
  isMd: boolean;
  cb: RowCallbacks;
  cardBaseShadow: string;
  cardHoverShadow: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cat.id,
    transition: {
      duration: 200,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform ? { ...transform, scaleX: 1, scaleY: 1 } : null),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 999 : undefined,
    position: 'relative',
    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : undefined,
    borderRadius: isDragging ? 'var(--radius-card, 14px)' : undefined,
    background: isDragging ? 'var(--surface, #fff)' : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CategoryCardBody
        cat={cat}
        depth={depth}
        isSm={isSm}
        isMd={isMd}
        cb={cb}
        cardBaseShadow={cardBaseShadow}
        cardHoverShadow={cardHoverShadow}
        dragHandle={<DragHandle listeners={listeners} attributes={attributes} />}
      />
    </div>
  );
}

function StaticCategoryRow({
  cat,
  depth,
  isSm,
  isMd,
  cb,
  cardBaseShadow,
  cardHoverShadow,
}: {
  cat: Category;
  depth: number;
  isSm: boolean;
  isMd: boolean;
  cb: RowCallbacks;
  cardBaseShadow: string;
  cardHoverShadow: string;
}) {
  return (
    <CategoryCardBody
      cat={cat}
      depth={depth}
      isSm={isSm}
      isMd={isMd}
      cb={cb}
      cardBaseShadow={cardBaseShadow}
      cardHoverShadow={cardHoverShadow}
      dragHandle={<DragHandle disabled />}
    />
  );
}

function CategorySubtree({
  parentId,
  depth,
  categories,
  isSm,
  isMd,
  cb,
  cardBaseShadow,
  cardHoverShadow,
}: {
  parentId: string;
  depth: number;
  categories: Category[];
  isSm: boolean;
  isMd: boolean;
  cb: RowCallbacks;
  cardBaseShadow: string;
  cardHoverShadow: string;
}) {
  const children = useMemo(
    () => sortedSiblings(categories, parentId),
    [categories, parentId],
  );
  if (children.length === 0) return null;

  return (
    <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children.map((cat) => (
          <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SortableCategoryRow
              cat={cat}
              depth={depth}
              isSm={isSm}
              isMd={isMd}
              cb={cb}
              cardBaseShadow={cardBaseShadow}
              cardHoverShadow={cardHoverShadow}
            />
            <CategorySubtree
              parentId={cat.id}
              depth={depth + 1}
              categories={categories}
              isSm={isSm}
              isMd={isMd}
              cb={cb}
              cardBaseShadow={cardBaseShadow}
              cardHoverShadow={cardHoverShadow}
            />
          </div>
        ))}
      </div>
    </SortableContext>
  );
}

function CategoryTreeDnD({
  categories,
  isSm,
  isMd,
  cb,
  cardBaseShadow,
  cardHoverShadow,
  onDragEnd,
}: {
  categories: Category[];
  isSm: boolean;
  isMd: boolean;
  cb: RowCallbacks;
  cardBaseShadow: string;
  cardHoverShadow: string;
  onDragEnd: (e: DragEndEvent) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const roots = useMemo(() => sortedSiblings(categories, undefined), [categories]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
      <SortableContext items={roots.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {roots.map((cat) => (
            <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SortableCategoryRow
                cat={cat}
                depth={0}
                isSm={isSm}
                isMd={isMd}
                cb={cb}
                cardBaseShadow={cardBaseShadow}
                cardHoverShadow={cardHoverShadow}
              />
              <CategorySubtree
                parentId={cat.id}
                depth={1}
                categories={categories}
                isSm={isSm}
                isMd={isMd}
                cb={cb}
                cardBaseShadow={cardBaseShadow}
                cardHoverShadow={cardHoverShadow}
              />
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function CategoriesListShimmer({ isMobile }: { isMobile: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: isMobile ? 6 : 8 }).map((_, idx) => (
        <div key={idx} style={{ background: '#fff', border: '1px solid #E6DFD3', borderRadius: 2, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bone w={18} h={18} r={4} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Bone w="35%" h={14} mb={6} />
              <Bone w="70%" h={11} />
            </div>
            <Bone w={72} h={20} r={6} />
            <Bone w={56} h={20} r={6} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CategoriesPage() {
  const navigate = useNavigate();
  const {
    categories,
    removeCategory,
    deleteCategoryOnServer,
    reorderSiblings,
    sortCategoriesOnServer,
    setEditingCategoryId,
    fetchCategories,
    clearCategoriesCache,
    toggleVisibility,
    error,
    loading,
    loadedLocationId: categoriesLoadedLocationId,
  } = useCategoriesStore();
  const { addToast } = useToastStore();
  useErrorToast(error, { fallbackMessage: 'Failed to load categories' });

  const { auth } = useAuth();
  const { selectedBranch } = useBranch();

  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingHighlightId, setPendingHighlightId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const branchLocationId = selectedBranch?.id ?? (selectedBranch as { locationId?: string })?.locationId ?? '';
  const catalogReadyForBranch =
    Boolean(branchLocationId) && categoriesLoadedLocationId === branchLocationId;

  // Effect 1: consume the ?highlight param — store as pending (category may not be in list yet)
  useEffect(() => {
    const hid = searchParams.get('highlight')?.trim();
    if (!hid || !catalogReadyForBranch) return;
    if (pendingHighlightId === hid) return;
    setPendingHighlightId(hid);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('highlight');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams, catalogReadyForBranch, pendingHighlightId]);

  // Effect 2: activate highlight, wait for row render, then scroll and clear after 3s.
  useEffect(() => {
    if (!pendingHighlightId) return;
    const hid = pendingHighlightId;
    setHighlightId(hid);

    let rafId = 0;
    let attempts = 0;
    const maxAttempts = 300; // ~5s at 60fps
    const waitForRow = () => {
      const row = document.getElementById(`catalog-category-row-${hid}`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) {
        rafId = window.requestAnimationFrame(waitForRow);
      }
    };
    rafId = window.requestAnimationFrame(waitForRow);

    const clearTimer = window.setTimeout(() => {
      setHighlightId((prev) => (prev === hid ? null : prev));
      setPendingHighlightId((prev) => (prev === hid ? null : prev));
    }, 3000);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      clearTimeout(clearTimer);
    };
  }, [pendingHighlightId]);

  const isMobile = useMediaQuery('(max-width: 768px)');
  const isSm = useMediaQuery('(min-width: 640px)');
  const isMd = useMediaQuery('(min-width: 768px)');

  const token = (auth as any)?.accessToken ?? (auth as any)?.access_token ?? null;
  const locationId = selectedBranch?.id ?? (selectedBranch as any)?.locationId ?? '';
  const outletOrderTypes = useMemo(() => getOrderTypesForBranch(selectedBranch), [selectedBranch]);

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({ title: 'Categories', breadcrumbs: 'Product Catalog' });
  }, [setTopBarProps]);

  // Fetch categories from API when branch changes
  useEffect(() => {
    if (locationId) {
      void fetchCategories(locationId, token, { skipDuplicateMs: 750 });
    }
  }, [locationId, token, fetchCategories]);

  const [search, setSearch] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(categories), [categories]);

  const filtered = useMemo(() => {
    if (!search.trim()) return tree;
    const q = search.toLowerCase();
    const matchingIds = new Set<string>();

    for (const node of tree) {
      if (
        node.category.name.toLowerCase().includes(q) ||
        node.category.description.toLowerCase().includes(q)
      ) {
        matchingIds.add(node.category.id);
      }
    }

    for (const node of tree) {
      if (node.category.parentCategoryId && matchingIds.has(node.category.parentCategoryId)) {
        matchingIds.add(node.category.id);
      }
    }

    for (const node of tree) {
      if (matchingIds.has(node.category.id) && node.category.parentCategoryId) {
        matchingIds.add(node.category.parentCategoryId);
      }
    }

    return tree.filter((n) => matchingIds.has(n.category.id));
  }, [tree, search]);

  const getParentName = useCallback(
    (parentId?: string) => {
      if (!parentId) return null;
      const parent = categories.find((c) => c.id === parentId);
      return parent ? parent.name : null;
    },
    [categories],
  );

  const categoryTotalItemCounts = useMemo(() => buildCategoryTotalItemCountMap(categories), [categories]);
  const parentCategoryIds = useMemo(
    () => new Set(categories.filter((c) => Boolean(c.parentCategoryId)).map((c) => String(c.parentCategoryId))),
    [categories],
  );
  const getDisplayItemCount = useCallback(
    (category: Category) => {
      if (!parentCategoryIds.has(category.id)) return Number(category.itemCount ?? 0) || 0;
      return categoryTotalItemCounts.get(category.id) ?? (Number(category.itemCount ?? 0) || 0);
    },
    [parentCategoryIds, categoryTotalItemCounts],
  );

  const handleDelete = useCallback((id: string) => {
    setDeleteTargetId(id);
  }, []);

  const confirmCategoryDelete = useCallback(async () => {
    if (!deleteTargetId) return;
    if (deletingCategory) return;
    try {
      setDeletingCategory(true);
      if (locationId) {
        await deleteCategoryOnServer(deleteTargetId, locationId, token);
      } else {
        removeCategory(deleteTargetId);
      }
      setDeleteTargetId(null);
      clearCategoriesCache();
      addToast('Category deleted', 'success');
      if (locationId) void fetchCategories(locationId, token, { force: true });
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to delete category', 'error');
    } finally {
      setDeletingCategory(false);
    }
  }, [deleteTargetId, deletingCategory, locationId, token, deleteCategoryOnServer, removeCategory, addToast, clearCategoriesCache, fetchCategories]);

  const deleteTarget = deleteTargetId ? categories.find((c) => c.id === deleteTargetId) : null;
  const deleteTargetChildCount = deleteTargetId
    ? categories.filter((c) => c.parentCategoryId === deleteTargetId).length
    : 0;

  const [pendingSortCount, setPendingSortCount] = useState(0);
  const [preDragSnapshot, setPreDragSnapshot] = useState<Category[] | null>(null);
  const [isSavingSort, setIsSavingSort] = useState(false);

  // Mobile three-dot menu state
  const [mobileMenuCatId, setMobileMenuCatId] = useState<string | null>(null);
  const mobileMenuBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuCatId) return;
    const handler = (e: MouseEvent) => {
      const btn = mobileMenuBtnRefs.current[mobileMenuCatId];
      if (btn && btn.contains(e.target as Node)) return;
      if (mobileMenuRef.current && mobileMenuRef.current.contains(e.target as Node)) return;
      setMobileMenuCatId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileMenuCatId]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeCat = categories.find((c) => c.id === active.id);
      const overCat = categories.find((c) => c.id === over.id);
      if (!activeCat || !overCat) return;
      if (siblingKey(activeCat) !== siblingKey(overCat)) return;

      const parentCategoryId =
        activeCat.parentCategoryId === undefined ? undefined : activeCat.parentCategoryId;
      const siblings = sortedSiblings(categories, parentCategoryId);
      const ids = siblings.map((c) => c.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = arrayMove(ids, oldIndex, newIndex);

      // Snapshot before first drag so we can revert on Cancel
      if (!preDragSnapshot) {
        setPreDragSnapshot([...categories]);
      }

      // Update local state immediately (optimistic)
      reorderSiblings(parentCategoryId, newOrder);
      setPendingSortCount((c) => c + 1);
    },
    [categories, reorderSiblings, preDragSnapshot],
  );

  const handleApplySort = useCallback(async () => {
    if (!locationId) return;
    setIsSavingSort(true);
    try {
      await sortCategoriesOnServer(locationId, token);
      addToast('Sort order saved', 'success');
      setPendingSortCount(0);
      setPreDragSnapshot(null);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to save sort order', 'error');
    } finally {
      setIsSavingSort(false);
    }
  }, [locationId, token, sortCategoriesOnServer, addToast]);

  const handleCancelSort = useCallback(() => {
    if (!preDragSnapshot) return;
    // Restore original order for each parent group
    const parentGroups = new Map<string | undefined, string[]>();
    const sorted = [...preDragSnapshot].sort((a, b) => a.sortPosition - b.sortPosition);
    for (const cat of sorted) {
      const key = cat.parentCategoryId;
      if (!parentGroups.has(key)) parentGroups.set(key, []);
      parentGroups.get(key)!.push(cat.id);
    }
    for (const [parentId, ids] of Array.from(parentGroups.entries())) {
      reorderSiblings(parentId, ids);
    }
    setPendingSortCount(0);
    setPreDragSnapshot(null);
  }, [preDragSnapshot, reorderSiblings]);

  const preDragSnapshotRef = useRef<Category[] | null>(null);
  useEffect(() => {
    preDragSnapshotRef.current = preDragSnapshot;
  }, [preDragSnapshot]);

  const reorderSiblingsRef = useRef(reorderSiblings);
  useEffect(() => {
    reorderSiblingsRef.current = reorderSiblings;
  }, [reorderSiblings]);

  useEffect(() => () => {
    const snapshot = preDragSnapshotRef.current;
    if (!snapshot) return;
    const parentGroups = new Map<string | undefined, string[]>();
    const sorted = [...snapshot].sort((a, b) => a.sortPosition - b.sortPosition);
    for (const cat of sorted) {
      const key = cat.parentCategoryId;
      if (!parentGroups.has(key)) parentGroups.set(key, []);
      parentGroups.get(key)!.push(cat.id);
    }
    for (const [parentId, ids] of Array.from(parentGroups.entries())) {
      reorderSiblingsRef.current(parentId, ids);
    }
  }, []);

  const rowCb: RowCallbacks = useMemo(
    () => ({
      navigate,
      setEditingCategoryId,
      getParentName,
      getDisplayItemCount,
      handleDelete,
      hoveredId,
      setHoveredId,
      outletOrderTypes,
      highlightId,
    }),
    [navigate, getParentName, getDisplayItemCount, handleDelete, hoveredId, outletOrderTypes, highlightId],
  );

  const pageOuter: CSSProperties = {
    height: '100%',
    maxHeight: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: '#FFFFFF',
    boxSizing: 'border-box',
  };

  const pageMainScroll: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
  };

  const cardBaseShadow = '0 1px 4px rgba(0,0,0,0.05)';
  const cardHoverShadow = '0 4px 16px rgba(0,0,0,0.08)';

  const renderEmptyNoCategories = () => (
    <div style={{ paddingTop: 72, paddingBottom: 72 }}>
      <CatalogListEmptyState
        icon="category"
        name="categories"
        title="No categories yet"
        description="Create categories to organize your menu items into logical groups like appetizers, mains, and desserts."
        action={(
          <Button
            onClick={() => navigate(pcPaths.categoriesCreate)}
            style={{
              background: ACCENT,
              color: '#fff',
              borderRadius: 2,
              fontWeight: 600,
              fontSize: 14,
              padding: '10px 20px',
            }}
            icon={(
              <span className="material-symbols-rounded" style={{ fontSize: 18, color: '#fff' }}>
                add
              </span>
            )}
          >
            Add Category
          </Button>
        )}
      />
    </div>
  );

  const renderEmptySearch = () => (
    <div
      style={{
        padding: '48px 16px',
        background: '#fff',
        border: `1px solid ${BORDER}`,
        borderRadius: 2,
        boxShadow: cardBaseShadow,
      }}
    >
      <CatalogListEmptyState
        icon="category"
        name="categories"
        description="Try adjusting your search query."
      />
    </div>
  );

  const searchActive = Boolean(search.trim());

  const deleteModal = (
    <DeleteConfirmationModal
      open={Boolean(deleteTarget)}
      onClose={() => setDeleteTargetId(null)}
      onConfirm={confirmCategoryDelete}
      confirmLoading={deletingCategory}
      title={deleteTarget ? deleteConfirmTitle(deleteTarget.name) : deleteConfirmTitle('this category')}
      description={
        deleteTarget ? (
          <>
            {deleteTarget.itemCount > 0 ? (
              <>
                Contains {deleteTarget.itemCount} item{deleteTarget.itemCount !== 1 ? 's' : ''}.{' '}
              </>
            ) : null}
            {deleteTargetChildCount > 0 ? (
              <>
                This category has {deleteTargetChildCount} subcategor
                {deleteTargetChildCount !== 1 ? 'ies' : 'y'}.{' '}
              </>
            ) : null}
            This will remove the category from menus and the catalog. This cannot be undone.
          </>
        ) : null
      }
    />
  );

  const categoryList = loading ? (
    <CategoriesListShimmer isMobile={isMobile} />
  ) : categories.length === 0 ? (
    renderEmptyNoCategories()
  ) : filtered.length === 0 ? (
    renderEmptySearch()
  ) : searchActive ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {filtered.map(({ category: cat, depth }) => (
        <StaticCategoryRow
          key={cat.id}
          cat={cat}
          depth={depth}
          isSm={isSm}
          isMd={isMd}
          cb={rowCb}
          cardBaseShadow={cardBaseShadow}
          cardHoverShadow={cardHoverShadow}
        />
      ))}
    </div>
  ) : (
    <CategoryTreeDnD
      categories={categories}
      isSm={isSm}
      isMd={isMd}
      cb={rowCb}
      cardBaseShadow={cardBaseShadow}
      cardHoverShadow={cardHoverShadow}
      onDragEnd={handleDragEnd}
    />
  );

  if (isMobile) {
    return (
      <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif" }}>
        {/* mobile header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span onClick={() => navigate(PC_BASE)} className="material-symbols-rounded" style={{ fontSize: 22, color: '#453F39', cursor: 'pointer' }}>arrow_back</span>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: 0 }}>Categories</h1>
          </div>
          <CatalogHelpLink topic="Categories" Tutorial={CategoriesTutorial} createPath={pcPaths.categoriesCreate} />
        </div>

        <div style={{ padding: 16 }}>
          <ProductCatalogSyncBanner compact syncOnly />

          {/* Search */}
          <div style={{ marginBottom: 12 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search categories..." />
          </div>

          {/* Mobile category cards */}
          {categories.length === 0 ? (
            renderEmptyNoCategories()
          ) : filtered.length === 0 ? (
            renderEmptySearch()
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(({ category: cat, depth }) => {
                const cvMap = new Map((cat.channelVisibility ?? []).map((cv) => [cv.orderTypeId, cv.enabled]));
                const enabledChs = outletOrderTypes.filter((ot) => {
                  const enabled = cvMap.get(ot.id);
                  return enabled === true;
                });
                const displayItemCount = getDisplayItemCount(cat);
                return (
                  <div
                    key={cat.id}
                    id={`catalog-category-row-${cat.id}`}
                    style={{
                      background: '#fff',
                      borderRadius: 2,
                      border: '1px solid #E6DFD3',
                      boxShadow: String(highlightId) === String(cat.id)
                        ? 'inset 0 0 0 2px rgba(184,149,80,0.9)'
                        : 'none',
                      padding: '14px 16px',
                      marginLeft: depth * 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T1, wordBreak: 'break-word' }}>{cat.name.length > 60 ? cat.name.slice(0, 60) + '...' : cat.name}</div>
                        {cat.description && (
                          <div style={{ fontSize: 12, color: T2, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.description}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 12, color: T2, background: '#F4F0E8', padding: '2px 8px', borderRadius: 2 }}>
                          {displayItemCount} item{displayItemCount !== 1 ? 's' : ''}
                        </span>
                        {/* visibility icon — same as desktop Visible badge; restore with GREEN const */}
                        {/* <span className="material-symbols-rounded" style={{ fontSize: 18, color: cat.isVisible ? GREEN : T3 }}>
                          {cat.isVisible ? 'visibility' : 'visibility_off'}
                        </span> */}
                        <button
                          ref={(el) => { mobileMenuBtnRefs.current[cat.id] = el; }}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setMobileMenuCatId(mobileMenuCatId === cat.id ? null : cat.id); }}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex' }}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: 18, color: T3 }}>more_vert</span>
                        </button>
                        {/* Portal-based popup menu */}
                        {mobileMenuCatId === cat.id && mobileMenuBtnRefs.current[cat.id] && createPortal(
                          <div
                            ref={mobileMenuRef}
                            style={{
                              position: 'fixed',
                              top: mobileMenuBtnRefs.current[cat.id]!.getBoundingClientRect().bottom + 4,
                              right: window.innerWidth - mobileMenuBtnRefs.current[cat.id]!.getBoundingClientRect().right,
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
                              onClick={() => { setMobileMenuCatId(null); setEditingCategoryId(cat.id); navigate(pcPaths.categoryEdit); }}
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
                            <div style={{ height: 1, background: '#F4F0E8' }} />
                            <button
                              type="button"
                              onClick={() => { setMobileMenuCatId(null); handleDelete(cat.id); }}
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
                    </div>
                    {enabledChs.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                        {enabledChs.slice(0, MAX_VISIBLE_ORDER_TYPES).map((ot) => (
                          <span key={ot.id} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: ACCENT_BG, color: ACCENT, fontWeight: 600 }}>
                            {getChannelDisplayName(ot.typeName)}
                          </span>
                        ))}
                        {enabledChs.length > MAX_VISIBLE_ORDER_TYPES && (
                          <span
                            style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#F4F0E8', color: T2, fontWeight: 600 }}
                            title={enabledChs.slice(MAX_VISIBLE_ORDER_TYPES).map((ot) => getChannelDisplayName(ot.typeName)).join(', ')}
                          >
                            +{enabledChs.length - MAX_VISIBLE_ORDER_TYPES}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FAB */}
        <button
          onClick={() => navigate(pcPaths.categoriesCreate)}
          style={{
            position: 'fixed', bottom: 80, right: 16, width: 56, height: 56,
            background: '#B89550', color: '#fff', border: 'none', borderRadius: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(184,149,80,0.35)', zIndex: 999, cursor: 'pointer',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 28 }}>add</span>
        </button>

        {deleteModal}
        <BottomNav />
      </div>
    );
  }

  return (
    <DesktopLayout>
      <div style={pageOuter}>
        <div style={pageMainScroll}>
          <div style={{ padding: '12px 25px 32px' }}>
            <PageHeader
              icon={
                <span className="material-symbols-rounded" style={{ fontSize: 24, color: 'rgba(255,255,255,0.95)' }}>
                  category
                </span>
              }
              title="Categories"
              subtitle="Organize your menu items into categories and subcategories."
              actions={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <CatalogHelpLink topic="Categories" Tutorial={CategoriesTutorial} createPath={pcPaths.categoriesCreate} />
                  <Button
                    icon={
                      <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'rgba(255,255,255,0.95)' }}>
                        add
                      </span>
                    }
                    onClick={() => navigate(pcPaths.categoriesCreate)}
                  >
                    Add Category
                  </Button>
                </div>
              }
            />

            <ProductCatalogSyncBanner syncOnly />

            <div
              style={{
                display: 'flex',
                flexDirection: isSm ? 'row' : 'column',
                alignItems: isSm ? 'center' : 'stretch',
                gap: 10,
                marginBottom: 20,
              }}
            >
              <div style={{ flex: isSm ? 1 : undefined, maxWidth: isSm ? 400 : undefined, minWidth: 0, width: '100%' }}>
                <SearchInput value={search} onChange={setSearch} placeholder="Search categories..." />
              </div>
            </div>

            {pendingSortCount > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 16px',
                  marginBottom: 12,
                  background: 'var(--surface, #fff)',
                  border: '1px solid var(--accent, #B89550)',
                  borderRadius: 'var(--radius-input, 8px)',
                  boxShadow: '0 2px 8px rgba(184,149,80,0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--accent, #B89550)' }}>
                    swap_vert
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1, #453F39)', fontFamily: 'var(--font-primary)' }}>
                    {pendingSortCount} {pendingSortCount === 1 ? 'category' : 'categories'} rearranged
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleCancelSort}
                    style={{
                      border: '1px solid var(--card-border, #E6DFD3)',
                      background: 'transparent',
                      borderRadius: 'var(--radius-button, 6px)',
                      padding: '6px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--t2, #8A7F72)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleApplySort()}
                    disabled={isSavingSort}
                    style={{
                      border: 'none',
                      background: 'var(--accent, #B89550)',
                      borderRadius: 'var(--radius-button, 6px)',
                      padding: '6px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#fff',
                      cursor: isSavingSort ? 'not-allowed' : 'pointer',
                      opacity: isSavingSort ? 0.7 : 1,
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    {isSavingSort ? 'Saving…' : 'Apply'}
                  </button>
                </div>
              </div>
            )}

            {categoryList}
          </div>
        </div>
      </div>

      {deleteModal}
    </DesktopLayout>
  );
}
