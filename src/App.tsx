import { Suspense, lazy, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BranchProvider } from './context/BranchContext';
import { DesktopLayoutProvider } from './context/DesktopLayoutContext';
import { NavigationGuardProvider } from './context/NavigationGuardContext';
import { UNAUTHORIZED_EVENT } from './features/orders/ordersApi';
import { useMediaQuery } from './components/productCatalog/hooks/useMediaQuery';
import DesktopLayout from './components/layout/DesktopLayout';
import ProductCatalogToastContainer from './components/productCatalog/components/ui/ProductCatalogToastContainer';
import ProductCatalogSyncResultWatcher from './components/productCatalog/components/ui/ProductCatalogSyncResultWatcher';
import LoginPage from './pages/LoginPage';

const OrdersPage = lazy(() => import('./features/orders/OrdersPage'));

const PCHub = lazy(() => import('./components/productCatalog/features/InventoryHubPage'));
const PCItems = lazy(() => import('./components/productCatalog/features/items/ItemsPage'));
const PCItemForm = lazy(() => import('./components/productCatalog/features/items/ItemFormPage'));
const PCMenus = lazy(() => import('./components/productCatalog/features/menus/MenusPage'));
const PCMenuForm = lazy(() => import('./components/productCatalog/features/menus/MenuFormPage'));
const PCMenuPrices = lazy(() => import('./components/productCatalog/features/menus/MenuPriceEditorPage'));
const PCMenuPerf = lazy(() => import('./components/productCatalog/features/menus/MenuPerformanceReport'));
const PCCategories = lazy(() => import('./components/productCatalog/features/categories/CategoriesPage'));
const PCCategoryForm = lazy(() => import('./components/productCatalog/features/categories/CategoryFormPage'));
const PCModifiers = lazy(() => import('./components/productCatalog/features/modifiers/ModifiersPage'));
const PCModifierForm = lazy(() => import('./components/productCatalog/features/modifiers/ModifierFormPage'));
const PCVariations = lazy(() => import('./components/productCatalog/features/optionSets/OptionSetsPage'));
const PCVariationForm = lazy(() => import('./components/productCatalog/features/optionSets/OptionSetFormPage'));
const PCCombos = lazy(() => import('./components/productCatalog/features/combos/CombosPage'));
const PCComboForm = lazy(() => import('./components/productCatalog/features/combos/ComboFormPage'));
const PCComboReport = lazy(() => import('./components/productCatalog/features/combos/ComboReportPage'));
const PCSetMenus = lazy(() => import('./components/productCatalog/features/setMenus/SetMenusPage'));
const PCSetMenuForm = lazy(() => import('./components/productCatalog/features/setMenus/SetMenuFormPage'));
const PCAvailability = lazy(() => import('./components/productCatalog/features/availability/AvailabilityControlCentre'));
const PCKitchen = lazy(() => import('./components/productCatalog/features/kitchenStations/KitchenStationsPage'));
const PCKitchenForm = lazy(() => import('./components/productCatalog/features/kitchenStations/KitchenStationFormPage'));
const PCSessions = lazy(() => import('./components/productCatalog/features/sessions/SessionsPage'));
const PCSessionForm = lazy(() => import('./components/productCatalog/features/sessions/SessionFormPage'));
const PCSyncHistory = lazy(() => import('./components/productCatalog/features/syncHistory/SyncHistoryPage'));

/** Quiet loading state shown while a lazily-loaded screen's chunk arrives. */
function PageFallback() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const body = (
    <div style={{ padding: isMobile ? 16 : '28px 36px', display: 'grid', gap: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: 54,
            width: `${96 - i * 6}%`,
            background: 'linear-gradient(90deg, var(--bv-sand) 25%, var(--bv-line-soft) 50%, var(--bv-sand) 75%)',
            backgroundSize: '400% 100%',
            animation: 'bone-shimmer 1.4s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  );
  return isMobile ? body : <DesktopLayout>{body}</DesktopLayout>;
}

const Page = ({ children }: { children: ReactNode }) => <Suspense fallback={<PageFallback />}>{children}</Suspense>;

/** Gate: signed-out visitors go to /login and come back to where they were headed. */
function Protected({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAuthLoading } = useAuth();
  const location = useLocation();
  if (isAuthLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

/** The API client announces 401s; sign out once, centrally. */
function SessionWatcher() {
  const { logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [, force] = useState(0);
  useEffect(() => {
    const onExpired = async () => {
      if (!isAuthenticated) return;
      await logout();
      navigate('/login', { replace: true });
      force((n) => n + 1);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onExpired);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onExpired);
  }, [logout, navigate, isAuthenticated]);
  return null;
}

const p = (el: ReactNode) => (
  <Protected>
    <Page>{el}</Page>
  </Protected>
);

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  return (
    <>
      <SessionWatcher />
      {isAuthenticated && (
        <>
          <ProductCatalogToastContainer />
          <ProductCatalogSyncResultWatcher />
        </>
      )}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/orders" element={p(<OrdersPage />)} />

        <Route path="/product-catalog" element={p(<PCAvailability />)} />
        <Route path="/product-catalog/hub" element={p(<PCHub />)} />
        <Route path="/product-catalog/availability" element={p(<PCAvailability />)} />
        <Route path="/product-catalog/items" element={p(<PCItems />)} />
        <Route path="/product-catalog/items/create" element={p(<PCItemForm />)} />
        <Route path="/product-catalog/items/edit" element={p(<PCItemForm />)} />
        <Route path="/product-catalog/menus" element={p(<PCMenus />)} />
        <Route path="/product-catalog/menus/create" element={p(<PCMenuForm />)} />
        <Route path="/product-catalog/menus/edit" element={p(<PCMenuForm />)} />
        <Route path="/product-catalog/menus/performance" element={p(<PCMenuPerf />)} />
        <Route path="/product-catalog/menus/:id/prices" element={p(<PCMenuPrices />)} />
        <Route path="/product-catalog/categories" element={p(<PCCategories />)} />
        <Route path="/product-catalog/categories/create" element={p(<PCCategoryForm />)} />
        <Route path="/product-catalog/categories/edit" element={p(<PCCategoryForm />)} />
        <Route path="/product-catalog/modifiers" element={p(<PCModifiers />)} />
        <Route path="/product-catalog/modifiers/create" element={p(<PCModifierForm />)} />
        <Route path="/product-catalog/modifiers/edit" element={p(<PCModifierForm />)} />
        <Route path="/product-catalog/variations" element={p(<PCVariations />)} />
        <Route path="/product-catalog/variations/create" element={p(<PCVariationForm />)} />
        <Route path="/product-catalog/variations/edit" element={p(<PCVariationForm />)} />
        <Route path="/product-catalog/option-sets" element={<Navigate to="/product-catalog/variations" replace />} />
        <Route path="/product-catalog/option-sets/create" element={<Navigate to="/product-catalog/variations/create" replace />} />
        <Route path="/product-catalog/option-sets/edit" element={<Navigate to="/product-catalog/variations/edit" replace />} />
        <Route path="/product-catalog/combos" element={p(<PCCombos />)} />
        <Route path="/product-catalog/combos/create" element={p(<PCComboForm />)} />
        <Route path="/product-catalog/combos/edit" element={p(<PCComboForm />)} />
        <Route path="/product-catalog/combos/report" element={p(<PCComboReport />)} />
        <Route path="/product-catalog/set-menus" element={p(<PCSetMenus />)} />
        <Route path="/product-catalog/set-menus/create" element={p(<PCSetMenuForm />)} />
        <Route path="/product-catalog/set-menus/edit" element={p(<PCSetMenuForm />)} />
        <Route path="/product-catalog/kitchen-stations" element={p(<PCKitchen />)} />
        <Route path="/product-catalog/kitchen-stations/create" element={p(<PCKitchenForm />)} />
        <Route path="/product-catalog/kitchen-stations/edit" element={p(<PCKitchenForm />)} />
        <Route path="/product-catalog/sessions" element={p(<PCSessions />)} />
        <Route path="/product-catalog/sessions/create" element={p(<PCSessionForm />)} />
        <Route path="/product-catalog/sessions/edit" element={p(<PCSessionForm />)} />
        <Route path="/product-catalog/sync-history" element={p(<PCSyncHistory />)} />

        <Route path="*" element={<Navigate to="/orders" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BranchProvider>
          <NavigationGuardProvider>
            <DesktopLayoutProvider>
              <AppRoutes />
            </DesktopLayoutProvider>
          </NavigationGuardProvider>
        </BranchProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
