import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigationGuard } from '../context/NavigationGuardContext';

interface UseFormDiscardGuardOptions {
  /**
   * When provided, this is called instead of the built-in modal when the
   * browser back button OR sidebar navigation is triggered. Use for forms
   * that already have their own discard modal (e.g. KitchenStationFormPage,
   * ItemFormPage). The hook will still handle navigating to the correct path
   * when the user confirms — read `pendingSidebarPath` from the returned ref
   * and use it in your confirm handler, falling back to `backPath`.
   */
  onBrowserBack?: () => void;
}

/**
 * Guards a form against accidental navigation.
 *
 * Handles three navigation triggers:
 * 1. Cancel button  — call `handleCancel()` from the onClick.
 * 2. Browser back   — intercepts via `popstate`; shows built-in modal or calls
 *                     `options.onBrowserBack` if the form has its own modal.
 * 3. Sidebar links  — registers dirty state + a custom modal callback with
 *                     `NavigationGuardContext`. Forms with their own modal
 *                     receive the pending path via `pendingSidebarPath` ref;
 *                     forms without one get the standard discard modal.
 *
 * Returns `showDiscardModal` + helpers to render the discard modal inline,
 * plus `pendingSidebarPath` ref for forms that handle their own modal UI.
 */
export function useFormDiscardGuard(
  isDirty: boolean,
  backPath: string,
  options?: UseFormDiscardGuardOptions,
) {
  const navigate = useNavigate();
  const { register, unregister, registerShowModal, unregisterShowModal } = useNavigationGuard();
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // Tracks the path the sidebar was trying to navigate to (null for cancel/back)
  const pendingSidebarPath = useRef<string | null>(null);
  // Tracks whether the pending action is a page reload (keyboard refresh) vs. a route navigation.
  const pendingReload = useRef(false);
  const pendingBrowserBack = useRef(false);
  const backMarkerActive = useRef(false);
  const bypassPopstate = useRef(false);
  // Set to true just before an intentional reload so beforeunload doesn't fire the native dialog.
  const suppressBeforeUnload = useRef(false);

  // Keep a stable ref to the callback so effects don't re-run on every render.
  const onBrowserBackRef = useRef(options?.onBrowserBack);
  useEffect(() => {
    onBrowserBackRef.current = options?.onBrowserBack;
  });

  // ── Sidebar guard: register dirty state + custom modal callback ───────────
  useEffect(() => {
    register(isDirty);
  }, [isDirty, register]);

  // Register the sidebar modal callback once (stable — uses ref for callback).
  useEffect(() => {
    registerShowModal((pendingPath: string) => {
      pendingSidebarPath.current = pendingPath;
      if (onBrowserBackRef.current) {
        onBrowserBackRef.current();
      } else {
        setShowDiscardModal(true);
      }
    });
    return () => {
      unregisterShowModal();
      unregister();
    };
  }, [registerShowModal, unregisterShowModal, unregister]);

  // ── Browser toolbar refresh / tab-close guard ────────────────────────────
  // The native beforeunload prompt is the only option for toolbar refresh and
  // tab close — browsers block custom modals here by design. Always armed
  // because isDirty detection isn't reliable for all field changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (suppressBeforeUnload.current) return; // intentional reload after user confirmed
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ── Keyboard refresh guard (F5, Ctrl/Cmd+R, Ctrl/Cmd+Shift+R) ─────────────
  // Intercepts keyboard refresh so we can show the custom DiscardChangesModal
  // instead of the native beforeunload prompt. Always armed because isDirty
  // detection isn't reliable for all field changes.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isF5 = e.key === 'F5';
      const isCtrlR = (e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R');
      if (!isF5 && !isCtrlR) return;
      e.preventDefault();
      pendingSidebarPath.current = null;
      pendingReload.current = true;
      if (onBrowserBackRef.current) {
        onBrowserBackRef.current();
      } else {
        setShowDiscardModal(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Browser back guard ────────────────────────────────────────────────────
  const pushBackMarker = useCallback(() => {
    const base =
      window.history.state && typeof window.history.state === 'object' ? window.history.state : {};
    window.history.pushState({ ...base, __discardGuardMarker: true }, '', window.location.href);
  }, []);

  useEffect(() => {
    if (!isDirty) return;

    if (!backMarkerActive.current) {
      backMarkerActive.current = true;
      pushBackMarker();
    }

    const handler = () => {
      // Our own history.back() below — let it through instead of re-arming.
      if (bypassPopstate.current) {
        bypassPopstate.current = false;
        return;
      }
      backMarkerActive.current = false;
      // Browser back never has a pending sidebar path
      pendingSidebarPath.current = null;
      pendingBrowserBack.current = true;
      if (onBrowserBackRef.current) {
        onBrowserBackRef.current();
      } else {
        setShowDiscardModal(true);
      }
    };

    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [isDirty, pushBackMarker]);

  // ── Cancel button handler ─────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    pendingSidebarPath.current = null;
    pendingReload.current = false;
    pendingBrowserBack.current = false;
    if (isDirty) {
      setShowDiscardModal(true);
    } else {
      navigate(backPath);
    }
  }, [isDirty, backPath, navigate]);

  const handleConfirmDiscard = useCallback(() => {
    if (pendingReload.current) {
      pendingReload.current = false;
      pendingSidebarPath.current = null;
      setShowDiscardModal(false);
      suppressBeforeUnload.current = true; // prevent native dialog on the reload we're about to trigger
      window.location.reload();
      return;
    }
    if (pendingBrowserBack.current) {
      pendingBrowserBack.current = false;
      pendingSidebarPath.current = null;
      setShowDiscardModal(false);
      bypassPopstate.current = true;
      window.history.back();
      return;
    }
    const target = pendingSidebarPath.current ?? backPath;
    pendingSidebarPath.current = null;
    setShowDiscardModal(false);
    navigate(target);
  }, [backPath, navigate]);

  const handleKeepEditing = useCallback(() => {
    pendingSidebarPath.current = null;
    pendingReload.current = false;
    // Re-arm: the back press that opened this modal consumed the marker.
    if (pendingBrowserBack.current && !backMarkerActive.current) {
      backMarkerActive.current = true;
      pushBackMarker();
    }
    pendingBrowserBack.current = false;
    setShowDiscardModal(false);
  }, [pushBackMarker]);

  return {
    showDiscardModal,
    handleCancel,
    handleConfirmDiscard,
    handleKeepEditing,
    /** Ref holding the sidebar's pending navigation path (null for cancel/back). */
    pendingSidebarPath,
  };
}
