import { useEffect, useRef, useState } from 'react';

export const getInitials = (name: unknown): string => {
  if (!name || typeof name !== 'string') return '—';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  return name.trim().slice(0, 2).toUpperCase();
};

interface User {
  initials: string;
  name: string;
  role: string;
  email?: string;
  business?: string;
  onLogout: () => void;
}

/**
 * Signed-in user: avatar + name/role. Opens a card above it with the account details and Sign out.
 */
export default function UserProfileDropdown({
  user,
  compact = false,
  iconOnly = false,
}: {
  user: User | null;
  compact?: boolean;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const size = compact || iconOnly ? 34 : 40;

  const avatar = (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        background: 'var(--bv-gold-tint)',
        color: 'var(--bv-gold-deep)',
        border: '1px solid var(--bv-line)',
        display: 'grid',
        placeItems: 'center',
        fontSize: size * 0.34,
        fontWeight: 600,
        letterSpacing: '0.06em',
      }}
    >
      {user.initials}
    </span>
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: iconOnly ? 'auto' : '100%',
          padding: iconOnly ? 0 : '10px 8px',
          background: open ? 'var(--bv-sand)' : 'transparent',
          border: iconOnly ? 'none' : '1px solid transparent',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--bv-ink)',
          transition: 'background .15s ease, border-color .15s ease',
        }}
        onMouseEnter={(e) => !iconOnly && (e.currentTarget.style.background = 'var(--bv-sand)')}
        onMouseLeave={(e) => !iconOnly && !open && (e.currentTarget.style.background = 'transparent')}
      >
        {avatar}
        {!iconOnly && (
          <>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span
                style={{ display: 'block', fontSize: 14, fontWeight: 500, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {user.name}
              </span>
              <span
                style={{ display: 'block', marginTop: 2, fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--bv-ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {user.role}
              </span>
            </span>
            <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--bv-ink-faint)' }}>
              unfold_more
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            left: 0,
            right: iconOnly ? 'auto' : 0,
            minWidth: 220,
            ...(iconOnly ? { top: 'calc(100% + 8px)', right: 0, left: 'auto' } : { bottom: 'calc(100% + 8px)' }),
            background: '#fff',
            border: '1px solid var(--bv-line)',
            boxShadow: '0 16px 40px rgba(69, 63, 57, 0.16)',
            zIndex: 1200,
          }}
        >
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--bv-line-soft)' }}>
            <div style={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{user.name}</div>
            {user.email ? (
              <div style={{ marginTop: 2, fontSize: 12, color: 'var(--bv-ink-muted)', wordBreak: 'break-all' }}>{user.email}</div>
            ) : null}
            {user.business ? (
              <div style={{ marginTop: 8, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--bv-ink-faint)' }}>
                {user.business}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              user.onLogout();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '13px 16px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--bv-ink)',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bv-sand)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
              logout
            </span>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
