import { axiosFetch as authFetch } from './axiosFetch';
import { CREDENTIALS } from '../constants';
import { createRequest, validateAndParseResponse, getUserId } from '../utils/hmac-utils';
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

export type ApiChannelVisibility = {
  orderTypeId?: string;
  enabled?: boolean;
  avaliblityEnable?: boolean;
  inactiveUntilTime?: string | null;
  inactiveMode?: string | null;
};

export type ApiCategoryItem = {
  itemID?: string;
  itemName?: string | null;
  sortOrder?: number;
};

export type ApiCategory = {
  category_id?: string;
  name?: string;
  sortOrder?: number;
  description?: string | null;
  parentCategoryId?: string | null;
  locationId?: string;
  imageUrl?: string | null;
  channelVisibility?: ApiChannelVisibility[];
  items?: ApiCategoryItem[];
};

export type ApiGetCategoriesResponse = {
  locationId?: string;
  parentcatagory?: ApiCategory[];
  subcategory?: ApiCategory[];
};

// --- Request helpers ---

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
    'X-source': 'MP'
   
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
  let responseValidation:any;
  try {
    data = (await res.json()) as Record<string, unknown>;
     responseValidation=await validateAndParseResponse(data);
    if(!responseValidation?.valid){
      console.warn('[catalogApi] response validation failed:', 'Invalid response structure', data); 
      throw new Error(messageFromRevampErrorBody(data, 'Invalid response structure'));
  }
    
  } catch {
    // ignore parse failures
  }
  if (!res.ok) {
    console.warn('[catalogApi] request failed:', 'Category API request failed', data); throw new Error(messageFromRevampErrorBody(data, 'Category API request failed'));
  }
  return data;
}

async function requestJsonwithoutHmac(
  url: string,
  body: unknown,
  method: 'POST' | 'PATCH' | 'DELETE',
  token?: string | null,
): Promise<Record<string, unknown>> {
  const authToken = getRevampToken(token);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',

   
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(body),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // ignore parse failures
  }
  if (!res.ok) {
    console.warn('[catalogApi] request failed:', 'Category API request failed', data); throw new Error(messageFromRevampErrorBody(data, 'Category API request failed'));
  }
  return data;
}
async function requestGet(
  url: string,
  token?: string | null,
): Promise<Record<string, unknown>> {
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
    console.warn('[catalogApi] request failed:', 'Category API request failed', data); throw new Error(messageFromRevampErrorBody(data, 'Category API request failed'));
  }
  return data;
}

// --- GET categories ---

export async function getCategoriesApi(
  locationId: string,
  token?: string | null,
): Promise<ApiGetCategoriesResponse> {
  const data = await requestGet(
    `${REVAMP_BASE}/api/v1/category/get-categories?locationId=${encodeURIComponent(locationId)}`,
    token,
  );
  return data as unknown as ApiGetCategoriesResponse;
}

// --- Module list (generic entity fetcher) ---

export type ModuleListItem = {
  id?: string;
  itemId?: string;
  category_id?: string;
  categoryId?: string;
  name?: string;
  itemName?: string;
  categoryName?: string;
  orderTypes?: any[];
  [key: string]: any;
};

export async function getModuleListApi(
  entity: string,
  filters: Record<string, any>,
  token?: string | null,
): Promise<ModuleListItem[]> {
  const data = await requestJsonwithoutHmac(
    `${REVAMP_BASE}/api/v1/module`,
    { entity, filters },
    'POST',
    token,
  );
  if (Array.isArray(data)) return data as unknown as ModuleListItem[];
  if (Array.isArray((data as any).data)) return (data as any).data as ModuleListItem[];
  if (Array.isArray((data as any).content)) return (data as any).content as ModuleListItem[];
  if (Array.isArray((data as any).entries)) return (data as any).entries as ModuleListItem[];
  return [];
}

// --- CREATE category ---

export type CreateCategoryPayload = {
  categoryId?: string;
  name: string;
  description?: string;
  locationId: string;
  parentCategoryId?: string | null;
  channelVisibility: Array<{
    orderTypeId: string;
    enabled: boolean;
  }>;
  items: string[];
};

export async function createCategoryApi(
  payload: CreateCategoryPayload,
  token?: string | null,
): Promise<Record<string, unknown>> {
  return requestJson(`${REVAMP_BASE}/api/v1/category/create`, payload, 'POST', token);
}

// --- UPDATE category ---

export type UpdateCategoryPayload = {
  categoryId: string;
  locationId: string;
  name?: string;
  description?: string;
  parentCategoryId?: string | null;
  channelVisibility?: Array<{
    orderTypeId: string;
    enabled: boolean;
  }>;
  items?: Array<{
    itemID: string;
    sortOrder?: number;
  }>;
  deleteFields?: {
    items?: string[];
    taxId?: string;
  };
};

export async function updateCategoryApi(
  payload: UpdateCategoryPayload,
  token?: string | null,
): Promise<Record<string, unknown>> {
  return requestJson(`${REVAMP_BASE}/api/v1/category/update`, payload, 'PATCH', token);
}

// --- CATEGORY AVAILABILITY ---

export type CategoryAvailabilityOrderTypePayload = {
  orderTypeId: string;
  inactiveUntil: string | null;
  inactiveMode: string | null;
};

export type CategoryPartialUpdateAvailabilityPayload = {
  categoryId: string;
  locationId: string;
  userId?: string;
  inactiveUntil: string | null;
  inactiveMode: string | null;
  orderTypes: CategoryAvailabilityOrderTypePayload[];
};

export async function partialUpdateCategoryAvailabilityApi(
  payload: CategoryPartialUpdateAvailabilityPayload,
  token?: string | null,
): Promise<Record<string, unknown>> {
  return requestJson(`${REVAMP_BASE}/api/v1/category/partialupdate`, payload, 'PATCH', token);
}

export type CategoryBulkEditAvailabilityPayload = {
  categoryIds: string[];
  locationId: string;
  userId?: string;
  orderTypes: CategoryAvailabilityOrderTypePayload[];
};

export async function bulkEditCategoryAvailabilityApi(
  payload: CategoryBulkEditAvailabilityPayload,
  token?: string | null,
): Promise<Record<string, unknown>> {
  return requestJson(`${REVAMP_BASE}/api/v1/category/bulkedit`, payload, 'PATCH', token);
}

// --- DELETE category ---

export async function deleteCategoryApi(
  payload: { categoryId: string; locationId: string },
  token?: string | null,
): Promise<Record<string, unknown>> {
  return requestJson(`${REVAMP_BASE}/api/v1/category/delete`, payload, 'DELETE', token);
}

// --- UPLOAD category image ---

export async function uploadCategoryImageApi(
  formData: FormData,
  categoryId?: string | null,
  token?: string | null,
): Promise<Record<string, unknown>> {
  const authToken = getRevampToken(token);
  const headers: Record<string, string> = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const url = categoryId
    ? `${REVAMP_BASE}/api/v1/category/upload-image?categoryId=${encodeURIComponent(categoryId)}`
    : `${REVAMP_BASE}/api/v1/category/upload-image`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // ignore parse failures
  }
  if (!res.ok) {
    console.warn('[catalogApi] request failed:', 'Failed to upload category image', data); throw new Error(messageFromRevampErrorBody(data, 'Failed to upload category image'));
  }
  return data;
}

// --- SORT categories ---

export type SortCategoryPayload = {
  locationId: string;
  category: Array<{
    categoryId: string;
    sortOrder: number;
  }>;
};

export async function sortCategoryApi(
  payload: SortCategoryPayload,
  token?: string | null,
): Promise<Record<string, unknown>> {
  return requestJson(`${REVAMP_BASE}/api/v1/category/sortcategory`, payload, 'PATCH', token);
}

// --- REMOVE category image ---

export async function removeCategoryImageApi(
  imageId: string,
  token?: string | null,
): Promise<Record<string, unknown>> {
  const authToken = getRevampToken(token);
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(
    `${REVAMP_BASE}/api/v1/category/remove-image?imageId=${encodeURIComponent(imageId)}`,
    { method: 'DELETE', headers },
  );
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // ignore parse failures
  }
  if (!res.ok) {
    console.warn('[catalogApi] request failed:', 'Failed to remove category image', data); throw new Error(messageFromRevampErrorBody(data, 'Failed to remove category image'));
  }
  return data;
}

