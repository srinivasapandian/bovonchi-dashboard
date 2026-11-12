import { useState, useMemo } from 'react';
import { Bone } from '../../../../components/Shimmer';
import { ItemPickerSidebar } from '../../../shared/itemPicker/ItemPickerSidebar';
import type { AssignableItem } from '../../../shared/itemPicker/types';

/* ── Types ── */

// `AssignableItem` and the picker drawer now live in components/shared/itemPicker (also used by
// catering). Re-exported so existing `import { AssignableItem } from ...ItemAssignmentSection` keeps working.
export type { AssignableItem };

export interface ItemAssignmentSectionProps {
  /** Section header title. Default: "Item Assignment" */
  title?: string;
  titleCountBadge?: string;
  /** Material icon name. Default: "package_2" */
  icon?: string;
  /** Optional description text below title */
  description?: string;
  /** Full list of available/selectable items shown in the picker */
  items: AssignableItem[];
  /** IDs of currently assigned/selected items */
  selectedIds: string[];
  /** Override for displayed pill items. If not provided, pills are derived from items filtered by selectedIds */
  selectedItems?: AssignableItem[];
  /** Called when user checks/unchecks an item in the picker */
  onToggle: (id: string) => void;
  /** Called when user clicks the X on a pill to remove an item */
  onRemove: (id: string) => void;
  /** Whether the section is collapsible. Default: true */
  collapsible?: boolean;
  /** Whether section starts expanded. Default: true */
  defaultOpen?: boolean;
  /** Show skeleton loading instead of pills/picker. Default: false */
  loading?: boolean;
  /** Show "Loading items..." text inside the picker. Default: false */
  itemsLoading?: boolean;
  /** Empty state text when no items are selected */
  emptyLabel?: string;
  /** Search placeholder text. Default: "Search items..." */
  searchPlaceholder?: string;
  /** Whether to show the pills row. Default: true. Set false to render your own custom pills externally. */
  showPills?: boolean;
  /** Label for the add button. Default: "Add Items" */
  addButtonLabel?: string;
  /** Label when picker has no results. Default: "No items found." */
  noResultsLabel?: string;
  /** Enable drag-and-drop reorder on assigned items. Calls back with reordered IDs. */
  onReorder?: (reorderedIds: string[]) => void;
  staticTitleMarginBottom?: number;
  persistedSelectedIds?: string[];
  maxSelections?: number;
  /** Hide the subtitle (e.g. category name) shown on each row in the picker. Default: false */
  hideSubtitle?: boolean;
  categories?: { id: string; name: string; parentCategoryId?: string; sortPosition?: number }[];
}

/* ── Styles (CSS variables only) ── */

const S = {
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    maxWidth: '100%',
    boxSizing: 'border-box',
    borderRadius: 2,
    background: 'var(--accent-soft, rgba(184,149,80,0.08))',
    color: 'var(--accent, #B89550)',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'var(--font-primary)',
  } as React.CSSProperties,
  pillRemove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    color: 'var(--accent, #B89550)',
  } as React.CSSProperties,
  addItemBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    borderRadius: 2,
    border: '1px dashed var(--card-border, #E6DFD3)',
    background: 'transparent',
    color: 'var(--t2, #6E665D)',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
  } as React.CSSProperties,
  collapsibleHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    width: '100%',
    padding: 0,
    marginBottom: 16,
  } as React.CSSProperties,
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    height: 20,
    borderRadius: 2,
    background: 'var(--accent, #B89550)',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    padding: '0 6px',
  } as React.CSSProperties,
  /** Matches Exclusive item slot counter pill on ItemFormPage */
  titleCountBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(184,149,80,0.06)',
    border: '1px solid rgba(184,149,80,0.15)',
    color: 'var(--accent, #B89550)',
    flexShrink: 0,
    textTransform: 'none' as const,
    letterSpacing: 'normal' as const,
  } as React.CSSProperties,
  headerTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--t3, #9A9084)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    margin: 0,
    flex: 1,
    textAlign: 'left' as const,
  } as React.CSSProperties,
  pickerContainer: {
    border: '1px solid var(--card-border, #E6DFD3)',
    borderRadius: 2,
    padding: 12,
    maxHeight: 240,
    overflowY: 'auto' as const,
    background: 'var(--surface, #FFFFFF)',
  } as React.CSSProperties,
  searchWrap: {
    position: 'relative' as const,
    marginBottom: 8,
  } as React.CSSProperties,
  searchIcon: {
    position: 'absolute' as const,
    left: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 16,
    color: 'var(--t3, #9A9084)',
  } as React.CSSProperties,
  searchInput: {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '6px 10px 6px 30px',
    border: '1px solid var(--card-border, #E6DFD3)',
    borderRadius: 2,
    fontSize: 12,
    fontFamily: 'var(--font-primary)',
    color: 'var(--t1, #453F39)',
    outline: 'none',
    background: 'var(--surface, #FFFFFF)',
  } as React.CSSProperties,
  muted: {
    fontSize: 12,
    color: 'var(--t3, #9A9084)',
    padding: '6px 0',
  } as React.CSSProperties,
  updateBtn: {
    padding: '6px 14px',
    borderRadius: 2,
    border: 'none',
    background: 'var(--accent, #B89550)',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  } as React.CSSProperties,
};

/* ── Component ── */

export function ItemAssignmentSection({
  title = 'Product Assignment' /* was: 'Item Assignment' */,
  titleCountBadge,
  icon = 'package_2',
  description,
  items,
  selectedIds,
  selectedItems,
  onToggle,
  onRemove,
  collapsible = true,
  defaultOpen = true,
  loading = false,
  itemsLoading = false,
  emptyLabel,
  searchPlaceholder = 'Search products...' /* was: 'Search items...' */,
  showPills = true,
  addButtonLabel = 'Add Products' /* was: 'Add Items' */,
  noResultsLabel = 'No products found.' /* was: 'No items found.' */,
  onReorder,
  persistedSelectedIds,
  staticTitleMarginBottom = 14,
  maxSelections,
  hideSubtitle = false,
  categories,
}: ItemAssignmentSectionProps) {
  const grouped = categories !== undefined;
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [dragPillId, setDragPillId] = useState<string | null>(null);

  const nameCompare = (a: AssignableItem, b: AssignableItem) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

  const pillItems = useMemo(() => {
    const byId = new Map<string, AssignableItem>();
    for (const i of items) byId.set(i.id, i);
    if (selectedItems) {
      for (const i of selectedItems) byId.set(i.id, i);
    }
    return selectedIds.map((id) => byId.get(id)).filter((x): x is AssignableItem => x != null);
  }, [selectedIds, selectedItems, items]);

  const filteredPickerItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.secondaryName?.toLowerCase().includes(q) ?? false),
        )
      : [...items];

    if (persistedSelectedIds === undefined) {
      return base.sort((a, b) => {
        const aSelected = selectedIds.includes(a.id);
        const bSelected = selectedIds.includes(b.id);
        if (aSelected !== bSelected) return aSelected ? -1 : 1;
        return nameCompare(a, b);
      });
    }

    const persistedSet = new Set(persistedSelectedIds);
    const blockA = base.filter((i) => persistedSet.has(i.id)).sort(nameCompare);
    const blockB = base.filter((i) => !persistedSet.has(i.id)).sort(nameCompare);
    return [...blockA, ...blockB];
  }, [items, search, selectedIds, persistedSelectedIds]);

  const bodyOpen = collapsible ? isOpen : true;

  /* ── Header ── */
  const header = collapsible ? (
    <button
      type="button"
      style={S.collapsibleHeader}
      onClick={() => setIsOpen((o) => !o)}
    >
      <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--t2, #6E665D)' }}>
        {icon}
      </span>
      <span style={S.headerTitle}>{title}</span>
      {selectedIds.length > 0 && <span style={S.badge}>{selectedIds.length}</span>}
      <span
        className="material-symbols-rounded"
        style={{
          fontSize: 20,
          color: 'var(--t3, #9A9084)',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
        }}
      >
        expand_more
      </span>
    </button>
  ) : title ? (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: description ? 4 : staticTitleMarginBottom,
        }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--t2, #6E665D)', flexShrink: 0 }}>
          {icon}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
          <p style={{ ...S.headerTitle, margin: 0 }}>{title}</p>
          {titleCountBadge ? <span style={S.titleCountBadge}>{titleCountBadge}</span> : null}
        </div>
      </div>
      {description && (
        <p style={{ fontSize: 12, color: 'var(--t2, #6E665D)', margin: '0 0 12px' }}>{description}</p>
      )}
    </>
  ) : null;

  /* ── Pills row ── */
  const pillsRow = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: showPicker ? 12 : 8 }}>
      {showPills && (
        pillItems.length === 0 && emptyLabel ? (
          <span style={{ fontSize: 12, color: 'var(--t3, #9A9084)', fontStyle: 'italic' }}>{emptyLabel}</span>
        ) : showPills ? (
          pillItems.map((item) => (
            <span
              key={item.id}
              style={{ ...S.pill, cursor: onReorder ? 'grab' : undefined }}
              draggable={!!onReorder}
              onDragStart={() => setDragPillId(item.id)}
              onDragEnd={() => setDragPillId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (!onReorder || !dragPillId || dragPillId === item.id) return;
                const ids = [...selectedIds];
                const from = ids.indexOf(dragPillId);
                const to = ids.indexOf(item.id);
                if (from < 0 || to < 0) return;
                ids.splice(from, 1);
                ids.splice(to, 0, dragPillId);
                onReorder(ids);
                setDragPillId(null);
              }}
            >
              {onReorder && <span className="material-symbols-rounded" style={{ fontSize: 12, color: 'var(--t3, #9A9084)' }}>drag_indicator</span>}
              <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, maxWidth: 280, minWidth: 0 }}>
                <span style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  <span style={{ fontWeight: 600 }}>{item.name}</span>
                  {item.secondaryName ? (
                    <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 4 }}>{item.secondaryName}</span>
                  ) : null}
                </span>
                {item.subtitle ? (
                  <span style={{ fontSize: 10, color: 'var(--t3, #9A9084)', fontWeight: 400, lineHeight: 1.25 }}>
                    {item.subtitle}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                aria-label={`Remove ${item.name}`}
                style={S.pillRemove}
                onClick={() => onRemove(item.id)}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 14 }}>close</span>
              </button>
            </span>
          ))
        ) : null
      )}
      <button type="button" style={S.addItemBtn} onClick={() => setShowPicker((p) => !p)}>
        <span className="material-symbols-rounded" style={{ fontSize: 16 }}>add</span>
        {addButtonLabel}
      </button>
    </div>
  );

  /* ── Picker (inline — used when not grouped) ── */
  const picker = !grouped && showPicker && (
    <div style={S.pickerContainer}>
      {/* Sticky search row + Update button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        position: 'sticky',
        top: -12,
        zIndex: 1,
        background: 'var(--surface, #FFFFFF)',
        paddingTop: 12,
        paddingBottom: 8,
        margin: '-12px -12px 0',
        padding: '12px 12px 8px',
      }}>
        <div style={{ ...S.searchWrap, flex: 1, marginBottom: 0 }}>
          <span className="material-symbols-rounded" style={S.searchIcon}>search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            style={S.searchInput}
          />
        </div>
        <button
          type="button"
          onClick={() => { setShowPicker(false); setSearch(''); }}
          style={S.updateBtn}
        >
          Update
        </button>
      </div>
      {itemsLoading ? (
        <div style={S.muted}>{/* was: Loading items... */}Loading products...</div>
      ) : filteredPickerItems.length === 0 ? (
        <div style={S.muted}>{noResultsLabel}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Max selections reached banner */}
          {maxSelections !== undefined && selectedIds.length >= maxSelections && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 8px', marginBottom: 4, borderRadius: 2,
              background: 'rgba(176,122,42,0.08)', border: '1px solid rgba(176,122,42,0.2)',
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: 14, color: '#B07A2A', flexShrink: 0 }}>info</span>
              <span style={{ fontSize: 11, color: '#8A6D33', fontWeight: 500 }}>
                Max {maxSelections} reached — deselect one to add another.
              </span>
            </div>
          )}
          {filteredPickerItems.map((item) => {
            const checked = selectedIds.includes(item.id);
            const limitReached = maxSelections !== undefined && selectedIds.length >= maxSelections;
            const isDisabled = (limitReached && !checked) || (!!item.disabled && !checked);
            return (
              <label
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 6px',
                  borderRadius: 5,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.45 : 1,
                  background: checked ? 'var(--accent-soft, rgba(184,149,80,0.04))' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isDisabled}
                  onChange={() => !isDisabled && onToggle(item.id)}
                  style={{ accentColor: 'var(--accent)', width: 14, height: 14, cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                />
                <span style={{ fontSize: 12, color: 'var(--t1, #453F39)', fontFamily: 'var(--font-primary)', flex: 1 }}>
                  <span style={{ fontWeight: 600 }}>{item.name}</span>
                  {item.secondaryName ? (
                    <span style={{ fontWeight: 400, color: 'var(--t3, #9A9084)', marginLeft: 4 }}>{item.secondaryName}</span>
                  ) : null}
                </span>
                {item.disabled && !checked && item.disabledReason && (
                  <span style={{ fontSize: 11, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)', fontStyle: 'italic' }}>
                    {item.disabledReason}
                  </span>
                )}
                {!hideSubtitle && (!item.disabled || checked) && item.subtitle && (
                  <span style={{ fontSize: 12, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)' }}>{item.subtitle}</span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {header}
      {bodyOpen && (
        <div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Bone w="70%" h={16} />
              <Bone w="55%" h={16} />
              <Bone w="62%" h={16} />
            </div>
          ) : (
            <>
              {pillsRow}
              {picker}
            </>
          )}
        </div>
      )}
      {grouped && (
        <ItemPickerSidebar
          open={showPicker}
          onClose={() => setShowPicker(false)}
          items={items}
          categories={categories ?? []}
          selectedIds={selectedIds}
          onToggle={onToggle}
          searchPlaceholder={searchPlaceholder}
          noResultsLabel={noResultsLabel}
          itemsLoading={itemsLoading}
          maxSelections={maxSelections}
          persistedSelectedIds={persistedSelectedIds}
        />
      )}
    </div>
  );
}
