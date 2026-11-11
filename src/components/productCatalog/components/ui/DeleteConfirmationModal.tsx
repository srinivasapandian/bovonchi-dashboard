import { type ReactNode, useEffect, useId } from 'react';
import { Button } from './Button';

export interface DeleteConfirmationModalProps {
  /** Prefer this; matches `Modal` and most call sites */
  open?: boolean;
  /** Alias for `open` when you prefer that name */
  isOpen?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Main question line, e.g. `Delete ‘Wing Flavor’?` — use `deleteConfirmTitle()` helper */
  title: ReactNode;
  /** Grey supporting copy below the title */
  description: ReactNode;
  /** Optional block below description (warnings, extra context) */
  extra?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmButtonVariant?: 'primary' | 'danger';
  width?: number;
  /** Disables actions and shows loading on the confirm button */
  confirmLoading?: boolean;
}

/** Unicode single quotation marks around a label (e.g. Wing Flavor → ‘Wing Flavor’) */
export function quotedDeleteName(name: string): string {
  return `\u2018${name}\u2019`;
}

/** Title line: `Delete ‘Name’?` — pass verb `Remove` for nested row deletes */
export function deleteConfirmTitle(name: string, verb = 'Delete'): string {
  const n = name.trim() || 'this item';
  return `${verb} ${quotedDeleteName(n)}?`;
}

export function DeleteConfirmationModal({
  open,
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  extra,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  confirmButtonVariant = 'danger',
  width = 440,
  confirmLoading = false,
}: DeleteConfirmationModalProps) {
  const titleId = useId();
  const visible = Boolean(open ?? isOpen);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (confirmLoading) return;
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [visible, onClose, confirmLoading]);

  if (!visible) return null;

  const cancelStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    color: 'var(--t2, #6E665D)',
    background: 'var(--surface, #FFFFFF)',
    border: '1px solid var(--card-border, #E6DFD3)',
    borderRadius: 'var(--radius-button, 8px)',
    cursor: confirmLoading ? 'not-allowed' : 'pointer',
    opacity: confirmLoading ? 0.5 : 1,
    transition: 'all 0.15s ease',
  };

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
        onClick={() => {
          if (confirmLoading) return;
          onClose();
        }}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
        }}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          background: 'var(--surface, #FFFFFF)',
          borderRadius: 2,
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          width: '100%',
          maxWidth: width,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '22px 22px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <h2
              id={titleId}
              style={{
                flex: 1,
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--t1, #453F39)',
                lineHeight: 1.35,
                fontFamily: 'var(--font-primary)',
              }}
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              disabled={confirmLoading}
              style={{
                width: 32,
                height: 32,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'transparent',
                color: 'var(--t3, #9A9084)',
                fontSize: 22,
                lineHeight: 1,
                cursor: confirmLoading ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                marginTop: -2,
              }}
            >
              &times;
            </button>
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 14,
              color: 'var(--t2, #6E665D)',
              lineHeight: 1.55,
              fontFamily: 'var(--font-primary)',
            }}
          >
            {description}
          </div>
          {extra ? <div style={{ marginTop: 14 }}>{extra}</div> : null}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 10,
            padding: '18px 22px 22px',
            marginTop: 4,
          }}
        >
          <button type="button" style={cancelStyle} onClick={onClose} disabled={confirmLoading}>
            {cancelLabel}
          </button>
          <Button variant={confirmButtonVariant} onClick={onConfirm} loading={confirmLoading} disabled={confirmLoading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
