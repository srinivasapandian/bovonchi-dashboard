export const PRODUCT_CATALOG_SYNC_NEEDED = 'PRODUCT_CATALOG_SYNC_NEEDED';
export const PRODUCT_CATALOG_SYNC_NEEDED_UPDATED = 'PRODUCT_CATALOG_SYNC_NEEDED_UPDATED';

export function getProductCatalogSyncNeeded(): boolean {
  try {
    return localStorage.getItem(PRODUCT_CATALOG_SYNC_NEEDED) === 'true';
  } catch {
    return false;
  }
}

export function setProductCatalogSyncNeeded(needed: boolean): void {
  try {
    localStorage.setItem(PRODUCT_CATALOG_SYNC_NEEDED, needed ? 'true' : 'false');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(PRODUCT_CATALOG_SYNC_NEEDED_UPDATED));
    }
  } catch {
    // ignore localStorage failures
  }
}

/** Mark sync required after any product catalog edit / delete style action. */
export function markProductCatalogSyncNeeded(): void {
  setProductCatalogSyncNeeded(true);
}

