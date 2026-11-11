import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useVariationSetsStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import { useErrorToast } from '../../hooks/useErrorToast';
import PageHeader from '../../components/layout/PageHeader';
import CatalogHelpLink from '../../components/layout/CatalogHelpLink';
import VariationSetsTutorial from '../../components/tutorials/option-sets-tutorial';
import SearchInput from '../../components/forms/SearchInput';
import { Button } from '../../components/ui/Button';
import { CatalogListEmptyState } from '../../components/ui/CatalogListEmptyState';
import { DeleteConfirmationModal, deleteConfirmTitle } from '../../components/ui/DeleteConfirmationModal';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { pcPaths, PC_BASE } from '../../paths';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import BottomNav from '../../../BottomNav';
import { ProductCatalogSyncBanner } from '../../components/ui/ProductCatalogSyncBanner';
import {
  catalogListActionButtonStyle,
  catalogListActionEnterDefault,
  catalogListActionLeaveDefault,
  catalogListActionEnterDanger,
  catalogListActionLeaveDanger,
  CATALOG_LIST_ACTION_ICON_PX,
} from '../../catalogEntityActions';
import type { VariationSet } from '../../data/types';
import { Bone } from '../../../../components/Shimmer';

const T1 = '#453F39';
const T3 = '#9A9084';
const ACCENT = 'var(--accent, #B89550)';
const ACCENT_TINT = 'rgba(184,149,80,0.08)';

function VariationSetsListShimmer({ isMobile }: { isMobile: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 12 }}>
      {Array.from({ length: isMobile ? 6 : 7 }).map((_, idx) => (
        <div key={idx} style={{ background: '#fff', borderRadius: isMobile ? 12 : 14, border: '1px solid #E6DFD3', padding: isMobile ? '14px 16px' : '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Bone w={40} h={40} r={10} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Bone w="35%" h={14} mb={6} />
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <Bone w={64} h={16} r={999} />
                <Bone w={56} h={16} r={999} />
                <Bone w={72} h={16} r={999} />
              </div>
              <Bone w="45%" h={10} />
            </div>
            {!isMobile ? <Bone w={60} h={24} r={6} /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function VariationSetsPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { variationSets, fetchVariationSets, clearVariationSetsCache, deleteVariationSetOnServer, error, setEditingVariationSetId, loading } = useVariationSetsStore();
  const { addToast } = useToastStore();
  const { auth } = useAuth();
  const { selectedBranch } = useBranch();

  useErrorToast(error, { fallbackMessage: 'Failed to load option sets' });

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({ title: 'Variations', breadcrumbs: 'Product Catalog' });
  }, [setTopBarProps]);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) return;
    void fetchVariationSets(locationId, token, { skipDuplicateMs: 750 });
  }, [selectedBranch?.id, selectedBranch?.locationId, auth?.accessToken, auth?.access_token, fetchVariationSets]);

  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<VariationSet | null>(null);
  const [deletingOptionSet, setDeletingOptionSet] = useState(false);

  // Mobile three-dot menu state
  const [mobileMenuVsId, setMobileMenuVsId] = useState<string | null>(null);
  const mobileMenuBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuVsId) return;
    const handler = (e: MouseEvent) => {
      const btn = mobileMenuBtnRefs.current[mobileMenuVsId];
      if (btn && btn.contains(e.target as Node)) return;
      if (mobileMenuRef.current && mobileMenuRef.current.contains(e.target as Node)) return;
      setMobileMenuVsId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileMenuVsId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return variationSets;
    const q = search.toLowerCase();
    return variationSets.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.displayName && o.displayName.toLowerCase().includes(q)) ||
        o.options.some((opt) => opt.name.toLowerCase().includes(q))
    );
  }, [variationSets, search]);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deletingOptionSet) return;
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) {
      addToast('Location is required to delete variation set.', 'error');
      return;
    }
    void (async () => {
      try {
        setDeletingOptionSet(true);
        await deleteVariationSetOnServer({ templateId: deleteTarget.id, locationId }, token);
        setDeleteTarget(null);
        clearVariationSetsCache();
        addToast('Variation set deleted', 'success');
        void fetchVariationSets(locationId, token, { force: true });
      } catch (e) {
        addToast(e instanceof Error ? e.message : 'Failed to delete variation set', 'error');
      } finally {
        setDeletingOptionSet(false);
      }
    })();
  };

  if (isMobile) return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif" }}>
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span onClick={() => navigate(PC_BASE)} className="material-symbols-rounded" style={{ fontSize: 22, color: '#453F39', cursor: 'pointer' }}>arrow_back</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: 0 }}>Variations</h1>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <ProductCatalogSyncBanner compact syncOnly />

        {/* Search bar */}
        <div style={{ marginBottom: 12 }}>
          <SearchInput
            value={search}
            onChange={(v) => setSearch(v)}
            placeholder="Search variations..."
          />
        </div>

        {loading ? (
          <VariationSetsListShimmer isMobile />
        ) : filtered.length === 0 ? (
          <CatalogListEmptyState
            icon="checklist"
            name="variation sets"
            description={search ? 'Try adjusting your search terms.' : 'Create your first variation set to get started.'}
            action={
              !search ? (
                <Button onClick={() => navigate(pcPaths.variationsCreate)}>Add Variation Set</Button>
              ) : undefined
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((vs) => {
              const nOpts = vs.options.length;
              const showParen = Boolean(vs.displayName?.trim()) && vs.displayName!.trim() !== vs.name.trim();
              return (
                <div
                  key={vs.id}
                  style={{
                    background: '#fff',
                    borderRadius: 2,
                    border: '1px solid #E6DFD3',
                    padding: '14px 16px',
                    marginBottom: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        background: ACCENT_TINT,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 22, color: ACCENT }}>layers</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                        <span title={vs.name} style={{ fontSize: 14, fontWeight: 600, color: T1 }}>{vs.name.length > 30 ? vs.name.slice(0, 30) + '...' : vs.name}</span>
                        {showParen && (
                          <span style={{ fontSize: 12, color: T3, fontWeight: 500 }}>({vs.displayName!.trim()})</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                        {vs.options.slice(0, 4).map((opt) => (
                          <span
                            key={opt.id}
                            style={{
                              fontSize: 10,
                              fontWeight: 500,
                              background: '#F4F0E8',
                              color: '#6E665D',
                              padding: '2px 8px',
                              borderRadius: 999,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {opt.name}
                          </span>
                        ))}
                        {vs.options.length > 4 && (
                          <span style={{ fontSize: 10, color: T3 }}>+{vs.options.length - 4} more</span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: T3, fontWeight: 500 }}>
                        {nOpts} option{nOpts !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <button
                      ref={(el) => { mobileMenuBtnRefs.current[vs.id] = el; }}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setMobileMenuVsId(mobileMenuVsId === vs.id ? null : vs.id); }}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 18, color: T3 }}>more_vert</span>
                    </button>
                    {/* Portal-based popup menu */}
                    {mobileMenuVsId === vs.id && mobileMenuBtnRefs.current[vs.id] && createPortal(
                      <div
                        ref={mobileMenuRef}
                        style={{
                          position: 'fixed',
                          top: mobileMenuBtnRefs.current[vs.id]!.getBoundingClientRect().bottom + 4,
                          right: window.innerWidth - mobileMenuBtnRefs.current[vs.id]!.getBoundingClientRect().right,
                          zIndex: 10050,
                          background: '#fff',
                          borderRadius: 2,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
                          border: '1px solid #E6DFD3',
                          minWidth: 150,
                          overflow: 'hidden',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => { setMobileMenuVsId(null); setEditingVariationSetId(vs.id); navigate(pcPaths.variationSetEdit); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                            border: 'none', background: 'transparent', cursor: 'pointer',
                            padding: '10px 14px', fontSize: 13, fontWeight: 500, color: 'var(--t1)',
                            fontFamily: 'var(--font-primary)',
                          }}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--t2)' }}>edit</span>
                          Edit
                        </button>
                        <div style={{ height: 1, background: '#F4F0E8' }} />
                        <button
                          type="button"
                          onClick={() => { setMobileMenuVsId(null); setDeleteTarget(vs); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                            border: 'none', background: 'transparent', cursor: 'pointer',
                            padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#A63D2F',
                            fontFamily: 'var(--font-primary)',
                          }}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: 18, color: '#A63D2F' }}>delete</span>
                          Delete
                        </button>
                      </div>,
                      document.body,
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <div
        onClick={() => navigate(pcPaths.variationsCreate)}
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
          boxShadow: '0 4px 12px rgba(184,149,80,0.35)',
          cursor: 'pointer',
          zIndex: 999,
        }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: 28, color: '#fff' }}>add</span>
      </div>

      {/* Delete confirmation modal */}
      <DeleteConfirmationModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        confirmLoading={deletingOptionSet}
        title={deleteTarget ? deleteConfirmTitle(deleteTarget.displayName || deleteTarget.name) : deleteConfirmTitle('this variation set')}
        description="Items that reference this variation set may need to be updated. This cannot be undone."
      />
      <BottomNav />
    </div>
  );

  return (
    <DesktopLayout>
      <div style={{ padding: 25 }}>
        <PageHeader
          icon={
            <span className="material-symbols-rounded" style={{ fontSize: 24, color: 'rgba(255,255,255,0.95)' }}>
              layers
            </span>
          }
          title="Variations"
          subtitle="Reusable variation templates for your items"
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <CatalogHelpLink
                topic="Variations"
                Tutorial={VariationSetsTutorial}
                onTutorialComplete={() => navigate(pcPaths.variationsCreate)}
              />
              <Button
                icon={
                  <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'rgba(255,255,255,0.95)' }}>
                    add
                  </span>
                }
                onClick={() => navigate(pcPaths.variationsCreate)}
              >
                Add Variation Set
              </Button>
            </div>
          }
        />

        <ProductCatalogSyncBanner syncOnly />

        {/* Search bar */}
        <div style={{ marginBottom: 16, maxWidth: 360 }}>
          <SearchInput
            value={search}
            onChange={(v) => setSearch(v)}
            placeholder="Search variations..."
          />
        </div>

        {loading ? (
          <VariationSetsListShimmer isMobile={false} />
        ) : filtered.length === 0 ? (
          <CatalogListEmptyState
            icon="checklist"
            name="variation sets"
            description={search ? 'Try adjusting your search terms.' : 'Create your first variation set to get started.'}
            action={
              !search ? (
                <Button onClick={() => navigate(pcPaths.variationsCreate)}>Add Variation Set</Button>
              ) : undefined
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((vs) => {
              const nOpts = vs.options.length;
              const showParen =
                Boolean(vs.displayName?.trim()) && vs.displayName!.trim() !== vs.name.trim();
              return (
              <div
                key={vs.id}
                style={{
                  background: 'var(--surface, #FFFFFF)',
                  border: '1px solid #E6DFD3',
                  borderRadius: 2,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
                }}
                onClick={() => { setEditingVariationSetId(vs.id); navigate(pcPaths.variationSetEdit); }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = 'var(--accent, #B89550)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)';
                  e.currentTarget.style.borderColor = '#E6DFD3';
                }}
              >
                {/* Icon (rounded square, layers) */}
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    background: ACCENT_TINT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 24, color: ACCENT }}>
                    layers
                  </span>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                    <span
                      title={vs.name}
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: T1,
                        fontFamily: 'var(--font-primary, "Jost", sans-serif)',
                      }}
                    >
                      {vs.name.length > 30 ? vs.name.slice(0, 30) + '...' : vs.name}
                    </span>
                    {showParen && (
                      <span style={{ fontSize: 12, color: T3, fontWeight: 500 }}>
                        ({vs.displayName!.trim()})
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                    {vs.options.map((opt) => (
                      <span
                        key={opt.id}
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          background: '#F4F0E8',
                          color: '#6E665D',
                          padding: '3px 9px',
                          borderRadius: 999,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {opt.name}
                        {opt.price != null && opt.price > 0 ? ` (+$${Number(opt.price).toFixed(2)})` : ''}
                      </span>
                    ))}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      fontSize: 10,
                      color: T3,
                      fontWeight: 500,
                    }}
                  >
                    <span>
                      {nOpts} option{nOpts !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => { setEditingVariationSetId(vs.id); navigate(pcPaths.variationSetEdit); }}
                    style={catalogListActionButtonStyle}
                    onMouseEnter={catalogListActionEnterDefault}
                    onMouseLeave={catalogListActionLeaveDefault}
                    title="Edit"
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(vs)}
                    style={catalogListActionButtonStyle}
                    onMouseEnter={catalogListActionEnterDanger}
                    onMouseLeave={catalogListActionLeaveDanger}
                    title="Delete"
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>delete</span>
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        )}

        {/* Delete confirmation modal */}
        <DeleteConfirmationModal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          confirmLoading={deletingOptionSet}
          title={deleteTarget ? deleteConfirmTitle(deleteTarget.displayName || deleteTarget.name) : deleteConfirmTitle('this variation set')}
          description="Items that reference this variation set may need to be updated. This cannot be undone."
        />
      </div>
    </DesktopLayout>
  );
}
