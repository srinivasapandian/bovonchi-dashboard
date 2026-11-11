import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { SELECTED_BRANCH_DATA } from '../constants';
import type { BranchData } from '../types/api';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { useAuth } from './AuthContext';
import { getLocationDetails } from '../services/api';
import { locationDetailsCache, locationDetailsInFlight } from '../services/locationDetailsCache';
import { setCurrentCurrencyByCountry } from '../utils/currency';
import { setCurrentStoreTimeZone, clearServerClock } from '../utils/dateTimeUtils';
import { setSelectedLocationFromBranch } from '../utils/selectedLocation';

const findToken = (obj: any, depth = 0): string | null => {
    if (!obj || typeof obj !== 'object' || depth > 3) return null;
    for (const key of ['accessToken', 'access_token', 'token']) {
        if (obj[key] && typeof obj[key] === 'string' && obj[key].length > 10) return obj[key];
    }
    for (const [, val] of Object.entries(obj)) {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            const found = findToken(val, depth + 1);
            if (found) return found;
        }
    }
    return null;
};

interface BranchContextValue {
    selectedBranch: BranchData | null;
    setSelectedBranch: (branch: BranchData | null) => void;
    refreshBranch: () => void;
}

const BranchContext = createContext<BranchContextValue | null>(null);

// On native, use the Keystore-backed secure storage. On web, the plugin's
// fallback encodes via btoa() which throws on non-Latin1 characters, so use
// localStorage (which handles Unicode) instead.
const isNative = Capacitor.isNativePlatform();

const branchStorage = {
    async get(): Promise<string | null> {
        if (isNative) {
            try {
                const { value } = await SecureStoragePlugin.get({ key: SELECTED_BRANCH_DATA });
                return value ?? null;
            } catch {
                return null;
            }
        }
        return localStorage.getItem(SELECTED_BRANCH_DATA);
    },
    async set(value: string): Promise<void> {
        if (isNative) {
            await SecureStoragePlugin.set({ key: SELECTED_BRANCH_DATA, value });
        } else {
            localStorage.setItem(SELECTED_BRANCH_DATA, value);
        }
    },
    async remove(): Promise<void> {
        if (isNative) {
            await SecureStoragePlugin.remove({ key: SELECTED_BRANCH_DATA });
        } else {
            localStorage.removeItem(SELECTED_BRANCH_DATA);
        }
    },
};

export const BranchProvider = ({ children }) => {
    const [selectedBranch, setSelectedBranchState] = useState(null);
    const { isAuthenticated, auth } = useAuth();
    const wasAuthenticated = useRef(false);
    // Set during render (not in an effect) so children re-rendering after an outlet switch already read the new id.
    setSelectedLocationFromBranch(selectedBranch);

    // Async load from persisted storage on mount
    useEffect(() => {
        branchStorage.get()
            .then((value) => { if (value) setSelectedBranchState(JSON.parse(value)); })
            .catch(() => {});
    }, []);

    // Keep the active currency symbol in sync with the selected outlet's country
    // (IN → '₹', US → '$', anything else → no symbol). Central place so every
    // screen — including report pages that render outside DesktopLayout — resolves
    // the same symbol. The branch carries `country` once GET /details enriches it.
    useEffect(() => {
        setCurrentCurrencyByCountry((selectedBranch as any)?.country);
        // Keep the active store timezone in sync so report date filters anchor
        // "today"/"yesterday" on the outlet's own day (from `timeZoneCd`), not the
        // browser's. Same central rationale as the currency symbol above.
        setCurrentStoreTimeZone((selectedBranch as any)?.timeZoneCd);
    }, [selectedBranch]);

    // Fallback: some entry screens never mount DesktopLayout or OutletDropdown
    // (e.g. the Owner landing page sets hideOutlet, so on native nothing triggers
    // GET /details and the country — hence the symbol — never resolves). Fetch the
    // details here through the shared cache (deduped with DesktopLayout /
    // OutletDropdown via locationDetailsInFlight) and set the symbol from the
    // payload's top-level `country`.
    useEffect(() => {
        if ((selectedBranch as any)?.country) return; // sync effect above already handled it
        const locationId =
            (selectedBranch as any)?.id ?? (selectedBranch as any)?.locationId
            ?? (auth as any)?.locationId ?? (auth as any)?.location_id;
        const token = findToken(auth);
        if (!locationId || !token) return;
        let cancelled = false;
        const cacheKey = String(locationId);
        // Only the top-level payload.country is reliable — some environments omit
        // country entirely from every branch[]/branches[] entry, so a nested-list
        // fallback there is not safe to lean on.
        const applyCountry = (payload: any) => {
            if (cancelled || !payload) return;
            setCurrentCurrencyByCountry(payload?.country);
        };
        const cached = locationDetailsCache.get(cacheKey);
        if (cached) {
            applyCountry(cached);
            return () => { cancelled = true; };
        }
        const inFlight = locationDetailsInFlight.get(cacheKey);
        const req = inFlight ?? getLocationDetails(locationId, token)
            .then((res: any) => {
                const payload = res?.metaDataInfo?.data ?? res?.data ?? res;
                if (payload) locationDetailsCache.set(cacheKey, payload);
                return payload;
            })
            .finally(() => { locationDetailsInFlight.delete(cacheKey); });
        if (!inFlight) locationDetailsInFlight.set(cacheKey, req);
        req.then(applyCountry).catch(() => {});
        return () => { cancelled = true; };
    }, [selectedBranch, auth]);

    // On logout (authenticated → not), wipe the previously selected outlet and the
    // module-level location-details cache so the next account never inherits the prior
    // user's outlet selection or branch list in the dropdown. The persisted
    // SELECTED_BRANCH_DATA key is already removed in AuthContext.logout(); this also
    // clears the in-memory React state and shared caches that survive across logins.
    // Using a transition ref (not a bare `!isAuthenticated`) avoids wiping the branch
    // during the initial async auth hydration on cold start.
    useEffect(() => {
        if (wasAuthenticated.current && !isAuthenticated) {
            setSelectedBranchState(null);
            locationDetailsCache.clear();
            locationDetailsInFlight.clear();
            // The server clock is a reading for the outlet that was open; the next account
            // may sit in a different timezone entirely, so drop it rather than let it label
            // the new session's comparison line until the first response lands.
            clearServerClock();
        }
        wasAuthenticated.current = isAuthenticated;
    }, [isAuthenticated]);

    const setSelectedBranch = useCallback(async (branch) => {
        if (branch) {
            await branchStorage.set(JSON.stringify(branch));
        } else {
            await branchStorage.remove();
            await SecureStoragePlugin.remove({ key: SELECTED_BRANCH_DATA });
            localStorage.removeItem(SELECTED_BRANCH_DATA);
        }
        setSelectedBranchState(branch ?? null);
    }, []);

    const refreshBranch = useCallback(() => {
        branchStorage.get()
            .then((value) => setSelectedBranchState(value ? JSON.parse(value) : null))
            .catch(() => setSelectedBranchState(null));
        SecureStoragePlugin.get({ key: SELECTED_BRANCH_DATA })
            .then(({ value }) => {
                if (value) localStorage.setItem(SELECTED_BRANCH_DATA, value);
                else localStorage.removeItem(SELECTED_BRANCH_DATA);
                setSelectedBranchState(value ? JSON.parse(value) : null);
            })
            .catch(() => {
                localStorage.removeItem(SELECTED_BRANCH_DATA);
                setSelectedBranchState(null);
            });
    }, []);

    const value = useMemo(
        () => ({ selectedBranch, setSelectedBranch, refreshBranch }),
        [selectedBranch, setSelectedBranch, refreshBranch]
    );

    return (
        <BranchContext.Provider value={value}>
            {children}
        </BranchContext.Provider>
    );
};

export const useBranch = () => {
    const ctx = useContext(BranchContext);
    return ctx || { selectedBranch: null, setSelectedBranch: async () => {}, refreshBranch: () => {} };
};
