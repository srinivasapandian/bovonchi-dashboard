import type { PaymentFilter } from './ordersApi';

/** Backend order-status codes the payment pill is derived from (Merchant App ORDER_STATUS_CODES). */
const CANCELLED = new Set(['8', '9', '53']);
const REFUND = new Set(['26', '28', '32', '54', '55']);

export type PaymentState = PaymentFilter;

export function paymentState(order: any): PaymentState {
  const status = String(order?.statusId ?? order?.status ?? '');
  if (CANCELLED.has(status)) return 'cancelled';
  if (REFUND.has(status)) return 'refund';
  if (order?.isPaid) return 'paid';
  return 'unpaid';
}

export const PAYMENT_LABEL: Record<PaymentState, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  cancelled: 'Cancelled',
  refund: 'Refund',
};

/** "5" / "000005" / 5 → "#000005" */
export function receiptNo(order: any): string {
  const raw = String(order?.orderNo ?? '').replace(/^#/, '');
  return raw ? `#${raw.padStart(6, '0')}` : '—';
}

/** Every order on this dashboard comes through the online storefront, whatever its fulfilment type (pickup / delivery). */
export function channelLabel(_order?: any): string {
  return 'Online';
}

/** The list returns "HH:mm:ss" (outlet-local). Fall back to formatting an ISO timestamp. */
export function orderTimeLabel(order: any): string {
  const t = String(order?.orderTime ?? order?.localTIme ?? '').trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return t.length === 4 ? `0${t}` : t;
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }
  return t || '—';
}

export function formatMoney(value: unknown, symbol: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? '-' : ''}${symbol}${abs}`;
}

export const SORT_OPTIONS = [
  { value: 'orderTime,desc', label: 'Newest first' },
  { value: 'orderTime,asc', label: 'Oldest first' },
  { value: 'orderNo,desc', label: 'Receipt no. ↓' },
  { value: 'orderNo,asc', label: 'Receipt no. ↑' },
  { value: 'requestedTime,asc', label: 'Request time ↑' },
  { value: 'requestedTime,desc', label: 'Request time ↓' },
] as const;

export const TABS: { key: 'all' | PaymentFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'paid', label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'refund', label: 'Refund' },
];

export type ColumnKey = 'channel' | 'receipt' | 'time' | 'amount' | 'name' | 'contact' | 'payment';

export const COLUMNS: { key: ColumnKey; label: string; locked?: boolean }[] = [
  { key: 'channel', label: 'Channel', locked: true },
  { key: 'receipt', label: 'Receipt no.', locked: true },
  { key: 'time', label: 'Order time', locked: true },
  { key: 'amount', label: 'Amount', locked: true },
  { key: 'name', label: 'Name' },
  { key: 'contact', label: 'Contact' },
  { key: 'payment', label: 'Payment' },
];

// ---- Transaction details (paid / refunded orders) --------------------------------------------

const TXN_PAID = new Set(['19', '31']);
const TXN_REFUNDED = new Set(['26', '28']);
const TXN_PARTIAL = new Set(['32']);
const TXN_FAILED = new Set(['20', '21', '22', '23', '27', '30', '33']);
const TXN_PENDING = new Set(['18', '24', '25', '54', '55']);

export interface TxnView {
  key: string;
  amount: number;
  status: string;
  tone: 'paid' | 'refund' | 'failed' | 'pending';
  when: string;
  rows: { label: string; value: string; money?: boolean }[];
}

/** "Oct 28, 2026 – 02:11 PM" in the outlet's timezone. Timestamps without a zone are UTC. */
export function formatTxnDate(raw: unknown, tz?: string): string {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  if (/T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s += 'Z';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const opts = tz ? { timeZone: tz } : {};
  const date = d.toLocaleDateString('en-US', { ...opts, month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { ...opts, hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date} – ${time}`;
}

export function transactionViews(detail: any, tz?: string): TxnView[] {
  const list: any[] = Array.isArray(detail?.transactions)
    ? detail.transactions
    : Array.isArray(detail?.transactionsToShow)
      ? detail.transactionsToShow
      : [];
  return list.map((t, i) => {
    const code = String(t?.statusId ?? t?.statusCd ?? t?.statusCode ?? '');
    let status = 'Paid';
    let tone: TxnView['tone'] = 'paid';
    if (TXN_REFUNDED.has(code)) [status, tone] = ['Refunded', 'refund'];
    else if (TXN_PARTIAL.has(code)) [status, tone] = ['Partially Refunded', 'refund'];
    else if (TXN_FAILED.has(code)) [status, tone] = ['Failed', 'failed'];
    else if (TXN_PENDING.has(code)) [status, tone] = ['Pending', 'pending'];
    else if (!TXN_PAID.has(code) && code === '') status = 'Paid';

    const amount = Number(t?.transactionAmount ?? t?.amountTendered ?? t?.tenderAmount ?? 0);
    const card = [t?.cardType, t?.cardInfo].map((x) => (x ? String(x).trim() : '')).filter(Boolean);
    const message = typeof t?.message === 'string' ? t.message.trim() : '';
    const paymentId = t?.authorizationCode ?? t?.id ?? '';
    const rows: TxnView['rows'] = [{ label: 'Grand Total', value: String(amount), money: true }];
    if (t?.tenderType) rows.push({ label: 'Method', value: String(t.tenderType) });
    if (card.length) rows.push({ label: String(t?.cardType || 'Card').toUpperCase(), value: String(t?.cardInfo ?? card[0]) });
    if (message) rows.push({ label: 'Authorization', value: message });
    if (paymentId) rows.push({ label: 'Payment ID', value: String(paymentId) });
    return { key: String(t?.id ?? i), amount, status, tone, when: formatTxnDate(t?.createdTime ?? t?.modifiedTime, tz), rows };
  });
}
