import { useEffect, useMemo, useState } from 'react';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import type { AssignableItem } from './types';

/* ── Types ── */

export interface ItemPickerSidebarProps {
  open: boolean;
  /** Called on backdrop click, Esc, and Cancel — closes WITHOUT applying the draft */
  onClose: () => void;
  title?: string;
  /** Stack order of the overlay. Raise it to open the picker on top of another drawer/modal. Default 100. */
  zIndex?: number;
  /** Selectable items — each may carry `categoryIds` (grouping) and `trailing` (e.g. price) */
  items: AssignableItem[];
  categories: { id: string; name: string; parentCategoryId?: string; sortPosition?: number }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  searchPlaceholder?: string;
  noResultsLabel?: string;
  itemsLoading?: boolean;
  maxSelections?: number;
  persistedSelectedIds?: string[];
}

const UNCATEGORIZED_ID = '__uncategorized__';

const INDENT_STEP = 16;
const HEADER_PAD_X = 4;
const ITEM_CARD_PAD_X = 14;
const ITEM_ROW_INDENT = HEADER_PAD_X + INDENT_STEP - ITEM_CARD_PAD_X;

const nameCompare = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

/** Sort categories by `sortPosition` (mirrors ItemsPage / Control Centre), name as tie-breaker. */
const catCompare = (
  a: { name: string; sortPosition?: number },
  b: { name: string; sortPosition?: number },
) => {
  const pa = Number.isFinite(a.sortPosition) ? (a.sortPosition as number) : Number.MAX_SAFE_INTEGER;
  const pb = Number.isFinite(b.sortPosition) ? (b.sortPosition as number) : Number.MAX_SAFE_INTEGER;
  return pa - pb || nameCompare(a, b);
};

/** A category group in the picker tree. `children` holds nested sub-categories (one level). */
interface PickerGroup {
  id: string;
  name: string;
  items: AssignableItem[];
  children: PickerGroup[];
}

/* ── Component ── */

export function ItemPickerSidebar({
  open,
  onClose,
  title = 'Select Items',
  zIndex = 100,
  items,
  categories,
  selectedIds,
  onToggle,
  searchPlaceholder = 'Search items...',
  noResultsLabel = 'No items found.',
  itemsLoading = false,
  maxSelections,
  persistedSelectedIds,
}: ItemPickerSidebarProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [search, setSearch] = useState('');
  /** Staged selection — applied only on Done, discarded on Cancel. */
  const [draft, setDraft] = useState<string[]>(selectedIds);
  /** Collapsed accordion groups (absence = expanded, so new groups default open). */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Esc-to-close + body scroll lock (mirrors Modal.tsx convention)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  // Seed the draft from current selection each time the drawer opens; clear search on close.
  useEffect(() => {
    if (open) setDraft(selectedIds);
    else setSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const draftSet = useMemo(() => new Set(draft), [draft]);
  const persistedSet = useMemo(
    () => new Set(persistedSelectedIds ?? []),
    [persistedSelectedIds],
  );

  /**
   * Sort items by their per-category sort position (mirrors ItemsPage / Control Centre):
   * positioned items first in numeric order, unpositioned fall back to name. When `categoryId`
   * is omitted (e.g. uncategorized), sorts by name. Persisted selections pin to the top.
   */
  const sortGroup = (list: AssignableItem[], categoryId?: string) => {
    const itemCompare = (a: AssignableItem, b: AssignableItem) => {
      if (categoryId) {
        const pa = a.categorySortPositions?.[categoryId];
        const pb = b.categorySortPositions?.[categoryId];
        const aHas = Number.isFinite(pa);
        const bHas = Number.isFinite(pb);
        if (aHas && bHas) {
          const diff = (pa as number) - (pb as number);
          if (diff !== 0) return diff;
        } else if (aHas !== bHas) {
          return aHas ? -1 : 1;
        }
      }
      return nameCompare(a, b);
    };
    if (persistedSelectedIds === undefined) return [...list].sort(itemCompare);
    const blockA = list.filter((i) => persistedSet.has(i.id)).sort(itemCompare);
    const blockB = list.filter((i) => !persistedSet.has(i.id)).sort(itemCompare);
    return [...blockA, ...blockB];
  };

  const searching = search.trim().length > 0;

  /** Groups: a 2-level category → sub-category tree, each node with its items; uncategorized last. */
  const groups = useMemo<PickerGroup[]>(() => {
    const q = search.trim().toLowerCase();
    const matches = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;

    const idSet = new Set(categories.map((c) => c.id));
    const isRoot = (c: { parentCategoryId?: string }) =>
      !c.parentCategoryId || !idSet.has(c.parentCategoryId);

    // Map each parent category → its direct sub-categories.
    const childrenByParent = new Map<string, typeof categories>();
    for (const c of categories) {
      if (isRoot(c)) continue;
      const list = childrenByParent.get(c.parentCategoryId!) ?? [];
      list.push(c);
      childrenByParent.set(c.parentCategoryId!, list);
    }

    // Items tagged to `catId`, excluding any that also belong to one of its
    // sub-categories — those render under the more specific child instead.
    const itemsForCategory = (catId: string) => {
      const childIds = new Set((childrenByParent.get(catId) ?? []).map((c) => c.id));
      return matches.filter((i) => {
        const cids = i.categoryIds ?? [];
        if (!cids.includes(catId)) return false;
        if (childIds.size > 0 && cids.some((c) => childIds.has(c))) return false;
        return true;
      });
    };

    // Roots = top-level categories + any whose parent isn't itself a rendered child
    // (defensive: deeper-than-2-level cats surface as their own root rather than vanish).
    const directChildIds = new Set([...childrenByParent.values()].flat().map((c) => c.id));
    const rootCats = categories.filter((c) => isRoot(c) || !directChildIds.has(c.id));

    const result: PickerGroup[] = [];
    for (const root of [...rootCats].sort(catCompare)) {
      const children = (childrenByParent.get(root.id) ?? [])
        .slice()
        .sort(catCompare)
        .map((cc) => ({
          id: cc.id,
          name: cc.name,
          items: sortGroup(itemsForCategory(cc.id), cc.id),
          children: [] as PickerGroup[],
        }))
        .filter((g) => g.items.length > 0);
      const directItems = sortGroup(itemsForCategory(root.id), root.id);
      if (directItems.length > 0 || children.length > 0) {
        result.push({ id: root.id, name: root.name, items: directItems, children });
      }
    }

    const uncategorized = matches.filter(
      (i) => !(i.categoryIds ?? []).some((cid) => idSet.has(cid)),
    );
    if (uncategorized.length > 0) {
      result.push({ id: UNCATEGORIZED_ID, name: 'Uncategorized', items: sortGroup(uncategorized), children: [] });
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, categories, search, persistedSelectedIds]);

  const limitReached = maxSelections !== undefined && draft.length >= maxSelections;

  const toggleItem = (id: string) =>
    setDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /** Select / deselect every selectable item in a category (respects maxSelections). */
  const toggleGroup = (groupItems: AssignableItem[], allSelected: boolean) =>
    setDraft((prev) => {
      const set = new Set(prev);
      const selectable = groupItems.filter((i) => !i.disabled || set.has(i.id));
      if (allSelected) {
        selectable.forEach((i) => set.delete(i.id));
      } else {
        for (const i of selectable) {
          if (set.has(i.id)) continue;
          if (maxSelections !== undefined && set.size >= maxSelections) break;
          set.add(i.id);
        }
      }
      return [...set];
    });

  const handleDone = () => {
    const cur = new Set(selectedIds);
    const next = new Set(draft);
    for (const id of next) if (!cur.has(id)) onToggle(id);
    for (const id of cur) if (!next.has(id)) onToggle(id);
    onClose();
  };

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** All unique items in a group's subtree (own items + every sub-category's items). */
  const aggregateItems = (group: PickerGroup): AssignableItem[] => {
    const map = new Map<string, AssignableItem>();
    for (const i of group.items) map.set(i.id, i);
    for (const c of group.children) for (const i of c.items) map.set(i.id, i);
    return [...map.values()];
  };

  const renderItemCard = (item: AssignableItem, groupId: string) => {
    const checked = draftSet.has(item.id);
    const isDisabled = (limitReached && !checked) || (!!item.disabled && !checked);
    return (
      <label
        key={`${groupId}-${item.id}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: `12px ${ITEM_CARD_PAD_X}px`,
          marginBottom: 8,
          border: '1px solid var(--card-border, #E6DFD3)',
          borderRadius: 10,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.45 : 1,
          background: checked
            ? 'var(--accent-soft, rgba(184,149,80,0.05))'
            : 'var(--surface, #FFFFFF)',
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={isDisabled}
          onChange={() => !isDisabled && toggleItem(item.id)}
          style={{
            accentColor: 'var(--accent)',
            width: 16,
            height: 16,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        />
        <span
          title={item.name}
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--t1, #453F39)',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.name}
        </span>
        {item.disabled && !checked && item.disabledReason ? (
          <span style={{ fontSize: 11, color: 'var(--t3, #9A9084)', fontStyle: 'italic', flexShrink: 0 }}>
            {item.disabledReason}
          </span>
        ) : null}
      </label>
    );
  };

  /** Render a category group: master checkbox + accordion toggle, then items + nested sub-groups. */
  const renderGroup = (group: PickerGroup, depth: number) => {
    const agg = aggregateItems(group);
    const selectable = agg.filter((i) => !i.disabled || draftSet.has(i.id));
    const selectedCount = selectable.filter((i) => draftSet.has(i.id)).length;
    const allSelected = selectable.length > 0 && selectedCount === selectable.length;
    const someSelected = selectedCount > 0 && !allSelected;
    const expanded = searching || !collapsed.has(group.id);

    return (
      <div key={group.id} style={{ marginBottom: 4, marginLeft: depth > 0 ? INDENT_STEP : 0 }}>
        {/* Group header: master checkbox (select-all) + accordion toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: `6px ${HEADER_PAD_X}px`, margin: '8px 0 6px' }}>
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={() => toggleGroup(agg, allSelected)}
            style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
          />
          <button
            type="button"
            onClick={() => toggleCollapse(group.id)}
            aria-expanded={expanded}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flex: 1,
              minWidth: 0,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span
              title={group.name}
              style={{
                fontSize: 13,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                color: 'var(--t2, #6E665D)',
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {group.name}
            </span>
            <span style={{ fontSize: 12, color: 'var(--t3, #9A9084)', flexShrink: 0 }}>
              {agg.length} item{agg.length !== 1 ? 's' : ''}
            </span>
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: 18,
                color: 'var(--t3, #9A9084)',
                transition: 'transform 0.2s ease',
                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                flexShrink: 0,
              }}
            >
              chevron_right
            </span>
          </button>
        </div>

        {expanded && (
          <>
            {/* Offset item rows so the item checkbox (inside the card padding) sits one step
                right of the category checkbox (inside the header padding). */}
            <div style={{ marginLeft: ITEM_ROW_INDENT }}>
              {group.items.map((item) => renderItemCard(item, group.id))}
            </div>
            {group.children.map((child) => renderGroup(child, depth + 1))}
          </>
        )}
      </div>
    );
  };

  if (!open) return null;

  const panelWidth = isMobile ? '100vw' : 460;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          height: '100%',
          width: panelWidth,
          maxWidth: '100vw',
          background: 'var(--surface, #FFFFFF)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-primary)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px',
            borderBottom: '1px solid var(--divider, #ECE5D8)',
            flexShrink: 0,
          }}
        >
          <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--t1, #453F39)', margin: 0 }}>
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--t3, #9A9084)',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 22 }}>close</span>
          </button>
        </div>

        {/* Body (search + groups scroll together) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* Search pill */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <span
              className="material-symbols-rounded"
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 20,
                color: 'var(--t3, #9A9084)',
              }}
            >
              search
            </span>
            <input
              type="text"
              value={search}
              autoFocus={!isMobile}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 16px 12px 42px',
                border: 'none',
                borderRadius: 999,
                fontSize: 14,
                fontFamily: 'var(--font-primary)',
                color: 'var(--t1, #453F39)',
                outline: 'none',
                background: 'var(--hover, #F4F0E8)',
              }}
            />
          </div>

          {/* Max selections banner */}
          {limitReached && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                marginBottom: 12,
                borderRadius: 8,
                background: 'rgba(176,122,42,0.08)',
                border: '1px solid rgba(176,122,42,0.2)',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#B07A2A', flexShrink: 0 }}>info</span>
              <span style={{ fontSize: 11.5, color: '#8A6D33', fontWeight: 500 }}>
                Max {maxSelections} reached — deselect one to add another.
              </span>
            </div>
          )}

          {itemsLoading ? (
            <div style={{ fontSize: 13, color: 'var(--t3, #9A9084)', padding: '12px 0' }}>
              Loading items...
            </div>
          ) : groups.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--t3, #9A9084)', padding: '12px 0' }}>
              {noResultsLabel}
            </div>
          ) : (
            groups.map((group) => renderGroup(group, 0))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '14px 20px',
            borderTop: '1px solid var(--divider, #ECE5D8)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 22px',
              borderRadius: 8,
              border: '1px solid var(--accent, #B89550)',
              background: 'transparent',
              color: 'var(--accent, #B89550)',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDone}
            style={{
              padding: '10px 28px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent, #B89550)',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            Done ({draft.length})
          </button>
        </div>
      </div>
    </div>
  );
}
