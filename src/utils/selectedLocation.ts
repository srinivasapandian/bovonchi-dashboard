import { SELECTED_BRANCH_DATA } from '../constants';

/**
 * The outlet picked in the sidebar's outlet switcher, for code outside React (sagas, services). BranchProvider
 * keeps it current on every render, so a read during a re-render after a switch already sees the new outlet.
 * On native the branch lives in secure storage, which can't be read synchronously — hence the in-memory value.
 */
let current: string | null = null;

const idOf = (branch: unknown): string => {
  const b = branch as { id?: unknown; locationId?: unknown } | null | undefined;
  return String(b?.id ?? b?.locationId ?? '').trim();
};

export function setSelectedLocationFromBranch(branch: unknown): void {
  current = idOf(branch) || null;
}

/** The selected outlet's id, or '' when none is selected yet (callers fall back to the login outlet). */
export function getSelectedLocationId(): string {
  if (current) return current;
  try {
    // Before BranchProvider has loaded the stored branch (web keeps it in localStorage).
    const raw = localStorage.getItem(SELECTED_BRANCH_DATA);
    return raw ? idOf(JSON.parse(raw)) : '';
  } catch {
    return '';
  }
}
