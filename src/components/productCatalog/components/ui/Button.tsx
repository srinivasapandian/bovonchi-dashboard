import { type ReactNode, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 'var(--radius-button)',
    fontFamily: 'var(--font-primary)',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
    transition: 'all 0.15s ease',
    border: 'none',
    width: fullWidth ? '100%' : undefined,
    whiteSpace: 'nowrap',
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '8px 16px', fontSize: 10.5 },
    md: { padding: '11px 24px', fontSize: 11 },
    lg: { padding: '13px 30px', fontSize: 11.5 },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--accent)', color: '#FFFFFF' },
    secondary: { background: 'transparent', color: 'var(--t1)', border: '1px solid var(--t1)' },
    ghost: { background: 'transparent', color: 'var(--t2)' },
    danger: { background: 'var(--red)', color: '#FFFFFF' },
  };

  return (
    <button
      {...props}
      disabled={isDisabled}
      style={{ ...baseStyle, ...sizeStyles[size], ...variantStyles[variant], ...style }}
    >
      {loading ? (
        <span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
      ) : icon ? (
        <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
