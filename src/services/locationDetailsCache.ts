// Shared cache for location detail responses to avoid repeated calls on route changes.
// Used by both DesktopLayout and OutletDropdown so they share a single cache.
export const locationDetailsCache = new Map<string, any>();
export const locationDetailsInFlight = new Map<string, Promise<any>>();
