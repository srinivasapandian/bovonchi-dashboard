import { useLocation } from 'react-router-dom';
import { useNavigationGuard } from '../context/NavigationGuardContext';
import { ORDERS_PATH, isCatalogPath } from './layout/navConfig';
import { pcPaths } from './productCatalog/paths';

const NAV_HEIGHT = 68;
const PAD_BOTTOM = 'max(8px, env(safe-area-inset-bottom))';

const ITEMS = [
  { icon: 'receipt_long', label: 'Orders', path: ORDERS_PATH, match: (p: string) => p.startsWith(ORDERS_PATH) },
  { icon: 'storefront', label: 'Catalog', path: pcPaths.availability, match: isCatalogPath },
  { icon: 'inventory_2', label: 'Items', path: pcPaths.items, match: (p: string) => p.startsWith(pcPaths.items) },
  { icon: 'category', label: 'Categories', path: pcPaths.categories, match: (p: string) => p.startsWith(pcPaths.categories) },
];

/** Mobile tab bar. Exposes the same default export the ported catalog screens import. */
const BottomNav = (_props?: unknown) => {
  const { pathname } = useLocation();
  const { guardedNavigate } = useNavigationGuard();
  // "Catalog" is the group root, so it should only light up when no sibling tab claims the path.
  const activeIdx = (() => {
    const specific = ITEMS.findIndex((it, i) => i > 1 && it.match(pathname));
    if (specific >= 0) return specific;
    return ITEMS.findIndex((it) => it.match(pathname));
  })();

  return (
    <>
      <div style={{ height: NAV_HEIGHT, paddingBottom: PAD_BOTTOM, flexShrink: 0 }} />
      <nav
        aria-label="Primary"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          height: NAV_HEIGHT,
          paddingBottom: PAD_BOTTOM,
          boxSizing: 'content-box',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          background: 'var(--bv-paper)',
          borderTop: '1px solid var(--bv-line)',
        }}
      >
        {ITEMS.map((item, i) => {
          const active = i === activeIdx;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => guardedNavigate(item.path)}
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '4px 14px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: active ? 'var(--bv-gold-deep)' : 'var(--bv-ink-faint)',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 22, fontVariationSettings: `'FILL' ${active ? 1 : 0}` }}>
                {item.icon}
              </span>
              <span style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: active ? 600 : 400 }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

export default BottomNav;
