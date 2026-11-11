/**
 * Tiny module-level bus between the places that start a sync (trigger saga, Resync) and the app-wide
 * sync watcher (ProductCatalogSyncResultWatcher), and from the watcher back to the Sync History page.
 * Kept free of React so the saga can use it.
 */

import type { SyncEntry } from '../../data/types';

type Listener = () => void;
type EntriesListener = (entries: SyncEntry[]) => void;

const watchRequested = new Set<Listener>();
const historyRefreshed = new Set<EntriesListener>();
const historyLoaded = new Set<EntriesListener>();

function subscribe<T extends Listener | EntriesListener>(set: Set<T>, cb: T): () => void {
  set.add(cb);
  return () => {
    set.delete(cb);
  };
}

/** A sync (or a Resync of some third parties) was just started: begin the 2 / 4 / 6 minute result checks. */
export function requestSyncWatch(): void {
  watchRequested.forEach((cb) => cb());
}
export function onSyncWatchRequested(cb: Listener): () => void {
  return subscribe(watchRequested, cb);
}

/**
 * Every history read by any page (right after a trigger, or when a page opens) is passed to the watcher. If the
 * result is already visible there (everything final, or a failure), the watcher uses it at once and does not need
 * its own 2 / 4 / 6 minute calls. No extra request.
 */
export function publishHistoryLoaded(entries: SyncEntry[]): void {
  historyLoaded.forEach((cb) => cb(entries));
}
export function onHistoryLoaded(cb: EntriesListener): () => void {
  return subscribe(historyLoaded, cb);
}

/** The watcher itself read GET /sync/history; the Sync History page shows the same entries without calling again. */
export function emitSyncHistoryRefreshed(entries: SyncEntry[]): void {
  historyRefreshed.forEach((cb) => cb(entries));
}
export function onSyncHistoryRefreshed(cb: EntriesListener): () => void {
  return subscribe(historyRefreshed, cb);
}
