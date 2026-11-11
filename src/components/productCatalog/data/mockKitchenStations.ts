import { KitchenStation, Printer } from './types';

export const mockKitchenStations: KitchenStation[] = [
  {
    id: 'station-1',
    name: 'Grill Station',
    code: 'GRL',
    description: 'Handles all grilled items, pizzas, burgers, and hot entrees.',
    color: '#B89550',
    isDefault: true,
    displayOrder: 1,
  },
  {
    id: 'station-2',
    name: 'Cold Station',
    code: 'CLD',
    description: 'Prepares salads, cold appetizers, desserts, and plating.',
    color: '#1E88E5',
    displayOrder: 2,
  },
  {
    id: 'station-3',
    name: 'Bar',
    code: 'BAR',
    description: 'All beverages including cocktails, smoothies, and hot drinks.',
    color: '#43A047',
    displayOrder: 3,
  },
];

export const mockPrinters: Printer[] = [
  {
    id: 'printer-1',
    name: 'Main KOT Printer',
    type: 'kot',
    connectionType: 'network',
    connectionDetails: '192.168.1.100:9100',
    isMasterKot: true,
    status: 'online',
    stationIds: ['station-1', 'station-2'],
  },
  {
    id: 'printer-2',
    name: 'Bar Printer',
    type: 'kot',
    connectionType: 'network',
    connectionDetails: '192.168.1.101:9100',
    isMasterKot: false,
    status: 'online',
    stationIds: ['station-3'],
  },
  {
    id: 'printer-3',
    name: 'Label Printer',
    type: 'label',
    connectionType: 'usb',
    connectionDetails: 'USB-003',
    isMasterKot: false,
    status: 'online',
    stationIds: ['station-1', 'station-2', 'station-3'],
  },
  {
    id: 'printer-4',
    name: 'Receipt Printer',
    type: 'receipt',
    connectionType: 'bluetooth',
    connectionDetails: 'BT-RECEIPT-04',
    isMasterKot: false,
    status: 'offline',
    stationIds: [],
  },
];
