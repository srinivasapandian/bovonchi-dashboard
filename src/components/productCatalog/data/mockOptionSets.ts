import { VariationSet } from './types';

export const mockVariationSets: VariationSet[] = [
  {
    id: 'optset-1',
    name: 'Size',
    displayName: 'Select Size',
    options: [
      { id: 'optset-1-opt-1', name: 'Small', price: 0 },
      { id: 'optset-1-opt-2', name: 'Medium', price: 2.00 },
      { id: 'optset-1-opt-3', name: 'Large', price: 4.00 },
    ],
  },
  {
    id: 'optset-2',
    name: 'Temperature',
    displayName: 'Select Temperature',
    options: [
      { id: 'optset-2-opt-1', name: 'Hot' },
      { id: 'optset-2-opt-2', name: 'Cold' },
      { id: 'optset-2-opt-3', name: 'Iced' },
    ],
  },
  {
    id: 'optset-3',
    name: 'Portion',
    displayName: 'Select Portion',
    options: [
      { id: 'optset-3-opt-1', name: 'Half', price: 0 },
      { id: 'optset-3-opt-2', name: 'Full', price: 4.50 },
    ],
  },
  {
    id: 'optset-4',
    name: 'Milk Type',
    displayName: 'Choose Milk',
    options: [
      { id: 'optset-4-opt-1', name: 'Whole Milk', price: 0 },
      { id: 'optset-4-opt-2', name: 'Skim Milk', price: 0 },
      { id: 'optset-4-opt-3', name: 'Oat Milk', price: 0.75 },
      { id: 'optset-4-opt-4', name: 'Almond Milk', price: 0.75 },
    ],
  },
];
