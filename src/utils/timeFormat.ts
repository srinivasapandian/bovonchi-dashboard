/** Shared wall-clock time helpers. Wire format stays `HH:mm` 24h; conversion to/from
 * 12h + AM/PM only happens at the UI boundary (display and picker input). */

export function parseTimeParts(time: string): { hours24: number; minutes: number } {
  const raw = (time ?? '').toString().trim();
  if (!raw) return { hours24: 0, minutes: 0 };

  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h = Number(ampmMatch[1]);
    const m = Number(ampmMatch[2]);
    const suffix = ampmMatch[3].toUpperCase();
    if (!Number.isFinite(h) || !Number.isFinite(m)) return { hours24: 0, minutes: 0 };
    if (suffix === 'PM' && h !== 12) h += 12;
    if (suffix === 'AM' && h === 12) h = 0;
    return { hours24: h, minutes: m };
  }

  const parts = raw.split(':');
  if (parts.length >= 2) {
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      const hours24 = ((h % 24) + 24) % 24;
      const minutes = ((m % 60) + 60) % 60;
      return { hours24, minutes };
    }
  }

  return { hours24: 0, minutes: 0 };
}

export function formatTime12h(time: string): string {
  const { hours24: hour, minutes: min } = parseTimeParts(time);
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const mm = min.toString().padStart(2, '0');
  return `${hour12}:${mm} ${ampm}`;
}

/** Combine discrete 12h picker state (hour 1-12, minute, AM/PM) into a zero-padded `HH:mm` 24h string. */
export function to24Hour(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  const hour24 = period === 'AM' ? (hour12 === 12 ? 0 : hour12) : (hour12 === 12 ? 12 : hour12 + 12);
  return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}
