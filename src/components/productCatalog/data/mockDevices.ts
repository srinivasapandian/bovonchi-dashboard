import type { CatalogDevice } from './types';

export const mockDevices: CatalogDevice[] = [
  { id: 'device-1', name: 'POS Terminal 1', type: 'pos', station: 'Main Floor', currentMenuId: 'menu-food' },
  { id: 'device-2', name: 'POS Terminal 2', type: 'pos', station: 'Main Floor', currentMenuId: 'menu-food' },
  { id: 'device-3', name: 'Bar Tablet', type: 'tablet', station: 'Bar', currentMenuId: 'menu-drinks' },
  { id: 'device-4', name: 'Coffee Station iPad', type: 'tablet', station: 'Coffee Counter', currentMenuId: null },
  { id: 'device-5', name: 'Entrance Kiosk', type: 'kiosk', station: 'Lobby', currentMenuId: 'menu-food' },
  { id: 'device-6', name: 'Patio Tablet', type: 'tablet', station: 'Patio', currentMenuId: null },
  { id: 'device-7', name: 'Waiter Tablet 1', type: 'tablet', station: 'Main Floor', currentMenuId: 'menu-food' },
  { id: 'device-8', name: 'Waiter Tablet 2', type: 'tablet', station: 'Main Floor', currentMenuId: 'menu-late-night' },
];
