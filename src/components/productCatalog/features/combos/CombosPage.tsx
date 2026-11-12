import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCombosStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import PageHeader from '../../components/layout/PageHeader';
import SearchInput from '../../components/forms/SearchInput';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { CatalogListEmptyState } from '../../components/ui/CatalogListEmptyState';
import { DeleteConfirmationModal, deleteConfirmTitle } from '../../components/ui/DeleteConfirmationModal';
import CatalogHelpLink from '../../components/layout/CatalogHelpLink';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { pcPaths, PC_BASE } from '../../paths';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import BottomNav from '../../../BottomNav';
import { ProductCatalogSyncBanner } from '../../components/ui/ProductCatalogSyncBanner';
import type { Combo, ItemStatus } from '../../data/types';
import ComboTutorial from '../../components/tutorials/combo-tutorial';
import type { CatalogTutorialComponentProps } from '../../components/layout/CatalogHelpLink';
import { Bone } from '../../../../components/Shimmer';

const statusColors: Record<string, string> = {
  active: '#5F7A55', draft: '#9A9084', archived: '#B07A2A',
};
const statusBg: Record<string, string> = {
  active: '#16A34A15', draft: '#9CA3B815', archived: '#D9770615',
};

function CombosListShimmer({ isMobile }: { isMobile: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} style={{ background: '#fff', borderRadius: 2, border: '1px solid #E6DFD3', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <Bone w={44} h={44} r={12} />
            <div style={{ flex: 1 }}>
              <Bone w="55%" h={14} mb={6} />
              <Bone w="40%" h={10} />
            </div>
          </div>
          <Bone w="85%" h={10} mb={10} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <Bone w={72} h={16} />
            <Bone w={54} h={16} r={8} />
            <Bone w={64} h={16} r={8} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Bone w={54} h={24} r={6} />
            <Bone w={54} h={24} r={6} />
            <Bone w={54} h={24} r={6} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CombosPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { auth } = useAuth();
  const { selectedBranch } = useBranch();
  const { combos, loading, error, fetchCombos, clearCombosCache, deleteComboOnServer, setEditingComboId,updateCombo } = useCombosStore();
  const { addToast } = useToastStore();

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({ title: 'Combos', breadcrumbs: 'Product Catalog' });
  }, [setTopBarProps]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ItemStatus | ''>('');
  const [deleteTarget, setDeleteTarget] = useState<Combo | null>(null);
  const [deletingCombo, setDeletingCombo] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    if (!locationId) return;
    const token = auth?.accessToken ?? auth?.access_token ?? '';
    void fetchCombos(locationId, token, { skipDuplicateMs: 750 });
  }, [
    selectedBranch?.id,
    selectedBranch?.locationId,
    auth?.accessToken,
    auth?.access_token,
    fetchCombos,
  ]);

  const filtered = useMemo(() => {
    let list = combos;
    if (statusFilter) list = list.filter((c) => c.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.comboCode.toLowerCase().includes(q));
    }
    return list;
  }, [combos, statusFilter, search]);

  const getSlotSummary = (combo: Combo) =>
    combo.slots.map((s) => s.slotName).join(' + ');

  const getSavings = () => 0;

  const content = (
    <div style={{ padding: isMobile ? 16 : 25 }}>
      {!isMobile && (
        <PageHeader
          icon={<span className="material-symbols-rounded" style={{ fontSize: 24, color: 'rgba(255,255,255,0.95)' }}>fastfood</span>}
          title="Combos"
          subtitle="Bundle products at a discounted price to boost average order value" /* was: subtitle="Bundle items at a discounted price to boost average order value" */
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              <CatalogHelpLink topic="Combos" Tutorial={ComboTutorial} createPath={pcPaths.combosCreate} />
              <Button
                icon={<span className="material-symbols-rounded" style={{ fontSize: 18, color: 'rgba(255,255,255,0.95)' }}>add</span>}
                onClick={() => navigate(pcPaths.combosCreate)}
              >
                Create Combo
              </Button>
            </div>
          }
        />
      )}

      {isMobile && (
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, margin: '-16px -16px 16px' }}>
          <span onClick={() => navigate(PC_BASE)} className="material-symbols-rounded" style={{ fontSize: 22, color: '#453F39', cursor: 'pointer' }}>arrow_back</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: 0 }}>Combos</h1>
        </div>
      )}

      <ProductCatalogSyncBanner compact={isMobile} syncOnly />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ maxWidth: 320, flex: 1 }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search combos..." />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['', 'active', 'draft', 'archived'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s as any)}
              style={{
                padding: '5px 12px', borderRadius: 2, fontSize: 11, fontWeight: 600,
                border: statusFilter === s ? '1.5px solid #B89550' : '1px solid #E6DFD3',
                background: statusFilter === s ? '#D23A3B08' : '#fff',
                color: statusFilter === s ? '#B89550' : '#6E665D',
                cursor: 'pointer', fontFamily: 'var(--font-primary)', textTransform: 'capitalize',
              }}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <CombosListShimmer isMobile={isMobile} />
      ) : error ? (
        <EmptyState
          title="Failed to load combos"
          description={error}
          action={<Button onClick={() => {
            const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
            const token = auth?.accessToken ?? auth?.access_token ?? '';
            if (!locationId) return;
            void fetchCombos(locationId, token, { force: true });
          }}>Retry</Button>}
        />
      ) : filtered.length === 0 ? (
        <CatalogListEmptyState
          icon="fastfood"
          name="combos"
          title={combos.length === 0 ? 'No combos yet' : 'No combos match your filters'}
          description={combos.length === 0 ? 'Create your first combo meal to boost average order value.' : 'Try adjusting your search or filters.'}
          action={
            combos.length === 0 ? (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <Button variant="secondary" onClick={() => setTutorialOpen(true)}>Learn How Combos Work</Button>
                <Button onClick={() => navigate(pcPaths.combosCreate)}>Create Combo</Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {filtered.map((combo) => {
            const savings = getSavings();
            return (
              <div
                key={combo.id}
                style={{
                  background: '#fff', borderRadius: 2, border: '1px solid #E6DFD3',
                  padding: 20, cursor: 'pointer', transition: 'all 0.15s',
                }}
                onClick={() => { setEditingComboId(combo.id); navigate(pcPaths.comboEdit); }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#B89550'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E6DFD3'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 2, background: 'rgba(184,149,80,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 22, color: '#B89550' }}>fastfood</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div title={combo.name} style={{ fontSize: 14, fontWeight: 600, color: '#453F39', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{combo.name.length > 30 ? combo.name.slice(0, 30) + '...' : combo.name}</div>
                    <div style={{ fontSize: 11, color: '#9A9084' }}>{combo.slots.length} components &middot; {combo.comboCode}</div>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: '#6E665D', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getSlotSummary(combo)}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#453F39' }}>${combo.basePrice.toFixed(2)}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#D23A3B10', color: '#B89550' }}>
                    {combo.pricingModel === 'fixed' ? 'Fixed' : 'Dynamic'}
                  </span>
                  {savings > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#16A34A15', color: '#5F7A55' }}>
                      Save ${savings.toFixed(2)}
                    </span>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, marginLeft: 'auto',
                    color: statusColors[combo.status] ?? '#9A9084',
                    background: statusBg[combo.status] ?? '#9CA3B815',
                    textTransform: 'capitalize',
                  }}>
                    {combo.status}
                  </span>
                </div>

                {/* PCF-17: Order type quick toggle pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {(['dine_in', 'takeout', 'delivery'] as const).map((ot) => {
                    const labels: Record<string, string> = { dine_in: 'Dine-in', takeout: 'Online', delivery: 'Delivery' };
                    const vis = combo.orderTypeVisibility ?? {};
                    const isOn = vis[ot] !== false;
                    return (
                      <button
                        key={ot}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = { ...vis, [ot]: !isOn };
                          updateCombo(combo.id, { orderTypeVisibility: next });
                          addToast(`${labels[ot]} ${!isOn ? 'enabled' : 'disabled'} for '${combo.name}'`, 'success');
                        }}
                        style={{
                          fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                          border: isOn ? '1px solid #16A34A30' : '1px solid #DC262630',
                          background: isOn ? '#16A34A10' : '#DC262608',
                          color: isOn ? '#5F7A55' : '#A63D2F',
                          cursor: 'pointer', fontFamily: 'var(--font-primary)',
                          textDecoration: isOn ? 'none' : 'line-through',
                          opacity: isOn ? 1 : 0.6,
                        }}
                      >
                        {labels[ot]}
                      </button>
                    );
                  })}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #F4F0E8', paddingTop: 10 }}>
                  {[
                    { icon: 'edit', label: 'Edit', color: '#6E665D', hoverBg: '#F4F0E8', action: () => { setEditingComboId(combo.id); navigate(pcPaths.comboEdit); } },
                    { icon: 'content_copy', label: 'Clone', color: '#6E665D', hoverBg: '#F4F0E8', action: () => navigate(pcPaths.combosCreate + '?clone=' + combo.id) },
                    { icon: 'delete', label: 'Delete', color: '#A63D2F', hoverBg: '#F0D6CF', action: () => setDeleteTarget(combo) },
                  ].map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); a.action(); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: a.color, fontFamily: 'var(--font-primary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = a.hoverBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 15 }}>{a.icon}</span>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DeleteConfirmationModal
        open={!!deleteTarget}
        onClose={() => {
          if (deletingCombo) return;
          setDeleteTarget(null);
        }}
        confirmLoading={deletingCombo}
        onConfirm={async () => {
          if (deleteTarget) {
            if (deletingCombo) return;
            try {
              setDeletingCombo(true);
              const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
              const token = auth?.accessToken ?? auth?.access_token ?? '';
              if (!locationId) {
                addToast('Select a branch before deleting combo', 'error');
                setDeletingCombo(false);
                return;
              }
              await deleteComboOnServer({ comboId: deleteTarget.id, locationId }, token);
              setDeleteTarget(null);
              clearCombosCache();
              addToast(`'${deleteTarget.name}' deleted`, 'success');
              void fetchCombos(locationId, token, { force: true });
            } catch (e) {
              addToast(e instanceof Error ? e.message : 'Failed to delete combo', 'error');
            } finally {
              setDeletingCombo(false);
            }
          }
        }}
        title={deleteTarget ? deleteConfirmTitle(deleteTarget.name) : ''}
        description="This combo will be removed from all menus and channels. Products inside the combo are NOT affected. Past order data is preserved." /* was: description="This combo will be removed from all menus and channels. Items inside the combo are NOT affected. Past order data is preserved." */
      />

      <ComboTutorial open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </div>
  );

  if (isMobile) {
    return (
      <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif", paddingBottom: 80 }}>
        {content}
        {/* FAB */}
        <button
          onClick={() => navigate(pcPaths.combosCreate)}
          style={{
            position: 'fixed', bottom: 80, right: 16, width: 56, height: 56,
            background: '#B89550', color: '#fff', border: 'none', borderRadius: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(184,149,80,0.35)', zIndex: 999, cursor: 'pointer',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 28 }}>add</span>
        </button>
        <BottomNav />
      </div>
    );
  }

  return <DesktopLayout>{content}</DesktopLayout>;
}
