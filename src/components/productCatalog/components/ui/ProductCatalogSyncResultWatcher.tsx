import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Modal } from './Modal';
import { Button } from './Button';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import { getSyncHistoryApi, retryThirdPartySyncApi } from '../../../../services/syncCatalogApi';
import { useToastActions } from '../../../../redux/productCatalog/productCatalogHooks';
import { mapApiEntryToSyncEntry } from '../../features/syncHistory/syncHistoryMapper';
import {
  emitSyncHistoryRefreshed,
  onHistoryLoaded,
  onSyncWatchRequested,
  requestSyncWatch,
} from '../../features/syncHistory/syncWatchBus';
import {
  FRESH_HISTORY_MS,
  checkNoForElapsed,
  nextCheckDelayMs,
  evaluateSyncCheck,
  issuesKey,
  type SyncCheckResult,
} from '../../features/syncHistory/syncWatchLogic';
import type { SyncEntry } from '../../data/types';
import { PC_BASE } from '../../paths';

interface PopupState {
  result: SyncCheckResult;
  syncHistoryId: string;
  key: string;
}

/**
 * After a sync (or a Resync) is started, read GET /sync/history at 2, 4 and 6 minutes (no events, no streaming).
 *  - a third party failed  -> popup lists those third parties with the reason, with a Resync button
 *  - still pending at 6 min -> popup says there was no answer, with a Resync button
 *  - all synced            -> nothing is shown
 * Mounted once for the whole app; the popup itself only appears on Product Catalog pages.
 */
export default function ProductCatalogSyncResultWatcher() {
  const { pathname } = useLocation();
  const onCatalogue = pathname.startsWith(PC_BASE);
  const { auth } = useAuth();
  const { selectedBranch } = useBranch();
  const { addToast } = useToastActions();
  const locationId = (selectedBranch?.id ?? selectedBranch?.locationId ?? '') as string;
  const userId = auth?.id != null ? String(auth.id) : '';

  const [popup, setPopup] = useState<PopupState | null>(null);
  const [resyncing, setResyncing] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runRef = useRef(0);
  const checkNoRef = useRef(0);
  const dismissedKeyRef = useRef('');
  const locationRef = useRef(locationId);
  locationRef.current = locationId;
  /** True from the sync trigger until the watch has finished. */
  const activeRef = useRef(false);
  const startedAtRef = useRef(0);
  /** The last history any page read during this watch (and when). */
  const lastLoadedRef = useRef<{ at: number; entries: SyncEntry[] } | null>(null);

  const stop = useCallback(() => {
    activeRef.current = false;
    runRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const scheduleCheck = useCallback(
    (run: number) => {
      timerRef.current = setTimeout(async () => {
        timerRef.current = null;
        if (run !== runRef.current) return;
        const checkNo = (checkNoRef.current += 1);
        try {
          // A page read the history a moment ago (e.g. the user just opened another page): use it, no new call.
          const recent = lastLoadedRef.current;
          let entries: SyncEntry[];
          if (recent && Date.now() - recent.at < FRESH_HISTORY_MS) {
            entries = recent.entries;
          } else {
            const data = await getSyncHistoryApi(locationRef.current);
            if (run !== runRef.current) return;
            entries = (Array.isArray(data?.entries) ? data.entries : [])
              .map((e) => mapApiEntryToSyncEntry(e as Record<string, unknown>))
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            lastLoadedRef.current = { at: Date.now(), entries };
            emitSyncHistoryRefreshed(entries);
          }
          const latest = entries[0];
          const result = evaluateSyncCheck(latest, checkNo);
          if (result.show && latest) {
            const key = issuesKey(result);
            if (key !== dismissedKeyRef.current) setPopup({ result, syncHistoryId: latest.id, key });
          }
          if (!result.stop) scheduleCheck(run);
          else activeRef.current = false;
        } catch {
          // A failed read (offline, server busy) must not end the watch early: try again at the next slot.
          if (run === runRef.current && checkNo < 3) scheduleCheck(run);
        }
      }, nextCheckDelayMs(checkNoRef.current, Date.now() - startedAtRef.current));
    },
    [],
  );

  const start = useCallback(() => {
    stop();
    checkNoRef.current = 0;
    dismissedKeyRef.current = '';
    setPopup(null);
    activeRef.current = true;
    startedAtRef.current = Date.now();
    lastLoadedRef.current = null;
    scheduleCheck(runRef.current);
  }, [stop, scheduleCheck]);

  useEffect(() => onSyncWatchRequested(start), [start]);

  // Every history any page reads while the watch is active (right after the trigger, or when the user opens
  // another page) is used here at once, with no extra request:
  //  - a failed third party is shown now (e.g. "Missing KitchenHub storeId"),
  //  - everything final means the watch is finished and the 2 / 4 / 6 minute calls are cancelled,
  //  - "no response" is only decided from the 6 minute mark on.
  useEffect(
    () =>
      onHistoryLoaded((entries) => {
        if (!activeRef.current) return;
        lastLoadedRef.current = { at: Date.now(), entries };
        const latest = [...entries].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )[0];
        const result = evaluateSyncCheck(latest, checkNoForElapsed(Date.now() - startedAtRef.current));
        if (result.show && latest) {
          const key = issuesKey(result);
          if (key !== dismissedKeyRef.current) setPopup({ result, syncHistoryId: latest.id, key });
        }
        if (result.stop) stop();
      }),
    [stop],
  );

  // Different outlet or logout: forget the watch and any popup of the previous one.
  useEffect(() => {
    return () => {
      stop();
      setPopup(null);
    };
  }, [locationId, userId, stop]);

  const close = () => {
    if (popup) dismissedKeyRef.current = popup.key;
    setPopup(null);
  };

  const resync = async () => {
    if (!popup || !userId || !locationId || resyncing) return;
    const issues = [...popup.result.failed, ...popup.result.unconfirmed];
    const ids = issues.map((i) => i.thirdPartySyncId).filter((id): id is string => !!id);
    setResyncing(true);
    try {
      const res = await retryThirdPartySyncApi({
        locationId,
        userId,
        syncHistoryId: popup.syncHistoryId,
        ...(ids.length > 0 ? { thirdPartySyncIds: ids } : {}),
      });
      if (res.retried?.length) {
        addToast(`Resync started for ${res.retried.map((r) => r.name).join(', ')}`, 'info');
      }
      if (res.skipped?.length) {
        addToast(res.skipped.map((s) => `${s.name}: ${s.reason}`).join(' | '), 'warning');
      }
      setPopup(null);
      if (res.retried?.length) requestSyncWatch();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to resync', 'error');
    } finally {
      setResyncing(false);
    }
  };

  if (!popup || !onCatalogue) return null;

  const { failed, unconfirmed } = popup.result;
  const muted = { fontSize: 13, color: 'var(--t2, #6E665D)', lineHeight: 1.6 } as const;

  return (
    <Modal
      open
      onClose={close}
      title="Sync needs attention"
      width={500}
      footer={
        <>
          <Button size="sm" variant="secondary" onClick={close} disabled={resyncing}>
            Close
          </Button>
          <Button size="sm" onClick={() => void resync()} loading={resyncing}>
            Resync
          </Button>
        </>
      }
    >
      {failed.length > 0 && (
        <div style={{ marginBottom: unconfirmed.length > 0 ? 16 : 0 }}>
          <p style={{ ...muted, margin: '0 0 8px', fontWeight: 600, color: 'var(--t1, #453F39)' }}>
            These third-party syncs failed
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {failed.map((i) => (
              <li key={i.thirdPartySyncId ?? i.name} style={muted}>
                <strong style={{ color: 'var(--t1, #453F39)' }}>{i.name}</strong>
                {': '}
                <span style={{ color: '#A63D2F' }}>{i.reason || 'No reason was returned'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {unconfirmed.length > 0 && (
        <div>
          <p style={{ ...muted, margin: '0 0 8px', fontWeight: 600, color: 'var(--t1, #453F39)' }}>
            No response yet
          </p>
          <p style={{ ...muted, margin: '0 0 8px' }}>
            These third parties have not confirmed the sync after 6 minutes:
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {unconfirmed.map((i) => (
              <li key={i.thirdPartySyncId ?? i.name} style={muted}>
                <strong style={{ color: 'var(--t1, #453F39)' }}>{i.name}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p style={{ ...muted, margin: '14px 0 0' }}>
        Resyncing will send the menu again to the affected third party only. Other third-party integrations and devices will remain unchanged.
      </p>
    </Modal>
  );
}
