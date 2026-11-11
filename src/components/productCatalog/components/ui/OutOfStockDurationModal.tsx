import { useState } from 'react';
import { Modal } from './Modal';
import { CatalogDateTimePicker, todayIsoLocal } from './CatalogDateTimePicker';
import { formatInactiveUntilLocal } from '../../features/availability/endOfSessionInactive';

export type DurationMode = 'manual' | 'next_session' | 'specific_time';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (mode: DurationMode, reEnableAt?: string) => void;
  itemName: string;
  /** Default mode — POS defaults to 'next_session', back office to 'manual'. */
  defaultMode?: DurationMode;
}

const modeOptions: { value: DurationMode; label: string; desc: string; icon: string }[] = [
  { value: 'manual', label: 'Until manually re-enabled', desc: 'Item stays Out of Stock until someone changes it back.', icon: 'block' },
  { value: 'next_session', label: 'Until next session', desc: 'Auto-re-enables when the next assigned session starts.', icon: 'schedule' },
  { value: 'specific_time', label: 'Until specific time', desc: 'Auto-re-enables at the time you choose.', icon: 'event' },
];

export function OutOfStockDurationModal({ open, onClose, onConfirm, itemName, defaultMode = 'manual' }: Props) {
  const [mode, setMode] = useState<DurationMode>(defaultMode);
  const [dateTime, setDateTime] = useState('');

  const handleConfirm = () => {
    if (mode === 'specific_time' && !dateTime) return;
    onConfirm(mode, mode === 'specific_time' ? formatInactiveUntilLocal(dateTime) : undefined);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Out of Stock Duration"
      width={440}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: 2, border: '1px solid #E6DFD3',
              background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              color: '#453F39', fontFamily: 'var(--font-primary)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={mode === 'specific_time' && !dateTime}
            style={{
              padding: '8px 20px', borderRadius: 2, border: 'none',
              background: mode === 'specific_time' && !dateTime ? '#E6DFD3' : '#A63D2F',
              cursor: mode === 'specific_time' && !dateTime ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600, color: '#fff',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Mark Out of Stock
          </button>
        </div>
      }
    >
      <p style={{ fontSize: 13, color: '#6E665D', margin: '0 0 16px', lineHeight: 1.5 }}>
        How long should <strong>'{itemName}'</strong> remain out of stock?
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {modeOptions.map((opt) => (
          <label
            key={opt.value}
            onClick={() => setMode(opt.value)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
              borderRadius: 2, border: `1.5px solid ${mode === opt.value ? '#A63D2F' : '#E6DFD3'}`,
              background: mode === opt.value ? 'rgba(166,61,47, 0.04)' : '#fff',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            <span className="material-symbols-rounded" style={{
              fontSize: 22, color: mode === opt.value ? '#A63D2F' : '#9A9084',
              marginTop: 1,
            }}>
              {opt.icon}
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#453F39', marginBottom: 2 }}>
                {opt.label}
              </div>
              <div style={{ fontSize: 12, color: '#6E665D', lineHeight: 1.4 }}>
                {opt.desc}
              </div>
            </div>
          </label>
        ))}
      </div>

      {mode === 'specific_time' && (
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#6E665D', display: 'block', marginBottom: 6 }}>
            Re-enable at
          </label>
          <CatalogDateTimePicker
            value={dateTime}
            onChange={(v) => setDateTime(v)}
            min={todayIsoLocal()}
            placeholder="Pick date & time"
          />
        </div>
      )}

      {mode === 'next_session' && (
        <p style={{ fontSize: 11, color: '#B07A2A', margin: '12px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>info</span>
          Item will re-enable at the start of its next assigned session.
        </p>
      )}
    </Modal>
  );
}
