import { pcPaths, PC_BASE } from '../productCatalog/paths';

export const ORDERS_PATH = '/orders';

export interface NavLeaf {
  label: string;
  icon: string;
  path: string;
}

/** Product Catalog sub-navigation, in the order the Merchant Portal presents it. */
export const CATALOG_NAV: NavLeaf[] = [
  { label: 'Control Centre', icon: 'dashboard', path: pcPaths.availability },
  { label: 'Items', icon: 'inventory_2', path: pcPaths.items },
  { label: 'Categories', icon: 'category', path: pcPaths.categories },
  { label: 'Modifiers', icon: 'tune', path: pcPaths.modifiers },
  // Menus, Variations, Combos and Set Menus are hidden, as in the Merchant Portal sidebar.
  // Their routes still exist in App.tsx; add a link back here to re-enable one.
  { label: 'Sessions', icon: 'schedule', path: pcPaths.sessions },
  // { label: 'Kitchen Stations', icon: 'soup_kitchen', path: pcPaths.kitchenStations },
  // { label: 'Sync History', icon: 'sync', path: pcPaths.syncHistory },
];

export const isCatalogPath = (pathname: string) => pathname === PC_BASE || pathname.startsWith(`${PC_BASE}/`);
