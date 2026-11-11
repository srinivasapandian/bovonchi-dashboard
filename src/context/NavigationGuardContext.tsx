import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface NavigationGuardContextType {
  /** Called by form pages on every render to keep dirty state current. */
  register: (isDirty: boolean) => void;
  /** Called by form pages on unmount. */
  unregister: () => void;
  /** Sidebar / nav links call this instead of navigate() directly. */
  guardedNavigate: (path: string) => void;
  /**
   * Forms that have their own discard modal register a callback here.
   * When the sidebar triggers a guarded navigation, this is called with the
   * pending path instead of showing the built-in modal.
   */
  registerShowModal: (fn: (pendingPath: string) => void) => void;
  /** Called on unmount to remove the custom modal callback. */
  unregisterShowModal: () => void;
}

const NavigationGuardContext = createContext<NavigationGuardContextType | null>(null);

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const isDirtyRef = useRef(false);
  const [showModal, setShowModal] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const showModalCallbackRef = useRef<((pendingPath: string) => void) | null>(null);

  const register = useCallback((isDirty: boolean) => {
    isDirtyRef.current = isDirty;
  }, []);

  const unregister = useCallback(() => {
    isDirtyRef.current = false;
  }, []);

  const registerShowModal = useCallback((fn: (pendingPath: string) => void) => {
    showModalCallbackRef.current = fn;
  }, []);

  const unregisterShowModal = useCallback(() => {
    showModalCallbackRef.current = null;
  }, []);

  const guardedNavigate = useCallback(
    (path: string) => {
      if (isDirtyRef.current) {
        if (showModalCallbackRef.current) {
          // Form has its own modal — delegate to it
          showModalCallbackRef.current(path);
        } else {
          // No form modal registered — show built-in modal
          setPendingPath(path);
          setShowModal(true);
        }
      } else {
        navigate(path);
      }
    },
    [navigate],
  );

  const handleConfirm = useCallback(() => {
    setShowModal(false);
    isDirtyRef.current = false;
    const path = pendingPath;
    setPendingPath(null);
    if (path) navigate(path);
  }, [navigate, pendingPath]);

  const handleKeepEditing = useCallback(() => {
    setShowModal(false);
    setPendingPath(null);
  }, []);

  const value = useMemo(
    () => ({ register, unregister, guardedNavigate, registerShowModal, unregisterShowModal }),
    [register, unregister, guardedNavigate, registerShowModal, unregisterShowModal],
  );

  return (
    <NavigationGuardContext.Provider value={value}>
      {children}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={handleKeepEditing}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }}
          />
          <div
            style={{
              position: 'relative',
              background: 'var(--surface, #fff)',
              borderRadius: 'var(--radius-card, 14px)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              width: '100%',
              maxWidth: 420,
              overflow: 'hidden',
              fontFamily: 'var(--font-primary, "Jost", sans-serif)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 22px',
                borderBottom: '1px solid var(--divider, #E6DFD3)',
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1, #453F39)', margin: 0 }}>
                Discard changes?
              </h3>
              <button
                type="button"
                onClick={handleKeepEditing}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: 'none',
                  background: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--t3, #9A9084)',
                  fontSize: 18,
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <p style={{ fontSize: 13, color: 'var(--t2, #6E665D)', margin: 0, lineHeight: 1.6 }}>
                You have unsaved changes. Are you sure you want to discard them?
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                padding: '14px 22px',
                borderTop: '1px solid var(--divider, #E6DFD3)',
              }}
            >
              <button
                type="button"
                onClick={handleKeepEditing}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-button, 6px)',
                  border: '1px solid var(--card-border, #E6DFD3)',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--t1, #453F39)',
                  fontFamily: 'var(--font-primary, "Jost", sans-serif)',
                }}
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-button, 6px)',
                  border: 'none',
                  background: '#A63D2F',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary, "Jost", sans-serif)',
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  const ctx = useContext(NavigationGuardContext);
  if (!ctx) throw new Error('useNavigationGuard must be used inside NavigationGuardProvider');
  return ctx;
}
