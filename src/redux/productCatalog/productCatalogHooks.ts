/**
 * Product catalog hooks — same API as former Zustand stores; backed by Redux + saga.
 */
import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks';
import * as A from './productCatalogActions';
import type { BulkAdjustPayload } from './productCatalogActions';
import type { FetchOptions } from './productCatalogTypes';
import { markProductCatalogSyncNeeded } from '../../components/productCatalog/store/syncNeeded';
import type { MenuItem, Category, Menu, Session, ModifierGroup, Combo, OptionSet, KitchenStation, Printer, SetMenu, MenuItemPrice, DietaryTypeColor } from '../../components/productCatalog/data/types';
import type { MenuStatus } from '../../components/productCatalog/data/types';
import type { CreateCategoryPayload, UpdateCategoryPayload } from '../../services/categoryCatalogApi';
import type { ModuleListItem } from '../../services/categoryCatalogApi';
import type { CreateModifierPayload, UpdateModifierPayload } from '../../services/modifierCatalogApi';
import type { CreateComboPayload, UpdateComboPayload } from '../../services/comboCatalogApi';
import type { TaxOption } from './productCatalogTypes';

function deferredPromise<T = void>(): { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void; reject: (e: Error) => void } {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function useItemsStore() {
  const dispatch = useAppDispatch();
  const slice = useAppSelector((s) => s.productCatalog.items);
  const fetchItems = useCallback((locationId: string, token?: string | null, options?: FetchOptions) => {
    const d = deferredPromise();
    dispatch(A.fetchItemsRequest({ locationId, token, options, deferred: { resolve: d.resolve, reject: d.reject } }));
    return d.promise;
  }, [dispatch]);
  return useMemo(
    () => ({
      ...slice,
      setEditingItemId: (id: string | null) => dispatch(A.itemsSetEditing(id)),
      setVisibleColumns: (columns: string[]) => dispatch(A.itemsSetVisibleColumns(columns)),
      clearItemsCache: () => dispatch(A.itemsClearCache()),
      fetchItems,
      createItemOnServer: async (payload: unknown, token?: string | null) => {
        const d = deferredPromise<unknown>();
        dispatch(A.createItemRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      updateItemOnServer: async (payload: unknown, token?: string | null) => {
        const d = deferredPromise();
        dispatch(A.updateItemRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      deleteItemOnServer: async (payload: { itemId: string; locationId: string }, token?: string | null) => {
        const d = deferredPromise();
        dispatch(A.deleteItemRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      bulkDeleteItemsOnServer: async (payload: { locationId: string; itemIds: string[] }, token?: string | null) => {
        const d = deferredPromise();
        dispatch(A.bulkDeleteItemsRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      validateItemCodeOnServer: async (locationId: string, itemCode: string, token?: string | null) => {
        const d = deferredPromise<unknown>();
        dispatch(A.validateItemCodeRequest({ locationId, itemCode, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      uploadItemImageOnServer: async (
        payload: { file?: Blob; itemId?: string; sortOrder?: number; existingImageId?: string },
        token?: string | null,
      ) => {
        const d = deferredPromise<unknown>();
        dispatch(A.uploadItemImageRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      removeItemImageOnServer: async (imageId: string, token?: string | null) => {
        const d = deferredPromise<unknown>();
        dispatch(A.removeItemImageRequest({ imageId, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      addItem: (item: Omit<MenuItem, 'id'>) => {
        dispatch(A.itemsAdd(item));
        markProductCatalogSyncNeeded();
      },
      updateItem: (id: string, updates: Partial<MenuItem>) => {
        dispatch(A.itemsUpdate({ id, updates }));
        markProductCatalogSyncNeeded();
      },
      removeItem: (id: string) => {
        dispatch(A.itemsRemove(id));
        markProductCatalogSyncNeeded();
      },
      toggleStatus: (id: string) => {
        dispatch(A.itemsToggleStatus(id));
        markProductCatalogSyncNeeded();
      },
      reorderItemsInCategory: (categoryId: string, orderedIds: string[]) => {
        dispatch(A.itemsReorderInCategory({ categoryId, orderedIds }));
        markProductCatalogSyncNeeded();
      },
    }),
    [dispatch, slice, fetchItems],
  );
}

export function useCategoriesStore() {
  const dispatch = useAppDispatch();
  const slice = useAppSelector((s) => s.productCatalog.categories);
  const fetchCategories = useCallback((locationId: string, token?: string | null, options?: FetchOptions) => {
    const d = deferredPromise();
    dispatch(A.fetchCategoriesRequest({ locationId, token, options, deferred: { resolve: d.resolve, reject: d.reject } }));
    return d.promise;
  }, [dispatch]);
  const fetchModuleListOnServer = useCallback(
    (moduleType: 'ITEM' | 'CATEGORY', query: { location_id: string }, token?: string | null) => {
      const d = deferredPromise<ModuleListItem[]>();
      dispatch(A.fetchModuleListRequest({ moduleType, query, token, deferred: { resolve: d.resolve, reject: d.reject } }));
      return d.promise;
    },
    [dispatch],
  );
  return useMemo(
    () => ({
      ...slice,
      setEditingCategoryId: (id: string | null) => dispatch(A.categoriesSetEditing(id)),
      clearCategoriesCache: () => dispatch(A.categoriesClearCache()),
      fetchCategories,
      fetchModuleListOnServer,
      primeFromMappedCategories: (categories: Category[], locationId: string) => {
        dispatch(A.categoriesPrime({ categories, locationId }));
      },
      createCategoryOnServer: async (payload: CreateCategoryPayload, imageFile?: File | null, token?: string | null) => {
        const d = deferredPromise<string>();
        dispatch(A.createCategoryRequest({ data: payload, imageFile, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      updateCategoryOnServer: async (payload: UpdateCategoryPayload, imageFile?: File | null, token?: string | null) => {
        const d = deferredPromise();
        dispatch(A.updateCategoryRequest({ data: payload, imageFile, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      deleteCategoryOnServer: async (categoryId: string, locationId: string, token?: string | null) => {
        const d = deferredPromise();
        dispatch(A.deleteCategoryRequest({ categoryId, locationId, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      sortCategoriesOnServer: async (locationId: string, token?: string | null) => {
        const d = deferredPromise();
        dispatch(A.sortCategoriesRequest({ locationId, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      addCategory: (category: Omit<Category, 'id'>) => {
        dispatch(A.categoriesAdd(category));
        markProductCatalogSyncNeeded();
      },
      updateCategory: (id: string, updates: Partial<Category>) => {
        dispatch(A.categoriesUpdate({ id, updates }));
        markProductCatalogSyncNeeded();
      },
      removeCategory: (id: string) => {
        dispatch(A.categoriesRemove(id));
        markProductCatalogSyncNeeded();
      },
      toggleVisibility: (id: string) => {
        dispatch(A.categoriesToggleVisibility(id));
        markProductCatalogSyncNeeded();
      },
      reorderSiblings: (parentCategoryId: string | undefined, orderedIds: string[]) => {
        dispatch(A.categoriesReorderSiblings({ parentCategoryId, orderedIds }));
        markProductCatalogSyncNeeded();
      },
    }),
    [dispatch, slice, fetchCategories, fetchModuleListOnServer],
  );
}

export function useMenusStore() {
  const dispatch = useAppDispatch();
  const slice = useAppSelector((s) => s.productCatalog.menus);
  const fetchMenus = useCallback((locationId: string, token?: string | null, options?: FetchOptions) => {
    const d = deferredPromise();
    dispatch(A.fetchMenusRequest({ locationId, token, options, deferred: { resolve: d.resolve, reject: d.reject } }));
    return d.promise;
  }, [dispatch]);
  return useMemo(
    () => ({
      ...slice,
      setEditingMenuId: (id: string | null) => dispatch(A.menusSetEditing(id)),
      clearMenusCache: () => dispatch(A.menusClearCache()),
      fetchMenus,
      addMenu: (menu: Omit<Menu, 'id'>) => {
        dispatch(A.menusAdd(menu));
        markProductCatalogSyncNeeded();
      },
      updateMenu: (id: string, updates: Partial<Menu>) => {
        dispatch(A.menusUpdate({ id, updates }));
        markProductCatalogSyncNeeded();
      },
      removeMenu: (id: string) => {
        dispatch(A.menusRemove(id));
        markProductCatalogSyncNeeded();
      },
      createMenuOnServer: async (
        payload: {
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
        },
        token?: string | null,
      ) => {
        const d = deferredPromise();
        dispatch(A.createMenuRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      updateMenuOnServer: async (
        payload: {
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
        },
        token?: string | null,
      ) => {
        const d = deferredPromise();
        dispatch(A.updateMenuRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      deleteMenuOnServer: async (payload: { categoryGroupId: string; locationId: string }, token?: string | null) => {
        const d = deferredPromise();
        dispatch(A.deleteMenuRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
    }),
    [dispatch, slice, fetchMenus],
  );
}

export function useSessionsStore() {
  const dispatch = useAppDispatch();
  const slice = useAppSelector((s) => s.productCatalog.sessions);
  const fetchSessions = useCallback((locationId: string, token?: string | null, options?: FetchOptions) => {
    const d = deferredPromise();
    dispatch(A.fetchSessionsRequest({ locationId, token, options, deferred: { resolve: d.resolve, reject: d.reject } }));
    return d.promise;
  }, [dispatch]);
  return useMemo(
    () => ({
      ...slice,
      setEditingSessionId: (id: string | null) => dispatch(A.sessionsSetEditing(id)),
      clearSessionsCache: () => dispatch(A.sessionsClearCache()),
      fetchSessions,
      createSessionOnServer: async (
        payload: unknown,
        token?: string | null,
      ): Promise<unknown> => {
        const d = deferredPromise<unknown>();
        dispatch(A.createSessionRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      updateSessionOnServer: async (
        payload: unknown,
        token?: string | null,
      ): Promise<unknown> => {
        const d = deferredPromise<unknown>();
        dispatch(A.updateSessionRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      deleteSessionOnServer: async (payload: { sessionId: string; locationId: string }, token?: string | null) => {
        const d = deferredPromise();
        dispatch(A.deleteSessionRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      addSession: (session: Omit<Session, 'id'>) => {
        dispatch(A.sessionsAdd(session));
        markProductCatalogSyncNeeded();
      },
      updateSession: (id: string, updates: Partial<Session>) => {
        dispatch(A.sessionsUpdate({ id, updates }));
        markProductCatalogSyncNeeded();
      },
      removeSession: (id: string) => {
        dispatch(A.sessionsRemove(id));
        markProductCatalogSyncNeeded();
      },
    }),
    [dispatch, slice, fetchSessions],
  );
}

export function useModifiersStore() {
  const dispatch = useAppDispatch();
  const slice = useAppSelector((s) => s.productCatalog.modifiers);
  const fetchModifiers = useCallback((locationId: string, token?: string | null, options?: FetchOptions) => {
    const d = deferredPromise();
    dispatch(A.fetchModifiersRequest({ locationId, token, options, deferred: { resolve: d.resolve, reject: d.reject } }));
    return d.promise;
  }, [dispatch]);
  return useMemo(
    () => ({
      ...slice,
      setEditingModifierId: (id: string | null) => dispatch(A.modifiersSetEditing(id)),
      clearModifiersCache: () => dispatch(A.modifiersClearCache()),
      fetchModifiers,
      createModifierOnServer: async (payload: CreateModifierPayload, token?: string | null): Promise<unknown> => {
        const d = deferredPromise<unknown>();
        dispatch(A.createModifierRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      updateModifierOnServer: async (payload: UpdateModifierPayload, token?: string | null) => {
        const d = deferredPromise();
        dispatch(A.updateModifierRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      deleteModifierOnServer: async (modifierId: string, locationId: string, token?: string | null) => {
        const d = deferredPromise();
        dispatch(A.deleteModifierRequest({ modifierId, locationId, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      addModifier: (modifier: Omit<ModifierGroup, 'id'>) => {
        dispatch(A.modifiersAdd(modifier));
        markProductCatalogSyncNeeded();
      },
      updateModifier: (id: string, updates: Partial<ModifierGroup>) => {
        dispatch(A.modifiersUpdate({ id, updates }));
        markProductCatalogSyncNeeded();
      },
      removeModifier: (id: string) => {
        dispatch(A.modifiersRemove(id));
        markProductCatalogSyncNeeded();
      },
    }),
    [dispatch, slice, fetchModifiers],
  );
}

export function useCombosStore() {
  const dispatch = useAppDispatch();
  const slice = useAppSelector((s) => s.productCatalog.combos);
  const fetchCombos = useCallback((locationId: string, token?: string | null, options?: FetchOptions) => {
    const d = deferredPromise();
    dispatch(A.fetchCombosRequest({ locationId, token, options, deferred: { resolve: d.resolve, reject: d.reject } }));
    return d.promise;
  }, [dispatch]);
  return useMemo(
    () => ({
      ...slice,
      setEditingComboId: (id: string | null) => dispatch(A.combosSetEditing(id)),
      clearCombosCache: () => dispatch(A.combosClearCache()),
      fetchCombos,
      addCombo: (combo: Omit<Combo, 'id'>) => {
        dispatch(A.combosAdd(combo));
        markProductCatalogSyncNeeded();
      },
      updateCombo: (id: string, updates: Partial<Combo>) => {
        dispatch(A.combosUpdate({ id, updates }));
        markProductCatalogSyncNeeded();
      },
      removeCombo: (id: string) => {
        dispatch(A.combosRemove(id));
        markProductCatalogSyncNeeded();
      },
      createComboOnServer: async (payload: CreateComboPayload, token?: string | null) => {
        const d = deferredPromise();
        dispatch(A.createComboRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      updateComboOnServer: async (payload: UpdateComboPayload, token?: string | null) => {
        const d = deferredPromise();
        dispatch(A.updateComboRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      deleteComboOnServer: async (payload: { comboId: string; locationId: string }, token?: string | null) => {
        const d = deferredPromise();
        dispatch(A.deleteComboRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
    }),
    [dispatch, slice, fetchCombos],
  );
}

const useOptionSetsStoreBase = () => {
  const dispatch = useAppDispatch();
  const slice = useAppSelector((s) => s.productCatalog.optionSets);
  const fetchOptionSets = useCallback((locationId: string, token?: string | null, options?: FetchOptions) => {
    const d = deferredPromise();
    dispatch(A.fetchOptionSetsRequest({ locationId, token, options, deferred: { resolve: d.resolve, reject: d.reject } }));
    return d.promise;
  }, [dispatch]);
  return useMemo(
    () => ({
      optionSets: slice.optionSets,
      loading: slice.loading,
      error: slice.error,
      loadedLocationId: slice.loadedLocationId,
      editingOptionSetId: slice.editingOptionSetId,
      setEditingOptionSetId: (id: string | null) => dispatch(A.optionSetsSetEditing(id)),
      clearOptionSetsCache: () => dispatch(A.optionSetsClearCache()),
      fetchOptionSets,
      addOptionSet: (optionSet: Omit<OptionSet, 'id'>) => {
        dispatch(A.optionSetsAdd(optionSet));
        markProductCatalogSyncNeeded();
      },
      updateOptionSet: (id: string, updates: Partial<OptionSet>) => {
        dispatch(A.optionSetsUpdate({ id, updates }));
        markProductCatalogSyncNeeded();
      },
      removeOptionSet: (id: string) => {
        dispatch(A.optionSetsRemove(id));
        markProductCatalogSyncNeeded();
      },
      createOptionSetOnServer: async (
        payload: {
          locationId: string;
          name: string;
          displayName?: string;
          options: Array<{ name: string; price?: number; sortOrder?: number }>;
        },
        token?: string | null,
      ) => {
        const d = deferredPromise();
        dispatch(A.createOptionSetRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      updateOptionSetOnServer: async (
        payload: {
          templateId: string;
          locationId: string;
          name: string;
          displayName?: string;
          options: Array<{ optionId?: string; name: string; price?: number; sortOrder?: number }>;
        },
        token?: string | null,
      ) => {
        const d = deferredPromise();
        dispatch(A.updateOptionSetRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      deleteOptionSetOnServer: async (payload: { templateId: string; locationId: string }, token?: string | null) => {
        const d = deferredPromise();
        dispatch(A.deleteOptionSetRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
    }),
    [dispatch, slice, fetchOptionSets],
  );
};

export const useOptionSetsStore = useOptionSetsStoreBase;

export function useVariationSetsStore() {
  const store = useOptionSetsStoreBase();
  return {
    variationSets: store.optionSets,
    loading: store.loading,
    error: store.error,
    editingOptionSetId: store.editingOptionSetId,
    setEditingVariationSetId: store.setEditingOptionSetId,
    clearVariationSetsCache: store.clearOptionSetsCache,
    fetchVariationSets: store.fetchOptionSets,
    addVariationSet: store.addOptionSet,
    updateVariationSet: store.updateOptionSet,
    removeVariationSet: store.removeOptionSet,
    createVariationSetOnServer: store.createOptionSetOnServer,
    updateVariationSetOnServer: store.updateOptionSetOnServer,
    deleteVariationSetOnServer: store.deleteOptionSetOnServer,
  };
}

export function useKitchenStationsStore() {
  const dispatch = useAppDispatch();
  const slice = useAppSelector((s) => s.productCatalog.kitchenStations);
  const fetchStations = useCallback((locationId: string, token?: string | null, options?: FetchOptions) => {
    const d = deferredPromise();
    dispatch(A.fetchKitchenRequest({ locationId, token, options, deferred: { resolve: d.resolve, reject: d.reject } }));
    return d.promise;
  }, [dispatch]);
  return useMemo(
    () => ({
      ...slice,
      setEditingStationId: (id: string | null) => dispatch(A.kitchenSetEditing(id)),
      clearStationsCache: () => dispatch(A.kitchenClearCache()),
      fetchStations,
      createStationOnServer: async (
        payload: {
          locationId: string;
          stationName: string;
          stationCode?: string;
          description?: string;
          itemIds?: string[];
          deleteFields?: { itemIds?: string[] };
        },
        token?: string | null,
      ): Promise<unknown> => {
        const d = deferredPromise<unknown>();
        dispatch(A.createStationRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      updateStationOnServer: async (
        payload: {
          id: string;
          locationId: string;
          stationName?: string;
          stationCode?: string;
          description?: string;
          itemIds?: string[];
          deleteFields?: { itemIds?: string[] };
        },
        token?: string | null,
      ) => {
        const d = deferredPromise();
        dispatch(A.updateStationRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      deleteStationOnServer: async (payload: { id: string; locationId: string }, token?: string | null) => {
        const d = deferredPromise();
        dispatch(A.deleteStationRequest({ data: payload, token, deferred: { resolve: d.resolve, reject: d.reject } }));
        return d.promise;
      },
      addStation: (station: Omit<KitchenStation, 'id'>) => {
        dispatch(A.kitchenAddStation(station));
        markProductCatalogSyncNeeded();
      },
      updateStation: (id: string, updates: Partial<KitchenStation>) => {
        dispatch(A.kitchenUpdateStation({ id, updates }));
        markProductCatalogSyncNeeded();
      },
      removeStation: (id: string) => {
        dispatch(A.kitchenRemoveStation(id));
        markProductCatalogSyncNeeded();
      },
      addPrinter: (printer: Omit<Printer, 'id'>) => {
        dispatch(A.kitchenAddPrinter(printer));
        markProductCatalogSyncNeeded();
      },
      updatePrinter: (id: string, updates: Partial<Printer>) => {
        dispatch(A.kitchenUpdatePrinter({ id, updates }));
        markProductCatalogSyncNeeded();
      },
      removePrinter: (id: string) => {
        dispatch(A.kitchenRemovePrinter(id));
        markProductCatalogSyncNeeded();
      },
    }),
    [dispatch, slice, fetchStations],
  );
}

export function useItemAttributesStore() {
  const dispatch = useAppDispatch();
  const slice = useAppSelector((s) => s.productCatalog.itemAttributes);
  const fetchAttributes = useCallback((locationId: string, token?: string | null) => {
    const d = deferredPromise();
    dispatch(A.fetchAttributesRequest({ locationId, token, deferred: { resolve: d.resolve, reject: d.reject } }));
    return d.promise;
  }, [dispatch]);
  return useMemo(
    () => ({
      ...slice,
      fetchAttributes,
      clearAttributes: () => dispatch(A.clearAttributes()),
    }),
    [dispatch, slice, fetchAttributes],
  );
}

export function useToastStore() {
  const dispatch = useAppDispatch();
  const slice = useAppSelector((s) => s.productCatalog.toast);
  const addToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      dispatch(A.toastAdd({ id, message, type }));
      setTimeout(() => {
        dispatch(A.toastRemove(id));
      }, 3000);
    },
    [dispatch],
  );
  const removeToast = useCallback((id: string) => dispatch(A.toastRemove(id)), [dispatch]);
  return useMemo(() => ({ ...slice, addToast, removeToast }), [slice, addToast, removeToast]);
}

/**
 * Toast actions without subscribing to toast slice state.
 * Use this in effect-driven hooks to avoid rerender feedback loops.
 */
export function useToastActions() {
  const dispatch = useAppDispatch();
  const addToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      dispatch(A.toastAdd({ id, message, type }));
      setTimeout(() => {
        dispatch(A.toastRemove(id));
      }, 3000);
    },
    [dispatch],
  );
  const removeToast = useCallback((id: string) => dispatch(A.toastRemove(id)), [dispatch]);
  return useMemo(() => ({ addToast, removeToast }), [addToast, removeToast]);
}

export function useSetMenusStore() {
  const dispatch = useAppDispatch();
  const slice = useAppSelector((s) => s.productCatalog.setMenus);
  return useMemo(
    () => ({
      ...slice,
      setEditingSetMenuId: (id: string | null) => dispatch(A.setMenusSetEditing(id)),
      addSetMenu: (menu: Omit<SetMenu, 'id'>) => {
        dispatch(A.setMenusAdd(menu));
        markProductCatalogSyncNeeded();
      },
      updateSetMenu: (id: string, updates: Partial<SetMenu>) => {
        dispatch(A.setMenusUpdate({ id, updates }));
        markProductCatalogSyncNeeded();
      },
      removeSetMenu: (id: string) => {
        dispatch(A.setMenusRemove(id));
        markProductCatalogSyncNeeded();
      },
    }),
    [dispatch, slice],
  );
}

export function useMenuPricesStore() {
  const dispatch = useAppDispatch();
  const menuPrices = useAppSelector((s) => s.productCatalog.menuPrices.menuPrices);
  return useMemo(
    () => ({
      menuPrices,
      setMenuPrice: (price: MenuItemPrice) => {
        dispatch(A.menuPricesSet(price));
        markProductCatalogSyncNeeded();
      },
      removeMenuPrice: (menuId: string, itemId: string, variationId?: string) => {
        dispatch(A.menuPricesRemove({ menuId, itemId, variationId }));
        markProductCatalogSyncNeeded();
      },
      removeAllForMenu: (menuId: string) => {
        dispatch(A.menuPricesRemoveAllMenu(menuId));
        markProductCatalogSyncNeeded();
      },
      removeAllForItem: (itemId: string) => {
        dispatch(A.menuPricesRemoveAllItem(itemId));
        markProductCatalogSyncNeeded();
      },
      getForItem: (itemId: string) => menuPrices.filter((p) => p.itemId === itemId),
      getForMenu: (menuId: string) => menuPrices.filter((p) => p.menuId === menuId),
      getPrice: (menuId: string, itemId: string, variationId?: string) =>
        menuPrices.find(
          (p) => p.menuId === menuId && p.itemId === itemId && (p.variationId ?? '') === (variationId ?? ''),
        ),
      bulkAdjust: (
        menuId: string,
        itemIds: string[],
        basePrices: Record<string, number>,
        adj: BulkAdjustPayload['adj'],
      ) => {
        dispatch(A.menuPricesBulkAdjust({ menuId, itemIds, basePrices, adj }));
        markProductCatalogSyncNeeded();
      },
    }),
    [dispatch, menuPrices],
  );
}

export function useDietaryColorsStore() {
  const dispatch = useAppDispatch();
  const slice = useAppSelector((s) => s.productCatalog.dietaryColors);
  return useMemo(
    () => ({
      ...slice,
      updateColor: (tagName: string, updates: Partial<DietaryTypeColor>) => {
        dispatch(A.dietaryColorsUpdate({ tagName, updates }));
      },
      getColorForTag: (tagName: string) => slice.colors.find((c) => c.tagName === tagName)?.colorHex,
    }),
    [dispatch, slice],
  );
}

export function useRestaurantDetailsStore() {
  const dispatch = useAppDispatch();
  const slice = useAppSelector((s) => s.productCatalog.restaurantDetails);
  return useMemo(
    () => ({
      ...slice,
      setRestaurantDetails: (details: Record<string, unknown> | null) => dispatch(A.restaurantDetailsSet(details)),
      clearRestaurantDetails: () => dispatch(A.restaurantDetailsClear()),
    }),
    [dispatch, slice],
  );
}

/** Re-export mapper types for consumers that imported TaxOption from old store */
export type { TaxOption };
