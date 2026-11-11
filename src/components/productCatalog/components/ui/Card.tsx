import { type ReactNode, type CSSProperties } from 'react';

interface CardProps {
  children: ReactNode;
  drillable?: boolean;
  padding?: number;
  onClick?: () => void;
  style?: CSSProperties;
}

export function Card({ children, drillable = false, padding = 22, onClick, style }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--card)',
        border: `1px solid ${drillable ? 'rgba(184,149,80,0.2)' : 'var(--card-border)'}`,
        borderRadius: 'var(--radius-card)',
        padding,
        boxShadow: 'var(--card-shadow)',
        position: 'relative',
        cursor: onClick ? 'pointer' : undefined,
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        ...style,
      }}
    >
      {drillable && (
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ position: 'absolute', top: 12, right: 12, opacity: 0.45 }}>
          <path d="M3.5 2L7 5L3.5 8" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {children}
    </div>
  );
}
