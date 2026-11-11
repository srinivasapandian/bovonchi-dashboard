/**
 * Best-effort id extraction from create/update API JSON for `?highlight=` navigation.
 */
export function pickHighlightIdFromApiResponse(payload: unknown): string {
  const read = (obj: unknown): string => {
    if (!obj) return '';
    if (typeof obj === 'string' || typeof obj === 'number') return String(obj).trim();
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = read(item);
        if (found) return found;
      }
      return '';
    }
    if (typeof obj !== 'object') return '';
    const row = obj as Record<string, unknown>;
    /** Align with `mapApiSessionToLocal`: group id is the canonical session row id when present. */
    const direct = String(
      row.sessionGroupId ??
        row.session_group_id ??
        row.modifierId ??
        row.modifierID ??
        row.sessionId ??
        row.session_id ??
        row.kitchenStationId ??
        row.stationId ??
        row.categoryId ??
        row.itemId ??
        row.itemID ??
        row.item_id ??
        row.id ??
        '',
    ).trim();
    if (direct) return direct;
    const nestedCandidates = [row.data, row.result, row.item, row.session, row.response, row.content];
    for (const c of nestedCandidates) {
      if (Array.isArray(c) && c.length > 0) {
        const fromFirst = read(c[0]);
        if (fromFirst) return fromFirst;
      } else {
        const nested = read(c);
        if (nested) return nested;
      }
    }
    return '';
  };
  return read(payload);
}
