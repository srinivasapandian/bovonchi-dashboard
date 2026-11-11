import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';

export interface BulkAction {
  key: string;
  label: string;
  /** Material Symbols icon name, e.g. "print". */
  icon: string;
  /** Destructive actions render last, in red, after a divider. */
  danger?: boolean;
  onSelect: () => void;
}

interface BulkActionsMenuProps {
  actions: BulkAction[];
  /** Icon-only "⋯" trigger (mobile selection bar). */
  compact?: boolean;
}

const triggerStyle = (compact: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: compact ? 4 : '4px 10px',
  borderRadius: 'var(--radius-button, 6px)',
  border: compact ? 'none' : '1px solid var(--card-border, #E6DFD3)',
  background: compact ? 'transparent' : 'var(--surface, #FFFFFF)',
  color: 'var(--t1, #453F39)',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
});

const menuStyle = (compact: boolean): CSSProperties => ({
  position: 'absolute',
  top: 'calc(100% + 4px)',
  ...(compact ? { right: 0 } : { left: 0 }),
  minWidth: 180,
  padding: 4,
  background: 'var(--surface, #FFFFFF)',
  border: '1px solid var(--card-border, #E6DFD3)',
  borderRadius: 'var(--radius-input, 8px)',
  boxShadow: 'var(--shadow, 0 4px 16px rgba(0,0,0,0.08))',
  zIndex: 20,
});

const itemStyle = (danger: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '8px 10px',
  border: 'none',
  borderRadius: 'var(--radius-button, 6px)',
  background: 'transparent',
  color: danger ? 'var(--red, #A63D2F)' : 'var(--t1, #453F39)',
  fontSize: 13,
  fontFamily: 'var(--font-primary)',
  textAlign: 'left',
  cursor: 'pointer',
});

export function BulkActionsMenu({ actions, compact = false }: BulkActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const ordered = [...actions.filter((a) => !a.danger), ...actions.filter((a) => a.danger)];
  const firstDangerIndex = ordered.findIndex((a) => a.danger);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const onItemKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (index + (e.key === 'ArrowDown' ? 1 : -1) + ordered.length) % ordered.length;
      itemRefs.current[next]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? 'Actions' : undefined}
        onClick={() => setOpen((v) => !v)}
        style={triggerStyle(compact)}
      >
        {compact ? (
          <span className="material-symbols-rounded" style={{ fontSize: 20 }} aria-hidden="true">more_horiz</span>
        ) : (
          <>
            Actions
            <span className="material-symbols-rounded" style={{ fontSize: 18 }} aria-hidden="true">expand_more</span>
          </>
        )}
      </button>
      {open && (
        <div role="menu" style={menuStyle(compact)}>
          {ordered.map((action, index) => (
            <div key={action.key}>
              {index === firstDangerIndex && index > 0 && (
                <div role="separator" style={{ height: 1, margin: '4px 0', background: 'var(--divider, #F1ECE2)' }} />
              )}
              <button
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitem"
                onKeyDown={(e) => onItemKeyDown(e, index)}
                onClick={() => {
                  close(false);
                  action.onSelect();
                }}
                style={itemStyle(Boolean(action.danger))}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18 }} aria-hidden="true">{action.icon}</span>
                {action.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
