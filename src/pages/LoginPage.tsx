import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { getLocationDetails, loginApi } from '../services/api';
import { SELECTED_BRANCH_DATA, getLogoUrlFromMedia } from '../constants';
import { pickTimeZoneCdFromLocationPayload } from '../utils/locationPayload';
import { isOnlySpecialCharacters } from '../utils/textValidation';
import BrandMark from '../components/brand/BrandMark';
import poweredBy from '../assets/powered-by-brisque.png';
import './login.css';

const identityError = (businessName: string, userId: string): string => {
  if (isOnlySpecialCharacters(businessName)) return 'Business name cannot contain only special characters.';
  if (isOnlySpecialCharacters(userId)) return 'User ID cannot contain only special characters.';
  return '';
};

export default function LoginPage() {
  const { login, isAuthenticated, isAuthLoading } = useAuth();
  const { setSelectedBranch } = useBranch();
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isAuthLoading && isAuthenticated) return <Navigate to="/orders" replace />;

  /** Resolve + persist the outlet the staff member signed in to, so the shell has a branch on first paint. */
  const rememberBranch = async (data: any) => {
    const locationId = data.locationId || data.location_id;
    const token = data.accessToken || data.access_token;
    let branch: any = {
      id: locationId,
      locationName: data.locationName || data.location_name || 'Current Branch',
    };
    try {
      const res: any = await getLocationDetails(locationId, token);
      const payload = res?.metaDataInfo?.data ?? res?.data ?? res;
      const list = payload?.branch || payload?.branches || [];
      const current = Array.isArray(list) ? list.find((b: any) => (b.id || b.locationId) === locationId) : null;
      const timeZoneCd = pickTimeZoneCdFromLocationPayload(payload) ?? pickTimeZoneCdFromLocationPayload(current);
      const workingHours = payload?.workingHours || current?.workingHours || [];
      if (current) {
        branch = {
          ...current,
          id: current.id || locationId,
          locationName: current.locationName || current.name || branch.locationName,
          logoUrl: getLogoUrlFromMedia(current.media || payload.media || []) || current.logoUrl || '',
          ...(timeZoneCd ? { timeZoneCd } : {}),
          workingHours,
        };
      } else if (timeZoneCd) {
        branch = { ...branch, timeZoneCd, workingHours };
      }
    } catch {
      /* the shell re-fetches outlet details on mount; the id alone is enough to proceed */
    }
    localStorage.setItem(SELECTED_BRANCH_DATA, JSON.stringify(branch));
    setSelectedBranch(branch);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!businessName.trim() || !userId.trim() || !password.trim()) {
      setError('Please enter your business name, user ID and password.');
      return;
    }
    const invalid = identityError(businessName, userId);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data: any = await loginApi({ businessName: businessName.trim(), userId: userId.trim(), password });
      await rememberBranch(data);
      // login() must settle before navigating, or the route guard bounces us back here.
      await login(data);
      navigate('/orders', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Your user ID or password is incorrect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bv-login">
      <section className="bv-login__hero" aria-hidden="false">
        <p className="bv-login__eyebrow">Everyday elegance</p>
        <h1>
          Every order,
          <em>made for real life.</em>
        </h1>
        <p className="bv-login__lede">
          From Sunday brunch to the big day — follow every piece from order to doorstep, gift-ready every time.
        </p>
      </section>

      <section className="bv-login__panel">
        <form className="bv-login__card" onSubmit={onSubmit} noValidate>
          <div className="bv-login__brand">
            <BrandMark size={42} wordmarkSize={22} />
          </div>
          <h2>Sign In</h2>
          <p className="bv-login__sub">Please enter your details to access your orders.</p>

          <label className="bv-field">
            <span className="bv-field__label">
              Business name <i aria-hidden>*</i>
            </span>
            <input
              className="bv-field__input"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Enter your business name"
              autoComplete="organization"
              autoFocus
              required
            />
          </label>

          <label className="bv-field">
            <span className="bv-field__label">
              User ID <i aria-hidden>*</i>
            </span>
            <input
              className="bv-field__input"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your user ID"
              autoComplete="username"
              required
            />
          </label>

          <label className="bv-field">
            <span className="bv-field__label">
              Password <i aria-hidden>*</i>
            </span>
            <span className="bv-field__wrap">
              <input
                className="bv-field__input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="bv-field__toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-pressed={showPassword}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </span>
          </label>

          {error && (
            <p className="bv-login__error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="bv-login__submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>

      <footer className="bv-login__foot">
        <img src={poweredBy} alt="Powered by brisque" height={22} />
      </footer>
    </main>
  );
}
