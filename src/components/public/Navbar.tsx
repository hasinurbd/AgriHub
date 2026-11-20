import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Store,
  Workflow,
  Users,
  Mail,
  Menu,
  X,
  LogIn,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  CheckCircle2,
  Globe,
  ShoppingCart
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, translateRole } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';

export default function Navbar() {
  const { currentUser, logout, isAdmin } = useAuth();
  const { language, setLanguage, tr } = useLanguage();
  const { cartCount, openCartDrawer } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onResize = () => {
      setIsCompactViewport(window.innerWidth < 768);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
    navigate('/');
  };

  const handleNavClick = (path: string, sectionId?: string) => {
    setMobileMenuOpen(false);
    if (location.pathname === path && sectionId) {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (location.pathname === '/' && path === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const navLinkClass = (active: boolean) =>
    `h-9 px-3 rounded-xl transition whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981] ${
      active
        ? 'text-[#047857] font-bold bg-[#d1fae5]/50'
        : 'text-slate-700 hover:text-[#047857] hover:bg-[#d1fae5]/35'
    }`;

  const portalPath = isAdmin
    ? '/admin/dashboard'
    : currentUser?.role === 'farmer'
    ? '/farmer'
    : currentUser?.role === 'supplier'
    ? '/logistics'
    : '/buyer';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[var(--border-subtle)] transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Zone 1: Brand Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 group shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981] rounded-xl p-1"
          aria-label={tr('AgriHub Home', 'অ্যাগ্রিহাব হোম')}
        >
          <img
            src="/agrihub-logo.png"
            alt="AgriHub"
            referrerPolicy="no-referrer"
            className="h-7 sm:h-8 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
          />
        </Link>

        {/* Zone 2: Desktop Navigation Links */}
        <nav
          aria-label={tr('Primary Navigation', 'প্রধান নেভিগেশন')}
          className="hidden lg:flex items-center gap-1"
        >
          <Link
            to="/"
            onClick={() => handleNavClick('/')}
            className={navLinkClass(location.pathname === '/')}
          >
            <Home className="w-4 h-4 text-[#047857] shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>{tr('Home', 'হোম')}</span>
          </Link>

          <Link
            to="/marketplace"
            onClick={() => handleNavClick('/marketplace')}
            className={navLinkClass(location.pathname.startsWith('/marketplace'))}
          >
            <Store className="w-4 h-4 text-[#047857] shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>{tr('Marketplace', 'মার্কেটপ্লেস')}</span>
          </Link>

          <Link
            to="/how-it-works"
            onClick={() => handleNavClick('/how-it-works', 'how-it-works')}
            className={navLinkClass(location.pathname === '/how-it-works')}
          >
            <Workflow className="w-4 h-4 text-[#047857] shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>{tr('How It Works', 'কার্যপ্রণালী')}</span>
          </Link>

          <Link
            to="/network"
            onClick={() => handleNavClick('/network', 'trusted-network')}
            className={navLinkClass(location.pathname === '/network')}
          >
            <Users className="w-4 h-4 text-[#047857] shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>{tr('Network', 'নেটওয়ার্ক')}</span>
          </Link>

          <Link
            to="/contact"
            onClick={() => handleNavClick('/contact', 'contact')}
            className={navLinkClass(location.pathname === '/contact')}
          >
            <Mail className="w-4 h-4 text-[#047857] shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>{tr('Contact', 'যোগাযোগ')}</span>
          </Link>

        </nav>

        {/* Zone 3: Cart, Language Switch & Single Sign In CTA */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Cart & Checkout Trigger */}
          <button
            type="button"
            onClick={openCartDrawer}
            aria-label={tr('Open Trade Cart', 'ট্রেড কার্ট খুলুন')}
            title={tr('Trade Cart & Checkout', 'ট্রেড কার্ট ও চেকআউট')}
            className="relative h-9 w-9 inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-white text-[#047857] hover:bg-[#d1fae5]/40 hover:border-[#10b981] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981]"
          >
            <ShoppingCart className="w-4 h-4" strokeWidth={1.75} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#047857] text-white text-[10px] font-mono font-bold flex items-center justify-center shadow-xs">
                {cartCount}
              </span>
            )}
          </button>

          {/* Language Switch */}
          <div
            className="h-9 inline-flex items-center bg-[#f0f6f2] border border-[var(--border-subtle)] rounded-xl p-1 text-[11px] font-bold shrink-0"
            role="group"
            aria-label={tr('Select Language', 'ভাষা নির্বাচন করুন')}
          >
            <Globe
              className="w-3.5 h-3.5 text-[#047857] mx-1 hidden sm:block shrink-0"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => setLanguage('en')}
              aria-pressed={language === 'en'}
              className={`h-7 px-2 rounded-lg transition whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981] ${
                language === 'en'
                  ? 'bg-[#047857] text-white shadow-2xs'
                  : 'text-slate-700 hover:text-[#047857]'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('bn')}
              aria-pressed={language === 'bn'}
              className={`h-7 px-2 rounded-lg transition whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981] ${
                language === 'bn'
                  ? 'bg-[#047857] text-white shadow-2xs'
                  : 'text-slate-700 hover:text-[#047857]'
              }`}
            >
              বাংলা
            </button>
          </div>

          {currentUser ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                aria-expanded={userDropdownOpen}
                aria-haspopup="menu"
                className="h-9 flex items-center gap-2 px-2.5 rounded-xl border border-[var(--border-subtle)] hover:border-[#10b981] bg-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981]"
              >
                <div className="w-6 h-6 rounded-full bg-[#d1fae5] text-[#047857] font-bold text-[11px] flex items-center justify-center shrink-0">
                  {currentUser.full_name?.charAt(0) || 'U'}
                </div>
                <div className="hidden md:block text-left text-xs">
                  <div className="font-semibold text-slate-900 leading-none truncate max-w-[110px]">
                    {currentUser.full_name}
                  </div>
                  <div className="text-[10px] text-[#047857] font-medium capitalize mt-0.5">
                    {translateRole(currentUser.role, language)}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 hidden sm:block" strokeWidth={1.75} />
              </button>

              {userDropdownOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-60 bg-white border border-[var(--border-subtle)] rounded-2xl shadow-xl p-2 z-50 text-xs"
                >
                  <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
                    <div className="font-bold text-slate-900">{currentUser.full_name}</div>
                    <div className="text-slate-500 text-[11px] truncate">{currentUser.email}</div>
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[#047857] font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" strokeWidth={1.75} />
                      <span>
                        {translateRole(currentUser.role, language)} {tr('Account', 'অ্যাকাউন্ট')}
                      </span>
                    </div>
                  </div>

                  <div className="py-1 space-y-0.5">
                    <Link
                      to={portalPath}
                      role="menuitem"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-[#047857] hover:bg-[#d1fae5]/50 rounded-xl font-semibold transition"
                    >
                      <LayoutDashboard className="w-4 h-4" strokeWidth={1.75} />
                      <span>{tr('My Portal', 'আমার পোর্টাল')}</span>
                    </Link>

                    <Link
                      to="/marketplace"
                      role="menuitem"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-[#f0f6f2] rounded-xl transition"
                    >
                      <Store className="w-4 h-4 text-[#047857]" strokeWidth={1.75} />
                      <span>{tr('Browse Marketplace', 'মার্কেটপ্লেস দেখুন')}</span>
                    </Link>
                  </div>

                  <div className="pt-1 border-t border-[var(--border-subtle)]">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl font-semibold transition text-left"
                    >
                      <LogOut className="w-4 h-4" strokeWidth={1.75} />
                      <span>{tr('Sign Out', 'সাইন আউট')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            !isCompactViewport && (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="agri-btn agri-btn-primary agri-btn-sm h-9"
                >
                  <LogIn className="w-4 h-4 text-white shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  <span>{tr('Sign In', 'সাইন ইন')}</span>
                </Link>
              </div>
            )
          )}

          {/* Mobile Hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-drawer"
            aria-label={tr('Toggle navigation menu', 'নেভিগেশন মেনু খুলুন বা বন্ধ করুন')}
            className="lg:hidden h-9 w-9 inline-flex items-center justify-center text-[#047857] rounded-xl border border-[var(--border-subtle)] bg-white hover:bg-[#d1fae5]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981]"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" strokeWidth={1.75} />
            ) : (
              <Menu className="w-5 h-5" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-drawer"
          className="lg:hidden bg-white border-b border-[var(--border-subtle)] px-4 pt-3 pb-5 space-y-3 shadow-lg"
        >
          <nav className="flex flex-col space-y-1 text-sm font-medium" aria-label={tr('Mobile Navigation', 'মোবাইল নেভিগেশন')}>
            <Link
              to="/"
              onClick={() => handleNavClick('/')}
              className={`px-3 py-2.5 rounded-xl flex items-center gap-2.5 font-semibold transition ${
                location.pathname === '/'
                  ? 'text-[#047857] font-bold bg-[#d1fae5]/50'
                  : 'text-slate-800 hover:bg-[#d1fae5]/40 hover:text-[#047857]'
              }`}
            >
              <Home className="w-4 h-4 text-[#047857]" strokeWidth={1.75} />
              <span>{tr('Home', 'হোম')}</span>
            </Link>
            <Link
              to="/marketplace"
              onClick={() => handleNavClick('/marketplace')}
              className={`px-3 py-2.5 rounded-xl flex items-center gap-2.5 font-semibold transition ${
                location.pathname.startsWith('/marketplace')
                  ? 'text-[#047857] font-bold bg-[#d1fae5]/50'
                  : 'text-slate-800 hover:bg-[#d1fae5]/40 hover:text-[#047857]'
              }`}
            >
              <Store className="w-4 h-4 text-[#047857]" strokeWidth={1.75} />
              <span>{tr('Marketplace', 'মার্কেটপ্লেস')}</span>
            </Link>
            <Link
              to="/how-it-works"
              onClick={() => handleNavClick('/how-it-works', 'how-it-works')}
              className={`px-3 py-2.5 rounded-xl flex items-center gap-2.5 font-semibold transition ${
                location.pathname === '/how-it-works'
                  ? 'text-[#047857] font-bold bg-[#d1fae5]/50'
                  : 'text-slate-800 hover:bg-[#d1fae5]/40 hover:text-[#047857]'
              }`}
            >
              <Workflow className="w-4 h-4 text-[#047857]" strokeWidth={1.75} />
              <span>{tr('How It Works', 'কার্যপ্রণালী')}</span>
            </Link>
            <Link
              to="/network"
              onClick={() => handleNavClick('/network', 'trusted-network')}
              className={`px-3 py-2.5 rounded-xl flex items-center gap-2.5 font-semibold transition ${
                location.pathname === '/network'
                  ? 'text-[#047857] font-bold bg-[#d1fae5]/50'
                  : 'text-slate-800 hover:bg-[#d1fae5]/40 hover:text-[#047857]'
              }`}
            >
              <Users className="w-4 h-4 text-[#047857]" strokeWidth={1.75} />
              <span>{tr('Network', 'নেটওয়ার্ক')}</span>
            </Link>
            <Link
              to="/contact"
              onClick={() => handleNavClick('/contact', 'contact')}
              className={`px-3 py-2.5 rounded-xl flex items-center gap-2.5 font-semibold transition ${
                location.pathname === '/contact'
                  ? 'text-[#047857] font-bold bg-[#d1fae5]/50'
                  : 'text-slate-800 hover:bg-[#d1fae5]/40 hover:text-[#047857]'
              }`}
            >
              <Mail className="w-4 h-4 text-[#047857]" strokeWidth={1.75} />
              <span>{tr('Contact', 'যোগাযোগ')}</span>
            </Link>
            {currentUser && (
              <Link
                to={portalPath}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl text-[#047857] font-bold bg-[#d1fae5]/50 flex items-center gap-2.5"
              >
                <LayoutDashboard className="w-4 h-4 text-[#047857]" strokeWidth={1.75} />
                <span>{tr('My Portal', 'আমার পোর্টাল')}</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                openCartDrawer();
              }}
              className="px-3 py-2.5 rounded-xl text-slate-800 hover:bg-[#d1fae5]/40 flex items-center justify-between"
            >
              <span className="flex items-center gap-2.5">
                <ShoppingCart className="w-4 h-4 text-[#047857]" strokeWidth={1.75} />
                <span>{tr('Trade Cart & Checkout', 'ট্রেড কার্ট ও চেকআউট')}</span>
              </span>
              {cartCount > 0 && (
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#047857] text-white">
                  {cartCount}
                </span>
              )}
            </button>
          </nav>

          {(isCompactViewport || currentUser) && (
            <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center gap-2">
              {!currentUser ? (
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="agri-btn agri-btn-primary w-full"
                >
                  <LogIn className="w-4 h-4 text-white shrink-0" strokeWidth={1.75} />
                  <span>{tr('Sign In', 'সাইন ইন')}</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="agri-btn agri-btn-danger w-full"
                >
                  <LogOut className="w-4 h-4" strokeWidth={1.75} />
                  <span>{tr('Sign Out', 'সাইন আউট')} ({currentUser.full_name})</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
