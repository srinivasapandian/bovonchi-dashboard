import { useMemo } from 'react';
import { CatalogDatePicker } from './CatalogDatePicker';
import { CatalogTimePicker } from './CatalogTimePicker';

const T2 = '#6E665D';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function todayIsoLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export interface CatalogDateTimePickerProps {
  value: string;
  onChange: (val: string) => void;
  min?: string;
  placeholder?: string;
  disabled?: boolean;
  zIndex?: number;
}

/**
 * Composes {@link CatalogDatePicker} (seasonal item style) + {@link CatalogTimePicker} (session slot style).
 * Value / onChange use `YYYY-MM-DDTHH:mm` local.
 */
export function CatalogDateTimePicker({
  value,
  onChange,
  min,
  placeholder,
  disabled = false,
  zIndex = 300,
}: CatalogDateTimePickerProps) {
  const hasDatetime = value.includes('T') && value.length >= 16;
  const datePart = hasDatetime ? value.slice(0, 10) : (value.length === 10 ? value : '');
  const timePart = hasDatetime ? value.slice(11, 16) : '';

  const minDateStr = useMemo(() => (min && min.length >= 10 ? min.slice(0, 10) : undefined), [min]);
  const minTimeForPicker = useMemo(() => {
    if (!min || min.length < 16 || !datePart) return undefined;
    if (min.slice(0, 10) !== datePart) return undefined;
    return min.slice(11, 16);
  }, [min, datePart]);

  const handleDateChange = (iso: string) => {
    if (!iso) {
      // Date cleared — reset entirely so the Apply button becomes disabled.
      onChange('');
      return;
    }
    if (timePart) {
      onChange(`${iso}T${timePart}`);
    } else {
      onChange(iso);
    }
  };

  const handleTimeChange = (hhmm: string) => {
    const d = datePart || minDateStr || todayIsoLocal();
    onChange(`${d}T${hhmm}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ width: '100%' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: T2,
            marginBottom: 6,
            fontFamily: 'var(--font-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Date
        </div>
        <CatalogDatePicker
          value={datePart}
          onChange={handleDateChange}
          minDate={minDateStr}
          placeholder={placeholder ?? 'mm/dd/yyyy'}
          disabled={disabled}
          zIndex={zIndex}
        />
      </div>
      <div style={{ width: '100%' }}>
        <CatalogTimePicker
          value={timePart}
          onChange={handleTimeChange}
          minTime={minTimeForPicker}
          label="Time"
          zIndex={zIndex}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
