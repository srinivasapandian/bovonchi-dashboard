import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCombosStore, useItemsStore } from '../../../../redux/productCatalog/productCatalogHooks';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { pcPaths } from '../../paths';
import BottomNav from '../../../BottomNav';

/* Mock performance data */
const mockPerformance = [
  { comboId: 'combo-1', unitsSold: 342, revenue: 3849.58, avgPrice: 11.25 },
  { comboId: 'combo-2', unitsSold: 198, revenue: 2968.02, avgPrice: 14.99 },
];

const mockSlotBreakdown: Record<string, { itemName: string; pct: number }[]> = {
  'combo-1': [
    { itemName: 'Classic Cheeseburger', pct: 45 },
    { itemName: 'Chicken Burger', pct: 35 },
    { itemName: 'Veggie Burger', pct: 20 },
  ],
  'combo-2': [
    { itemName: 'Bruschetta', pct: 50 },
    { itemName: 'Garlic Bread', pct: 30 },
    { itemName: 'Calamari Fritti', pct: 20 },
  ],
};

const ACCENT = '#B89550';

export default function ComboReportPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { combos } = useCombosStore();
  const { items } = useItemsStore();

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({ title: 'Combo Performance', breadcrumbs: 'Product Catalog > Combos' });
  }, [setTopBarProps]);

  const totalUnits = mockPerformance.reduce((s, p) => s + p.unitsSold, 0);
  const totalRevenue = mockPerformance.reduce((s, p) => s + p.revenue, 0);
  const avgValue = totalUnits > 0 ? totalRevenue / totalUnits : 0;

  const kpiCard = (label: string, value: string, color: string) => (
    <div style={{
      flex: 1, minWidth: 140, padding: 20, borderRadius: 2, background: '#fff',
      border: '1px solid #E6DFD3', textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#9A9084', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  );

  const content = (
    <div style={{ padding: isMobile ? 16 : 25 }}>
      {isMobile && (
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, margin: '-16px -16px 16px' }}>
          <span onClick={() => navigate(pcPaths.combos)} className="material-symbols-rounded" style={{ fontSize: 22, color: '#453F39', cursor: 'pointer' }}>arrow_back</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: 0 }}>Combo Performance</h1>
        </div>
      )}

      {!isMobile && (
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#453F39', margin: '0 0 4px' }}>Combo Performance</h1>
          <p style={{ fontSize: 13, color: '#6E665D', margin: 0 }}>Track combo sales, revenue, and popular slot selections.</p>
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {kpiCard('Total Sold', String(totalUnits), ACCENT)}
        {kpiCard('Total Revenue', `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, '#5F7A55')}
        {kpiCard('Avg Combo Value', `$${avgValue.toFixed(2)}`, '#7D8F69')}
        {kpiCard('Active Combos', String(combos.filter((c) => c.status === 'active').length), '#B07A2A')}
      </div>

      {/* Top combos table */}
      <div style={{ background: '#fff', borderRadius: 2, border: '1px solid #E6DFD3', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F4F0E8' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#453F39', margin: 0 }}>Top Combos by Units Sold</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-primary)' }}>
          <thead>
            <tr style={{ background: '#FDFCF9' }}>
              {['Combo', 'Units Sold', 'Revenue', 'Avg Price', 'Pricing'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9A9084', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockPerformance.map((p) => {
              const combo = combos.find((c) => c.id === p.comboId);
              if (!combo) return null;
              return (
                <tr key={p.comboId} style={{ borderTop: '1px solid #F4F0E8' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#453F39' }}>{combo.name}</td>
                  <td style={{ padding: '12px 16px', color: '#453F39' }}>{p.unitsSold}</td>
                  <td style={{ padding: '12px 16px', color: '#5F7A55', fontWeight: 600 }}>${p.revenue.toFixed(2)}</td>
                  <td style={{ padding: '12px 16px', color: '#6E665D' }}>${p.avgPrice.toFixed(2)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: `${ACCENT}10`, color: ACCENT, textTransform: 'capitalize' }}>{combo.pricingModel}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Slot breakdown */}
      <div style={{ background: '#fff', borderRadius: 2, border: '1px solid #E6DFD3', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F4F0E8' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#453F39', margin: 0 }}>Most Popular Slot Selections</h2>
        </div>
        <div style={{ padding: 20 }}>
          {Object.entries(mockSlotBreakdown).map(([comboId, breakdown]) => {
            const combo = combos.find((c) => c.id === comboId);
            if (!combo) return null;
            return (
              <div key={comboId} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#453F39', marginBottom: 8 }}>{combo.name} — Slot 1</div>
                {breakdown.map((b) => (
                  <div key={b.itemName} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#6E665D', width: 140, flexShrink: 0 }}>{b.itemName}</span>
                    <div style={{ flex: 1, height: 16, background: '#F4F0E8', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${b.pct}%`, height: '100%', background: ACCENT, borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#453F39', width: 36, textAlign: 'right' }}>{b.pct}%</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (isMobile) return <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif", paddingBottom: 80 }}>{content}<BottomNav /></div>;
  return <DesktopLayout>{content}</DesktopLayout>;
}
