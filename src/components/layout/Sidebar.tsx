import { useEffect, useState } from 'react';
import BrandMark from '../brand/BrandMark';
import UserProfileDropdown from './UserProfileDropdown';
import { CATALOG_NAV, ORDERS_PATH, isCatalogPath } from './navConfig';
import { pcPaths } from '../productCatalog/paths';

interface SidebarProps {
  pathname: string;
  navigate: (to: string) => void;
  user: { initials: string; name: string; role: string; email?: string; business?: string; onLogout: () => void };
}

const itemBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  padding: '11px 14px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: '0.02em',
  color: 'var(--bv-ink-muted)',
  borderLeft: '2px solid transparent',
  transition: 'background .15s ease, color .15s ease',
};

const activeStyle: React.CSSProperties = {
  background: 'var(--bv-gold-tint)',
  color: 'var(--bv-gold-deep)',
  borderLeftColor: 'var(--bv-gold)',
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <span className="material-symbols-rounded" style={{ fontSize: size, flexShrink: 0 }}>
      {name}
    </span>
  );
}

export default function Sidebar({ pathname, navigate, user }: SidebarProps) {
  const onCatalog = isCatalogPath(pathname);
  const [catalogOpen, setCatalogOpen] = useState(onCatalog);

  // Opening a catalog route (deep link / back button) should reveal its group.
  useEffect(() => {
    if (onCatalog) setCatalogOpen(true);
  }, [onCatalog]);

  const ordersActive = pathname === ORDERS_PATH || pathname.startsWith(`${ORDERS_PATH}/`);

  return (
    <aside
      style={{
        width: 'var(--sidebar-w)',
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bv-paper)',
        borderRight: '1px solid var(--bv-line)',
      }}
    >
      <div style={{ padding: '28px 22px 22px', display: 'flex', justifyContent: 'center' }}>
        <BrandMark size={56} wordmarkSize={15} stacked />
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 0 16px' }} aria-label="Primary">
        <button
          type="button"
          onClick={() => navigate(ORDERS_PATH)}
          style={{ ...itemBase, ...(ordersActive ? activeStyle : null) }}
          aria-current={ordersActive ? 'page' : undefined}
        >
          <Icon name="receipt_long" />
          <span style={{ flex: 1 }}>Orders</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!onCatalog) navigate(pcPaths.availability);
            setCatalogOpen((o) => (onCatalog ? !o : true));
          }}
          style={{ ...itemBase, ...(onCatalog ? activeStyle : null) }}
          aria-expanded={catalogOpen}
        >
          <Icon name="storefront" />
          <span style={{ flex: 1 }}>Product Catalog</span>
          <span
            className="material-symbols-rounded"
            style={{ fontSize: 20, transform: catalogOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}
          >
            expand_more
          </span>
        </button>

        {catalogOpen && (
          <div style={{ padding: '2px 0 6px 0' }}>
            {CATALOG_NAV.map((leaf) => {
              const active = pathname === leaf.path || pathname.startsWith(`${leaf.path}/`);
              return (
                <button
                  key={leaf.path}
                  type="button"
                  onClick={() => navigate(leaf.path)}
                  style={{
                    ...itemBase,
                    padding: '8px 14px 8px 46px',
                    fontSize: 13,
                    ...(active ? { color: 'var(--bv-gold-deep)', fontWeight: 600 } : null),
                  }}
                  aria-current={active ? 'page' : undefined}
                >
                  <span style={{ flex: 1 }}>{leaf.label}</span>
                  {active && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--bv-gold)' }} />}
                </button>
              );
            })}
          </div>
        )}
      </nav>

      <div style={{ borderTop: '1px solid var(--bv-line)', padding: '10px 14px 14px' }}>
        <UserProfileDropdown user={user} />
      </div>
    </aside>
  );
}
