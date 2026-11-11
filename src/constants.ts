// Match maghil-portal shared/constants for storage keys (branch switch, credentials)
export const CREDENTIALS = 'CREDENTIALS';
export const SELECTED_BRANCH_DATA = 'SELECTED_BRANCH_DATA';
export const SERVER_KNOWN_SALT = 'SERVER_KNOWN_SALT';

// Logo image base URL (match maghil-portal REACT_APP_IMAGE_URL + id + extension)
export const BASE_IMAGE_URL = process.env.REACT_APP_IMAGE_URL || 'https://storage.googleapis.com/mhd-media/';

export function resolveCatalogItemImageUrl(raw?: string | null): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  const envBase = (process.env.REACT_APP_IMAGE_URL || '').replace(/\/+$/, '');
  const fallbackBase = String(BASE_IMAGE_URL || '').replace(/\/+$/, '');
  const base = envBase || fallbackBase;
  const file = trimmed.replace(/^\/+/, '');
  if (!base) return null;
  return `${base}/${file}`;
}

/**
 * Build logo URL from restaurant/location media (same as Sidebar getImageURL("LOGO")).
 * Uses first media item with entityType "LOGO" or "logo".
 * @param {Array} media - restaurantDetails.media or location.media
 * @returns {string} Full image URL or ""
 */
export function getLogoUrlFromMedia(media) {
    if (!media || !Array.isArray(media) || media.length === 0) return '';
    const logoMedia = media.find((m) => m && (m.entityType === 'LOGO' || m.entityType === 'logo'));
    if (!logoMedia || !logoMedia.id) return '';
    const ext = (logoMedia.mimeType || '').split('/')[1] || 'png';
    const base = String(BASE_IMAGE_URL || '').replace(/\/+$/, '');
    return `${base}/${logoMedia.id}.${ext}`;
}
