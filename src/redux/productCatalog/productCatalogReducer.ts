import { PC } from './productCatalogConstants';
import type { ProductCatalogState } from './productCatalogTypes';
import type { ProductCatalogAction } from './productCatalogActions';
import { itemNextStatus } from '../../components/productCatalog/mappers/itemsMapper';
import type { MenuItemPrice, OrderType } from '../../components/productCatalog/data/types';
import { mockPrinters } from '../../components/productCatalog/data/mockCatalog';

const DEFAULT_DIETARY_COLORS: ProductCatalogState['dietaryColors']['colors'] = [
  { tagName: 'Vegetarian', colorHex: '#2E7D32', showOnPos: true, showOnListing: true },
  { tagName: 'Vegan', colorHex: '#1B5E20', showOnPos: true, showOnListing: true },
  { tagName: 'Halal', colorHex: '#00897B', showOnPos: true, showOnListing: true },
  { tagName: 'Gluten-Free', colorHex: '#B07A2A', showOnPos: true, showOnListing: true },
  { tagName: 'Keto', colorHex: '#6E4F5E', showOnPos: true, showOnListing: true },
];

const defaultAttrLoading = { tags: false, ingredients: false, diet: false, allergens: false, tax: false, units: false, revenueClass: false };
const defaultAttrError = { tags: null, ingredients: null, diet: null, allergens: null, tax: null, units: null, revenueClass: null };

export const initialProductCatalogState: ProductCatalogState = {
  items: {
    items: [],
    loading: false,
    error: null,
    loadedLocationId: null,
    editingItemId: null,
    visibleColumns: ['selection', 'item', 'code', 'price', 'actions'],
  },
  categories: {
    categories: [],
    loading: false,
    error: null,
    saving: false,
    loadedLocationId: null,
    editingCategoryId: null,
  },
  menus: {
    menus: [],
    loading: false,
    error: null,
    loadedLocationId: null,
    editingMenuId: null,
  },
  sessions: {
    sessions: [],
    loading: false,
    error: null,
    loadedLocationId: null,
    editingSessionId: null,
  },
  modifiers: {
    modifiers: [],
    loading: false,
    error: null,
    saving: false,
    loadedLocationId: null,
    editingModifierId: null,
  },
  combos: {
    combos: [],
    loading: false,
    error: null,
    loadedLocationId: null,
    editingComboId: null,
  },
  optionSets: {
    optionSets: [],
    loading: false,
    error: null,
    loadedLocationId: null,
    editingOptionSetId: null,
  },
  kitchenStations: {
    stations: [],
    printers: mockPrinters,
    loading: false,
    error: null,
    loadedLocationId: null,
    editingStationId: null,
  },
  itemAttributes: {
    tags: [],
    ingredients: [],
    diet: [],
    allergens: [],
    tax: [],
    units: [],
    revenueClass: [],
    loading: { ...defaultAttrLoading },
    error: { ...defaultAttrError },
    loadedLocationId: null,
  },
  toast: { toasts: [] },
  setMenus: { setMenus: [], editingSetMenuId: null },
  menuPrices: { menuPrices: [] },
  dietaryColors: { colors: DEFAULT_DIETARY_COLORS },
  syncTrigger: { loading: false, error: null, errorKind: null },
  restaurantDetails: { details: null },
};

function applyRounding(price: number, rounding: string): number {
  if (rounding === 'whole') return Math.round(price);
  if (rounding === '49_99') return Math.floor(price) + (price % 1 >= 0.5 ? 0.99 : 0.49);
  if (rounding === '50_100') return Math.ceil(price * 2) / 2;
  return Math.round(price * 100) / 100;
}

export function productCatalogReducer(
  state: ProductCatalogState = initialProductCatalogState,
  action: ProductCatalogAction,
): ProductCatalogState {
  switch (action.type) {
    case PC.ITEMS_SET_EDITING:
      return { ...state, items: { ...state.items, editingItemId: action.payload } };
    case PC.ITEMS_SET_VISIBLE_COLUMNS:
      return { ...state, items: { ...state.items, visibleColumns: action.payload } };
    case PC.INVALIDATE_FETCH_CACHE:
      return {
        ...state,
        items: { ...state.items, loadedLocationId: null },
        categories: { ...state.categories, loadedLocationId: null },
        menus: { ...state.menus, loadedLocationId: null },
        sessions: { ...state.sessions, loadedLocationId: null },
        modifiers: { ...state.modifiers, loadedLocationId: null },
        combos: { ...state.combos, loadedLocationId: null },
        optionSets: { ...state.optionSets, loadedLocationId: null },
        kitchenStations: { ...state.kitchenStations, loadedLocationId: null },
        itemAttributes: { ...state.itemAttributes, loadedLocationId: null },
      };
    case PC.ITEMS_CLEAR_CACHE:
      return {
        ...state,
        items: {
          ...state.items,
          items: [],
          loadedLocationId: null,
          error: null,
        },
      };
    case PC.FETCH_ITEMS_REQUEST:
      return { ...state, items: { ...state.items, loading: true, error: null } };
    case PC.FETCH_ITEMS_SUCCESS:
      return {
        ...state,
        items: {
          ...state.items,
          items: action.payload.items,
          loading: false,
          error: null,
          loadedLocationId: action.payload.locationId,
        },
      };
    case PC.FETCH_ITEMS_FAILURE:
      return {
        ...state,
        items: {
          ...state.items,
          loading: false,
          error: action.payload.error,
          items: [],
          loadedLocationId: null,
        },
      };
    case PC.ITEMS_ADD:
      return {
        ...state,
        items: {
          ...state.items,
          items: [...state.items.items, { ...action.payload, id: `new-${Date.now()}` }],
        },
      };
    case PC.ITEMS_UPDATE:
      return {
        ...state,
        items: {
          ...state.items,
          items: state.items.items.map((i) =>
            i.id === action.payload.id ? { ...i, ...action.payload.updates } : i,
          ),
        },
      };
    case PC.ITEMS_REMOVE:
      return {
        ...state,
        items: { ...state.items, items: state.items.items.filter((i) => i.id !== action.payload) },
      };
    case PC.ITEMS_TOGGLE_STATUS:
      return {
        ...state,
        items: {
          ...state.items,
          items: state.items.items.map((i) =>
            i.id === action.payload ? { ...i, status: itemNextStatus[i.status] } : i,
          ),
        },
      };
    case PC.ITEMS_REORDER_IN_CATEGORY: {
      const { categoryId, orderedIds } = action.payload;
      return {
        ...state,
        items: {
          ...state.items,
          items: state.items.items.map((item) => {
            const pos = orderedIds.indexOf(item.id);
            if (pos < 0) return item;
            return {
              ...item,
              categorySortPositions: {
                ...(item.categorySortPositions ?? {}),
                [categoryId]: pos,
              },
            };
          }),
        },
      };
    }

    case PC.CATEGORIES_SET_EDITING:
      return { ...state, categories: { ...state.categories, editingCategoryId: action.payload } };
    case PC.CATEGORIES_CLEAR_CACHE:
      return {
        ...state,
        categories: {
          ...state.categories,
          categories: [],
          loadedLocationId: null,
          error: null,
        },
      };
    case PC.FETCH_CATEGORIES_REQUEST:
      return { ...state, categories: { ...state.categories, loading: true, error: null } };
    case PC.FETCH_CATEGORIES_SUCCESS:
      return {
        ...state,
        categories: {
          ...state.categories,
          categories: action.payload.categories,
          loading: false,
          error: null,
          loadedLocationId: action.payload.locationId,
        },
      };
    case PC.FETCH_CATEGORIES_FAILURE:
      return {
        ...state,
        categories: {
          ...state.categories,
          loading: false,
          error: action.payload.error,
          categories: [],
          loadedLocationId: null,
        },
      };
    case PC.CATEGORIES_PRIME:
      return {
        ...state,
        categories: {
          ...state.categories,
          categories: action.payload.categories,
          loadedLocationId: action.payload.locationId,
          loading: false,
          error: null,
        },
      };
    case PC.CATEGORIES_SET_LOADING:
      return {
        ...state,
        categories: {
          ...state.categories,
          loading: action.payload.loading,
          error: action.payload.error ?? state.categories.error,
        },
      };
    case PC.CREATE_CATEGORY_REQUEST:
    case PC.UPDATE_CATEGORY_REQUEST:
    case PC.DELETE_CATEGORY_REQUEST:
    case PC.SORT_CATEGORIES_REQUEST:
      return { ...state, categories: { ...state.categories, saving: true } };
    case PC.CREATE_CATEGORY_SUCCESS:
      return {
        ...state,
        categories: {
          ...state.categories,
          saving: action.payload.saving,
          loadedLocationId: action.payload.error ? state.categories.loadedLocationId : null,
        },
      };
    case PC.UPDATE_CATEGORY_SUCCESS:
      return {
        ...state,
        categories: {
          ...state.categories,
          saving: action.payload.saving,
          loadedLocationId: action.payload.error ? state.categories.loadedLocationId : null,
        },
      };
    case PC.DELETE_CATEGORY_SUCCESS:
      return {
        ...state,
        categories: {
          ...state.categories,
          saving: action.payload.saving ?? false,
          categories:
            action.payload.categoryId && !action.payload.error
              ? state.categories.categories.filter((c) => c.id !== action.payload.categoryId)
              : state.categories.categories,
          loadedLocationId: action.payload.error ? state.categories.loadedLocationId : null,
        },
      };
    case PC.CATEGORIES_ADD:
      return {
        ...state,
        categories: {
          ...state.categories,
          categories: [...state.categories.categories, { ...action.payload, id: `new-${Date.now()}` }],
        },
      };
    case PC.CATEGORIES_UPDATE:
      return {
        ...state,
        categories: {
          ...state.categories,
          categories: state.categories.categories.map((c) =>
            c.id === action.payload.id ? { ...c, ...action.payload.updates } : c,
          ),
        },
      };
    case PC.CATEGORIES_REMOVE:
      return {
        ...state,
        categories: {
          ...state.categories,
          categories: state.categories.categories.filter((c) => c.id !== action.payload),
        },
      };
    case PC.CATEGORIES_TOGGLE_VISIBILITY:
      return {
        ...state,
        categories: {
          ...state.categories,
          categories: state.categories.categories.map((c) =>
            c.id === action.payload ? { ...c, isVisible: !c.isVisible } : c,
          ),
        },
      };
    case PC.CATEGORIES_REORDER_SIBLINGS: {
      const { parentCategoryId, orderedIds } = action.payload;
      return {
        ...state,
        categories: {
          ...state.categories,
          categories: state.categories.categories.map((c) => {
            const isSibling =
              parentCategoryId === undefined ? !c.parentCategoryId : c.parentCategoryId === parentCategoryId;
            if (!isSibling) return c;
            const pos = orderedIds.indexOf(c.id);
            if (pos === -1) return c;
            return { ...c, sortPosition: pos };
          }),
        },
      };
    }
    case PC.SORT_CATEGORIES_SUCCESS:
      return { ...state, categories: { ...state.categories, saving: false } };

    case PC.MENUS_SET_EDITING:
      return { ...state, menus: { ...state.menus, editingMenuId: action.payload } };
    case PC.MENUS_CLEAR_CACHE:
      return {
        ...state,
        menus: { ...state.menus, menus: [], loadedLocationId: null, error: null, loading: false },
      };
    case PC.FETCH_MENUS_REQUEST:
      return { ...state, menus: { ...state.menus, loading: true, error: null } };
    case PC.FETCH_MENUS_SUCCESS:
      return {
        ...state,
        menus: {
          ...state.menus,
          menus: action.payload.menus,
          loading: false,
          error: null,
          loadedLocationId: action.payload.locationId,
        },
      };
    case PC.FETCH_MENUS_FAILURE:
      return {
        ...state,
        menus: {
          ...state.menus,
          loading: false,
          error: action.payload.error,
          menus: [],
          loadedLocationId: null,
        },
      };
    case PC.CREATE_MENU_SUCCESS:
    case PC.UPDATE_MENU_SUCCESS:
      return {
        ...state,
        menus: { ...state.menus, loadedLocationId: action.payload.error ? state.menus.loadedLocationId : null },
      };
    case PC.DELETE_MENU_SUCCESS:
      return {
        ...state,
        menus: {
          ...state.menus,
          menus: !action.payload.error
            ? state.menus.menus.filter((m) => m.id !== action.payload.categoryGroupId)
            : state.menus.menus,
          loadedLocationId: action.payload.error ? state.menus.loadedLocationId : null,
        },
      };
    case PC.MENUS_ADD:
      return {
        ...state,
        menus: {
          ...state.menus,
          menus: [...state.menus.menus, { ...action.payload, id: `new-${Date.now()}` }],
        },
      };
    case PC.MENUS_UPDATE:
      return {
        ...state,
        menus: {
          ...state.menus,
          menus: state.menus.menus.map((m) =>
            m.id === action.payload.id ? { ...m, ...action.payload.updates } : m,
          ),
        },
      };
    case PC.MENUS_REMOVE:
      return {
        ...state,
        menus: { ...state.menus, menus: state.menus.menus.filter((m) => m.id !== action.payload) },
      };

    case PC.SESSIONS_SET_EDITING:
      return { ...state, sessions: { ...state.sessions, editingSessionId: action.payload } };
    case PC.SESSIONS_CLEAR_CACHE:
      return {
        ...state,
        sessions: {
          ...state.sessions,
          sessions: [],
          loadedLocationId: null,
          error: null,
        },
      };
    case PC.FETCH_SESSIONS_REQUEST:
      return { ...state, sessions: { ...state.sessions, loading: true, error: null } };
    case PC.FETCH_SESSIONS_SUCCESS:
      return {
        ...state,
        sessions: {
          ...state.sessions,
          sessions: action.payload.sessions,
          loading: false,
          error: null,
          loadedLocationId: action.payload.locationId,
        },
      };
    case PC.FETCH_SESSIONS_FAILURE:
      return {
        ...state,
        sessions: {
          ...state.sessions,
          loading: false,
          error: action.payload.error,
          sessions: [],
          loadedLocationId: null,
        },
      };
    case PC.SESSIONS_ADD:
      return {
        ...state,
        sessions: {
          ...state.sessions,
          sessions: [...state.sessions.sessions, { ...action.payload, id: `new-${Date.now()}` }],
        },
      };
    case PC.SESSIONS_UPDATE:
      return {
        ...state,
        sessions: {
          ...state.sessions,
          sessions: state.sessions.sessions.map((s) =>
            s.id === action.payload.id ? { ...s, ...action.payload.updates } : s,
          ),
        },
      };
    case PC.SESSIONS_REMOVE:
      return {
        ...state,
        sessions: {
          ...state.sessions,
          sessions: state.sessions.sessions.filter((s) => s.id !== action.payload),
        },
      };

    case PC.MODIFIERS_SET_EDITING:
      return { ...state, modifiers: { ...state.modifiers, editingModifierId: action.payload } };
    case PC.MODIFIERS_CLEAR_CACHE:
      return {
        ...state,
        modifiers: {
          ...state.modifiers,
          modifiers: [],
          loadedLocationId: null,
          error: null,
        },
      };
    case PC.CREATE_MODIFIER_REQUEST:
    case PC.UPDATE_MODIFIER_REQUEST:
    case PC.DELETE_MODIFIER_REQUEST:
      return { ...state, modifiers: { ...state.modifiers, saving: true } };
    case PC.FETCH_MODIFIERS_REQUEST:
      return { ...state, modifiers: { ...state.modifiers, loading: true, error: null } };
    case PC.FETCH_MODIFIERS_SUCCESS:
      return {
        ...state,
        modifiers: {
          ...state.modifiers,
          modifiers: action.payload.modifiers,
          loading: false,
          error: null,
          loadedLocationId: action.payload.locationId,
        },
      };
    case PC.FETCH_MODIFIERS_FAILURE:
      return {
        ...state,
        modifiers: {
          ...state.modifiers,
          loading: false,
          error: action.payload.error,
          modifiers: [],
          loadedLocationId: null,
        },
      };
    case PC.CREATE_MODIFIER_SUCCESS:
    case PC.UPDATE_MODIFIER_SUCCESS:
      return {
        ...state,
        modifiers: {
          ...state.modifiers,
          saving: false,
          loadedLocationId: action.payload.error ? state.modifiers.loadedLocationId : null,
        },
      };
    case PC.DELETE_MODIFIER_SUCCESS:
      return {
        ...state,
        modifiers: {
          ...state.modifiers,
          saving: false,
          modifiers:
            action.payload.modifierId && !action.payload.error
              ? state.modifiers.modifiers.filter((m) => m.id !== action.payload.modifierId)
              : state.modifiers.modifiers,
          loadedLocationId: action.payload.error ? state.modifiers.loadedLocationId : null,
        },
      };

    case PC.MODIFIERS_ADD:
      return {
        ...state,
        modifiers: {
          ...state.modifiers,
          modifiers: [...state.modifiers.modifiers, { ...action.payload, id: `new-${Date.now()}` }],
        },
      };
    case PC.MODIFIERS_UPDATE:
      return {
        ...state,
        modifiers: {
          ...state.modifiers,
          modifiers: state.modifiers.modifiers.map((m) =>
            m.id === action.payload.id ? { ...m, ...action.payload.updates } : m,
          ),
        },
      };
    case PC.MODIFIERS_REMOVE:
      return {
        ...state,
        modifiers: {
          ...state.modifiers,
          modifiers: state.modifiers.modifiers.filter((m) => m.id !== action.payload),
        },
      };

    case PC.COMBOS_SET_EDITING:
      return { ...state, combos: { ...state.combos, editingComboId: action.payload } };
    case PC.COMBOS_CLEAR_CACHE:
      return {
        ...state,
        combos: { ...state.combos, combos: [], loading: false, error: null, loadedLocationId: null },
      };
    case PC.FETCH_COMBOS_REQUEST:
      return { ...state, combos: { ...state.combos, loading: true, error: null } };
    case PC.FETCH_COMBOS_SUCCESS:
      return {
        ...state,
        combos: {
          ...state.combos,
          combos: action.payload.combos,
          loading: false,
          error: null,
          loadedLocationId: action.payload.locationId,
        },
      };
    case PC.FETCH_COMBOS_FAILURE:
      return {
        ...state,
        combos: {
          ...state.combos,
          loading: false,
          error: action.payload.error,
          combos: [],
          loadedLocationId: null,
        },
      };
    case PC.CREATE_COMBO_SUCCESS:
    case PC.UPDATE_COMBO_SUCCESS:
      return {
        ...state,
        combos: { ...state.combos, loadedLocationId: action.payload.error ? state.combos.loadedLocationId : null },
      };
    case PC.DELETE_COMBO_SUCCESS:
      return {
        ...state,
        combos: {
          ...state.combos,
          combos: !action.payload.error
            ? state.combos.combos.filter((c) => c.id !== action.payload.comboId)
            : state.combos.combos,
        },
      };
    case PC.COMBOS_ADD:
      return {
        ...state,
        combos: {
          ...state.combos,
          combos: [...state.combos.combos, { ...action.payload, id: `combo-${Date.now()}` }],
        },
      };
    case PC.COMBOS_UPDATE:
      return {
        ...state,
        combos: {
          ...state.combos,
          combos: state.combos.combos.map((c) =>
            c.id === action.payload.id ? { ...c, ...action.payload.updates } : c,
          ),
        },
      };
    case PC.COMBOS_REMOVE:
      return {
        ...state,
        combos: { ...state.combos, combos: state.combos.combos.filter((c) => c.id !== action.payload) },
      };

    case PC.OPTION_SETS_SET_EDITING:
      return { ...state, optionSets: { ...state.optionSets, editingOptionSetId: action.payload } };
    case PC.OPTION_SETS_CLEAR_CACHE:
      return {
        ...state,
        optionSets: {
          ...state.optionSets,
          optionSets: [],
          loadedLocationId: null,
          error: null,
          loading: false,
        },
      };
    case PC.FETCH_OPTION_SETS_REQUEST:
      return { ...state, optionSets: { ...state.optionSets, loading: true, error: null } };
    case PC.FETCH_OPTION_SETS_SUCCESS:
      return {
        ...state,
        optionSets: {
          ...state.optionSets,
          optionSets: action.payload.optionSets,
          loading: false,
          error: null,
          loadedLocationId: action.payload.locationId,
        },
      };
    case PC.FETCH_OPTION_SETS_FAILURE:
      return {
        ...state,
        optionSets: {
          ...state.optionSets,
          loading: false,
          error: action.payload.error,
          optionSets: [],
          loadedLocationId: null,
        },
      };
    case PC.CREATE_OPTION_SET_SUCCESS:
    case PC.UPDATE_OPTION_SET_SUCCESS:
      return {
        ...state,
        optionSets: {
          ...state.optionSets,
          loadedLocationId: action.payload.error ? state.optionSets.loadedLocationId : null,
        },
      };
    case PC.DELETE_OPTION_SET_SUCCESS:
      return {
        ...state,
        optionSets: {
          ...state.optionSets,
          optionSets: !action.payload.error
            ? state.optionSets.optionSets.filter((o) => o.id !== action.payload.templateId)
            : state.optionSets.optionSets,
          loadedLocationId: action.payload.error ? state.optionSets.loadedLocationId : null,
        },
      };
    case PC.OPTION_SETS_ADD:
      return {
        ...state,
        optionSets: {
          ...state.optionSets,
          optionSets: [...state.optionSets.optionSets, { ...action.payload, id: `new-${Date.now()}` }],
        },
      };
    case PC.OPTION_SETS_UPDATE:
      return {
        ...state,
        optionSets: {
          ...state.optionSets,
          optionSets: state.optionSets.optionSets.map((o) =>
            o.id === action.payload.id ? { ...o, ...action.payload.updates } : o,
          ),
        },
      };
    case PC.OPTION_SETS_REMOVE:
      return {
        ...state,
        optionSets: {
          ...state.optionSets,
          optionSets: state.optionSets.optionSets.filter((o) => o.id !== action.payload),
        },
      };

    case PC.KITCHEN_SET_EDITING:
      return { ...state, kitchenStations: { ...state.kitchenStations, editingStationId: action.payload } };
    case PC.KITCHEN_CLEAR_CACHE:
      return {
        ...state,
        kitchenStations: {
          ...state.kitchenStations,
          stations: [],
          loading: false,
          error: null,
          loadedLocationId: null,
        },
      };
    case PC.FETCH_KITCHEN_REQUEST:
      return { ...state, kitchenStations: { ...state.kitchenStations, loading: true, error: null } };
    case PC.FETCH_KITCHEN_SUCCESS:
      return {
        ...state,
        kitchenStations: {
          ...state.kitchenStations,
          stations: action.payload.stations,
          loading: false,
          error: null,
          loadedLocationId: action.payload.locationId,
        },
      };
    case PC.FETCH_KITCHEN_FAILURE:
      return {
        ...state,
        kitchenStations: {
          ...state.kitchenStations,
          loading: false,
          error: action.payload.error,
        },
      };
    case PC.CREATE_STATION_SUCCESS:
    case PC.UPDATE_STATION_SUCCESS:
      return {
        ...state,
        kitchenStations: {
          ...state.kitchenStations,
          loadedLocationId: action.payload.error ? state.kitchenStations.loadedLocationId : null,
        },
      };
    case PC.DELETE_STATION_SUCCESS:
      return {
        ...state,
        kitchenStations: {
          ...state.kitchenStations,
          stations: !action.payload.error
            ? state.kitchenStations.stations.filter((s) => s.id !== action.payload.id)
            : state.kitchenStations.stations,
          loadedLocationId: action.payload.error ? state.kitchenStations.loadedLocationId : null,
        },
      };
    case PC.KITCHEN_ADD_STATION:
      return {
        ...state,
        kitchenStations: {
          ...state.kitchenStations,
          stations: [
            ...state.kitchenStations.stations,
            {
              ...action.payload,
              id: `new-${Date.now()}`,
              isDefault: action.payload.isDefault ?? false,
              displayOrder: action.payload.displayOrder ?? state.kitchenStations.stations.length + 1,
            },
          ],
        },
      };
    case PC.KITCHEN_UPDATE_STATION:
      return {
        ...state,
        kitchenStations: {
          ...state.kitchenStations,
          stations: state.kitchenStations.stations.map((s) =>
            s.id === action.payload.id ? { ...s, ...action.payload.updates } : s,
          ),
        },
      };
    case PC.KITCHEN_REMOVE_STATION:
      return {
        ...state,
        kitchenStations: {
          ...state.kitchenStations,
          stations: state.kitchenStations.stations.filter((s) => s.id !== action.payload),
        },
      };
    case PC.KITCHEN_ADD_PRINTER:
      return {
        ...state,
        kitchenStations: {
          ...state.kitchenStations,
          printers: [
            ...state.kitchenStations.printers,
            { ...action.payload, id: `new-${Date.now()}`, status: action.payload.status ?? 'online' },
          ],
        },
      };
    case PC.KITCHEN_UPDATE_PRINTER:
      return {
        ...state,
        kitchenStations: {
          ...state.kitchenStations,
          printers: state.kitchenStations.printers.map((p) =>
            p.id === action.payload.id ? { ...p, ...action.payload.updates } : p,
          ),
        },
      };
    case PC.KITCHEN_REMOVE_PRINTER:
      return {
        ...state,
        kitchenStations: {
          ...state.kitchenStations,
          printers: state.kitchenStations.printers.filter((p) => p.id !== action.payload),
        },
      };

    case PC.FETCH_ATTRIBUTES_REQUEST:
      return {
        ...state,
        itemAttributes: {
          ...state.itemAttributes,
          loading: { tags: true, ingredients: true, diet: true, allergens: true, tax: true, units: true, revenueClass: true },
          error: { ...defaultAttrError },
        },
      };
    case PC.FETCH_ATTRIBUTES_SUCCESS:
      return {
        ...state,
        itemAttributes: {
          ...state.itemAttributes,
          tags: action.payload.tags,
          ingredients: action.payload.ingredients,
          diet: action.payload.diet,
          allergens: action.payload.allergens,
          tax: action.payload.tax,
          units: action.payload.units,
          revenueClass: action.payload.revenueClass,
          loading: { ...defaultAttrLoading },
          error: {
            tags: action.payload.errors.tags ?? null,
            ingredients: action.payload.errors.ingredients ?? null,
            diet: action.payload.errors.diet ?? null,
            allergens: action.payload.errors.allergens ?? null,
            tax: action.payload.errors.tax ?? null,
            units: action.payload.errors.units ?? null,
            revenueClass: action.payload.errors.revenueClass ?? null,
          },
          loadedLocationId: action.payload.locationId,
        },
      };
    case PC.FETCH_ATTRIBUTES_FAILURE:
      return {
        ...state,
        itemAttributes: {
          ...state.itemAttributes,
          loading: { ...defaultAttrLoading },
          error: {
            tags: action.payload.error,
            ingredients: action.payload.error,
            diet: action.payload.error,
            allergens: action.payload.error,
            tax: action.payload.error,
            units: action.payload.error,
            revenueClass: action.payload.error,
          },
        },
      };
    case PC.CLEAR_ATTRIBUTES:
      return {
        ...state,
        itemAttributes: {
          tags: [],
          ingredients: [],
          diet: [],
          allergens: [],
          tax: [],
          units: [],
          revenueClass: [],
          loading: { ...defaultAttrLoading },
          error: { ...defaultAttrError },
          loadedLocationId: null,
        },
      };

    case PC.TOAST_ADD: {
      const id = action.payload.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      return {
        ...state,
        toast: {
          ...state.toast,
          toasts: [
            ...state.toast.toasts,
            { id, message: action.payload.message, type: action.payload.type },
          ],
        },
      };
    }
    case PC.TOAST_REMOVE:
      return {
        ...state,
        toast: { ...state.toast, toasts: state.toast.toasts.filter((t) => t.id !== action.payload) },
      };

    case PC.SET_MENUS_SET_EDITING:
      return { ...state, setMenus: { ...state.setMenus, editingSetMenuId: action.payload } };
    case PC.SET_MENUS_ADD:
      return {
        ...state,
        setMenus: {
          ...state.setMenus,
          setMenus: [...state.setMenus.setMenus, { ...action.payload, id: `sm-${Date.now()}` }],
        },
      };
    case PC.SET_MENUS_UPDATE:
      return {
        ...state,
        setMenus: {
          ...state.setMenus,
          setMenus: state.setMenus.setMenus.map((m) =>
            m.id === action.payload.id ? { ...m, ...action.payload.updates } : m,
          ),
        },
      };
    case PC.SET_MENUS_REMOVE:
      return {
        ...state,
        setMenus: {
          ...state.setMenus,
          setMenus: state.setMenus.setMenus.filter((m) => m.id !== action.payload),
        },
      };

    case PC.MENU_PRICES_SET: {
      const price = action.payload;
      const idx = state.menuPrices.menuPrices.findIndex(
        (p) =>
          p.menuId === price.menuId &&
          p.itemId === price.itemId &&
          (p.variationId ?? '') === (price.variationId ?? ''),
      );
      const next = [...state.menuPrices.menuPrices];
      if (idx >= 0) next[idx] = price;
      else next.push(price);
      return { ...state, menuPrices: { ...state.menuPrices, menuPrices: next } };
    }
    case PC.MENU_PRICES_REMOVE:
      return {
        ...state,
        menuPrices: {
          ...state.menuPrices,
          menuPrices: state.menuPrices.menuPrices.filter(
            (p) =>
              !(
                p.menuId === action.payload.menuId &&
                p.itemId === action.payload.itemId &&
                (p.variationId ?? '') === (action.payload.variationId ?? '')
              ),
          ),
        },
      };
    case PC.MENU_PRICES_REMOVE_ALL_MENU:
      return {
        ...state,
        menuPrices: {
          ...state.menuPrices,
          menuPrices: state.menuPrices.menuPrices.filter((p) => p.menuId !== action.payload),
        },
      };
    case PC.MENU_PRICES_REMOVE_ALL_ITEM:
      return {
        ...state,
        menuPrices: {
          ...state.menuPrices,
          menuPrices: state.menuPrices.menuPrices.filter((p) => p.itemId !== action.payload),
        },
      };
    case PC.MENU_PRICES_BULK_ADJUST: {
      const { menuId, itemIds, basePrices, adj } = action.payload;
      let next = state.menuPrices.menuPrices.filter((p) => !(p.menuId === menuId && itemIds.includes(p.itemId)));
      itemIds.forEach((itemId) => {
        const base = basePrices[itemId] ?? 0;
        let newPrice: number;
        if (adj.mode === 'percentage') newPrice = base * (1 - adj.value / 100);
        else if (adj.mode === 'flat') newPrice = base - adj.value;
        else newPrice = adj.value;
        newPrice = Math.max(0, applyRounding(newPrice, adj.rounding ?? 'none'));
        next.push({ menuId, itemId, overridePrice: newPrice });
      });
      return { ...state, menuPrices: { ...state.menuPrices, menuPrices: next } };
    }

    case PC.DIETARY_COLORS_UPDATE:
      return {
        ...state,
        dietaryColors: {
          ...state.dietaryColors,
          colors: state.dietaryColors.colors.map((c) =>
            c.tagName === action.payload.tagName ? { ...c, ...action.payload.updates } : c,
          ),
        },
      };

    case PC.TRIGGER_SYNC_REQUEST:
      return { ...state, syncTrigger: { loading: true, error: null, errorKind: null } };
    case PC.TRIGGER_SYNC_SUCCESS:
      return { ...state, syncTrigger: { loading: false, error: null, errorKind: null } };
    case PC.TRIGGER_SYNC_FAILURE:
      return {
        ...state,
        syncTrigger: { loading: false, error: action.payload.error, errorKind: action.payload.errorKind },
      };

    case PC.RESTAURANT_DETAILS_SET:
      return { ...state, restaurantDetails: { details: action.payload } };
    case PC.RESTAURANT_DETAILS_CLEAR:
      return { ...state, restaurantDetails: { details: null } };

    default:
      return state;
  }
}
