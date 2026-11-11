import { useState, useMemo, useEffect, useCallback, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { DeleteConfirmationModal, deleteConfirmTitle } from '../../components/ui/DeleteConfirmationModal';
import PageHeader from '../../components/layout/PageHeader';
import CatalogHelpLink from '../../components/layout/CatalogHelpLink';
import MenuTutorial from '../../components/tutorials/menu-tutorial';
import HappyHourWizard from './HappyHourWizard';
import SearchInput from '../../components/forms/SearchInput';
import Select from '../../components/forms/Select';
import { useMenusStore, useCategoriesStore, useItemsStore, useSessionsStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import type { BranchData } from '../../../../types/api';
import type { Menu, OrderType, MenuStatus, MenuItem, Session } from '../../data/types';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { pcPaths, PC_BASE } from '../../paths';
import { ProductCatalogSyncBanner } from '../../components/ui/ProductCatalogSyncBanner';
import {
  catalogListActionButtonStyle,
  catalogListActionEnterDefault,
  catalogListActionLeaveDefault,
  catalogListActionEnterDanger,
  catalogListActionLeaveDanger,
  CATALOG_LIST_ACTION_ICON_PX,
} from '../../catalogEntityActions';
import BottomNav from '../../../BottomNav';
import { useErrorToast } from '../../hooks/useErrorToast';
import { Bone } from '../../../../components/Shimmer';

/* ─── tokens (aligned with Copy MenusPage) ─── */

const ACCENT = '#B89550';
const ACCENT_BG = 'rgba(184,149,80,0.08)';
const T1 = '#453F39';
const T2 = '#6E665D';
const T3 = '#9A9084';
const GREEN = '#5F7A55';
const ORANGE = '#B07A2A';
const BORDER = '#E6DFD3';
const DIVIDER = '#ECE5D8';

const MENU_ICONS = [
  { id: 'default', emoji: '📋' },
  { id: 'coffee', emoji: '☕' },
  { id: 'wine', emoji: '🍷' },
  { id: 'cutlery', emoji: '🍴' },
  { id: 'dessert', emoji: '🍰' },
  { id: 'flame', emoji: '🔥' },
  { id: 'star', emoji: '⭐' },
  { id: 'leaf', emoji: '🌿' },
] as const;

const orderTypeLabels: Record<OrderType, string> = {
  dine_in: 'Dine In',
  takeout: 'Takeout',
  delivery: 'Delivery',
  online_ordering: 'Online Ordering',
  catering: 'Catering',
};

const statusPriority: Record<string, number> = { live: 0, scheduled: 1, draft: 2 };

/** Location branch `orderTypes`: id → display name (enabled, non–in-store only). */
function locationOrderTypeNameById(selectedBranch: BranchData | null): Map<string, string> {
  const m = new Map<string, string>();
  const raw = selectedBranch?.orderTypes;
  if (!Array.isArray(raw)) return m;
  for (const entry of raw) {
    const row = entry as { id?: string; typeName?: string; typeGroup?: string; isEnabled?: number | boolean };
    const id = String(row.id ?? '').trim();
    if (!id) continue;
    // Include disabled (isEnabled: 0) order types too; still exclude in-store.
    const notInstore = (row.typeGroup ?? 'T') !== 'I';
    if (!notInstore) continue;
    const name = String(row.typeName ?? '').trim();
    m.set(id, name || id);
  }
  return m;
}

function menuOrderTypePillsForDisplay(menu: Menu, nameById: Map<string, string>): Array<{ key: string; label: string }> {
  const ids = menu.assignedOrderTypeIds ?? [];
  if (ids.length > 0 && nameById.size > 0) {
    const out: Array<{ key: string; label: string }> = [];
    const seen = new Set<string>();
    for (const tid of ids) {
      const id = String(tid).trim();
      if (!id || seen.has(id) || !nameById.has(id)) continue;
      seen.add(id);
      out.push({ key: id, label: nameById.get(id)! });
    }
    return out;
  }
  if (nameById.size === 0) {
    return (menu.channels ?? []).map((ch) => ({ key: ch, label: orderTypeLabels[ch] }));
  }
  return [];
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

function getMenuEmoji(iconId?: string): string {
  if (!iconId) return '📋';
  const found = MENU_ICONS.find((i) => i.id === iconId);
  if (found) return found.emoji;
  return '📋';
}

/** Count of device rows stored on the menu (API `devices` → `deviceIds`). */
function countAssignedMenuDevices(menu: Menu): number {
  const ids = menu.deviceIds ?? [];
  return new Set(ids.map((id) => String(id).trim()).filter(Boolean)).size;
}


function getMenuSessions(menu: Menu, allSessions: Session[]): Session[] {
  if (!menu.sessionIds || menu.sessionIds.length === 0) return [];
  return allSessions.filter((s) => menu.sessionIds!.includes(s.id));
}

function getMenuCategories(menu: Menu, allCategories: { id: string; name: string; itemCount: number }[]) {
  return allCategories.filter((c) => menu.categoryIds.includes(c.id));
}

function getCategoryItemCount(items: MenuItem[], categoryId: string): number {
  return items.filter((item) => item.categoryIds.includes(categoryId)).length;
}

function computeMenuTotalItems(menu: Menu, items: MenuItem[]): number {
  const catIds = new Set(menu.categoryIds);
  const fromCats = new Set<string>();
  items.forEach((item) => {
    if (item.categoryIds.some((cid) => catIds.has(cid))) fromCats.add(item.id);
  });
  let total = fromCats.size;
  (menu.individualItemIds ?? []).forEach((id) => {
    if (!fromCats.has(id)) total += 1;
  });
  return total;
}

function formatSessionSlotSummary(session: Session): string {
  if (session.slots.length === 0) return '';
  const dayAbbrevs = new Set<string>();
  for (const s of session.slots) {
    for (const day of s.days) {
      dayAbbrevs.add(day.slice(0, 3));
    }
  }
  const days = Array.from(dayAbbrevs).join(', ');
  const first = session.slots[0];
  return `${days} · ${first.startTime} - ${first.endTime}`;
}


function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function MenuListStatusBadge({ status }: { status: MenuStatus }) {
  const config = {
    live: { dot: GREEN, label: 'Live', bg: 'rgba(95,122,85,0.08)' },
    scheduled: { dot: ORANGE, label: 'Scheduled', bg: 'rgba(176,122,42,0.08)' },
    draft: { dot: T3, label: 'Draft', bg: 'rgba(156,163,184,0.08)' },
  };
  const c = config[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 10px',
        borderRadius: 2,
        background: c.bg,
        color: c.dot,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        fontFamily: 'var(--font-primary)',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
      {c.label}
    </span>
  );
}

function MenusListShimmer({ isMobile }: { isMobile: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10 }}>
      {Array.from({ length: isMobile ? 5 : 6 }).map((_, idx) => (
        <div key={idx} style={{ background: '#fff', border: '1px solid #E6DFD3', borderRadius: 2, padding: isMobile ? '14px 16px' : '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Bone w={44} h={44} r={10} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Bone w="38%" h={14} mb={6} />
              <Bone w="46%" h={11} />
            </div>
            <Bone w={80} h={22} r={6} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── component ──────────────────────────────────────────── */

export default function MenusPage() {
  const navigate = useNavigate();
  const { menus, fetchMenus, clearMenusCache, deleteMenuOnServer, setEditingMenuId, error, loading } = useMenusStore();
  const { categories } = useCategoriesStore();
  const { items } = useItemsStore();
  const { sessions } = useSessionsStore();
  const { addToast } = useToastStore();
  useErrorToast(error, { fallbackMessage: 'Failed to load menus' });

  const { auth } = useAuth();
  const { selectedBranch } = useBranch();

  const outletOrderTypeLabels = useMemo(
    () => locationOrderTypeNameById(selectedBranch ?? null),
    [selectedBranch],
  );

  const isMobile = useMediaQuery('(max-width: 768px)');
  const isSm = useMediaQuery('(min-width: 640px)');
  const isMd = useMediaQuery('(min-width: 768px)');
  const isLg = useMediaQuery('(min-width: 1024px)');

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({ title: 'Menus', breadcrumbs: 'Product Catalog' });
  }, [setTopBarProps]);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) return;
    void fetchMenus(locationId, token, { skipDuplicateMs: 750 });
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token, fetchMenus]);


  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedMenuId, setExpandedMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Menu | null>(null);
  const [happyHourOpen, setHappyHourOpen] = useState(false);
  const [deletingMenu, setDeletingMenu] = useState(false);

  const sortedMenus = useMemo(() => {
    return [...menus].sort((a, b) => {
      const pA = statusPriority[a.status] ?? 3;
      const pB = statusPriority[b.status] ?? 3;
      if (pA !== pB) return pA - pB;
      return a.name.localeCompare(b.name);
    });
  }, [menus]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return sortedMenus.filter((m) => {
      const matchSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q));
      const matchStatus = statusFilter === 'all' || m.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [sortedMenus, search, statusFilter]);

  const handleToggleExpand = useCallback((menuId: string) => {
    setExpandedMenuId((prev) => (prev === menuId ? null : menuId));
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    if (deletingMenu) return;
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) {
      addToast('Location is required to delete menu.', 'error');
      return;
    }
    try {
      setDeletingMenu(true);
      await deleteMenuOnServer({ categoryGroupId: deleteTarget.id, locationId }, token);
      setDeleteTarget(null);
      clearMenusCache();
      addToast('Menu deleted', 'success');
      void fetchMenus(locationId, token, { force: true });
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to delete menu', 'error');
    } finally {
      setDeletingMenu(false);
    }
  }, [deleteTarget, deletingMenu, selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token, deleteMenuOnServer, addToast, clearMenusCache, fetchMenus]);

  const deleteDeviceCount = deleteTarget ? countAssignedMenuDevices(deleteTarget) : 0;

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'live', label: 'Live' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'draft', label: 'Draft' },
  ];

  const pageOuter: CSSProperties = {
    height: '100%',
    maxHeight: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: '#FFFFFF',
    boxSizing: 'border-box',
  };

  const pageMainScroll: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
  };

  const channelPill: CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 2,
    background: ACCENT_BG,
    color: ACCENT,
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-primary)',
  };

  const sectionLabel: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: T3,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 8,
    fontFamily: 'var(--font-primary)',
  };

  if (isMobile) {
    return (
      <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif" }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span onClick={() => navigate(PC_BASE)} className="material-symbols-rounded" style={{ fontSize: 22, color: '#453F39', cursor: 'pointer' }}>arrow_back</span>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: 0 }}>Menus</h1>
          </div>
          <span onClick={() => navigate(pcPaths.menusCreate)} className="material-symbols-rounded" style={{ fontSize: 24, color: '#B89550', cursor: 'pointer' }}>add</span>
        </div>

        <div style={{ padding: '12px 16px 100px' }}>
          <ProductCatalogSyncBanner compact syncOnly />

          {/* Toolbar - stacked vertically on mobile */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search menus..." />
            <Select
              ariaLabel="Filter menus by status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              placeholder="Status"
            />
          </div>

          {/* List */}
          {loading ? (
            <MenusListShimmer isMobile />
          ) : menus.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingBottom: 60 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: ACCENT_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 36, color: ACCENT }}>layers</span>
              </div>
              <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: T1, fontFamily: 'var(--font-primary)' }}>No menus created yet</h2>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: T2, textAlign: 'center', maxWidth: 360, fontFamily: 'var(--font-primary)', lineHeight: 1.5 }}>
                Menus let you organize categories and items for different channels, devices, and time slots.
              </p>
              <Button onClick={() => navigate(pcPaths.menusCreate)} style={{ background: ACCENT, color: '#fff', borderRadius: 2, fontWeight: 600, fontSize: 14, padding: '10px 20px' }}
                icon={<span className="material-symbols-rounded" style={{ fontSize: 18, color: '#fff' }}>add</span>}>
                Create Your First Menu
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 48, paddingBottom: 48 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 40, color: T3, marginBottom: 12 }}>error</span>
              <p style={{ fontSize: 14, color: T2, marginBottom: 8, fontFamily: 'var(--font-primary)' }}>No menus match your search or filter</p>
              <button type="button" onClick={() => { setSearch(''); setStatusFilter('all'); }} style={{ background: 'none', border: 'none', color: ACCENT, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-primary)' }}>Clear filters</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map((menu) => {
                const menuCats = getMenuCategories(menu, categories);
                const totalItems = computeMenuTotalItems(menu, items);
                const emoji = getMenuEmoji(menu.icon);

                return (
                  <div
                    key={menu.id}
                    onClick={() => {
                      setEditingMenuId(menu.id);
                      navigate(pcPaths.menuEdit);
                    }}
                    style={{
                      background: '#fff',
                      borderRadius: 2,
                      border: '1px solid #E6DFD3',
                      padding: '14px 16px',
                      marginBottom: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 2, background: ACCENT_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                        {emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span title={menu.name} style={{ fontSize: 15, fontWeight: 700, color: T1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{menu.name.length > 30 ? menu.name.slice(0, 30) + '...' : menu.name}</span>
                          <MenuListStatusBadge status={menu.status} />
                        </div>
                        <div style={{ fontSize: 12, color: T2, marginTop: 2 }}>
                          {menuCats.length} categories · {totalItems} items
                        </div>
                      </div>
                      <span className="material-symbols-rounded" style={{ fontSize: 20, color: T3, flexShrink: 0 }}>chevron_right</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FAB */}
        {menus.length > 0 && (
          <div
            onClick={() => navigate(pcPaths.menusCreate)}
            style={{
              position: 'fixed',
              bottom: 80,
              right: 16,
              width: 56,
              height: 56,
              background: '#B89550',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              cursor: 'pointer',
              zIndex: 999,
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 28, color: '#fff' }}>add</span>
          </div>
        )}

        <DeleteConfirmationModal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          confirmLoading={deletingMenu}
          title={deleteTarget ? deleteConfirmTitle(deleteTarget.name) : deleteConfirmTitle('this menu')}
          description="This will remove all channel and device assignments. This action cannot be undone."
          extra={
            deleteTarget?.status === 'live' && deleteDeviceCount > 0 ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 2, background: 'rgba(176,122,42,0.08)' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 18, color: ORANGE, flexShrink: 0 }}>warning</span>
                <span style={{ fontSize: 12, color: ORANGE, fontFamily: 'var(--font-primary)' }}>
                  This menu is currently live on {deleteDeviceCount} device{deleteDeviceCount !== 1 ? 's' : ''}. Deleting it will remove it from all assigned devices.
                </span>
              </div>
            ) : null
          }
        />
        <BottomNav />
      </div>
    );
  }

  return (
    <DesktopLayout>
      <div style={pageOuter}>
        <div style={pageMainScroll}>
          <div style={{ padding: '12px 25px 32px' }}>
            <PageHeader
              icon={
                <span className="material-symbols-rounded" style={{ fontSize: 24, color: 'rgba(255,255,255,0.95)' }}>
                  restaurant_menu
                </span>
              }
              title="Menus"
              subtitle="Manage your menus, assign to channels, devices, and sessions"
              actions={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <CatalogHelpLink topic="Menus" Tutorial={MenuTutorial} createPath={pcPaths.menusCreate} />
                  <Button
                    icon={
                      <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'rgba(255,255,255,0.95)' }}>
                        add
                      </span>
                    }
                    onClick={() => navigate(pcPaths.menusCreate)}
                  >
                    Add Menu
                  </Button>
                </div>
              }
            />

            <ProductCatalogSyncBanner syncOnly />

            {/* Toolbar */}
            <div
              style={{
                display: 'flex',
                flexDirection: isSm ? 'row' : 'column',
                alignItems: isSm ? 'center' : 'stretch',
                gap: 10,
                marginBottom: 20,
              }}
            >
              <div style={{ flex: isSm ? 1 : undefined, maxWidth: isSm ? 320 : undefined, minWidth: 0 }}>
                <SearchInput value={search} onChange={setSearch} placeholder="Search menus..." />
              </div>
              <div style={{ width: isSm ? 160 : '100%', flexShrink: 0 }}>
                <Select
                  ariaLabel="Filter menus by status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={statusOptions}
                  placeholder="Status"
                />
              </div>
            </div>

            {/* Lists */}
            {loading ? (
              <MenusListShimmer isMobile={false} />
            ) : menus.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingTop: 80,
                  paddingBottom: 80,
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: ACCENT_BG,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 36, color: ACCENT }}>
                    layers
                  </span>
                </div>
                <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: T1, fontFamily: 'var(--font-primary)' }}>
                  No menus created yet
                </h2>
                <p
                  style={{
                    margin: '0 0 20px',
                    fontSize: 13,
                    color: T2,
                    textAlign: 'center',
                    maxWidth: 360,
                    fontFamily: 'var(--font-primary)',
                    lineHeight: 1.5,
                  }}
                >
                  Menus let you organize categories and items for different channels, devices, and time slots.
                </p>
                <Button
                  onClick={() => navigate(pcPaths.menusCreate)}
                  style={{
                    background: ACCENT,
                    color: '#fff',
                    borderRadius: 2,
                    fontWeight: 600,
                    fontSize: 14,
                    padding: '10px 20px',
                  }}
                  icon={
                    <span className="material-symbols-rounded" style={{ fontSize: 18, color: '#fff' }}>
                      add
                    </span>
                  }
                >
                  Create Your First Menu
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  paddingTop: 48,
                  paddingBottom: 48,
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 40, color: T3, marginBottom: 12 }}>
                  error
                </span>
                <p style={{ fontSize: 14, color: T2, marginBottom: 8, fontFamily: 'var(--font-primary)' }}>
                  No menus match your search or filter
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('all');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: ACCENT,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtered.map((menu) => {
                  const isExpanded = expandedMenuId === menu.id;
                  const assignedDeviceCount = countAssignedMenuDevices(menu);
                  const menuSessions = getMenuSessions(menu, sessions);
                  const menuCats = getMenuCategories(menu, categories);
                  const totalItems = computeMenuTotalItems(menu, items);
                  const emoji = getMenuEmoji(menu.icon);
                  const menuOrderTypePills = menuOrderTypePillsForDisplay(menu, outletOrderTypeLabels);

                  const edit = () => {
                    setEditingMenuId(menu.id);
                    navigate(pcPaths.menuEdit);
                  };
                  const prices = () => navigate(pcPaths.menuPriceEditor(menu.id));
                  const del = () => setDeleteTarget(menu);
                  const dup = () => navigate(`${pcPaths.menusCreate}?clone=${encodeURIComponent(menu.id)}`);

                  const actionRow = () => (
                    <div
                      style={{ display: 'flex', gap: 4, flexShrink: 0 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        title="Edit"
                        onClick={edit}
                        style={catalogListActionButtonStyle}
                        onMouseEnter={catalogListActionEnterDefault}
                        onMouseLeave={catalogListActionLeaveDefault}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>
                          edit
                        </span>
                      </button>
                      <button
                        type="button"
                        title="Price Editor"
                        onClick={prices}
                        style={catalogListActionButtonStyle}
                        onMouseEnter={catalogListActionEnterDefault}
                        onMouseLeave={catalogListActionLeaveDefault}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>
                          sell
                        </span>
                      </button>
                      <button
                        type="button"
                        title="Clone"
                        onClick={dup}
                        style={catalogListActionButtonStyle}
                        onMouseEnter={catalogListActionEnterDefault}
                        onMouseLeave={catalogListActionLeaveDefault}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>
                          content_copy
                        </span>
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={del}
                        style={catalogListActionButtonStyle}
                        onMouseEnter={catalogListActionEnterDanger}
                        onMouseLeave={catalogListActionLeaveDanger}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>
                          delete
                        </span>
                      </button>
                    </div>
                  );

                  return (
                    <div
                      key={menu.id}
                      style={{
                        background: '#fff',
                        border: `1px solid ${BORDER}`,
                        borderRadius: 2,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleToggleExpand(menu.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleToggleExpand(menu.id);
                          }
                        }}
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: isSm ? 'center' : 'flex-start',
                          gap: isSm ? 14 : 10,
                          padding: '12px 14px',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-primary)',
                        }}
                      >
                        <div style={{ color: T3, flexShrink: 0, marginTop: isSm ? 0 : 4 }}>
                          <span
                            className="material-symbols-rounded"
                            style={{
                              fontSize: 20,
                              display: 'block',
                              transition: 'transform 0.15s ease',
                              transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                            }}
                          >
                            expand_more
                          </span>
                        </div>

                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            background: ACCENT_BG,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 22,
                            flexShrink: 0,
                          }}
                        >
                          {emoji}
                        </div>

                        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                          <div title={menu.name} style={{ fontSize: 15, fontWeight: 700, color: T1 }}>{menu.name.length > 30 ? menu.name.slice(0, 30) + '...' : menu.name}</div>
                          {menu.description ? (
                            <div style={{ fontSize: 12, color: T2, marginTop: 2, lineHeight: 1.35 }}>
                              {menu.description}
                            </div>
                          ) : null}
                          <div style={{ fontSize: 11, color: T3, marginTop: 4 }}>
                            {menuCats.length} categories · {totalItems} items
                          </div>

                          {!isSm ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginTop: 10,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MenuListStatusBadge status={menu.status} />
                              {actionRow()}
                            </div>
                          ) : null}
                        </div>

                        {isSm ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 220 }}>
                            {menuOrderTypePills.map((p) => (
                              <span key={p.key} style={channelPill}>
                                {p.label}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {isMd ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 12,
                              color: assignedDeviceCount === 0 ? ORANGE : T2,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: 16, color: T3 }}>
                              monitor
                            </span>
                            {assignedDeviceCount === 0
                              ? 'No devices'
                              : `${assignedDeviceCount} device${assignedDeviceCount !== 1 ? 's' : ''}`}
                          </div>
                        ) : null}

                        {isLg ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 12,
                              color: menuSessions.length === 0 ? T3 : T2,
                              whiteSpace: 'nowrap',
                              maxWidth: 168,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              flexShrink: 0,
                            }}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: 16, color: T3, flexShrink: 0 }}>
                              schedule
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {menuSessions.length === 0
                                ? 'Always available'
                                : menuSessions.map((s) => s.name).join(', ')}
                            </span>
                          </div>
                        ) : null}

                        {isSm ? (
                          <>
                            <div style={{ flexShrink: 0 }}>
                              <MenuListStatusBadge status={menu.status} />
                            </div>
                            {actionRow()}
                          </>
                        ) : null}
                      </div>

                      {isExpanded ? (
                        <>
                          <div style={{ height: 1, background: DIVIDER }} />
                          <div style={{ padding: '16px 16px 16px', paddingLeft: isSm ? 78 : 16, background: '#FFFFFF' }}>
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: isSm ? '1fr 1fr' : '1fr',
                                gap: 20,
                              }}
                            >
                              <div>
                                <div style={sectionLabel}>Categories</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {menuCats.length === 0 ? (
                                    <span style={{ fontSize: 12, color: T3 }}>No categories assigned</span>
                                  ) : (
                                    menuCats.map((cat) => (
                                      <span
                                        key={cat.id}
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 500,
                                          padding: '3px 10px',
                                          borderRadius: 2,
                                          background: '#fff',
                                          border: `1px solid ${BORDER}`,
                                          color: T1,
                                          fontFamily: 'var(--font-primary)',
                                        }}
                                      >
                                        {cat.name}{' '}
                                        <span style={{ color: T3 }}>({getCategoryItemCount(items, cat.id)})</span>
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>

                              <div>
                                <div style={sectionLabel}>Devices</div>
                                {assignedDeviceCount === 0 ? (
                                  <span style={{ fontSize: 12, color: ORANGE }}>No devices assigned</span>
                                ) : (
                                  <span style={{ fontSize: 12, color: T2 }}>
                                    {assignedDeviceCount} device{assignedDeviceCount !== 1 ? 's' : ''} assigned
                                  </span>
                                )}
                              </div>

                              <div>
                                <div style={sectionLabel}>Sessions</div>
                                {menuSessions.length === 0 ? (
                                  <span style={{ fontSize: 12, color: T3 }}>
                                    Always available (no session restrictions)
                                  </span>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {menuSessions.map((sess) => (
                                      <div
                                        key={sess.id}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 6,
                                          fontSize: 12,
                                          color: T2,
                                          fontFamily: 'var(--font-primary)',
                                        }}
                                      >
                                        <span className="material-symbols-rounded" style={{ fontSize: 14, color: T3 }}>
                                          schedule
                                        </span>
                                        <span style={{ fontWeight: 600 }}>{sess.name}</span>
                                        <span style={{ color: T3 }}>{formatSessionSlotSummary(sess)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div>
                                <div style={sectionLabel}>Quick stats</div>
                                <div style={{ fontSize: 12, color: T2, fontFamily: 'var(--font-primary)', lineHeight: 1.5 }}>
                                  {totalItems} items · {assignedDeviceCount} device{assignedDeviceCount !== 1 ? 's' : ''} ·{' '}
                                  {menuOrderTypePills.length} channel{menuOrderTypePills.length !== 1 ? 's' : ''}
                                  <br />
                                  <span style={{ color: T3 }}>Last updated {formatDate(menu.lastUpdated)}</span>
                                </div>
                              </div>
                            </div>

                            <div style={{ marginTop: 14 }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`${pcPaths.items}?menuId=${encodeURIComponent(menu.id)}`);
                                }}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  padding: 0,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: ACCENT,
                                  cursor: 'pointer',
                                  fontFamily: 'var(--font-primary)',
                                }}
                              >
                                View items →
                              </button>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DeleteConfirmationModal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          confirmLoading={deletingMenu}
          title={deleteTarget ? deleteConfirmTitle(deleteTarget.name) : deleteConfirmTitle('this menu')}
          description="This will remove all channel and device assignments. This action cannot be undone."
          extra={
            deleteTarget?.status === 'live' && deleteDeviceCount > 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 2,
                  background: 'rgba(176,122,42,0.08)',
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18, color: ORANGE, flexShrink: 0 }}>
                  warning
                </span>
                <span style={{ fontSize: 12, color: ORANGE, fontFamily: 'var(--font-primary)' }}>
                  This menu is currently live on {deleteDeviceCount} device{deleteDeviceCount !== 1 ? 's' : ''}. Deleting it
                  will remove it from all assigned devices.
                </span>
              </div>
            ) : null
          }
        />
        <HappyHourWizard open={happyHourOpen} onClose={() => setHappyHourOpen(false)} />
      </div>
    </DesktopLayout>
  );
}
