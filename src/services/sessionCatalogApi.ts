import { axiosFetch as authFetch } from './axiosFetch';
import { CREDENTIALS } from '../constants';
import { createRequest, getUserId } from '../utils/hmac-utils';
import { messageFromRevampErrorBody } from '../utils/revampApiErrorMessage';

const REVAMP_BASE = (process.env.REACT_APP_API_ENDPOINT_REVAMP || '').replace(/\/$/, '');

function getRevampToken(passedToken?: string | null): string | null {
  if (passedToken && typeof passedToken === 'string' && passedToken.trim()) return passedToken.trim();
  try {
    const raw = localStorage.getItem(CREDENTIALS);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    const cred = stored?.credentials ?? stored;
    const token =
      cred?.accessToken ??
      cred?.access_token ??
      cred?.token ??
      cred?.idToken ??
      cred?.id_token ??
      cred?.jwtToken ??
      cred?.jwt;
    return token && typeof token === 'string' && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

type SessionSlotPayload = {
  id?: string;
  days: string[];
  startTime: string;
  endTime: string;
};

export type ApiSessionSlot = {
  id?: string;
  weekday?: string | number;
  day?: string;
  start_time?: string;
  end_time?: string;
  startTime?: string;
  endTime?: string;
};

export type ApiSessionItem = { id?: string; itemId?: string; itemID?: string; item_id?: string; name?: string };

export type ApiSession = {
  id?: string;
  sessionId?: string;
  /** Some list endpoints use snake_case for the same fields. */
  session_id?: string;
  sessionGroupId?: string;
  session_group_id?: string;
  name?: string;
  color?: string;
  description?: string;
  isDefault?: boolean;
  is_default?: boolean;
  assignedItemCount?: number;
  assignedItems?: Array<{ itemId?: string; itemID?: string; item_id?: string } | string>;
  items?: ApiSessionItem[];
  /** Some responses list assigned items here instead of `items`. */
  assignedSessionItems?: ApiSessionItem[];
  itemCount?: number;
  deviceCount?: number;
  sessionSlot?: ApiSessionSlot[];
};

function dayNameToWeekday(day: string): string | null {
  const map: Record<string, string> = {
    Monday: '1',
    Tuesday: '2',
    Wednesday: '3',
    Thursday: '4',
    Friday: '5',
    Saturday: '6',
    Sunday: '7',
  };
  return map[day] ?? null;
}

function toHHMMSS(value: string): string {
  if (!value) return '';
  return value.length === 5 ? `${value}:00` : value;
}

function normalizeSlotTimeForKey(value: string): string {
  const clean = (value ?? '').trim();
  if (!clean) return '';
  if (/^\d{2}:\d{2}:\d{2}$/.test(clean)) return clean.slice(0, 5);
  if (/^\d{2}:\d{2}$/.test(clean)) return clean;
  return clean;
}

export function sessionSlotLookupKey(dayName: string, startTime: string, endTime: string): string {
  return `${dayName}|${normalizeSlotTimeForKey(startTime)}|${normalizeSlotTimeForKey(endTime)}`;
}

/** Only persist server-issued slot ids (UUID). Omit client keys (`slot-â€¦`) and UI fallbacks so create/new rows do not send `id`. */
export function isPersistedSessionSlotId(id: string | undefined): id is string {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
}

const ALL_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function transformSlots(
  slots: SessionSlotPayload[],
  slotIdLookup?: Record<string, string>,
): Array<{ id?: string; weekday: string; start_time: string; end_time: string }> {
  const out: Array<{ id?: string; weekday: string; start_time: string; end_time: string }> = [];
  for (const slot of slots) {
    const isAllDays = slot.days.length === 7 && ALL_DAY_NAMES.every((d) => slot.days.includes(d));
    if (isAllDays) {
      // All-days slot â†’ single row with weekday "0", no FE-generated id
      const rowId = isPersistedSessionSlotId(slot.id) ? slot.id : undefined;
      out.push({
        ...(rowId ? { id: rowId } : {}),
        weekday: '0',
        start_time: toHHMMSS(slot.startTime),
        end_time: toHHMMSS(slot.endTime),
      });
    } else {
      const singleDayId = slot.days.length === 1 && isPersistedSessionSlotId(slot.id) ? slot.id : undefined;
      for (const day of slot.days) {
        const weekday = dayNameToWeekday(day);
        if (!weekday) continue;
        const key = sessionSlotLookupKey(day, slot.startTime, slot.endTime);
        const fromLookup = slotIdLookup?.[key];
        const lookupId = isPersistedSessionSlotId(fromLookup) ? fromLookup : undefined;
        const rowId = singleDayId ?? lookupId;
        out.push({
          ...(rowId ? { id: rowId } : {}),
          weekday,
          start_time: toHHMMSS(slot.startTime),
          end_time: toHHMMSS(slot.endTime),
        });
      }
    }
  }
  return out;
}

async function requestJson(
  url: string,
  body: unknown,
  method: 'POST' | 'PATCH' | 'DELETE',
  token?: string | null,
): Promise<unknown> {
  const authToken = getRevampToken(token);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-source': 'MP',
  };
  const userId = getUserId();
  const bodyWithUser = userId ? { ...(body as object), userId } : body;
  const requestPayload = await createRequest(bodyWithUser);
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(requestPayload),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // ignore parse failures
  }
  if (!res.ok) {
    console.warn('[catalogApi] request failed:', 'Session API request failed', data); throw new Error(messageFromRevampErrorBody(data, 'Session API request failed'));
  }
  return data;
}

export type SessionItemPayload = { id: string; sessionPrice: number | null };

export async function createSessionApi(
  payload: {
    locationId: string;
    name: string;
    sessionSlot: SessionSlotPayload[];
    description?: string | null;
    items?: SessionItemPayload[];
    slotIdLookup?: Record<string, string>;
  },
  token?: string | null,
): Promise<unknown> {
  const body: Record<string, unknown> = {
    locationId: payload.locationId,
    name: payload.name,
    sessionSlot: transformSlots(payload.sessionSlot, payload.slotIdLookup),
  };
  const desc = payload.description?.trim();
  if (desc) body.description = desc;
  if (payload.items && payload.items.length > 0) body.items = payload.items;
  return requestJson(`${REVAMP_BASE}/api/v1/sessions/create`, body, 'POST', token);
}

export async function getSessionsApi(
  locationId: string,
  token?: string | null,
): Promise<ApiSession[]> {
  const authToken = getRevampToken(token);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(
    `${REVAMP_BASE}/api/v1/sessions?location_id=${encodeURIComponent(locationId)}`,
    { headers },
  );
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // ignore parse failures
  }
  if (!res.ok) {
    console.warn('[catalogApi] request failed:', 'Failed to fetch sessions', data); throw new Error(messageFromRevampErrorBody(data, 'Failed to fetch sessions'));
  }
  if (Array.isArray(data)) return data as unknown as ApiSession[];
  if (Array.isArray(data.data)) return data.data as ApiSession[];
  if (Array.isArray(data.content)) return data.content as ApiSession[];
  if (Array.isArray(data.sessions)) return data.sessions as ApiSession[];
  if (Array.isArray(data.entries)) return data.entries as ApiSession[];
  return [];
}

export async function updateSessionApi(
  payload: {
    locationId: string;
    sessionId: string;
    name: string;
    sessionSlot: SessionSlotPayload[];
    description?: string | null;
    items?: SessionItemPayload[];
    deleteFields?: { items?: string[] };
    /** Server slot UUIDs removed in the editor (not present in `sessionSlot`). */
    deletedSlots?: string[];
    /** Initial load map: `sessionSlotLookupKey(day, start, end)` â†’ id (multi-day rows reuse per weekday). */
    slotIdLookup?: Record<string, string>;
  },
  token?: string | null,
): Promise<unknown> {
  const body: Record<string, unknown> = {
    locationId: payload.locationId,
    sessionId: payload.sessionId,
    name: payload.name,
    sessionSlot: transformSlots(payload.sessionSlot, payload.slotIdLookup),
  };
  if (payload.description !== undefined) {
    const t = payload.description?.trim();
    body.description = t ? t : null;
  }
  if (payload.items && payload.items.length > 0) body.items = payload.items;
  if (payload.deleteFields?.items && payload.deleteFields.items.length > 0) {
    body.deleteFields = { items: payload.deleteFields.items };
  }
  if (payload.deletedSlots && payload.deletedSlots.length > 0) {
    body.deletedSlots = payload.deletedSlots;
  }
  return requestJson(`${REVAMP_BASE}/api/v1/sessions/update`, body, 'PATCH', token);
}

export async function deleteSessionApi(
  payload: { locationId: string; sessionId: string },
  token?: string | null,
): Promise<unknown> {
  const body = {
    locationId: payload.locationId,
    sessionId: payload.sessionId,
  };
  return requestJson(`${REVAMP_BASE}/api/v1/sessions/delete`, body, 'DELETE', token);
}
