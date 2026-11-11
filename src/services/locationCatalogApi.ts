/**
 * Location HTTP client for the revamp API.
 *
 * Backend sources (global prefix `/api/v1` — see maghil-backend-v3/src/main.ts):
 * - Locations: maghil-backend-v3/src/interface/location/controllers/location.controller.ts
 *
 * Exposes the per-location custom age list endpoints (per-item age-restriction picker) and the
 * outlet-wide KOT order-type toggle. Reuses the same auth + HMAC plumbing as `itemCatalogApi.ts`
 * so behavior is identical.
 */
import { CREDENTIALS } from '../constants';
import { createRequest, getUserId } from '../utils/hmac-utils';
import { messageFromRevampErrorBody } from '../utils/revampApiErrorMessage';

const REVAMP_BASE = (process.env.REACT_APP_API_ENDPOINT_REVAMP || '').replace(/\/$/, '');

/** `/api/v1/locations` — LocationController */
export const LOCATIONS_API_BASE = `${REVAMP_BASE}/api/v1/locations`;

function getRevampToken(passedToken?: string | null): string | null {
  if (passedToken && typeof passedToken === 'string' && passedToken.trim()) {
    return passedToken.trim();
  }
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

async function requestJson(
  url: string,
  body: unknown,
  method: 'POST' | 'PATCH',
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
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(messageFromRevampErrorBody(data, `Location API ${method} failed`));
  }
  return data;
}

async function postJson(url: string, body: unknown, token?: string | null): Promise<unknown> {
  return requestJson(url, body, 'POST', token);
}

function getJson(url: string, token?: string | null): Promise<unknown> {
  const authToken = getRevampToken(token);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return fetch(url, { headers }).then(async (res) => {
    let data: Record<string, unknown> = {};
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      throw new Error(messageFromRevampErrorBody(data, 'Location API GET failed'));
    }
    return data;
  });
}

/**
 * Coerce the server's `ages` array into a clean `number[]`. The backend already
 * sends canonical (sorted, deduped, in-range) values; this is just defensive
 * trimming for any unexpected shape from older deployments.
 */
function coerceAges(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  for (const v of raw) {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) continue;
    const i = Math.floor(n);
    if (i < 1 || i > 99) continue;
    seen.add(i);
  }
  return Array.from(seen).sort((a, b) => a - b);
}

/**
 * GET /api/v1/locations/ages/:locationId
 * Returns the location's custom age list. Empty array if no row exists yet.
 */
export async function fetchLocationAges(
  locationId: string,
  token?: string | null,
): Promise<number[]> {
  const url = `${LOCATIONS_API_BASE}/ages/${encodeURIComponent(locationId)}`;
  const resp = (await getJson(url, token)) as { ages?: unknown };
  return coerceAges(resp?.ages);
}

/**
 * POST /api/v1/locations/update-ages
 * Full-array PUT semantics — supplied list replaces whatever is stored. Server
 * dedupes + sorts ascending. Returns the canonical persisted list.
 */
export async function updateLocationAges(
  locationId: string,
  ages: number[],
  token?: string | null,
): Promise<number[]> {
  const url = `${LOCATIONS_API_BASE}/update-ages`;
  const resp = (await postJson(url, { locationId, ages }, token)) as { ages?: unknown };
  return coerceAges(resp?.ages);
}

/**
 * GET /api/v1/locations/:locationId/order-type-kot
 * Order type ids where KOT printing is currently off for the whole location (outlet-wide
 * default). An order type not in the list is on (prints normally).
 */
export async function getOrderTypeKotApi(
  locationId: string,
  token?: string | null,
): Promise<string[]> {
  const url = `${LOCATIONS_API_BASE}/${encodeURIComponent(locationId)}/order-type-kot`;
  const resp = (await getJson(url, token)) as { excludedOrderTypeIds?: unknown };
  return Array.isArray(resp?.excludedOrderTypeIds) ? resp.excludedOrderTypeIds.map((id) => String(id)) : [];
}

/**
 * PATCH /api/v1/locations/order-type-kot
 * Master on/off switch for KOT printing per order type, for the whole location (every item).
 * Order types not listed keep their current state — only send the ones that changed.
 */
export async function updateOrderTypeKotApi(
  body: { locationId: string; orderTypes: Array<{ orderTypeId: string; enable: 0 | 1 }> },
  token?: string | null,
): Promise<{ updatedCount: number }> {
  const url = `${LOCATIONS_API_BASE}/order-type-kot`;
  const resp = (await requestJson(url, body, 'PATCH', token)) as { updatedCount?: unknown };
  return { updatedCount: Number(resp?.updatedCount ?? 0) };
}
