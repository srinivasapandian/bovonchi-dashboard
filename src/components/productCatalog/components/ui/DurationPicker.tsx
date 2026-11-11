import { useState } from 'react';
import { CatalogDateTimePicker, todayIsoLocal } from './CatalogDateTimePicker';
import { formatInactiveUntilLocal } from '../../features/availability/endOfSessionInactive';

/**
 * PCF-18.11: Shared duration picker for 86 actions across all entity types.
 * Three options: Manual, Next Session, Specific Time.
 */

const TEAL = '#5E8C7B';
const ORANGE = '#B07A2A';
const T1 = '#453F39';
const T2 = '#6E665D';
const T3 = '#9A9084';
const BORDER = '#E6DFD3';
const HOVER = '#F4F0E8';

export type DurationMode = 'manual' | 'next_session' | 'specific_time';

interface DurationPickerProps {
  value: DurationMode;
  onChange: (mode: DurationMode, reEnableAt?: string) => void;
  /** Show compact inline version for modifier options */
  compact?: boolean;
  /** Default for POS is 'next_session', back office is 'manual' */
  defaultMode?: DurationMode;
}

const OPTIONS: { id: DurationMode; icon: string; label: string; desc: string }[] = [
  { id: 'manual', icon: 'lock', label: 'Until re-enabled', desc: 'Stays out of stock until manually restored' },
  { id: 'next_session', icon: 'update', label: 'Until next session', desc: 'Auto-restores when next session starts' },
  { id: 'specific_time', icon: 'schedule', label: 'Until specific time', desc: 'Pick a date and time to auto-restore' },
];

export default function DurationPicker({ value, onChange, compact }: DurationPickerProps) {
  const [specificTime, setSpecificTime] = useState('');

  if (compact) {
    // Inline compact version for modifier options
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            title={opt.desc}
            style={{
              width: 26, height: 26, borderRadius: 2, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: value === opt.id ? `${TEAL}15` : 'transparent',
              color: value === opt.id ? TEAL : T3,
              transition: 'all 0.15s',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>{opt.icon}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: T2, marginBottom: 8, fontFamily: 'var(--font-primary)' }}>
        Duration
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                borderRadius: 2, cursor: 'pointer', textAlign: 'left',
                border: selected ? `1.5px solid ${TEAL}` : `1px solid ${BORDER}`,
                background: selected ? `${TEAL}06` : '#fff',
                transition: 'all 0.15s',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 20, color: selected ? TEAL : T3, flexShrink: 0 }}>
                {opt.icon}
              </span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: selected ? TEAL : T1, fontFamily: 'var(--font-primary)' }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 10, color: T2, fontFamily: 'var(--font-primary)', marginTop: 1 }}>
                  {opt.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {value === 'specific_time' && (
        <div style={{ marginTop: 8 }}>
          <CatalogDateTimePicker
            value={specificTime}
            onChange={(v) => {
              setSpecificTime(v);
              if (v) onChange('specific_time', formatInactiveUntilLocal(v));
            }}
            min={todayIsoLocal()}
            placeholder="Pick date & time"
          />
        </div>
      )}
    </div>
  );
}
