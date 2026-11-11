import type { Combo } from './types';

export const mockCombos: Combo[] = [
  {
    id: 'combo-1',
    name: 'Happy Meal',
    displayName: 'Happy Meal Deal',
    description: 'Choose a burger, side, and drink at one great price.',
    comboCode: 'HM01',
    pricingModel: 'dynamic',
    basePrice: 9.99,
    costPrice: 4.50,
    status: 'active',
    orderTypeVisibility: { dine_in: true, takeout: true, delivery: true },
    sessionIds: [],
    modifierIds: [],
    slots: [
      {
        id: 'slot-hm-1', slotName: 'Choose your Burger', slotType: 'required',
        minSelections: 1, maxSelections: 1, sortPosition: 0,
        defaultItemId: 'item-7',
        eligibleItems: [
          { itemId: 'item-7', supplementPrice: 0 },
          { itemId: 'item-8', supplementPrice: 0 },
          { itemId: 'item-9', supplementPrice: 1.50 },
        ],
      },
      {
        id: 'slot-hm-2', slotName: 'Pick a Side', slotType: 'required',
        minSelections: 1, maxSelections: 1, sortPosition: 1,
        eligibleItems: [
          { itemId: 'item-28', supplementPrice: 0 },
          { itemId: 'item-29', supplementPrice: 0 },
        ],
      },
      {
        id: 'slot-hm-3', slotName: 'Choose a Drink', slotType: 'required',
        minSelections: 1, maxSelections: 1, sortPosition: 2,
        eligibleItems: [
          { itemId: 'item-19', supplementPrice: 0 },
          { itemId: 'item-20', supplementPrice: 0 },
          { itemId: 'item-21', supplementPrice: 1.00 },
        ],
      },
    ],
    createdAt: '2025-12-01T10:00:00Z',
  },
  {
    id: 'combo-2',
    name: 'Lunch Special',
    description: 'Starter + main + soft drink for a fixed price.',
    comboCode: 'LS01',
    pricingModel: 'fixed',
    basePrice: 14.99,
    status: 'active',
    slots: [
      {
        id: 'slot-ls-1', slotName: 'Starter', slotType: 'required',
        minSelections: 1, maxSelections: 1, sortPosition: 0,
        eligibleItems: [
          { itemId: 'item-1', supplementPrice: 0 },
          { itemId: 'item-2', supplementPrice: 0 },
          { itemId: 'item-3', supplementPrice: 0 },
        ],
      },
      {
        id: 'slot-ls-2', slotName: 'Main Course', slotType: 'required',
        minSelections: 1, maxSelections: 1, sortPosition: 1,
        eligibleItems: [
          { itemId: 'item-11', supplementPrice: 0 },
          { itemId: 'item-12', supplementPrice: 0 },
        ],
      },
      {
        id: 'slot-ls-3', slotName: 'Drink', slotType: 'optional',
        minSelections: 0, maxSelections: 1, sortPosition: 2,
        eligibleItems: [
          { itemId: 'item-19', supplementPrice: 0 },
          { itemId: 'item-20', supplementPrice: 0 },
        ],
      },
    ],
    createdAt: '2025-12-15T10:00:00Z',
  },
];
