import { useCallback, useEffect, useState } from 'react';
import { getOrderTypeKotApi, updateOrderTypeKotApi } from '../../../services/locationCatalogApi';
import type { KitchenPrintOutletDefault } from '../data/types';
import type { OutletOrderType } from '../utils/outletOrderTypes';

/**
 * Outlet-wide "Kitchen printing" default — which order types send tickets to kitchen stations,
 * for every item at this location. Backed by the real `GET/PATCH /locations/order-type-kot` APIs.
 */
export function useOutletKitchenPrintDefault(
  locationId: string,
  token: string | null,
): {
  outletDefault: KitchenPrintOutletDefault | undefined;
  loading: boolean;
  refetch: () => Promise<void>;
  /** `excludedOrderTypeIds` = null clears the default (every order type prints). Only the order types whose on/off state actually changed are sent to the API. */
  save: (excludedOrderTypeIds: string[] | null, orderTypes: OutletOrderType[]) => Promise<void>;
} {
  const [outletDefault, setOutletDefault] = useState<KitchenPrintOutletDefault | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!locationId) {
      setOutletDefault(undefined);
      return;
    }
    setLoading(true);
    try {
      const excludedOrderTypeIds = await getOrderTypeKotApi(locationId, token);
      setOutletDefault(excludedOrderTypeIds.length > 0 ? { excludedOrderTypeIds } : undefined);
    } finally {
      setLoading(false);
    }
  }, [locationId, token]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const save = useCallback(
    async (excludedOrderTypeIds: string[] | null, orderTypes: OutletOrderType[]) => {
      const prevExcluded = new Set(outletDefault?.excludedOrderTypeIds ?? []);
      const nextExcluded = new Set(excludedOrderTypeIds ?? []);
      const changes: Array<{ orderTypeId: string; enable: 0 | 1 }> = [];
      for (const ot of orderTypes) {
        const wasExcluded = prevExcluded.has(ot.id);
        const isExcluded = nextExcluded.has(ot.id);
        if (wasExcluded !== isExcluded) changes.push({ orderTypeId: ot.id, enable: isExcluded ? 0 : 1 });
      }
      if (changes.length > 0) {
        await updateOrderTypeKotApi({ locationId, orderTypes: changes }, token);
      }
      setOutletDefault(excludedOrderTypeIds && excludedOrderTypeIds.length > 0 ? { excludedOrderTypeIds } : undefined);
    },
    [locationId, token, outletDefault],
  );

  return { outletDefault, loading, refetch, save };
}
