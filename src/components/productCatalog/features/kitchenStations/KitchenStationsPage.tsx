import { useState, useMemo, useEffect, useCallback, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useKitchenStationsStore, useItemsStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import { useErrorToast } from '../../hooks/useErrorToast';
import PageHeader from '../../components/layout/PageHeader';
import CatalogHelpLink from '../../components/layout/CatalogHelpLink';
import KitchenStationsTutorial from '../../components/tutorials/kitchen-stations-tutorial';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { DeleteConfirmationModal, deleteConfirmTitle } from '../../components/ui/DeleteConfirmationModal';
import { Toggle } from '../../components/ui/Toggle';
import { CatalogListEmptyState } from '../../components/ui/CatalogListEmptyState';
import TextField from '../../components/forms/TextField';
import Select from '../../components/forms/Select';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { pcPaths, PC_BASE } from '../../paths';
import {
  catalogListActionButtonStyle,
  catalogListActionEnterDefault,
  catalogListActionLeaveDefault,
  catalogListActionEnterDanger,
  catalogListActionLeaveDanger,
  CATALOG_LIST_ACTION_ICON_PX,
} from '../../catalogEntityActions';
import BottomNav from '../../../BottomNav';
import type { Printer } from '../../data/types';
import { Bone } from '../../../../components/Shimmer';
import { ProductCatalogSyncBanner } from '../../components/ui/ProductCatalogSyncBanner';
import { OutletKitchenPrintCard } from '../../components/ui/OutletKitchenPrintCard';
import { getKitchenPrintOrderTypes } from '../../utils/outletOrderTypes';
import { useOutletKitchenPrintDefault } from '../../hooks/useOutletKitchenPrintDefault';

// ─── Design tokens (aligned with product-catalog Copy) ─────────────────────

const ACCENT = '#B89550';
const ACCENT_BG = 'rgba(184,149,80,0.08)';
const T1 = '#453F39';
const T2 = '#6E665D';
const T3 = '#9A9084';
const RED = '#A63D2F';
const ORANGE = '#B07A2A';
const BORDER = '#E6DFD3';
const CARD_BG = '#FFFFFF';
const PAGE_BG = '#FFFFFF';



function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
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

function KitchenEntitiesShimmer({ mode }: { mode: 'stations' | 'printers' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} style={{ background: '#fff', borderRadius: 2, border: '1px solid #E6DFD3', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bone w={mode === 'stations' ? 4 : 40} h={mode === 'stations' ? 44 : 40} r={10} />
            <div style={{ flex: 1 }}>
              <Bone w="36%" h={14} mb={6} />
              <Bone w="52%" h={11} mb={6} />
              <Bone w="42%" h={10} />
            </div>
            <Bone w={54} h={24} r={6} />
          </div>
        </div>
      ))}
    </div>
  );
}

const STATION_HIGHLIGHT: CSSProperties = {
  boxShadow: 'inset 0 0 0 2px rgba(184,149,80,0.9)',
  borderRadius: 2,
};

export default function KitchenStationsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSm = useMediaQuery('(min-width: 640px)');
  const isMobile = useMediaQuery('(max-width: 768px)');
  const {
    stations,
    printers,
    loading,
    fetchStations,
    clearStationsCache,
    deleteStationOnServer,
    updateStationOnServer,
    error,
    addPrinter,
    updatePrinter,
    removePrinter,
    setEditingStationId,
    loadedLocationId: stationsLoadedLocationId,
  } = useKitchenStationsStore();
  const { items, updateItem, fetchItems } = useItemsStore();
  const { addToast } = useToastStore();
  const { auth } = useAuth();
  const { selectedBranch } = useBranch();
  const token = auth?.accessToken ?? auth?.access_token ?? null;

  // Kitchen printing: outlet-wide default (real API — GET/PATCH /locations/order-type-kot).
  const kitchenPrintLocationId = String(selectedBranch?.id ?? selectedBranch?.locationId ?? '').trim();
  const { outletDefault: kitchenPrintOutletDefault, save: saveKitchenPrintOutletDefault } = useOutletKitchenPrintDefault(
    kitchenPrintLocationId,
    token,
  );
  const kitchenPrintOrderTypes = useMemo(() => getKitchenPrintOrderTypes(selectedBranch), [selectedBranch]);
  const outletKitchenPrintCard = kitchenPrintLocationId ? (
    <OutletKitchenPrintCard
      key={`${kitchenPrintLocationId}:${kitchenPrintOrderTypes.map((ot) => ot.id).join(',')}`}
      orderTypes={kitchenPrintOrderTypes}
      outletDefault={kitchenPrintOutletDefault}
      onSave={async (excludedOrderTypeIds) => {
        try {
          await saveKitchenPrintOutletDefault(excludedOrderTypeIds, kitchenPrintOrderTypes);
          addToast('Kitchen printing saved', 'success');
        } catch (e) {
          addToast(e instanceof Error ? e.message : 'Failed to save kitchen printing', 'error');
        }
      }}
    />
  ) : null;

  useErrorToast(error, { fallbackMessage: 'Failed to load kitchen stations' });

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({ title: 'Kitchen Stations', breadcrumbs: 'Product Catalog' });
  }, [setTopBarProps]);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) return;
    void fetchStations(locationId, token, { skipDuplicateMs: 750 });
    void fetchItems(locationId, token, { skipDuplicateMs: 750 });
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token, fetchStations, fetchItems]);

  const activeTab = 'stations' as const;
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingHighlightStationId, setPendingHighlightStationId] = useState<string | null>(null);
  const [highlightStationId, setHighlightStationId] = useState<string | null>(null);

  // Untagged items panel
  const [untaggedExpanded, setUntaggedExpanded] = useState(false);
  const [untaggedSearch, setUntaggedSearch] = useState('');
  const [openPickerItemId, setOpenPickerItemId] = useState<string | null>(null);
  const [pickerDirection, setPickerDirection] = useState<'down' | 'up'>('down');
  const [assigningItems, setAssigningItems] = useState<Set<string>>(new Set());

  const [deleteStationId, setDeleteStationId] = useState<string | null>(null);
  // Items-move-before-delete (destination station) — disabled for now; delete is confirmation-only.
  // const [destinationStationId, setDestinationStationId] = useState('');
  const [deletingStation, setDeletingStation] = useState(false);
  const [deletingPrinter, setDeletingPrinter] = useState(false);

  const [deletePrinterTarget, setDeletePrinterTarget] = useState<{ id: string; name: string } | null>(null);

  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [printerForm, setPrinterForm] = useState({
    name: '',
    type: 'kot' as Printer['type'],
    connectionType: 'network' as Printer['connectionType'],
    connectionDetails: '',
    isMasterKot: false,
    stationIds: [] as string[],
  });
  const [printerErrors, setPrinterErrors] = useState<Record<string, string>>({});

  const stationsSorted = useMemo(
    () =>
      [...stations].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })),
    [stations],
  );

  const itemCountByStation = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of stations) {
      m[s.id] = Number.isFinite(s.itemCount) ? Number(s.itemCount) : 0;
    }
    return m;
  }, [stations]);

  const printerCountByStation = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of stations) m[s.id] = 0;
    for (const p of printers) {
      for (const sid of p.stationIds) {
        if (m[sid] !== undefined) m[sid] += 1;
      }
    }
    return m;
  }, [stations, printers]);

  /* PCF-7: Unmapped kitchen items — primary station is default and not explicitly assigned (multi-station items use kitchenStationId = first tag). */
  const defaultStation = useMemo(() => stations.find((s) => s.isDefault), [stations]);
  const unmappedItems = useMemo(() => {
    if (!defaultStation) return [];
    return items.filter(
      (item) =>
        item.kitchenStationId === defaultStation.id &&
        !item.explicitlyAssignedStation
    );
  }, [items, defaultStation]);

  /* Untagged items — no kitchen station assigned at all */
  const untaggedItems = useMemo(
    () => items.filter((item) => !item.kitchenStationId),
    [items],
  );

  const filteredUntaggedItems = useMemo(() => {
    if (!untaggedSearch.trim()) return untaggedItems;
    const q = untaggedSearch.toLowerCase();
    return untaggedItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.itemCode ?? '').toLowerCase().includes(q),
    );
  }, [untaggedItems, untaggedSearch]);

  const handleAssignStation = useCallback(
    async (itemId: string, itemName: string, stationId: string, stationName: string) => {
      setOpenPickerItemId(null);
      setAssigningItems((prev) => new Set(prev).add(itemId));
      // Optimistic local removal
      updateItem(itemId, { kitchenStationId: stationId, explicitlyAssignedStation: true });
      try {
        const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
        const token = auth?.accessToken ?? auth?.access_token ?? null;
        await updateStationOnServer({ id: stationId, locationId, itemIds: [itemId] }, token);
        addToast(`'${itemName}' assigned to ${stationName}`, 'success');
        // Clear cache and force-refresh both items and stations
        clearStationsCache();
        await Promise.all([
          fetchItems(locationId, token, { force: true }),
          fetchStations(locationId, token, { force: true }),
        ]);
      } catch (e) {
        // Revert optimistic update on failure
        updateItem(itemId, { kitchenStationId: undefined, explicitlyAssignedStation: false });
        addToast(e instanceof Error ? e.message : 'Failed to assign station', 'error');
      } finally {
        setAssigningItems((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    },
    [updateItem, addToast, updateStationOnServer, fetchItems, fetchStations, clearStationsCache, selectedBranch, auth],
  );

  // Close station picker on outside click
  useEffect(() => {
    if (!openPickerItemId) return;
    const handler = () => setOpenPickerItemId(null);
    const id = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', handler);
    };
  }, [openPickerItemId]);

  const filteredStations = useMemo(() => {
    if (!searchQuery.trim()) return stationsSorted;
    const q = searchQuery.toLowerCase();
    return stationsSorted.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }, [stationsSorted, searchQuery]);

  const branchLocationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
  const listReadyForBranch =
    Boolean(branchLocationId) && stationsLoadedLocationId === branchLocationId;

  useEffect(() => {
    const hid = searchParams.get('highlight')?.trim();
    if (!hid || !listReadyForBranch) return;
    if (pendingHighlightStationId === hid) return;
    setPendingHighlightStationId(hid);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('highlight');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams, listReadyForBranch, pendingHighlightStationId]);

  useEffect(() => {
    const hid = pendingHighlightStationId;
    if (!hid) return;
    setHighlightStationId(hid);

    let rafId = 0;
    let attempts = 0;
    const maxAttempts = 300;
    const waitForRow = () => {
      const row = document.getElementById(`catalog-kitchen-station-row-${hid}`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) rafId = window.requestAnimationFrame(waitForRow);
    };
    rafId = window.requestAnimationFrame(waitForRow);

    const clearTimer = window.setTimeout(() => {
      setHighlightStationId(null);
      setPendingHighlightStationId(null);
    }, 3000);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      clearTimeout(clearTimer);
    };
  }, [pendingHighlightStationId, stations]);

  const deleteStation = useMemo(
    () => (deleteStationId ? stations.find((s) => s.id === deleteStationId) ?? null : null),
    [deleteStationId, stations],
  );

  // Used only for optional copy in delete modal (move-items flow commented out).
  const deleteStationItemCount = deleteStation ? itemCountByStation[deleteStation.id] ?? 0 : 0;

  const openCreatePrinter = useCallback(() => {
    setEditingPrinter(null);
    setPrinterForm({
      name: '',
      type: 'kot',
      connectionType: 'network',
      connectionDetails: '',
      isMasterKot: false,
      stationIds: [],
    });
    setPrinterErrors({});
    setPrinterModalOpen(true);
  }, []);

  const openEditPrinter = useCallback((printer: Printer) => {
    setEditingPrinter(printer);
    setPrinterForm({
      name: printer.name,
      type: printer.type,
      connectionType: printer.connectionType,
      connectionDetails: printer.connectionDetails,
      isMasterKot: printer.isMasterKot,
      stationIds: [...printer.stationIds],
    });
    setPrinterErrors({});
    setPrinterModalOpen(true);
  }, []);

  const connectionPlaceholder = useMemo(() => {
    switch (printerForm.connectionType) {
      case 'network':
        return 'e.g. 192.168.1.100';
      case 'usb':
        return 'e.g. USB-001';
      case 'bluetooth':
        return 'e.g. BT-Printer-01';
    }
  }, [printerForm.connectionType]);

  const togglePrinterStation = useCallback((stationId: string) => {
    setPrinterForm((prev) => ({
      ...prev,
      stationIds: prev.stationIds.includes(stationId)
        ? prev.stationIds.filter((id) => id !== stationId)
        : [...prev.stationIds, stationId],
    }));
  }, []);

  const confirmDeleteStation = () => {
    if (deletingStation) return;
    if (!deleteStationId) return;
    // if (deleteStationItemCount > 0 && !destinationStationId) return;
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) {
      addToast('Location is required to delete station.', 'error');
      return;
    }

    // Move assigned items to another station before delete — disabled for now.
    // if (deleteStationItemCount > 0) {
    //   for (const it of items) {
    //     if (it.kitchenStationId === deleteStationId) {
    //       updateItem(it.id, { kitchenStationId: destinationStationId });
    //     }
    //   }
    // }

    for (const p of printers) {
      if (p.stationIds.includes(deleteStationId)) {
        updatePrinter(p.id, {
          stationIds: p.stationIds.filter((sid) => sid !== deleteStationId),
        });
      }
    }

    void (async () => {
      try {
        setDeletingStation(true);
        await deleteStationOnServer({ id: deleteStationId, locationId }, token);
        setDeleteStationId(null);
        // setDestinationStationId('');
        clearStationsCache();
        void fetchStations(locationId, token, { force: true });
        addToast('Station deleted successfully', 'success');
      } catch (e) {
        addToast(e instanceof Error ? e.message : 'Failed to delete station', 'error');
      } finally {
        setDeletingStation(false);
      }
    })();
  };

  const confirmDeletePrinter = () => {
    if (!deletePrinterTarget) return;
    if (deletingPrinter) return;
    setDeletingPrinter(true);
    try {
      removePrinter(deletePrinterTarget.id);
      setDeletePrinterTarget(null);
      addToast('Printer deleted', 'success');
    } finally {
      setDeletingPrinter(false);
    }
  };

  const handleSavePrinter = () => {
    const errs: Record<string, string> = {};
    if (!printerForm.name.trim()) errs.name = 'Name is required';
    setPrinterErrors(errs);
    if (Object.keys(errs).length > 0) return;

    if (printerForm.isMasterKot) {
      for (const p of printers) {
        if (p.id !== editingPrinter?.id && p.isMasterKot) {
          updatePrinter(p.id, { isMasterKot: false });
        }
      }
    }

    const payload = {
      name: printerForm.name.trim(),
      type: printerForm.type,
      connectionType: printerForm.connectionType,
      connectionDetails: printerForm.connectionDetails.trim(),
      isMasterKot: printerForm.isMasterKot,
      stationIds: printerForm.stationIds,
    };

    if (editingPrinter) {
      updatePrinter(editingPrinter.id, payload);
      addToast('Printer updated', 'success');
    } else {
      addPrinter(payload);
      addToast('Printer added', 'success');
    }
    setPrinterModalOpen(false);
  };

  const searchInputStyle: CSSProperties = {
    width: '100%',
    paddingLeft: 36,
    paddingRight: searchQuery ? 36 : 12,
    border: `1px solid ${BORDER}`,
    borderRadius: 2,
    fontSize: 13,
    height: 40,
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'var(--font-primary, "Jost", sans-serif)',
    color: T1,
    background: CARD_BG,
  };

  /** Full-width shell only — scroll lives on DesktopLayout’s main pane so the scrollbar stays at the right edge. */
  const pageShell: CSSProperties = {
    width: '100%',
    minWidth: 0,
    background: PAGE_BG,
    boxSizing: 'border-box',
  };

  const pageContent: CSSProperties = {
    width: '100%',
    minWidth: 0,
    padding: '12px 25px 32px',
    boxSizing: 'border-box',
  };

  if (isMobile) return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif" }}>
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span onClick={() => navigate(PC_BASE)} className="material-symbols-rounded" style={{ fontSize: 22, color: T1, cursor: 'pointer' }}>arrow_back</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: T1, margin: 0 }}>Kitchen Stations</h1>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <ProductCatalogSyncBanner compact syncOnly />

        {outletKitchenPrintCard}

        {/* Search */}
        {stations.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <span className="material-symbols-rounded" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: T3, pointerEvents: 'none' }}>search</span>
              <input
                type="search"
                placeholder="Search stations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={searchInputStyle}
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T3, padding: 4, display: 'flex' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>close</span>
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'stations' && (
          <>
            {loading && <KitchenEntitiesShimmer mode="stations" />}
            {!loading && stations.length === 0 && (
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '40px 24px' }}>
                <CatalogListEmptyState
                  icon="countertops"
                  name="kitchen stations"
                  title="No kitchen stations yet"
                  description="Create stations to route orders."
                  action={<Button onClick={() => navigate(pcPaths.kitchenStationsCreate)} style={{ background: ACCENT }}>Create Station</Button>}
                />
              </div>
            )}

            {!loading && filteredStations.length === 0 && stations.length > 0 && searchQuery && (
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '40px 24px' }}>
                <CatalogListEmptyState
                  icon="countertops"
                  name="kitchen stations"
                  description={`No stations matching "${searchQuery}".`}
                />
              </div>
            )}

            {!loading && filteredStations.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredStations.map((station) => {
                  const ic = itemCountByStation[station.id] ?? 0;
                  const pc = printerCountByStation[station.id] ?? 0;
                  const isDefault = Boolean(station.isDefault);
                  return (
                    <div
                      key={station.id}
                      id={`catalog-kitchen-station-row-${station.id}`}
                      onClick={() => { setEditingStationId(station.id); navigate(pcPaths.kitchenStationEdit); }}
                      style={{
                        background: '#fff', borderRadius: 2, border: '1px solid #E6DFD3',
                        padding: '14px 16px', cursor: 'pointer',
                        ...(String(highlightStationId) === String(station.id) ? STATION_HIGHLIGHT : {}),
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span title={station.name} style={{ fontSize: 14, fontWeight: 700, color: T1, flex: 1 }}>{station.name.length > 30 ? station.name.slice(0, 30) + '...' : station.name}</span>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: T3, background: PAGE_BG, padding: '1px 6px', borderRadius: 4 }}>{station.code}</span>
                        {isDefault && <span style={{ fontSize: 11, fontWeight: 600, color: ACCENT, background: ACCENT_BG, padding: '2px 8px', borderRadius: 2 }}>Default</span>}
                        <span className="material-symbols-rounded" style={{ fontSize: 18, color: T3 }}>chevron_right</span>
                      </div>
                      {station.description && (
                        <p style={{ fontSize: 12, color: T2, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{station.description}</p>
                      )}
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: T3 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>layers</span>{ic} items
                        </span>
                        {/* <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: pc === 0 ? ORANGE : T3 }}>
                          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>print</span>{pc > 0 ? `${pc} printers` : 'No printers'}
                        </span> */}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Untagged Items — no kitchen station assigned */}
        {activeTab === 'stations' && !loading && untaggedItems.length > 0 && (
          <div style={{ marginTop: 16, borderRadius: 2, border: `1.5px solid ${ACCENT}30`, background: `${ACCENT}06`, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setUntaggedExpanded((v) => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 20, color: ACCENT }}>label_off</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: T1, flex: 1 }}>{/* was: Untagged Items */}Untagged Products ({untaggedItems.length})</span>
              <span className="material-symbols-rounded" style={{ fontSize: 20, color: T3, transition: 'transform 0.2s', transform: untaggedExpanded ? 'rotate(180deg)' : 'none' }}>expand_more</span>
            </button>
            {untaggedExpanded && (
              <div style={{ padding: '0 16px 16px' }}>
                <p style={{ fontSize: 12, color: T2, margin: '0 0 10px', lineHeight: 1.5 }}>
                  {/* was: These items have no kitchen station. Assign them so orders route correctly. */}These products have no kitchen station. Assign them so orders route correctly.
                </p>
                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <span className="material-symbols-rounded" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: T3, pointerEvents: 'none' }}>search</span>
                  <input
                    type="search"
                    placeholder="Search products..." /* was: placeholder="Search items..." */
                    value={untaggedSearch}
                    onChange={(e) => setUntaggedSearch(e.target.value)}
                    style={{ width: '100%', paddingLeft: 30, paddingRight: 10, border: `1px solid ${BORDER}`, borderRadius: 2, fontSize: 12, height: 34, boxSizing: 'border-box', outline: 'none', fontFamily: 'var(--font-primary)', color: T1, background: CARD_BG }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filteredUntaggedItems.map((item) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 2, background: CARD_BG, border: `1px solid ${BORDER}`, position: 'relative' }}>
                      <div style={{ minWidth: 0, flex: 1, marginRight: 8 }}>
                        <span
                          title={item.name.length > 30 ? item.name : undefined}
                          style={{ fontSize: 13, fontWeight: 600, color: T1, display: 'block' }}
                        >
                          {item.name.length > 30 ? `${item.name.slice(0, 30)}…` : item.name}
                        </span>
                        {item.itemCode && <span style={{ fontSize: 11, color: T3 }}>#{item.itemCode}</span>}
                      </div>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        {assigningItems.has(item.id) ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 2, border: `1px solid ${BORDER}`, background: '#fff' }}>
                            <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${BORDER}`, borderTopColor: ACCENT, display: 'inline-block', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: T3 }}>Saving…</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); const spaceBelow = window.innerHeight - rect.bottom; setPickerDirection(spaceBelow < 400 ? 'up' : 'down'); setOpenPickerItemId((id) => id === item.id ? null : item.id); }}
                            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 2, border: `1px solid ${openPickerItemId === item.id ? ACCENT : BORDER}`, background: '#fff', color: openPickerItemId === item.id ? ACCENT : T1, cursor: 'pointer', fontFamily: 'var(--font-primary)', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            Assign
                            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>expand_more</span>
                          </button>
                        )}
                        {openPickerItemId === item.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ position: 'absolute', right: 0, ...(pickerDirection === 'up' ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }), zIndex: 200, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 180, maxHeight: 380, overflowY: 'auto' }}
                          >
                            {stationsSorted.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => void handleAssignStation(item.id, item.name, s.id, s.name)}
                                style={{ width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: T1, fontFamily: 'var(--font-primary)', display: 'flex', alignItems: 'center', gap: 6 }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = PAGE_BG; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                              >
                                {s.name}
                                {s.isDefault && <span style={{ fontSize: 10, color: T3 }}>(Default)</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredUntaggedItems.length === 0 && untaggedSearch && (
                    <p style={{ fontSize: 12, color: T3, textAlign: 'center', padding: '16px 0', margin: 0 }}>{/* was: No items matching */}No products matching "{untaggedSearch}"</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* FAB */}
      <div
        onClick={() => activeTab === 'stations' ? navigate(pcPaths.kitchenStationsCreate) : openCreatePrinter()}
        style={{
          position: 'fixed', bottom: 80, right: 16, width: 56, height: 56,
          background: '#B89550', borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(184,149,80,0.35)', cursor: 'pointer', zIndex: 999,
        }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: 28, color: '#fff' }}>add</span>
      </div>

      {/* Modals */}
      <Modal
        open={!!deleteStationId}
        onClose={() => { if (!deletingStation) setDeleteStationId(null); }}
        title="Delete Station"
        footer={
          <>
            <Button variant="ghost" disabled={deletingStation} onClick={() => { setDeleteStationId(null); }}>Cancel</Button>
            <Button
              onClick={confirmDeleteStation}
              disabled={deletingStation}
              style={{ background: deletingStation ? T3 : RED, color: '#fff' }}
            >
              {deletingStation ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        }
      >
        {deleteStation ? (
          <div>
            <p style={{ fontSize: 13, color: T2, margin: 0, lineHeight: 1.6 }}>
              Delete <strong style={{ color: T1 }}>{deleteStation.name}</strong>?
              {deleteStationItemCount > 0 ? (
                <> This station has <strong style={{ color: T1 }}>{deleteStationItemCount} items</strong> assigned.</>
              ) : null}{' '}
              Printer links to this station will be removed. This cannot be undone.
            </p>
            {/*
            {deleteStationItemCount > 0 && (
              <Select
                label="Move products to"
                value={destinationStationId}
                onChange={setDestinationStationId}
                placeholder="Select a station..."
                options={stations.filter((s) => s.id !== deleteStationId).map((s) => ({ value: s.id, label: s.name }))}
              />
            )}
            */}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={printerModalOpen}
        onClose={() => setPrinterModalOpen(false)}
        title={editingPrinter ? 'Edit Printer' : 'Add Printer'}
        width={500}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPrinterModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePrinter} disabled={!printerForm.name.trim()} style={{ background: !printerForm.name.trim() ? T3 : ACCENT, color: '#fff' }}>
              {editingPrinter ? 'Save Changes' : 'Save'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <TextField label="Printer Name" value={printerForm.name} onChange={(v) => setPrinterForm((p) => ({ ...p, name: v }))} required error={printerErrors.name} placeholder="e.g. Grill Printer" />
          <Select label="Printer Type" value={printerForm.type} onChange={(v) => setPrinterForm((p) => ({ ...p, type: v as Printer['type'] }))} options={[{ value: 'kot', label: 'KOT' }, { value: 'label', label: 'Label' }, { value: 'receipt', label: 'Receipt' }]} />
          <Select label="Connection Type" value={printerForm.connectionType} onChange={(v) => setPrinterForm((p) => ({ ...p, connectionType: v as Printer['connectionType'] }))} options={[{ value: 'network', label: 'Network' }, { value: 'usb', label: 'USB' }, { value: 'bluetooth', label: 'Bluetooth' }]} />
          <TextField label="Connection Details" value={printerForm.connectionDetails} onChange={(v) => setPrinterForm((p) => ({ ...p, connectionDetails: v }))} placeholder={connectionPlaceholder} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: T1, display: 'block' }}>Master KOT</span>
              <span style={{ fontSize: 12, color: T3 }}>Prints all orders</span>
            </div>
            <Toggle checked={printerForm.isMasterKot} onChange={(v) => setPrinterForm((p) => ({ ...p, isMasterKot: v }))} />
          </div>
          <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: T1, display: 'block', marginBottom: 10 }}>Assigned Stations</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stationsSorted.map((station) => {
                const checked = printerForm.stationIds.includes(station.id);
                return (
                  <label key={station.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 10px', borderRadius: 2, background: checked ? ACCENT_BG : 'transparent', border: `1px solid ${checked ? `${ACCENT}30` : 'transparent'}` }}>
                    <input type="checkbox" checked={checked} onChange={() => togglePrinterStation(station.id)} />
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: checked ? ACCENT : T3, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: T1 }}>{station.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      <DeleteConfirmationModal
        open={!!deletePrinterTarget}
        onClose={() => {
          if (deletingPrinter) return;
          setDeletePrinterTarget(null);
        }}
        onConfirm={confirmDeletePrinter}
        confirmLoading={deletingPrinter}
        title={deletePrinterTarget ? deleteConfirmTitle(deletePrinterTarget.name) : deleteConfirmTitle('this printer')}
        description="This printer will be removed from your kitchen setup. This cannot be undone."
      />
      <BottomNav />
    </div>
  );

  return (
    <DesktopLayout>
      <div style={pageShell}>
        <div style={pageContent}>
          <PageHeader
            icon={
              <span className="material-symbols-rounded" style={{ fontSize: 24, color: 'rgba(255,255,255,0.95)' }}>
                {activeTab === 'stations' ? 'countertops' : 'print'}
              </span>
            }
            title={activeTab === 'stations' ? 'Kitchen Stations' : 'Printers'}
            subtitle={activeTab === 'stations'
              ? 'Organize products by preparation area for efficient kitchen routing' /* was: 'Organize items by preparation area for efficient kitchen routing' */
              : 'Manage kitchen, label, and receipt printers for your stations'}
            actions={
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {activeTab === 'stations' && (
                  <CatalogHelpLink
                    topic="Kitchen Stations"
                    Tutorial={KitchenStationsTutorial}
                    onTutorialComplete={() => navigate(pcPaths.kitchenStationsCreate)}
                  />
                )}
                <Button
                  icon={
                    <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'rgba(255,255,255,0.95)' }}>
                      add
                    </span>
                  }
                  onClick={activeTab === 'stations' ? () => navigate(pcPaths.kitchenStationsCreate) : openCreatePrinter}
                >
                  {activeTab === 'stations' ? 'Create Station' : 'Add Printer'}
                </Button>
              </div>
            }
          />

          <ProductCatalogSyncBanner syncOnly />

          {outletKitchenPrintCard}

          {activeTab === 'stations' && (
            <>
              {loading && <KitchenEntitiesShimmer mode="stations" />}
              {!loading && stations.length > 0 && (
                <div style={{ position: 'relative', width: '100%', marginBottom: 20 }}>
                  <span
                    className="material-symbols-rounded"
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 18,
                      color: T3,
                      pointerEvents: 'none',
                    }}
                  >
                    search
                  </span>
                  <input
                    type="search"
                    placeholder="Search stations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={searchInputStyle}
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: T3,
                        padding: 4,
                        display: 'flex',
                      }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>close</span>
                    </button>
                  ) : null}
                </div>
              )}

              {!loading && stations.length === 0 && (
                <div
                  style={{
                    background: CARD_BG,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 2,
                    padding: '56px 32px',
                  }}
                >
                  <CatalogListEmptyState
                    icon="countertops"
                    name="kitchen stations"
                    title="No kitchen stations yet"
                    description="Create stations to route orders to the right preparation area in your kitchen."
                    action={(
                      <Button onClick={() => navigate(pcPaths.kitchenStationsCreate)} style={{ background: ACCENT, fontWeight: 600, fontSize: 13, gap: 6 }}>
                        <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'rgba(255,255,255,0.95)' }}>add</span>
                        Create Your First Station
                      </Button>
                    )}
                  />
                </div>
              )}

              {!loading && stations.length > 0 && filteredStations.length === 0 && searchQuery && (
                <div
                  style={{
                    background: CARD_BG,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 2,
                    padding: '40px 32px',
                  }}
                >
                  <CatalogListEmptyState
                    icon="countertops"
                    name="kitchen stations"
                    description={`No stations matching "${searchQuery}".`}
                  />
                </div>
              )}

              {!loading && filteredStations.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredStations.map((station) => {
                    const ic = itemCountByStation[station.id] ?? 0;
                    const pc = printerCountByStation[station.id] ?? 0;
                    const isDefault = Boolean(station.isDefault);
                    return (
                      <div
                        key={station.id}
                        id={`catalog-kitchen-station-row-${station.id}`}
                        style={{
                          background: CARD_BG,
                          border: `1px solid ${BORDER}`,
                          borderRadius: 2,
                          boxShadow:
                            String(highlightStationId) === String(station.id)
                              ? 'inset 0 0 0 2px rgba(184,149,80,0.9)'
                              : '0 1px 4px rgba(0,0,0,0.05)',
                          padding: '12px 16px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: isSm ? 14 : 10 }}>
                          {/* <span
                            className="material-symbols-rounded"
                            style={{
                              color: T3,
                              flexShrink: 0,
                              cursor: 'grab',
                              fontSize: 18,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 24,
                              height: 24,
                            }}
                          >
                            drag_indicator
                          </span> */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                              <span title={station.name} style={{ fontSize: 14, fontWeight: 700, color: T1 }}>{station.name.length > 30 ? station.name.slice(0, 30) + '...' : station.name}</span>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontFamily: 'monospace',
                                  color: T3,
                                  background: PAGE_BG,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                }}
                              >
                                {station.code}
                              </span>
                              {isDefault && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: ACCENT,
                                    background: ACCENT_BG,
                                    padding: '2px 8px',
                                    borderRadius: 2,
                                  }}
                                >
                                  Default
                                </span>
                              )}
                            </div>
                            <p
                              style={{
                                fontSize: 12,
                                color: T2,
                                margin: '0 0 4px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {station.description}
                            </p>
                            {isSm ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: T3 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span className="material-symbols-rounded" style={{ fontSize: 14 }}>layers</span>
                                  {/* was: {ic} items */}{ic} products
                                </span>
                                {/* <span
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    color: pc === 0 ? ORANGE : T3,
                                  }}
                                >
                                  <span className="material-symbols-rounded" style={{ fontSize: 14 }}>print</span>
                                  {pc > 0 ? `${pc} printers` : 'No printers'}
                                </span> */}
                              </div>
                            ) : null}
                          </div>
                          {isSm ? (
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center', alignSelf: 'center' }}>
                              <button
                                type="button"
                                title="Edit station"
                                style={catalogListActionButtonStyle}
                                onMouseEnter={catalogListActionEnterDefault}
                                onMouseLeave={catalogListActionLeaveDefault}
                                onClick={() => { setEditingStationId(station.id); navigate(pcPaths.kitchenStationEdit); }}
                              >
                                <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>edit</span>
                              </button>
                              <button
                                type="button"
                                title={isDefault ? 'Cannot delete default station' : 'Delete station'}
                                disabled={isDefault}
                                style={{
                                  ...catalogListActionButtonStyle,
                                  cursor: isDefault ? 'not-allowed' : 'pointer',
                                  opacity: isDefault ? 0.45 : 1,
                                }}
                                onMouseEnter={(e) => {
                                  if (!isDefault) catalogListActionEnterDanger(e);
                                }}
                                onMouseLeave={(e) => {
                                  if (!isDefault) catalogListActionLeaveDanger(e);
                                }}
                                onClick={() => !isDefault && setDeleteStationId(station.id)}
                              >
                                <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>delete</span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                        {!isSm ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: T3 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span className="material-symbols-rounded" style={{ fontSize: 14 }}>layers</span>
                                {/* was: {ic} items */}{ic} products
                              </span>
                              {/* <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: pc === 0 ? ORANGE : T3 }}>
                                <span className="material-symbols-rounded" style={{ fontSize: 14 }}>print</span>
                                {pc > 0 ? `${pc} printers` : 'No printers'}
                              </span> */}
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                type="button"
                                title="Edit station"
                                style={catalogListActionButtonStyle}
                                onMouseEnter={catalogListActionEnterDefault}
                                onMouseLeave={catalogListActionLeaveDefault}
                                onClick={() => { setEditingStationId(station.id); navigate(pcPaths.kitchenStationEdit); }}
                              >
                                <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>edit</span>
                              </button>
                              <button
                                type="button"
                                title={isDefault ? 'Cannot delete default station' : 'Delete station'}
                                disabled={isDefault}
                                style={{
                                  ...catalogListActionButtonStyle,
                                  cursor: isDefault ? 'not-allowed' : 'pointer',
                                  opacity: isDefault ? 0.45 : 1,
                                }}
                                onMouseEnter={(e) => {
                                  if (!isDefault) catalogListActionEnterDanger(e);
                                }}
                                onMouseLeave={(e) => {
                                  if (!isDefault) catalogListActionLeaveDanger(e);
                                }}
                                onClick={() => !isDefault && setDeleteStationId(station.id)}
                              >
                                <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>delete</span>
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* PCF-7: Unmapped Kitchen Items */}
          {activeTab === 'stations' && unmappedItems.length > 0 && (
            <div style={{
              marginTop: 24, padding: 20, borderRadius: 2,
              border: `1.5px solid ${ORANGE}40`, background: `${ORANGE}06`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 22, color: ORANGE }}>warning</span>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: T1, margin: 0 }}>
                  {/* was: Unmapped Kitchen Items ({unmappedItems.length}) */}Unmapped Kitchen Products ({unmappedItems.length})
                </h3>
              </div>
              <p style={{ fontSize: 12, color: T2, margin: '0 0 14px', lineHeight: 1.5 }}>
                {/* was: These items are on the default station but haven't been explicitly assigned. Assign them to a specific station or confirm they belong on the default. */}These products are on the default station but haven't been explicitly assigned. Assign them to a specific station or confirm they belong on the default.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {unmappedItems.slice(0, 10).map((item) => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 2, background: CARD_BG, border: `1px solid ${BORDER}`,
                  }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{item.name}</span>
                      <span style={{ fontSize: 11, color: T3, marginLeft: 8 }}>#{item.itemCode}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select
                        style={{
                          fontSize: 11, padding: '4px 8px', borderRadius: 2, border: `1px solid ${BORDER}`,
                          background: '#fff', color: T1, cursor: 'pointer', fontFamily: 'var(--font-primary)',
                        }}
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value === '__confirm__') {
                            updateItem(item.id, { explicitlyAssignedStation: true });
                            addToast(`'${item.name}' confirmed on ${defaultStation?.name ?? 'default'}`, 'success');
                          } else if (e.target.value) {
                            updateItem(item.id, { kitchenStationId: e.target.value, explicitlyAssignedStation: true });
                            const stName = stations.find((s) => s.id === e.target.value)?.name ?? '';
                            addToast(`'${item.name}' assigned to ${stName}`, 'success');
                          }
                        }}
                      >
                        <option value="" disabled>Assign...</option>
                        <option value="__confirm__">✓ Confirm on {defaultStation?.name ?? 'Master'}</option>
                        {stations.filter((s) => s.id !== defaultStation?.id).map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                {unmappedItems.length > 10 && (
                  <p style={{ fontSize: 11, color: T3, margin: '4px 0 0', textAlign: 'center' }}>
                    +{unmappedItems.length - 10} more items
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Untagged Items — no kitchen station assigned */}
          {activeTab === 'stations' && !loading && untaggedItems.length > 0 && (
            <div style={{ marginTop: 24, borderRadius: 2, border: `1.5px solid ${ACCENT}30`, background: `${ACCENT}06`, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setUntaggedExpanded((v) => !v)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 20, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 22, color: ACCENT }}>label_off</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: T1, flex: 1 }}>{/* was: Untagged Items */}Untagged Products ({untaggedItems.length})</span>
                <span className="material-symbols-rounded" style={{ fontSize: 20, color: T3, transition: 'transform 0.2s', transform: untaggedExpanded ? 'rotate(180deg)' : 'none' }}>expand_more</span>
              </button>
              {untaggedExpanded && (
                <div style={{ padding: '0 20px 20px' }}>
                  <p style={{ fontSize: 12, color: T2, margin: '0 0 14px', lineHeight: 1.5 }}>
                    {/* was: These items have no kitchen station assigned. Assign them so orders route correctly. */}These products have no kitchen station assigned. Assign them so orders route correctly.
                  </p>
                  <div style={{ position: 'relative', marginBottom: 14 }}>
                    <span className="material-symbols-rounded" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: T3, pointerEvents: 'none' }}>search</span>
                    <input
                      type="search"
                      placeholder="Search products..." /* was: placeholder="Search items..." */
                      value={untaggedSearch}
                      onChange={(e) => setUntaggedSearch(e.target.value)}
                      style={{ width: '100%', paddingLeft: 32, paddingRight: 12, border: `1px solid ${BORDER}`, borderRadius: 2, fontSize: 13, height: 36, boxSizing: 'border-box', outline: 'none', fontFamily: 'var(--font-primary)', color: T1, background: CARD_BG }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filteredUntaggedItems.map((item) => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 2, background: CARD_BG, border: `1px solid ${BORDER}`, position: 'relative' }}>
                        <div>
                          <span
                            title={item.name.length > 30 ? item.name : undefined}
                            style={{ fontSize: 13, fontWeight: 600, color: T1 }}
                          >
                            {item.name.length > 30 ? `${item.name.slice(0, 30)}…` : item.name}
                          </span>
                          {item.itemCode && <span style={{ fontSize: 11, color: T3, marginLeft: 8 }}>#{item.itemCode}</span>}
                        </div>
                        <div style={{ position: 'relative' }}>
                          {assigningItems.has(item.id) ? (
                            <span style={{ fontSize: 12, color: T3 }}>Saving…</span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); const spaceBelow = window.innerHeight - rect.bottom; setPickerDirection(spaceBelow < 420 ? 'up' : 'down'); setOpenPickerItemId((id) => id === item.id ? null : item.id); }}
                              style={{ fontSize: 13, padding: '6px 12px', borderRadius: 2, border: `1px solid ${openPickerItemId === item.id ? ACCENT : BORDER}`, background: '#fff', color: openPickerItemId === item.id ? ACCENT : T1, cursor: 'pointer', fontFamily: 'var(--font-primary)', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              Assign
                              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>expand_more</span>
                            </button>
                          )}
                          {openPickerItemId === item.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{ position: 'absolute', right: 0, ...(pickerDirection === 'up' ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }), zIndex: 200, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 200, maxHeight: 400, overflowY: 'auto' }}
                            >
                              {stationsSorted.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => void handleAssignStation(item.id, item.name, s.id, s.name)}
                                  style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: T1, fontFamily: 'var(--font-primary)', display: 'flex', alignItems: 'center', gap: 6 }}
                                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = PAGE_BG; }}
                                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                                >
                                  {s.name}
                                  {s.isDefault && <span style={{ fontSize: 11, color: T3 }}>(Default)</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {filteredUntaggedItems.length === 0 && untaggedSearch && (
                      <p style={{ fontSize: 12, color: T3, textAlign: 'center', padding: '20px 0', margin: 0 }}>{/* was: No items matching */}No products matching "{untaggedSearch}"</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <Modal
        open={!!deleteStationId}
        onClose={() => {
          if (deletingStation) return;
          setDeleteStationId(null);
        }}
        title="Delete Station"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={deletingStation}
              onClick={() => {
                setDeleteStationId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteStation}
              disabled={deletingStation}
              style={{
                background: deletingStation ? T3 : RED,
                color: '#fff',
              }}
            >
              {deletingStation ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        }
      >
        {deleteStation ? (
          <div>
            <p style={{ fontSize: 13, color: T2, margin: 0, lineHeight: 1.6 }}>
              Delete <strong style={{ color: T1 }}>{deleteStation.name}</strong>?
              {deleteStationItemCount > 0 ? (
                <> This station has <strong style={{ color: T1 }}>{deleteStationItemCount} items</strong> assigned.</>
              ) : null}{' '}
              Printer links to this station will be removed. This cannot be undone.
            </p>
            {/*
            {deleteStationItemCount > 0 ? (
              <Select
                label="Move products to"
                value={destinationStationId}
                onChange={setDestinationStationId}
                placeholder="Select a station..."
                options={stations
                  .filter((s) => s.id !== deleteStationId)
                  .map((s) => ({ value: s.id, label: s.name }))}
              />
            ) : null}
            */}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={printerModalOpen}
        onClose={() => setPrinterModalOpen(false)}
        title={editingPrinter ? 'Edit Printer' : 'Add Printer'}
        width={500}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPrinterModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSavePrinter}
              disabled={!printerForm.name.trim()}
              style={{ background: !printerForm.name.trim() ? T3 : ACCENT, color: '#fff' }}
            >
              {editingPrinter ? 'Save Changes' : 'Save'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <TextField
            label="Printer Name"
            value={printerForm.name}
            onChange={(v) => setPrinterForm((p) => ({ ...p, name: v }))}
            required
            error={printerErrors.name}
            placeholder="e.g. Grill Printer"
          />
          <Select
            label="Printer Type"
            value={printerForm.type}
            onChange={(v) => setPrinterForm((p) => ({ ...p, type: v as Printer['type'] }))}
            options={[
              { value: 'kot', label: 'KOT (Kitchen Order Ticket)' },
              { value: 'label', label: 'Label' },
              { value: 'receipt', label: 'Receipt' },
            ]}
          />
          <Select
            label="Connection Type"
            value={printerForm.connectionType}
            onChange={(v) => setPrinterForm((p) => ({ ...p, connectionType: v as Printer['connectionType'] }))}
            options={[
              { value: 'network', label: 'Network' },
              { value: 'usb', label: 'USB' },
              { value: 'bluetooth', label: 'Bluetooth' },
            ]}
          />
          <TextField
            label="Connection Details"
            value={printerForm.connectionDetails}
            onChange={(v) => setPrinterForm((p) => ({ ...p, connectionDetails: v }))}
            placeholder={connectionPlaceholder}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: T1, display: 'block' }}>Master KOT</span>
              <span style={{ fontSize: 12, color: T3 }}>Prints all orders regardless of station</span>
            </div>
            <Toggle
              checked={printerForm.isMasterKot}
              onChange={(v) => setPrinterForm((p) => ({ ...p, isMasterKot: v }))}
            />
          </div>
          <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: T1, display: 'block', marginBottom: 10 }}>Assigned Stations</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stationsSorted.map((station) => {
                const checked = printerForm.stationIds.includes(station.id);
                return (
                  <label
                    key={station.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      padding: '6px 10px',
                      borderRadius: 2,
                      background: checked ? ACCENT_BG : 'transparent',
                      border: `1px solid ${checked ? `${ACCENT}30` : 'transparent'}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePrinterStation(station.id)}
                    />
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: checked ? ACCENT : T3,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 13, color: T1 }}>{station.name}</span>
                    <span style={{ fontSize: 11, color: T3, fontFamily: 'monospace' }}>{station.code}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      <DeleteConfirmationModal
        open={!!deletePrinterTarget}
        onClose={() => {
          if (deletingPrinter) return;
          setDeletePrinterTarget(null);
        }}
        onConfirm={confirmDeletePrinter}
        confirmLoading={deletingPrinter}
        title={deletePrinterTarget ? deleteConfirmTitle(deletePrinterTarget.name) : deleteConfirmTitle('this printer')}
        description="This printer will be removed from your kitchen setup. This cannot be undone."
      />
    </DesktopLayout>
  );
}
