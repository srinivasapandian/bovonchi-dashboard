import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import { PC_BASE } from '../../paths';
import { useMediaQuery } from '../../hooks/useMediaQuery';

/** Aligned with maghil-portal `BootomToast` (pill, bottom-center). */
const TYPE_STYLE: Record<string, { background: string; color: string }> = {
  success: { background: '#6F6F6F', color: '#FFFFFF' },
  info: { background: '#6F6F6F', color: '#FFFFFF' },
  error: { background: '#B89550', color: '#FFFFFF' },
  warning: { background: '#B07A2A', color: '#FFFFFF' },
};

function usePcRouteActive(): boolean {
  const { pathname } = useLocation();
  return pathname.startsWith(PC_BASE);
}

export default function ProductCatalogToastContainer() {
  const { toasts, removeToast } = useToastStore();
  const pc = usePcRouteActive();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !pc || !toasts.length) return null;

  const bottomOffset = isMobile ? 88 : 40;

  const wrap: CSSProperties = {
    position: 'fixed',
    left: '50%',
    bottom: bottomOffset,
    transform: 'translateX(-50%)',
    zIndex: 2147483000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    pointerEvents: 'none',
    maxWidth: 'min(560px, calc(100vw - 32px))',
  };

  const node = (
    <div style={wrap} aria-live="polite">
      {toasts.map((t) => {
        const palette = TYPE_STYLE[t.type] ?? TYPE_STYLE.info;
        return (
          <div
            key={t.id}
            style={{
              pointerEvents: 'auto',
              minWidth: 300,
              maxWidth: '100%',
              borderRadius: 30,
              background: palette.background,
              color: palette.color,
              padding: '12px 44px 12px 20px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 14,
              fontWeight: 500,
              fontFamily: 'var(--font-primary, "Jost", sans-serif)',
              lineHeight: 1.35,
              position: 'relative',
            }}
          >
            <span style={{ flex: 1, textAlign: 'center' }}>{t.message}</span>

            {/* Close button */}
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                border: 'none',
                background: 'rgba(255,255,255,0.22)',
                color: palette.color,
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
                width: 26,
                height: 26,
                padding: 0,
                borderRadius: 13,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Close toast"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );

  return createPortal(node, document.body);
}
