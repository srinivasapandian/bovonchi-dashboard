import { type ReactNode } from 'react';

interface BadgeProps {
  variant?: 'default' | 'success' | 'error' | 'warning' | 'accent';
  children: ReactNode;
}

const variantStyles: Record<string, React.CSSProperties> = {
  default: { background: 'var(--hover)', color: 'var(--t2)' },
  success: { background: 'var(--green-soft)', color: 'var(--green)' },
  error: { background: 'var(--red-soft)', color: 'var(--red)' },
  warning: { background: 'var(--orange-soft)', color: 'var(--orange)' },
  accent: { background: 'var(--accent-soft)', color: 'var(--accent)' },
};

export function Badge({ variant = 'default', children }: BadgeProps) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 500, lineHeight: 1.4, whiteSpace: 'nowrap', ...variantStyles[variant] }}>
      {children}
    </span>
  );
}
