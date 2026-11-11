import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, KeyboardEvent, ChangeEvent } from 'react';
import { formatTime12h } from '../../features/sessions/sessionFormatting';

function parseTime24(value: string): { hour: number; minute: number } {
  const raw = (value ?? '').trim();
  if (!raw || !raw.includes(':')) return { hour: 12, minute: 0 };
  const [h, m] = raw.split(':').map(Number);
  return { hour: Number.isFinite(h) ? h : 12, minute: Number.isFinite(m) ? m : 0 };
}

function to24(hour12: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

function toTimeString(hour24: number, minute: number): string {
  return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function SpinnerField({
  value,
  onChange,
  min,
  max,
  wrap,
  pad,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  wrap?: boolean;
  pad?: number;
  disabled?: (v: number) => boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const commitTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isFocusedRef = useRef(false);

  const fmt = (n: number) => n.toString().padStart(pad ?? 2, '0');
  const [display, setDisplay] = useState(fmt(value));

  // Sync display when value changes externally (arrow clicks, period change, etc.)
  // but only when the user is NOT currently typing in this field.
  useEffect(() => {
    if (!isFocusedRef.current) setDisplay(fmt(value));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const clamp = (v: number) => {
    if (wrap) {
      if (v > max) return min;
      if (v < min) return max;
      return v;
    }
    return Math.min(max, Math.max(min, v));
  };

  const step = (dir: 1 | -1) => {
    let next = clamp(value + dir);
    if (disabled) {
      let tries = max - min + 1;
      while (disabled(next) && tries-- > 0) next = clamp(next + dir);
    }
    if (!disabled || !disabled(next)) onChange(next);
  };

  const commitRaw = (raw: string) => {
    const num = parseInt(raw, 10);
    if (Number.isNaN(num)) { setDisplay(fmt(value)); return; }
    const clamped = Math.min(max, Math.max(min, num));
    if (!disabled || !disabled(clamped)) {
      onChange(clamped);
      setDisplay(fmt(clamped));
    } else {
      setDisplay(fmt(value));
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setDisplay(raw);
    clearTimeout(commitTimeoutRef.current);
    if (raw.length === 0) return;

    const num = parseInt(raw, 10);

    if (raw.length === 2) {
      commitRaw(raw);
      return;
    }

    // Single digit: if no valid 2-digit number can start with it, commit immediately
    if (num * 10 > max) {
      commitRaw(raw);
      return;
    }

    // Wait 800 ms for a possible second digit
    commitTimeoutRef.current = setTimeout(() => commitRaw(raw), 800);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); clearTimeout(commitTimeoutRef.current); step(1); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); clearTimeout(commitTimeoutRef.current); step(-1); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(commitTimeoutRef.current);
      commitRaw(e.currentTarget.value.replace(/\D/g, ''));
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    e.target.select();
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    clearTimeout(commitTimeoutRef.current);
    commitRaw(display.replace(/\D/g, ''));
  };

  useEffect(() => () => clearTimeout(commitTimeoutRef.current), []);

  const isUpDisabled = disabled ? disabled(clamp(value + 1)) : false;
  const isDownDisabled = disabled ? disabled(clamp(value - 1)) : false;

  const btnStyle: CSSProperties = {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9A9084',
    lineHeight: 1,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <button type="button" onClick={() => step(1)} style={{ ...btnStyle, opacity: isUpDisabled ? 0.3 : 1 }} disabled={isUpDisabled}>
        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>keyboard_arrow_up</span>
      </button>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        role="spinbutton"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        value={display}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        style={{
          width: 52,
          height: 44,
          fontSize: 20,
          fontWeight: 600,
          color: '#3D4463',
          border: '1px solid #ECE5D8',
          borderRadius: 2,
          background: '#F7F4EC',
          outline: 'none',
          fontFamily: 'var(--font-mono, monospace)',
          cursor: 'text',
          textAlign: 'center',
          caretColor: 'transparent',
          boxSizing: 'border-box',
        }}
      />
      <button type="button" onClick={() => step(-1)} style={{ ...btnStyle, opacity: isDownDisabled ? 0.3 : 1 }} disabled={isDownDisabled}>
        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>keyboard_arrow_down</span>
      </button>
    </div>
  );
}

export interface CatalogTimePickerProps {
  value: string;
  onChange: (v: string) => void;
  minTime?: string;
  label?: string;
  zIndex?: number;
  disabled?: boolean;
}

/**
 * Session-form style time picker (12h + AM/PM + spinners). Value / onChange use `HH:mm` 24h.
 */
export function CatalogTimePicker({
  value,
  onChange,
  minTime,
  label = 'Time',
  zIndex = 300,
  disabled = false,
}: CatalogTimePickerProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [panelBox, setPanelBox] = useState({ top: 0, left: 0, width: 280 });

  const parsed = parseTime24(value);
  const toHour12 = (h: number) => (h === 0 ? 12 : h > 12 ? h - 12 : h);

  const [draftHour12, setDraftHour12] = useState(toHour12(parsed.hour));
  const [draftMinute, setDraftMinute] = useState(parsed.minute);
  const [draftPeriod, setDraftPeriod] = useState<'AM' | 'PM'>(parsed.hour >= 12 ? 'PM' : 'AM');

  const minParsed = minTime ? parseTime24(minTime) : null;
  const minTotal = minParsed ? minParsed.hour * 60 + minParsed.minute : -1;

  const isTimeDisabled = (h12: number, m: number, p: 'AM' | 'PM') => {
    if (minTotal < 0) return false;
    const h24 = to24(h12, p);
    return h24 * 60 + m <= minTotal;
  };

  const handleOpen = () => {
    if (disabled) return;
    const p = parseTime24(value);
    setDraftHour12(toHour12(p.hour));
    setDraftMinute(p.minute);
    setDraftPeriod(p.hour >= 12 ? 'PM' : 'AM');
    setOpen(true);
  };

  const handleApply = () => {
    const h24 = to24(draftHour12, draftPeriod);
    onChange(toTimeString(h24, draftMinute));
    setOpen(false);
  };

  const updatePanelPosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    const w = Math.max(r.width, 280);
    let left = r.left;
    if (left + w > window.innerWidth - margin) left = window.innerWidth - w - margin;
    left = Math.max(margin, left);
    const estH = 280;
    let top = r.bottom + 6;
    if (top + estH > window.innerHeight - margin) top = Math.max(margin, r.top - estH - 6);
    setPanelBox({ top, left, width: w });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => updatePanelPosition();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (wrapperRef.current?.contains(t)) return;
      if (t.closest('[data-catalog-time-popover]')) return;
      setOpen(false);
    };
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', handler);
    };
  }, [open]);

  const handlePeriodChange = (p: 'AM' | 'PM') => {
    setDraftPeriod(p);
    if (isTimeDisabled(draftHour12, draftMinute, p) && minParsed) {
      const newH24 = to24(draftHour12, p);
      if (newH24 * 60 + draftMinute <= minTotal) {
        const nextMin = minTotal + 1;
        const nh = Math.floor(nextMin / 60) % 24;
        const nm = nextMin % 60;
        const nh12 = nh === 0 ? 12 : nh > 12 ? nh - 12 : nh;
        setDraftHour12(nh12);
        setDraftMinute(nm);
      }
    }
  };

  const displayLabel = value ? formatTime12h(value) : '--:-- --';

  const popoverZ = zIndex + 10000;

  const popover = open && (
    <div
      data-catalog-time-popover
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        top: panelBox.top,
        left: panelBox.left,
        width: panelBox.width,
        zIndex: popoverZ,
        background: '#FFFFFF',
        borderRadius: 2,
        boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
        border: '1px solid #E6DFD3',
        minWidth: 260,
        overflow: 'visible',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div style={{ padding: '12px 18px 10px', borderBottom: '1px solid #FFFFFF' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#9A9084', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Select Time
        </span>
      </div>

      <div style={{ padding: '16px 20px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <SpinnerField
          value={draftHour12}
          onChange={setDraftHour12}
          min={1}
          max={12}
          wrap
          disabled={(h) => isTimeDisabled(h, draftMinute, draftPeriod)}
        />

        <span style={{ fontSize: 26, fontWeight: 800, color: '#D6CCBB', marginBottom: 8 }}>:</span>

        <SpinnerField
          value={draftMinute}
          onChange={setDraftMinute}
          min={0}
          max={59}
          wrap
          disabled={(m) => isTimeDisabled(draftHour12, m, draftPeriod)}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 6 }}>
          {(['AM', 'PM'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePeriodChange(p)}
              style={{
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                borderRadius: 2,
                cursor: 'pointer',
                background: draftPeriod === p ? 'rgba(184,149,80,0.1)' : '#FFFFFF',
                color: draftPeriod === p ? '#B89550' : '#9A9084',
                transition: 'all 0.12s ease',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '10px 20px 14px',
          borderTop: '1px solid #F4F0E8',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            padding: '8px 16px',
            borderRadius: 2,
            border: 'none',
            background: 'none',
            fontSize: 13,
            fontWeight: 600,
            color: '#6E665D',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          style={{
            padding: '8px 20px',
            borderRadius: 2,
            border: 'none',
            background: 'var(--accent,#B89550)',
            fontSize: 13,
            fontWeight: 700,
            color: '#FFFFFF',
            cursor: 'pointer',
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'relative', width: '100%' }} ref={wrapperRef}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6E665D', marginBottom: 6, fontFamily: 'var(--font-primary)' }}>{label}</div>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 10px',
          borderRadius: 2,
          border: '1px solid var(--card-border, #E6DFD3)',
          fontFamily: 'var(--font-primary)',
          fontSize: 13,
          fontWeight: 400,
          color: value ? 'var(--t2, #6E665D)' : 'var(--t3, #9A9084)',
          background: 'var(--surface, #FFFFFF)',
          minHeight: 40,
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 7 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--t3, #9A9084)', flexShrink: 0 }}>schedule</span>
          {displayLabel}
        </span>
      </button>

      {typeof document !== 'undefined' && open && createPortal(popover, document.body)}
    </div>
  );
}
