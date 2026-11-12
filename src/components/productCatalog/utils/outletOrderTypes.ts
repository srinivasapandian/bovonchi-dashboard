/** One outlet order type, from `selectedBranch.orderTypes` — same source ItemFormPage's kitchen-print field and the availability Control Centre already read. */
export interface OutletOrderType {
  id: string;
  typeName: string;
  typeGroup?: string;
}

/**
 * Order types configured for the selected outlet.
 * Includes disabled order types; excludes in-store (typeGroup 'I') and rows without an id.
 * One row per outlet order type — not deduped — so Doordash/Grubhub/Swiggy each appear.
 */
export function getOrderTypesForBranch(selectedBranch: unknown): OutletOrderType[] {
  const raw = (selectedBranch as { orderTypes?: unknown } | null | undefined)?.orderTypes;
  if (!Array.isArray(raw)) return [];
  const out: OutletOrderType[] = [];
  for (const row of raw as Array<Record<string, unknown> | null | undefined>) {
    const id = String(row?.id ?? '').trim();
    const typeGroup = row?.typeGroup == null ? undefined : String(row.typeGroup);
    if (!id || (typeGroup ?? 'T') === 'I') continue;
    out.push({ id, typeName: String(row?.typeName ?? ''), typeGroup });
  }
  return out;
}

/**
 * E-commerce storefront supports Pickup only — every other order type (Dine-in, Delivery,
 * third-party, online, catering) is hidden in the UI.
 */
export function isPickupOrderType(ot: { id?: unknown; typeName?: unknown; typeGroup?: unknown } | null | undefined): boolean {
  if (!ot) return false;
  const text = `${String(ot.typeName ?? '')} ${String(ot.id ?? '')}`.toLowerCase().replace(/[\s-]+/g, '_');
  if (/(takeout|take_out|takeaway|take_away|pickup|pick_up)/.test(text)) return true;
  if (/(dine|dining|walk_in|walkin|eat_in|delivery|online|catering|cater)/.test(text)) return false;
  return String(ot.typeGroup ?? '').toUpperCase() === 'P';
}

/** Third-party marketplace order types (Doordash, Grubhub, Swiggy, …) carry typeGroup 'T'. */
export function isThirdPartyTypeGroup(typeGroup: unknown): boolean {
  return String(typeGroup ?? '').toUpperCase() === 'T';
}

/**
 * Order types shown / saved for kitchen printing. Third-party types are left out on purpose:
 * the backend applies the Delivery rule to every third-party order type.
 */
export function getKitchenPrintOrderTypes(selectedBranch: unknown): OutletOrderType[] {
  return getOrderTypesForBranch(selectedBranch).filter((ot) => !isThirdPartyTypeGroup(ot.typeGroup) && isPickupOrderType(ot));
}

export function getChannelDisplayName(typeName: string): string {
  const n = (typeName ?? '').toLowerCase();
  if (n.includes('dining') || n.includes('dinein') || n.includes('dine-in') || n.includes('walk-in') || n.includes('walkin')) return 'Dine-in';
  if (!typeName) return '';
  return typeName.charAt(0).toUpperCase() + typeName.slice(1).toLowerCase();
}
