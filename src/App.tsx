import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OfflineSyncProvider } from './context/OfflineSyncContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { CartProvider } from './context/CartContext';
import { hasConfiguredBackend, isDemoModeEnabled } from './api';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/public/Navbar';
import Footer from './components/public/Footer';
import {
  ShieldAlert,
  ShieldCheck,
  LogIn,
  ShoppingBag,
  RefreshCw
} from 'lucide-react';

const HomePage = lazy(() => import('./pages/public/HomePage'));
const MarketplacePage = lazy(() => import('./pages/public/MarketplacePage'));
const DocsPage = lazy(() => import('./pages/public/DocsPage'));
const LoginPage = lazy(() => import('./pages/public/LoginPage'));
const RegisterPage = lazy(() => import('./pages/public/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/public/ForgotPasswordPage'));
const RolePortalPage = lazy(() => import('./pages/public/RolePortalPage'));
const NotFoundPage = lazy(() => import('./pages/public/NotFoundPage'));
const AdminPanel = lazy(() => import('./pages/admin/AdminPanel'));
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'));
const AgriAssistantWidget = lazy(() => import('./components/public/AgriAssistantWidget'));

function RouteLoader() {
  const { tr } = useLanguage();
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="agri-card bg-white px-5 py-3.5 flex items-center gap-3 text-xs font-semibold text-slate-700">
        <RefreshCw className="w-4 h-4 text-[#047857] animate-spin" strokeWidth={1.75} />
        <span>{tr('Loading AgriHub...', 'অ্যাগ্রিহাব লোড হচ্ছে...')}</span>
      </div>
    </div>
  );
}

// Protected Admin Route wrapper enforcing role === 'admin', with zero-password auto-entry when no live DB backend is connected
function ProtectedAdminRoute() {
  const { currentUser, isAdmin, loadingUser, backendConnected, loginDemoRole } = useAuth();
  const { tr } = useLanguage();

  const noLiveBackend = !hasConfiguredBackend() || backendConnected === false;

  const canAutoEnterLocalAdmin = (() => {
    if (!noLiveBackend || !isDemoModeEnabled()) return false;
    try {
      return sessionStorage.getItem('agrihub_admin_signed_out') !== '1';
    } catch {
      return true;
    }
  })();

  useEffect(() => {
    if (!loadingUser && !currentUser && canAutoEnterLocalAdmin) {
      loginDemoRole('admin');
    }
  }, [loadingUser, currentUser, canAutoEnterLocalAdmin, loginDemoRole]);

  if (!currentUser && (loadingUser || canAutoEnterLocalAdmin)) {
    return (
      <div className="min-h-screen bg-[#f7faf8] flex items-center justify-center p-4">
        <div className="agri-card bg-white p-6 flex items-center gap-3 text-xs font-semibold text-slate-700">
          <RefreshCw className="w-4 h-4 text-[#047857] animate-spin" strokeWidth={1.75} />
          <span>{tr('Opening Admin Console...', 'অ্যাডমিন কনসোল খোলা হচ্ছে...')}</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!isAdmin) {
    const canInstantSwitch = isDemoModeEnabled();
    return (
      <div className="min-h-screen bg-[#f7faf8] flex items-center justify-center p-4">
        <div className="agri-card bg-white rounded-3xl max-w-md w-full p-8 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 bg-amber-50 border border-amber-200 text-amber-700 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {tr('Admin Access Required', 'অ্যাডমিন প্রবেশাধিকার প্রয়োজন')}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {tr('You are currently signed in as', 'আপনি বর্তমানে সাইন ইন করেছেন')}{' '}
            <strong className="text-slate-900">{currentUser.full_name}</strong> (
            <span className="capitalize font-semibold text-[#047857]">{currentUser.role}</span>).{' '}
            {tr(
              'Switch to an administrator session to manage the AgriHub Admin Console.',
              'অ্যাগ্রিহাব অ্যাডমিন কনসোল পরিচালনা করতে অ্যাডমিন সেশনে প্রবেশ করুন।'
            )}
          </p>

          <div className="space-y-2 pt-2">
            {canInstantSwitch ? (
              <button
                type="button"
                onClick={() => loginDemoRole('admin')}
                className="agri-btn agri-btn-primary w-full"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span>{tr('Open Admin Panel (No Password Needed)', 'পাসওয়ার্ড ছাড়াই অ্যাডমিন প্যানেল খুলুন')}</span>
              </button>
            ) : (
              <Link to="/admin/login" className="agri-btn agri-btn-primary w-full">
                <LogIn className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span>{tr('Sign In with Administrator Account', 'অ্যাডমিন অ্যাকাউন্ট দিয়ে সাইন ইন করুন')}</span>
              </Link>
            )}

            <Link to="/marketplace" className="agri-btn agri-btn-secondary w-full">
              <ShoppingBag className="w-4 h-4 text-[#047857] shrink-0" strokeWidth={1.75} />
              <span>{tr('Return to Public Marketplace', 'মার্কেটপ্লেসে ফিরে যান')}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <AdminPanel />;
}

// Shell with Navbar & Footer for public routes
function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f7faf8]">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function MainApp() {
  return (
    <div className="min-h-screen bg-[#f7faf8] text-slate-900 font-sans selection:bg-[#d1fae5] selection:text-[#047857]">
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          {/* Admin Authentication & Protected Routes */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<ProtectedAdminRoute />} />
          <Route path="/admin/dashboard" element={<ProtectedAdminRoute />} />
          <Route path="/admin/users" element={<ProtectedAdminRoute />} />
          <Route path="/admin/farmers" element={<ProtectedAdminRoute />} />
          <Route path="/admin/buyers" element={<ProtectedAdminRoute />} />
          <Route path="/admin/orders" element={<ProtectedAdminRoute />} />
          <Route path="/admin/products" element={<ProtectedAdminRoute />} />
          <Route path="/admin/categories" element={<ProtectedAdminRoute />} />
          <Route path="/admin/logistics" element={<ProtectedAdminRoute />} />
          <Route path="/admin/warehouses" element={<ProtectedAdminRoute />} />
          <Route path="/admin/reports" element={<ProtectedAdminRoute />} />
          <Route path="/admin/docs" element={<ProtectedAdminRoute />} />
          <Route path="/admin/settings" element={<ProtectedAdminRoute />} />
          <Route path="/admin/activity" element={<ProtectedAdminRoute />} />
          <Route path="/admin/*" element={<ProtectedAdminRoute />} />

          {/* Public Routes Wrapped in PublicLayout */}
          <Route
            path="/"
            element={
              <PublicLayout>
                <HomePage />
              </PublicLayout>
            }
          />
          <Route
            path="/how-it-works"
            element={
              <PublicLayout>
                <HomePage targetSection="how-it-works" />
              </PublicLayout>
            }
          />
          <Route
            path="/network"
            element={
              <PublicLayout>
                <HomePage targetSection="trusted-network" />
              </PublicLayout>
            }
          />
          <Route
            path="/contact"
            element={
              <PublicLayout>
                <HomePage targetSection="contact" />
              </PublicLayout>
            }
          />
          <Route
            path="/marketplace"
            element={
              <PublicLayout>
                <MarketplacePage />
              </PublicLayout>
            }
          />
          <Route
            path="/docs"
            element={
              <PublicLayout>
                <DocsPage />
              </PublicLayout>
            }
          />
          <Route
            path="/login"
            element={
              <PublicLayout>
                <LoginPage />
              </PublicLayout>
            }
          />
          <Route
            path="/register"
            element={
              <PublicLayout>
                <RegisterPage />
              </PublicLayout>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicLayout>
                <ForgotPasswordPage />
              </PublicLayout>
            }
          />

          {/* Role Workspaces */}
          <Route
            path="/farmer"
            element={
              <PublicLayout>
                <RolePortalPage expectedRole="farmer" />
              </PublicLayout>
            }
          />
          <Route
            path="/buyer"
            element={
              <PublicLayout>
                <RolePortalPage expectedRole="buyer" />
              </PublicLayout>
            }
          />
          <Route
            path="/logistics"
            element={
              <PublicLayout>
                <RolePortalPage expectedRole="supplier" />
              </PublicLayout>
            }
          />
          <Route
            path="/portal"
            element={
              <PublicLayout>
                <RolePortalPage />
              </PublicLayout>
            }
          />

          {/* 404 Not Found */}
          <Route
            path="*"
            element={
              <PublicLayout>
                <NotFoundPage />
              </PublicLayout>
            }
          />
        </Routes>
      </Suspense>

      {/* Global Bilingual AgriHub AI Assistant */}
      <Suspense fallback={null}>
        <AgriAssistantWidget />
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <OfflineSyncProvider>
                <CartProvider>
                  <MainApp />
                </CartProvider>
              </OfflineSyncProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
