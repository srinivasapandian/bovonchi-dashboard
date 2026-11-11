import { mapApiEntryToSyncEntry } from './syncHistoryMapper';

const tp = (over: Record<string, unknown>) => ({
  name: 'DoorDash',
  status: 'Updated',
  lastUpdated: '2026-10-14T10:00:05Z',
  responsePayload: {},
  integrationTracked: true,
  integrationStatus: null,
  integrationFailedReason: null,
  integrationUpdated: null,
  thirdPartySyncId: 'row-1',
  attempt: 1,
  canRetry: false,
  attempts: [],
  ...over,
});

const entry = (thirdParty: unknown[]) =>
  mapApiEntryToSyncEntry({
    syncHistoryId: 'h1',
    createdTime: '2026-10-14T10:00:00Z',
    modifiedTime: '2026-10-14T10:00:00Z',
    status: 'Pending',
    devices: [],
    thirdParty,
  });

const first = (over: Record<string, unknown>) => entry([tp(over)]).integrations![0];

describe('mapApiEntryToSyncEntry – third-party channel state', () => {
  it('is "Synced" only when the provider reported completed', () => {
    const i = first({ integrationStatus: 'Completed', integrationUpdated: '2026-10-14T10:00:40Z' });
    expect(i.status).toBe('updated');
    expect(i.statusLabel).toBe('Synced');
    expect(i.inFlight).toBeUndefined();
  });

  it('is pending and polls while KitchenHub accepted but the provider has not answered', () => {
    for (const cb of [null, 'Waiting', 'In progress']) {
      const i = first({ integrationStatus: cb });
      expect(i.status).toBe('pending');
      expect(i.statusLabel).toBe('Sent, waiting for provider');
      expect(i.inFlight).toBe(true);
    }
  });

  it('shows the provider rejection with its reason and offers retry', () => {
    const i = first({ integrationStatus: 'Failed', integrationFailedReason: 'Item price missing', canRetry: true });
    expect(i.status).toBe('failed');
    expect(i.statusLabel).toBe('Provider rejected');
    expect(i.reasonEntries).toEqual([{ key: 'reason', value: 'Item price missing' }]);
    expect(i.canRetry).toBe(true);
    expect(i.thirdPartySyncId).toBe('row-1');
  });

  it('shows "No confirmation" (not polling) when no webhook arrived and the backend allows a retry', () => {
    const i = first({ integrationStatus: null, canRetry: true });
    expect(i.status).toBe('pending');
    expect(i.statusLabel).toBe('No confirmation');
    expect(i.inFlight).toBeUndefined();
    expect(i.canRetry).toBe(true);
  });

  it('treats our own failed PUT as failed with the KitchenHub reason', () => {
    const i = first({ status: 'Failed', responsePayload: { reason: 'KitchenHub auth failed' }, canRetry: true });
    expect(i.status).toBe('failed');
    expect(i.statusLabel).toBe('Failed');
    expect(i.reasonEntries).toEqual([{ key: 'reason', value: 'KitchenHub auth failed' }]);
  });

  it('shows "Sending…" while our PUT is still pending', () => {
    const i = first({ status: 'Pending' });
    expect(i.status).toBe('pending');
    expect(i.statusLabel).toBe('Sending…');
    expect(i.inFlight).toBe(true);
  });

  it('leaves old syncs (no webhook tracking) exactly as before: Updated stays Updated', () => {
    const i = first({ integrationTracked: false, integrationStatus: null });
    expect(i.status).toBe('updated');
    expect(i.statusLabel).toBeUndefined();
    expect(i.inFlight).toBeUndefined();
  });

  it('shows the attempt number of a retried channel', () => {
    expect(first({ attempt: 2 }).attempt).toBe(2);
  });
});
