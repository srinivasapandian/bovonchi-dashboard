/**
 * Category API → UI types (extracted from former Zustand store for Redux-Saga).
 */
import type { Category } from '../data/types';
import type { ApiCategory, ApiGetCategoriesResponse } from '../../../services/categoryCatalogApi';

const IMAGE_URL = (process.env.REACT_APP_IMAGE_URL).replace(/\/$/, '') + '/';

const defaultOrderTypeVisibility = {
  dine_in: true as boolean,
  takeout: true as boolean,
  delivery: true as boolean,
  online_ordering: false as boolean,
  catering: false as boolean,
};

function mapApiCategoryToLocal(api: ApiCategory): Category {
  const channelVis = Array.isArray(api.channelVisibility) ? api.channelVisibility : [];
  const orderTypeVisibility = { ...defaultOrderTypeVisibility };
  const itemList = Array.isArray(api.items) ? api.items : [];

  return {
    id: api.category_id ?? '',
    name: api.name ?? '',
    description: api.description ?? '',
    parentCategoryId: api.parentCategoryId ?? undefined,
    itemCount: itemList.length,
    isVisible: true,
    sortPosition: api.sortOrder ?? 0,
    orderTypeVisibility,
    imageUrl: (api.imageUrl && typeof api.imageUrl === 'string' && api.imageUrl.trim() && api.imageUrl !== 'null')
      ? (api.imageUrl.startsWith('http') ? api.imageUrl : `${IMAGE_URL}${api.imageUrl}`)
      : undefined,
    channelVisibility: channelVis.map((cv) => ({
      orderTypeId: cv.orderTypeId ?? '',
      enabled: cv.enabled ?? true,
      availabilityEnabled: cv.avaliblityEnable ?? true,
      avaliblityEnable: cv.avaliblityEnable ?? true,
      inactiveUntilTime: cv.inactiveUntilTime ?? null,
      inactiveMode: cv.inactiveMode ?? null,
    })),
    itemIds: itemList
      .map((item) => item.itemID ?? '')
      .filter(Boolean),
    assignedItems: itemList
      .filter((item) => item.itemID)
      .map((item) => ({ id: item.itemID!, name: item.itemName ?? '' })),
  };
}

export function mapApiGetCategoriesToCategories(payload: ApiGetCategoriesResponse): Category[] {
  const parents = Array.isArray(payload.parentcatagory) ? payload.parentcatagory : [];
  const subs = Array.isArray(payload.subcategory) ? payload.subcategory : [];
  return [...parents, ...subs].map(mapApiCategoryToLocal);
}
