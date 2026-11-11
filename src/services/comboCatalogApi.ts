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
  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(requestPayload),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // ignore
  }
  if (!res.ok) {
    console.warn('[catalogApi] request failed:', 'Combo API request failed', data); throw new Error(messageFromRevampErrorBody(data, 'Combo API request failed'));
  }
  return data;
}

export type ApiComboEligibleItem = {
  id?: string;
  itemId?: string;
  item_id?: string;
  supplementPrice?: number | string;
  supplement_price?: number | string;
};

export type ApiComboSlot = {
  id?: string;
  slotId?: string;
  slotName?: string;
  slot_name?: string;
  slotType?: string;
  slot_type?: string;
  minSelections?: number;
  min_selections?: number;
  maxSelections?: number;
  max_selections?: number;
  defaultItemId?: string;
  default_item_id?: string;
  defaultVariationId?: string;
  default_variation_id?: string;
  sortOrder?: number;
  sort_order?: number;
  eligibleItems?: ApiComboEligibleItem[];
};

export type ApiComboModifier = {
  id?: string;
  modifierId?: string;
  modifier_id?: string;
  sortOrder?: number;
  sort_order?: number;
};

export type ApiComboOrderTypeAvailability = {
  orderTypeId?: string;
  order_type_id?: string;
  isEnable?: boolean;
  is_enable?: boolean | number;
};

export type ApiCombo = {
  id?: string;
  itemId?: string;
  item_id?: string;
  name?: string;
  displayName?: string;
  display_name?: string;
  description?: string;
  comboCode?: string;
  combo_code?: string;
  pricingModel?: string;
  pricing_model?: string;
  basePrice?: number | string;
  base_price?: number | string;
  status?: string;
  slots?: ApiComboSlot[];
  modifiers?: ApiComboModifier[];
  orderTypeAvailability?: ApiComboOrderTypeAvailability[];
};

export async function getCombosApi(
  locationId: string,
  token?: string | null,
): Promise<ApiCombo[]> {
  const authToken = getRevampToken(token);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(
    `${REVAMP_BASE}/api/v1/combo/list?locationId=${encodeURIComponent(locationId)}`,
    { headers },
  );
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // ignore
  }
  if (!res.ok) {
    console.warn('[comboCatalogApi] getCombosApi failed:', res.status, data);
    return [];
  }
  if (Array.isArray(data)) return data as unknown as ApiCombo[];
  if (Array.isArray(data.combos)) return data.combos as ApiCombo[];
  if (Array.isArray(data.data)) return data.data as ApiCombo[];
  if (Array.isArray(data.content)) return data.content as ApiCombo[];
  return [];
}

export type CreateComboPayload = {
  locationId: string;
  name: string;
  displayName?: string;
  description?: string;
  comboCode?: string;
  pricingModel?: 'FIXED' | 'DYNAMIC';
  basePrice: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  orderTypeAvailability?: Array<{ orderTypeId: string; isEnable: boolean }>;
  modifiers?: Array<{ modifierId: string; sortOrder?: number }>;
  slots: Array<{
    slotId?: string;
    slotName: string;
    slotType: 'REQUIRED' | 'OPTIONAL';
    minSelections: number;
    maxSelections: number;
    defaultItemId?: string;
    defaultVariationId?: string;
    sortOrder?: number;
    eligibleItems: Array<{ itemId: string; supplementPrice: number }>;
  }>;
  sessionSlotIds?: string[];
};

export type UpdateComboPayload = CreateComboPayload & {
  comboId: string;
  deleteFields?: {
    slots?: string[];
    slotItems?: Record<string, string[]>;
    modifiers?: string[];
    sessionSlotIds?: string[];
  };
};

export async function createComboApi(
  payload: CreateComboPayload,
  token?: string | null,
): Promise<Record<string, unknown>> {
  return requestJson(`${REVAMP_BASE}/api/v1/combo/create`, payload, 'POST', token);
}

export async function updateComboApi(
  payload: UpdateComboPayload,
  token?: string | null,
): Promise<Record<string, unknown>> {
  return requestJson(`${REVAMP_BASE}/api/v1/combo/update`, payload, 'PATCH', token);
}

export async function deleteComboApi(
  payload: { comboId: string; locationId: string },
  token?: string | null,
): Promise<Record<string, unknown>> {
  return requestJson(`${REVAMP_BASE}/api/v1/combo/delete`, payload, 'DELETE', token);
}

