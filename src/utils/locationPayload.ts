/**
 * IANA timezone for store-scoped date display — same source as maghil-portal
 * `auth.restaurantDetails.timeZoneCd` from GET `/merchants/location/{id}/details`.
 *
 * The API often puts `timeZoneCd` on the response root while `branch[]` items may omit it.
 */
export function pickTimeZoneCdFromLocationPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const p = payload as Record<string, unknown>;
  const asStr = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined;

  const direct =
    asStr(p.timeZoneCd) ??
    asStr(p.timeZone) ??
    asStr(p.timezone);
  if (direct) return direct;

  const rd = p.restaurantDetails;
  if (rd && typeof rd === 'object') {
    const r = rd as Record<string, unknown>;
    const nested = asStr(r.timeZoneCd) ?? asStr(r.timeZone) ?? asStr(r.timezone);
    if (nested) return nested;
  }

  return undefined;
}
