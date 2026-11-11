const INTERNET_ERROR_MESSAGE = 'Internet connection issue. Please check your network and try again.';
const nativeFetch = globalThis.fetch.bind(globalThis);

function isLikelyNetworkFailure(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed') ||
    normalized.includes('err_internet_disconnected') ||
    normalized.includes('load failed')
  );
}

export function normalizeApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return INTERNET_ERROR_MESSAGE;
  }
  if (error instanceof Error) {
    const raw = String(error.message ?? '').trim();
    if (!raw) return fallback;
    if (isLikelyNetworkFailure(raw)) return INTERNET_ERROR_MESSAGE;
    return raw;
  }
  return fallback;
}

export async function fetchWithNetworkError(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await nativeFetch(input, init);
  } catch (error) {
    throw new Error(normalizeApiErrorMessage(error, 'Request failed'));
  }
}
