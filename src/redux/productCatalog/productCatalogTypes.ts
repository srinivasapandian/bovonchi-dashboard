import type {
  MenuItem,
  Category,
  Menu,
  Session,
  ModifierGroup,
  Combo,
  OptionSet,
  KitchenStation,
  Printer,
  ItemAttribute,
  SetMenu,
  MenuItemPrice,
  DietaryTypeColor,
} from '../../components/productCatalog/data/types';
/** Mirrors ItemAttributes store tax row shape */
export interface TaxOption {
  taxId: string;
  name: string;
  type: 'PERCENT' | 'FLATFEE' | string;
  rate: number;
  label: string;
}

export type AttrType = 'tags' | 'ingredients' | 'diet' | 'allergens' | 'tax' | 'units' | 'revenueClass';

export type Deferred<T = void> = {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (e: Error) => void;
};

export type FetchOptions = { force?: boolean; skipDuplicateMs?: number };

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface ItemsSliceState {
  items: MenuItem[];
  loading: boolean;
  error: string | null;
  loadedLocationId: string | null;
  editingItemId: string | null;
  visibleColumns: string[];
}

export interface CategoriesSliceState {
  categories: Category[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  loadedLocationId: string | null;
  editingCategoryId: string | null;
}

export interface MenusSliceState {
  menus: Menu[];
  loading: boolean;
  error: string | null;
  loadedLocationId: string | null;
  editingMenuId: string | null;
}

export interface SessionsSliceState {
  sessions: Session[];
  loading: boolean;
  error: string | null;
  loadedLocationId: string | null;
  editingSessionId: string | null;
}

export interface ModifiersSliceState {
  modifiers: ModifierGroup[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  loadedLocationId: string | null;
  editingModifierId: string | null;
}

export interface CombosSliceState {
  combos: Combo[];
  loading: boolean;
  error: string | null;
  loadedLocationId: string | null;
  editingComboId: string | null;
}

export interface OptionSetsSliceState {
  optionSets: OptionSet[];
  loading: boolean;
  error: string | null;
  loadedLocationId: string | null;
  editingOptionSetId: string | null;
}

export interface KitchenStationsSliceState {
  stations: KitchenStation[];
  printers: Printer[];
  loading: boolean;
  error: string | null;
  loadedLocationId: string | null;
  editingStationId: string | null;
}

export interface ItemAttributesSliceState {
  tags: ItemAttribute[];
  ingredients: ItemAttribute[];
  diet: ItemAttribute[];
  allergens: ItemAttribute[];
  units: ItemAttribute[];
  revenueClass: ItemAttribute[];
  tax: TaxOption[];
  loading: Record<AttrType, boolean>;
  error: Record<AttrType, string | null>;
  loadedLocationId: string | null;
}

export interface ToastSliceState {
  toasts: ToastItem[];
}

export interface SetMenusSliceState {
  setMenus: SetMenu[];
  editingSetMenuId: string | null;
}

export interface MenuPricesSliceState {
  menuPrices: MenuItemPrice[];
}

export interface DietaryColorsSliceState {
  colors: DietaryTypeColor[];
}

export interface SyncTriggerSliceState {
  loading: boolean;
  error: string | null;
  errorKind: import('../../services/syncCatalogApi').SyncErrorKind | null;
}

export interface RestaurantDetailsSliceState {
  details: Record<string, unknown> | null;
}

export interface ProductCatalogState {
  items: ItemsSliceState;
  categories: CategoriesSliceState;
  menus: MenusSliceState;
  sessions: SessionsSliceState;
  modifiers: ModifiersSliceState;
  combos: CombosSliceState;
  optionSets: OptionSetsSliceState;
  kitchenStations: KitchenStationsSliceState;
  itemAttributes: ItemAttributesSliceState;
  toast: ToastSliceState;
  setMenus: SetMenusSliceState;
  menuPrices: MenuPricesSliceState;
  dietaryColors: DietaryColorsSliceState;
  syncTrigger: SyncTriggerSliceState;
  restaurantDetails: RestaurantDetailsSliceState;
}
