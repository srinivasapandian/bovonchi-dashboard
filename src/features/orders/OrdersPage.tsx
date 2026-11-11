import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { useDesktopTopBar } from '../../context/DesktopLayoutContext';
import { useMediaQuery } from '../../components/productCatalog/hooks/useMediaQuery';
import { getStoreTodayYmd } from '../../utils/dateTimeUtils';
import { useCurrencySymbol } from '../../utils/currency';
import DesktopLayout from '../../components/layout/DesktopLayout';
import BottomNav from '../../components/BottomNav';
import BrandMark from '../../components/brand/BrandMark';
import OrderDrawer from './OrderDrawer';
import DatePicker, { shortDate } from './DatePicker';
import { useOrders } from './useOrders';
import {
  COLUMNS,
  PAYMENT_LABEL,
  SORT_OPTIONS,
  TABS,
  channelLabel,
  formatMoney,
  orderTimeLabel,
  paymentState,
  receiptNo,
} from './orderModel';
import type { ColumnKey } from './orderModel';
import './orders.css';

const COLUMNS_KEY = 'bv:orders:columns';
const OPTIONAL: ColumnKey[] = ['name', 'contact', 'payment'];

function loadColumns(): ColumnKey[] {
  try {
    const raw = localStorage.getItem(COLUMNS_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as ColumnKey[];
      const locked = COLUMNS.filter((c) => c.locked).map((c) => c.key);
      return [...locked, ...saved.filter((k) => OPTIONAL.includes(k))];
    }
  } catch {
    /* fall through to defaults */
  }
  return COLUMNS.map((c) => c.key);
}

const GRID: Record<ColumnKey, string> = {
  channel: 'minmax(90px, 1fr)',
  receipt: 'minmax(110px, 1.1fr)',
  time: 'minmax(110px, 1.1fr)',
  amount: 'minmax(90px, .9fr)',
  name: 'minmax(110px, 1.2fr)',
  contact: 'minmax(150px, 1.6fr)',
  payment: 'minmax(100px, 1fr)',
};

function PaymentPill({ order }: { order: any }) {
  const state = paymentState(order);
  return <span className={`bv-pill bv-pill--${state}`}>{PAYMENT_LABEL[state]}</span>;
}

function useClickAway(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

function OrdersContent({ isMobile, onTotal }: { isMobile: boolean; onTotal: (n: number) => void }) {
  const { selectedBranch } = useBranch();
  const symbol = useCurrencySymbol();
  const locationId: string = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
  const tz: string | undefined = selectedBranch?.timeZoneCd;

  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<string>(SORT_OPTIONS[0].value);
  const [date, setDate] = useState<string>(() => getStoreTodayYmd(tz));
  const [columns, setColumns] = useState<ColumnKey[]>(loadColumns);
  const [colsOpen, setColsOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  // Once the outlet's timezone is known, "today" may differ from the browser's — re-anchor once.
  const anchoredTz = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (tz && anchoredTz.current !== tz) {
      anchoredTz.current = tz;
      setDate(getStoreTodayYmd(tz));
    }
  }, [tz]);

  const { orders, total, loading, loadingMore, error, hasMore, loadMore, refresh } = useOrders({
    locationId,
    date,
    sort,
    tab,
    search,
  });

  useEffect(() => onTotal(total), [total, onTotal]);

  // Infinite scroll: load the next page when the sentinel nears the viewport.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const root = document.querySelector('[data-desktop-main-scroll]');
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), {
      root: isMobile ? null : root,
      rootMargin: '320px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore, isMobile, orders.length]);

  // Re-read the list when the tab regains focus (new orders arrive while it's in the background).
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const closeCols = useCallback(() => setColsOpen(false), []);
  const closeSort = useCallback(() => setSortOpen(false), []);
  const colsRef = useClickAway(colsOpen, closeCols);
  const sortRef = useClickAway(sortOpen, closeSort);

  const visible = useMemo(() => COLUMNS.filter((c) => columns.includes(c.key)), [columns]);
  const gridTemplate = visible.map((c) => GRID[c.key]).join(' ');

  const toggleColumn = (key: ColumnKey) => {
    setColumns((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        localStorage.setItem(COLUMNS_KEY, JSON.stringify(next.filter((k) => OPTIONAL.includes(k))));
      } catch {
        /* storage unavailable — keep the in-memory choice */
      }
      return next;
    });
  };
  const clearOptional = () => {
    const locked = COLUMNS.filter((c) => c.locked).map((c) => c.key);
    setColumns(locked);
    try {
      localStorage.setItem(COLUMNS_KEY, JSON.stringify([]));
    } catch {
      /* ignore */
    }
  };

  const cell = (key: ColumnKey, o: any) => {
    switch (key) {
      case 'channel':
        return channelLabel(o);
      case 'receipt':
        return <strong>{receiptNo(o)}</strong>;
      case 'time':
        return orderTimeLabel(o);
      case 'amount':
        return formatMoney(o.orderTotal, symbol);
      case 'name':
        return o.fullName || '—';
      case 'contact':
        return o.phone || '—';
      case 'payment':
        return <PaymentPill order={o} />;
    }
  };

  const sortLabel = SORT_OPTIONS.find((s) => s.value === sort)?.label ?? 'Sort';

  return (
    <div className="bv-orders">
      <nav className="bv-tabs" aria-label="Order status">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`bv-tab${tab === t.key ? ' is-active' : ''}`}
            aria-current={tab === t.key ? 'true' : undefined}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="bv-controls">
        <label className="bv-search">
          <span className="material-symbols-rounded" aria-hidden>
            search
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search receipt no., name or phone"
            aria-label="Search orders"
          />
        </label>

        <div className="bv-popwrap" ref={colsRef}>
          <button
            type="button"
            className={`bv-ctl bv-ctl--icon${colsOpen ? ' is-open' : ''}`}
            aria-label="Choose columns"
            aria-expanded={colsOpen}
            onClick={() => setColsOpen((o) => !o)}
          >
            <span className="material-symbols-rounded">tune</span>
          </button>
          {colsOpen && (
            <div className="bv-pop" role="menu">
              <button type="button" className="bv-pop__clear" onClick={clearOptional}>
                Clear all
              </button>
              {COLUMNS.map((c) => (
                <label key={c.key} className={`bv-check${c.locked ? ' is-locked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={columns.includes(c.key)}
                    disabled={c.locked}
                    onChange={() => toggleColumn(c.key)}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <DatePicker value={date} max={getStoreTodayYmd(tz)} onChange={setDate} />

        <div className="bv-popwrap bv-popwrap--sort" ref={sortRef}>
          <button
            type="button"
            className={`bv-ctl bv-ctl--sort${sortOpen ? ' is-open' : ''}`}
            aria-haspopup="listbox"
            aria-expanded={sortOpen}
            onClick={() => setSortOpen((o) => !o)}
          >
            <span>{sortLabel}</span>
            <span className="material-symbols-rounded">expand_more</span>
          </button>
          {sortOpen && (
            <ul className="bv-pop bv-pop--list" role="listbox">
              {SORT_OPTIONS.map((s) => (
                <li key={s.value} role="option" aria-selected={s.value === sort}>
                  <button
                    type="button"
                    className={s.value === sort ? 'is-active' : ''}
                    onClick={() => {
                      setSort(s.value);
                      setSortOpen(false);
                    }}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error && (
        <div className="bv-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={refresh}>
            Try again
          </button>
        </div>
      )}

      {isMobile ? (
        <ul className="bv-cards" aria-busy={loading}>
          {orders.map((o) => (
            <li key={o.orderId}>
              <button type="button" className="bv-card" onClick={() => setSelected(o)}>
                <div className="bv-card__top">
                  <strong>{receiptNo(o)}</strong>
                  <span>{formatMoney(o.orderTotal, symbol)}</span>
                </div>
                <div className="bv-card__meta">
                  <span>{channelLabel(o)}</span>
                  <span>{orderTimeLabel(o)}</span>
                  {columns.includes('name') && o.fullName ? <span>{o.fullName}</span> : null}
                </div>
                {columns.includes('payment') && <PaymentPill order={o} />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="bv-table" role="table" aria-busy={loading} aria-rowcount={total}>
          <div className="bv-table__head" role="row" style={{ gridTemplateColumns: gridTemplate }}>
            {visible.map((c) => (
              <div key={c.key} role="columnheader" className={c.key === 'amount' ? 'is-right' : ''}>
                {c.label.replace('Receipt no.', 'Receipt No.')}
              </div>
            ))}
          </div>
          {orders.map((o) => (
            <button
              key={o.orderId}
              type="button"
              role="row"
              className="bv-table__row"
              style={{ gridTemplateColumns: gridTemplate }}
              onClick={() => setSelected(o)}
            >
              {visible.map((c) => (
                <div key={c.key} role="cell" className={c.key === 'amount' ? 'is-right' : ''}>
                  {cell(c.key, o)}
                </div>
              ))}
            </button>
          ))}
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bv-table__row bv-table__row--ghost" style={{ gridTemplateColumns: gridTemplate }}>
                {visible.map((c) => (
                  <div key={c.key}>
                    <span className="bv-skeleton" style={{ width: `${55 + ((i * 13 + c.key.length * 7) % 35)}%`, height: 14 }} />
                  </div>
                ))}
              </div>
            ))}
          {!loading && !error && orders.length === 0 && (
            <div className="bv-empty">
              <span className="material-symbols-rounded">receipt_long</span>
              <p>No orders for {shortDate(date)}{search.trim().length > 1 ? ` matching “${search.trim()}”` : ''}.</p>
            </div>
          )}
        </div>
      )}

      {isMobile && !loading && !error && orders.length === 0 && (
        <div className="bv-empty">
          <span className="material-symbols-rounded">receipt_long</span>
          <p>No orders for {shortDate(date)}{search.trim().length > 1 ? ` matching “${search.trim()}”` : ''}.</p>
        </div>
      )}

      <div ref={sentinel} className="bv-sentinel" aria-hidden />
      {loadingMore && <div className="bv-more">Loading more orders…</div>}

      <OrderDrawer order={selected} symbol={symbol} tz={tz} onClose={() => setSelected(null)} />
    </div>
  );
}

export default function OrdersPage() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const setTopBar = useDesktopTopBar();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [total, setTotal] = useState(0);
  const countLabel = `${total} ${total === 1 ? 'order' : 'orders'}`;

  useEffect(() => {
    setTopBar({
      title: 'Track Every Order',
      breadcrumbs: 'Orders',
      extraContent: <span className="bv-count">{countLabel}</span>,
    });
  }, [setTopBar, countLabel]);

  if (isMobile) {
    return (
      <div className="bv-mobile-shell">
        <header className="bv-mobile-head">
          <BrandMark size={32} wordmarkSize={13} />
          <button
            type="button"
            className="bv-ghost-btn"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            Sign out
          </button>
        </header>
        <div className="bv-mobile-title">
          <h1>Track Every Order</h1>
          <span className="bv-count">{countLabel}</span>
        </div>
        <OrdersContent isMobile onTotal={setTotal} />
        <BottomNav />
      </div>
    );
  }

  return (
    <DesktopLayout>
      <OrdersContent isMobile={false} onTotal={setTotal} />
    </DesktopLayout>
  );
}
