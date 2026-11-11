import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetMenusStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import PageHeader from '../../components/layout/PageHeader';
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
import type { SetMenu } from '../../data/types';
import SetMenuTutorial from '../../components/tutorials/set-menu-tutorial';
import CatalogHelpLink from '../../components/layout/CatalogHelpLink';

const statusColors: Record<string, string> = {
  active: '#5F7A55',
  draft: '#9A9084',
};

export default function SetMenusPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { setMenus, removeSetMenu, setEditingSetMenuId } = useSetMenusStore();
  const { addToast } = useToastStore();

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({ title: 'Set Menus', breadcrumbs: 'Product Catalog' });
  }, [setTopBarProps]);

  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SetMenu | null>(null);
  const [deletingSetMenu, setDeletingSetMenu] = useState(false);

  const filtered = search.trim()
    ? setMenus.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    : setMenus;

  const content = (
    <div style={{ padding: isMobile ? 16 : 25 }}>
      {!isMobile && (
        <PageHeader
          icon={<span className="material-symbols-rounded" style={{ fontSize: 24, color: 'rgba(255,255,255,0.95)' }}>menu_book</span>}
          title="Set Menus"
          subtitle="Course-based dining experiences with structured choices"
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              <CatalogHelpLink topic="Set Menus" Tutorial={SetMenuTutorial} createPath={pcPaths.setMenusCreate} />
              <Button
                icon={<span className="material-symbols-rounded" style={{ fontSize: 18, color: 'rgba(255,255,255,0.95)' }}>add</span>}
                onClick={() => navigate(pcPaths.setMenusCreate)}
              >
                Create Set Menu
              </Button>
            </div>
          }
        />
      )}

      {isMobile && (
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, margin: '-16px -16px 16px' }}>
          <span onClick={() => navigate(PC_BASE)} className="material-symbols-rounded" style={{ fontSize: 22, color: '#453F39', cursor: 'pointer' }}>arrow_back</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: 0 }}>Set Menus</h1>
        </div>
      )}

      <ProductCatalogSyncBanner compact={isMobile} syncOnly />

      <div style={{ marginBottom: 16, maxWidth: 360 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search set menus..." />
      </div>

      {filtered.length === 0 ? (
        <CatalogListEmptyState
          icon="restaurant"
          name="set menus"
          title="No set menus yet"
          description="Create your first set menu to offer course-based dining experiences."
          action={
            <Button onClick={() => navigate(pcPaths.setMenusCreate)}>
              Create Set Menu
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.map((menu) => (
            <div
              key={menu.id}
              style={{
                background: '#fff', borderRadius: 2, border: '1px solid #E6DFD3',
                padding: 20, cursor: 'pointer', transition: 'all 0.15s',
              }}
              onClick={() => { setEditingSetMenuId(menu.id); navigate(pcPaths.setMenuEdit); }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#B89550'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E6DFD3'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 2, background: 'rgba(184,149,80,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 22, color: '#B89550' }}>restaurant</span>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#453F39' }}>{menu.name}</div>
                  <div style={{ fontSize: 11, color: '#9A9084' }}>{menu.courseCount} courses</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#453F39' }}>${menu.price.toFixed(2)}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 2,
                  color: statusColors[menu.status] ?? '#9A9084',
                  background: `${statusColors[menu.status] ?? '#9A9084'}15`,
                  textTransform: 'capitalize',
                }}>
                  {menu.status}
                </span>
              </div>
              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #F4F0E8', paddingTop: 10 }}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setEditingSetMenuId(menu.id); navigate(pcPaths.setMenuEdit); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6E665D', fontFamily: 'var(--font-primary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F0E8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 15 }}>edit</span>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); navigate(pcPaths.setMenusCreate + '?clone=' + menu.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6E665D', fontFamily: 'var(--font-primary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F0E8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 15 }}>content_copy</span>
                  Clone
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(menu); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#A63D2F', fontFamily: 'var(--font-primary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F0D6CF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 15 }}>delete</span>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DeleteConfirmationModal
        open={!!deleteTarget}
        onClose={() => {
          if (deletingSetMenu) return;
          setDeleteTarget(null);
        }}
        confirmLoading={deletingSetMenu}
        onConfirm={() => {
          if (!deleteTarget || deletingSetMenu) return;
          setDeletingSetMenu(true);
          try {
            removeSetMenu(deleteTarget.id);
            setDeleteTarget(null);
            addToast('Set menu deleted', 'success');
          } finally {
            setDeletingSetMenu(false);
          }
        }}
        title={deleteTarget ? deleteConfirmTitle(deleteTarget.name) : ''}
        description="This will permanently delete this set menu."
      />
    </div>
  );

  if (isMobile) {
    return (
      <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif", paddingBottom: 80 }}>
        {content}
        {/* FAB */}
        <button
          onClick={() => navigate(pcPaths.setMenusCreate)}
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
