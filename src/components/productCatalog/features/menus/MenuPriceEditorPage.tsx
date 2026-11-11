import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMenusStore, useItemsStore, useCategoriesStore, useMenuPricesStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import { pcPaths } from '../../paths';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { formPageOuterStyle, formPageMainScrollStyle, formStickyActionBarFooterStyle, formCancelButtonStyle, formSaveButtonStyle } from '../../formLayout';
import BottomNav from '../../../BottomNav';
import type { MenuItem } from '../../data/types';

const ACCENT = '#B89550';
const inputStyle: React.CSSProperties = { fontSize: 12, padding: '6px 8px', border: '1px solid #E6DFD3', borderRadius: 2, outline: 'none', width: 80, textAlign: 'right' as const, fontFamily: 'var(--font-primary)' };

export default function MenuPriceEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { menus } = useMenusStore();
  const { items } = useItemsStore();
  const { categories } = useCategoriesStore();
  const { getForMenu, setMenuPrice, removeAllForMenu } = useMenuPricesStore();
  const { addToast } = useToastStore();

  const menu = menus.find((m) => m.id === id);
  const setTopBarProps = useDesktopTopBar();
  useEffect(() => { setTopBarProps({ title: `Price Editor: ${menu?.name ?? ''}`, breadcrumbs: 'Product Catalog > Menus' }); }, [setTopBarProps, menu?.name]);

  // Items in this menu (via categories or individual assignment)
  const menuItems = useMemo(() => {
    if (!menu) return [];
    return items.filter((it) =>
      it.categoryIds.some((cid) => menu.categoryIds.includes(cid)) ||
      (menu.individualItemIds ?? []).includes(it.id)
    );
  }, [menu, items]);

  const existingPrices = useMemo(() => id ? getForMenu(id) : [], [id, getForMenu]);

  // Local editable state
  const [edits, setEdits] = useState<Record<string, number | ''>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMode, setBulkMode] = useState<'percentage' | 'flat' | 'fixed'>('percentage');
  const [bulkValue, setBulkValue] = useState<number | ''>(30);
  const [bulkRounding, setBulkRounding] = useState('none');
  const [catFilter, setCatFilter] = useState('');

  // Initialize edits from existing prices
  useEffect(() => {
    const initial: Record<string, number | ''> = {};
    existingPrices.forEach((p) => { initial[p.itemId] = p.overridePrice; });
    setEdits(initial);
  }, [existingPrices]);

  const filteredItems = useMemo(() => {
    let list = menuItems;
    if (catFilter) list = list.filter((it) => it.categoryIds.includes(catFilter));
    return list;
  }, [menuItems, catFilter]);

  const handleSaveAll = () => {
    if (!id) return;
    Object.entries(edits).forEach(([itemId, price]) => {
      if (price !== '' && price !== undefined) {
        setMenuPrice({ menuId: id, itemId, overridePrice: Number(price) });
      }
    });
    addToast(`Prices updated for ${Object.keys(edits).length} items in '${menu?.name}'`, 'success');
    navigate(pcPaths.menus);
  };

  const handleBulkApply = () => {
    const basePrices: Record<string, number> = {};
    selected.forEach((itemId) => {
      const item = items.find((i) => i.id === itemId);
      if (item) basePrices[itemId] = item.basePrice;
    });
    const newEdits = { ...edits };
    selected.forEach((itemId) => {
      const base = basePrices[itemId] ?? 0;
      let newPrice: number;
      if (bulkMode === 'percentage') newPrice = base * (1 - (Number(bulkValue) || 0) / 100);
      else if (bulkMode === 'flat') newPrice = base - (Number(bulkValue) || 0);
      else newPrice = Number(bulkValue) || 0;
      newEdits[itemId] = Math.max(0, Math.round(newPrice * 100) / 100);
    });
    setEdits(newEdits);
    setShowBulkModal(false);
    addToast(`Adjusted ${selected.size} items`, 'success');
  };

  const handleResetAll = () => {
    if (!id) return;
    if (!window.confirm('Remove all menu-specific prices? Items will use their base price.')) return;
    removeAllForMenu(id);
    setEdits({});
    addToast('All prices reset to base', 'success');
  };

  const toggleAll = () => {
    if (selected.size === filteredItems.length) setSelected(new Set());
    else setSelected(new Set(filteredItems.map((it) => it.id)));
  };

  if (!menu) return <DesktopLayout><div style={{ padding: 40, textAlign: 'center', color: '#9A9084' }}>Menu not found</div></DesktopLayout>;

  const menuCats = categories.filter((c) => menu.categoryIds.includes(c.id));

  const content = (
    <div style={isMobile ? { ...formPageOuterStyle, height: 'auto' } : formPageOuterStyle}>
      <div style={formPageMainScrollStyle}>
        <div style={{ padding: isMobile ? 16 : 25 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#453F39', margin: '0 0 4px' }}>Price Editor: {menu.name}</h1>
              <p style={{ fontSize: 12, color: '#6E665D', margin: 0 }}>{menuItems.length} items in this menu</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {selected.size > 0 && (
                <button type="button" onClick={() => setShowBulkModal(true)}
                  style={{ padding: '7px 14px', borderRadius: 2, border: `1.5px solid ${ACCENT}`, background: `${ACCENT}08`, color: ACCENT, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
                  Adjust Selected ({selected.size})
                </button>
              )}
              <button type="button" onClick={handleResetAll}
                style={{ padding: '7px 14px', borderRadius: 2, border: '1px solid #E6DFD3', background: '#fff', color: '#6E665D', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
                Reset All to Base
              </button>
            </div>
          </div>

          {/* Category filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setCatFilter('')}
              style={{ padding: '4px 10px', borderRadius: 2, fontSize: 11, fontWeight: 600, border: !catFilter ? `1.5px solid ${ACCENT}` : '1px solid #E6DFD3', background: !catFilter ? `${ACCENT}08` : '#fff', color: !catFilter ? ACCENT : '#6E665D', cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>All</button>
            {menuCats.map((c) => (
              <button key={c.id} type="button" onClick={() => setCatFilter(c.id)}
                style={{ padding: '4px 10px', borderRadius: 2, fontSize: 11, fontWeight: 600, border: catFilter === c.id ? `1.5px solid ${ACCENT}` : '1px solid #E6DFD3', background: catFilter === c.id ? `${ACCENT}08` : '#fff', color: catFilter === c.id ? ACCENT : '#6E665D', cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>{c.name}</button>
            ))}
          </div>

          {/* Table */}
          <div style={{ background: '#fff', borderRadius: 2, border: '1px solid #E6DFD3', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-primary)' }}>
              <thead>
                <tr style={{ background: '#FDFCF9' }}>
                  <th style={{ padding: '10px 12px', width: 30 }}>
                    <input type="checkbox" checked={selected.size === filteredItems.length && filteredItems.length > 0} onChange={toggleAll} style={{ accentColor: ACCENT }} />
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9A9084', textTransform: 'uppercase' }}>Item</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#9A9084', textTransform: 'uppercase', width: 90 }}>Base Price</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#9A9084', textTransform: 'uppercase', width: 110 }}>Menu Price</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#9A9084', textTransform: 'uppercase', width: 70 }}>Diff</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#9A9084', textTransform: 'uppercase', width: 60 }}>%</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const menuPrice = edits[item.id] ?? '';
                  const mp = menuPrice !== '' ? Number(menuPrice) : item.basePrice;
                  const diff = mp - item.basePrice;
                  const pct = item.basePrice > 0 ? (diff / item.basePrice * 100) : 0;
                  const hasEdit = edits[item.id] !== undefined && edits[item.id] !== '';
                  return (
                    <tr key={item.id} style={{ borderTop: '1px solid #F4F0E8' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <input type="checkbox" checked={selected.has(item.id)} onChange={() => {
                          const next = new Set(selected);
                          next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                          setSelected(next);
                        }} style={{ accentColor: ACCENT }} />
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#453F39' }}>{item.name}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6E665D' }}>${item.basePrice.toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <input
                          type="number" min={0} step={1}
                          value={menuPrice}
                          onChange={(e) => setEdits({ ...edits, [item.id]: e.target.value === '' ? '' : Number(e.target.value) })}
                          placeholder={item.basePrice.toFixed(2)}
                          style={{ ...inputStyle, borderColor: hasEdit ? '#7D8F69' : '#E6DFD3' }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: diff === 0 ? '#6E665D' : diff < 0 ? '#A63D2F' : '#5F7A55', fontWeight: 600 }}>
                        {hasEdit ? `${diff >= 0 ? '+' : ''}$${diff.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: pct === 0 ? '#6E665D' : pct < 0 ? '#A63D2F' : '#5F7A55', fontWeight: 600 }}>
                        {hasEdit ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={isMobile ? { ...formStickyActionBarFooterStyle, position: 'fixed' as const, bottom: 0, left: 0, right: 0, zIndex: 100, padding: 16 } : formStickyActionBarFooterStyle}>
        <button type="button" style={formCancelButtonStyle} onClick={() => navigate(pcPaths.menus)}>Cancel</button>
        <button type="button" style={formSaveButtonStyle} onClick={handleSaveAll}>Save All Prices</button>
      </div>

      {/* Bulk Adjustment Modal */}
      {showBulkModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
          <div style={{ background: '#fff', borderRadius: 2, padding: 28, width: 400, maxWidth: '90vw' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#453F39', margin: '0 0 16px' }}>Adjust {selected.size} Items</h3>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {(['percentage', 'flat', 'fixed'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setBulkMode(m)}
                  style={{ padding: '6px 12px', borderRadius: 2, fontSize: 12, fontWeight: 600, border: bulkMode === m ? `1.5px solid ${ACCENT}` : '1px solid #E6DFD3', background: bulkMode === m ? `${ACCENT}08` : '#fff', color: bulkMode === m ? ACCENT : '#6E665D', cursor: 'pointer', fontFamily: 'var(--font-primary)', textTransform: 'capitalize' }}>
                  {m === 'percentage' ? '% Off' : m === 'flat' ? 'Flat Off' : 'Fixed Price'}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#6E665D', display: 'block', marginBottom: 6 }}>
                {bulkMode === 'percentage' ? 'Percentage off (%)' : bulkMode === 'flat' ? 'Amount off ($)' : 'Fixed price ($)'}
              </label>
              <input type="number" min={0} value={bulkValue} onChange={(e) => setBulkValue(e.target.value === '' ? '' : Number(e.target.value))}
                style={{ fontSize: 14, padding: '10px 12px', border: '1px solid #E6DFD3', borderRadius: 2, width: '100%', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setShowBulkModal(false)} style={{ padding: '8px 16px', borderRadius: 2, border: 'none', background: '#F4F0E8', color: '#6E665D', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleBulkApply} style={{ padding: '8px 16px', borderRadius: 2, border: 'none', background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) return <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif", paddingBottom: 80 }}>{content}</div>;
  return <DesktopLayout>{content}</DesktopLayout>;
}
