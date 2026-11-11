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
    throw new Error(messageFromRevampErrorBody(data, 'Option Set API request failed'));
  }
  return data;
}

export type ApiOptionSetOption = {
  id?: string;
  optionId?: string;
  name?: string;
  price?: number;
  sortOrder?: number;
};

export type ApiOptionSet = {
  id?: string;
  templateId?: string;
  name?: string;
  displayName?: string;
  locationId?: string;
  itemCount?: number;
  linkedItemCount?: number;
  assignedItemCount?: number;
  options?: ApiOptionSetOption[];
};

export async function getOptionSetsApi(
  locationId: string,
  token?: string | null,
): Promise<ApiOptionSet[]> {
  const authToken = getRevampToken(token);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(
    `${REVAMP_BASE}/api/v1/modifier/option-set/list?locationId=${encodeURIComponent(locationId)}`,
    { headers },
  );
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // ignore parse failures
  }
  if (!res.ok) {
    console.warn('[optionSetCatalogApi] getOptionSetsApi failed:', res.status, data);
    return [];
  }
  if (Array.isArray(data)) return data as unknown as ApiOptionSet[];
  const root = data as Record<string, unknown>;
  const directCandidates = [
    root.data,
    root.content,
    root.optionSets,
    root.entries,
    root.templates,
    root.rows,
    root.list,
  ];
  for (const c of directCandidates) {
    if (Array.isArray(c)) return c as ApiOptionSet[];
  }
  const nestedObjects = [root.data, root.result, root.payload, root.response].filter(
    (x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object' && !Array.isArray(x),
  );
  for (const obj of nestedObjects) {
    const nestedCandidates = [
      obj.optionSets,
      obj.entries,
      obj.content,
      obj.data,
      obj.templates,
      obj.rows,
      obj.list,
    ];
    for (const c of nestedCandidates) {
      if (Array.isArray(c)) return c as ApiOptionSet[];
    }
  }
  return [];
}

export type CreateOptionSetPayload = {
  locationId: string;
  name: string;
  displayName?: string;
  options: Array<{
    optionId?: string;
    name: string;
    price?: number;
    sortOrder?: number;
  }>;
};

export async function createOptionSetApi(
  payload: CreateOptionSetPayload,
  token?: string | null,
): Promise<unknown> {
  return requestJson(`${REVAMP_BASE}/api/v1/modifier/option-set/create`, payload, 'POST', token);
}

export type UpdateOptionSetPayload = CreateOptionSetPayload & {
  templateId: string;
  deleteFields?: {
    options?: string[];
  };
};

export async function updateOptionSetApi(
  payload: UpdateOptionSetPayload,
  token?: string | null,
): Promise<unknown> {
  return requestJson(`${REVAMP_BASE}/api/v1/modifier/option-set/update`, payload, 'PATCH', token);
}

export async function deleteOptionSetApi(
  payload: { templateId: string; locationId: string },
  token?: string | null,
): Promise<unknown> {
  return requestJson(`${REVAMP_BASE}/api/v1/modifier/option-set/delete`, payload, 'DELETE', token);
}
