/**
 * Store / location timezone helpers — aligned with maghil-portal `src/utils/dateTimeUtils.ts`.
 * Uses IANA zones (e.g. `America/New_York`) from branch `timeZoneCd`, not the browser’s local zone.
 */
import { useEffect, useState } from 'react';

function formatUtc(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const months = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
  const y = d.getUTCFullYear();
  const m = months[d.getUTCMonth()];
  const day = d.getUTCDate();
  const h = d.getUTCHours();
  const min = d.getUTCMinutes();
  const am = h < 12;
  const h12 = h % 12 || 12;
  const a = am ? 'AM' : 'PM';
  return `${m} ${day}, ${y} - ${h12}:${String(min).padStart(2, '0')} ${a}`;
}

/**
 * Full label with year — same behavior as maghil-portal `formatInStoreTimeZone`.
 */
export function formatInStoreTimeZone(
  isoString: string | null | undefined,
  timeZoneCd: string | undefined
): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  if (!timeZoneCd?.trim()) return formatUtc(isoString);
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZoneCd.trim(),
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const parts = formatter.formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const month = get('month');
    const day = get('day');
    const year = get('year');
    const hour = get('hour');
    const minute = get('minute');
    const dayPeriod = get('dayPeriod').toUpperCase();
    return `${month} ${day}, ${year} - ${hour}:${minute} ${dayPeriod}`;
  } catch {
    return formatUtc(isoString);
  }
}

/**
 * Numeric mm/dd/yyyy of an instant, rendered in the store's timezone.
 * Falls back to the browser-local numeric date when no zone is set.
 */
export function formatDateInStoreTimeZone(
  isoString: string | null | undefined,
  timeZoneCd: string | undefined,
  fallback = '-',
): string {
  if (!isoString) return fallback;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return fallback;
  try {
    return new Intl.DateTimeFormat('en-US', {
      ...(timeZoneCd?.trim() ? { timeZone: timeZoneCd.trim() } : {}),
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  }
}

/**
 * `mm/dd/yyyy, h:mm AM/PM` of an instant, rendered in the store's timezone.
 * Falls back to the browser-local numeric datetime when no zone is set.
 */
export function formatDateTimeInStoreTimeZone(
  isoString: string | null | undefined,
  timeZoneCd: string | undefined,
  fallback = '-',
): string {
  if (!isoString) return fallback;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return fallback;
  try {
    return new Intl.DateTimeFormat('en-US', {
      ...(timeZoneCd?.trim() ? { timeZone: timeZoneCd.trim() } : {}),
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  }
}

/**
 * Current calendar date (`yyyy-mm-dd`) in the store's timezone — the correct "today"
 * for min-date floors on date pickers, so a date that is already past at the location
 * cannot be picked (and vice-versa) regardless of the browser's timezone.
 * Falls back to the browser-local date when no zone is set.
 */
export function getStoreTodayYmd(timeZoneCd?: string): string {
  const now = new Date();
  const tz = timeZoneCd?.trim();
  try {
    // 'en-CA' yields ISO-like yyyy-mm-dd parts.
    return new Intl.DateTimeFormat('en-CA', {
      ...(tz ? { timeZone: tz } : {}),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}

/** DST-aware UTC offset (minutes) of `date` in `timeZone`. */
function storeUtcOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return Math.round((asUtc - date.getTime()) / 60000);
}

/**
 * Builds an ISO instant for a picked calendar date (`yyyy-mm-dd`) anchored to the
 * store's local time-of-day *now* — so a payment recorded at the restaurant carries
 * that location's wall-clock time, not the browser's / UTC midnight.
 * Falls back to browser-local when no zone is set.
 */
export function storeLocalDateTimeISO(dateYmd: string, timeZoneCd?: string): string {
  const now = new Date();
  const tz = timeZoneCd?.trim();
  if (!dateYmd) return now.toISOString();
  if (!tz) {
    const [y, m, d] = dateYmd.split('-').map(Number);
    const local = new Date(now);
    local.setFullYear(y, m - 1, d);
    return local.toISOString();
  }
  try {
    // Current store-local time-of-day.
    const t = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(now);
    const get = (type: string) => t.find((p) => p.type === type)?.value ?? '00';
    const hh = get('hour') === '24' ? '00' : get('hour');
    // Offset for the picked date+time so the wall-clock maps to the right instant.
    const offMin = storeUtcOffsetMinutes(new Date(`${dateYmd}T${hh}:${get('minute')}:${get('second')}Z`), tz);
    const sign = offMin >= 0 ? '+' : '-';
    const abs = Math.abs(offMin);
    const oh = String(Math.floor(abs / 60)).padStart(2, '0');
    const om = String(abs % 60).padStart(2, '0');
    return new Date(`${dateYmd}T${hh}:${get('minute')}:${get('second')}${sign}${oh}:${om}`).toISOString();
  } catch {
    return now.toISOString();
  }
}

/**
 * Compact row format without year — Sync History outer rows / device / integration times.
 * Uses `timeZoneCd` when set; otherwise falls back to the same numeric local display as before.
 */
export function formatSyncRowInStoreTimeZone(
  isoString: string | null | undefined,
  timeZoneCd: string | undefined
): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  if (!timeZoneCd?.trim()) {
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timeZoneCd.trim(),
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}

// ── Store-timezone calendar dates (for report date filters) ──────────────────
//
// Report date presets (Today / Yesterday / 7D / 30D / This Month) must anchor on
// the calendar date *at the store*, not at the browser. A store in Chicago viewed
// from an IST browser must see the Chicago date so the startDate/endDate sent to
// the historical APIs match the store's own day. These helpers derive the
// `YYYY-MM-DD` date in the outlet's IANA zone (`timeZoneCd`) and fall back to the
// browser-local date when no zone is set.

/** Calendar date (YYYY-MM-DD) of `date` as it stands in `timeZoneCd`. Local fallback. */
export function dateStrInZone(date: Date, timeZoneCd?: string): string {
  if (Number.isNaN(date.getTime())) return '';
  const local = (): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const tz = timeZoneCd?.trim();
  if (!tz) return local();
  try {
    // en-CA renders as YYYY-MM-DD; formatToParts keeps it locale-stable.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const y = get('year');
    const m = get('month');
    const d = get('day');
    return y && m && d ? `${y}-${m}-${d}` : local();
  } catch {
    return local();
  }
}

/** Shift a YYYY-MM-DD string by whole days. Anchored at UTC noon so it is
 *  immune to DST/offset flips (noon ± 12h never crosses a date in UTC). */
export function shiftDateStr(dateStr: string, deltaDays: number): string {
  if (!dateStr) return dateStr;
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().split('T')[0];
}

// ── Active store timezone (module-global, mirrors `currency.ts`) ─────────────
//
// Set once from BranchContext when the selected outlet loads, and read by the
// report date helpers (`todayStr` / `yesterdayStr`) and the TopBar custom-date
// picker. Default is '' → browser-local, so behaviour is unchanged until the
// outlet's `timeZoneCd` resolves.
let _currentTimeZone = '';
const _tzListeners = new Set<() => void>();

/** Active store IANA timezone, or '' when none has resolved yet. */
export const getStoreTimeZone = (): string => _currentTimeZone;

/** Set the active store timezone (called when the location payload loads). Only
 *  updates when a non-empty zone is provided so intermediate branch changes never
 *  reset it back to browser-local. */
export const setCurrentStoreTimeZone = (timeZoneCd?: string | null): void => {
  const next = typeof timeZoneCd === 'string' ? timeZoneCd.trim() : '';
  if (!next || next === _currentTimeZone) return;
  _currentTimeZone = next;
  _tzListeners.forEach((fn) => { try { fn(); } catch { /* swallow */ } });
};

/** Subscribe to store-timezone changes. Returns the active zone and re-renders the
 *  caller when it changes — use it in memo deps so date anchors recompute once the
 *  outlet's timezone arrives after first paint. */
export const useStoreTimeZone = (): string => {
  const [tz, setTz] = useState<string>(_currentTimeZone);
  useEffect(() => {
    const listener = () => setTz(_currentTimeZone);
    _tzListeners.add(listener);
    if (tz !== _currentTimeZone) setTz(_currentTimeZone);
    return () => { _tzListeners.delete(listener); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return tz;
};

// ── Server clock (authoritative store-local "now") ───────────────────────────
//
// The device clock only tells us the hour AT THE STORE when the outlet's `timeZoneCd`
// has resolved and is correct; until it does, `hourInZone` silently falls back to the
// browser's own zone. That is how the date control's truncation label ("… to 7 AM")
// could end up stating the viewer's hour rather than the store's.
//
// `GET /sales/live/v2/snapshot-details/comparison` answers with the server's own reading
// — `currentTime`, wall clock in `locationTimezone` — taken when it computed the
// comparison numbers. Mirroring it here lets the label describe where the DATA stops.
// Module-global + listener set, exactly like `_currentTimeZone` above, so any consumer
// (the date control, `comparisonTooltip`, exports) sees one reading.

export interface ServerClock {
  /** Calendar date at the store when the response was produced, YYYY-MM-DD. */
  dateISO: string;
  /** Wall-clock hour 0–23 at the store when the response was produced. */
  hour: number;
  /** IANA zone the reading is expressed in; '' when the payload omitted it. */
  timeZoneCd: string;
}

/**
 * How long a reading stays usable. Both endpoints re-answer on every screen load and
 * refresh, so a live session always has a fresh one; this only bounds the damage when a
 * session is left open untouched — without it, a tab parked overnight would keep
 * insisting "today" is yesterday. Past the cutoff we fall back to the device clock,
 * which is exactly the pre-ZAR-1662 behaviour.
 */
export const SERVER_CLOCK_MAX_AGE_MS = 6 * 60 * 60 * 1000;

let _serverClock: ServerClock | null = null;
let _serverClockAt = 0;
const _clockListeners = new Set<() => void>();

/** `"2026-08-07 06:36:37"` (or the ISO `T` form) → `{ dateISO, hour }`. Null if unparseable. */
export function parseServerTime(currentTime?: string | null): { dateISO: string; hour: number } | null {
  if (typeof currentTime !== 'string') return null;
  const m = currentTime.trim().match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  const hour = parseInt(m[2], 10);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;
  return { dateISO: m[1], hour };
}

/** The last server clock reading — null when none has arrived, or when it has gone stale
 *  (see SERVER_CLOCK_MAX_AGE_MS). Date and hour therefore expire together, so a caller can
 *  never mix a server date with a device hour. */
export const getServerClock = (): ServerClock | null => {
  if (!_serverClock) return null;
  return Date.now() - _serverClockAt > SERVER_CLOCK_MAX_AGE_MS ? null : _serverClock;
};

/** Record a reading from an API payload. Silently ignores payloads without a usable
 *  `currentTime`, so a backend that does not send one leaves behaviour unchanged. */
export const setServerClock = (currentTime?: string | null, locationTimezone?: string | null): void => {
  const parsed = parseServerTime(currentTime);
  if (!parsed) return;
  const tz = typeof locationTimezone === 'string' ? locationTimezone.trim() : '';
  const unchanged =
    _serverClock != null &&
    _serverClock.dateISO === parsed.dateISO &&
    _serverClock.hour === parsed.hour &&
    _serverClock.timeZoneCd === tz;
  _serverClock = { ...parsed, timeZoneCd: tz };
  _serverClockAt = Date.now(); // refreshed even when the hour has not turned, so polling keeps it live
  if (unchanged) return; // same hour — don't wake subscribers on every poll
  _clockListeners.forEach((fn) => { try { fn(); } catch { /* swallow */ } });
};

/**
 * The store's CURRENT calendar day — the server's own date when a reading is available,
 * the device's reading of the store timezone otherwise.
 *
 * NOT the reverted DPFIX-02 `getStoreToday()`: that one was about which day the 5 AM
 * cutoff hands to multi-day presets. This is about *where the current date comes from* —
 * `dateStrInZone(new Date(), tz)` is only the store's day when `timeZoneCd` has resolved
 * and is correct, and the comparison endpoints tell us outright. The 5 AM anchor is
 * untouched and still derives from `getAnchorDate`.
 */
export const currentStoreDate = (timeZoneCd: string = getStoreTimeZone()): string =>
  getServerClock()?.dateISO || dateStrInZone(new Date(), timeZoneCd);

/** Drop the reading — called on logout so the next account never inherits the previous
 *  outlet's clock (see the `logout-state-reset` skill). */
export const clearServerClock = (): void => {
  if (!_serverClock) return;
  _serverClock = null;
  _serverClockAt = 0;
  _clockListeners.forEach((fn) => { try { fn(); } catch { /* swallow */ } });
};

/** Subscribe to the server clock. Use it in memo deps so a label derived from the reading
 *  recomputes when the response lands after first paint. */
export const useServerClock = (): ServerClock | null => {
  const [clock, setClock] = useState<ServerClock | null>(_serverClock);
  useEffect(() => {
    const listener = () => setClock(_serverClock);
    _clockListeners.add(listener);
    if (clock !== _serverClock) setClock(_serverClock);
    return () => { _clockListeners.delete(listener); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return clock;
};

// ── Anchor date + 5 AM cutoff (historical report date filters) ───────────────
//
// A day is only a *finalised, reportable* historical day once the store has rolled
// its books over — modelled as a 5:00 AM cutoff in the STORE's own timezone. The
// "anchor date" is the last such finalised day, and the *relative* historical
// presets (Yesterday / 7D / 30D) are defined relative to it — see DateProdIssue.md.
// "This Month" and "This Year" are the exceptions: both are calendar ranges that
// always run to today — see ThisMonthDateProdIssue/ThisMonthDateProdIssueBugFix.md
// and ThisYearDateProdIssue/ThisYearDateProdIssueBugFix.md (DPFIX-10).
//
//   store-local time >= 5:00 AM  → anchor = today - 1  (yesterday is finalised)
//   store-local time <  5:00 AM  → anchor = today - 2  (yesterday not finalised yet)

/** Store-local hour before which the previous day is not yet considered finalised. */
export const ANCHOR_CUTOFF_HOUR = 5;

/** Clock hour (0–23) of `date` as it stands in `timeZoneCd`. Browser-local fallback. */
export function hourInZone(date: Date, timeZoneCd?: string): number {
  if (Number.isNaN(date.getTime())) return NaN;
  const tz = timeZoneCd?.trim();
  if (!tz) return date.getHours();
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      hourCycle: 'h23', // 00–23, so midnight is 0 (not 24)
    }).formatToParts(date);
    const raw = parts.find((p) => p.type === 'hour')?.value ?? '';
    const h = parseInt(raw, 10);
    return Number.isNaN(h) ? date.getHours() : h % 24; // %24 guards engines that emit "24"
  } catch {
    return date.getHours();
  }
}

/** Last fully-finalised historical day (YYYY-MM-DD) in `timeZoneCd`, applying the
 *  ANCHOR_CUTOFF_HOUR rule. Defaults to the active store timezone. */
export function getAnchorDate(timeZoneCd: string = getStoreTimeZone()): string {
  const now = new Date();
  const today = dateStrInZone(now, timeZoneCd);
  const rollbackDays = hourInZone(now, timeZoneCd) >= ANCHOR_CUTOFF_HOUR ? -1 : -2;
  return shiftDateStr(today, rollbackDays);
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

/** "Yesterday" preset — the single anchor day. */
export function getYesterdayRange(timeZoneCd: string = getStoreTimeZone()): DateRange {
  const anchor = getAnchorDate(timeZoneCd);
  return { startDate: anchor, endDate: anchor };
}

/** "7D" preset — 7 inclusive days ending at the anchor: [anchor - 6, anchor]. */
export function get7DayRange(timeZoneCd: string = getStoreTimeZone()): DateRange {
  const anchor = getAnchorDate(timeZoneCd);
  return { startDate: shiftDateStr(anchor, -6), endDate: anchor };
}

/** "30D" preset — 30 inclusive days ending at the anchor: [anchor - 29, anchor]. */
export function get30DayRange(timeZoneCd: string = getStoreTimeZone()): DateRange {
  const anchor = getAnchorDate(timeZoneCd);
  return { startDate: shiftDateStr(anchor, -29), endDate: anchor };
}

/** "90D" preset — 90 inclusive days ending at the anchor: [anchor - 89, anchor].
 *  Guest Reviews only (`#UD 12`); anchored exactly like `get30DayRange`. */
export function get90DayRange(timeZoneCd: string = getStoreTimeZone()): DateRange {
  const anchor = getAnchorDate(timeZoneCd);
  return { startDate: shiftDateStr(anchor, -89), endDate: anchor };
}

/** "This Month" preset — month-to-date **including today**: [1st of the current
 *  store-local month, today].
 *
 *  Deliberately NOT anchored on `getAnchorDate`. Unlike the relative presets
 *  (Yesterday / 7D / 30D), "This Month" names the calendar month the store is
 *  currently in, so it must always run through the current date — even before the
 *  5 AM cutoff, and even on the 1st (where it collapses to [today, today]).
 *  See ThisMonthDateProdIssue/ThisMonthDateProdIssueBugFix.md.
 *
 *  "Today" here is `currentStoreDate()` — the server's day when a reading has
 *  arrived — so the range ends on the same day `resolveTokenRange('Today')` and
 *  `PeriodContext.todayISO` use. Reading the device clock instead would let the
 *  two disagree across a day boundary, and `classifyShape`'s month-to-date test
 *  (`endDate === todayISO`) would then fall through to `unregistered` and drop
 *  the comparison. */
export function getThisMonthRange(timeZoneCd: string = getStoreTimeZone()): DateRange {
  const today = currentStoreDate(timeZoneCd);
  return { startDate: `${today.slice(0, 7)}-01`, endDate: today };
}

/** "This Year" preset — year-to-date **including today**: [Jan 1 of the current
 *  store-local year, today].
 *
 *  Deliberately NOT anchored on `getAnchorDate`, mirroring `getThisMonthRange`
 *  (DPFIX-10). "This Year" names the calendar year the store is currently trading
 *  in, so it must always run through the current date — even before the 5 AM
 *  cutoff, and even on Jan 1 (where it collapses to [today, today]).
 *  See ThisYearDateProdIssue/ThisYearDateProdIssueBugFix.md.
 *
 *  "Today" here is `currentStoreDate()` for the same reason `getThisMonthRange`
 *  reads it: it must match `PeriodContext.todayISO` / `resolveTokenRange('Today')`
 *  so `classifyShape`'s running-edge test (`endDate === todayISO`) keeps matching
 *  and the comparison isn't silently dropped. */
export function getThisYearRange(timeZoneCd: string = getStoreTimeZone()): DateRange {
  const today = currentStoreDate(timeZoneCd);
  return { startDate: `${today.slice(0, 4)}-01-01`, endDate: today };
}
