/**
 * Single import surface for Product Catalog demo/mock data.
 * Zustand stores hydrate from these exports — use stores in feature pages, not this module directly.
 */
export { mockItems } from './mockItems';
export { mockCategories } from './mockCategories';
export { mockMenus } from './mockMenus';
export { mockModifiers } from './mockModifiers';
export { mockVariationSets, mockVariationSets as mockOptionSets } from './mockOptionSets';
export { mockKitchenStations, mockPrinters } from './mockKitchenStations';
export { mockDevices } from './mockDevices';
