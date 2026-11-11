/**
 * Normalizes maghil-backend-v3 / Nest-style JSON error bodies where `message` may be
 * a string, string[], or missing (see validation pipe responses).
 */
export function messageFromRevampErrorBody(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const rec = data as Record<string, unknown>;
  const m = rec.message;
  if (typeof m === 'string' && m.trim()) return m.trim();
  if (Array.isArray(m) && m.length > 0) {
    return m.map((x) => (typeof x === 'string' ? x : String(x))).join('; ');
  }
  return fallback;
}
