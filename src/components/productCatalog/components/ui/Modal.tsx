import { type ReactNode, useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({ open, onClose, title, children, footer, width = 520 }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
        }}
      />
      <div
        style={{
          position: 'relative',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-card)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          width: '100%',
          maxWidth: width,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {title && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 22px',
              borderBottom: '1px solid var(--divider)',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', margin: 0 }}>
              {title}
            </h3>
            <button
              onClick={onClose}
              style={{
                width: 28,
                height: 28,
                borderRadius: 2,
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--t3)',
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>
        )}
        <div
          style={{
            padding: '20px 22px',
            overflowY: 'auto',
            overflowX: 'hidden',
            flexShrink: 1,
            maxHeight: 'calc(85vh - 140px)',
          }}
        >
          {children}
        </div>
        {footer && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '14px 22px',
              borderTop: '1px solid var(--divider)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
