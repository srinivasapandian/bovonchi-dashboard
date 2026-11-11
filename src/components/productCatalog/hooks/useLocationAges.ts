import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLocationAges, updateLocationAges } from '../../../services/locationCatalogApi';

/**
 * Per-location custom age list used by the per-item age-restriction picker
 * in `ItemFormPage`. Wraps the two HTTP endpoints:
 *   - GET  /locations/ages/:locationId
 *   - POST /locations/update-ages
 *
 * Intentionally a small standalone hook (no Redux/saga) because the data is
 * scoped to the open form — a single fetch per `locationId` is enough, and
 * any change is a synchronous user action where optimistic UI + rollback is
 * easy to reason about inline.
 *
 * Usage:
 *   const { ages, loading, error, addAge, removeAge } = useLocationAges(locationId);
 *
 * `addAge(n)`:
 *   - Validates 1 <= n <= 99 integer (returns `{ ok: false, reason: '...' }` otherwise).
 *   - If already in the list → `{ ok: true, alreadyExisted: true }` (no API call).
 *   - Else optimistically adds, PUTs the new full list, and on failure rolls back.
 *
 * `removeAge(n)`:
 *   - Symmetric: optimistic remove + PUT + rollback on failure.
 *
 * Both operations resolve to a discriminated result so the form can decide
 * whether to surface a toast / inline error.
 */

const MIN_AGE = 0;
const MAX_AGE = 99;
const MAX_LIST = 50;

export interface AgeMutationResult {
  ok: boolean;
  reason?:
    | 'invalid'         // not an integer / out of range
    | 'duplicate'       // (used as informational; ok is true with alreadyExisted)
    | 'limit_exceeded'  // would push past MAX_LIST
    | 'request_failed';
  alreadyExisted?: boolean;
  ages?: number[];      // canonical persisted list when ok
  message?: string;
}

export interface UseLocationAgesResult {
  ages: number[];
  loading: boolean;
  /** Set on the most recent failure; cleared on the next successful op. */
  error: string | null;
  /** Resolves true when the initial fetch (or any later refetch) completes. */
  refetch: () => Promise<void>;
  addAge: (age: number) => Promise<AgeMutationResult>;
  removeAge: (age: number) => Promise<AgeMutationResult>;
  /** Cheap "is this number selectable from this hook's list" check. */
  has: (age: number) => boolean;
}

function sanitizeList(input: number[]): number[] {
  const seen = new Set<number>();
  for (const v of input) {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) continue;
    const i = Math.floor(n);
    if (i < MIN_AGE || i > MAX_AGE) continue;
    seen.add(i);
  }
  return Array.from(seen).sort((a, b) => a - b);
}

export function useLocationAges(
  locationId: string | null | undefined,
  token?: string | null,
): UseLocationAgesResult {
  const [ages, setAges] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Track the most recently fetched locationId so a stale resolve from an
  // earlier locationId doesn't clobber a newer fetch.
  const lastLocationRef = useRef<string | null>(null);

  const refetch = useCallback(async () => {
    if (!locationId) {
      setAges([]);
      return;
    }
    lastLocationRef.current = locationId;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchLocationAges(locationId, token);
      // Drop the response if a newer fetch has started.
      if (lastLocationRef.current !== locationId) return;
      setAges(sanitizeList(list));
    } catch (e) {
      if (lastLocationRef.current !== locationId) return;
      setError(e instanceof Error ? e.message : 'Failed to load custom ages');
    } finally {
      if (lastLocationRef.current === locationId) setLoading(false);
    }
  }, [locationId, token]);

  useEffect(() => {
    if (!locationId) {
      setAges([]);
      return;
    }
    void refetch();
  }, [locationId, refetch]);

  const addAge = useCallback(
    async (raw: number): Promise<AgeMutationResult> => {
      const n = Math.floor(Number(raw));
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < MIN_AGE || n > MAX_AGE) {
        return {
          ok: false,
          reason: 'invalid',
          message: `Enter a whole number between ${MIN_AGE} and ${MAX_AGE}.`,
        };
      }
      if (!locationId) {
        return { ok: false, reason: 'request_failed', message: 'No location selected' };
      }
      // Already in list — treat as success-no-op so the picker can simply
      // select the existing chip (per AC: "prevent duplication and simply
      // highlight/select the existing option").
      if (ages.includes(n)) {
        return { ok: true, alreadyExisted: true, ages };
      }
      if (ages.length >= MAX_LIST) {
        return {
          ok: false,
          reason: 'limit_exceeded',
          message: `Custom age list is capped at ${MAX_LIST} entries.`,
        };
      }
      const optimistic = sanitizeList([...ages, n]);
      const previous = ages;
      setAges(optimistic);
      try {
        const persisted = await updateLocationAges(locationId, optimistic, token);
        const next = sanitizeList(persisted);
        setAges(next);
        setError(null);
        return { ok: true, ages: next };
      } catch (e) {
        // Roll back on failure.
        setAges(previous);
        const message = e instanceof Error ? e.message : 'Failed to save custom age';
        setError(message);
        return { ok: false, reason: 'request_failed', message };
      }
    },
    [ages, locationId, token],
  );

  const removeAge = useCallback(
    async (raw: number): Promise<AgeMutationResult> => {
      const n = Math.floor(Number(raw));
      if (!Number.isFinite(n)) {
        return { ok: false, reason: 'invalid', message: 'Invalid age value' };
      }
      if (!locationId) {
        return { ok: false, reason: 'request_failed', message: 'No location selected' };
      }
      if (!ages.includes(n)) {
        // Nothing to remove — treat as success to keep callers simple.
        return { ok: true, ages };
      }
      const optimistic = ages.filter((x) => x !== n);
      const previous = ages;
      setAges(optimistic);
      try {
        const persisted = await updateLocationAges(locationId, optimistic, token);
        const next = sanitizeList(persisted);
        setAges(next);
        setError(null);
        return { ok: true, ages: next };
      } catch (e) {
        setAges(previous);
        const message = e instanceof Error ? e.message : 'Failed to remove custom age';
        setError(message);
        return { ok: false, reason: 'request_failed', message };
      }
    },
    [ages, locationId, token],
  );

  const has = useCallback((age: number) => ages.includes(age), [ages]);

  return { ages, loading, error, refetch, addAge, removeAge, has };
}
