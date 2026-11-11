import { useEffect, useRef } from 'react';
import { useToastActions } from '../../../redux/productCatalog/productCatalogHooks';

type UseErrorToastOptions = {
  fallbackMessage?: string;
  resetWhenCleared?: boolean;
};

function coerceErrorMessage(error: unknown): string | null {
  if (error == null || error === false) return null;
  if (typeof error === 'string') {
    const t = error.trim();
    return t || null;
  }
  if (typeof error === 'number' && Number.isFinite(error)) return String(error);
  if (Array.isArray(error)) {
    const parts = error
      .map((x) => (typeof x === 'string' ? x.trim() : x != null ? String(x) : ''))
      .filter(Boolean);
    return parts.length ? parts.join('; ') : null;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m.trim();
    if (Array.isArray(m)) return coerceErrorMessage(m);
  }
  return null;
}

/**
 * Shows an error toast when a new error message appears.
 * Prevents duplicate toasts for repeated identical errors.
 */
export function useErrorToast(
  error: unknown,
  options?: UseErrorToastOptions,
) {
  const { addToast } = useToastActions();
  const lastErrorRef = useRef<string | null>(null);
  const fallbackMessage = options?.fallbackMessage ?? 'Something went wrong. Please try again.';
  const resetWhenCleared = options?.resetWhenCleared ?? true;

  useEffect(() => {
    const normalized = coerceErrorMessage(error);
    const message =
      normalized ??
      (error !== undefined && error !== null && error !== '' && error !== false
        ? fallbackMessage
        : null);
    if (!message?.trim()) {
      if (resetWhenCleared) lastErrorRef.current = null;
      return;
    }
    const final = message.trim();
    if (lastErrorRef.current === final) return;
    lastErrorRef.current = final;
    addToast(final, 'error');
  }, [error, addToast, fallbackMessage, resetWhenCleared]);
}
