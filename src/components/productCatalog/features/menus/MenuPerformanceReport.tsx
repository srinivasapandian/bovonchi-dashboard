import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMenusStore } from '../../../../redux/productCatalog/productCatalogHooks';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { pcPaths } from '../../paths';
import BottomNav from '../../../BottomNav';

const ACCENT = '#B89550';

const mockMenuPerf = [
  { menuId: 'menu-1', menuName: 'Food Menu', orders: 412, revenue: 8240.00, avgOV: 20.00, revenueAtBase: 8240.00 },
  { menuId: 'menu-2', menuName: 'Drinks Menu', orders: 285, revenue: 3420.00, avgOV: 12.00, revenueAtBase: 3420.00 },
  { menuId: 'menu-hh', menuName: 'Happy Hour', orders: 198, revenue: 1980.00, avgOV: 10.00, revenueAtBase: 2970.00 },
  { menuId: 'menu-ln', menuName: 'Late Night', orders: 67, revenue: 938.00, avgOV: 14.00, revenueAtBase: 1005.00 },
];

const mockItemImpact = [
  { name: 'Margarita', regular: { units: 120, price: 8.00, revenue: 960 }, happyHour: { units: 85, price: 5.00, revenue: 425 } },
  { name: 'Mojito', regular: { units: 95, price: 9.00, revenue: 855 }, happyHour: { units: 72, price: 5.00, revenue: 360 } },
  { name: 'Craft Beer', regular: { units: 200, price: 6.50, revenue: 1300 }, happyHour: { units: 140, price: 4.00, revenue: 560 } },
];

export default function MenuPerformanceReport() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { menus } = useMenusStore();

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => { setTopBarProps({ title: 'Menu Performance', breadcrumbs: 'Product Catalog > Menus' }); }, [setTopBarProps]);

  const totalOrders = mockMenuPerf.reduce((s, m) => s + m.orders, 0);
  const totalRevenue = mockMenuPerf.reduce((s, m) => s + m.revenue, 0);
  const totalAtBase = mockMenuPerf.reduce((s, m) => s + m.revenueAtBase, 0);
  const effectiveDiscount = totalAtBase - totalRevenue;

  const kpi = (label: string, value: string, color: string) => (
    <div style={{ flex: 1, minWidth: 140, padding: 20, borderRadius: 2, background: '#fff', border: '1px solid #E6DFD3', textAlign: 'center' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#9A9084', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  );

  const content = (
    <div style={{ padding: isMobile ? 16 : 25 }}>
      {isMobile && (
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, margin: '-16px -16px 16px' }}>
          <span onClick={() => navigate(pcPaths.menus)} className="material-symbols-rounded" style={{ fontSize: 22, color: '#453F39', cursor: 'pointer' }}>arrow_back</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: 0 }}>Menu Performance</h1>
        </div>
      )}

      {!isMobile && (
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#453F39', margin: '0 0 4px' }}>Menu Performance</h1>
          <p style={{ fontSize: 13, color: '#6E665D', margin: 0 }}>Compare revenue across menus and evaluate pricing impact.</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {kpi('Total Orders', String(totalOrders), ACCENT)}
        {kpi('Total Revenue', `$${totalRevenue.toLocaleString()}`, '#5F7A55')}
        {kpi('Revenue at Base', `$${totalAtBase.toLocaleString()}`, '#7D8F69')}
        {kpi('Effective Discount', `$${effectiveDiscount.toLocaleString()}`, '#B07A2A')}
      </div>

      {/* Menu comparison table */}
      <div style={{ background: '#fff', borderRadius: 2, border: '1px solid #E6DFD3', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F4F0E8' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#453F39', margin: 0 }}>Menu Comparison</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-primary)' }}>
          <thead>
            <tr style={{ background: '#FDFCF9' }}>
              {['Menu', 'Orders', 'Revenue', 'Avg Order', 'vs Base Price', 'Delta'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9A9084', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockMenuPerf.map((m) => {
              const delta = m.revenue - m.revenueAtBase;
              const pct = m.revenueAtBase > 0 ? (delta / m.revenueAtBase * 100) : 0;
              return (
                <tr key={m.menuId} style={{ borderTop: '1px solid #F4F0E8' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#453F39' }}>{m.menuName}</td>
                  <td style={{ padding: '12px 16px', color: '#453F39' }}>{m.orders}</td>
                  <td style={{ padding: '12px 16px', color: '#5F7A55', fontWeight: 600 }}>${m.revenue.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', color: '#6E665D' }}>${m.avgOV.toFixed(2)}</td>
                  <td style={{ padding: '12px 16px', color: '#6E665D' }}>${m.revenueAtBase.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: delta === 0 ? '#6E665D' : delta < 0 ? '#A63D2F' : '#5F7A55' }}>
                    {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}$${delta.toLocaleString()} (${pct.toFixed(1)}%)`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Item-level impact */}
      <div style={{ background: '#fff', borderRadius: 2, border: '1px solid #E6DFD3', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F4F0E8' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#453F39', margin: 0 }}>Item-Level Price Impact</h2>
          <p style={{ fontSize: 11, color: '#9A9084', margin: '4px 0 0' }}>Per-menu breakdown for key items</p>
        </div>
        <div style={{ padding: 20 }}>
          {mockItemImpact.map((item) => (
            <div key={item.name} style={{ marginBottom: 16, padding: 14, borderRadius: 2, background: '#FDFCF9', border: '1px solid #F4F0E8' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#453F39', marginBottom: 8 }}>{item.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: 10, borderRadius: 2, background: '#fff', border: '1px solid #E6DFD3' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#9A9084', textTransform: 'uppercase', marginBottom: 4 }}>Regular</div>
                  <div style={{ fontSize: 12, color: '#453F39' }}>{item.regular.units} units × ${item.regular.price.toFixed(2)} = <strong>${item.regular.revenue.toLocaleString()}</strong></div>
                </div>
                <div style={{ padding: 10, borderRadius: 2, background: '#F7EFDF', border: '1px solid #E9D8B5' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#B07A2A', textTransform: 'uppercase', marginBottom: 4 }}>Happy Hour</div>
                  <div style={{ fontSize: 12, color: '#453F39' }}>{item.happyHour.units} units × ${item.happyHour.price.toFixed(2)} = <strong>${item.happyHour.revenue.toLocaleString()}</strong></div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#6E665D', marginTop: 6 }}>
                Total: {item.regular.units + item.happyHour.units} units, ${(item.regular.revenue + item.happyHour.revenue).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (isMobile) return <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif", paddingBottom: 80 }}>{content}<BottomNav /></div>;
  return <DesktopLayout>{content}</DesktopLayout>;
}
