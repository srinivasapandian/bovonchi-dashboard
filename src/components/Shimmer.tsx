import React from 'react';
import { C } from './theme';

/* ── Shimmer CSS injection ─────────────────────────────── */
const shimmerKeyframes = `
@keyframes shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}`;
let injected = false;
const inject = () => {
    if (injected) return;
    injected = true;
    const s = document.createElement('style');
    s.textContent = shimmerKeyframes;
    document.head.appendChild(s);
};

/* ── Bone: single shimmer bar ──────────────────────────── */
export const Bone = ({ w, h = 14, r = 6, mb = 0, style: extra }: { w?: any; h?: number; r?: number; mb?: number; style?: React.CSSProperties }) => {
    inject();
    return (
        <div style={{
            width: w ?? '100%', height: h, borderRadius: r, marginBottom: mb,
            background: 'linear-gradient(90deg, #ECE5D8 25%, #F4F0E8 37%, #ECE5D8 63%)',
            backgroundSize: '800px 100%', animation: 'shimmer 1.4s ease infinite',
            ...extra,
        }} />
    );
};

/* ── Shared: Mini KPI row shimmer (3 cards with labels) ── */
export const MiniKpiShimmer = ({ labels }: { labels: string[] }) => (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {labels.map((l, i) => (
            <div key={i} style={{ flex: 1, background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '8px 6px', textAlign: 'center', boxShadow: C.shadow }}>
                <div style={{ fontSize: 7, color: C.t3, textTransform: 'uppercase' }}>{l}</div>
                <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center' }}><Bone w={55} h={18} /></div>
            </div>
        ))}
    </div>
);

/* ── Shared: Section card with title + shimmer rows ────── */
export const SectionShimmer = ({ title, rows = 4, showBar = false }: { title: string; rows?: number; showBar?: boolean }) => (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: C.shadow }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, marginBottom: 10 }}>{title}</div>
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: showBar ? 4 : 0 }}>
                    <Bone w={90} h={11} />
                    <Bone w={40} h={11} />
                </div>
                {showBar && (
                    <div style={{ height: 5, background: C.hover, borderRadius: 3, overflow: 'hidden' }}>
                        <Bone w={`${30 + ((i * 37 + 17) % 60)}%`} h={5} r={3} />
                    </div>
                )}
            </div>
        ))}
    </div>
);

/* ── Shared: Log card shimmer (card-style list items) ──── */
export const LogCardShimmer = ({ title, count = 3 }: { title?: string; count?: number }) => (
    <>
        {title && <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, marginBottom: 8 }}>{title}</div>}
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '12px 12px', marginBottom: 5, boxShadow: C.shadow }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Bone w={120} h={12} />
                    <Bone w={50} h={12} />
                </div>
                <Bone w={80} h={11} mb={4} />
                <Bone w={100} h={9} mb={4} />
                <Bone w={50} h={16} r={4} />
            </div>
        ))}
    </>
);

/* ── Shared: Chart area shimmer ────────────────────────── */
export const ChartShimmer = ({ title, barCount = 12 }: { title: string; barCount?: number }) => (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 14, padding: '14px 12px', marginBottom: 12, boxShadow: C.shadow }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, marginBottom: 10 }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
            {Array.from({ length: barCount }).map((_, i) => (
                <Bone key={i} w={null} h={15 + ((i * 37 + 17) % 75)} r={3} style={{ flex: 1 }} />
            ))}
        </div>
    </div>
);

/* ═══════════════════════════════════════════════════════════
   Page-specific shimmers (mobile drill screens)
   ═══════════════════════════════════════════════════════════ */

/* Orders Drill */
export const OrdersShimmer = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        <MiniKpiShimmer labels={['Total', 'Peak Hour', 'Avg/Hour']} />
        <ChartShimmer title="Hourly Orders" />
        <SectionShimmer title="By Channel" rows={4} />
    </div>
);

/* Net Sales Drill */
export const NetSalesShimmer = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        <MiniKpiShimmer labels={['Net Sales', 'Peak Hour', 'Avg/Hour']} />
        <ChartShimmer title="Hourly Revenue" />
        <SectionShimmer title="By Staff" rows={5} />
    </div>
);

/* Cancelled Drill */
export const CancelledShimmer = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        <SectionShimmer title="Cancel Reasons" rows={4} showBar />
        <LogCardShimmer title="Order Log" count={3} />
    </div>
);

/* Voids Drill */
export const VoidsShimmer = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        <SectionShimmer title="Void Reasons" rows={4} showBar />
        <LogCardShimmer title="Void Log" count={3} />
    </div>
);

/* Staff Drill */
export const StaffShimmer = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        <MiniKpiShimmer labels={['Staff', 'Total Sales', 'Total Hrs']} />
        {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '12px 12px', marginBottom: 5, boxShadow: C.shadow }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 20, height: 20, borderRadius: 6, background: C.hover }} />
                        <Bone w={100} h={13} />
                    </div>
                    <Bone w={60} h={12} />
                </div>
                <div style={{ display: 'flex', gap: 5, marginLeft: 28 }}>
                    <Bone w={40} h={16} r={4} />
                    <Bone w={30} h={16} r={4} />
                    <Bone w={35} h={16} r={4} />
                </div>
            </div>
        ))}
    </div>
);

/* Tips Drill */
export const TipsShimmer = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        <MiniKpiShimmer labels={['Total Tips', 'Avg/Order', 'Tip Rate']} />
        <SectionShimmer title="Tips by Channel" rows={4} />
    </div>
);
