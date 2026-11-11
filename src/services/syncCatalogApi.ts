import { axiosFetch as authFetch } from './axiosFetch';
import { CREDENTIALS } from '../constants';
import { messageFromRevampErrorBody } from '../utils/revampApiErrorMessage';

const REVAMP_BASE = (process.env.REACT_APP_API_ENDPOINT_REVAMP || '').replace(/\/$/, '');

/** 'network' = request never reached the server; 'server' = backend responded with an error status. */
export type SyncErrorKind = 'network' | 'server';

export class SyncTriggerError extends Error {
  kind: SyncErrorKind;
  constructor(kind: SyncErrorKind, message: string) {
    super(message);
    this.name = 'SyncTriggerError';
    this.kind = kind;
  }
}

/** Heading shown on the sync-trigger failure popup. */
export const SYNC_FAILED_HEADING = 'Sync Failed';

/** Adaptive body copy for the sync-trigger failure popup based on the error kind. */
export function syncFailedMessage(kind: SyncErrorKind | null): string {
  return kind === 'network'
    ? "We couldn't complete the sync at this time. Please check your internet connection and try again."
    : "We couldn't complete the sync at this time. Please try again in a few moments.";
}

function getRevampToken(passedToken?: string | null): string | null {
  if (passedToken && typeof passedToken === 'string' && passedToken.trim()) return passedToken.trim();
  try {
    const raw = localStorage.getItem(CREDENTIALS);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    const cred = stored?.credentials ?? stored;
    const t =
      cred?.accessToken ??
      cred?.access_token ??
      cred?.token ??
      cred?.idToken ??
      cred?.id_token ??
      cred?.jwtToken ??
      cred?.jwt;
    return t && typeof t === 'string' && t.trim() ? t.trim() : null;
  } catch {
    return null;
  }
}

export async function getSyncHistoryApi(
  locationId: string,
  token?: string | null
): Promise<{ entries?: unknown[] }> {
  const authToken = getRevampToken(token);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-compress-response': '1',
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  const url = `${REVAMP_BASE}/api/v1/sync/history?locationId=${encodeURIComponent(locationId)}`;
  const res = await fetch(url, { headers });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(messageFromRevampErrorBody(data, 'Failed to fetch sync history'));
  }
  return data as { entries?: unknown[] };
}

export interface RetryThirdPartyPayload {
  locationId: string;
  userId: string;
  syncHistoryId: string;
  /** Row ids (thirdPartySyncId) of the channels to retry; omit to retry every retryable channel. */
  thirdPartySyncIds?: string[];
}

export interface RetryThirdPartyResult {
  syncHistoryId: string;
  retried: { name: string; thirdPartySyncId: string; attempt: number }[];
  skipped: { name: string; reason: string }[];
}

/** Retry only the failed third-party channel(s) of a sync (same history, new attempt, no device notification). */
export async function retryThirdPartySyncApi(
  payload: RetryThirdPartyPayload,
  token?: string | null
): Promise<RetryThirdPartyResult> {
  const authToken = getRevampToken(token);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  const res = await authFetch(`${REVAMP_BASE}/api/v1/sync/third-party/retry`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(messageFromRevampErrorBody(data, 'Failed to retry sync'));
  }
  return data as unknown as RetryThirdPartyResult;
}

export interface TriggerSyncPayload {
  locationId: string;
  userId: string;
  syncHistoryId?: string;
}

export async function triggerSyncApi(
  payload: TriggerSyncPayload,
  token?: string | null
): Promise<unknown> {
  const authToken = getRevampToken(token);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  let res: Response;
  try {
    res = await authFetch(`${REVAMP_BASE}/api/v1/sync/trigger`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // Request never reached the server (offline, DNS, timeout, CORS/preflight, etc.).
    throw new SyncTriggerError('network', e instanceof Error ? e.message : 'Network error');
  }
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    // Backend responded with an error status.
    throw new SyncTriggerError('server', messageFromRevampErrorBody(data, 'Failed to trigger sync'));
  }
  return data;
}
