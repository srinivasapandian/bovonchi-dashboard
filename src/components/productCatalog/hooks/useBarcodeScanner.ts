import { useEffect, useRef } from 'react';

type Options = {
  onScan: (code: string) => void;
  enabled?: boolean;
  passthroughRef?: React.RefObject<HTMLElement | null>;
  minChars?: number;
  maxIntervalMs?: number;
  settleMs?: number;
};

/**
 * Global barcode-scanner key listener.
 *
 * Behaviour goals (see MHB-32346):
 *  - Scanner chars are only intercepted when focus is OUTSIDE a text input,
 *    or inside the explicit passthrough field. Keystrokes that originate in
 *    any other editable input are ignored entirely so normal typing and React
 *    caret handling are never disturbed.
 *  - `passthroughRef` marks one input that receives all keystrokes naturally
 *    (used by ItemFormPage's item-code field).
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  passthroughRef,
  minChars = 6,
  maxIntervalMs = 20,
  settleMs = 50,
}: Options) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    let buffer = '';
    let lastTime = 0;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const reset = () => {
      buffer = '';
      lastTime = 0;
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
    };

    const finalize = () => {
      if (buffer.length >= minChars) {
        const code = buffer;
        reset();
        onScanRef.current(code);
      } else {
        reset();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const now = performance.now();
      const dt = lastTime ? now - lastTime : Infinity;
      const inPassthrough = !!(
        passthroughRef?.current &&
        document.activeElement === passthroughRef.current
      );

      // Ignore keystrokes that originate inside any editable input.
      // Intercepting them at capture phase causes caret instability in React
      // controlled fields — scanners are detected only when focus is outside
      // an input or in the dedicated passthrough field.
      const targetIsInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;
      if (targetIsInput && !inPassthrough) {
        return;
      }

      if (e.key === 'Enter') {
        if (buffer.length >= minChars) {
          e.preventDefault();
          e.stopPropagation();
          finalize();
        } else {
          reset();
        }
        return;
      }

      if (e.key.length !== 1) return;

      // Prevent scanner chars from leaking into contentEditable nodes.
      if (e.target instanceof HTMLElement && e.target.isContentEditable && !inPassthrough) {
        e.preventDefault();
        e.stopPropagation();
      }

      // A long gap means the previous run was slow typing; start fresh.
      if (dt > maxIntervalMs && buffer.length > 0) {
        reset();
      }

      buffer += e.key;
      lastTime = now;

      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(finalize, settleMs);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [enabled, passthroughRef, minChars, maxIntervalMs, settleMs]);
}
