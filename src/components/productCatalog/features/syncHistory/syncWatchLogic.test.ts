import type { SyncEntry, SyncIntegration } from '../../data/types';
import {
  SYNC_CHECK_SCHEDULE_MS,
  SYNC_MAX_CHECKS,
  nextCheckDelayMs,
  checkNoForElapsed,
  evaluateSyncCheck,
  integrationReason,
  issuesKey,
} from './syncWatchLogic';

const integ = (over: Partial<SyncIntegration>): SyncIntegration => ({
  name: 'DoorDash',
  type: 'delivery',
  status: 'updated',
  thirdPartySyncId: 'row-1',
  ...over,
});

const entry = (integrations: SyncIntegration[]): SyncEntry => ({
  id: 'h1',
  timestamp: '2026-10-15T10:00:00Z',
  overallStatus: 'pending',
  devices: [],
  changesSummary: '',
  devicesSummary: '',
  thirdPartySummary: '',
  integrations,
});

describe('sync result watch (2 / 4 / 6 minute checks)', () => {
  it('checks 3 times, at increasing times after the trigger (2, 4, 6 minutes in production; 30, 60, 120 s while testing)', () => {
    expect(SYNC_MAX_CHECKS).toBe(3);
    expect(SYNC_CHECK_SCHEDULE_MS).toHaveLength(3);
    expect(SYNC_CHECK_SCHEDULE_MS[0]).toBeLessThan(SYNC_CHECK_SCHEDULE_MS[1]);
    expect(SYNC_CHECK_SCHEDULE_MS[1]).toBeLessThan(SYNC_CHECK_SCHEDULE_MS[2]);
  });

  it('waits until each scheduled time, measured from the trigger', () => {
    const [t1, t2, t3] = SYNC_CHECK_SCHEDULE_MS;
    expect(nextCheckDelayMs(0, 0)).toBe(t1);
    expect(nextCheckDelayMs(1, t1 + 50)).toBe(t2 - t1 - 50);
    expect(nextCheckDelayMs(2, t2)).toBe(t3 - t2);
    expect(nextCheckDelayMs(0, t3 * 2)).toBe(0); // already past: run now
  });

  it('shows nothing when every third party succeeded (success needs no popup)', () => {
    const r = evaluateSyncCheck(entry([integ({}), integ({ name: 'UberEats', thirdPartySyncId: 'row-2' })]), 1);
    expect(r.show).toBe(false);
    expect(r.allFinal).toBe(true);
    expect(r.stop).toBe(true);
  });

  it('lists the failed third parties with their reason as soon as one is found', () => {
    const r = evaluateSyncCheck(
      entry([
        integ({ status: 'failed', reasonEntries: [{ key: 'reason', value: 'Item price missing' }] }),
        integ({ name: 'UberEats', thirdPartySyncId: 'row-2' }),
      ]),
      1,
    );
    expect(r.show).toBe(true);
    expect(r.failed).toEqual([{ name: 'DoorDash', thirdPartySyncId: 'row-1', reason: 'Item price missing' }]);
    expect(r.unconfirmed).toEqual([]);
    expect(r.stop).toBe(true); // everything is final: no further checks
  });

  it('keeps checking while a third party is still pending (checks 1 and 2)', () => {
    const e = entry([integ({ status: 'pending', inFlight: true })]);
    for (const checkNo of [1, 2]) {
      const r = evaluateSyncCheck(e, checkNo);
      expect(r.show).toBe(false);
      expect(r.stop).toBe(false);
    }
  });

  it('at the 6 minute check, still pending means no response: offer Resync for those', () => {
    const r = evaluateSyncCheck(
      entry([integ({ status: 'pending', inFlight: true }), integ({ name: 'UberEats', thirdPartySyncId: 'row-2' })]),
      3,
    );
    expect(r.show).toBe(true);
    expect(r.unconfirmed).toEqual([{ name: 'DoorDash', thirdPartySyncId: 'row-1' }]);
    expect(r.stop).toBe(true);
  });

  it('reports failed and unconfirmed together at the last check', () => {
    const r = evaluateSyncCheck(
      entry([
        integ({ status: 'failed', reasonEntries: [{ key: 'reason', value: 'KitchenHub auth failed' }] }),
        integ({ name: 'GrubHub', thirdPartySyncId: 'row-3', status: 'pending' }),
      ]),
      3,
    );
    expect(r.failed.map((i) => i.name)).toEqual(['DoorDash']);
    expect(r.unconfirmed.map((i) => i.name)).toEqual(['GrubHub']);
  });

  it('handles no sync / no third parties', () => {
    expect(evaluateSyncCheck(undefined, 1).show).toBe(false);
    expect(evaluateSyncCheck(entry([]), 1).stop).toBe(true);
  });

  it('uses the reason entry, else joins the available text', () => {
    expect(integrationReason(integ({ reasonEntries: [{ key: 'body', value: 'x' }, { key: 'Reason', value: 'bad' }] }))).toBe('bad');
    expect(integrationReason(integ({ reasonEntries: [{ key: 'a', value: 'one' }, { key: 'b', value: 'two' }] }))).toBe('one | two');
    expect(integrationReason(integ({}))).toBe('');
  });

  it('gives a stable key so a dismissed popup is not re-opened for the same content', () => {
    const a = evaluateSyncCheck(entry([integ({ status: 'failed' })]), 1);
    const b = evaluateSyncCheck(entry([integ({ status: 'failed' })]), 2);
    expect(issuesKey(a)).toBe(issuesKey(b));
    const c = evaluateSyncCheck(entry([integ({ status: 'pending' })]), 3);
    expect(issuesKey(c)).not.toBe(issuesKey(a));
  });

  it("the early look (right after the trigger) shows failures but never decides no response", () => {
    const r = evaluateSyncCheck(
      entry([
        integ({ status: "failed", reasonEntries: [{ key: "reason", value: "Missing KitchenHub storeId" }] }),
        integ({ name: "Gloriafood", thirdPartySyncId: "row-2", status: "pending" }),
      ]),
      0,
    );
    expect(r.show).toBe(true);
    expect(r.failed).toEqual([{ name: "DoorDash", thirdPartySyncId: "row-1", reason: "Missing KitchenHub storeId" }]);
    expect(r.unconfirmed).toEqual([]);
    expect(r.allFinal).toBe(false); // Gloriafood is still sending, so later checks continue
  });

  it("a history read by any page counts as the last check only from the 6 minute mark", () => {
    const last = SYNC_CHECK_SCHEDULE_MS[SYNC_MAX_CHECKS - 1]; // 6 minutes in production
    expect(checkNoForElapsed(0)).toBe(0);
    expect(checkNoForElapsed(last / 2)).toBe(0);
    expect(checkNoForElapsed(last - 1)).toBe(0);
    expect(checkNoForElapsed(last)).toBe(3);
  });

  it("a page read before 2 minutes that shows everything final ends the watch with no more calls", () => {
    const allPassed = evaluateSyncCheck(entry([integ({}), integ({ name: "UberEats", thirdPartySyncId: "row-2" })]), checkNoForElapsed(1));
    expect(allPassed.show).toBe(false);
    expect(allPassed.stop).toBe(true);
    const oneFailed = evaluateSyncCheck(entry([integ({ status: "failed" }), integ({ name: "UberEats", thirdPartySyncId: "row-2" })]), checkNoForElapsed(1));
    expect(oneFailed.show).toBe(true);
    expect(oneFailed.stop).toBe(true);
  });
});
