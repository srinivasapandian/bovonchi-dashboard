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

async function requestJson(
  url: string,
  body: unknown,
  method: 'POST' | 'PATCH' | 'DELETE',
  token?: string | null,
): Promise<Record<string, unknown>> {
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
  const res = await fetch(url, { method, headers, body: JSON.stringify(requestPayload) });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // ignore parse failures
  }
  if (!res.ok) {
    throw new Error(messageFromRevampErrorBody(data, 'Menu API request failed'));
  }
  return data;
}

async function requestGet(url: string, token?: string | null): Promise<Record<string, unknown>> {
  const authToken = getRevampToken(token);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(url, { headers });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // ignore parse failures
  }
  if (!res.ok) {
    throw new Error(messageFromRevampErrorBody(data, 'Menu API request failed'));
  }
  return data;
}

export type ApiCategoryGroupListResponse = {
  locationId?: string;
  categoryGroups?: Array<{
    id?: string;
    locationId?: string;
    name?: string;
    description?: string | null;
    icon?: string | null;
    status?: string;
    activeOn?: string | null;
    categories?: Array<{ id?: string; categoryId?: string; enabled?: boolean }>;
    sections?: Array<{ id?: string; sectionId?: string; enabled?: boolean }>;
    devices?: Array<{ id?: string; deviceId?: string; enabled?: boolean }>;
    orderTypes?: Array<{
      id?: string;
      orderTypeId?: string;
      enabled?: boolean;
      orderTypeName?: string;
      typeGroup?: string;
    }>;
    items?: Array<{ id?: string; itemId?: string; enabled?: boolean }>;
  }>;
};

export type ActiveDevicesBySectionResponse = {
  sections?: Array<{
    id?: string;
    name?: string;
    devices?: Array<{ id?: string; name?: string; deviceType?: string }>;
  }>;
  unsectionedDevices?: Array<{ id?: string; name?: string; deviceType?: string }>;
};

export async function listCategoryGroupsApi(
  locationId: string,
  token?: string | null,
): Promise<ApiCategoryGroupListResponse> {
  try {
    const data = await requestGet(
      `${REVAMP_BASE}/api/v1/category/group/list?locationId=${encodeURIComponent(locationId)}`,
      token,
    );
    return data as unknown as ApiCategoryGroupListResponse;
  } catch (e) {
    // Graceful fallback — endpoint may not be deployed yet
    console.warn('[menuCatalogApi] listCategoryGroupsApi failed:', e);
    return { categoryGroups: [] };
  }
}

export type CreateCategoryGroupPayload = {
  locationId: string;
  name: string;
  description?: string;
  icon?: string;
  status?: string;
  categories?: Array<{ categoryId: string; enabled: boolean }>;
  sections?: Array<{ sectionId: string; enabled: boolean }>;
  devices?: Array<{ deviceId: string; enabled: boolean }>;
  orderTypes?: Array<{ orderTypeId: string; enabled: boolean }>;
  items?: Array<{ itemId: string; enabled: boolean }>;
  activeOn?: string | null;
};

export async function createCategoryGroupApi(
  payload: CreateCategoryGroupPayload,
  token?: string | null,
): Promise<Record<string, unknown>> {
  return requestJson(`${REVAMP_BASE}/api/v1/category/group/create`, payload, 'POST', token);
}

export type UpdateCategoryGroupPayload = {
  categoryGroupId: string;
  locationId: string;
  name?: string;
  description?: string;
  icon?: string;
  status?: string;
  activeOn?: string | null;
  categories?: Array<{ categoryId: string; enabled: boolean }>;
  sections?: Array<{ sectionId: string; enabled: boolean }>;
  devices?: Array<{ deviceId: string; enabled: boolean }>;
  orderTypes?: Array<{ orderTypeId: string; enabled: boolean }>;
  items?: Array<{ itemId: string; enabled: boolean }>;
};

export async function updateCategoryGroupApi(
  payload: UpdateCategoryGroupPayload,
  token?: string | null,
): Promise<Record<string, unknown>> {
  return requestJson(`${REVAMP_BASE}/api/v1/category/group/update`, payload, 'PATCH', token);
}

export async function deleteCategoryGroupApi(
  payload: { categoryGroupId: string; locationId: string },
  token?: string | null,
): Promise<Record<string, unknown>> {
  return requestJson(`${REVAMP_BASE}/api/v1/category/group/delete`, payload, 'DELETE', token);
}

export async function getActiveDevicesBySectionApi(
  locationId: string,
  token?: string | null,
): Promise<ActiveDevicesBySectionResponse> {
  const data = await requestGet(
    `${REVAMP_BASE}/api/v1/devices/active-by-section?locationId=${encodeURIComponent(locationId)}`,
    token,
  );
  return data as unknown as ActiveDevicesBySectionResponse;
}
