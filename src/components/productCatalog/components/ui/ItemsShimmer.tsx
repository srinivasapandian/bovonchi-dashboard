import React from 'react';

const shimmerKeyframes = `
@keyframes pc-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
`;

const shimmerBg: React.CSSProperties = {
  background: 'linear-gradient(90deg, #F4F0E8 25%, #ECE5D8 37%, #F4F0E8 63%)',
  backgroundSize: '800px 100%',
  animation: 'pc-shimmer 1.4s ease infinite',
  borderRadius: 2,
};

const ShimmerBlock: React.FC<{ width: number | string; height: number; borderRadius?: number; style?: React.CSSProperties }> = ({
  width, height, borderRadius, style,
}) => (
  <div style={{ ...shimmerBg, width, height, borderRadius: borderRadius ?? 6, ...style }} />
);

/** A single shimmer row mimicking an item row (checkbox + avatar + text + dots). */
const ShimmerItemRow: React.FC<{ isMobile?: boolean }> = ({ isMobile }) => (
  <div style={{ display: 'flex', alignItems: 'center', padding: isMobile ? '10px 12px' : '10px 16px', gap: isMobile ? 10 : 12, borderBottom: '1px solid #F4F0E8' }}>
    {!isMobile && <ShimmerBlock width={16} height={16} borderRadius={3} />}
    <ShimmerBlock width={isMobile ? 36 : 40} height={isMobile ? 36 : 40} borderRadius={isMobile ? 8 : 10} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <ShimmerBlock width="60%" height={14} />
      <ShimmerBlock width="30%" height={11} />
    </div>
    {!isMobile && <ShimmerBlock width={64} height={14} />}
    <ShimmerBlock width={20} height={20} borderRadius={10} />
  </div>
);

/** A single shimmer category card with a header + N item rows. */
const ShimmerCategoryCard: React.FC<{ rows?: number; isMobile?: boolean }> = ({ rows = 3, isMobile }) => (
  <div style={{
    background: '#fff',
    borderRadius: 2,
    border: '1px solid #E6DFD3',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
  }}>
    {/* Category header shimmer */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
      <ShimmerBlock width={20} height={20} borderRadius={4} />
      <ShimmerBlock width="35%" height={16} />
      <ShimmerBlock width={28} height={20} borderRadius={10} />
      <div style={{ flex: 1 }} />
    </div>
    {/* Item rows shimmer */}
    <div style={{ borderTop: '1px solid #ECE5D8' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <ShimmerItemRow key={i} isMobile={isMobile} />
      ))}
    </div>
  </div>
);

/** Full page shimmer skeleton for items list loading state. */
const ItemsShimmer: React.FC<{ isMobile?: boolean }> = ({ isMobile }) => (
  <>
    <style>{shimmerKeyframes}</style>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ShimmerCategoryCard rows={4} isMobile={isMobile} />
      <ShimmerCategoryCard rows={3} isMobile={isMobile} />
      <ShimmerCategoryCard rows={2} isMobile={isMobile} />
    </div>
  </>
);

export default ItemsShimmer;
