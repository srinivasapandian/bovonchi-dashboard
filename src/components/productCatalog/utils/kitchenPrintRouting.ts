/**
 * Kitchen printing by order type — outlet default + bulk-apply helpers.
 * Pure: no React, no Redux. Per-item state lives on the real `MenuItem.kotExcludedOrderTypeIds`
 * field (see ItemFormPage); this module only covers the outlet-wide default and the bulk-apply form.
 */
import type { KitchenPrintFormValue, KitchenPrintOutletDefault, MenuItem } from '../data/types';
import { getChannelDisplayName, type OutletOrderType } from './outletOrderTypes';

const NO_ORDER_TYPE_ERROR = 'Pick at least one order type, or choose Follow outlet default.';
const NO_OUTLET_ORDER_TYPE_ERROR = 'Pick at least one order type.';

/** Station ids an item is mapped to (multi-station list first, legacy single id as fallback). */
export function itemStationIds(item: MenuItem): string[] {
  const ids =
    item.kitchenStationIds && item.kitchenStationIds.length > 0
      ? item.kitchenStationIds
      : item.kitchenStationId
        ? [item.kitchenStationId]
        : [];
  return Array.from(new Set(ids.filter(Boolean)));
}

/** "All order types go to the kitchen" | "Dine-in doesn't go to the kitchen" | "Dine-in and Pickup don't go to the kitchen" | "No order types go to the kitchen". */
export function describeOutletExclusions(
  outletDefault: KitchenPrintOutletDefault | undefined,
  orderTypes: OutletOrderType[],
): string {
  if (!outletDefault) return 'All order types go to the kitchen';
  const excluded = orderTypes
    .filter((ot) => outletDefault.excludedOrderTypeIds.includes(ot.id))
    .map((ot) => getChannelDisplayName(ot.typeName));
  if (excluded.length === 0) return 'All order types go to the kitchen';
  if (orderTypes.length > 0 && excluded.length === orderTypes.length) return 'No order types go to the kitchen';
  if (excluded.length === 1) return `${excluded[0]} doesn't go to the kitchen`;
  const list = `${excluded.slice(0, -1).join(', ')} and ${excluded[excluded.length - 1]}`;
  return `${list} don't go to the kitchen`;
}

export function validateOutletDefault(orderTypeIds: string[], orderTypes: OutletOrderType[]): string | null {
  return orderTypeIds.some((id) => orderTypes.some((ot) => ot.id === id)) ? null : NO_OUTLET_ORDER_TYPE_ERROR;
}

/** Selected ids that still exist at the outlet. */
export function allowedOrderTypeIds(value: KitchenPrintFormValue, orderTypes: OutletOrderType[]): string[] {
  return value.orderTypeIds.filter((id) => orderTypes.some((ot) => ot.id === id));
}

export function validateKitchenPrintForm(value: KitchenPrintFormValue, orderTypes: OutletOrderType[]): string | null {
  if (value.mode === 'all') return null;
  return allowedOrderTypeIds(value, orderTypes).length === 0 ? NO_ORDER_TYPE_ERROR : null;
}

/** `kotExcludedOrderTypeIds` to save for a `KitchenPrintFormValue` — 'all' clears the item's own rule; 'selected' excludes every order type not chosen. */
export function excludedOrderTypeIdsForForm(value: KitchenPrintFormValue, orderTypes: OutletOrderType[]): string[] {
  if (value.mode === 'all') return [];
  const included = new Set(allowedOrderTypeIds(value, orderTypes));
  return orderTypes.filter((ot) => !included.has(ot.id)).map((ot) => ot.id);
}
