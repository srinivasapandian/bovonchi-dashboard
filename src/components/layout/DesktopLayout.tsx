import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { getLocationDetails } from '../../services/api';
import { getLogoUrlFromMedia } from '../../constants';
import { pickTimeZoneCdFromLocationPayload } from '../../utils/locationPayload';
import { useDesktopTopBarProps } from '../../context/DesktopLayoutContext';
import { useNavigationGuard } from '../../context/NavigationGuardContext';
import { useRestaurantDetailsStore } from '../../redux/productCatalog/productCatalogHooks';
import { locationDetailsCache, locationDetailsInFlight } from '../../services/locationDetailsCache';
import { isCatalogPath } from './navConfig';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { getInitials } from './UserProfileDropdown';

const unwrap = (res: any) => res?.metaDataInfo?.data ?? res?.data ?? res;

function DesktopLayoutInner({ children }: { children: React.ReactNode }) {
  const topBarProps = useDesktopTopBarProps();
  const navigate = useNavigate();
  const { guardedNavigate } = useNavigationGuard();
  const { pathname } = useLocation();
  const { auth, logout } = useAuth();
  const { selectedBranch: branch, setSelectedBranch } = useBranch();
  const { setRestaurantDetails } = useRestaurantDetailsStore();

  const locationId = branch?.id ?? branch?.locationId ?? '';
  const token = auth?.accessToken ?? auth?.access_token ?? null;
  // The staff login response doesn't always carry fullName — fall through the other identity fields.
  const clean = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  const displayName =
    clean(auth?.fullName) ||
    clean([auth?.firstName, auth?.lastName].map(clean).filter(Boolean).join(' ')) ||
    clean(auth?.nickName) ||
    clean(auth?.userId) ||
    clean(auth?.email) ||
    'Team member';
  const userRole = clean(auth?.role).replace(/_/g, ' ') || 'Staff';
  const userEmail = clean(auth?.email);
  const businessName = clean(auth?.businessName);

  // Fold the outlet's details (logo, country, timezone, flags) into the selected branch.
  const applyLocationDetailsToBranch = (payload: any, currentId: any) => {
    const list = payload?.branch ?? payload?.branches ?? [];
    const hasList = Array.isArray(list) && list.length > 0;
    const match = hasList ? list.find((loc: any) => (loc.id ?? loc.locationId) === currentId) : null;
    const single = !hasList && Array.isArray(payload?.media) ? payload : null;
    const source = match ?? single;
    if (!source) return;
    const timeZoneCd = pickTimeZoneCdFromLocationPayload(payload) ?? pickTimeZoneCdFromLocationPayload(source);
    setSelectedBranch({
      ...branch,
      ...source,
      id: source.id ?? source.locationId ?? currentId,
      locationName: source.locationName ?? source.name ?? source.branchName ?? branch?.locationName,
      logoUrl: getLogoUrlFromMedia(source.media) || source.logoUrl || branch?.logoUrl,
      ...(timeZoneCd ? { timeZoneCd } : {}),
      workingHours: payload?.workingHours || source?.workingHours || branch?.workingHours || [],
      // Only the top-level payload.country is reliable across environments.
      country: payload?.country,
      uiFeatureFlags: payload?.uiFeatureFlags ?? source?.uiFeatureFlags ?? branch?.uiFeatureFlags,
    });
  };

  // Outlet details — de-duplicated through the shared cache.
  useEffect(() => {
    if (!locationId || !token) return;
    let cancelled = false;
    const currentId = branch?.id ?? branch?.locationId ?? locationId;
    const cacheKey = String(locationId);
    const apply = (payload: any) => {
      if (cancelled || !payload) return;
      setRestaurantDetails((payload?.restaurantDetails ?? payload) as Record<string, unknown>);
      applyLocationDetailsToBranch(payload, currentId);
    };

    const cached = locationDetailsCache.get(cacheKey);
    if (cached) {
      apply(cached);
      return () => {
        cancelled = true;
      };
    }
    const inFlight = locationDetailsInFlight.get(cacheKey);
    if (inFlight) {
      inFlight.then(apply).catch(() => {});
      return () => {
        cancelled = true;
      };
    }
    const req = getLocationDetails(locationId, token)
      .then((res) => {
        const payload = unwrap(res);
        if (payload) locationDetailsCache.set(cacheKey, payload);
        return payload;
      })
      .finally(() => locationDetailsInFlight.delete(cacheKey));
    locationDetailsInFlight.set(cacheKey, req);
    req.then(apply).catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, token]);

  // Catalog screens render their own page header, so the top bar would only repeat the title.
  const hasTopBarActions = Boolean(
    topBarProps.extraContent ||
      topBarProps.onBack ||
      topBarProps.onExport ||
      topBarProps.leftAddon ||
      topBarProps.dateFilters ||
      topBarProps.sourceFilters,
  );
  const showTopBar = !isCatalogPath(pathname) || hasTopBarActions;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bv-ivory)', color: 'var(--bv-ink)' }}>
      <Sidebar
        pathname={pathname}
        navigate={guardedNavigate}
        user={{
          initials: getInitials(displayName),
          name: displayName,
          role: userRole,
          email: userEmail,
          business: businessName,
          onLogout: () => {
            logout();
            navigate('/login', { replace: true });
          },
        }}
      />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {showTopBar && (
          <TopBar
            leftAddon={topBarProps.leftAddon}
            breadcrumbs={topBarProps.breadcrumbs}
            title={topBarProps.title}
            titleInfo={topBarProps.titleInfo}
            subtitle={topBarProps.subtitle}
            dateFilters={topBarProps.dateFilters}
            sourceFilters={topBarProps.sourceFilters}
            extraContent={topBarProps.extraContent}
            onExport={topBarProps.onExport}
            onBack={topBarProps.onBack}
          />
        )}
        <div data-desktop-main-scroll style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Desktop shell: fixed Sidebar (+ top bar on non-catalog pages); content scrolls in the remaining space. */
export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return <DesktopLayoutInner>{children}</DesktopLayoutInner>;
}
