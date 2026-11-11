import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  /** Selected day, YYYY-MM-DD (outlet-local). */
  value: string;
  /** Latest selectable day (usually "today" in the outlet's timezone); later days are disabled. */
  max: string;
  onChange: (ymd: string) => void;
}

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n: number) => String(n).padStart(2, '0');
const toYmd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m: (m || 1) - 1, d: d || 1 };
};

/** "2026-10-28" → "10/28/26" */
export const shortDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-');
  return y && m && d ? `${m}/${d}/${y.slice(2)}` : ymd;
};

/** 42-cell month grid (6 weeks) including the neighbouring months' days, which render muted. */
function buildGrid(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const cells: { ymd: string; day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(year, month, 1 - first + i);
    cells.push({ ymd: toYmd(dt.getFullYear(), dt.getMonth(), dt.getDate()), day: dt.getDate(), inMonth: dt.getMonth() === month });
  }
  return cells;
}

export default function DatePicker({ value, max, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const sel = parse(value);
  const [view, setView] = useState({ y: sel.y, m: sel.m });
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const toggle = () => {
    if (!open) setView({ y: sel.y, m: sel.m }); // always reopen on the selected month
    setOpen((o) => !o);
  };

  const maxP = parse(max);
  const atMaxMonth = view.y > maxP.y || (view.y === maxP.y && view.m >= maxP.m);
  const step = (delta: number) =>
    setView((v) => {
      const dt = new Date(v.y, v.m + delta, 1);
      return { y: dt.getFullYear(), m: dt.getMonth() };
    });
  const pick = (ymd: string) => {
    onChange(ymd);
    setOpen(false);
  };

  return (
    <div className="bv-popwrap bv-popwrap--date" ref={ref}>
      <button
        type="button"
        className={`bv-ctl bv-ctl--date${open ? ' is-open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Order date ${shortDate(value)}`}
        onClick={toggle}
      >
        <span>{shortDate(value)}</span>
        <span className="material-symbols-rounded">calendar_today</span>
      </button>

      {open && (
        <div className="bv-cal" role="dialog" aria-label="Choose order date">
          <div className="bv-cal__head">
            <button type="button" className="bv-cal__nav" onClick={() => step(-1)} aria-label="Previous month">
              <span className="material-symbols-rounded">chevron_left</span>
            </button>
            <div className="bv-cal__title">
              {MONTHS[view.m]} {view.y}
            </div>
            <button type="button" className="bv-cal__nav" onClick={() => step(1)} disabled={atMaxMonth} aria-label="Next month">
              <span className="material-symbols-rounded">chevron_right</span>
            </button>
          </div>

          <div className="bv-cal__grid" role="grid">
            {WEEKDAYS.map((w) => (
              <div key={w} className="bv-cal__dow" role="columnheader">
                {w}
              </div>
            ))}
            {buildGrid(view.y, view.m).map((c) => {
              const disabled = c.ymd > max;
              const selected = c.ymd === value;
              return (
                <button
                  key={c.ymd}
                  type="button"
                  role="gridcell"
                  disabled={disabled}
                  aria-selected={selected}
                  className={`bv-cal__day${selected ? ' is-selected' : ''}${c.inMonth ? '' : ' is-outside'}${c.ymd === max ? ' is-today' : ''}`}
                  onClick={() => pick(c.ymd)}
                >
                  {c.day}
                </button>
              );
            })}
          </div>

          <div className="bv-cal__foot">
            <button type="button" onClick={() => pick(max)}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
