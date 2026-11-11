import type { SyncEntry, SyncIntegration, SyncStatus } from '../../data/types';

// Pure mapping of GET /sync/history entries to the UI model (kept free of React/context imports so it is unit-testable).

function mapStatus(s: string | undefined | null): SyncStatus {
  const t = (s ?? '').toLowerCase().trim();
  if (t === 'updated') return 'updated';
  if (t === 'failed') return 'failed';
  return 'pending';
}

/** Backend callback values: Waiting | In progress | Completed | Failed (null = no webhook result yet). */
function normalizeIntegrationStatus(v: unknown): 'waiting' | 'in_progress' | 'completed' | 'failed' | null {
  const t = String(v ?? '').toLowerCase().replace(/\s+/g, '_').trim();
  if (t === 'waiting' || t === 'in_progress' || t === 'completed' || t === 'failed') return t;
  return null;
}

function mapDeviceType(t: string | undefined | null): 'pos' | 'kds' | 'kiosk' {
  const u = (t ?? '').toLowerCase();
  if (u.includes('kds') || u.includes('kitchen')) return 'kds';
  if (u.includes('kiosk')) return 'kiosk';
  return 'pos';
}

function parseResponsePayload(payload: unknown): { key: string; value: string }[] {
  if (payload == null) return [];
  if (typeof payload === 'string') return [{ key: 'message', value: payload }];
  if (typeof payload !== 'object' || Array.isArray(payload)) return [];
  const entries: { key: string; value: string }[] = [];
  for (const [key, val] of Object.entries(payload as Record<string, unknown>)) {
    if (val == null) continue;
    const valueStr =
      typeof val === 'string'
        ? val
        : typeof val === 'number' || typeof val === 'boolean'
          ? String(val)
          : JSON.stringify(val);
    if (valueStr.trim()) entries.push({ key, value: valueStr.trim() });
  }
  return entries;
}

export function mapApiEntryToSyncEntry(entry: Record<string, unknown>): SyncEntry {
  const syncHistoryId = String(entry.syncHistoryId ?? entry.id ?? '');
  const ts = String(entry.modifiedTime || entry.createdTime || '') || new Date().toISOString();
  const devicesRaw = Array.isArray(entry.devices) ? entry.devices : [];
  const devices = devicesRaw.map((d: Record<string, unknown>) => {
    const enabled = d.enabled !== false;
    const lastRaw = d.lastUpdated;
    const lastStr =
      typeof lastRaw === 'string' && lastRaw.trim()
        ? lastRaw.trim()
        : lastRaw != null
          ? String(lastRaw).trim()
          : '';
    const lastUpdatedAt =
      enabled && lastStr ? lastStr : undefined;
    return {
      name: String(d.deviceName ?? d.name ?? '-'),
      type: mapDeviceType(String(d.type ?? '')),
      status: mapStatus(String(d.status ?? '')),
      enabled,
      lastUpdatedAt,
    };
  });
  const thirdPartyRaw = Array.isArray(entry.thirdParty) ? entry.thirdParty : [];
  const integrations: SyncIntegration[] = thirdPartyRaw.map((tp: Record<string, unknown>) => {
    const pushStatus = mapStatus(String(tp.status ?? ''));
    const cb = normalizeIntegrationStatus(tp.integrationStatus);
    const tracked = tp.integrationTracked === true;
    const canRetry = tp.canRetry === true;
    const providerFailed = cb === 'failed';
    // KitchenHub accepting our PUT is not the end: for tracked pushes the provider result (webhook) decides.
    let st: SyncStatus = pushStatus;
    let statusLabel: string | undefined;
    let inFlight = false;
    if (pushStatus === 'pending') {
      statusLabel = 'Sending…';
      inFlight = true;
    } else if (pushStatus === 'failed') {
      statusLabel = 'Failed';
    } else if (tracked) {
      if (cb === 'completed') {
        st = 'updated';
        statusLabel = 'Synced';
      } else if (providerFailed) {
        st = 'failed';
        statusLabel = 'Provider rejected';
      } else if (canRetry) {
        st = 'pending';
        statusLabel = 'No confirmation';
      } else {
        st = 'pending';
        statusLabel = 'Sent, waiting for provider';
        inFlight = true;
      }
    }
    const failed = st === 'failed';
    const lastRaw = providerFailed || cb === 'completed' ? tp.integrationUpdated ?? tp.lastUpdated : tp.lastUpdated;
    const lastStr =
      typeof lastRaw === 'string' && lastRaw.trim()
        ? lastRaw.trim()
        : lastRaw != null
          ? String(lastRaw).trim()
          : '';
    const lastUpdatedAt = !failed && lastStr ? lastStr : undefined;
    const providerReason =
      providerFailed && typeof tp.integrationFailedReason === 'string' && tp.integrationFailedReason.trim()
        ? [{ key: 'reason', value: tp.integrationFailedReason.trim() }]
        : [];
    const reasonEntries = providerReason.length > 0 ? providerReason : pushStatus === 'failed' ? parseResponsePayload(tp.responsePayload) : [];
    return {
      name: String(tp.name ?? '-'),
      type: 'delivery',
      status: st,
      lastUpdatedAt,
      ...(reasonEntries.length > 0 ? { reasonEntries } : {}),
      ...(statusLabel ? { statusLabel } : {}),
      ...(typeof tp.thirdPartySyncId === 'string' ? { thirdPartySyncId: tp.thirdPartySyncId } : {}),
      ...(typeof tp.attempt === 'number' ? { attempt: tp.attempt } : {}),
      ...(canRetry ? { canRetry: true } : {}),
      ...(inFlight ? { inFlight: true } : {}),
    };
  });
  const devicesSummary = String(entry.devicesSummary ?? '');
  const thirdPartySummary = String(entry.thirdPartySummary ?? '');
  const changesSummary =
    [thirdPartySummary, devicesSummary].filter(Boolean).join(' · ') || '—';

  return {
    id: syncHistoryId || `sync-${ts}`,
    timestamp: ts,
    overallStatus: mapStatus(String(entry.status ?? '')),
    devices,
    changesSummary,
    devicesSummary,
    thirdPartySummary,
    initiator: String(entry.userName || entry.userId || '') || undefined,
    integrations: integrations.length ? integrations : undefined,
  };
}
