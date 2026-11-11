import { useState, useMemo } from 'react';

export interface ChipItem {
  id: string;
  name: string;
}

export interface ChipSelectListProps {
  /** Section heading shown above the chip list. */
  label: string;
  /** Whether the field is required (shows red asterisk). */
  required?: boolean;
  /** Full set of available options to choose from. */
  options: ChipItem[];
  /** Currently selected items. */
  selected: ChipItem[];
  /** Called when selection changes. */
  onChange: (next: ChipItem[]) => void;
  /** Text colour for selected chips. */
  activeColor?: string;
  /** Border for selected chips. */
  activeBorder?: string;
  /** Background for selected chips. */
  activeBg?: string;
  /** Show close icon on selected chips. Default true. */
  showCloseIcon?: boolean;
  /** Empty-state text when options array is empty. */
  emptyText?: string;
  /** Error message shown below the list. */
  error?: string;
  /** Allow adding custom items via a text input (e.g. custom tags). */
  allowCustom?: boolean;
  /** Placeholder for the custom-add input. */
  customPlaceholder?: string;
  /** Max visible height before scroll kicks in. Default 164. */
  maxHeight?: number;
  /** Top margin for the wrapper — use 0 for the first section, 16 for subsequent ones. */
  marginTop?: number;
  /** Show a search input to filter options. Default false. */
  searchable?: boolean;
  /** Placeholder for the search input. */
  searchPlaceholder?: string;
}

export default function ChipSelectList({
  label,
  required,
  options,
  selected,
  onChange,
  activeColor = '#B89550',
  activeBorder = '1px solid rgba(184,149,80,0.35)',
  activeBg = 'rgba(184,149,80,0.08)',
  showCloseIcon = true,
  emptyText,
  error,
  allowCustom,
  customPlaceholder = 'Add custom...',
  maxHeight = 164,
  marginTop,
  searchable,
  searchPlaceholder,
}: ChipSelectListProps) {
  const [customInput, setCustomInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const isSelected = (item: ChipItem) => selected.some((s) => s.id === item.id);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, searchQuery, searchable]);

  const toggle = (item: ChipItem) => {
    if (isSelected(item)) {
      onChange(selected.filter((s) => s.id !== item.id));
    } else {
      onChange([...selected, item]);
    }
  };

  const addCustom = () => {
    const val = customInput.trim();
    if (!val) return;
    const lower = val.toLowerCase();
    /* Deduplicate: match against existing API options by name so we use the real id */
    const matchOption = options.find((o) => o.name.toLowerCase() === lower);
    /* Also check if already selected by name (case-insensitive) */
    const matchSelected = selected.find((s) => s.name.toLowerCase() === lower);
    if (matchSelected) {
      // Already selected — just clear input
      setCustomInput('');
      return;
    }
    const item = matchOption ?? { id: `custom-${val}`, name: val };
    onChange([...selected, item]);
    setCustomInput('');
  };

  return (
    <div style={{ marginTop: marginTop ?? 16 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--t2, #6E665D)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 10,
          fontFamily: 'var(--font-primary)',
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--accent, #B89550)', marginLeft: 2 }}>*</span>}
      </div>

      {searchable && options.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '6px 10px', borderRadius: 2, border: '1px solid var(--card-border, #E6DFD3)', maxWidth: 280 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--t3, #9A9084)' }}>search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}...`}
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: 12, fontFamily: 'var(--font-primary)', color: 'var(--t1, #453F39)', background: 'transparent' }}
          />
          {searchQuery && (
            <span className="material-symbols-rounded" style={{ fontSize: 14, color: 'var(--t3, #9A9084)', cursor: 'pointer' }} onClick={() => setSearchQuery('')}>close</span>
          )}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          maxHeight,
          overflowY: 'auto',
          borderRadius: 2,
          paddingRight: 4,
          alignContent: 'flex-start',
          scrollbarWidth: 'thin',
          scrollbarColor: '#D6CCBB transparent',
        }}
      >
        {filteredOptions.map((item) => {
          const on = isSelected(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: on ? 600 : 500,
                fontFamily: 'var(--font-primary)',
                border: on ? activeBorder : '1px solid var(--card-border, #E6DFD3)',
                background: on ? activeBg : 'var(--surface, #FFFFFF)',
                color: on ? activeColor : 'var(--t2, #6E665D)',
                cursor: 'pointer',
              }}
            >
              {item.name}
              {on && showCloseIcon && (
                <span className="material-symbols-rounded" style={{ fontSize: 14 }}>close</span>
              )}
            </button>
          );
        })}
        {filteredOptions.length === 0 && (
          <span style={{ fontSize: 11, color: 'var(--t3, #9A9084)', fontStyle: 'italic' }}>
            {searchQuery ? `No results for "${searchQuery}"` : (emptyText ?? 'No options available')}
          </span>
        )}
      </div>

      {/* {allowCustom && (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginTop: 12, maxWidth: 320 }}>
          <input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder={customPlaceholder}
            style={{
              flex: 1,
              minHeight: 40,
              padding: '8px 12px',
              borderRadius: 2,
              border: '1px solid var(--card-border, #E6DFD3)',
              fontSize: 12,
              fontFamily: 'var(--font-primary)',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={addCustom}
            style={{
              minWidth: 56,
              minHeight: 40,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 12px',
              borderRadius: 2,
              border: '1px solid var(--card-border, #E6DFD3)',
              background: 'var(--surface, #FFFFFF)',
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--t2, #6E665D)' }}>add</span>
          </button>
        </div>
      )}

      {error && (
        <p style={{ fontSize: 11, color: 'var(--red, #A63D2F)', marginTop: 6, fontFamily: 'var(--font-primary)' }}>{error}</p>
      )} */}
    </div>
  );
}
