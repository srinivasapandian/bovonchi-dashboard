import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { useSyncHistory } from '../../features/syncHistory/useSyncHistory';
import {
  getProductCatalogSyncNeeded,
  PRODUCT_CATALOG_SYNC_NEEDED_UPDATED,
  setProductCatalogSyncNeeded,
} from '../../store/syncNeeded';
import {
  SYNC_FAILED_HEADING,
  syncFailedMessage,
  type SyncErrorKind,
} from '../../../../services/syncCatalogApi';

const BANNER_T1 = '#453F39';
const BANNER_T2 = '#6E665D';

/** Resync ("Sync again") banner is disabled in Control Center — keep only the "Sync" banner. */
const SHOW_RESYNC_BANNER = false;

const SYNC_COUNTDOWN_WIDTH_PX = 25;

function getSyncActionLabel(
  syncBusy: boolean,
  syncRemainingSeconds: number,
  actionLabel: 'Sync' | 'Resync' | 'Sync again',
): ReactNode {
  if (!syncBusy) return actionLabel;
  if (syncRemainingSeconds <= 0) return 'Syncing…';
  return (
    <>
      Syncing{' '}
      <span
        style={{
          display: 'inline-block',
          width: SYNC_COUNTDOWN_WIDTH_PX,
          textAlign: 'left',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        ({syncRemainingSeconds}s)
      </span>
    </>
  );
}

type ResyncBannerPayload = {
  syncHistoryId: string;
  devicesSummary: string;
  thirdPartySummary: string;
  /** Combined line when API does not split devices / integrations */
  changesSummary: string;
};

type ProductCatalogSyncBannerProps = {
  /** Tighter padding / font for mobile control center */
  compact?: boolean;
  syncOnly?: boolean;
};

export function ProductCatalogSyncBanner({ compact, syncOnly }: ProductCatalogSyncBannerProps) {
  const [syncNeeded, setSyncNeeded] = useState<boolean>(() => getProductCatalogSyncNeeded());
  /** Shown after an initial sync finishes with pending/failed devices or integrations */
  const [resyncBanner, setResyncBanner] = useState<ResyncBannerPayload | null>(null);

  const [bannerSyncRequested, setBannerSyncRequested] = useState(false);
  const bannerSyncWasBusyRef = useRef(false);
  /** Tracks whether the in-flight banner action was initial Sync or Resync (with id). */
  const pendingBannerSyncRef = useRef<{ mode: 'initial' } | { mode: 'resync'; syncHistoryId: string } | null>(null);

  /** "Sync completed" popup — shown only when every device and integration synced successfully. */
  const [syncCompletedPopup, setSyncCompletedPopup] = useState<{ open: boolean; clearResyncOnClose?: boolean }>({
    open: false,
  });
  /** "Sync Failed" popup — shown when the sync trigger fails (network vs backend copy). */
  const [syncFailedPopup, setSyncFailedPopup] = useState<{ open: boolean; kind: SyncErrorKind | null }>({
    open: false,
    kind: null,
  });

  const {
    entries,
    loading: historyLoading,
    triggerSync,
    syncBusy,
    syncRemainingSeconds,
    syncCountingDown,
    syncTriggerError,
    syncTriggerErrorKind,
  } = useSyncHistory();

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [entries],
  );

  useEffect(() => {
    const updateSyncNeeded = () => setSyncNeeded(getProductCatalogSyncNeeded());
    updateSyncNeeded();
    window.addEventListener(PRODUCT_CATALOG_SYNC_NEEDED_UPDATED, updateSyncNeeded);
    window.addEventListener('storage', updateSyncNeeded);
    return () => {
      window.removeEventListener(PRODUCT_CATALOG_SYNC_NEEDED_UPDATED, updateSyncNeeded);
      window.removeEventListener('storage', updateSyncNeeded);
    };
  }, []);

  useEffect(() => {
    if (!bannerSyncRequested) return;

    if (syncTriggerError) {
      // Show the adaptive "Sync Failed" popup (network vs backend) instead of a toast.
      setSyncFailedPopup({ open: true, kind: syncTriggerErrorKind });
      bannerSyncWasBusyRef.current = false;
      pendingBannerSyncRef.current = null;
      setBannerSyncRequested(false);
      return;
    }

    if (syncBusy) {
      bannerSyncWasBusyRef.current = true;
      return;
    }

    if (bannerSyncWasBusyRef.current && !historyLoading) {
      bannerSyncWasBusyRef.current = false;
      const latest = sorted[0];
      const latestStatus = latest?.overallStatus ?? 'pending';
      const allUpdated = latestStatus === 'updated';
      const pending = pendingBannerSyncRef.current;
      pendingBannerSyncRef.current = null;
      setBannerSyncRequested(false);

      if (syncOnly) {
        setProductCatalogSyncNeeded(false);
        return;
      }

      // Control Center: hide the sync banner as soon as the sync countdown finishes.
      setProductCatalogSyncNeeded(false);

      if (pending?.mode === 'resync') {
        if (!allUpdated && latest) {
          setResyncBanner({
            syncHistoryId: latest.id,
            devicesSummary: latest.devicesSummary,
            thirdPartySummary: latest.thirdPartySummary,
            changesSummary: latest.changesSummary,
          });
        }
        if (allUpdated) {
          setResyncBanner(null);
          // All devices + integrations synced — show the "Sync completed" confirmation.
          setSyncCompletedPopup({ open: true, clearResyncOnClose: true });
        }
        return;
      }

      // initial sync from catalog-change banner
      if (!allUpdated && latest) {
        setResyncBanner({
          syncHistoryId: latest.id,
          devicesSummary: latest.devicesSummary,
          thirdPartySummary: latest.thirdPartySummary,
          changesSummary: latest.changesSummary,
        });
      } else if (allUpdated) {
        setResyncBanner(null);
        // All devices + integrations synced — show the "Sync completed" confirmation.
        setSyncCompletedPopup({ open: true });
      }
    }
  }, [bannerSyncRequested, syncTriggerError, syncTriggerErrorKind, syncBusy, historyLoading, sorted, syncOnly]);

  const handleCloseSyncCompletedPopup = () => {
    if (syncCompletedPopup.clearResyncOnClose) {
      setResyncBanner(null);
    }
    setSyncCompletedPopup({ open: false });
  };

  // Sync flow phases (a banner-initiated sync keeps bannerSyncRequested = true until it settles):
  //  - pre-success (syncBusy, not counting down): keep the normal "Sync" banner (button shows "Syncing…")
  //  - counting down (syncCountingDown): show the "Sync in progress" banner for the 15s window only
  //  - post-countdown history refetch (bannerSyncRequested, not busy): hide the banner entirely
  const inPostCountdownFetch = bannerSyncRequested && !syncBusy;
  const showInProgress = syncCountingDown;
  const showResync =
    !syncOnly &&
    SHOW_RESYNC_BANNER &&
    resyncBanner != null &&
    !syncNeeded &&
    !syncCountingDown &&
    !inPostCountdownFetch;
  const showSyncPending = syncNeeded && !syncCountingDown && !inPostCountdownFetch;

  // "Sync in progress" banner shown while a sync is running; it auto-hides when the countdown ends.
  const syncingPill = (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: compact ? '6px 12px' : '8px 16px',
        background: '#D9A99F',
        color: '#FFFFFF',
        borderRadius: 2,
        fontSize: compact ? 12 : 13,
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        alignSelf: compact ? 'flex-end' : undefined,
      }}
    >
      <span className="material-symbols-rounded" style={{ fontSize: 16, animation: 'pc-sync-spin 1.4s linear infinite' }}>
        sync
      </span>
      {syncRemainingSeconds > 0 ? `Syncing (${syncRemainingSeconds}s)` : 'Syncing…'}
    </div>
  );

  const inProgressBanner = compact ? (
    // Mobile: inline icon + heading, description below, pill stacked bottom-right.
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 12,
        padding: '14px 16px',
        background: '#F7EFDF',
        border: '1px solid #E9D8B5',
        borderRadius: 2,
        marginBottom: 10,
      }}
    >
      <style>{`@keyframes pc-sync-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span
            className="material-symbols-rounded"
            style={{ fontSize: 20, color: '#A63D2F', animation: 'pc-sync-spin 1.4s linear infinite', flexShrink: 0 }}
          >
            sync
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1, #453F39)', fontFamily: 'var(--font-primary)' }}>
            Sync in progress
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--t2, #6E665D)', fontFamily: 'var(--font-primary)', lineHeight: 1.5 }}>
          Your changes are syncing to all connected devices and integrations. This usually takes 1-2
          minutes and completes in the background, You can keep working.
        </div>
      </div>
      {syncingPill}
    </div>
  ) : (
    // Desktop: circular badge on the left, text block, pill on the right (original layout).
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 20px',
        background: '#F7EFDF',
        border: '1px solid #E9D8B5',
        borderRadius: 2,
        marginBottom: 12,
      }}
    >
      <style>{`@keyframes pc-sync-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: '#FFFFFF',
          border: '1px solid #E9D8B5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span
          className="material-symbols-rounded"
          style={{ fontSize: 24, color: '#A63D2F', animation: 'pc-sync-spin 1.4s linear infinite' }}
        >
          sync
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--t1, #453F39)',
            fontFamily: 'var(--font-primary)',
            marginBottom: 4,
          }}
        >
          Sync in progress
        </div>
        <div style={{ fontSize: 13, color: 'var(--t2, #6E665D)', fontFamily: 'var(--font-primary)', lineHeight: 1.5 }}>
          Your changes are syncing to all connected devices and integrations. This usually takes 1-2
          minutes and completes in the background, You can keep working.
        </div>
      </div>
      {syncingPill}
    </div>
  );

  const syncFailedModal = (
    <Modal
      open={syncFailedPopup.open}
      onClose={() => setSyncFailedPopup({ open: false, kind: null })}
      title={SYNC_FAILED_HEADING}
      width={460}
      footer={
        <Button size="sm" onClick={() => setSyncFailedPopup({ open: false, kind: null })}>
          Close
        </Button>
      }
    >
      <p style={{ margin: 0, fontSize: 13, color: 'var(--t2, #6E665D)', lineHeight: 1.6 }}>
        {syncFailedMessage(syncFailedPopup.kind)}
      </p>
    </Modal>
  );

  if (syncOnly) {
    return (
      <>
        {showInProgress ? inProgressBanner : !showSyncPending ? null : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
          gap: compact ? 10 : 12,
          padding: compact ? '10px 14px' : '12px 18px',
          background: 'rgba(184,149,80,0.06)',
          border: '1px solid rgba(184,149,80,0.2)',
          borderRadius: 2,
          marginBottom: compact ? 10 : 12,
        }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: compact ? 18 : 20, color: '#B89550', flexShrink: 0 }}>
          warning
        </span>
        <span
          style={{
            flex: 1,
            fontSize: compact ? 12 : 13,
            color: 'var(--t1, #453F39)',
            fontWeight: 500,
            fontFamily: 'var(--font-primary)',
          }}
        >
          Things are updated. Please sync to update all connected applications.
        </span>
        <Button
          size="sm"
          disabled={syncBusy || historyLoading}
          onClick={() => {
            pendingBannerSyncRef.current = { mode: 'initial' };
            setBannerSyncRequested(true);
            triggerSync();
          }}
          icon={
            <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'rgba(255,255,255,0.95)' }}>
              sync
            </span>
          }
        >
          {getSyncActionLabel(syncBusy, syncRemainingSeconds, 'Sync')}
        </Button>
      </div>
        )}
        {syncFailedModal}
      </>
    );
  }

  return (
    <>
      {showInProgress ? (
        inProgressBanner
      ) : showResync ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: compact ? 8 : 10,
            padding: compact ? '10px 14px' : '12px 18px',
            background: 'rgba(166,61,47,0.06)',
            border: '1px solid rgba(166,61,47,0.22)',
            borderRadius: 2,
            marginBottom: compact ? 10 : 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 10 : 12 }}>
            <span
              className="material-symbols-rounded"
              style={{ fontSize: compact ? 18 : 20, color: '#A63D2F', flexShrink: 0 }}
            >
              sync_problem
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: compact ? 12 : 13,
                  color: 'var(--t1, #453F39)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  marginBottom: 6,
                }}
              >
                Sync did not finish on all devices or integrations
              </div>
              {resyncBanner.thirdPartySummary ? (
                <div style={{ fontSize: compact ? 11 : 12, color: BANNER_T2, fontFamily: 'var(--font-primary)', lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 600, color: BANNER_T1 }}>Integrations: </span>
                  {resyncBanner.thirdPartySummary}
                </div>
              ) : null}
              {resyncBanner.devicesSummary ? (
                <div
                  style={{
                    fontSize: compact ? 11 : 12,
                    color: BANNER_T2,
                    fontFamily: 'var(--font-primary)',
                    lineHeight: 1.45,
                    marginTop: resyncBanner.thirdPartySummary ? 4 : 0,
                  }}
                >
                  <span style={{ fontWeight: 600, color: BANNER_T1 }}>Devices: </span>
                  {resyncBanner.devicesSummary}
                </div>
              ) : null}
              {!resyncBanner.thirdPartySummary?.trim() && !resyncBanner.devicesSummary?.trim() && resyncBanner.changesSummary?.trim() ? (
                <div style={{ fontSize: compact ? 11 : 12, color: BANNER_T2, fontFamily: 'var(--font-primary)', lineHeight: 1.45, marginTop: 4 }}>
                  {resyncBanner.changesSummary}
                </div>
              ) : null}
            </div>
            <Button
              size="sm"
              disabled={syncBusy || historyLoading}
              onClick={() => {
                pendingBannerSyncRef.current = { mode: 'resync', syncHistoryId: resyncBanner.syncHistoryId };
                setBannerSyncRequested(true);
                triggerSync(resyncBanner.syncHistoryId);
              }}
              icon={
                <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'rgba(255,255,255,0.95)' }}>
                  sync
                </span>
              }
            >
              {getSyncActionLabel(syncBusy, syncRemainingSeconds, 'Sync again')}
            </Button>
          </div>
        </div>
      ) : showSyncPending ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: compact ? 10 : 12,
            padding: compact ? '10px 14px' : '12px 18px',
            background: 'rgba(184,149,80,0.06)',
            border: '1px solid rgba(184,149,80,0.2)',
            borderRadius: 2,
            marginBottom: compact ? 10 : 12,
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: compact ? 18 : 20, color: '#B89550', flexShrink: 0 }}>
            warning
          </span>
          <span
            style={{
              flex: 1,
              fontSize: compact ? 12 : 13,
              color: 'var(--t1, #453F39)',
              fontWeight: 500,
              fontFamily: 'var(--font-primary)',
            }}
          >
            Things are updated. Please sync to update all connected applications.
          </span>
          <Button
            size="sm"
            disabled={syncBusy || historyLoading}
            onClick={() => {
              pendingBannerSyncRef.current = { mode: 'initial' };
              setBannerSyncRequested(true);
              triggerSync();
            }}
            icon={
              <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'rgba(255,255,255,0.95)' }}>
                sync
              </span>
            }
          >
            {getSyncActionLabel(syncBusy, syncRemainingSeconds, 'Sync')}
          </Button>
        </div>
      ) : null}

      <Modal
        open={syncCompletedPopup.open}
        onClose={handleCloseSyncCompletedPopup}
        title="Sync completed"
        width={460}
        footer={
          <Button size="sm" onClick={handleCloseSyncCompletedPopup}>
            Close
          </Button>
        }
      >
        <p style={{ margin: 0, fontSize: 13, color: 'var(--t2, #6E665D)', lineHeight: 1.6 }}>
          Sync has been completed in all related applications.
        </p>
      </Modal>

      {syncFailedModal}
    </>
  );
}
