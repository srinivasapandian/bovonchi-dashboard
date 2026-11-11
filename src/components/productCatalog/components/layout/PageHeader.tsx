import type { ReactNode, CSSProperties } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  /** Kept for API compatibility with the portal; the Bovonchi header is flat and ignores it. */
  accentRgb?: string;
  /** Compact mode for sub-pages / forms (less padding, smaller icon) */
  compact?: boolean;
  /** Extra styles on root */
  style?: CSSProperties;
}

/**
 * Editorial page header (Bovonchi): hairline rule, circular gold-tint icon,
 * Cormorant title, muted subtitle, optional right-side actions.
 */
export default function PageHeader({ icon, title, subtitle, actions, compact = false, style }: PageHeaderProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const iconSize = compact || isMobile ? 40 : 48;
  const titleSize = compact ? 26 : isMobile ? 26 : 32;

  return (
    <div
      style={{
        padding: compact ? '8px 0 20px' : isMobile ? '8px 0 18px' : '12px 0 24px',
        borderBottom: '1px solid var(--bv-line)',
        marginBottom: 24,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <div
            style={{
              width: iconSize,
              height: iconSize,
              borderRadius: '50%',
              background: 'var(--bv-gold-tint)',
              border: '1px solid var(--bv-line)',
              color: 'var(--bv-gold-deep)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontFamily: 'var(--bv-font-display)',
                fontWeight: 500,
                fontSize: titleSize,
                lineHeight: 1.1,
                color: 'var(--t1)',
              }}
            >
              {title}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--t2)', lineHeight: 1.4 }}>{subtitle}</p>
          </div>
        </div>
        {actions && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexShrink: 0,
              ...(isMobile ? { width: '100%', flexWrap: 'wrap' as const } : {}),
            }}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
