import { PC } from './productCatalogConstants';
import type { Deferred, FetchOptions, ToastItem, AttrType } from './productCatalogTypes';
import type { SyncErrorKind } from '../../services/syncCatalogApi';
import type {
  MenuItem,
  Category,
  Menu,
  MenuStatus,
  Session,
  ModifierGroup,
  Combo,
  OptionSet,
  KitchenStation,
  Printer,
  SetMenu,
  MenuItemPrice,
  DietaryTypeColor,
  ItemAttribute,
} from '../../components/productCatalog/data/types';
import type { TaxOption } from './productCatalogTypes';
import type { CreateCategoryPayload, UpdateCategoryPayload } from '../../services/categoryCatalogApi';
import type { ModuleListItem } from '../../services/categoryCatalogApi';
import type { CreateModifierPayload, UpdateModifierPayload } from '../../services/modifierCatalogApi';
import type { CreateComboPayload, UpdateComboPayload } from '../../services/comboCatalogApi';

export type ProductCatalogAction = ReturnType<
  | typeof itemsSetEditing
  | typeof itemsSetVisibleColumns
  | typeof itemsClearCache
  | typeof fetchItemsRequest
  | typeof fetchItemsSuccess
  | typeof fetchItemsFailure
  | typeof createItemRequest
  | typeof createItemDone
  | typeof updateItemRequest
  | typeof updateItemDone
  | typeof deleteItemRequest
  | typeof deleteItemDone
  | typeof bulkDeleteItemsRequest
  | typeof bulkDeleteItemsDone
  | typeof validateItemCodeRequest
  | typeof validateItemCodeDone
  | typeof uploadItemImageRequest
  | typeof uploadItemImageDone
  | typeof removeItemImageRequest
  | typeof removeItemImageDone
  | typeof itemsAdd
  | typeof itemsUpdate
  | typeof itemsRemove
  | typeof itemsToggleStatus
  | typeof itemsReorderInCategory
  | typeof categoriesSetEditing
  | typeof categoriesClearCache
  | typeof fetchCategoriesRequest
  | typeof fetchCategoriesSuccess
  | typeof fetchCategoriesFailure
  | typeof categoriesPrime
  | typeof categoriesSetLoading
  | typeof createCategoryRequest
  | typeof createCategoryDone
  | typeof updateCategoryRequest
  | typeof updateCategoryDone
  | typeof deleteCategoryRequest
  | typeof deleteCategoryDone
  | typeof sortCategoriesRequest
  | typeof sortCategoriesDone
  | typeof categoriesAdd
  | typeof categoriesUpdate
  | typeof categoriesRemove
  | typeof categoriesToggleVisibility
  | typeof categoriesReorderSiblings
  | typeof menusSetEditing
  | typeof menusClearCache
  | typeof fetchMenusRequest
  | typeof fetchMenusSuccess
  | typeof fetchMenusFailure
  | typeof createMenuRequest
  | typeof createMenuDone
  | typeof updateMenuRequest
  | typeof updateMenuDone
  | typeof deleteMenuRequest
  | typeof deleteMenuDone
  | typeof menusAdd
  | typeof menusUpdate
  | typeof menusRemove
  | typeof sessionsSetEditing
  | typeof sessionsClearCache
  | typeof fetchSessionsRequest
  | typeof fetchSessionsSuccess
  | typeof fetchSessionsFailure
  | typeof createSessionRequest
  | typeof createSessionDone
  | typeof updateSessionRequest
  | typeof updateSessionDone
  | typeof deleteSessionRequest
  | typeof deleteSessionDone
  | typeof sessionsAdd
  | typeof sessionsUpdate
  | typeof sessionsRemove
  | typeof modifiersSetEditing
  | typeof modifiersClearCache
  | typeof fetchModifiersRequest
  | typeof fetchModifiersSuccess
  | typeof fetchModifiersFailure
  | typeof createModifierRequest
  | typeof createModifierDone
  | typeof updateModifierRequest
  | typeof updateModifierDone
  | typeof deleteModifierRequest
  | typeof deleteModifierDone
  | typeof modifiersAdd
  | typeof modifiersUpdate
  | typeof modifiersRemove
  | typeof combosSetEditing
  | typeof combosClearCache
  | typeof fetchCombosRequest
  | typeof fetchCombosSuccess
  | typeof fetchCombosFailure
  | typeof createComboRequest
  | typeof createComboDone
  | typeof updateComboRequest
  | typeof updateComboDone
  | typeof deleteComboRequest
  | typeof deleteComboDone
  | typeof combosAdd
  | typeof combosUpdate
  | typeof combosRemove
  | typeof optionSetsSetEditing
  | typeof optionSetsClearCache
  | typeof fetchOptionSetsRequest
  | typeof fetchOptionSetsSuccess
  | typeof fetchOptionSetsFailure
  | typeof createOptionSetRequest
  | typeof createOptionSetDone
  | typeof updateOptionSetRequest
  | typeof updateOptionSetDone
  | typeof deleteOptionSetRequest
  | typeof deleteOptionSetDone
  | typeof optionSetsAdd
  | typeof optionSetsUpdate
  | typeof optionSetsRemove
  | typeof kitchenSetEditing
  | typeof kitchenClearCache
  | typeof fetchKitchenRequest
  | typeof fetchKitchenSuccess
  | typeof fetchKitchenFailure
  | typeof createStationRequest
  | typeof createStationDone
  | typeof updateStationRequest
  | typeof updateStationDone
  | typeof deleteStationRequest
  | typeof deleteStationDone
  | typeof kitchenAddStation
  | typeof kitchenUpdateStation
  | typeof kitchenRemoveStation
  | typeof kitchenAddPrinter
  | typeof kitchenUpdatePrinter
  | typeof kitchenRemovePrinter
  | typeof fetchAttributesRequest
  | typeof fetchAttributesSuccess
  | typeof fetchAttributesFailure
  | typeof clearAttributes
  | typeof toastAdd
  | typeof toastRemove
  | typeof setMenusSetEditing
  | typeof setMenusAdd
  | typeof setMenusUpdate
  | typeof setMenusRemove
  | typeof menuPricesSet
  | typeof menuPricesRemove
  | typeof menuPricesRemoveAllMenu
  | typeof menuPricesRemoveAllItem
  | typeof menuPricesBulkAdjust
  | typeof dietaryColorsUpdate
  | typeof triggerSyncRequest
  | typeof triggerSyncSuccess
  | typeof triggerSyncFailure
  | typeof invalidateFetchCache
  | typeof restaurantDetailsSet
  | typeof restaurantDetailsClear
  | typeof fetchModuleListRequest
  | typeof fetchModuleListDone
>;

// --- Items ---
export const itemsSetEditing = (id: string | null) => ({ type: PC.ITEMS_SET_EDITING, payload: id } as const);
export const itemsSetVisibleColumns = (columns: string[]) => ({ type: PC.ITEMS_SET_VISIBLE_COLUMNS, payload: columns } as const);
export const itemsClearCache = () => ({ type: PC.ITEMS_CLEAR_CACHE } as const);
export const fetchItemsRequest = (payload: {
  locationId: string;
  token?: string | null;
  options?: FetchOptions;
  deferred?: Deferred;
}) => ({ type: PC.FETCH_ITEMS_REQUEST, payload } as const);
export const fetchItemsSuccess = (payload: { items: MenuItem[]; locationId: string }) =>
  ({ type: PC.FETCH_ITEMS_SUCCESS, payload } as const);
export const fetchItemsFailure = (payload: { error: string }) => ({ type: PC.FETCH_ITEMS_FAILURE, payload } as const);
export const createItemRequest = (payload: {
  data: unknown;
  token?: string | null;
  deferred?: Deferred<unknown>;
}) => ({ type: PC.CREATE_ITEM_REQUEST, payload } as const);
export const createItemDone = (payload: { response?: unknown; error?: string | null }) =>
  ({ type: PC.CREATE_ITEM_SUCCESS, payload } as const);
export const updateItemRequest = (payload: {
  data: unknown;
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.UPDATE_ITEM_REQUEST, payload } as const);
export const updateItemDone = (payload: { error?: string | null }) =>
  ({ type: PC.UPDATE_ITEM_SUCCESS, payload } as const);
export const deleteItemRequest = (payload: {
  data: { itemId: string; locationId: string };
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.DELETE_ITEM_REQUEST, payload } as const);
export const deleteItemDone = (payload: { error?: string | null }) =>
  ({ type: PC.DELETE_ITEM_SUCCESS, payload } as const);
export const bulkDeleteItemsRequest = (payload: {
  data: { locationId: string; itemIds: string[] };
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.BULK_DELETE_ITEMS_REQUEST, payload } as const);
export const bulkDeleteItemsDone = (payload: { error?: string | null }) =>
  ({ type: PC.BULK_DELETE_ITEMS_SUCCESS, payload } as const);
export const validateItemCodeRequest = (payload: {
  locationId: string;
  itemCode: string;
  token?: string | null;
  deferred?: Deferred<unknown>;
}) => ({ type: PC.VALIDATE_ITEM_CODE_REQUEST, payload } as const);
export const validateItemCodeDone = (payload: { response?: unknown; error?: string | null }) =>
  ({ type: PC.VALIDATE_ITEM_CODE_SUCCESS, payload } as const);
export const uploadItemImageRequest = (payload: {
  data: { file?: Blob; itemId?: string; sortOrder?: number; existingImageId?: string };
  token?: string | null;
  deferred?: Deferred<unknown>;
}) => ({ type: PC.UPLOAD_ITEM_IMAGE_REQUEST, payload } as const);
export const uploadItemImageDone = (payload: { response?: unknown; error?: string | null }) =>
  ({ type: PC.UPLOAD_ITEM_IMAGE_SUCCESS, payload } as const);
export const removeItemImageRequest = (payload: {
  imageId: string;
  token?: string | null;
  deferred?: Deferred<unknown>;
}) => ({ type: PC.REMOVE_ITEM_IMAGE_REQUEST, payload } as const);
export const removeItemImageDone = (payload: { response?: unknown; error?: string | null }) =>
  ({ type: PC.REMOVE_ITEM_IMAGE_SUCCESS, payload } as const);
export const itemsAdd = (item: Omit<MenuItem, 'id'>) => ({ type: PC.ITEMS_ADD, payload: item } as const);
export const itemsUpdate = (payload: { id: string; updates: Partial<MenuItem> }) =>
  ({ type: PC.ITEMS_UPDATE, payload } as const);
export const itemsRemove = (id: string) => ({ type: PC.ITEMS_REMOVE, payload: id } as const);
export const itemsToggleStatus = (id: string) => ({ type: PC.ITEMS_TOGGLE_STATUS, payload: id } as const);
export const itemsReorderInCategory = (payload: { categoryId: string; orderedIds: string[] }) =>
  ({ type: PC.ITEMS_REORDER_IN_CATEGORY, payload } as const);

// --- Categories ---
export const categoriesSetEditing = (id: string | null) => ({ type: PC.CATEGORIES_SET_EDITING, payload: id } as const);
export const categoriesClearCache = () => ({ type: PC.CATEGORIES_CLEAR_CACHE } as const);
export const fetchCategoriesRequest = (payload: {
  locationId: string;
  token?: string | null;
  options?: FetchOptions;
  deferred?: Deferred;
}) => ({ type: PC.FETCH_CATEGORIES_REQUEST, payload } as const);
export const fetchCategoriesSuccess = (payload: { categories: Category[]; locationId: string }) =>
  ({ type: PC.FETCH_CATEGORIES_SUCCESS, payload } as const);
export const fetchCategoriesFailure = (payload: { error: string }) =>
  ({ type: PC.FETCH_CATEGORIES_FAILURE, payload } as const);
export const categoriesPrime = (payload: { categories: Category[]; locationId: string }) =>
  ({ type: PC.CATEGORIES_PRIME, payload } as const);
export const categoriesSetLoading = (payload: { loading: boolean; error?: string | null }) =>
  ({ type: PC.CATEGORIES_SET_LOADING, payload } as const);

export const createCategoryRequest = (payload: {
  data: CreateCategoryPayload;
  imageFile?: File | null;
  token?: string | null;
  deferred?: Deferred<string>;
}) => ({ type: PC.CREATE_CATEGORY_REQUEST, payload } as const);
export const createCategoryDone = (payload: { saving: boolean; error?: string | null }) =>
  ({ type: PC.CREATE_CATEGORY_SUCCESS, payload } as const);

export const updateCategoryRequest = (payload: {
  data: UpdateCategoryPayload;
  imageFile?: File | null;
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.UPDATE_CATEGORY_REQUEST, payload } as const);
export const updateCategoryDone = (payload: { saving: boolean; error?: string | null }) =>
  ({ type: PC.UPDATE_CATEGORY_SUCCESS, payload } as const);

export const deleteCategoryRequest = (payload: {
  categoryId: string;
  locationId: string;
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.DELETE_CATEGORY_REQUEST, payload } as const);
export const deleteCategoryDone = (payload: { saving: boolean; categoryId?: string; error?: string | null }) =>
  ({ type: PC.DELETE_CATEGORY_SUCCESS, payload } as const);

export const sortCategoriesRequest = (payload: {
  locationId: string;
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.SORT_CATEGORIES_REQUEST, payload } as const);
export const sortCategoriesDone = () => ({ type: PC.SORT_CATEGORIES_SUCCESS } as const);

export const categoriesAdd = (category: Omit<Category, 'id'>) =>
  ({ type: PC.CATEGORIES_ADD, payload: category } as const);
export const categoriesUpdate = (payload: { id: string; updates: Partial<Category> }) =>
  ({ type: PC.CATEGORIES_UPDATE, payload } as const);
export const categoriesRemove = (id: string) => ({ type: PC.CATEGORIES_REMOVE, payload: id } as const);
export const categoriesToggleVisibility = (id: string) =>
  ({ type: PC.CATEGORIES_TOGGLE_VISIBILITY, payload: id } as const);
export const categoriesReorderSiblings = (payload: { parentCategoryId: string | undefined; orderedIds: string[] }) =>
  ({ type: PC.CATEGORIES_REORDER_SIBLINGS, payload } as const);

// --- Menus ---
export const menusSetEditing = (id: string | null) => ({ type: PC.MENUS_SET_EDITING, payload: id } as const);
export const menusClearCache = () => ({ type: PC.MENUS_CLEAR_CACHE } as const);
export const fetchMenusRequest = (payload: {
  locationId: string;
  token?: string | null;
  options?: FetchOptions;
  deferred?: Deferred;
}) => ({ type: PC.FETCH_MENUS_REQUEST, payload } as const);
export const fetchMenusSuccess = (payload: { menus: Menu[]; locationId: string }) =>
  ({ type: PC.FETCH_MENUS_SUCCESS, payload } as const);
export const fetchMenusFailure = (payload: { error: string }) =>
  ({ type: PC.FETCH_MENUS_FAILURE, payload } as const);

export type MenuCreateServerPayload = {
  locationId: string;
  name: string;
  description?: string;
  icon?: string;
  status?: MenuStatus | 'active' | 'schedule';
  activeOn?: string | null;
  categories: Array<{ categoryId: string; enabled: boolean }>;
  orderTypes: Array<{ orderTypeId: string; enabled: boolean }>;
  devices?: Array<{ deviceId: string; enabled: boolean }>;
  items?: Array<{ itemId: string; enabled: boolean }>;
};
export type MenuUpdateServerPayload = {
  categoryGroupId: string;
  locationId: string;
  name?: string;
  description?: string;
  icon?: string;
  status?: MenuStatus | 'active' | 'schedule';
  activeOn?: string | null;
  categories?: Array<{ categoryId: string; enabled: boolean }>;
  orderTypes?: Array<{ orderTypeId: string; enabled: boolean }>;
  devices?: Array<{ deviceId: string; enabled: boolean }>;
  items?: Array<{ itemId: string; enabled: boolean }>;
};

export const createMenuRequest = (payload: {
  data: MenuCreateServerPayload;
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.CREATE_MENU_REQUEST, payload } as const);
export const createMenuDone = (payload: { error?: string | null }) =>
  ({ type: PC.CREATE_MENU_SUCCESS, payload } as const);

export const updateMenuRequest = (payload: {
  data: MenuUpdateServerPayload;
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.UPDATE_MENU_REQUEST, payload } as const);
export const updateMenuDone = (payload: { error?: string | null }) =>
  ({ type: PC.UPDATE_MENU_SUCCESS, payload } as const);

export const deleteMenuRequest = (payload: {
  data: { categoryGroupId: string; locationId: string };
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.DELETE_MENU_REQUEST, payload } as const);
export const deleteMenuDone = (payload: { categoryGroupId: string; error?: string | null }) =>
  ({ type: PC.DELETE_MENU_SUCCESS, payload } as const);

export const menusAdd = (menu: Omit<Menu, 'id'>) => ({ type: PC.MENUS_ADD, payload: menu } as const);
export const menusUpdate = (payload: { id: string; updates: Partial<Menu> }) =>
  ({ type: PC.MENUS_UPDATE, payload } as const);
export const menusRemove = (id: string) => ({ type: PC.MENUS_REMOVE, payload: id } as const);

// --- Sessions ---
export const sessionsSetEditing = (id: string | null) => ({ type: PC.SESSIONS_SET_EDITING, payload: id } as const);
export const sessionsClearCache = () => ({ type: PC.SESSIONS_CLEAR_CACHE } as const);
export const fetchSessionsRequest = (payload: {
  locationId: string;
  token?: string | null;
  options?: FetchOptions;
  deferred?: Deferred;
}) => ({ type: PC.FETCH_SESSIONS_REQUEST, payload } as const);
export const fetchSessionsSuccess = (payload: { sessions: Session[]; locationId: string }) =>
  ({ type: PC.FETCH_SESSIONS_SUCCESS, payload } as const);
export const fetchSessionsFailure = (payload: { error: string }) =>
  ({ type: PC.FETCH_SESSIONS_FAILURE, payload } as const);
export const createSessionRequest = (payload: {
  data: unknown;
  token?: string | null;
  deferred?: Deferred<unknown>;
}) => ({ type: PC.CREATE_SESSION_REQUEST, payload } as const);
export const createSessionDone = (payload: { error?: string | null }) =>
  ({ type: PC.CREATE_SESSION_SUCCESS, payload } as const);
export const updateSessionRequest = (payload: {
  data: unknown;
  token?: string | null;
  deferred?: Deferred<unknown>;
}) => ({ type: PC.UPDATE_SESSION_REQUEST, payload } as const);
export const updateSessionDone = (payload: { error?: string | null }) =>
  ({ type: PC.UPDATE_SESSION_SUCCESS, payload } as const);
export const deleteSessionRequest = (payload: {
  data: { sessionId: string; locationId: string };
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.DELETE_SESSION_REQUEST, payload } as const);
export const deleteSessionDone = (payload: { sessionId?: string; error?: string | null }) =>
  ({ type: PC.DELETE_SESSION_SUCCESS, payload } as const);
export const sessionsAdd = (session: Omit<Session, 'id'>) => ({ type: PC.SESSIONS_ADD, payload: session } as const);
export const sessionsUpdate = (payload: { id: string; updates: Partial<Session> }) =>
  ({ type: PC.SESSIONS_UPDATE, payload } as const);
export const sessionsRemove = (id: string) => ({ type: PC.SESSIONS_REMOVE, payload: id } as const);

// --- Modifiers ---
export const modifiersSetEditing = (id: string | null) => ({ type: PC.MODIFIERS_SET_EDITING, payload: id } as const);
export const modifiersClearCache = () => ({ type: PC.MODIFIERS_CLEAR_CACHE } as const);
export const fetchModifiersRequest = (payload: {
  locationId: string;
  token?: string | null;
  options?: FetchOptions;
  deferred?: Deferred;
}) => ({ type: PC.FETCH_MODIFIERS_REQUEST, payload } as const);
export const fetchModifiersSuccess = (payload: { modifiers: ModifierGroup[]; locationId: string }) =>
  ({ type: PC.FETCH_MODIFIERS_SUCCESS, payload } as const);
export const fetchModifiersFailure = (payload: { error: string }) =>
  ({ type: PC.FETCH_MODIFIERS_FAILURE, payload } as const);

export const createModifierRequest = (payload: {
  data: CreateModifierPayload;
  token?: string | null;
  deferred?: Deferred<unknown>;
}) => ({ type: PC.CREATE_MODIFIER_REQUEST, payload } as const);
export const createModifierDone = (payload: { error?: string | null }) =>
  ({ type: PC.CREATE_MODIFIER_SUCCESS, payload } as const);
export const updateModifierRequest = (payload: {
  data: UpdateModifierPayload;
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.UPDATE_MODIFIER_REQUEST, payload } as const);
export const updateModifierDone = (payload: { error?: string | null }) =>
  ({ type: PC.UPDATE_MODIFIER_SUCCESS, payload } as const);
export const deleteModifierRequest = (payload: {
  modifierId: string;
  locationId: string;
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.DELETE_MODIFIER_REQUEST, payload } as const);
export const deleteModifierDone = (payload: { modifierId?: string; error?: string | null }) =>
  ({ type: PC.DELETE_MODIFIER_SUCCESS, payload } as const);

export const modifiersAdd = (modifier: Omit<ModifierGroup, 'id'>) =>
  ({ type: PC.MODIFIERS_ADD, payload: modifier } as const);
export const modifiersUpdate = (payload: { id: string; updates: Partial<ModifierGroup> }) =>
  ({ type: PC.MODIFIERS_UPDATE, payload } as const);
export const modifiersRemove = (id: string) => ({ type: PC.MODIFIERS_REMOVE, payload: id } as const);

// --- Combos ---
export const combosSetEditing = (id: string | null) => ({ type: PC.COMBOS_SET_EDITING, payload: id } as const);
export const combosClearCache = () => ({ type: PC.COMBOS_CLEAR_CACHE } as const);
export const fetchCombosRequest = (payload: {
  locationId: string;
  token?: string | null;
  options?: FetchOptions;
  deferred?: Deferred;
}) => ({ type: PC.FETCH_COMBOS_REQUEST, payload } as const);
export const fetchCombosSuccess = (payload: { combos: Combo[]; locationId: string }) =>
  ({ type: PC.FETCH_COMBOS_SUCCESS, payload } as const);
export const fetchCombosFailure = (payload: { error: string }) =>
  ({ type: PC.FETCH_COMBOS_FAILURE, payload } as const);

export const createComboRequest = (payload: {
  data: CreateComboPayload;
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.CREATE_COMBO_REQUEST, payload } as const);
export const createComboDone = (payload: { error?: string | null }) =>
  ({ type: PC.CREATE_COMBO_SUCCESS, payload } as const);
export const updateComboRequest = (payload: {
  data: UpdateComboPayload;
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.UPDATE_COMBO_REQUEST, payload } as const);
export const updateComboDone = (payload: { error?: string | null }) =>
  ({ type: PC.UPDATE_COMBO_SUCCESS, payload } as const);
export const deleteComboRequest = (payload: {
  data: { comboId: string; locationId: string };
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.DELETE_COMBO_REQUEST, payload } as const);
export const deleteComboDone = (payload: { comboId: string; error?: string | null }) =>
  ({ type: PC.DELETE_COMBO_SUCCESS, payload } as const);

export const combosAdd = (combo: Omit<Combo, 'id'>) => ({ type: PC.COMBOS_ADD, payload: combo } as const);
export const combosUpdate = (payload: { id: string; updates: Partial<Combo> }) =>
  ({ type: PC.COMBOS_UPDATE, payload } as const);
export const combosRemove = (id: string) => ({ type: PC.COMBOS_REMOVE, payload: id } as const);

// --- Option sets ---
export const optionSetsSetEditing = (id: string | null) =>
  ({ type: PC.OPTION_SETS_SET_EDITING, payload: id } as const);
export const optionSetsClearCache = () => ({ type: PC.OPTION_SETS_CLEAR_CACHE } as const);
export const fetchOptionSetsRequest = (payload: {
  locationId: string;
  token?: string | null;
  options?: FetchOptions;
  deferred?: Deferred;
}) => ({ type: PC.FETCH_OPTION_SETS_REQUEST, payload } as const);
export const fetchOptionSetsSuccess = (payload: { optionSets: OptionSet[]; locationId: string }) =>
  ({ type: PC.FETCH_OPTION_SETS_SUCCESS, payload } as const);
export const fetchOptionSetsFailure = (payload: { error: string }) =>
  ({ type: PC.FETCH_OPTION_SETS_FAILURE, payload } as const);

export const createOptionSetRequest = (payload: {
  data: {
    locationId: string;
    name: string;
    displayName?: string;
    options: Array<{ name: string; price?: number; sortOrder?: number }>;
  };
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.CREATE_OPTION_SET_REQUEST, payload } as const);
export const createOptionSetDone = (payload: { error?: string | null }) =>
  ({ type: PC.CREATE_OPTION_SET_SUCCESS, payload } as const);
export const updateOptionSetRequest = (payload: {
  data: {
    templateId: string;
    locationId: string;
    name: string;
    displayName?: string;
    options: Array<{ optionId?: string; name: string; price?: number; sortOrder?: number }>;
  };
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.UPDATE_OPTION_SET_REQUEST, payload } as const);
export const updateOptionSetDone = (payload: { error?: string | null }) =>
  ({ type: PC.UPDATE_OPTION_SET_SUCCESS, payload } as const);
export const deleteOptionSetRequest = (payload: {
  data: { templateId: string; locationId: string };
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.DELETE_OPTION_SET_REQUEST, payload } as const);
export const deleteOptionSetDone = (payload: { templateId: string; error?: string | null }) =>
  ({ type: PC.DELETE_OPTION_SET_SUCCESS, payload } as const);

export const optionSetsAdd = (optionSet: Omit<OptionSet, 'id'>) =>
  ({ type: PC.OPTION_SETS_ADD, payload: optionSet } as const);
export const optionSetsUpdate = (payload: { id: string; updates: Partial<OptionSet> }) =>
  ({ type: PC.OPTION_SETS_UPDATE, payload } as const);
export const optionSetsRemove = (id: string) => ({ type: PC.OPTION_SETS_REMOVE, payload: id } as const);

// --- Kitchen ---
export const kitchenSetEditing = (id: string | null) => ({ type: PC.KITCHEN_SET_EDITING, payload: id } as const);
export const kitchenClearCache = () => ({ type: PC.KITCHEN_CLEAR_CACHE } as const);
export const fetchKitchenRequest = (payload: {
  locationId: string;
  token?: string | null;
  options?: FetchOptions;
  deferred?: Deferred;
}) => ({ type: PC.FETCH_KITCHEN_REQUEST, payload } as const);
export const fetchKitchenSuccess = (payload: { stations: KitchenStation[]; locationId: string }) =>
  ({ type: PC.FETCH_KITCHEN_SUCCESS, payload } as const);
export const fetchKitchenFailure = (payload: { error: string }) =>
  ({ type: PC.FETCH_KITCHEN_FAILURE, payload } as const);

export const createStationRequest = (payload: {
  data: {
    locationId: string;
    stationName: string;
    stationCode?: string;
    description?: string;
    itemIds?: string[];
    deleteFields?: { itemIds?: string[] };
  };
  token?: string | null;
  deferred?: Deferred<unknown>;
}) => ({ type: PC.CREATE_STATION_REQUEST, payload } as const);
export const createStationDone = (payload: { error?: string | null }) =>
  ({ type: PC.CREATE_STATION_SUCCESS, payload } as const);
export const updateStationRequest = (payload: {
  data: {
    id: string;
    locationId: string;
    stationName?: string;
    stationCode?: string;
    description?: string;
    itemIds?: string[];
    deleteFields?: { itemIds?: string[] };
  };
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.UPDATE_STATION_REQUEST, payload } as const);
export const updateStationDone = (payload: { error?: string | null }) =>
  ({ type: PC.UPDATE_STATION_SUCCESS, payload } as const);
export const deleteStationRequest = (payload: {
  data: { id: string; locationId: string };
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.DELETE_STATION_REQUEST, payload } as const);
export const deleteStationDone = (payload: { id: string; error?: string | null }) =>
  ({ type: PC.DELETE_STATION_SUCCESS, payload } as const);

export const kitchenAddStation = (station: Omit<KitchenStation, 'id'>) =>
  ({ type: PC.KITCHEN_ADD_STATION, payload: station } as const);
export const kitchenUpdateStation = (payload: { id: string; updates: Partial<KitchenStation> }) =>
  ({ type: PC.KITCHEN_UPDATE_STATION, payload } as const);
export const kitchenRemoveStation = (id: string) => ({ type: PC.KITCHEN_REMOVE_STATION, payload: id } as const);
export const kitchenAddPrinter = (printer: Omit<Printer, 'id'>) =>
  ({ type: PC.KITCHEN_ADD_PRINTER, payload: printer } as const);
export const kitchenUpdatePrinter = (payload: { id: string; updates: Partial<Printer> }) =>
  ({ type: PC.KITCHEN_UPDATE_PRINTER, payload } as const);
export const kitchenRemovePrinter = (id: string) => ({ type: PC.KITCHEN_REMOVE_PRINTER, payload: id } as const);

// --- Item attributes ---
export const fetchAttributesRequest = (payload: {
  locationId: string;
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.FETCH_ATTRIBUTES_REQUEST, payload } as const);
export const fetchAttributesSuccess = (payload: {
  tags: ItemAttribute[];
  ingredients: ItemAttribute[];
  diet: ItemAttribute[];
  allergens: ItemAttribute[];
  tax: TaxOption[];
  units: ItemAttribute[];
  revenueClass: ItemAttribute[];
  errors: Partial<Record<AttrType, string>>;
  locationId: string;
}) => ({ type: PC.FETCH_ATTRIBUTES_SUCCESS, payload } as const);
export const fetchAttributesFailure = (payload: { error: string }) =>
  ({ type: PC.FETCH_ATTRIBUTES_FAILURE, payload } as const);
export const clearAttributes = () => ({ type: PC.CLEAR_ATTRIBUTES } as const);

// --- Toast ---
export const toastAdd = (payload: Omit<ToastItem, 'id'> & { id?: string }) =>
  ({ type: PC.TOAST_ADD, payload } as const);
export const toastRemove = (id: string) => ({ type: PC.TOAST_REMOVE, payload: id } as const);

// --- Set menus ---
export const setMenusSetEditing = (id: string | null) => ({ type: PC.SET_MENUS_SET_EDITING, payload: id } as const);
export const setMenusAdd = (menu: Omit<SetMenu, 'id'>) => ({ type: PC.SET_MENUS_ADD, payload: menu } as const);
export const setMenusUpdate = (payload: { id: string; updates: Partial<SetMenu> }) =>
  ({ type: PC.SET_MENUS_UPDATE, payload } as const);
export const setMenusRemove = (id: string) => ({ type: PC.SET_MENUS_REMOVE, payload: id } as const);

// --- Menu prices ---
export const menuPricesSet = (price: MenuItemPrice) => ({ type: PC.MENU_PRICES_SET, payload: price } as const);
export const menuPricesRemove = (payload: { menuId: string; itemId: string; variationId?: string }) =>
  ({ type: PC.MENU_PRICES_REMOVE, payload } as const);
export const menuPricesRemoveAllMenu = (menuId: string) =>
  ({ type: PC.MENU_PRICES_REMOVE_ALL_MENU, payload: menuId } as const);
export const menuPricesRemoveAllItem = (itemId: string) =>
  ({ type: PC.MENU_PRICES_REMOVE_ALL_ITEM, payload: itemId } as const);
export type BulkAdjustPayload = {
  menuId: string;
  itemIds: string[];
  basePrices: Record<string, number>;
  adj: {
    mode: 'percentage' | 'flat' | 'fixed';
    value: number;
    rounding?: 'none' | 'whole' | '49_99' | '50_100';
  };
};
export const menuPricesBulkAdjust = (payload: BulkAdjustPayload) =>
  ({ type: PC.MENU_PRICES_BULK_ADJUST, payload } as const);

// --- Dietary colors ---
export const dietaryColorsUpdate = (payload: { tagName: string; updates: Partial<DietaryTypeColor> }) =>
  ({ type: PC.DIETARY_COLORS_UPDATE, payload } as const);

// --- Sync trigger ---
export const triggerSyncRequest = (payload: {
  locationId: string;
  userId: string;
  syncHistoryId?: string;
  token?: string | null;
  deferred?: Deferred;
}) => ({ type: PC.TRIGGER_SYNC_REQUEST, payload } as const);
export const triggerSyncSuccess = () => ({ type: PC.TRIGGER_SYNC_SUCCESS } as const);
export const triggerSyncFailure = (payload: { error: string; errorKind: SyncErrorKind }) =>
  ({ type: PC.TRIGGER_SYNC_FAILURE, payload } as const);

// --- Global cache invalidation ---
export const invalidateFetchCache = () => ({ type: PC.INVALIDATE_FETCH_CACHE } as const);

// --- Restaurant details ---
export const restaurantDetailsSet = (details: Record<string, unknown> | null) =>
  ({ type: PC.RESTAURANT_DETAILS_SET, payload: details } as const);
export const restaurantDetailsClear = () => ({ type: PC.RESTAURANT_DETAILS_CLEAR } as const);

// --- Module list bridge ---
export const fetchModuleListRequest = (payload: {
  moduleType: 'ITEM' | 'CATEGORY';
  query: { location_id: string };
  token?: string | null;
  deferred?: Deferred<ModuleListItem[]>;
}) => ({ type: PC.FETCH_MODULE_LIST_REQUEST, payload } as const);
export const fetchModuleListDone = (payload: { response?: ModuleListItem[]; error?: string | null }) =>
  ({ type: PC.FETCH_MODULE_LIST_SUCCESS, payload } as const);
