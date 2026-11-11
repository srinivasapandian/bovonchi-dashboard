import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Credentials } from '../types/api';
import { clearHmacKey, initHmac } from '../utils/hmac-utils';
import { Store } from '../redux/store';
import { resetReportsData } from '../redux/globalActions';
import { CREDENTIALS, SELECTED_BRANCH_DATA, SERVER_KNOWN_SALT } from '../constants';
import { clearServerInfo, fetchServerInfoRequest } from '../redux/serverInfo/serverInfoIndex';
import { fetchServerInfoApi } from '../services/serverInfoApi';

interface AuthContextValue {
  auth: Credentials | null;
  login: (userData: Credentials) => Promise<void>;
  logout: () => Promise<void>;
  updateRole: (role: string) => Promise<void>;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Web-only port of the Merchant Portal AuthProvider.
 *
 * Credentials live in localStorage under `CREDENTIALS` — the same key the
 * ported service layer (hmac-utils, catalog APIs) reads to sign requests, so
 * there is exactly one source of truth and no Capacitor secure-storage hop.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [auth, setAuth] = useState<Credentials | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const syncServerKnownSalt = useCallback(async () => {
    const serverKnownSalt = await fetchServerInfoApi();
    if (serverKnownSalt) localStorage.setItem(SERVER_KNOWN_SALT, serverKnownSalt);
    return serverKnownSalt;
  }, []);

  // Restore a previous session on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem(CREDENTIALS);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (cancelled) return;
        setAuth(parsed);
        await syncServerKnownSalt().catch(() => undefined);
        await initHmac(parsed.accessToken ?? parsed.access_token);
      } catch {
        /* corrupt/absent session — fall through to the login screen */
      } finally {
        if (!cancelled) setIsAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [syncServerKnownSalt]);

  const login = useCallback(
    async (userData: Credentials) => {
      localStorage.setItem(CREDENTIALS, JSON.stringify(userData));
      Store.dispatch(fetchServerInfoRequest());
      setAuth(userData);
      await syncServerKnownSalt().catch(() => undefined);
      // Derive the HMAC key from the new token before any signed request fires.
      await initHmac(userData.accessToken ?? userData.access_token);
    },
    [syncServerKnownSalt],
  );

  // Keep the live session's role current if the signed-in user's own record changes.
  const updateRole = useCallback(async (role: string) => {
    setAuth((prev) => {
      if (!prev || prev.role === role) return prev;
      const next = { ...prev, role };
      localStorage.setItem(CREDENTIALS, JSON.stringify(next));
      return next;
    });
  }, []);

  const logout = useCallback(async () => {
    clearHmacKey();
    Store.dispatch(resetReportsData());
    Store.dispatch(clearServerInfo());
    localStorage.removeItem(CREDENTIALS);
    localStorage.removeItem(SELECTED_BRANCH_DATA);
    localStorage.removeItem(SERVER_KNOWN_SALT);
    setAuth(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ auth, login, logout, updateRole, isAuthenticated: !!auth, isAuthLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
