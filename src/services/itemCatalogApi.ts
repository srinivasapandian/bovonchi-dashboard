import { axiosFetch as authFetch } from './axiosFetch';
/**
 * Product catalog item + category HTTP client for the revamp API.
 *
 * Backend sources (global prefix `/api/v1` â€” see maghil-backend-v3/src/main.ts):
 * - Items: maghil-backend-v3/src/interface/item/controllers/item.controller.ts (@Controller('items'))
 * - Categories list: maghil-backend-v3/src/interface/category/controller/category.controller.ts (@Get('get-categories'))
 * - Item attribute typeName values: maghil-backend-v3/src/application/item/use-cases/get-item-attributes.use-case.ts (switch on typeName)
 */
import { CREDENTIALS } from '../constants';
import { createRequest, getUserId } from '../utils/hmac-utils';
import { messageFromRevampErrorBody } from '../utils/revampApiErrorMessage';

const REVAMP_BASE = (process.env.REACT_APP_API_ENDPOINT_REVAMP || '').replace(/\/$/, '');

/** `/api/v1/items` â€” ItemController */
export const ITEMS_API_BASE = `${REVAMP_BASE}/api/v1/items`;

/** `/api/v1/category/get-categories` â€” CategoryController */
export const CATEGORY_GET_CATEGORIES_URL = `${REVAMP_BASE}/api/v1/category/get-categories`;

function getRevampToken(passedToken?: string | null): string | null {
  if (passedToken && typeof passedToken === 'string' && passedToken.trim()) return passedToken.trim();
  try {
    const raw = localStorage.getItem(CREDENTIALS);
  
    
    if (!raw) return null;
    const stored = JSON.parse(raw);
      console.log({stored});
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
     'X-source': 'MP'
  };
  const userId = getUserId();
  const bodyWithUser = userId ? { ...(body as object), userId } : body;
  
  
  const requestPayload = await createRequest(bodyWithUser);
  console.log("payload",JSON.parse(requestPayload?.payload));
  
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
    throw new Error(messageFromRevampErrorBody(data, `Item API ${method} failed`));
  }
  return data;
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
      // ignore
    }
    if (!res.ok) {
      throw new Error(messageFromRevampErrorBody(data, 'Request failed'));
    }
    return data;
  });
}

/** Single category row from GET get-categories (parent or sub). */
export type ApiGetCategoryRow = {
  category_id?: string;
  name?: string;
  sortOrder?: number | null;
  description?: string | null;
  parentCategoryId?: string | null;
  locationId?: string;
  imageUrl?: string | null;
  channelVisibility?: unknown[];
  items?: Array<{ itemID?: string; itemId?: string; itemName?: string | null; sortOrder?: number | null }>;
};

export type ApiGetCategoriesResponse = {
  locationId?: string;
  parentcatagory?: ApiGetCategoryRow[];
  subcategory?: ApiGetCategoryRow[];
};

export type ApiItemCategory = { id?: string; name?: string };

export type ApiPricingChannel = {
  orderTypeId?: string;
  name?: string;
  enabled?: boolean;
  price?: number;
  availabilityEnabled?: boolean;
  inactiveUntilTime?: string | null;
  inactiveMode?: string | null;
};

export type ApiKotOrderTypeRow = {
  orderTypeId?: string;
  isKot?: boolean;
};

export type ApiItemPricing = {
  basePrice?: string | number | null;
  costPrice?: string | number | null;
  channels?: ApiPricingChannel[];
};

export type ApiItemKitchen = { id?: string; name?: string };

export type ApiItemModifier = { modifierId?: string; name?: string };

export type ApiItemTag = { id?: string; name?: string };
export type ApiItemAllergen = { id?: string; name?: string };
export type ApiItemDiettype = { id?: string; name?: string };
export type ApiItemIngredient = { id?: string; name?: string };
export type ApiItemVariantChannel = {
  orderTypeId?: string;
  name?: string;
  price?: number | string;
};
export type ApiItemVariant = {
  variationId?: string;
  id?: string;
  name?: string;
  isEnabled?: boolean | number;
  channels?: ApiItemVariantChannel[];
};

export type ApiNutrition = {
  basis?: string;
  calories?: number | string;
  protein?: number | string;
  carbs?: number | string;
  fat?: number | string;
};

export const ITEM_TYPE_TO_BACKEND_CODE = {
  prepared_food_beverage: 1,
  event: 2,
  physical_good: 3,
  merchandise: 4,
  service: 5,
  digital: 6,
} as const;

export type CatalogItemTypeFe = keyof typeof ITEM_TYPE_TO_BACKEND_CODE;

const BACKEND_CODE_TO_ITEM_TYPE: Partial<Record<number, CatalogItemTypeFe>> = {
  1: 'prepared_food_beverage',
  2: 'event',
  3: 'physical_good',
  4: 'merchandise',
  5: 'service',
  6: 'digital',
};

export function apiNumericItemTypeToFe(value: number | null | undefined): CatalogItemTypeFe {
  if (value == null || !Number.isFinite(Number(value))) return 'prepared_food_beverage';
  return BACKEND_CODE_TO_ITEM_TYPE[Number(value)] ?? 'prepared_food_beverage';
}

export function feItemTypeToBackendCode(fe: CatalogItemTypeFe): number {
  return ITEM_TYPE_TO_BACKEND_CODE[fe] ?? 1;
}

export type ItemCreationStatusApi = 'Draft' | 'Active' | 'Out of Stock' | 'Hidden' | 'Archived';

export function itemCreationStatusApiFromFeStatus(status: string): ItemCreationStatusApi {
  switch (status) {
    case 'active':
      return 'Active';
    case 'out_of_stock':
      return 'Out of Stock';
    case 'hidden':
      return 'Hidden';
    case 'archived':
      return 'Archived';
    case 'draft':
    default:
      return 'Draft';
  }
}

export function feStatusFromItemCreationStatus(raw: string | null | undefined): string {
  const s = String(raw ?? 'Draft').trim();
  const k = s.toLowerCase().replace(/[\s-]+/g, '_');
  if (k === 'active') return 'active';
  if (k === 'out_of_stock' || k === 'outofstock' || k === 'oos') return 'out_of_stock';
  if (k === 'hidden') return 'hidden';
  if (k === 'archived') return 'archived';
  if (k === 'draft') return 'draft';
  return 'draft';
}

export type ApiItemRow = {
  itemId?: string;
  id?: string;
  name?: string;
  itemType?: number | null;
  itemCreationStatus?: string;
  description?: string;
  pluCode?: string;
  categories?: ApiItemCategory[];
  pricing?: ApiItemPricing;
  kotordertype?: ApiKotOrderTypeRow[];
  kitchenDetails?: {
    kitchens?: ApiItemKitchen[];
    preparationTimeInMins?: string | number | null;
    printInMasterKOT?: boolean;
  };
  printInMasterKOT?: boolean;
  availability?: {
    seasonalDateRange?: { from: string; to: string } | null;
    timeBasedAvailability?: Array<{
      sessionGroupId?: string;
      session_group_id?: string;
      sessionId?: string;
      name?: string;
      sessionSlot?: Array<{
        slotId?: string;
        id?: string;
        startTime?: string;
        endTime?: string;
        weekday?: string;
      }>;
    }>;
  };
  modifiers?: ApiItemModifier[];
  tags?: ApiItemTag[];
  allergens?: ApiItemAllergen[];
  diettypes?: ApiItemDiettype[];
  ingredients?: ApiItemIngredient[];
  taxes?: Array<{ taxId?: string; name?: string; id?: string }>;
  taxId?: string;
  taxGroupId?: string;
  containsAlcohol?: boolean;
  specialInstructions?: string;
  specialInstruction?: string;
  special_instructions?: string;
  nutrition?: ApiNutrition;
  variants?: ApiItemVariant[];
  mediaResponseList?: Array<{
    id?: string;
    fileName?: string;
    type?: string;
    imageUrl?: string;
    imageId?: string;
    imageType?: string;
    sortOrder?: number | null;
  }>;
};

export type ApiKitchenStationItem = {
  itemId?: string;
  name?: string;
  productCode?: string;
};
export type ApiKitchenStationDevice = {
  deviceId?: string;
  name?: string;
  deviceIdentifier?: string;
  deviceType?: string;
};
export type ApiKitchenStationRow = {
  id?: string;
  stationName?: string;
  stationCode?: string;
  description?: string | null;
  isEnabled?: boolean;
  items?: ApiKitchenStationItem[];
  devices?: ApiKitchenStationDevice[];
};
export type ApiKitchenStationsResponse = {
  stations?: ApiKitchenStationRow[];
};

/** Path param for GET items/item-attributes/:typeName â€” GetItemAttributesUseCase. */
export type ItemAttributeTypeName =
  | 'tags'
  | 'ingredients'
  | 'diet'
  | 'allergens'
  | 'tax'
  | 'kitchenStation'
  | 'revenueClass'
  | 'units';

function normalizeArray<T>(data: Record<string, unknown>): T[] {
  if (Array.isArray(data)) return data as T[];
  if (Array.isArray(data.data)) return data.data as T[];
  if (Array.isArray(data.content)) return data.content as T[];
  return [];
}

/** GET items/:locationId â€” ItemController.getItems */
export async function getItemsApi(locationId: string, token?: string | null): Promise<ApiItemRow[]> {
  const authToken = getRevampToken(token);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-compress-response': '1',
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${ITEMS_API_BASE}/${encodeURIComponent(locationId)}`, { headers });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // ignore
  }
  if (!res.ok) {
    throw new Error(messageFromRevampErrorBody(data, 'Failed to fetch items'));
  }
  if (Array.isArray(data)) return data as unknown as ApiItemRow[];
  return normalizeArray<ApiItemRow>(data);
}

/** GET category/get-categories?locationId= â€” CategoryController.getCategories */
export async function getCategoriesCatalogApi(
  locationId: string,
  token?: string | null,
): Promise<ApiGetCategoriesResponse> {
  const authToken = getRevampToken(token);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const url = `${CATEGORY_GET_CATEGORIES_URL}?locationId=${encodeURIComponent(locationId)}`;
  const res = await fetch(url, { headers });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // ignore
  }
  if (!res.ok) {
    throw new Error(messageFromRevampErrorBody(data, 'Failed to fetch categories'));
  }
  const parentcatagory = Array.isArray(data.parentcatagory)
    ? (data.parentcatagory as ApiGetCategoryRow[])
    : [];
  const subcategory = Array.isArray(data.subcategory) ? (data.subcategory as ApiGetCategoryRow[]) : [];
  return {
    locationId: typeof data.locationId === 'string' ? data.locationId : locationId,
    parentcatagory,
    subcategory,
  };
}

/** GET items/item-attributes/:typeName?locationId= â€” ItemController.getItemAttributes */
export async function getItemAttributesApi(
  typeName: ItemAttributeTypeName,
  locationId: string,
  token?: string | null,
): Promise<unknown> {
  const q = `?locationId=${encodeURIComponent(locationId)}`;
  return getJson(`${ITEMS_API_BASE}/item-attributes/${encodeURIComponent(typeName)}${q}`, token);
}

/** GET items/kitchen-stations?locationId= â€” ItemController.getKitchenStations */
export async function getKitchenStationsApi(
  locationId: string,
  token?: string | null,
): Promise<ApiKitchenStationsResponse> {
  const data = await getJson(
    `${ITEMS_API_BASE}/kitchen-stations?locationId=${encodeURIComponent(locationId)}`,
    token,
  );
  return (data ?? {}) as ApiKitchenStationsResponse;
}

/** POST items/kitchen-station/create */
export async function createKitchenStationApi(
  body: {
    locationId: string;
    stationName: string;
    stationCode?: string;
    description?: string;
    itemIds?: string[];
    deleteFields?: {
      itemIds?: string[];
    };
  },
  token?: string | null,
): Promise<unknown> {
  return requestJson(`${ITEMS_API_BASE}/kitchen-station/create`, body, 'POST', token);
}

/** PATCH items/kitchen-station/update */
export async function updateKitchenStationApi(
  body: {
    id: string;
    locationId: string;
    stationName?: string;
    stationCode?: string;
    description?: string;
    itemIds?: string[];
    deleteFields?: {
      itemIds?: string[];
    };
  },
  token?: string | null,
): Promise<unknown> {
  return requestJson(`${ITEMS_API_BASE}/kitchen-station/update`, body, 'PATCH', token);
}

/** DELETE items/kitchen-station/delete */
export async function deleteKitchenStationApi(
  body: { id: string; locationId: string },
  token?: string | null,
): Promise<unknown> {
  return requestJson(`${ITEMS_API_BASE}/kitchen-station/delete`, body, 'DELETE', token);
}

/** GET items/validate-item-code?locationId=&itemCode= â€” ItemController.validateItemCode */
export async function validateItemCodeApi(
  locationId: string,
  itemCode: string,
  token?: string | null,
): Promise<unknown> {
  const params = new URLSearchParams({
    locationId,
    itemCode,
  });
  return getJson(`${ITEMS_API_BASE}/validate-item-code?${params.toString()}`, token);
}

/** POST items/create â€” ItemController.createItem (body: CreateItemDto) */
export async function createItemApi(body: unknown, token?: string | null): Promise<unknown> {
  return requestJson(`${ITEMS_API_BASE}/create`, body, 'POST', token);
}

/** PATCH items/update â€” ItemController.updateItem (body: UpdateItemDto) */
export async function updateItemApi(body: unknown, token?: string | null): Promise<unknown> {
  return requestJson(`${ITEMS_API_BASE}/update`, body, 'PATCH', token);
}

/** PATCH items/partialupdate â€” ItemController.partialUpdate */
export async function partialUpdateItemApi(body: unknown, token?: string | null): Promise<unknown> {
  return requestJson(`${ITEMS_API_BASE}/partialupdate`, body, 'PATCH', token);
}

/** DELETE items/delete â€” ItemController.deleteItem (body: DeleteItemDto) */
export async function deleteItemApi(
  body: { itemId: string; locationId: string },
  token?: string | null,
): Promise<unknown> {
  return requestJson(`${ITEMS_API_BASE}/delete`, body, 'DELETE', token);
}

/** PATCH items/bulk/delete â€” Bulk delete items */
export async function bulkDeleteItemsApi(
  body: { locationId: string; itemIds: string[] },
  token?: string | null,
): Promise<unknown> {
  return requestJson(`${ITEMS_API_BASE}/bulk/delete`, body, 'PATCH', token);
}

/** POST items/upload-image?itemId=&sortOrder=&existingImageId= â€” ItemController.uploadImage (multipart) */
export async function uploadItemImageApi(
  params: {
    file?: Blob;
    itemId?: string;
    sortOrder?: number;
    existingImageId?: string;
  },
  token?: string | null,
): Promise<unknown> {
  const authToken = getRevampToken(token);
  const q = new URLSearchParams();
  if (params.itemId) q.set('itemId', params.itemId);
  if (params.sortOrder != null) q.set('sortOrder', String(params.sortOrder));
  if (params.existingImageId) q.set('existingImageId', params.existingImageId);
  const qs = q.toString();
  const url = `${ITEMS_API_BASE}/upload-image${qs ? `?${qs}` : ''}`;
  const fd = new FormData();
  if (params.file instanceof File) {
    fd.append('image', params.file, params.file.name);
  } else if (params.file instanceof Blob) {
    fd.append('image', params.file);
  } else {
    // Keep multipart field present for clone-by-existingImageId flow.
    fd.append('image', 'undefined');
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(url, { method: 'POST', headers, body: fd });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // ignore
  }
  if (!res.ok) {
    throw new Error(messageFromRevampErrorBody(data, 'Image upload failed'));
  }
  return data;
}

/** DELETE items/remove-image?imageId= â€” ItemController.removeImage */
export async function removeItemImageApi(imageId: string, token?: string | null): Promise<unknown> {
  const authToken = getRevampToken(token);
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const url = `${ITEMS_API_BASE}/remove-image?${new URLSearchParams({ imageId }).toString()}`;
  const res = await fetch(url, { method: 'DELETE', headers });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // ignore
  }
  if (!res.ok) {
    throw new Error(messageFromRevampErrorBody(data, 'Remove image failed'));
  }
  return data;
}

/** PATCH items/bulk/:actionType â€” ItemController.bulkEdit */
export async function bulkEditItemApi(
  actionType: 'availability' | 'pricing' | 'delete' | 'kot-exception',
  body: unknown,
  token?: string | null,
): Promise<unknown> {
  return requestJson(`${ITEMS_API_BASE}/bulk/${encodeURIComponent(actionType)}`, body, 'PATCH', token);
}

/** POST items/bulk-update â€” ItemController.bulkUpdate */
export async function bulkUpdateItemsApi(body: unknown, token?: string | null): Promise<unknown> {
  return requestJson(`${ITEMS_API_BASE}/bulk-update`, body, 'POST', token);
}

/** POST items/bulk-update-eod */
export async function bulkUpdateItemsEodApi(body: unknown, token?: string | null): Promise<unknown> {
  return requestJson(`${ITEMS_API_BASE}/bulk-update-eod`, body, 'POST', token);
}

/** POST items/bulk-update-category */
export async function bulkUpdateItemsCategoryApi(body: unknown, token?: string | null): Promise<unknown> {
  return requestJson(`${ITEMS_API_BASE}/bulk-update-category`, body, 'POST', token);
}

/** POST items/bulk-update-category-eod */
export async function bulkUpdateItemsCategoryEodApi(body: unknown, token?: string | null): Promise<unknown> {
  return requestJson(`${ITEMS_API_BASE}/bulk-update-category-eod`, body, 'POST', token);
}

/** GET items/exclusive/:locationId â€” ItemController.getExclusiveItems */
export async function getExclusiveItemsApi(locationId: string, token?: string | null): Promise<unknown> {
  return getJson(`${ITEMS_API_BASE}/exclusive/${encodeURIComponent(locationId)}`, token);
}

/** PATCH items/exclusive/sort-order â€” ItemController.updateExclusiveItemsSortOrder */
export async function updateExclusiveItemsSortOrderApi(body: unknown, token?: string | null): Promise<unknown> {
  return requestJson(`${ITEMS_API_BASE}/exclusive/sort-order`, body, 'PATCH', token);
}
