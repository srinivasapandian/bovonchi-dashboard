import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import type { KitchenPrintFormValue, KitchenPrintMode } from '../../data/types';
import { getChannelDisplayName, type OutletOrderType } from '../../utils/outletOrderTypes';
import { labelStyle, errorStyle } from './formStyles';

interface KitchenPrintOrderTypesFieldProps {
  orderTypes: OutletOrderType[];
  value: KitchenPrintFormValue;
  onChange: (next: KitchenPrintFormValue) => void;
  /** What "follow outlet default" currently means, e.g. "Takeaway, Online". */
  followLabel?: string;
  error?: string;
}

const rowStyle: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' };

const modeStyle = (active: boolean): CSSProperties => ({
  padding: '6px 14px',
  borderRadius: 'var(--radius-button, 6px)',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
  border: active ? '1.5px solid var(--accent, #B89550)' : '1px solid var(--card-border, #E6DFD3)',
  background: active ? 'var(--accent-soft, rgba(184,149,80,0.08))' : 'var(--surface, #FFFFFF)',
  color: active ? 'var(--accent, #B89550)' : 'var(--t2, #6E665D)',
});

const chipStyle = (on: boolean): CSSProperties => ({
  ...modeStyle(on),
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  borderRadius: 999,
  padding: '5px 12px',
});

const noteStyle = (color: string): CSSProperties => ({
  fontSize: 11,
  fontFamily: 'var(--font-primary)',
  color,
  margin: 0,
});

export function KitchenPrintOrderTypesField({
  orderTypes,
  value,
  onChange,
  followLabel = 'All order types',
  error,
}: KitchenPrintOrderTypesFieldProps) {
  const modes: Array<{ mode: KitchenPrintMode; label: string }> = [
    { mode: 'all', label: `Follow outlet default (${followLabel})` },
    { mode: 'selected', label: 'Custom order types' },
  ];

  // Switching to "Custom order types" starts with every order type selected (same as the item
  // edit page, where nothing excluded = every chip on) — the user unchecks the ones to exclude,
  // rather than starting from none and having to check each one.
  const setMode = (mode: KitchenPrintMode) =>
    onChange({
      mode,
      orderTypeIds:
        mode === 'all' ? [] : value.orderTypeIds.length > 0 ? value.orderTypeIds : orderTypes.map((ot) => ot.id),
    });
  const toggle = (id: string) =>
    onChange({
      ...value,
      orderTypeIds: value.orderTypeIds.includes(id)
        ? value.orderTypeIds.filter((x) => x !== id)
        : [...value.orderTypeIds, id],
    });

  const radioRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleRadioKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % modes.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + modes.length) % modes.length;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    setMode(modes[nextIndex].mode);
    radioRefs.current[nextIndex]?.focus();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={labelStyle}>Print to kitchen for</span>
      <div role="radiogroup" aria-label="Print to kitchen for" style={rowStyle}>
        {modes.map(({ mode, label }, index) => {
          const checked = value.mode === mode;
          return (
            <button
              key={mode}
              ref={(el) => {
                radioRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => setMode(mode)}
              onKeyDown={(event) => handleRadioKeyDown(event, index)}
              style={modeStyle(checked)}
            >
              {label}
            </button>
          );
        })}
      </div>
      {value.mode === 'selected' && (
        orderTypes.length === 0 ? (
          <p style={noteStyle('var(--t3, #9A9084)')}>This outlet has no order types set up.</p>
        ) : (
          <div style={rowStyle}>
            {orderTypes.map((ot) => {
              const on = value.orderTypeIds.includes(ot.id);
              return (
                <button key={ot.id} type="button" aria-pressed={on} onClick={() => toggle(ot.id)} style={chipStyle(on)}>
                  {on && <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden="true">check</span>}
                  {getChannelDisplayName(ot.typeName)}
                  {ot.typeName.toLowerCase().includes('delivery') && ' (incl. third-party)'}
                </button>
              );
            })}
          </div>
        )
      )}
      {error && <p style={errorStyle}>{error}</p>}
    </div>
  );
}
