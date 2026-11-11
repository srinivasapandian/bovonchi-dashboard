import { useNavigate } from 'react-router-dom';
import { pcPaths } from '../paths';
import { useItemsStore, useCategoriesStore, useMenusStore, useModifiersStore, useVariationSetsStore, useSessionsStore, useKitchenStationsStore, useCombosStore } from '../../../redux/productCatalog/productCatalogHooks';
import { useMediaQuery } from '../hooks/useMediaQuery';
import DesktopLayout from '../../layout/DesktopLayout';
import BottomNav from '../../BottomNav';
import { useDesktopTopBar } from '../../../context/DesktopLayoutContext';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useBranch } from '../../../context/BranchContext';
import { useErrorToast } from '../hooks/useErrorToast';
import UserProfileDropdown, { getInitials } from '../../layout/UserProfileDropdown';

const MODULES = [
  { icon: 'inventory_2', label: 'Items', desc: 'Manage menu items, pricing & availability', path: pcPaths.items, color: '#B89550', countKey: 'items' as const },
  { icon: 'category', label: 'Categories', desc: 'Organize items into categories', path: pcPaths.categories, color: '#8C6A7A', countKey: 'categories' as const },
  { icon: 'tune', label: 'Modifiers', desc: 'Add-ons, toppings & customizations', path: pcPaths.modifiers, color: '#5E8C7B', countKey: 'modifiers' as const },
  { icon: 'schedule', label: 'Sessions', desc: 'Time-based availability slots', path: pcPaths.sessions, color: '#5F7A55', countKey: 'sessions' as const },
  { icon: 'soup_kitchen', label: 'Kitchen Stations', desc: 'Routing & printer configuration', path: pcPaths.kitchenStations, color: '#A63D2F', countKey: 'stations' as const },
  { icon: 'sync', label: 'Sync History', desc: 'Track menu sync to devices', path: pcPaths.syncHistory, color: '#8A7F72', countKey: null },
];

/**
 * Keep prefetch dedupe outside the component so it survives StrictMode remounts.
 */
const hubPrefetchByKey: Record<string, Promise<void> | null> = {};

function CountLineShimmer({ compact }: { compact?: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        height: 11,
        width: compact ? 68 : 84,
        borderRadius: 2,
        background: 'linear-gradient(90deg, #F1ECE2 25%, #E8E0D1 37%, #F1ECE2 63%)',
        backgroundSize: '220% 100%',
        animation: 'pc-hub-count-shimmer 1.1s ease-in-out infinite',
      }}
    />
  );
}

export default function InventoryHubPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { selectedBranch } = useBranch();
  const { auth, logout } = useAuth();

  const { items, fetchItems, error: itemsError } = useItemsStore();
  const { categories, error: categoriesError } = useCategoriesStore();
  const { menus, fetchMenus, error: menusError } = useMenusStore();
  const { combos, fetchCombos, error: combosError } = useCombosStore();
  const { modifiers, fetchModifiers, error: modifiersError } = useModifiersStore();
  const { variationSets, fetchVariationSets, error: optionSetsError } = useVariationSetsStore();
  const { sessions, fetchSessions, error: sessionsError } = useSessionsStore();
  const { stations, fetchStations, error: stationsError } = useKitchenStationsStore();

  const locationId = useMemo(
    () => selectedBranch?.id ?? selectedBranch?.locationId ?? '',
    [selectedBranch?.id, selectedBranch?.locationId],
  );
  const tokenStr = useMemo(
    () => String(auth?.accessToken ?? auth?.access_token ?? ''),
    [auth?.accessToken, auth?.access_token],
  );

  const [hubCountsReady, setHubCountsReady] = useState(() => !locationId);
  const hubBatchGenRef = useRef(0);

  useErrorToast(itemsError, { fallbackMessage: 'Failed to load items' });
  useErrorToast(categoriesError, { fallbackMessage: 'Failed to load categories' });
  useErrorToast(menusError, { fallbackMessage: 'Failed to load menus' });
  useErrorToast(combosError, { fallbackMessage: 'Failed to load combos' });
  useErrorToast(modifiersError, { fallbackMessage: 'Failed to load modifiers' });
  useErrorToast(optionSetsError, { fallbackMessage: 'Failed to load variation sets' });
  useErrorToast(sessionsError, { fallbackMessage: 'Failed to load sessions' });
  useErrorToast(stationsError, { fallbackMessage: 'Failed to load kitchen stations' });

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({ title: 'Product Catalog', breadcrumbs: '' });
  }, [setTopBarProps]);

  useEffect(() => {
    if (!locationId) {
      setHubCountsReady(true);
      return;
    }
    const token = tokenStr ? tokenStr : null;
    const hubKey = `${locationId}|${token ?? ''}`;
    const batchId = ++hubBatchGenRef.current;
    setHubCountsReady(false);
    if (!hubPrefetchByKey[hubKey]) {
      const fetchOpts = { skipDuplicateMs: 3000 } as const;
      hubPrefetchByKey[hubKey] = Promise.all([
        fetchItems(locationId, token, fetchOpts),
        fetchCombos(locationId, token, fetchOpts),
        fetchMenus(locationId, token, fetchOpts),
        fetchModifiers(locationId, token, fetchOpts),
        fetchVariationSets(locationId, token, fetchOpts),
        fetchSessions(locationId, token, fetchOpts),
        fetchStations(locationId, token, fetchOpts),
      ])
        .then(() => undefined)
        .catch(() => undefined)
        .finally(() => {
          hubPrefetchByKey[hubKey] = null;
        });
    }
    void hubPrefetchByKey[hubKey]?.finally(() => {
      if (hubBatchGenRef.current !== batchId) return;
      setHubCountsReady(true);
    });
    return () => {
      hubBatchGenRef.current += 1;
    };
  }, [
    locationId,
    tokenStr,
    fetchItems,
    fetchCombos,
    fetchMenus,
    fetchModifiers,
    fetchVariationSets,
    fetchSessions,
    fetchStations,
  ]);

  const counts: Record<string, number> = {
    items: items.length,
    categories: categories.length,
    combos: combos.length,
    menus: menus.length,
    modifiers: modifiers.length,
    variationSets: variationSets.length,
    sessions: sessions.length,
    stations: stations.length,
  };

  const displayName = auth?.fullName ?? auth?.userId ?? auth?.userName ?? 'User';
  const userRole = auth?.role ?? auth?.designation ?? 'Restaurant_Manager';
  const user = {
    initials: getInitials(displayName),
    name: displayName,
    role: userRole,
    onLogout: () => logout(),
  };

  const content = (
    <div style={{ padding: isMobile ? 16 : 32 }}>
      {isMobile && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 50, background: '#fff',
          borderBottom: '1px solid #E6DFD3', padding: '14px 16px',
          margin: '-16px -16px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#453F39', margin: 0 }}>Inventory</h1>
            <UserProfileDropdown user={user} iconOnly />
          </div>
          <p style={{ fontSize: 12, color: '#6E665D', margin: '4px 0 0' }}>Manage your product catalog</p>
        </div>
      )}

      {!isMobile && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: '#6E665D', margin: 0 }}>Manage your entire product catalog from one place</p>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: isMobile ? 12 : 16,
      }}>
        <style>{`
          @keyframes pc-hub-count-shimmer {
            0% { background-position: -160px 0; }
            100% { background-position: calc(160px + 100%) 0; }
          }
        `}</style>
        {MODULES.map((mod) => (
          <div
            key={mod.label}
            onClick={() => navigate(mod.path)}
            style={{
              background: '#fff',
              borderRadius: 2,
              border: '1px solid #E6DFD3',
              padding: isMobile ? '16px 14px' : '20px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              flexDirection: 'column',
              gap: isMobile ? 10 : 12,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = mod.color;
              (e.currentTarget as HTMLDivElement).style.boxShadow = `0 2px 12px ${mod.color}15`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = '#E6DFD3';
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 12 }}>
              <div style={{
                width: isMobile ? 40 : 44,
                height: isMobile ? 40 : 44,
                borderRadius: 2,
                background: `${mod.color}12`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: isMobile ? 20 : 22, color: mod.color }}>
                  {mod.icon}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: 600,
                  color: '#453F39',
                  marginBottom: 2,
                }}>
                  {mod.label}
                </div>
                {mod.countKey && (
                  <div style={{ fontSize: 11, color: '#9A9084', fontWeight: 500, minHeight: 14 }}>
                    {hubCountsReady ? (
                      <>
                        {counts[mod.countKey]} {mod.label.toLowerCase()}
                      </>
                    ) : (
                      <CountLineShimmer compact={isMobile} />
                    )}
                  </div>
                )}
              </div>
            </div>
            {!isMobile && (
              <div style={{ fontSize: 12, color: '#6E665D', lineHeight: 1.4 }}>
                {mod.desc}
              </div>
            )}
            {isMobile && (
              <div style={{ fontSize: 11, color: '#6E665D', lineHeight: 1.3 }}>
                {mod.desc}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif", paddingBottom: 80 }}>
        {content}
        <BottomNav />
      </div>
    );
  }

  return <DesktopLayout>{content}</DesktopLayout>;
}
