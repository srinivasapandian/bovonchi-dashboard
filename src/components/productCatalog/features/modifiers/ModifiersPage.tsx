import { useState, useMemo, useEffect, useCallback, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useModifiersStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import PageHeader from '../../components/layout/PageHeader';
import CatalogHelpLink from '../../components/layout/CatalogHelpLink';
import ModifiersTutorial from '../../components/tutorials/modifiers-tutorial';
import SearchInput from '../../components/forms/SearchInput';
import { CatalogDropdown } from '../../components/forms/CatalogDropdown';
import { Button } from '../../components/ui/Button';
import { DeleteConfirmationModal, deleteConfirmTitle } from '../../components/ui/DeleteConfirmationModal';
import { CatalogListEmptyState } from '../../components/ui/CatalogListEmptyState';
import { Bone } from '../../../../components/Shimmer';
import type { ModifierGroup, ModifierOption } from '../../data/types';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useErrorToast } from '../../hooks/useErrorToast';
import BottomNav from '../../../BottomNav';
import { ProductCatalogSyncBanner } from '../../components/ui/ProductCatalogSyncBanner';
import { pcPaths, PC_BASE } from '../../paths';
import {
  catalogListActionButtonStyle,
  catalogListActionEnterDefault,
  catalogListActionLeaveDefault,
  catalogListActionEnterDanger,
  catalogListActionLeaveDanger,
  CATALOG_LIST_ACTION_ICON_PX,
} from '../../catalogEntityActions';

type FilterType = 'all' | 'required' | 'optional' | 'has_oos' | 'unused';

const filterLabels: Record<FilterType, string> = {
  all: 'All Types',
  required: 'Required',
  optional: 'Optional',
  has_oos: 'Has Out-of-Stock',
  unused: 'Unused (0 items)',
};

function isModifierEffectivelyRequired(mod: ModifierGroup): boolean {
  if (mod.type !== 'options_list') return Boolean(mod.isRequired);
  return Boolean(mod.isRequired || mod.minSelection >= 1);
}

/* ── Shimmer loading placeholder ── */
function ModifiersListShimmer({ isMobile }: { isMobile: boolean }) {
  const count = isMobile ? 4 : 5;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--card-border, #E6DFD3)',
            borderRadius: isMobile ? 12 : 14,
            padding: isMobile ? '14px 16px' : '12px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!isMobile && <Bone w={18} h={18} r={4} />}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Bone w={`${100 + (i % 3) * 30}px`} h={14} />
                <Bone w={56} h={18} r={100} />
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
                <Bone w={52} h={20} r={100} />
                <Bone w={64} h={20} r={100} />
                <Bone w={48} h={20} r={100} />
                {!isMobile && <Bone w={56} h={20} r={100} />}
              </div>
            </div>
            {!isMobile && (
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Bone w={80} h={12} />
                <Bone w={100} h={12} />
                <Bone w={90} h={12} />
              </div>
            )}
            {!isMobile && (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <Bone w={30} h={30} r={6} />
                <Bone w={30} h={30} r={6} />
                <Bone w={30} h={30} r={6} />
              </div>
            )}
          </div>
          {isMobile && (
            <div style={{ marginTop: 6 }}>
              <Bone w={160} h={11} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const HIGHLIGHT_INSET: CSSProperties = {
  boxShadow: 'inset 0 0 0 2px rgba(184,149,80,0.9)',
  borderRadius: 2,
};

export default function ModifiersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    modifiers,
    removeModifier,
    fetchModifiers,
    clearModifiersCache,
    loading,
    error,
    deleteModifierOnServer,
    setEditingModifierId,
    loadedLocationId: modifiersLoadedLocationId,
  } = useModifiersStore();
  const { addToast } = useToastStore();
  const { auth } = useAuth();
  const { selectedBranch } = useBranch();

  const isMobile = useMediaQuery('(max-width: 768px)');

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({ title: 'Product Options' /* was: 'Modifiers' */, breadcrumbs: 'Product Catalog' });
  }, [setTopBarProps]);

  // Fetch modifiers on mount / branch change
  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) return;
    void fetchModifiers(locationId, token, { skipDuplicateMs: 750 });
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token, fetchModifiers]);

  useErrorToast(error);

  const branchLocationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
  const listReadyForBranch =
    Boolean(branchLocationId) && modifiersLoadedLocationId === branchLocationId;

  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [filter, setFilter] = useState<FilterType>('all');

  // Keep the active search term in the URL (?q=) so it survives an edit/cancel
  // round-trip — the form page reads it and routes back here with it intact.
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (search.trim()) next.set('q', search);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );
  }, [search, setSearchParams]);

  // Navigate to the edit form, carrying the current search term so the form can
  // return the user to these exact filtered results after save/cancel.
  const goToEditModifier = useCallback(
    (modId: string) => {
      setEditingModifierId(modId);
      const q = search.trim();
      navigate(q ? `${pcPaths.modifierEdit}?q=${encodeURIComponent(q)}` : pcPaths.modifierEdit);
    },
    [navigate, setEditingModifierId, search],
  );
  const [expandedModifiers, setExpandedModifiers] = useState<Set<string>>(new Set());

  const [pendingHighlightId, setPendingHighlightId] = useState<string | null>(null);
  const [highlightModifierId, setHighlightModifierId] = useState<string | null>(null);

  useEffect(() => {
    const hid = searchParams.get('highlight')?.trim();
    if (!hid || !listReadyForBranch) return;
    if (pendingHighlightId === hid) return;
    setPendingHighlightId(hid);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('highlight');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams, listReadyForBranch, pendingHighlightId]);

  useEffect(() => {
    const hid = pendingHighlightId;
    if (!hid) return;
    setHighlightModifierId(hid);

    let rafId = 0;
    let attempts = 0;
    const maxAttempts = 300;
    const waitForRow = () => {
      const row = document.getElementById(`catalog-modifier-row-${hid}`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) rafId = window.requestAnimationFrame(waitForRow);
    };
    rafId = window.requestAnimationFrame(waitForRow);

    const clearTimer = window.setTimeout(() => {
      setHighlightModifierId(null);
      setPendingHighlightId(null);
    }, 3000);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      clearTimeout(clearTimer);
    };
  }, [pendingHighlightId, modifiers]);
  const [deleteTarget, setDeleteTarget] = useState<ModifierGroup | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toggleExpand = useCallback((id: string) => {
    setExpandedModifiers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filterOptions = useMemo(
    () => (Object.keys(filterLabels) as FilterType[]).map((key) => ({ value: key, label: filterLabels[key] })),
    [],
  );

  const filtered = useMemo(() => {
    let result = modifiers;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.displayName.toLowerCase().includes(q) ||
          m.options.some((o) => o.name.toLowerCase().includes(q)) ||
          (m.assignedItems ?? []).some((i) => i.name.toLowerCase().includes(q)),
      );
    }

    // Type/status filter
    if (filter !== 'all') {
      result = result.filter((m) => {
        switch (filter) {
          case 'required': return isModifierEffectivelyRequired(m);
          case 'optional': return !isModifierEffectivelyRequired(m);
          case 'has_oos': return m.options.some((o) => !o.isAvailable);
          case 'unused': return (m.appliedItemCount ?? 0) === 0;
          default: return true;
        }
      });
    }

    return result;
  }, [modifiers, search, filter]);

  const confirmDeleteModifier = async () => {
    if (!deleteTarget) return;
    if (deleting) return;
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;

    if (locationId) {
      setDeleting(true);
      try {
        await deleteModifierOnServer(deleteTarget.id, locationId, token);
        setDeleteTarget(null);
        clearModifiersCache();
        addToast('Product option deleted' /* was: 'Modifier deleted' */, 'success');
        void fetchModifiers(locationId, token, { force: true });
      } catch (e) {
        addToast(e instanceof Error ? e.message : 'Failed to delete product option' /* was: 'Failed to delete modifier' */, 'error');
      } finally {
        setDeleting(false);
      }
    } else {
      removeModifier(deleteTarget.id);
      setDeleteTarget(null);
      clearModifiersCache();
      addToast('Product option deleted' /* was: 'Modifier deleted' */, 'success');
    }
  };

  const handleDuplicate = (mod: ModifierGroup) => {
    navigate(`${pcPaths.modifiersCreate}?clone=${encodeURIComponent(mod.id)}`);
  };

  const getSelectionLabel = (mod: ModifierGroup) => {
    if (mod.type === 'text_field') return '';
    const req = isModifierEffectivelyRequired(mod) ? 'Required' : 'Optional';
    if (!mod.allowMultiple) return `${req} \u00B7 Single select`;
    return `${req} \u00B7 Multi (${mod.minSelection}\u2013${mod.maxSelection})`;
  };

  const hasOos = (mod: ModifierGroup) => mod.options.some((o) => !o.isAvailable);

  // --- Styles ---

  const selectStyle: React.CSSProperties = {
    fontSize: 13,
    fontFamily: 'var(--font-primary, Jost, sans-serif)',
    color: 'var(--t1, #453F39)',
    border: '1px solid var(--card-border, #E6DFD3)',
    borderRadius: 2,
    padding: '8px 14px',
    background: 'var(--hover, #F4F0E8)',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239CA3B8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: 32,
  };

  if (isMobile) {
    return (
      <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif" }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span onClick={() => navigate(PC_BASE)} className="material-symbols-rounded" style={{ fontSize: 22, color: '#453F39', cursor: 'pointer' }}>arrow_back</span>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: 0 }}>{/* was: Modifiers */}Product Options</h1>
          </div>
          <span onClick={() => navigate(pcPaths.modifiersCreate)} className="material-symbols-rounded" style={{ fontSize: 24, color: '#B89550', cursor: 'pointer' }}>add</span>
        </div>

        <div style={{ padding: '12px 16px 100px' }}>
          <ProductCatalogSyncBanner compact syncOnly />

          {/* Toolbar - stacked vertically */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search by product option or item..." /* was: "Search by modifier or item..." */ />
            <CatalogDropdown
              value={filter}
              onChange={(v) => setFilter(v as FilterType)}
              options={filterOptions}
              ariaLabel="Filter product options" /* was: "Filter modifiers" */
              triggerStyle={selectStyle}
            />
          </div>

          {/* Shimmer loading */}
          {loading ? (
            <ModifiersListShimmer isMobile />
          ) : filtered.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #E6DFD3', borderRadius: 2 }}>
              <CatalogListEmptyState
                icon="tune"
                name="modifiers"
                description={
                  search || filter !== 'all'
                    ? 'No product options match your filters. Try adjusting your search or filter.' /* was: 'No modifiers match your filters. Try adjusting your search or filter.' */
                    : 'Create your first product option to let shoppers choose size, metal or finish.' /* was: 'Create your first modifier set to get started with item customization.' */
                }
                action={!search && filter === 'all' ? <Button onClick={() => navigate(pcPaths.modifiersCreate)}>{/* was: Add Modifier */}Add Product Option</Button> : undefined}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map((mod) => {
                const oosCount = mod.options.filter((o) => !o.isAvailable).length;

                return (
                  <div
                    key={mod.id}
                    id={`catalog-modifier-row-${mod.id}`}
                    onClick={() => goToEditModifier(mod.id)}
                    style={{
                      background: '#fff',
                      borderRadius: 2,
                      border: '1px solid #E6DFD3',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      ...(String(highlightModifierId) === String(mod.id) ? HIGHLIGHT_INSET : {}),
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#453F39', minWidth: 0, wordBreak: 'break-word' }}>{mod.name.length > 128 ? mod.name.slice(0, 128) + '...' : mod.name}</span>
                      {mod.displayName && mod.displayName !== mod.name && (
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)', color: 'var(--t3, #9A9084)' }}>
                          {mod.displayName}
                        </span>
                      )}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', fontSize: 10.5, fontWeight: 600,
                        color: mod.type === 'options_list' ? '#B89550' : '#B07A2A',
                        background: mod.type === 'options_list' ? 'rgba(184,149,80,0.08)' : 'rgba(176,122,42,0.1)',
                        borderRadius: 100, padding: '2px 8px',
                      }}>
                        {mod.type === 'options_list' ? 'Options' : 'Text Field'}
                      </span>
                      {/* U2: Unused badge */}
                      {(mod.appliedItemCount ?? 0) === 0 && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', fontSize: 10.5, fontWeight: 600,
                          color: '#9A9084', background: '#F4F0E8', borderRadius: 100, padding: '2px 8px',
                        }}>
                          Unused
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#6E665D', marginBottom: 4 }}>
                      {mod.type === 'options_list' ? `${mod.options.length} option${mod.options.length !== 1 ? 's' : ''}` : 'Free text input'}
                      {' · '}Applied to {mod.appliedItemCount ?? 0} item{(mod.appliedItemCount ?? 0) !== 1 ? 's' : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {mod.type === 'options_list' && mod.options.slice(0, 3).map((opt) => (
                        <span key={opt.id} style={{ fontSize: 11, color: '#6E665D', background: '#FFFFFF', borderRadius: 100, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                          {opt.name}
                        </span>
                      ))}
                      {mod.type === 'options_list' && mod.options.length > 3 && (
                        <span style={{ fontSize: 11, color: '#9A9084', fontWeight: 500 }}>+{mod.options.length - 3} more</span>
                      )}
                      {hasOos(mod) && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#A63D2F', background: '#F6E9E5', borderRadius: 100, padding: '2px 8px' }}>
                          <span className="material-symbols-rounded" style={{ fontSize: 12 }}>error</span>
                          {oosCount} OOS
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FAB */}
        {!loading && modifiers.length > 0 && (
          <div
            onClick={() => navigate(pcPaths.modifiersCreate)}
            style={{
              position: 'fixed', bottom: 80, right: 16, width: 56, height: 56,
              background: '#B89550', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)', cursor: 'pointer', zIndex: 999,
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 28, color: '#fff' }}>add</span>
          </div>
        )}

        <DeleteConfirmationModal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDeleteModifier}
          confirmLoading={deleting}
          title={deleteTarget ? deleteConfirmTitle(deleteTarget.displayName || deleteTarget.name) : deleteConfirmTitle('this product option' /* was: 'this modifier' */)}
          description={
            deleteTarget ? (
              <>Applied to {deleteTarget.appliedItemCount ?? 0} item{(deleteTarget.appliedItemCount ?? 0) !== 1 ? 's' : ''}. This will remove it from all items.</>
            ) : null
          }
        />
        <BottomNav />
      </div>
    );
  }

  return (
    <DesktopLayout>
      <div style={{ padding: 25 }}>
        <PageHeader
          icon={
            <span className="material-symbols-rounded" style={{ fontSize: 24, color: 'rgba(255,255,255,0.95)' }}>
              tune
            </span>
          }
          title="Product Options" /* was: title="Modifiers" */
          subtitle="Manage choices like size, metal and finish" /* was: subtitle="Manage modifier sets for item customization" */
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <CatalogHelpLink topic="Product Options" /* was: topic="Modifiers" */ Tutorial={ModifiersTutorial} createPath={pcPaths.modifiersCreate} />
              <Button
                icon={
                  <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'rgba(255,255,255,0.95)' }}>
                    add
                  </span>
                }
                onClick={() => navigate(pcPaths.modifiersCreate)}
              >
                Add Modifier
              </Button>
            </div>
          }
        />

        <ProductCatalogSyncBanner syncOnly />

        {/* Toolbar: Search + Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 300 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search by product option or item..." /* was: "Search by modifier or item..." */ />
          </div>
          <div style={{ minWidth: 200, flexShrink: 0 }}>
            <CatalogDropdown
              value={filter}
              onChange={(v) => setFilter(v as FilterType)}
              options={filterOptions}
              ariaLabel="Filter product options" /* was: "Filter modifiers" */
              triggerStyle={selectStyle}
            />
          </div>
        </div>

        {/* Shimmer loading */}
        {loading ? (
          <ModifiersListShimmer isMobile={false} />
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #E6DFD3', borderRadius: 2 }}>
            <CatalogListEmptyState
              icon="tune"
              name="modifiers"
              description={
                search || filter !== 'all'
                  ? 'No product options match your filters. Try adjusting your search or filter.' /* was: 'No modifiers match your filters. Try adjusting your search or filter.' */
                  : 'Create your first product option to let shoppers choose size, metal or finish.' /* was: 'Create your first modifier set to get started with item customization.' */
              }
              action={
                !search && filter === 'all' ? (
                  <Button onClick={() => navigate(pcPaths.modifiersCreate)}>{/* was: Add Modifier */}Add Product Option</Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((mod) => {
              const isExpanded = expandedModifiers.has(mod.id);
              const isHovered = hoveredId === mod.id;
              const oosCount = mod.options.filter((o) => !o.isAvailable).length;

              return (
                <div
                  key={mod.id}
                  id={`catalog-modifier-row-${mod.id}`}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--card-border, #E6DFD3)',
                    borderRadius: 2,
                    overflow: 'hidden',
                    transition: 'box-shadow 0.15s ease',
                    boxShadow:
                      String(highlightModifierId) === String(mod.id)
                        ? 'inset 0 0 0 2px rgba(184,149,80,0.9)'
                        : isHovered
                          ? '0 4px 16px rgba(0,0,0,0.08)'
                          : 'none',
                  }}
                  onMouseEnter={() => setHoveredId(mod.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Card header */}
                  <div
                    onClick={() => toggleExpand(mod.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      cursor: 'pointer',
                      transition: 'background 0.12s ease',
                      background: isHovered ? '#FDFCF9' : 'transparent',
                    }}
                  >
                    {/* Chevron */}
                    <span
                      className="material-symbols-rounded"
                      style={{
                        fontSize: 18,
                        color: 'var(--t3, #9A9084)',
                        transition: 'transform 0.2s ease',
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        flexShrink: 0,
                      }}
                    >
                      chevron_right
                    </span>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Name row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span
                         
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: 'var(--t1, #453F39)',
                            fontFamily: 'var(--font-primary, Jost, sans-serif)',
                            minWidth: 0,
                            wordBreak: 'break-word',
                          }}
                        >
                          {mod.name.length > 128 ? mod.name.slice(0, 128) + '...' : mod.name}
                        </span>
                        {mod.name !== mod.displayName && (
                          <span
                            style={{
                              fontSize: 12,
                              fontFamily: 'var(--font-mono, monospace)',
                              color: 'var(--t3, #9A9084)',
                            }}
                          >
                            {mod.displayName}
                          </span>
                        )}
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: mod.type === 'options_list' ? 'var(--accent, #B89550)' : '#B07A2A',
                            background:
                              mod.type === 'options_list'
                                ? 'var(--accent-soft, rgba(184,149,80,0.08))'
                                : 'rgba(176,122,42,0.1)',
                            borderRadius: 'var(--radius-pill, 100px)',
                            padding: '2px 8px',
                          }}
                        >
                          {mod.type === 'options_list' ? 'Options' : 'Text Field'}
                        </span>
                        {/* U2: Unused badge — shown when applied to 0 items */}
                        {(mod.appliedItemCount ?? 0) === 0 && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              fontSize: 10.5,
                              fontWeight: 600,
                              color: 'var(--t3, #9A9084)',
                              background: 'var(--hover, #F4F0E8)',
                              borderRadius: 'var(--radius-pill, 100px)',
                              padding: '2px 8px',
                            }}
                          >
                            Unused
                          </span>
                        )}
                      </div>

                      {/* Option pills row */}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        {mod.type === 'text_field' ? (
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--t2, #6E665D)',
                              background: '#FFFFFF',
                              borderRadius: 100,
                              padding: '2px 8px',
                            }}
                          >
                            Free text input
                          </span>
                        ) : (
                          <>
                            {mod.options.slice(0, 4).map((opt) => (
                              <span
                                key={opt.id}
                                style={{
                                  fontSize: 11,
                                  color: '#6E665D',
                                  background: '#FFFFFF',
                                  borderRadius: 100,
                                  padding: '2px 8px',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {opt.name}
                              </span>
                            ))}
                            {mod.options.length > 4 && (
                              <span
                                style={{
                                  fontSize: 11,
                                  color: 'var(--t3, #9A9084)',
                                  fontWeight: 500,
                                }}
                              >
                                +{mod.options.length - 4} more
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Desktop stats */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        fontSize: 12,
                        color: 'var(--t2, #6E665D)',
                        fontFamily: 'var(--font-primary, Jost, sans-serif)',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {mod.type === 'options_list' && (
                        <span>{mod.options.length} option{mod.options.length !== 1 ? 's' : ''}</span>
                      )}
                      <span>Applied to {mod.appliedItemCount ?? 0} item{(mod.appliedItemCount ?? 0) !== 1 ? 's' : ''}</span>
                      {getSelectionLabel(mod) && <span>{getSelectionLabel(mod)}</span>}
                      {hasOos(mod) && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--red, #A63D2F)',
                            background: 'var(--red-soft, #F6E9E5)',
                            borderRadius: 'var(--radius-pill, 100px)',
                            padding: '2px 8px',
                          }}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: 12 }}>error</span>
                          {oosCount} out of stock
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div
                      style={{ display: 'flex', gap: 4, flexShrink: 0 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => goToEditModifier(mod.id)}
                        style={catalogListActionButtonStyle}
                        onMouseEnter={catalogListActionEnterDefault}
                        onMouseLeave={catalogListActionLeaveDefault}
                        title="Edit"
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(mod)}
                        style={catalogListActionButtonStyle}
                        onMouseEnter={catalogListActionEnterDefault}
                        onMouseLeave={catalogListActionLeaveDefault}
                        title="Clone"
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>content_copy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(mod)}
                        style={catalogListActionButtonStyle}
                        onMouseEnter={catalogListActionEnterDanger}
                        onMouseLeave={catalogListActionLeaveDanger}
                        title="Delete"
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded section */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--card-border, #E6DFD3)', padding: '12px 16px' }}>
                      {mod.type === 'options_list' ? (
                        <OptionsTable options={mod.options} />
                      ) : (
                        <TextFieldDetails mod={mod} />
                      )}
                      <AppliedItemsDropdown mod={mod} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DeleteConfirmationModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteModifier}
        confirmLoading={deleting}
        title={
          deleteTarget
            ? deleteConfirmTitle(deleteTarget.displayName || deleteTarget.name)
            : deleteConfirmTitle('this product option' /* was: 'this modifier' */)
        }
        description={
          deleteTarget ? (
            <>
              Applied to {deleteTarget.appliedItemCount ?? 0} item
              {(deleteTarget.appliedItemCount ?? 0) !== 1 ? 's' : ''}. This will remove it from all items.
            </>
          ) : null
        }
      />
    </DesktopLayout>
  );
}

/* ============ Options Table sub-component ============ */

function OptionsTable({ options }: { options: ModifierOption[] }) {
  const headerStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#9A9084',
    padding: '6px 8px',
    borderBottom: '1px solid var(--card-border, #E6DFD3)',
    whiteSpace: 'nowrap',
  };

  const cellStyle: React.CSSProperties = {
    padding: '8px 8px',
    fontSize: 13,
    color: 'var(--t1, #453F39)',
    borderBottom: '1px solid #F4F0E8',
    verticalAlign: 'middle',
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
        <thead>
          <tr>
            <th style={{ ...headerStyle, textAlign: 'left' }}>Name</th>
            <th style={{ ...headerStyle, textAlign: 'left' }}>Kitchen Name</th>
            <th style={{ ...headerStyle, textAlign: 'right' }}>Price</th>
            <th style={{ ...headerStyle, textAlign: 'center' }}>Default</th>
            <th style={{ ...headerStyle, textAlign: 'center' }}>Visible</th>
            <th style={{ ...headerStyle, textAlign: 'center' }}>Stock</th>
          </tr>
        </thead>
        <tbody>
          {options.map((opt) => (
            <tr key={opt.id}>
              <td style={{ ...cellStyle, fontWeight: 500 }}>{opt.name}</td>
              <td style={{ ...cellStyle }}>
                {opt.kitchenName && opt.kitchenName !== opt.name ? (
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12, color: 'var(--t3, #9A9084)' }}>
                    {opt.kitchenName}
                  </span>
                ) : (
                  <span style={{ color: '#D6CCBB' }}>&mdash;</span>
                )}
              </td>
              <td style={{ ...cellStyle, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>
                {opt.price != null && opt.price !== 0
                  ? (opt.price > 0
                      ? <span style={{ color: 'var(--t1, #453F39)' }}>{`+$${opt.price.toFixed(2)}`}</span>
                      : <span style={{ color: 'var(--red, #A63D2F)' }}>{`−$${Math.abs(opt.price).toFixed(2)}`}</span>)
                  : <span style={{ color: '#D6CCBB' }}>&mdash;</span>}
              </td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>
                {opt.isDefault ? (
                  <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#B07A2A' }}>star</span>
                ) : (
                  <span style={{ color: '#D6CCBB' }}>&mdash;</span>
                )}
              </td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>
                <span
                  className="material-symbols-rounded"
                  style={{
                    fontSize: 16,
                    color: opt.isOnline !== false ? 'var(--green, #5F7A55)' : 'var(--t3, #9A9084)',
                  }}
                >
                  {opt.isOnline !== false ? 'visibility' : 'visibility_off'}
                </span>
              </td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: opt.isAvailable ? 'var(--green, #5F7A55)' : 'var(--red, #A63D2F)',
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============ Text Field Details sub-component ============ */

function TextFieldDetails({ mod }: { mod: ModifierGroup }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          className="material-symbols-rounded"
          style={{ fontSize: 16, color: 'var(--t3, #9A9084)' }}
        >
          text_fields
        </span>
        <span style={{ fontSize: 13, color: 'var(--t2, #6E665D)' }}>
          Free text input &middot; {mod.isRequired ? 'Required' : 'Optional'}
        </span>
      </div>
      {mod.maxSelection > 0 && (
        <div style={{ fontSize: 12, color: 'var(--t3, #9A9084)' }}>
          Max characters: {mod.maxSelection}
        </div>
      )}
    </div>
  );
}

/* ============ Applied-items dropdown sub-component ============ */

function AppliedItemsDropdown({ mod }: { mod: ModifierGroup }) {
  const items = mod.assignedItems ?? [];
  const count = mod.appliedItemCount ?? items.length;
  const hasItems = items.length > 0;

  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          color: 'var(--t3, #9A9084)',
          fontFamily: 'var(--font-primary, Jost, sans-serif)',
        }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: 14 }}>link</span>
        Applied to {count} item{count !== 1 ? 's' : ''}
      </div>
      {hasItems && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 18 }}>
          {items.map((it) => (
            <span
              key={it.id}
              style={{
                fontSize: 12,
                color: 'var(--t2, #6E665D)',
                background: 'var(--hover, #FFFFFF)',
                border: '1px solid var(--card-border, #E6DFD3)',
                borderRadius: 100,
                padding: '3px 10px',
                whiteSpace: 'nowrap',
              }}
            >
              {it.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
