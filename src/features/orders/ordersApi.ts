import axios from 'axios';
import { parseResponse } from '../../services/crypto';
import { CREDENTIALS } from '../../constants';

/**
 * Orders ("Scroll") API — the same endpoints the Merchant App's Scroll screen calls:
 *   POST /api/v2/orders/filter   paged list (date / payment status / search / sort)
 *   GET  /api/v2/orders/{id}     one order with items, totals and delivery address
 * Both authenticate with the staff Bearer token issued by /merchants/staff/login.
 */

export const UNAUTHORIZED_EVENT = 'bv:unauthorized';

const http = axios.create({
  baseURL: (process.env.REACT_APP_API_ENDPOINT as string) || '',
  timeout: 60_000,
  // Responses can be AES-wrapped (see services/crypto); take the raw text and decode ourselves.
  responseType: 'text',
  transformResponse: [(d) => d],
  validateStatus: () => true,
});

function bearer(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CREDENTIALS);
    const c = raw ? JSON.parse(raw) : null;
    const token = c?.accessToken ?? c?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function request<T = any>(config: Parameters<typeof http.request>[0]): Promise<T> {
  const res = await http.request({
    ...config,
    headers: { 'Content-Type': 'application/json', ...bearer(), ...(config.headers as object) },
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new Error('Your session has expired. Please sign in again.');
  }
  const body = parseResponse(typeof res.data === 'string' ? res.data : JSON.stringify(res.data));
  if (res.status >= 400) {
    const msg =
      (typeof body === 'object' && (body?.message ?? body?.metaDataInfo?.responseMessage)) ||
      (res.status === 403 ? 'You do not have permission to view orders.' : 'Something went wrong. Please try again.');
    throw new Error(msg);
  }
  return body as T;
}

export type PaymentFilter = 'unpaid' | 'paid' | 'cancelled' | 'refund';
export const ALL_PAYMENT_FILTERS: PaymentFilter[] = ['unpaid', 'paid', 'cancelled', 'refund'];

export interface OrdersQuery {
  locationId: string;
  date: string; // YYYY-MM-DD (outlet-local)
  page: number;
  size: number;
  sort: string;
  search?: string;
  paymentStatus: PaymentFilter[];
}

export interface OrdersPage {
  content: any[];
  totalElements: number;
  totalPages: number;
  page: number;
}

/** Normalise the three shapes the backend has returned for a paged result. */
function toPage(body: any, page: number): OrdersPage {
  const root = body?.metaDataInfo?.data ?? body?.data ?? body;
  const content = Array.isArray(root?.content) ? root.content : Array.isArray(root) ? root : [];
  return {
    content,
    totalElements: Number(root?.totalElements ?? content.length),
    totalPages: Number(root?.totalPages ?? (content.length ? 1 : 0)),
    page,
  };
}

const MOCK = import.meta.env.DEV && import.meta.env.VITE_MOCK_ORDERS === 'true';

export async function fetchOrders(q: OrdersQuery, signal?: AbortSignal): Promise<OrdersPage> {
  if (MOCK) return (await import('./ordersMock')).mockOrders(q);
  const body: Record<string, unknown> = {
    locationId: q.locationId,
    startDate: q.date,
    endDate: q.date,
    page: q.page,
    size: q.size,
    sort: q.sort,
    paymentStatus: q.paymentStatus,
  };
  if (q.search && q.search.trim()) body.search = q.search.trim();
  const res = await request({ method: 'post', url: 'api/v2/orders/filter', data: body, signal });
  return toPage(res, q.page);
}

export async function fetchOrderDetail(orderId: string, signal?: AbortSignal): Promise<any> {
  if (MOCK) return (await import('./ordersMock')).mockOrderDetail(orderId);
  const res = await request({ method: 'get', url: `api/v2/orders/${encodeURIComponent(orderId)}`, signal });
  return res?.metaDataInfo?.data ?? res?.data ?? res;
}
