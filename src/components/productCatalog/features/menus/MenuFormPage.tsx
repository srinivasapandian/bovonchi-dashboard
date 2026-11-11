import { useState, useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useLocation, Navigate, useSearchParams } from 'react-router-dom';
import { useMenusStore, useCategoriesStore, useSessionsStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import type { ModuleListItem } from '../../../../services/categoryCatalogApi';
import type { MenuStatus, OrderType, Category, MenuItem, Session, CatalogDevice } from '../../data/types';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import { pcPaths } from '../../paths';
import {
  formPageOuterStyle,
  formPageMainScrollStyle,
  formStickyActionBarFooterStyle,
  formCancelButtonStyle,
  formSaveButtonStyle,
  formOutlineButtonStyle,
} from '../../formLayout';
import TextField from '../../components/forms/TextField';
import TextArea from '../../components/forms/TextArea';
import { DeleteConfirmationModal, deleteConfirmTitle } from '../../components/ui/DeleteConfirmationModal';
import { withCloneNameLabel } from '../../catalogEntityActions';
import { useErrorToast } from '../../hooks/useErrorToast';
import { getActiveDevicesBySectionApi } from '../../../../services/menuCatalogApi';

/* ─── tokens & constants ─── */

const ACCENT = '#B89550';
const ACCENT_BG = 'rgba(184,149,80,0.08)';
const T1 = '#453F39';
const T2 = '#6E665D';
const T3 = '#9A9084';
const GREEN = '#5F7A55';
const ORANGE = '#B07A2A';
const RED = '#A63D2F';
const BORDER = '#E6DFD3';
const DIVIDER = '#ECE5D8';

const MENU_ICONS = [
  { id: 'default', emoji: '📋', label: 'Default' },
  { id: 'coffee', emoji: '☕', label: 'Coffee' },
  { id: 'wine', emoji: '🍷', label: 'Wine' },
  { id: 'cutlery', emoji: '🍴', label: 'Cutlery' },
  { id: 'dessert', emoji: '🍰', label: 'Dessert' },
  { id: 'flame', emoji: '🔥', label: 'Flame' },
  { id: 'star', emoji: '⭐', label: 'Star' },
  { id: 'leaf', emoji: '🌿', label: 'Leaf' },
] as const;

const MENU_ICON_IDS = new Set<string>(MENU_ICONS.map((i) => i.id));

interface OutletOrderType {
  id?: string;
  typeName?: string;
  typeGroup?: string;
  isEnabled?: number | boolean;
}

function normalizeText(v: string): string {
  return v.toLowerCase().replace(/[\s-]+/g, '_').trim();
}

function mapOutletOrderTypeToKey(ot: OutletOrderType): OrderType | null {
  const fromTypeName = normalizeText(ot.typeName ?? '');
  const fromId = normalizeText(ot.id ?? '');
  const source = `${fromTypeName} ${fromId}`;

  if (/(dine|dining|walk_in|walkin|eat_in)/.test(source)) return 'dine_in';
  if (/(takeout|take_out|pickup|pick_up)/.test(source)) return 'takeout';
  if (/delivery/.test(source)) return 'delivery';
  if (/(online|gloriafood|web|app|digital)/.test(source)) return 'online_ordering';
  if (/(catering|cater)/.test(source)) return 'catering';

  switch ((ot.typeGroup ?? '').toUpperCase()) {
    case 'D': return 'dine_in';
    case 'P': return 'takeout';
    case 'S': return 'delivery';
    case 'O': return 'online_ordering';
    default: return null;
  }
}

function getOutletOrderTypeIdByKey(
  selectedBranch: Record<string, any> | null | undefined,
): Partial<Record<OrderType, string>> {
  const raw = selectedBranch?.orderTypes;
  if (!Array.isArray(raw) || raw.length === 0) return {};

  const out: Partial<Record<OrderType, string>> = {};
  raw.forEach((entry: OutletOrderType) => {
    // Include disabled (isEnabled: 0) order types too; still exclude in-store.
    const notInstore = (entry?.typeGroup ?? 'T') !== 'I';
    if (!notInstore) return;

    const key = mapOutletOrderTypeToKey(entry);
    const id = String(entry?.id ?? '').trim();
    if (!key || !id || out[key]) return;
    out[key] = id;
  });
  return out;
}

function getOutletChannels(
  selectedBranch: Record<string, any> | null | undefined,
): Array<{ key: OrderType; label: string; id: string }> {
  const raw = selectedBranch?.orderTypes;
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const channels: Array<{ key: OrderType; label: string; id: string }> = [];
  const seen = new Set<OrderType>();

  raw.forEach((entry: OutletOrderType) => {
    // Include disabled (isEnabled: 0) order types too; still exclude in-store.
    const notInstore = (entry?.typeGroup ?? 'T') !== 'I';
    if (!notInstore) return;

    const key = mapOutletOrderTypeToKey(entry);
    const id = String(entry?.id ?? '').trim();
    if (!key || !id || seen.has(key)) return;
    seen.add(key);

    channels.push({
      key,
      label: String(entry?.typeName ?? '').trim() || key,
      id,
    });
  });

  return channels;
}

function deviceMaterialIcon(type: CatalogDevice['type']): string {
  switch (type) {
    case 'pos':
      return 'point_of_sale';
    case 'tablet':
      return 'tablet_mac';
    case 'kiosk':
      return 'kiosk';
    default:
      return 'devices';
  }
}

function mapApiDeviceTypeToCatalogType(deviceType?: string): CatalogDevice['type'] {
  const key = String(deviceType ?? '').trim().toUpperCase();
  if (key === 'KIOSK') return 'kiosk';
  if (key === 'TAB' || key === 'TABLET') return 'tablet';
  return 'pos';
}

function getChildCategories(categories: Category[], parentId: string): Category[] {
  return categories.filter((c) => c.parentCategoryId === parentId);
}

function getParentCategory(categories: Category[], cat: Category): Category | undefined {
  if (!cat.parentCategoryId) return undefined;
  return categories.find((c) => c.id === cat.parentCategoryId);
}

function getCategoryLabel(categories: Category[], cat: Category): string {
  const parent = getParentCategory(categories, cat);
  return parent ? `${parent.name} > ${cat.name}` : cat.name;
}

function getItemCountForCategories(items: MenuItem[], catIds: Set<string>): number {
  return items.filter((item) => item.categoryIds.some((cid) => catIds.has(cid))).length;
}

function getMenuNameById(menus: { id: string; name: string }[], menuId: string | null): string | null {
  if (!menuId) return null;
  const menu = menus.find((m) => m.id === menuId);
  return menu ? menu.name : null;
}

function summarizeSessionPortal(session: Session): string {
  if (session.slots.length === 0) return 'No schedule';
  const uniqueDaysSet = new Set<string>();
  for (const s of session.slots) {
    s.days.forEach((d) => uniqueDaysSet.add(d));
  }
  const uniqueDays = Array.from(uniqueDaysSet);
  const first = session.slots[0];
  const time = `${first.startTime}-${first.endTime}`;

  const dayAbbr: Record<string, string> = {
    Monday: 'Mon',
    Tuesday: 'Tue',
    Wednesday: 'Wed',
    Thursday: 'Thu',
    Friday: 'Fri',
    Saturday: 'Sat',
    Sunday: 'Sun',
  };
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const weekend = ['Saturday', 'Sunday'];
  const allDays = [...weekdays, ...weekend];

  let dayStr: string;
  if (uniqueDays.length === 7) dayStr = 'Every day';
  else if (uniqueDays.length === 5 && weekdays.every((d) => uniqueDays.includes(d))) dayStr = 'Mon-Fri';
  else if (uniqueDays.length === 2 && weekend.every((d) => uniqueDays.includes(d))) dayStr = 'Sat-Sun';
  else {
    const sorted = [...uniqueDays].sort((a, b) => allDays.indexOf(a) - allDays.indexOf(b));
    if (sorted.length >= 3) {
      dayStr = `${dayAbbr[sorted[0]]}-${dayAbbr[sorted[sorted.length - 1]]}`;
    } else {
      dayStr = sorted.map((d) => dayAbbr[d] || d).join(', ');
    }
  }

  const summary = `${dayStr} ${time}`;
  if (session.slots.length > 1) return `${summary} (+${session.slots.length - 1} more)`;
  return summary;
}

function groupDevicesByStation(deviceList: CatalogDevice[]): Record<string, CatalogDevice[]> {
  const grouped: Record<string, CatalogDevice[]> = {};
  for (const dev of deviceList) {
    if (!grouped[dev.station]) grouped[dev.station] = [];
    grouped[dev.station].push(dev);
  }
  return grouped;
}

type MenuAssignmentDevice = CatalogDevice & {
  deviceTypeRaw?: string;
};

function resolveIconIdFromMenu(stored?: string): string {
  if (!stored) return 'default';
  if (MENU_ICON_IDS.has(stored)) return stored;
  const byEmoji = MENU_ICONS.find((i) => i.emoji === stored);
  return byEmoji ? byEmoji.id : 'default';
}

function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const fromIso = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromIso)) return fromIso;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${BORDER}`,
    borderRadius: 2,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        padding: '20px 22px',
      }}
    >
      <h3 style={{ color: T1, fontFamily: 'var(--font-primary)', fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>
        {title}
      </h3>
      {subtitle ? (
        <p style={{ color: T2, fontFamily: 'var(--font-primary)', fontSize: 13, margin: '0 0 16px' }}>{subtitle}</p>
      ) : (
        <div style={{ marginBottom: 16 }} />
      )}
      {children}
    </div>
  );
}

function ToggleSwitch({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: 36,
        height: 20,
        borderRadius: 2,
        padding: 2,
        background: active ? 'var(--green, #5F7A55)' : 'var(--hover, #F4F0E8)',
        border: `1px solid ${active ? 'var(--green, #5F7A55)' : BORDER}`,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: active ? '#FFFFFF' : T3,
          transform: active ? 'translateX(16px)' : 'translateX(0)',
          transition: 'transform 0.2s ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        }}
      />
    </button>
  );
}

const S = {
  center: {
    padding: '12px 24px 96px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 24,
  } as CSSProperties,
};

export default function MenuFormPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { menus, fetchMenus, createMenuOnServer, updateMenuOnServer, deleteMenuOnServer, editingMenuId, error } = useMenusStore();
  const { categories, fetchCategories, fetchModuleListOnServer } = useCategoriesStore();
  const { sessions } = useSessionsStore();
  const { addToast } = useToastStore();
  const { auth } = useAuth();
  const { selectedBranch } = useBranch();
  useErrorToast(error, { fallbackMessage: 'Failed to load menus' });

  const location = useLocation();
  const isEditRoute = location.pathname === pcPaths.menuEdit;
  const id = isEditRoute ? editingMenuId : null;

  const isMobile = useMediaQuery('(max-width: 768px)');

  const isEdit = Boolean(id);
  const existing = isEdit ? menus.find((m) => m.id === id) : null;
  const cloneId = !isEdit ? searchParams.get('clone')?.trim() || null : null;
  const cloneSource = useMemo(
    () => (!isEdit && cloneId ? menus.find((m) => m.id === cloneId) ?? null : null),
    [isEdit, cloneId, menus],
  );
  const isCloneHydrate = Boolean(!isEdit && cloneSource);
  const hydrateKeyRef = useRef('');

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({
      title: isEdit ? 'Edit Menu' : isCloneHydrate ? 'New Menu (clone)' : 'New Menu',
      breadcrumbs: 'Product Catalog > Menus',
    });
  }, [setTopBarProps, isEdit, isCloneHydrate]);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) return;
    void fetchMenus(locationId, token, { skipDuplicateMs: 750 });
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token, fetchMenus]);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId || itemsFetchedForLocation.current === locationId) return;
    itemsFetchedForLocation.current = locationId;
    void fetchCategories(locationId, token, { skipDuplicateMs: 750 });
    void (async () => {
      try {
        const raw = await fetchModuleListOnServer('ITEM', { location_id: locationId }, token);
        const mapped = raw
          .map((item: ModuleListItem) => ({
            id: String(item.id || item.itemId || ''),
            name: String(item.name || item.itemName || ''),
            itemCode: String(item.itemCode || item.item_code || ''),
            categoryIds: (item.categoryIds || item.category_ids || []) as string[],
          } as MenuItem))
          .filter((i) => i.id);
        setItems(mapped);
      } catch {
        setItems([]);
      }
    })();
  }, [
    selectedBranch?.id,
    selectedBranch?.locationId,
    auth?.accessToken,
    auth?.access_token,
    fetchCategories,
    fetchModuleListOnServer,
  ]);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) {
      setMenuDevices([]);
      return;
    }
    if (devicesFetchedForLocation.current === locationId) return;
    devicesFetchedForLocation.current = locationId;
    void (async () => {
      try {
        const resp = await getActiveDevicesBySectionApi(locationId, token);
        const fromSections: MenuAssignmentDevice[] = (resp.sections ?? []).flatMap((section) =>
          (section.devices ?? []).map((dev) => ({
            id: String(dev.id ?? '').trim(),
            name: String(dev.name ?? '').trim() || 'Unnamed Device',
            type: mapApiDeviceTypeToCatalogType(dev.deviceType),
            station: String(section.name ?? '').trim() || 'Unsectioned',
            currentMenuId: null,
            deviceTypeRaw: dev.deviceType,
          })),
        );
        const unsectioned: MenuAssignmentDevice[] = (resp.unsectionedDevices ?? []).map((dev) => ({
          id: String(dev.id ?? '').trim(),
          name: String(dev.name ?? '').trim() || 'Unnamed Device',
          type: mapApiDeviceTypeToCatalogType(dev.deviceType),
          station: 'Unsectioned',
          currentMenuId: null,
          deviceTypeRaw: dev.deviceType,
        }));
        const uniqueById = new Map<string, MenuAssignmentDevice>();
        [...fromSections, ...unsectioned].forEach((d) => {
          if (d.id && !uniqueById.has(d.id)) uniqueById.set(d.id, d);
        });
        setMenuDevices(Array.from(uniqueById.values()));
      } catch (e) {
        addToast(e instanceof Error ? e.message : 'Failed to load devices', 'error');
        setMenuDevices([]);
      }
    })();
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token]);

  const [menuName, setMenuName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('default');
  const [contentTab, setContentTab] = useState<'category' | 'item'>('category');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<MenuItem[]>([]);
  const itemsFetchedForLocation = useRef('');
  const devicesFetchedForLocation = useRef('');
  const [categorySearch, setCategorySearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<Set<OrderType>>(new Set());
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const [menuDevices, setMenuDevices] = useState<MenuAssignmentDevice[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [sessionSearch, setSessionSearch] = useState('');
  const [status, setStatus] = useState<MenuStatus>('draft');
  const [goLiveDate, setGoLiveDate] = useState('');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const saveIdleLabel = isEdit ? 'Update' : 'Create';
  const saveLoadingLabel = isEdit ? 'Updating' : 'Creating';

  /** Snapshot of category/item IDs from API when this form was loaded (edit or clone). Used to pin those rows at the top of lists. */
  const [initialApiCategoryIds, setInitialApiCategoryIds] = useState<Set<string>>(() => new Set());
  const [initialApiIndividualItemIds, setInitialApiIndividualItemIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (isEdit) {
      if (!existing || !id) return;
      const key = `edit:${id}`;
      if (hydrateKeyRef.current === key) return;
      hydrateKeyRef.current = key;
      setMenuName(existing.name);
      setDescription(existing.description ?? '');
      setSelectedIcon(resolveIconIdFromMenu(existing.icon));
      setSelectedCategoryIds(new Set(existing.categoryIds));
      setSelectedItemIds(new Set(existing.individualItemIds ?? []));
      setSelectedChannels(new Set(existing.channels ?? []));
      setSelectedDeviceIds(new Set(existing.deviceIds ?? []));
      setSelectedSessionIds(new Set(existing.sessionIds ?? []));
      setStatus(existing.status);
      setGoLiveDate(toDateInputValue(existing.goLiveDate));
      setInitialApiCategoryIds(new Set(existing.categoryIds));
      setInitialApiIndividualItemIds(new Set(existing.individualItemIds ?? []));
      return;
    }
    if (cloneId) {
      if (cloneSource) {
        const key = `clone:${cloneId}`;
        if (hydrateKeyRef.current === key) return;
        hydrateKeyRef.current = key;
        setMenuName(withCloneNameLabel(cloneSource.name));
        setDescription(cloneSource.description ?? '');
        setSelectedIcon(resolveIconIdFromMenu(cloneSource.icon));
        setSelectedCategoryIds(new Set(cloneSource.categoryIds));
        setSelectedItemIds(new Set(cloneSource.individualItemIds ?? []));
        setSelectedChannels(new Set(cloneSource.channels ?? []));
        setSelectedDeviceIds(new Set(cloneSource.deviceIds ?? []));
        setSelectedSessionIds(new Set(cloneSource.sessionIds ?? []));
        setStatus('draft');
        setGoLiveDate('');
        setInitialApiCategoryIds(new Set(cloneSource.categoryIds));
        setInitialApiIndividualItemIds(new Set(cloneSource.individualItemIds ?? []));
        return;
      }
      if (hydrateKeyRef.current !== 'new') {
        hydrateKeyRef.current = 'new';
        setMenuName('');
        setDescription('');
        setSelectedIcon('default');
        setContentTab('category');
        setSelectedCategoryIds(new Set());
        setSelectedItemIds(new Set());
        setCategorySearch('');
        setItemSearch('');
        setSelectedChannels(new Set());
        setSelectedDeviceIds(new Set());
        setSelectedSessionIds(new Set());
        setStatus('draft');
        setGoLiveDate('');
        setInitialApiCategoryIds(new Set());
        setInitialApiIndividualItemIds(new Set());
      }
      return;
    }
    if (hydrateKeyRef.current !== 'new') {
      hydrateKeyRef.current = 'new';
      setMenuName('');
      setDescription('');
      setSelectedIcon('default');
      setContentTab('category');
      setSelectedCategoryIds(new Set());
      setSelectedItemIds(new Set());
      setCategorySearch('');
      setItemSearch('');
      setSelectedChannels(new Set());
      setSelectedDeviceIds(new Set());
      setSelectedSessionIds(new Set());
      setStatus('draft');
      setGoLiveDate('');
      setInitialApiCategoryIds(new Set());
      setInitialApiIndividualItemIds(new Set());
    }
  }, [isEdit, id, existing, cloneId, cloneSource]);

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
        getChildCategories(categories, catId).forEach((c) => next.delete(c.id));
      } else {
        next.add(catId);
        getChildCategories(categories, catId).forEach((c) => next.add(c.id));
      }
      return next;
    });
  };

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleChannel = (ch: OrderType) => {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  };

  const toggleDevice = (devId: string) => {
    setSelectedDeviceIds((prev) => {
      const next = new Set(prev);
      if (next.has(devId)) next.delete(devId);
      else next.add(devId);
      return next;
    });
  };

  const toggleSession = (sessId: string) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessId)) next.delete(sessId);
      else next.add(sessId);
      return next;
    });
  };

  const categoryItemCount = useMemo(
    () => getItemCountForCategories(items, selectedCategoryIds),
    [items, selectedCategoryIds]
  );

  const individualItemCount = selectedItemIds.size;

  const totalItemCount = useMemo(() => {
    const categoryItemIds = new Set<string>();
    items.forEach((item) => {
      if (item.categoryIds.some((cid) => selectedCategoryIds.has(cid))) {
        categoryItemIds.add(item.id);
      }
    });
    let total = categoryItemIds.size;
    selectedItemIds.forEach((itemId) => {
      if (!categoryItemIds.has(itemId)) total += 1;
    });
    return total;
  }, [items, selectedCategoryIds, selectedItemIds]);

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return items;
    const q = itemSearch.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) || item.itemCode.toLowerCase().includes(q)
    );
  }, [items, itemSearch]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const q = categorySearch.toLowerCase();
    return categories.filter((cat) => getCategoryLabel(categories, cat).toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const sortedFilteredCategories = useMemo(() => {
    if (initialApiCategoryIds.size === 0) return filteredCategories;
    return [...filteredCategories].sort((a, b) => {
      const aFromApi = initialApiCategoryIds.has(a.id) ? 1 : 0;
      const bFromApi = initialApiCategoryIds.has(b.id) ? 1 : 0;
      if (aFromApi !== bFromApi) return bFromApi - aFromApi;
      return getCategoryLabel(categories, a).localeCompare(getCategoryLabel(categories, b), undefined, { sensitivity: 'base' });
    });
  }, [filteredCategories, initialApiCategoryIds, categories]);

  const sortedFilteredItems = useMemo(() => {
    if (initialApiCategoryIds.size === 0 && initialApiIndividualItemIds.size === 0) {
      return filteredItems;
    }
    const inApiMenuItem = (item: MenuItem) => {
      if (initialApiIndividualItemIds.has(item.id)) return true;
      return item.categoryIds.some((cid) => initialApiCategoryIds.has(cid));
    };
    return [...filteredItems].sort((a, b) => {
      const aFromApi = inApiMenuItem(a) ? 1 : 0;
      const bFromApi = inApiMenuItem(b) ? 1 : 0;
      if (aFromApi !== bFromApi) return bFromApi - aFromApi;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }, [filteredItems, initialApiCategoryIds, initialApiIndividualItemIds]);

  const filteredSessions = useMemo(() => {
    if (!sessionSearch.trim()) return sessions;
    const q = sessionSearch.toLowerCase();
    return sessions.filter((sess) => {
      const summary = summarizeSessionPortal(sess).toLowerCase();
      return sess.name.toLowerCase().includes(q) || summary.includes(q);
    });
  }, [sessions, sessionSearch]);

  const isItemIncludedViaCategory = (item: MenuItem): string | null => {
    for (const catId of item.categoryIds) {
      if (selectedCategoryIds.has(catId)) {
        const cat = categories.find((c) => c.id === catId);
        return cat ? cat.name : null;
      }
    }
    return null;
  };

  const isFormValid = useMemo(() => {
    return menuName.trim().length > 0;
  }, [menuName]);

  const orderTypeIdByKey = useMemo(
    () => getOutletOrderTypeIdByKey(selectedBranch),
    [selectedBranch],
  );
  const availableChannels = useMemo(
    () => getOutletChannels(selectedBranch),
    [selectedBranch],
  );

  const groupedDevices = useMemo(() => groupDevicesByStation(menuDevices), [menuDevices]);

  const persist = () => {
    if (!menuName.trim()) {
      setNameError('Name is required');
      return;
    }
    setNameError('');
    setSaving(true);

    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) {
      addToast('Select a location before saving', 'error');
      setSaving(false);
      return;
    }

    const serverCategoryIds = new Set(existing?.categoryIds ?? []);
    const removedCategoryIds = Array.from(serverCategoryIds).filter((cid) => !selectedCategoryIds.has(cid));
    const categoriesPayload = [
      ...Array.from(selectedCategoryIds).map((categoryId) => ({ categoryId, enabled: true })),
      ...removedCategoryIds.map((categoryId) => ({ categoryId, enabled: false })),
    ];
    // Expand each selected OrderType group to ALL enabled outlet UUIDs in that group so
    // multiple third parties (DoorDash/GrubHub/Ubereats) all land in the payload instead of
    // collapsing to a single first-match orderTypeId.
    const branchOrderTypes = Array.isArray((selectedBranch as Record<string, unknown>)?.orderTypes)
      ? ((selectedBranch as Record<string, unknown>).orderTypes as Array<{
          id?: string;
          typeName?: string;
          typeGroup?: string;
          isEnabled?: number | boolean;
        }>)
      : [];
    // Include disabled order types too so their availability is still persisted on save.
    const branchOtsForChannels = branchOrderTypes;
    const uuidsForKey = (key: OrderType): string[] =>
      branchOtsForChannels
        .filter((ot) => mapOutletOrderTypeToKey(ot) === key)
        .map((ot) => String(ot.id ?? '').trim())
        .filter(Boolean);
    const selectedOrderTypeIds = new Set<string>();
    Array.from(selectedChannels).forEach((key) => {
      const ids = uuidsForKey(key);
      if (ids.length === 0) {
        const fallback = orderTypeIdByKey[key] ?? key;
        if (fallback) selectedOrderTypeIds.add(String(fallback));
      } else {
        ids.forEach((id) => selectedOrderTypeIds.add(id));
      }
    });
    const serverOrderTypeIds = new Set(existing?.assignedOrderTypeIds ?? []);
    const removedOrderTypeIds = Array.from(serverOrderTypeIds).filter((id) => !selectedOrderTypeIds.has(id));
    const orderTypesPayload = [
      ...Array.from(selectedOrderTypeIds).map((orderTypeId) => ({ orderTypeId, enabled: true })),
      ...removedOrderTypeIds.map((orderTypeId) => ({ orderTypeId, enabled: false })),
    ];
    const serverDeviceIdsWhenLoaded = new Set(existing?.deviceIds ?? []);
    const removedDeviceIds = Array.from(serverDeviceIdsWhenLoaded).filter((did) => !selectedDeviceIds.has(did));
    const devicesPayload = [
      ...Array.from(selectedDeviceIds).map((deviceId) => ({ deviceId, enabled: true })),
      ...removedDeviceIds.map((deviceId) => ({ deviceId, enabled: false })),
    ];
    const serverIndividualItemIds = new Set(existing?.individualItemIds ?? []);
    const removedItemIds = Array.from(serverIndividualItemIds).filter((iid) => !selectedItemIds.has(iid));
    const itemsPayload = [
      ...Array.from(selectedItemIds).map((itemId) => ({ itemId, enabled: true })),
      ...removedItemIds.map((itemId) => ({ itemId, enabled: false })),
    ];
    const statusApi =
      status === 'live' ? 'active' : status === 'scheduled' ? 'schedule' : 'draft';
    const activeOn: string | undefined =
      status === 'live'
        ? new Date().toISOString()
        : status === 'scheduled' && goLiveDate.trim()
          ? goLiveDate.trim()
          : undefined;

    void (async () => {
      try {
        if (isEdit && id) {
          await updateMenuOnServer(
            {
              categoryGroupId: id,
              locationId,
              name: menuName.trim(),
              description: description.trim() || undefined,
              icon: selectedIcon,
              status: statusApi,
              ...(activeOn !== undefined ? { activeOn } : {}),
              ...(categoriesPayload.length > 0 ? { categories: categoriesPayload } : {}),
              orderTypes: orderTypesPayload,
              ...(devicesPayload.length > 0 ? { devices: devicesPayload } : {}),
              ...(itemsPayload.length > 0 ? { items: itemsPayload } : {}),
            },
            token,
          );
          addToast('Menu updated successfully', 'success');
        } else {
          await createMenuOnServer(
            {
              locationId,
              name: menuName.trim(),
              description: description.trim() || undefined,
              icon: selectedIcon,
              status: statusApi,
              ...(activeOn !== undefined ? { activeOn } : {}),
              categories: Array.from(selectedCategoryIds).map((categoryId) => ({ categoryId, enabled: true })),
              orderTypes: orderTypesPayload,
              devices: devicesPayload,
              items: Array.from(selectedItemIds).map((itemId) => ({ itemId, enabled: true })),
            },
            token,
          );
          addToast('Menu created successfully', 'success');
        }
        navigate(pcPaths.menus);
      } catch (e) {
        addToast(e instanceof Error ? e.message : 'Failed to save menu', 'error');
      } finally {
        setSaving(false);
      }
    })();
  };

  const handleDelete = () => {
    const menuId = String(id ?? existing?.id ?? '').trim();
    if (!menuId) {
      addToast('Unable to identify this menu for deletion.', 'error');
      return;
    }
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) {
      addToast('Location is required to delete menu.', 'error');
      return;
    }
    setSaving(true);
    void (async () => {
      try {
        await deleteMenuOnServer({ categoryGroupId: menuId, locationId }, token);
        setShowDeleteDialog(false);
        addToast('Menu deleted', 'success');
        navigate(pcPaths.menus);
      } catch (e) {
        addToast(e instanceof Error ? e.message : 'Failed to delete menu', 'error');
      } finally {
        setSaving(false);
      }
    })();
  };

  const Wrapper = isMobile ? ({ children }: { children: ReactNode }) => <>{children}</> : DesktopLayout;

  if (isEditRoute && !editingMenuId) {
    return <Navigate to={pcPaths.menus} replace />;
  }

  return (
    <Wrapper>
      {isMobile && (
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span onClick={() => navigate(pcPaths.menus)} className="material-symbols-rounded" style={{ fontSize: 22, color: '#453F39', cursor: 'pointer' }}>arrow_back</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: 0 }}>{isEdit ? 'Edit Menu' : 'New Menu'}</h1>
        </div>
      )}
      <div style={isMobile ? { background: '#FFFFFF', minHeight: '100vh', display: 'flex', flexDirection: 'column' as const } : formPageOuterStyle}>
        <div style={isMobile ? { flex: 1, overflowY: 'auto' as const, paddingBottom: 80 } : formPageMainScrollStyle}>
        <div style={isMobile ? { ...S.center, padding: '12px 16px 96px' } : S.center}>
            <SectionCard
              title="Menu Identity"
              subtitle="Basic information about this menu"
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <TextField
                  label="Menu Name"
                  value={menuName}
                  onChange={(v) => {
                    setMenuName(v);
                    if (v.trim()) setNameError('');
                  }}
                required
                  error={nameError}
                  placeholder="e.g., Coffee Menu, Bar Drinks, Dinner Specials"
                />
                <TextArea
                  label="Description (optional)"
                  value={description}
                  onChange={setDescription}
                  placeholder="Describe when and where this menu is used"
                  rows={3}
                  maxLength={100}
                  counterWarnAfter={90}
                />
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: T2,
                      marginBottom: 8,
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    Icon
                </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
                      gap: 8,
                      maxWidth: '100%',
                    }}
                  >
                    {MENU_ICONS.map((icon) => (
                      <button
                        key={icon.id}
                        type="button"
                        title={icon.label}
                        onClick={() => setSelectedIcon(icon.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          aspectRatio: '1',
                          maxWidth: 44,
                          borderRadius: 2,
                          fontSize: 18,
                          border:
                            selectedIcon === icon.id ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`,
                          background: selectedIcon === icon.id ? ACCENT_BG : '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        {icon.emoji}
                      </button>
                    ))}
                </div>
              </div>
            </div>
            </SectionCard>

            <SectionCard
              title="Menu Contents"
              subtitle="Select which categories and items appear in this menu"
            >
              <div
                        style={{
                  display: 'flex',
                  gap: 4,
                  marginBottom: 16,
                  padding: 4,
                  borderRadius: 2,
                  background: '#FFFFFF',
                }}
              >
                <button
                  type="button"
                  onClick={() => setContentTab('category')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 2,
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary)',
                    cursor: 'pointer',
                    background: contentTab === 'category' ? '#fff' : 'transparent',
                    color: contentTab === 'category' ? T1 : T2,
                    boxShadow: contentTab === 'category' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  By Category
                </button>
                <button
                  type="button"
                  onClick={() => setContentTab('item')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 2,
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary)',
                    cursor: 'pointer',
                    background: contentTab === 'item' ? '#fff' : 'transparent',
                    color: contentTab === 'item' ? T1 : T2,
                    boxShadow: contentTab === 'item' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  By Item
                </button>
                        </div>

              {contentTab === 'category' && (
                <div>
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <span
                      className="material-symbols-rounded"
                      style={{
                        position: 'absolute',
                        left: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 18,
                        color: T3,
                      }}
                    >
                      search
                    </span>
                    <input
                      type="text"
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      placeholder="Search categories by name..."
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '8px 12px 8px 36px',
                        border: `1px solid ${BORDER}`,
                        borderRadius: 2,
                        fontSize: 13,
                        fontFamily: 'var(--font-primary)',
                        color: T1,
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      maxHeight: 600,
                      overflowY: 'auto',
                      borderRadius: 2,
                      border: `1px solid ${BORDER}`,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                        gap: 12,
                      }}
                    >
                    {sortedFilteredCategories.map((cat) => {
                      const isSelected = selectedCategoryIds.has(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleCategory(cat.id)}
                          style={{
                            position: 'relative',
                            textAlign: 'left',
                            padding: 12,
                            borderRadius: 2,
                            border: isSelected ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`,
                            background: isSelected ? ACCENT_BG : '#fff',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-primary)',
                          }}
                        >
                          {isSelected && (
                          <span
                            style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                width: 20,
                                height: 20,
                              borderRadius: '50%',
                                background: ACCENT,
                                color: '#fff',
                                fontSize: 12,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                              }}
                            >
                              ✓
                            </span>
                          )}
                          <p
                            style={{
                              margin: 0,
                              fontSize: 13,
                              fontWeight: 600,
                              color: T1,
                              paddingRight: 24,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {getCategoryLabel(categories, cat)}
                          </p>
                          <p style={{ margin: '4px 0 0', fontSize: 12, color: T3 }}>
                            {cat.itemCount} items
                          </p>
                        </button>
                    );
                  })}
                    </div>
                    {sortedFilteredCategories.length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center', color: T3, fontSize: 13 }}>
                        No categories found
                      </div>
                    ) : null}
                </div>
                  <p style={{ margin: '12px 0 0', fontSize: 13, color: T2, fontFamily: 'var(--font-primary)' }}>
                    {selectedCategoryIds.size} categories selected, {categoryItemCount} total items
                  </p>
              </div>
              )}

              {contentTab === 'item' && (
                <div>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <span
                  className="material-symbols-rounded"
                      style={{
                        position: 'absolute',
                        left: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 18,
                        color: T3,
                      }}
                >
                  search
                </span>
                <input
                  type="text"
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      placeholder="Search items by name or code..."
                  style={{
                    width: '100%',
                        boxSizing: 'border-box',
                        padding: '8px 12px 8px 36px',
                        border: `1px solid ${BORDER}`,
                    borderRadius: 2,
                    fontSize: 13,
                    fontFamily: 'var(--font-primary)',
                        color: T1,
                    outline: 'none',
                  }}
                />
              </div>

                  <div
                    style={{
                      maxHeight: 600,
                      overflowY: 'auto',
                      borderRadius: 2,
                      border: `1px solid ${BORDER}`,
                    }}
                  >
                    {sortedFilteredItems.map((item) => {
                      const includedVia = isItemIncludedViaCategory(item);
                      const isChecked = selectedItemIds.has(item.id) || includedVia !== null;
                      const catName =
                        item.categoryIds.length > 0
                          ? categories.find((c) => c.id === item.categoryIds[0])?.name ?? ''
                          : '';

                    return (
                        <div
                          key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                            gap: 12,
                            padding: '10px 12px',
                            borderBottom: `1px solid ${DIVIDER}`,
                            background: '#fff',
                        }}
                      >
                        <input
                          type="checkbox"
                            checked={isChecked}
                            disabled={includedVia !== null}
                            onChange={() => {
                              if (!includedVia) toggleItem(item.id);
                            }}
                            style={{ accentColor: ACCENT, width: 16, height: 16, flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 13,
                                fontWeight: 600,
                                color: T1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontFamily: 'var(--font-primary)',
                              }}
                            >
                              {item.name}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                              <span style={{ fontSize: 11, color: T3, fontFamily: 'var(--font-primary)' }}>
                                {item.itemCode}
                        </span>
                              {catName ? (
                                <>
                                  <span style={{ color: DIVIDER }}>|</span>
                                  <span style={{ fontSize: 11, color: T3, fontFamily: 'var(--font-primary)' }}>
                                    {catName}
                          </span>
                                </>
                              ) : null}
                            </div>
                          </div>
                          {includedVia ? (
                            <span
                              style={{
                                fontSize: 11,
                                color: T3,
                                whiteSpace: 'nowrap',
                                fontFamily: 'var(--font-primary)',
                              }}
                            >
                              Included via {includedVia}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                    {sortedFilteredItems.length === 0 ? (
                      <div style={{ padding: 32, textAlign: 'center', color: T3, fontSize: 13 }}>
                        No items found
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 2,
                  background: '#FFFFFF',
                  fontSize: 13,
                  color: T2,
                  fontFamily: 'var(--font-primary)',
                }}
              >
                This menu contains:{' '}
                <span style={{ color: T1, fontWeight: 600 }}>{selectedCategoryIds.size} categories</span>,{' '}
                <span style={{ color: T1, fontWeight: 600 }}>{individualItemCount} individual items</span>, totaling{' '}
                <span style={{ color: T1, fontWeight: 600 }}>{totalItemCount} items</span>
              </div>
            </SectionCard>

            <SectionCard
              title="Channel Assignment"
              subtitle=""
            >
              <p style={{ fontSize: 11, color: '#9A9084', margin: '-8px 0 12px', fontFamily: 'var(--font-primary)', lineHeight: 1.5, paddingLeft: 10, borderLeft: '2px solid rgba(124,58,237,0.2)' }}>
                This is the ceiling — items can only appear on channels you enable here. If a channel is OFF, no item in this menu will show on that channel.
              </p>
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: T1,
                    marginBottom: 10,
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  Channels
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {availableChannels.map((ot) => {
                    const isSelected = selectedChannels.has(ot.key);
                    return (
                      <button
                        key={ot.id}
                        type="button"
                        onClick={() => toggleChannel(ot.key)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 999,
                          fontSize: 13,
                          fontWeight: 600,
                          fontFamily: 'var(--font-primary)',
                          border: isSelected ? `1.5px solid ${ACCENT}` : `1px solid ${BORDER}`,
                          background: isSelected ? ACCENT_BG : '#fff',
                          color: isSelected ? ACCENT : T2,
                          cursor: 'pointer',
                        }}
                      >
                        {ot.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ height: 1, background: DIVIDER, margin: '0 0 20px' }} />

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: T1,
                  marginBottom: 12,
                  fontFamily: 'var(--font-primary)',
                }}
              >
                Devices & Stations
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {Object.entries(groupedDevices).map(([station, stationDevices]) => (
                  <div key={station}>
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: T3,
                        margin: '0 0 8px',
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      {station}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        maxHeight: 500,
                        overflowY: 'auto',
                        paddingRight: 4,
                      }}
                    >
                      {stationDevices.map((dev) => {
                        const isOn = selectedDeviceIds.has(dev.id);
                        const currentMenuName = getMenuNameById(menus, dev.currentMenuId);
                        const hasConflict =
                          isOn &&
                          dev.currentMenuId !== null &&
                          dev.currentMenuId !== existing?.id;

                        return (
                          <div
                            key={dev.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: 12,
                              borderRadius: 2,
                              border: `1px solid ${DIVIDER}`,
                              background: isOn ? 'rgba(184,149,80,0.04)' : '#fff',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                              <span
                                className="material-symbols-rounded"
                                style={{ fontSize: 20, color: T2, flexShrink: 0 }}
                              >
                                {deviceMaterialIcon(dev.type)}
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <p
                                  style={{
                                    margin: 0,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: T1,
                                    fontFamily: 'var(--font-primary)',
                                  }}
                                >
                                  {dev.name}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 11, color: T3, fontFamily: 'var(--font-primary)' }}>
                                    {dev.station}
                                  </span>
                                  {currentMenuName ? (
                                    <>
                                      <span style={{ color: DIVIDER }}>|</span>
                                      <span style={{ fontSize: 11, color: T3, fontFamily: 'var(--font-primary)' }}>
                                        Current: {currentMenuName}
                                      </span>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              {hasConflict && currentMenuName ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11,
                                    color: ORANGE,
                                    fontFamily: 'var(--font-primary)',
                                  }}
                                >
                                  <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
                                    error
                                  </span>
                                  Replaces {currentMenuName}
                                </span>
                              ) : null}
                              <ToggleSwitch active={isOn} onToggle={() => toggleDevice(dev.id)} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Session Scope"
              subtitle="Assign this menu to specific time sessions to control when it is active"
            >
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <span
                  className="material-symbols-rounded"
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 18,
                    color: T3,
                  }}
                >
                  search
                </span>
                <input
                  type="text"
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  placeholder="Search sessions by name or schedule..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 12px 8px 36px',
                    border: `1px solid ${BORDER}`,
                    borderRadius: 2,
                    fontSize: 13,
                    fontFamily: 'var(--font-primary)',
                    color: T1,
                    outline: 'none',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  maxHeight: 500,
                  overflowY: 'auto',
                  paddingRight: 4,
                }}
              >
                {filteredSessions.length === 0 ? (
                  <div
                    style={{
                      padding: 16,
                      textAlign: 'center',
                      fontSize: 13,
                      color: T3,
                      fontFamily: 'var(--font-primary)',
                      border: `1px dashed ${DIVIDER}`,
                      borderRadius: 2,
                    }}
                  >
                    {sessions.length === 0
                      ? 'No sessions defined for this location yet.'
                      : 'No sessions match your search.'}
                  </div>
                ) : (
                  filteredSessions.map((sess) => {
                    const isSelected = selectedSessionIds.has(sess.id);
                    const daySummary = summarizeSessionPortal(sess);
                    return (
                      <div
                        key={sess.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 12,
                          borderRadius: 2,
                          border: `1px solid ${DIVIDER}`,
                          background: isSelected ? 'rgba(184,149,80,0.04)' : '#fff',
                        }}
                      >
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T1, fontFamily: 'var(--font-primary)' }}>
                            {sess.name}
                          </p>
                          <p style={{ margin: '4px 0 0', fontSize: 11, color: T3, fontFamily: 'var(--font-primary)' }}>
                            {daySummary}
                          </p>
                        </div>
                        <ToggleSwitch active={isSelected} onToggle={() => toggleSession(sess.id)} />
                      </div>
                    );
                  })
                )}
              </div>
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 2,
                  background: '#FFFFFF',
                  fontSize: 13,
                  color: T2,
                  fontFamily: 'var(--font-primary)',
                }}
              >
                {selectedSessionIds.size === 0 ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 16, color: T3 }}>
                      schedule
                    </span>
                    No session restriction — this menu is always available on assigned devices
                  </span>
                ) : (
                  <span>
                    This menu will be active during:{' '}
                    <span style={{ color: T1, fontWeight: 600 }}>
                      {Array.from(selectedSessionIds)
                        .map((sid) => sessions.find((s) => s.id === sid)?.name ?? sid)
                        .join(', ')}
                    </span>
                  </span>
              )}
            </div>
            </SectionCard>

            <SectionCard title="Status" subtitle="Set the menu availability status">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 12,
                }}
              >
                {(
                  [
                    { key: 'live' as const, label: 'Live', hint: 'Menu is active and visible to customers', dot: GREEN },
                    {
                      key: 'scheduled' as const,
                      label: 'Scheduled',
                      hint: 'Menu goes live on a specific date',
                      dot: ORANGE,
                    },
                    { key: 'draft' as const, label: 'Draft', hint: 'Work in progress, not visible yet', dot: T3 },
                  ] as const
                ).map((opt) => {
                  const statusBg =
                    opt.key === 'live'
                      ? 'rgba(95,122,85,0.06)'
                      : opt.key === 'scheduled'
                        ? 'rgba(176,122,42,0.06)'
                        : 'rgba(156,163,184,0.08)';
                  return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setStatus(opt.key)}
                    style={{
                      textAlign: 'left',
                      padding: 16,
                      borderRadius: 2,
                      border:
                        status === opt.key ? `2px solid ${opt.dot}` : `1px solid ${BORDER}`,
                      background: status === opt.key ? statusBg : '#fff',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: opt.dot,
                          display: 'inline-block',
                        }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{opt.label}</span>
          </div>
                    <p style={{ margin: 0, fontSize: 11, color: T3 }}>{opt.hint}</p>
                  </button>
                  );
                })}
        </div>
              {status === 'scheduled' ? (
                <div style={{ marginTop: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 500,
                      color: T1,
                      marginBottom: 6,
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    Go-Live Date
                  </label>
                  <input
                    type="date"
                    value={goLiveDate}
                    onChange={(e) => setGoLiveDate(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      border: `1px solid ${BORDER}`,
                      borderRadius: 2,
                      fontSize: 13,
                      fontFamily: 'var(--font-primary)',
                      color: T1,
                      maxWidth: 240,
                    }}
                  />
                </div>
              ) : null}
            </SectionCard>

            {isEdit ? (
              <div
                style={{
                  padding: '20px 22px',
                  borderRadius: 2,
                  border: `1px solid ${BORDER}`,
                  background: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }}
              >
                <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: RED, fontFamily: 'var(--font-primary)' }}>
                  Danger Zone
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: T2, fontFamily: 'var(--font-primary)' }}>
                  Permanently delete this menu. This action cannot be undone.
                </p>
                <button
                  type="button"
                  onClick={() => setShowDeleteDialog(true)}
                  style={{
                    ...formOutlineButtonStyle,
                    color: RED,
                    borderColor: RED,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
                    delete
                  </span>
                  Delete Menu
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div style={isMobile ? { ...formStickyActionBarFooterStyle, position: 'fixed' as const, bottom: 0, left: 0, right: 0, zIndex: 100, padding: 16 } : formStickyActionBarFooterStyle}>
          <button type="button" style={formCancelButtonStyle} onClick={() => navigate(pcPaths.menus)}>
            Cancel
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              style={{ ...formSaveButtonStyle, minWidth: isMobile ? 120 : 132, opacity: saving || !isFormValid ? 0.5 : 1, cursor: !isFormValid ? 'not-allowed' : 'pointer', fontSize: isMobile ? 14 : undefined, padding: isMobile ? '10px 20px' : undefined }}
              onClick={persist}
              disabled={saving || !isFormValid}
            >
              {saving ? saveLoadingLabel : saveIdleLabel}
          </button>
        </div>
      </div>
      </div>

      <DeleteConfirmationModal
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        confirmLoading={saving}
        title={deleteConfirmTitle(menuName.trim() || 'this menu')}
        description="This will remove all channel and device assignments. This action cannot be undone."
        confirmLabel="Delete Menu"
      />
    </Wrapper>
  );
}
