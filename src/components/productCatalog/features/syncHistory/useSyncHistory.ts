import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import { getSyncHistoryApi, retryThirdPartySyncApi, type SyncErrorKind } from '../../../../services/syncCatalogApi';
import { useAppDispatch, useAppSelector } from '../../../../redux/hooks';
import { triggerSyncRequest } from '../../../../redux/productCatalog/productCatalogActions';
import type { SyncEntry } from '../../data/types';
import { mapApiEntryToSyncEntry } from './syncHistoryMapper';
import { onSyncHistoryRefreshed, publishHistoryLoaded, requestSyncWatch } from './syncWatchBus';

const POST_SYNC_WAIT_MS = 15000;
const FETCH_DEDUP_WINDOW_MS = 750;

let inFlightHistoryByLocation: Record<string, Promise<SyncEntry[]> | null> = {};
let lastHistoryFetchAtByLocation: Record<string, number> = {};
let lastHistoryEntriesByLocation: Record<string, SyncEntry[]> = {};

export interface UseSyncHistoryResult {
  entries: SyncEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  /** Trigger sync. Pass `syncHistoryId` only for Resync actions. */
  triggerSync: (syncHistoryId?: string) => void;
  syncBusy: boolean;
  /** Remaining wait time after trigger success (seconds). */
  syncRemainingSeconds: number;
  /** True only during the post-trigger-success 15s countdown window. */
  syncCountingDown: boolean;
  syncTriggerError: string | null;
  /** Classifies a sync-trigger failure so the UI can show an adaptive message. */
  syncTriggerErrorKind: SyncErrorKind | null;
  /** Retry failed third-party channel(s) of a sync (same history, no device notification). Omit ids to retry all failed. */
  retryThirdParty: (syncHistoryId: string, thirdPartySyncIds?: string[]) => Promise<void>;
  /** thirdPartySyncIds currently being retried (disable their buttons). */
  retryingIds: string[];
  retryError: string | null;
  /** Channels the backend skipped on the last retry (e.g. "Provider is still processing"). */
  retryNotice: string | null;
}

export interface UseSyncHistoryOptions {
  /** Re-read the list whenever the app-wide sync watcher (2 / 4 / 6 minute checks) has read the history. Sync History page only. */
  refreshOnWatch?: boolean;
}

export function useSyncHistory(options: UseSyncHistoryOptions = {}): UseSyncHistoryResult {
  const { refreshOnWatch = false } = options;
  const dispatch = useAppDispatch();
  const syncTriggerLoading = useAppSelector((s) => s.productCatalog.syncTrigger.loading);
  const syncTriggerErrorRedux = useAppSelector((s) => s.productCatalog.syncTrigger.error);
  const syncTriggerErrorKindRedux = useAppSelector((s) => s.productCatalog.syncTrigger.errorKind);
  const { auth } = useAuth();
  const { selectedBranch } = useBranch();
  const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
  const userId = auth?.id != null ? String(auth.id) : '';

  const [entries, setEntries] = useState<SyncEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postSyncCountdown, setPostSyncCountdown] = useState(false);
  /** True from click until post-trigger window starts or request fails — avoids a render gap where Redux loading is false but countdown state is not yet set. */
  const [awaitingPostTriggerWindow, setAwaitingPostTriggerWindow] = useState(false);
  const [syncRemainingSeconds, setSyncRemainingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownEndsAtRef = useRef<number | null>(null);

  const stopCountdownTicker = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    countdownEndsAtRef.current = null;
    setSyncRemainingSeconds(0);
  }, []);

  const startCountdownTicker = useCallback((waitMs: number) => {
    const endsAt = Date.now() + waitMs;
    countdownEndsAtRef.current = endsAt;
    const update = () => {
      if (countdownEndsAtRef.current == null) {
        setSyncRemainingSeconds(0);
        return;
      }
      const remainingMs = Math.max(0, countdownEndsAtRef.current - Date.now());
      setSyncRemainingSeconds(Math.ceil(remainingMs / 1000));
      if (remainingMs <= 0 && countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
    update();
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(update, 250);
  }, []);

  /** Every list this hook reads is also handed to the app-wide sync watcher (it ignores it when no watch is active). */
  const announceLoaded = useCallback((list: SyncEntry[]) => {
    publishHistoryLoaded(list);
  }, []);

  const fetchHistory = useCallback(async (silent = false) => {
    if (!locationId) {
      setEntries([]);
      return;
    }
    const now = Date.now();
    const hasRecentFetch =
      lastHistoryFetchAtByLocation[locationId] != null &&
      now - lastHistoryFetchAtByLocation[locationId] < FETCH_DEDUP_WINDOW_MS;
    if (hasRecentFetch && lastHistoryEntriesByLocation[locationId]) {
      setEntries(lastHistoryEntriesByLocation[locationId]);
      announceLoaded(lastHistoryEntriesByLocation[locationId]);
      return;
    }
    const existingInFlight = inFlightHistoryByLocation[locationId];
    if (existingInFlight) {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const fromInflight = await existingInFlight;
        setEntries(fromInflight);
        announceLoaded(fromInflight);
      } catch (e) {
        if (!silent) {
          setError(e instanceof Error ? e.message : 'Failed to load sync history');
          setEntries([]);
        }
      } finally {
        if (!silent) setLoading(false);
      }
      return;
    }
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    const req = (async () => {
      const data = await getSyncHistoryApi(locationId);
      const raw = Array.isArray(data?.entries) ? data.entries : [];
      return raw
        .map((e) => mapApiEntryToSyncEntry(e as Record<string, unknown>))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    })();
    inFlightHistoryByLocation[locationId] = req;
    try {
      const mapped = await req;
      lastHistoryFetchAtByLocation[locationId] = Date.now();
      lastHistoryEntriesByLocation[locationId] = mapped;
      setEntries(mapped);
      announceLoaded(mapped);
    } catch (e) {
      // A quiet refresh must not blank the list or show an error; keep what is on screen.
      if (!silent) {
        setError(e instanceof Error ? e.message : 'Failed to load sync history');
        setEntries([]);
      }
    } finally {
      inFlightHistoryByLocation[locationId] = null;
      if (!silent) setLoading(false);
    }
  }, [locationId, announceLoaded]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // The app-wide watcher reads the history at 2 / 4 / 6 minutes after a sync; show the same data on this page.
  useEffect(() => {
    if (!refreshOnWatch || !locationId) return;
    return onSyncHistoryRefreshed((list) => {
      // The watcher already read the history: show it and keep the shared cache current, no second request.
      lastHistoryEntriesByLocation[locationId] = list;
      lastHistoryFetchAtByLocation[locationId] = Date.now();
      setEntries(list);
    });
  }, [refreshOnWatch, locationId]);

  const [retryingIds, setRetryingIds] = useState<string[]>([]);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);

  const retryThirdParty = useCallback(
    async (syncHistoryId: string, thirdPartySyncIds?: string[]) => {
      if (!locationId || !userId || !syncHistoryId) return;
      const busyKey = thirdPartySyncIds && thirdPartySyncIds.length > 0 ? thirdPartySyncIds : ['*'];
      setRetryError(null);
      setRetryNotice(null);
      setRetryingIds((prev) => [...prev, ...busyKey]);
      try {
        const result = await retryThirdPartySyncApi({
          locationId,
          userId,
          syncHistoryId,
          ...(thirdPartySyncIds && thirdPartySyncIds.length > 0 ? { thirdPartySyncIds } : {}),
        });
        if (result.skipped?.length) {
          setRetryNotice(result.skipped.map((s) => `${s.name}: ${s.reason}`).join(' | '));
        }
        delete lastHistoryFetchAtByLocation[locationId];
        await fetchHistory(true);
        if (result.retried?.length) requestSyncWatch();
      } catch (e) {
        setRetryError(e instanceof Error ? e.message : 'Failed to retry sync');
      } finally {
        setRetryingIds((prev) => prev.filter((id) => !busyKey.includes(id)));
      }
    },
    [locationId, userId, fetchHistory],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopCountdownTicker();
    };
  }, [stopCountdownTicker]);

  const refetch = useCallback(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const triggerSync = useCallback(
    (syncHistoryId?: string) => {
      if (!locationId || !userId || syncTriggerLoading || postSyncCountdown || awaitingPostTriggerWindow) return;

      let resolve!: () => void;
      let reject!: (e: Error) => void;
      const done = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      setAwaitingPostTriggerWindow(true);
      dispatch(
        triggerSyncRequest({
          locationId,
          userId,
          ...(syncHistoryId ? { syncHistoryId } : {}),
          deferred: { resolve, reject },
        }),
      );
      void done
        .then(() => {
          setAwaitingPostTriggerWindow(false);
          setPostSyncCountdown(true);
          startCountdownTicker(POST_SYNC_WAIT_MS);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            setPostSyncCountdown(false);
            stopCountdownTicker();
            void fetchHistory();
          }, POST_SYNC_WAIT_MS);
        })
        .catch(() => {
          setAwaitingPostTriggerWindow(false);
          stopCountdownTicker();
        });
    },
    [locationId, userId, syncTriggerLoading, postSyncCountdown, awaitingPostTriggerWindow, dispatch, fetchHistory, startCountdownTicker, stopCountdownTicker],
  );

  const syncBusy = syncTriggerLoading || postSyncCountdown || awaitingPostTriggerWindow;

  return {
    entries,
    loading,
    error,
    refetch,
    triggerSync,
    syncBusy,
    syncRemainingSeconds,
    syncCountingDown: postSyncCountdown,
    syncTriggerError: syncTriggerErrorRedux,
    syncTriggerErrorKind: syncTriggerErrorKindRedux,
    retryThirdParty,
    retryingIds,
    retryError,
    retryNotice,
  };
}
