import { useMemo } from 'react';
import { bulkEditItemApi } from '../../../services/itemCatalogApi';
import { excludedOrderTypeIdsForForm } from '../utils/kitchenPrintRouting';
import type { KitchenPrintFormValue, MenuItem } from '../data/types';
import type { OutletOrderType } from '../utils/outletOrderTypes';

export interface BulkKitchenPrintResult {
  /** Items the request actually applied to (a mismatched id — wrong location, already deleted — is silently skipped by the API). */
  updatedCount: number;
  requestedCount: number;
}

/**
 * Applies a bulk kitchen-print change to a set of item ids for one outlet, via the real
 * `PATCH /items/bulk/kot-exception` bulk-edit endpoint — one shared `kotExcludedOrderTypeIds`
 * list applied to every id in `itemIds` (full replace, same semantics as the single-item field).
 */
export function useBulkKitchenPrint(
  locationId: string,
  token: string | null,
  orderTypes: OutletOrderType[],
  updateItem: (id: string, updates: Partial<MenuItem>) => void,
): { apply: (itemIds: string[], value: KitchenPrintFormValue) => Promise<BulkKitchenPrintResult> } {
  return useMemo(
    () => ({
      apply: async (itemIds: string[], value: KitchenPrintFormValue): Promise<BulkKitchenPrintResult> => {
        if (itemIds.length === 0) return { updatedCount: 0, requestedCount: 0 };
        const kotExcludedOrderTypeIds = excludedOrderTypeIdsForForm(value, orderTypes);
        const resp = (await bulkEditItemApi(
          'kot-exception',
          { locationId, itemIds, kotExcludedOrderTypeIds },
          token,
        )) as { updatedCount?: unknown };
        itemIds.forEach((id) => updateItem(id, { kotExcludedOrderTypeIds }));
        return { updatedCount: Number(resp?.updatedCount ?? itemIds.length), requestedCount: itemIds.length };
      },
    }),
    [locationId, token, orderTypes, updateItem],
  );
}
