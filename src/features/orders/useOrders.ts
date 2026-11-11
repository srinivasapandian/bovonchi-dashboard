import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchOrders, ALL_PAYMENT_FILTERS } from './ordersApi';
import type { PaymentFilter } from './ordersApi';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 500;
const SEARCH_MIN_CHARS = 2; // Merchant App only searches once 2+ characters are typed

export interface OrdersFilters {
  locationId: string;
  date: string;
  sort: string;
  tab: 'all' | PaymentFilter;
  search: string;
}

/**
 * Paged, infinite-scroll order list (the Scroll screen's behaviour): page 0 on any filter change,
 * `loadMore()` appends the next page, `refresh()` re-reads page 0 in place.
 * Out-of-order responses are discarded with a request generation counter + AbortController.
 */
export function useOrders(filters: OrdersFilters) {
  const { locationId, date, sort, tab, search } = filters;
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gen = useRef(0);
  const abort = useRef<AbortController | null>(null);

  // Debounce the search box; ignore 1-char queries (treated as "no search").
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim().length >= SEARCH_MIN_CHARS ? search.trim() : ''), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const paymentStatus = tab === 'all' ? ALL_PAYMENT_FILTERS : [tab];

  const query = useCallback(
    (pageNo: number) => ({ locationId, date, page: pageNo, size: PAGE_SIZE, sort, search: debounced, paymentStatus }),
    // `paymentStatus` is derived from `tab`
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locationId, date, sort, tab, debounced],
  );

  const load = useCallback(
    async (mode: 'reset' | 'refresh') => {
      if (!locationId) return;
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;
      const mine = ++gen.current;
      if (mode === 'reset') {
        setLoading(true);
        setOrders([]);
        setPage(0);
        setTotalPages(0);
      }
      setError(null);
      try {
        const res = await fetchOrders(query(0), ctl.signal);
        if (mine !== gen.current) return;
        setOrders(res.content);
        setTotal(res.totalElements);
        setTotalPages(res.totalPages);
        setPage(0);
      } catch (e: any) {
        if (mine !== gen.current || e?.code === 'ERR_CANCELED') return;
        setError(e?.message || 'Could not load orders.');
        if (mode === 'reset') setTotal(0);
      } finally {
        if (mine === gen.current) setLoading(false);
      }
    },
    [locationId, query],
  );

  useEffect(() => {
    load('reset');
    return () => abort.current?.abort();
  }, [load]);

  const hasMore = page + 1 < totalPages;

  const loadMore = useCallback(async () => {
    if (!locationId || loading || loadingMore || !hasMore) return;
    const mine = gen.current;
    setLoadingMore(true);
    try {
      const res = await fetchOrders(query(page + 1));
      if (mine !== gen.current) return; // filters changed while this page was in flight
      setOrders((prev) => {
        const seen = new Set(prev.map((o) => o.orderId));
        return [...prev, ...res.content.filter((o) => !seen.has(o.orderId))];
      });
      setTotal(res.totalElements);
      setTotalPages(res.totalPages);
      setPage(res.page);
    } catch (e: any) {
      if (mine === gen.current) setError(e?.message || 'Could not load more orders.');
    } finally {
      setLoadingMore(false);
    }
  }, [locationId, loading, loadingMore, hasMore, query, page]);

  const refresh = useCallback(() => load('refresh'), [load]);

  return { orders, total, loading, loadingMore, error, hasMore, loadMore, refresh };
}
