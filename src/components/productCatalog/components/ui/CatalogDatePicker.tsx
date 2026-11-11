import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday as dfIsToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function isoToDate(iso: string): Date | null {
  if (!iso || !ISO_RE.test(iso)) return null;
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function toIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoToUsDisplay(iso: string): string {
  if (!iso || !ISO_RE.test(iso)) return '';
  const [y, m, dd] = iso.split('-');
  return `${m}/${dd}/${y}`;
}

function startOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayOutOfRange(day: Date, minD: Date | null, maxD: Date | null): boolean {
  const t = startOfDayLocal(day);
  if (minD && t < startOfDayLocal(minD)) return true;
  if (maxD && t > startOfDayLocal(maxD)) return true;
  return false;
}

export interface CatalogDatePickerProps {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  isMobile?: boolean;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  zIndex?: number;
}

export function CatalogDatePicker({
  value,
  onChange,
  placeholder = 'mm/dd/yyyy',
  isMobile = false,
  minDate,
  maxDate,
  disabled = false,
  zIndex = 300,
}: CatalogDatePickerProps) {
  const triggerId = useId();
  const titleId = `${triggerId}-cal-title`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => isoToDate(value), [value]);
  const minD = useMemo(() => (minDate ? isoToDate(minDate) : null), [minDate]);
  const maxD = useMemo(() => (maxDate ? isoToDate(maxDate) : null), [maxDate]);

  const [viewMonth, setViewMonth] = useState<Date>(() => selected ?? new Date());
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 280 });

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    const panelW = isMobile ? Math.min(320, window.innerWidth - 16) : 288;
    let left = r.left + (r.width - panelW) / 2;
    if (left + panelW > window.innerWidth - 8) left = window.innerWidth - panelW - 8;
    left = Math.max(8, left);
    let top = r.bottom + 6;
    const estH = 340;
    if (top + estH > window.innerHeight - 8) top = Math.max(8, r.top - estH - 6);
    setCoords({ top, left, width: panelW });
  }, [open, isMobile]);

  useEffect(() => {
    if (!open) return;
    if (selected) setViewMonth(startOfMonth(selected));
    else setViewMonth(startOfMonth(new Date()));
  }, [open, value, selected]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const display = isoToUsDisplay(value);
  const pad = isMobile ? 6 : 8;
  const fs = isMobile ? 12 : 13;

  const selectDay = (d: Date) => {
    if (dayOutOfRange(d, minD, maxD)) return;
    onChange(toIsoLocal(d));
    setOpen(false);
  };

  const pickToday = () => {
    const t = new Date();
    if (dayOutOfRange(t, minD, maxD)) return;
    onChange(toIsoLocal(t));
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setOpen(false);
  };

  const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        id={triggerId}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: `${pad}px ${pad + 2}px`,
          borderRadius: isMobile ? 6 : 8,
          border: '1px solid var(--card-border, #E6DFD3)',
          fontFamily: 'var(--font-primary)',
          fontSize: fs,
          fontWeight: 400,
          color: display ? 'var(--t2, #6E665D)' : 'var(--t3, #9A9084)',
          background: 'var(--surface, #FFFFFF)',
          minHeight: isMobile ? 34 : 40,
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {display || placeholder}
        </span>
        <span className="material-symbols-rounded" style={{ fontSize: isMobile ? 18 : 20, color: 'var(--t3, #9A9084)', flexShrink: 0 }}>
          calendar_today
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: coords.width,
            zIndex,
            background: 'var(--surface, #FFFFFF)',
            borderRadius: 2,
            border: '1px solid var(--card-border, #E6DFD3)',
            boxShadow: '0 14px 34px rgba(15, 23, 42, 0.14)',
            fontFamily: 'var(--font-primary)',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 10px 8px',
              borderBottom: '1px solid var(--card-border, #E6DFD3)',
            }}
          >
            <div id={titleId} style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1, #453F39)' }}>
              {format(viewMonth, 'MMMM yyyy')}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setViewMonth((m) => subMonths(m, 1))}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 2,
                  border: '1px solid var(--card-border, #E6DFD3)',
                  background: 'var(--surface, #FFFFFF)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--t2, #6E665D)',
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>chevron_left</span>
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 2,
                  border: '1px solid var(--card-border, #E6DFD3)',
                  background: 'var(--surface, #FFFFFF)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--t2, #6E665D)',
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>chevron_right</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, padding: '8px 10px 4px' }}>
            {weekdayLabels.map((w) => (
              <div key={w} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--t3, #9A9084)' }}>
                {w}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, padding: '0 10px 10px' }}>
            {days.map((day) => {
              const outside = !isSameMonth(day, viewMonth);
              const sel = selected && isSameDay(day, selected);
              const today = dfIsToday(day);
              const dis = dayOutOfRange(day, minD, maxD);
              return (
                <button
                  key={format(day, 'yyyy-MM-dd')}
                  type="button"
                  disabled={dis}
                  onClick={() => selectDay(day)}
                  style={{
                    aspectRatio: '1',
                    minWidth: 0,
                    borderRadius: 2,
                    border: sel ? '2px solid var(--accent, #B89550)' : '1px solid transparent',
                    background: sel ? 'var(--accent-soft, rgba(184,149,80,0.08))' : 'transparent',
                    color: outside ? 'var(--t3, #9A9084)' : dis ? 'var(--t3, #9A9084)' : 'var(--t1, #453F39)',
                    fontSize: 12,
                    fontWeight: sel ? 600 : 400,
                    cursor: dis ? 'not-allowed' : 'pointer',
                    opacity: dis ? 0.35 : outside ? 0.55 : 1,
                    boxShadow: today && !sel ? 'inset 0 0 0 1px var(--accent, #B89550)' : undefined,
                    fontFamily: 'var(--font-primary)',
                    padding: 0,
                  }}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px 12px',
              borderTop: '1px solid var(--card-border, #E6DFD3)',
            }}
          >
            <button
              type="button"
              onClick={clear}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--accent, #B89550)',
                fontFamily: 'var(--font-primary)',
              }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={pickToday}
              disabled={dayOutOfRange(new Date(), minD, maxD)}
              style={{
                border: 'none',
                background: 'none',
                cursor: dayOutOfRange(new Date(), minD, maxD) ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--accent, #B89550)',
                opacity: dayOutOfRange(new Date(), minD, maxD) ? 0.4 : 1,
                fontFamily: 'var(--font-primary)',
              }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
