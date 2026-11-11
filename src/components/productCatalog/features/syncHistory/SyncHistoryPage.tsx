import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/ui/EmptyState';
import { CatalogListEmptyState } from '../../components/ui/CatalogListEmptyState';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import PageHeader from '../../components/layout/PageHeader';
import CatalogHelpLink from '../../components/layout/CatalogHelpLink';
import { useSyncHistory } from './useSyncHistory';
import type { SyncDevice, SyncIntegration, SyncStatus } from '../../data/types';
import SyncHistoryTutorial from '../../components/tutorials/sync-history-tutorial';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { useBranch } from '../../../../context/BranchContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import BottomNav from '../../../BottomNav';
import { formatSyncRowInStoreTimeZone } from '../../../../utils/dateTimeUtils';
import {
  getProductCatalogSyncNeeded,
  PRODUCT_CATALOG_SYNC_NEEDED_UPDATED,
  setProductCatalogSyncNeeded,
} from '../../store/syncNeeded';
import { useErrorToast } from '../../hooks/useErrorToast';
import { PC_BASE } from '../../paths';
import {
  SYNC_FAILED_HEADING,
  syncFailedMessage,
  type SyncErrorKind,
} from '../../../../services/syncCatalogApi';

const statusColors: Record<SyncStatus, { dot: string; bg: string; text: string }> = {
  updated: { dot: '#5F7A55', bg: 'rgba(48,164,108,0.08)', text: '#5F7A55' },
  pending: { dot: '#B89550', bg: 'rgba(184,149,80,0.08)', text: '#B89550' },
  failed: { dot: '#A63D2F', bg: 'rgba(166,61,47,0.08)', text: '#A63D2F' },
};

const statusIcons: Record<SyncStatus, string> = {
  updated: 'check_circle',
  pending: 'schedule',
  failed: 'cancel',
};

const deviceIcons: Record<SyncDevice['type'], string> = {
  pos: 'monitor',
  kds: 'tv',
  kiosk: 'tablet',
};

const DEVICE_LIST_MAX_HEIGHT_PX = 450;
const SYNC_COUNTDOWN_WIDTH_PX = 25;

function countUpdated(items: { status: SyncStatus }[]): { updated: number; total: number } {
  const total = items.length;
  const updated = items.filter((x) => x.status === 'updated').length;
  return { updated, total };
}

function showIntegrationReason(integration: SyncIntegration): boolean {
  return integration.status !== 'updated' && (integration.reasonEntries?.length ?? 0) > 0;
}

function IntegrationReasonLines({ integration }: { integration: SyncIntegration }) {
  const entries = integration.reasonEntries;
  if (!entries?.length) return null;
  return (
    <div style={{ fontSize: 11, color: 'var(--t2, #6E665D)', lineHeight: 1.5, paddingLeft: 26 }}>
      {entries.map((e, i) => (
        <div key={i}>
          {e.key.toLowerCase() === 'reason' ? e.value : `${e.key.charAt(0).toUpperCase() + e.key.slice(1)}: ${e.value}`}
        </div>
      ))}
    </div>
  );
}

/** Attempt badge and state label of one third-party channel row (shown right after the name). */
function IntegrationStatusExtras({ integration }: { integration: SyncIntegration }) {
  const color = statusColors[integration.status].text;
  return (
    <>
      {integration.attempt != null && integration.attempt > 1 ? (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#6E665D',
            background: '#F1ECE2',
            borderRadius: 2,
            padding: '1px 6px',
            flexShrink: 0,
          }}
        >
          Attempt {integration.attempt}
        </span>
      ) : null}
      {integration.statusLabel ? (
        <span style={{ fontSize: 11, color, flexShrink: 0 }}>{integration.statusLabel}</span>
      ) : null}
    </>
  );
}

/** True when the row offers Retry. The Retry button then sits at the right end and replaces the status icon. */
function hasRetry(integration: SyncIntegration): boolean {
  return !!(integration.canRetry && integration.thirdPartySyncId);
}

/** Retry button at the right end of a third-party channel row. */
function IntegrationRetryButton({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <button
      type="button"
      disabled={retrying}
      onClick={onRetry}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 10px',
        borderRadius: 2,
        background: 'rgba(184,149,80,0.08)',
        color: '#B89550',
        border: '1px solid rgba(184,149,80,0.2)',
        cursor: retrying ? 'not-allowed' : 'pointer',
        opacity: retrying ? 0.65 : 1,
        flexShrink: 0,
        marginLeft: 'auto',
      }}
    >
      <span className="material-symbols-rounded" style={{ fontSize: 13 }}>refresh</span>
      {retrying ? 'Retrying…' : 'Retry'}
    </button>
  );
}

function getSyncActionLabel(syncBusy: boolean, syncRemainingSeconds: number, actionLabel: 'Sync' | 'Resync') {
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

function SyncHistoryLoadingSkeleton({ mobile }: { mobile: boolean }) {
  const cardCount = mobile ? 3 : 4;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: mobile ? 10 : 12 }}>
      <style>{`
        @keyframes sync-history-shimmer {
          0% { background-position: -220px 0; }
          100% { background-position: calc(220px + 100%) 0; }
        }
      `}</style>
      {Array.from({ length: cardCount }).map((_, idx) => (
        <div
          key={idx}
          style={{
            borderRadius: 2,
            border: '1px solid #E6DFD3',
            background: '#fff',
            padding: mobile ? '12px 14px' : '14px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <div
              style={{
                height: 14,
                width: mobile ? 120 : 160,
                borderRadius: 2,
                background: 'linear-gradient(90deg, #F1ECE2 25%, #E8E0D1 37%, #F1ECE2 63%)',
                backgroundSize: '400% 100%',
                animation: 'sync-history-shimmer 1.25s ease-in-out infinite',
              }}
            />
            <div
              style={{
                height: 24,
                width: 78,
                borderRadius: 999,
                background: 'linear-gradient(90deg, #F1ECE2 25%, #E8E0D1 37%, #F1ECE2 63%)',
                backgroundSize: '400% 100%',
                animation: 'sync-history-shimmer 1.25s ease-in-out infinite',
              }}
            />
          </div>
          <div
            style={{
              height: 11,
              width: mobile ? 90 : 120,
              borderRadius: 2,
              marginBottom: 10,
              background: 'linear-gradient(90deg, #F1ECE2 25%, #E8E0D1 37%, #F1ECE2 63%)',
              backgroundSize: '400% 100%',
              animation: 'sync-history-shimmer 1.25s ease-in-out infinite',
            }}
          />
          <div
            style={{
              height: 12,
              width: mobile ? '82%' : '65%',
              borderRadius: 2,
              marginBottom: 10,
              background: 'linear-gradient(90deg, #F1ECE2 25%, #E8E0D1 37%, #F1ECE2 63%)',
              backgroundSize: '400% 100%',
              animation: 'sync-history-shimmer 1.25s ease-in-out infinite',
            }}
          />
          <div
            style={{
              height: 11,
              width: 86,
              borderRadius: 2,
              background: 'linear-gradient(90deg, #F1ECE2 25%, #E8E0D1 37%, #F1ECE2 63%)',
              backgroundSize: '400% 100%',
              animation: 'sync-history-shimmer 1.25s ease-in-out infinite',
            }}
          />
        </div>
      ))}
    </div>
  );
}

export default function SyncHistoryPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { selectedBranch } = useBranch();
  const storeTimeZone =
    selectedBranch?.timeZoneCd ?? selectedBranch?.timeZone ?? undefined;
  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({ title: 'Sync History', breadcrumbs: 'Product Catalog' });
  }, [setTopBarProps]);

  const formatRowTime = (iso: string) => formatSyncRowInStoreTimeZone(iso, storeTimeZone);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const {
    entries,
    loading: historyLoading,
    error: historyError,
    triggerSync,
    syncBusy,
    syncRemainingSeconds,
    syncCountingDown,
    syncTriggerError,
    syncTriggerErrorKind,
    retryThirdParty,
    retryingIds,
    retryError,
    retryNotice,
  } = useSyncHistory({ refreshOnWatch: true });

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [entries],
  );
  const [syncNeeded, setSyncNeeded] = useState<boolean>(() => getProductCatalogSyncNeeded());
  const [bannerSyncRequested, setBannerSyncRequested] = useState(false);
  const bannerSyncWasBusyRef = useRef(false);
  /** "Sync completed" popup — shown only when every device and integration synced successfully. */
  const [syncCompletedPopup, setSyncCompletedPopup] = useState(false);
  /** "Sync Failed" popup — shown when the sync trigger fails (network vs backend copy). */
  const [syncFailedPopup, setSyncFailedPopup] = useState<{ open: boolean; kind: SyncErrorKind | null }>({
    open: false,
    kind: null,
  });

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

  useErrorToast(historyError);
  useErrorToast(retryError);
  useErrorToast(retryNotice);

  useEffect(() => {
    if (!bannerSyncRequested) return;

    if (syncTriggerError) {
      // Show the adaptive "Sync Failed" popup (network vs backend) instead of a toast.
      setSyncFailedPopup({ open: true, kind: syncTriggerErrorKind });
      bannerSyncWasBusyRef.current = false;
      setBannerSyncRequested(false);
      return;
    }

    if (syncBusy) {
      bannerSyncWasBusyRef.current = true;
      return;
    }

    if (bannerSyncWasBusyRef.current && !historyLoading) {
      bannerSyncWasBusyRef.current = false;
      const allUpdated = (sorted[0]?.overallStatus ?? 'pending') === 'updated';
      setProductCatalogSyncNeeded(false);
      setBannerSyncRequested(false);
      // Show the "Sync completed" popup only when all devices + integrations synced; "Sync pending" is hidden.
      if (allUpdated) setSyncCompletedPopup(true);
    }
  }, [bannerSyncRequested, syncTriggerError, syncTriggerErrorKind, syncBusy, historyLoading, sorted]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Sync flow phases (mirrors the Control Center banner):
  //  - counting down (syncCountingDown): show the "Sync in progress" banner for the 15s window only
  //  - post-countdown history refetch (bannerSyncRequested, not busy): hide the banner
  const inPostCountdownFetch = bannerSyncRequested && !syncBusy;
  // Loading banner is only for the top "Sync" action (bannerSyncRequested); a row-level Resync must not show it.
  const showInProgress = syncCountingDown && bannerSyncRequested;
  const showSyncPending = syncNeeded && !syncCountingDown && !inPostCountdownFetch;

  /** "Sync in progress" banner (matches the Control Center) — shown only while the countdown runs. */
  const renderInProgressBanner = (compact: boolean) => {
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

    return compact ? (
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
  };

  if (isMobile) return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif" }}>
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span onClick={() => navigate(PC_BASE)} className="material-symbols-rounded" style={{ fontSize: 22, color: '#453F39', cursor: 'pointer' }}>arrow_back</span>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: 0 }}>Sync History</h1>
      </div>

      <div style={{ padding: 16 }}>
        {showInProgress ? (
          renderInProgressBanner(true)
        ) : showSyncPending ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(184,149,80,0.06)', border: '1px solid rgba(184,149,80,0.2)', borderRadius: 2, marginBottom: 12 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 20, color: '#B89550', flexShrink: 0 }}>warning</span>
            <span style={{ flex: 1, fontSize: 12, color: '#453F39', fontWeight: 500 }}>
              Things are updated. Please sync to update all connected applications.
            </span>
            <Button
              size="sm"
              disabled={syncBusy || historyLoading}
              onClick={() => {
                setBannerSyncRequested(true);
                triggerSync();
              }}
              icon={<span className="material-symbols-rounded" style={{ fontSize: 16, color: 'rgba(255,255,255,0.95)' }}>sync</span>}
            >
              {getSyncActionLabel(syncBusy, syncRemainingSeconds, 'Sync')}
            </Button>
          </div>
        ) : null}

        {historyError ? (
          <EmptyState title="Could not load sync history" description={historyError} />
        ) : historyLoading ? (
          <SyncHistoryLoadingSkeleton mobile={true} />
        ) : sorted.length === 0 ? (
          <CatalogListEmptyState icon="sync" name="sync events" description="No sync history is available yet." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map((entry, index) => {
              const isExpanded = expandedIds.has(entry.id);
              const sc = statusColors[entry.overallStatus];
              const isLatestSync = index === 0;
              const showResyncForEntry = isLatestSync && entry.overallStatus !== 'updated' && !syncNeeded;

              return (
                <div
                  key={entry.id}
                  style={{
                    background: '#fff',
                    borderRadius: 2,
                    border: '1px solid #E6DFD3',
                    borderLeft: `4px solid ${sc.dot}`,
                    padding: '14px 16px',
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#453F39' }}>{formatRowTime(entry.timestamp)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {showResyncForEntry && (
                        <button
                          type="button"
                          disabled={syncBusy}
                          onClick={() => triggerSync(entry.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '5px 10px',
                            borderRadius: 2,
                            background: 'rgba(184,149,80,0.08)',
                            color: '#B89550',
                            border: '1px solid rgba(184,149,80,0.2)',
                            cursor: syncBusy ? 'not-allowed' : 'pointer',
                            opacity: syncBusy ? 0.65 : 1,
                          }}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>refresh</span>
                          {getSyncActionLabel(syncBusy, syncRemainingSeconds, 'Resync')}
                        </button>
                      )}
                    </div>
                  </div>

                  {entry.initiator && (
                    <p style={{ fontSize: 11, color: '#9A9084', margin: '0 0 4px' }}>by {entry.initiator}</p>
                  )}

                  {/* Toggle details */}
                  <button
                    onClick={() => toggleExpanded(entry.id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 600, color: '#9A9084',
                      background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 0',
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: 16, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>expand_more</span>
                    {isExpanded ? 'Hide details' : 'Show details'}
                  </button>

                  {isExpanded && (
                    <div style={{ marginTop: 12, borderTop: '1px solid #E6DFD3', paddingTop: 12 }}>
                      {entry.integrations && entry.integrations.length > 0 && (
                        <div style={{ width: '100%', minWidth: 0, marginBottom: entry.devices.length > 0 ? 14 : 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#6E665D', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Integrations ({countUpdated(entry.integrations).updated}/{countUpdated(entry.integrations).total})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', minWidth: 0 }}>
                            {entry.integrations.map((integration, iIdx) => {
                              const isc = statusColors[integration.status];
                              const intTime = integration.lastUpdatedAt ? formatRowTime(integration.lastUpdatedAt) : '';
                              const reason = showIntegrationReason(integration);
                              return (
                                <div
                                  key={iIdx}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: reason ? 6 : 0,
                                    width: '100%',
                                    minWidth: 0,
                                    boxSizing: 'border-box',
                                    padding: '8px 12px',
                                    background: '#FDFCF9',
                                    borderRadius: 2,
                                    border: '1px solid #F4F0E8',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className="material-symbols-rounded" style={{ fontSize: 18, color: '#9A9084', flexShrink: 0 }}>cloud_sync</span>
                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{ fontSize: 12, fontWeight: 500, color: '#453F39', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{integration.name}</span>
                                      <IntegrationStatusExtras integration={integration} />
                                      {intTime ? (
                                        <span style={{ fontSize: 11, color: '#9A9084', flexShrink: 0, marginLeft: 'auto' }}>{intTime}</span>
                                      ) : null}
                                    </div>
                                    {hasRetry(integration) ? (
                                      <IntegrationRetryButton
                                        retrying={retryingIds.includes(integration.thirdPartySyncId ?? '') || retryingIds.includes('*')}
                                        onRetry={() => void retryThirdParty(entry.id, integration.thirdPartySyncId ? [integration.thirdPartySyncId] : undefined)}
                                      />
                                    ) : (
                                      <span className="material-symbols-rounded" style={{ fontSize: 16, color: isc.dot, flexShrink: 0 }}>{statusIcons[integration.status]}</span>
                                    )}
                                  </div>
                                  {reason ? <IntegrationReasonLines integration={integration} /> : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div style={{ fontSize: 11, fontWeight: 600, color: '#6E665D', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Devices Synced ({countUpdated(entry.devices).updated}/{countUpdated(entry.devices).total})
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          minHeight: 0,
                          maxHeight: DEVICE_LIST_MAX_HEIGHT_PX,
                          overflowY: 'auto',
                          overflowX: 'hidden',
                          WebkitOverflowScrolling: 'touch',
                          paddingRight: 4,
                        }}
                      >
                        {entry.devices.map((device, dIdx) => {
                          const dsc = statusColors[device.status];
                          const rowTime = device.lastUpdatedAt ? formatRowTime(device.lastUpdatedAt) : '';
                          return (
                            <div key={dIdx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#FDFCF9', borderRadius: 2, border: '1px solid #F4F0E8' }}>
                              <span className="material-symbols-rounded" style={{ fontSize: 18, color: '#9A9084', flexShrink: 0 }}>{deviceIcons[device.type]}</span>
                              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 500, color: '#453F39', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{device.name}</span>
                                {rowTime ? (
                                  <span style={{ fontSize: 11, color: '#9A9084', flexShrink: 0, marginLeft: 'auto' }}>{rowTime}</span>
                                ) : null}
                              </div>
                              <span className="material-symbols-rounded" style={{ fontSize: 16, color: dsc.dot, flexShrink: 0 }}>{statusIcons[device.status]}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
      <Modal
        open={syncCompletedPopup}
        onClose={() => setSyncCompletedPopup(false)}
        title="Sync completed"
        width={460}
        footer={
          <Button size="sm" onClick={() => setSyncCompletedPopup(false)}>
            Close
          </Button>
        }
      >
        <p style={{ margin: 0, fontSize: 13, color: 'var(--t2, #6E665D)', lineHeight: 1.6 }}>
          Sync has been completed in all related applications.
        </p>
      </Modal>
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
    </div>
  );

  return (
    <DesktopLayout>
      <div style={{ padding: 25 }}>
        <PageHeader
          icon={
            <span className="material-symbols-rounded" style={{ fontSize: 24, color: 'rgba(255,255,255,0.95)' }}>
              sync
            </span>
          }
          title="Sync History"
          subtitle="Past 7 days"
          actions={<CatalogHelpLink topic="Sync History" Tutorial={SyncHistoryTutorial} />}
        />
        {showInProgress ? (
          renderInProgressBanner(false)
        ) : showSyncPending ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: 'rgba(184,149,80,0.06)', border: '1px solid rgba(184,149,80,0.2)', borderRadius: 2, marginBottom: 12 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 20, color: '#B89550', flexShrink: 0 }}>
              warning
            </span>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--t1, #453F39)', fontWeight: 500 }}>
              Things are updated. Please sync to update all connected applications.
            </span>
            <Button
              size="sm"
              disabled={syncBusy || historyLoading}
              onClick={() => {
                setBannerSyncRequested(true);
                triggerSync();
              }}
              icon={<span className="material-symbols-rounded" style={{ fontSize: 16, color: 'rgba(255,255,255,0.95)' }}>sync</span>}
            >
              {getSyncActionLabel(syncBusy, syncRemainingSeconds, 'Sync')}
            </Button>
          </div>
        ) : null}

        {historyError ? (
          <EmptyState title="Could not load sync history" description={historyError} />
        ) : historyLoading ? (
          <SyncHistoryLoadingSkeleton mobile={false} />
        ) : sorted.length === 0 ? (
          <CatalogListEmptyState icon="sync" name="sync events" description="No sync history is available yet." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sorted.map((entry, idx) => {
              const isExpanded = expandedIds.has(entry.id);
              const sc = statusColors[entry.overallStatus];
              const isLast = idx === sorted.length - 1;
              const showResyncForEntry = idx === 0 && entry.overallStatus !== 'updated' && !syncNeeded;

              return (
                <div key={entry.id} style={{ display: 'flex', gap: 0, width: '100%', minWidth: 0 }}>
                  {/* Timeline column */}
                  <div
                    style={{
                      width: 40,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flexShrink: 0,
                      position: 'relative',
                    }}
                  >
                    {/* Dot */}
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: sc.dot,
                        marginTop: 18,
                        flexShrink: 0,
                        zIndex: 1,
                        boxShadow: `0 0 0 3px ${sc.dot}22`,
                      }}
                    />
                    {/* Connecting line */}
                    {!isLast && (
                      <div
                        style={{
                          width: 2,
                          flex: 1,
                          background: '#E6DFD3',
                          marginTop: 4,
                        }}
                      />
                    )}
                  </div>

                  {/* Card */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background: 'var(--surface, #FFFFFF)',
                      border: '1px solid #E6DFD3',
                      borderRadius: 2,
                      padding: '14px 18px',
                      marginBottom: isLast ? 0 : 12,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1, #453F39)' }}>
                          {formatRowTime(entry.timestamp)}
                        </span>
                        {entry.initiator && (
                          <span style={{ fontSize: 12, color: 'var(--t3, #9A9084)' }}>
                            by {entry.initiator}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {showResyncForEntry && (
                          <button
                            type="button"
                            disabled={syncBusy}
                            onClick={() => triggerSync(entry.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '4px 10px',
                              borderRadius: 999,
                              background: 'rgba(184,149,80,0.06)',
                              color: 'var(--accent, #B89550)',
                              border: 'none',
                              cursor: syncBusy ? 'not-allowed' : 'pointer',
                              opacity: syncBusy ? 0.6 : 1,
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!syncBusy) e.currentTarget.style.background = 'rgba(184,149,80,0.12)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(184,149,80,0.06)';
                            }}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>refresh</span>
                            {getSyncActionLabel(syncBusy, syncRemainingSeconds, 'Resync')}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Show details toggle */}
                    <button
                      onClick={() => toggleExpanded(entry.id)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 600, color: 'var(--t3, #9A9084)',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        padding: '4px 0',
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent, #B89550)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--t3, #9A9084)'; }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 16, transition: 'transform 0.2s ease', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        expand_more
                      </span>
                      {isExpanded ? 'Hide details' : 'Show details'}
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div
                        style={{
                          marginTop: 12,
                          borderTop: '1px solid #E6DFD3',
                          paddingTop: 12,
                          width: '100%',
                          minWidth: 0,
                          boxSizing: 'border-box',
                        }}
                      >
                        {/* Integrations (third-party): full-width column — show before devices */}
                        {entry.integrations && entry.integrations.length > 0 && (
                          <div
                            style={{
                              width: '100%',
                              minWidth: 0,
                              marginBottom: entry.devices.length > 0 ? 14 : 0,
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2, #6E665D)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              Integrations ({countUpdated(entry.integrations).updated}/{countUpdated(entry.integrations).total})
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                                width: '100%',
                                minWidth: 0,
                              }}
                            >
                              {entry.integrations.map((integration, iIdx) => {
                                const isc = statusColors[integration.status];
                                const intTime = integration.lastUpdatedAt ? formatRowTime(integration.lastUpdatedAt) : '';
                                const reason = showIntegrationReason(integration);
                                const reasonText = reason
                                  ? (integration.reasonEntries ?? [])
                                      .map((e) => (e.key.toLowerCase() === 'reason' ? e.value : `${e.key.charAt(0).toUpperCase() + e.key.slice(1)}: ${e.value}`))
                                      .join(' | ')
                                  : '';
                                return (
                                  <div
                                    key={iIdx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      width: '100%',
                                      minWidth: 0,
                                      boxSizing: 'border-box',
                                      padding: '8px 12px',
                                      background: reason ? 'rgba(166,61,47,0.08)' : '#FDFCF9',
                                      borderRadius: 2,
                                      border: reason ? '1px solid rgba(166,61,47,0.22)' : '1px solid #F4F0E8',
                                    }}
                                  >
                                    <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--t3, #9A9084)', flexShrink: 0 }}>
                                      cloud_sync
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span
                                        style={{
                                          fontSize: 12,
                                          fontWeight: 500,
                                          color: 'var(--t1, #453F39)',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          flexShrink: 0,
                                        }}
                                      >
                                        {integration.name}
                                      </span>
                                      <IntegrationStatusExtras integration={integration} />
                                      {reasonText && integration.statusLabel ? (
                                        <span style={{ fontSize: 11, color: '#A63D2F', flexShrink: 0 }} aria-hidden="true">
                                          •
                                        </span>
                                      ) : null}
                                      {reasonText ? (
                                        <span
                                          style={{
                                            fontSize: 11,
                                            color: '#A63D2F',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            minWidth: 0,
                                          }}
                                          title={reasonText}
                                        >
                                          {reasonText}
                                        </span>
                                      ) : null}
                                      {intTime ? (
                                        <span style={{ fontSize: 11, color: 'var(--t3, #9A9084)', flexShrink: 0, marginLeft: 'auto' }}>
                                          {intTime}
                                        </span>
                                      ) : null}
                                    </div>
                                    {hasRetry(integration) ? (
                                      <IntegrationRetryButton
                                        retrying={retryingIds.includes(integration.thirdPartySyncId ?? '') || retryingIds.includes('*')}
                                        onRetry={() => void retryThirdParty(entry.id, integration.thirdPartySyncId ? [integration.thirdPartySyncId] : undefined)}
                                      />
                                    ) : (
                                      <span className="material-symbols-rounded" style={{ fontSize: 16, color: isc.dot, flexShrink: 0 }}>
                                        {statusIcons[integration.status]}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Devices grid */}
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2, #6E665D)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Devices Synced ({countUpdated(entry.devices).updated}/{countUpdated(entry.devices).total})
                          </div>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(2, 1fr)',
                              gap: 8,
                              minHeight: 0,
                              maxHeight: DEVICE_LIST_MAX_HEIGHT_PX,
                              overflowY: 'auto',
                              overflowX: 'hidden',
                              WebkitOverflowScrolling: 'touch',
                              paddingRight: 4,
                            }}
                          >
                            {entry.devices.map((device, dIdx) => {
                              const dsc = statusColors[device.status];
                              const rowTime = device.lastUpdatedAt ? formatRowTime(device.lastUpdatedAt) : '';
                              return (
                                <div
                                  key={dIdx}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '8px 12px',
                                    background: '#FDFCF9',
                                    borderRadius: 2,
                                    border: '1px solid #F4F0E8',
                                  }}
                                >
                                  <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--t3, #9A9084)', flexShrink: 0 }}>
                                    {deviceIcons[device.type]}
                                  </span>
                                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 500,
                                        color: 'var(--t1, #453F39)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {device.name}
                                    </span>
                                    {rowTime ? (
                                      <span style={{ fontSize: 11, color: 'var(--t3, #9A9084)', flexShrink: 0, marginLeft: 'auto' }}>
                                        {rowTime}
                                      </span>
                                    ) : null}
                                  </div>
                                  <span className="material-symbols-rounded" style={{ fontSize: 16, color: dsc.dot, flexShrink: 0 }}>
                                    {statusIcons[device.status]}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Modal
        open={syncCompletedPopup}
        onClose={() => setSyncCompletedPopup(false)}
        title="Sync completed"
        width={460}
        footer={
          <Button size="sm" onClick={() => setSyncCompletedPopup(false)}>
            Close
          </Button>
        }
      >
        <p style={{ margin: 0, fontSize: 13, color: 'var(--t2, #6E665D)', lineHeight: 1.6 }}>
          Sync has been completed in all related applications.
        </p>
      </Modal>
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
    </DesktopLayout>
  );
}
