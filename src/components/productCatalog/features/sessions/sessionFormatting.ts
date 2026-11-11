import type { Session, SessionSlot } from '../../data/types';
import { parseTimeParts, formatTime12h } from '../../../../utils/timeFormat';

export { parseTimeParts, formatTime12h };

const DAY_SHORT: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const WEEKEND = ['Saturday', 'Sunday'];
const ALL_DAYS = [...WEEKDAYS, ...WEEKEND];

/** Hour columns for weekly timeline UIs (12am–11pm). */
export const SESSION_GRID_START = 0;
export const SESSION_GRID_END = 23;
export const SESSION_GRID_HOURS = Array.from(
  { length: SESSION_GRID_END - SESSION_GRID_START + 1 },
  (_, i) => i + SESSION_GRID_START,
);

/** "Mon to Thu", "Fri, Sat", "Sun" style labels for session pills and lists. */
export function formatSlotDaysLong(days: string[]): string {
  if (days.length === 0) return 'No days';
  const daySet = new Set(days);
  if (daySet.size === 7) return 'Every day';
  if (daySet.size === 5 && WEEKDAYS.every((d) => daySet.has(d))) return 'Mon to Fri';
  if (daySet.size === 2 && WEEKEND.every((d) => daySet.has(d))) return 'Sat, Sun';

  const sorted = Array.from(daySet).sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b));
  const indices = sorted.map((d) => ALL_DAYS.indexOf(d));

  const segments: number[][] = [];
  let cur = [indices[0]];
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] === indices[i - 1] + 1) cur.push(indices[i]);
    else {
      segments.push(cur);
      cur = [indices[i]];
    }
  }
  segments.push(cur);

  const formatSegment = (seg: number[]): string => {
    const shorts = seg.map((i) => DAY_SHORT[ALL_DAYS[i]]);
    if (shorts.length === 1) return shorts[0];
    if (shorts.length === 2) return `${shorts[0]}, ${shorts[1]}`;
    return `${shorts[0]} to ${shorts[shorts.length - 1]}`;
  };

  return segments.map(formatSegment).join(', ');
}

export function formatSlotSummaryLine(days: string[], startTime: string, endTime: string): string {
  return `${formatSlotDaysLong(days)} | ${formatTime12h(startTime)} – ${formatTime12h(endTime)}`;
}

export function formatSlotDays(days: string[]): string {
  if (days.length === 0) return 'No days';
  const daySet = new Set(days);
  if (daySet.size === 7) return 'Every day';
  if (daySet.size === 5 && WEEKDAYS.every((d) => daySet.has(d))) return 'Mon–Fri';
  if (daySet.size === 2 && WEEKEND.every((d) => daySet.has(d))) return 'Sat–Sun';
  const sorted = Array.from(daySet).sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b));
  if (sorted.length <= 3) {
    return sorted.map((d) => DAY_SHORT[d] || d).join(', ');
  }
  return `${DAY_SHORT[sorted[0]]}–${DAY_SHORT[sorted[sorted.length - 1]]}`;
}

export function timeToDecimal(time: string): number {
  const { hours24, minutes } = parseTimeParts(time);
  return hours24 + minutes / 60;
}

export function getSessionWeeklyHours(session: Session): number {
  let totalMinutes = 0;
  for (const slot of session.slots) {
    const start = parseTimeParts(slot.startTime);
    const end = parseTimeParts(slot.endTime);
    let startMin = start.hours24 * 60 + start.minutes;
    let endMin = end.hours24 * 60 + end.minutes;
    if (endMin <= startMin) endMin += 24 * 60;
    totalMinutes += (endMin - startMin) * slot.days.length;
  }
  return Math.round((totalMinutes / 60) * 10) / 10;
}

export function flattenSessionDays(session: Session): string[] {
  const seen = new Set<string>();
  for (const sl of session.slots) {
    sl.days.forEach((d) => seen.add(d));
  }
  return Array.from(seen);
}

/** Display order Mon → Sun; tie-break by start then end time. */
export function sortSessionSlotsByWeekdayOrder(slots: SessionSlot[]): SessionSlot[] {
  const earliestDayIndex = (slot: SessionSlot): number => {
    if (slot.days.length === 0) return 99;
    const idxs = slot.days
      .map((d) => ALL_DAYS.indexOf(d as (typeof ALL_DAYS)[number]))
      .filter((i) => i >= 0);
    return idxs.length ? Math.min(...idxs) : 99;
  };
  return [...slots].sort((a, b) => {
    const da = earliestDayIndex(a);
    const db = earliestDayIndex(b);
    if (da !== db) return da - db;
    const ts = (a.startTime || '').localeCompare(b.startTime || '');
    if (ts !== 0) return ts;
    return (a.endTime || '').localeCompare(b.endTime || '');
  });
}

/** Stable key so "9:00" and "09:00" merge as the same slot window. */
function slotTimeRangeKey(slot: SessionSlot): string {
  const s = parseTimeParts(slot.startTime);
  const e = parseTimeParts(slot.endTime);
  return `${s.hours24 * 60 + s.minutes}-${e.hours24 * 60 + e.minutes}`;
}

export function formatSessionScheduleSummary(session: Pick<Session, 'slots'>): string {
  const rawSlots = session.slots ?? [];
  if (rawSlots.length === 0) return 'No schedule';

  const slots = sortSessionSlotsByWeekdayOrder(rawSlots);
  const merged = new Map<string, Set<string>>();
  for (const slot of slots) {
    const key = slotTimeRangeKey(slot);
    if (!merged.has(key)) merged.set(key, new Set());
    for (const d of slot.days ?? []) merged.get(key)!.add(d);
  }

  const entries = Array.from(merged.entries()).map(([rangeKey, daySet]) => {
    const [startMinStr, endMinStr] = rangeKey.split('-');
    const startMin = Number(startMinStr);
    const endMin = Number(endMinStr);
    const toTimeStr = (totalMin: number) => {
      const h = Math.floor(totalMin / 60) % 24;
      const m = totalMin % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };
    const days = Array.from(daySet);
    const idxs = days
      .map((d) => ALL_DAYS.indexOf(d as (typeof ALL_DAYS)[number]))
      .filter((i) => i >= 0);
    const minIdx = idxs.length ? Math.min(...idxs) : 99;
    return {
      minIdx,
      text: `${formatSlotDaysLong(days)} ${formatTime12h(toTimeStr(startMin))} – ${formatTime12h(toTimeStr(endMin))}`,
    };
  });
  entries.sort((a, b) => a.minIdx - b.minIdx);
  return entries.map((e) => e.text).join(' · ');
}

export { DAY_SHORT, ALL_DAYS, WEEKDAYS, WEEKEND };
