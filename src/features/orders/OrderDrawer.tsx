import { useEffect, useState } from 'react';
import { fetchOrderDetail } from './ordersApi';
import { formatMoney, paymentState, receiptNo, transactionViews } from './orderModel';

interface Props {
  order: any | null;
  symbol: string;
  /** Outlet IANA timezone, for transaction timestamps. */
  tz?: string;
  onClose: () => void;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function address(d: any): string {
  // The storefront stores the delivery address as the order instruction's comment.
  const instr = Array.isArray(d?.orderInstructions)
    ? d.orderInstructions.map((i: any) => (typeof i?.comments === 'string' ? i.comments.trim() : '')).filter(Boolean)
    : [];
  if (instr.length) return instr.join(', ');
  const parts = [d?.address, d?.addressLine1, d?.addressLine2, d?.addressLine3]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  // `address` is often the joined form of the three lines — don't print both.
  const uniq = parts.filter((p, i) => !parts.some((q, j) => j !== i && q.length > p.length && q.includes(p)));
  return uniq.join(', ');
}

/** Totals come back as [{code,title,value}]. Pull out the ones the receipt calls out by name. */
function summarise(detail: any, items: any[]) {
  const totals: any[] = Array.isArray(detail?.totals) ? detail.totals : [];
  const find = (re: RegExp) => totals.find((t) => re.test(String(t?.title ?? '')));
  const itemTotal = find(/item\s*total|sub\s*total/i);
  const tax = find(/^tax|tax$/i);
  const tip = find(/tip|gratuity/i);
  const grand = find(/grand\s*total|^total$/i);
  const itemSum = items.reduce((s, it) => s + num(it.subTotal ?? num(it.price) * num(it.quantity)), 0);
  const rest = totals.filter((t) => ![itemTotal, tax, tip, grand].includes(t) && num(t?.value) !== 0);
  return {
    itemTotal: itemTotal ? num(itemTotal.value) : itemSum,
    tax: tax ? num(tax.value) : 0,
    tip: tip ? num(tip.value) : num(detail?.tip),
    grand: grand ? num(grand.value) : num(detail?.orderTotal),
    rest,
  };
}

export default function OrderDrawer({ order, symbol, tz, onClose }: Props) {
  const [openTxn, setOpenTxn] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!order) return;
    const ctl = new AbortController();
    setDetail(null);
    setError(null);
    setLoading(true);
    fetchOrderDetail(order.orderId, ctl.signal)
      .then(setDetail)
      .catch((e) => {
        if (e?.code !== 'ERR_CANCELED') setError(e?.message || 'Could not load this receipt.');
      })
      .finally(() => !ctl.signal.aborted && setLoading(false));
    return () => ctl.abort();
  }, [order]);

  useEffect(() => {
    if (!order) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [order, onClose]);

  if (!order) return null;

  // The list row already carries name/contact; the detail call fills in address, items and totals.
  const d = { ...order, ...(detail ?? {}) };
  const items: any[] = Array.isArray(detail?.items) ? detail.items : [];
  const sums = summarise(detail, items);
  const addr = address(d);
  const showTxns = ['paid', 'refund'].includes(paymentState(order));
  const txns = showTxns ? transactionViews(detail, tz) : [];
  const money = (v: unknown) => formatMoney(v, symbol);

  return (
    <div className="bv-drawer-root" role="dialog" aria-modal="true" aria-label={`Receipt ${receiptNo(order)}`}>
      <button type="button" className="bv-drawer-scrim" aria-label="Close receipt" onClick={onClose} />
      <aside className="bv-drawer">
        <header className="bv-drawer__head">
          <h2>Receipt {receiptNo(order)}</h2>
          <button type="button" className="bv-icon-btn" onClick={onClose} aria-label="Close">
            <span className="material-symbols-rounded">close</span>
          </button>
        </header>

        <div className="bv-drawer__body">
          {error && <p className="bv-drawer__error">{error}</p>}

          {(addr || loading) && (
            <section className="bv-drawer__address">
              <div className="bv-eyebrow">Delivery address</div>
              {loading && !addr ? <div className="bv-skeleton" style={{ width: '70%', height: 16 }} /> : <p>{addr}</p>}
            </section>
          )}

          <section>
            <h3>Customer Info</h3>
            <div className="bv-drawer__row">
              <span>{d.fullName || '—'}</span>
              {d.phone ? <a href={`tel:${d.phone}`}>{d.phone}</a> : null}
            </div>
            {d.email ? <div className="bv-drawer__muted">{d.email}</div> : null}
          </section>

          <section>
            <h3>Piece Details</h3>
            {loading && !items.length ? (
              <>
                <div className="bv-skeleton" style={{ width: '90%', height: 16, marginBottom: 10 }} />
                <div className="bv-skeleton" style={{ width: '60%', height: 16 }} />
              </>
            ) : items.length ? (
              items.map((it, i) => (
                <div key={it.id ?? i} className="bv-drawer__row bv-drawer__item">
                  <span>
                    {it.itemName}
                    {Array.isArray(it.options) && it.options.length ? (
                      <small>{it.options.map((o: any) => o.optionName ?? o.name).filter(Boolean).join(', ')}</small>
                    ) : null}
                  </span>
                  <span className="bv-drawer__qty">X {it.quantity}</span>
                  <span className="bv-drawer__amt">{money(it.subTotal ?? num(it.price) * num(it.quantity))}</span>
                </div>
              ))
            ) : (
              !loading && <div className="bv-drawer__muted">No pieces on this order.</div>
            )}
          </section>

          <section>
            <h3>Bill Details</h3>
            <div className="bv-drawer__row">
              <span>Item Total</span>
              <span>{money(sums.itemTotal)}</span>
            </div>
            <div className="bv-drawer__row">
              <span>Tax</span>
              <span>{money(sums.tax)}</span>
            </div>
            <div className="bv-drawer__row">
              <span>Tip</span>
              <span>{money(sums.tip)}</span>
            </div>
            {sums.rest.map((t: any, i: number) => (
              <div key={t.code ?? i} className="bv-drawer__row">
                <span>{t.title}</span>
                <span>{money(t.value)}</span>
              </div>
            ))}
            <div className="bv-drawer__row bv-drawer__grand">
              <span>Grand Total</span>
              <span>{money(sums.grand)}</span>
            </div>
          </section>

          {txns.length > 0 && (
            <section>
              <h3>Transaction Details</h3>
              <div className="bv-txns">
                {txns.map((t, i) => {
                  const open = (openTxn ?? txns[0].key) === t.key || (openTxn === null && i === 0);
                  return (
                    <div key={t.key} className={`bv-txn${open ? ' is-open' : ''}`}>
                      <button
                        type="button"
                        className="bv-txn__head"
                        aria-expanded={open}
                        onClick={() => setOpenTxn(open ? '' : t.key)}
                      >
                        <span>
                          <strong>{money(t.amount)}</strong>
                          <em className={`bv-txn__status bv-txn__status--${t.tone}`}>({t.status})</em>
                          {t.when ? <small>{t.when}</small> : null}
                        </span>
                        <span className="material-symbols-rounded" style={{ transform: open ? 'none' : 'rotate(180deg)' }}>
                          expand_less
                        </span>
                      </button>
                      {open && (
                        <div className="bv-txn__body">
                          {t.rows.map((r) => (
                            <div key={r.label} className="bv-txn__row">
                              <span>{r.label}</span>
                              <span>{r.money ? money(r.value) : r.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}        </div>

        <footer className="bv-drawer__foot">
          <span className="bv-eyebrow">Receipt total</span>
          <strong>{money(sums.grand || order.orderTotal)}</strong>
        </footer>
      </aside>
    </div>
  );
}
