import { useState, useRef, useEffect, type CSSProperties } from 'react';

const BORDER = '#E6DFD3';
const CARD_BG = '#FFFFFF';
const T2 = '#6E665D';
const HOVER = '#F4F0E8';
const PURPLE = '#8C6A7A';
const TEAL = '#5E8C7B';
const TRIGGER_PAD_X = 12;
const TRIGGER_PAD_Y = 9;
export const CONTROL_CENTRE_FILTER_MAX_WIDTH_PX = 300;

export type ControlCentreFilterOption = { value: string; label: string };

export const ITEMS_TAB_AVAILABILITY_OPTIONS: ControlCentreFilterOption[] = [
  { value: 'all', label: 'All availability' },
  { value: 'fully_available', label: 'Fully available' },
  { value: 'partially_available', label: 'Partially available' },
  { value: 'not_available', label: 'Not available' },
];

export const CATEGORY_TAB_VISIBILITY_OPTIONS: ControlCentreFilterOption[] = [
  { value: 'all', label: 'Visibility (all)' },
  { value: 'full', label: 'Fully visible' },
  { value: 'partial', label: 'Partially visible' },
  { value: 'none', label: 'Not visible' },
];

type Variant = 'purple' | 'teal';

export function ControlCentreFilterDropdown({
  value,
  onChange,
  options,
  ariaLabel,
  variant,
  isActive,
  fullWidth = false,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ControlCentreFilterOption[];
  ariaLabel: string;
  variant: Variant;
  isActive: boolean;
  fullWidth?: boolean;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const accent = variant === 'purple' ? PURPLE : TEAL;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value) ?? options[0];

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
        maxWidth: fullWidth ? '100%' : CONTROL_CENTRE_FILTER_MAX_WIDTH_PX,
        ...style,
      }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          position: 'relative',
          padding: `${TRIGGER_PAD_Y}px ${TRIGGER_PAD_X}px`,
          margin: 0,
          borderRadius: 2,
          border: `1px solid ${isActive ? accent : BORDER}`,
          fontSize: 11,
          fontWeight: 600,
          color: isActive ? accent : T2,
          fontFamily: 'var(--font-primary)',
          background: isActive ? `${accent}06` : CARD_BG,
          cursor: 'pointer',
          textAlign: 'left',
          boxSizing: 'border-box',
          minHeight: 36,
        }}
      >
        <span
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.25,
          }}
        >
          {selected?.label}
        </span>
        <span
          className="material-symbols-rounded"
          aria-hidden
          style={{
            flex: '0 0 auto',
            fontSize: 18,
            width: 20,
            height: 20,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isActive ? accent : T2,
            pointerEvents: 'none',
            lineHeight: 1,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
          }}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 4px)',
            zIndex: 400,
            background: CARD_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            maxHeight: 280,
            overflowY: 'auto',
            padding: 4,
          }}
        >
          {options.map((opt) => {
            const sel = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={sel}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                onMouseEnter={(e) => {
                  if (!sel) e.currentTarget.style.background = HOVER;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = sel ? `${accent}10` : 'transparent';
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 10px',
                  border: 'none',
                  borderRadius: 2,
                  background: sel ? `${accent}10` : 'transparent',
                  color: sel ? accent : T2,
                  fontSize: 11,
                  fontWeight: sel ? 700 : 600,
                  fontFamily: 'var(--font-primary)',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
