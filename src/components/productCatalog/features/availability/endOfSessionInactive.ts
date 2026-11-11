export type WorkingHoursRow = {
  weekday?: string;
  openingTime?: string;
  closingTime?: string;
};

/** Wall-clock parts in outlet TZ (or browser local when unset). */
function getTimeInTimeZone(timeZone: string | undefined): { hour: number; minute: number; second: number } {
  const tz = timeZone?.trim();
  if (!tz) {
    const d = new Date();
    return { hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds() };
  }
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { hour: get('hour'), minute: get('minute'), second: get('second') };
}

function getWeekdayLongInTimeZone(timeZone: string | undefined): string {
  const tz = timeZone?.trim();
  const d = new Date();
  if (!tz) {
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return names[d.getDay()];
  }
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(d);
}

/** YYYY-MM-DD in outlet TZ (en-CA yields ISO-like date). */
function getDateYmdInTimeZone(timeZone: string | undefined): string {
  const d = new Date();
  const tz = timeZone?.trim();
  if (!tz) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function normalizeToHms(time: string): string {
  const raw = String(time ?? '').trim();
  if (!raw) return '00:00:00';
  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h = Number(ampmMatch[1]);
    const m = Number(ampmMatch[2]);
    const sec = ampmMatch[3] != null ? Number(ampmMatch[3]) : 0;
    const suffix = ampmMatch[4].toUpperCase();
    if (suffix === 'PM' && h !== 12) h += 12;
    if (suffix === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  const parts = raw.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  const s = parts[2] != null ? Number(String(parts[2]).replace(/\D/g, '')) || 0 : 0;
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '00:00:00';
  return `${String(((h % 24) + 24) % 24).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function timeToSeconds(time: string): number {
  const [h, m, s] = normalizeToHms(time).split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

/** Same rules as ModifierLevel `isCurrentTimeInSession` (overnight + full-day edge). */
export function isCurrentTimeInSession(openingTime: string, closingTime: string, timeZone: string | undefined): boolean {
  const { hour, minute, second } = getTimeInTimeZone(timeZone);
  const currentSeconds = hour * 3600 + minute * 60 + second;
  const openingSeconds = timeToSeconds(openingTime);
  const closingSeconds = timeToSeconds(closingTime);
  if (openingSeconds === 0 && closingSeconds === 0) return false;
  if (openingSeconds > closingSeconds) {
    return currentSeconds >= openingSeconds || currentSeconds <= closingSeconds;
  }
  return currentSeconds >= openingSeconds && currentSeconds <= closingSeconds;
}

/** Portal-style: no Z, seconds padded — CategoryLevel `formatInactiveUntil`. */
export function formatInactiveUntilLocal(dateTimeStr: string): string {
  if (dateTimeStr == null || String(dateTimeStr).trim() === '') return '';
  const s = String(dateTimeStr).trim();
  const match = s.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const [, datePart, h, m, sec] = match;
    return `${datePart}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:${(sec ?? '00').padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${day}T${h}:${min}:${sec}`;
  }
  return s;
}

/** Local wall time `YYYY-MM-DDTHH:mm:ss` (API: location timezone, no `Z`). */
export function formatInactiveUntilFromDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${mo}-${day}T${h}:${min}:${sec}`;
}

function formatDateFromNowPlusMs(ms: number): string {
  return formatInactiveUntilFromDate(new Date(Date.now() + ms));
}

/** Returns the closing time of the active working-hour slot, or the nearest future one for today. */
export function computeEndOfSessionInactiveUntil(params: {
  timeZoneCd?: string | null;
  workingHours?: WorkingHoursRow[] | null;
}): { inactiveMode: 'end_of_sessions'; inactiveUntil: string } {
  const timeZone = params.timeZoneCd ?? undefined;
  const todayLong = getWeekdayLongInTimeZone(timeZone);
  const dateYmd = getDateYmdInTimeZone(timeZone);

  const wh = Array.isArray(params.workingHours) ? params.workingHours : [];
  const todayRows = wh.filter(
    (item) => item?.weekday === todayLong || item?.weekday === 'All',
  );

  const { hour, minute, second } = getTimeInTimeZone(timeZone);
  const currentSeconds = hour * 3600 + minute * 60 + second;

  // The session we're currently in — return its closing time.
  const activeWh = todayRows.find((item) =>
    isCurrentTimeInSession(String(item?.openingTime ?? ''), String(item?.closingTime ?? ''), timeZone),
  );
  if (activeWh?.closingTime != null && String(activeWh.closingTime).trim() !== '') {
    const closeHms = normalizeToHms(String(activeWh.closingTime));
    const openSec = timeToSeconds(String(activeWh.openingTime ?? ''));
    const closeSec = timeToSeconds(closeHms);
    // Session spans midnight and we're still in the pre-midnight part ⇒ close lands tomorrow.
    const inPreMidnight = openSec > closeSec && currentSeconds >= openSec;
    const closeDate = inPreMidnight ? addOneDayToYmd(dateYmd) : dateYmd;
    return {
      inactiveMode: 'end_of_sessions',
      inactiveUntil: formatInactiveUntilLocal(`${closeDate}T${closeHms}`),
    };
  }

  // Between sessions — use the next upcoming session's closing time.
  const upcoming = todayRows
    .map((item) => {
      const openSec = timeToSeconds(String(item?.openingTime ?? ''));
      const closeHms = normalizeToHms(String(item?.closingTime ?? ''));
      return { openSec, closeHms, crossesMidnight: openSec > timeToSeconds(closeHms) };
    })
    .filter(({ openSec }) => openSec > currentSeconds)
    .sort((a, b) => a.openSec - b.openSec)[0];

  if (upcoming != null) {
    const closeDate = upcoming.crossesMidnight ? addOneDayToYmd(dateYmd) : dateYmd;
    return {
      inactiveMode: 'end_of_sessions',
      inactiveUntil: formatInactiveUntilLocal(`${closeDate}T${upcoming.closeHms}`),
    };
  }

  return { inactiveMode: 'end_of_sessions', inactiveUntil: formatDateFromNowPlusMs(30 * 60 * 1000) };
}

/** Adds one calendar day to a `YYYY-MM-DD` string (UTC math, no TZ drift). */
function addOneDayToYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const ny = next.getUTCFullYear();
  const nm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(next.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

/**
 * End of Day: the closing time of today's *last* operating session, resolved in the
 * outlet timezone (`timeZoneCd`) — never the browser timezone.
 *
 * The last session is the one with the latest opening (start) time. When that session
 * crosses midnight (`openingTime > closingTime`), the close lands on the next location
 * date. Falls back to 23:59:59 (current location date) when no working hours exist.
 */
export function computeEndOfDayInactiveUntil(params: {
  timeZoneCd?: string | null;
  workingHours?: WorkingHoursRow[] | null;
}): { inactiveMode: 'until_end_of_day'; inactiveUntil: string } {
  const timeZone = params.timeZoneCd ?? undefined;
  const todayLong = getWeekdayLongInTimeZone(timeZone);
  const dateYmd = getDateYmdInTimeZone(timeZone);

  const wh = Array.isArray(params.workingHours) ? params.workingHours : [];
  const todayRows = wh
    .filter((item) => item?.weekday === todayLong || item?.weekday === 'All')
    .filter((item) => String(item?.closingTime ?? '').trim() !== '');

  if (todayRows.length === 0) {
    return {
      inactiveMode: 'until_end_of_day',
      inactiveUntil: formatInactiveUntilLocal(`${dateYmd}T23:59:59`),
    };
  }

  // Last operating session = latest opening time; tie-break on the later closing time.
  const lastSession = todayRows
    .map((item) => ({
      openSec: timeToSeconds(String(item?.openingTime ?? '')),
      closeHms: normalizeToHms(String(item?.closingTime)),
    }))
    .sort((a, b) => (a.openSec - b.openSec) || (timeToSeconds(a.closeHms) - timeToSeconds(b.closeHms)))
    .pop()!;

  // openingTime > closingTime ⇒ session spans midnight ⇒ close on the next location date.
  const crossesMidnight = lastSession.openSec > timeToSeconds(lastSession.closeHms);
  const closeDate = crossesMidnight ? addOneDayToYmd(dateYmd) : dateYmd;

  return {
    inactiveMode: 'until_end_of_day',
    inactiveUntil: formatInactiveUntilLocal(`${closeDate}T${lastSession.closeHms}`),
  };
}
