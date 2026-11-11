import type { SyncEntry, SyncIntegration } from '../../data/types';

/**
 * After a sync starts, read GET /sync/history at these times (measured from the trigger): 2, 4 and 6 minutes.
 * (For testing, shorten these values; the tests do not depend on them.)
 */
export const SYNC_CHECK_SCHEDULE_MS: readonly number[] = [2 * 60 * 1000, 4 * 60 * 1000, 6 * 60 * 1000];
export const SYNC_MAX_CHECKS = SYNC_CHECK_SCHEDULE_MS.length;

/** How long to wait from now until check number `checkIndex` (0-based), given the time already elapsed. */
export function nextCheckDelayMs(checkIndex: number, elapsedMs: number): number {
  const at = SYNC_CHECK_SCHEDULE_MS[Math.min(checkIndex, SYNC_MAX_CHECKS - 1)];
  return Math.max(0, at - elapsedMs);
}

/**
 * A history read from any page at any time during the watch: before the 6 minute mark it only reports failures
 * (check 0); from the 6 minute mark on it also decides "no response" (the last check).
 */
export function checkNoForElapsed(elapsedMs: number): number {
  return elapsedMs >= SYNC_CHECK_SCHEDULE_MS[SYNC_MAX_CHECKS - 1] ? SYNC_MAX_CHECKS : 0;
}

/** A history read this recent is reused by the scheduled check instead of calling the API again. */
export const FRESH_HISTORY_MS = Math.min(
  60 * 1000,
  Math.min(...SYNC_CHECK_SCHEDULE_MS.map((t, i) => t - (SYNC_CHECK_SCHEDULE_MS[i - 1] ?? 0))) / 2,
);

export interface SyncIssue {
  /** Third-party channel name, e.g. DoorDash. */
  name: string;
  /** Row id of the latest attempt; used to Resync just this channel. */
  thirdPartySyncId?: string;
  /** Why it failed (KitchenHub / provider reason). Empty for channels that did not answer. */
  reason?: string;
}

export interface SyncCheckResult {
  /** Third parties that failed, with the reason. */
  failed: SyncIssue[];
  /** Still pending at the last check (6 minutes): no answer, offer Resync. */
  unconfirmed: SyncIssue[];
  /** Every third party is final (synced or failed). */
  allFinal: boolean;
  /** Show the popup. Success alone never shows one. */
  show: boolean;
  /** No more checks needed. */
  stop: boolean;
}

/** Best human-readable reason of a third-party row (prefers the `reason` entry). */
export function integrationReason(integration: SyncIntegration): string {
  const entries = integration.reasonEntries ?? [];
  const reason = entries.find((e) => e.key.toLowerCase() === 'reason');
  if (reason?.value) return reason.value;
  return entries.map((e) => e.value).filter(Boolean).join(' | ');
}

/**
 * Decide what to tell the user after check number `checkNo` (1-based) of the latest sync:
 * - any third party failed        -> popup with the failed ones and why
 * - still pending at the last check -> popup offering Resync for those
 * - everything succeeded          -> nothing to show
 */
export function evaluateSyncCheck(
  latest: SyncEntry | undefined,
  checkNo: number,
  maxChecks: number = SYNC_MAX_CHECKS,
): SyncCheckResult {
  const integrations = latest?.integrations ?? [];
  const toIssue = (i: SyncIntegration, withReason: boolean): SyncIssue => ({
    name: i.name,
    thirdPartySyncId: i.thirdPartySyncId,
    ...(withReason ? { reason: integrationReason(i) || undefined } : {}),
  });

  const failed = integrations.filter((i) => i.status === 'failed').map((i) => toIssue(i, true));
  const pending = integrations.filter((i) => i.status === 'pending');
  const lastCheck = checkNo >= maxChecks;
  const unconfirmed = lastCheck ? pending.map((i) => toIssue(i, false)) : [];
  const allFinal = pending.length === 0;

  return {
    failed,
    unconfirmed,
    allFinal,
    show: failed.length > 0 || unconfirmed.length > 0,
    stop: allFinal || lastCheck,
  };
}

/** Stable key of what the popup shows, so a dismissed popup is not re-opened for the same content. */
export function issuesKey(result: Pick<SyncCheckResult, 'failed' | 'unconfirmed'>): string {
  const f = result.failed.map((i) => `f:${i.thirdPartySyncId ?? i.name}`);
  const u = result.unconfirmed.map((i) => `u:${i.thirdPartySyncId ?? i.name}`);
  return [...f, ...u].sort().join('|');
}
