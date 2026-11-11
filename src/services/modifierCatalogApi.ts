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

// --- API response types ---

export type ApiModifierOption = {
  /** Revamp GET response uses optionId; some payloads use modifierOption_id */
  optionId?: string;
  modifierOption_id?: string;
  name?: string;
  kitchenName?: string;
  price?: number;
  isDefault?: number | boolean;
  isVisible?: number | boolean;
  /** Backend get-modifiers uses isEnabled for the option toggle */
  isEnabled?: number | boolean;
  enable?: number | boolean;
  sortOrder?: number;
  imageId?: string;
  imageUrl?: string;
};

export type ApiBehaviorOptions = {
  maximumSelection?: number;
  minimumSelection?: number;
  isRequired?: boolean;
};

export type ApiChannelVisibility = {
  orderTypeId?: string;
  orderType?: string;
  enabled?: boolean;
};

export type ApiModifier = {
  /** Revamp GET response uses modifier_id (same as mh_modifiers.id) */
  modifier_id?: string;
  modifierId?: string;
  id?: string;
  name?: string;
  displayName?: string;
  locationId?: string;
  modifierOption?: ApiModifierOption[];
  behaviorOptions?: ApiBehaviorOptions;
  channelVisibility?: ApiChannelVisibility[];
  assignedItems?: Array<{ itemID: string; itemName: string }> | string[];
  assignedItemCount?: number;
};

// --- Request helpers ---

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
    console.warn('[catalogApi] request failed:', 'Modifier API request failed', data); throw new Error(messageFromRevampErrorBody(data, 'Modifier API request failed'));
  }
  return data;
}

// --- GET modifiers ---

export async function getModifiersApi(
  locationId: string,
  token?: string | null,
): Promise<ApiModifier[]> {
  const authToken = getRevampToken(token);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(
    `${REVAMP_BASE}/api/v1/modifier/get-modifiers?locationId=${encodeURIComponent(locationId)}`,
    { headers },
  );
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // ignore parse failures
  }
  if (!res.ok) {
    console.warn('[catalogApi] request failed:', 'Failed to fetch modifiers', data); throw new Error(messageFromRevampErrorBody(data, 'Failed to fetch modifiers'));
  }
  if (Array.isArray(data)) return data as unknown as ApiModifier[];
  if (Array.isArray(data.data)) return data.data as ApiModifier[];
  if (Array.isArray(data.content)) return data.content as ApiModifier[];
  if (Array.isArray(data.modifiers)) return data.modifiers as ApiModifier[];
  if (Array.isArray(data.entries)) return data.entries as ApiModifier[];
  return [];
}

// --- CREATE modifier ---

export type CreateModifierPayload = {
  name: string;
  displayName: string;
  locationId: string;
  modifierOption: Array<{
    modifierOption_id: string;
    name: string;
    kitchenName: string;
    price: number;
    isDefault: number;
    isVisible: number;
    enable: number;
    sortOrder: number;
  }>;
  behaviorOptions: {
    maximumSelection: number;
    minimumSelection: number;
    isRequired: boolean;
  };
  channelVisibility?: Array<{
    orderTypeId: string;
    enabled: boolean;
  }>;
  assignedItems?: string[];
};

export async function createModifierApi(
  payload: CreateModifierPayload,
  token?: string | null,
): Promise<unknown> {
  return requestJson(`${REVAMP_BASE}/api/v1/modifier/create`, payload, 'POST', token);
}

// --- UPDATE modifier ---

export type UpdateModifierPayload = CreateModifierPayload & {
  modifierId: string;
  deleteFields?: {
    modifierOption?: string[];
    assignedItems?: string[];
  };
};

export async function updateModifierApi(
  payload: UpdateModifierPayload,
  token?: string | null,
): Promise<unknown> {
  return requestJson(`${REVAMP_BASE}/api/v1/modifier/update`, payload, 'PATCH', token);
}

// --- DELETE modifier ---

export async function deleteModifierApi(
  payload: { modifierId: string; locationId: string },
  token?: string | null,
): Promise<unknown> {
  return requestJson(`${REVAMP_BASE}/api/v1/modifier/delete`, payload, 'DELETE', token);
}

