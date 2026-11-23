import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, AlertTriangle, LogIn, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function AdminLoginPage() {
  const { currentUser, isAdmin, isDemoMode, backendConnected, login, logout } = useAuth();
  const { language, setLanguage, tr } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const rawRedirect = searchParams.get('redirect') || '';
  const targetRedirect =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
      ? rawRedirect
      : '/admin/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (currentUser && isAdmin) {
    return <Navigate to={targetRedirect} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(email.trim(), password);
      if (!user) {
        setError(tr('Invalid administrator credentials.', 'অ্যাডমিন ইমেইল বা পাসওয়ার্ড সঠিক নয়।'));
        return;
      }
      if (user.role !== 'admin') {
        setError(
          tr(
            'This account does not have administrator permissions.',
            'এই অ্যাকাউন্টে অ্যাডমিন প্রবেশাধিকার নেই।'
          )
        );
        return;
      }
      navigate(targetRedirect, { replace: true });
    } catch (err: any) {
      setError(err?.message || tr('Unable to sign in.', 'সাইন ইন করা যায়নি।'));
    } finally {
      setLoading(false);
    }
  };

  const setPreset = () => {
    if (backendConnected) {
      setEmail('admin@agrihub.local');
      setPassword('Password123!');
    } else {
      setEmail('admin@agrihub.com');
      setPassword('agraiagrihb#1');
    }
  };

  return (
    <div className="min-h-screen bg-[#f7faf8] flex items-center justify-center p-4 transition-colors">
      <div className="bg-white border border-[var(--border-subtle)] rounded-2xl max-w-md w-full p-5 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Link to="/" className="inline-flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981]">
            <img
              src="/agrihub-logo.png"
              alt="AgriHub"
              referrerPolicy="no-referrer"
              className="h-8 w-auto object-contain"
            />
          </Link>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
              className="px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[#f0f6f2] text-[11px] font-bold text-slate-700 hover:text-[#047857] transition"
            >
              {language === 'en' ? 'বাংলা' : 'EN'}
            </button>
            <span className="text-[11px] font-bold text-[#047857] bg-[#d1fae5]/70 border border-[#10b981]/30 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{tr('Admin Portal', 'অ্যাডমিন পোর্টাল')}</span>
            </span>
          </div>
        </div>

        <div>
          <h1 className="text-xl font-extrabold text-slate-950 tracking-tight">
            {tr('Administrator Sign In', 'অ্যাডমিনিস্ট্রেটর সাইন ইন')}
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            {tr(
              'Sign in with authorized administrator credentials to manage AgriHub operations.',
              'অ্যাগ্রিহাব পরিচালনা করতে অনুমোদিত অ্যাডমিন অ্যাকাউন্ট দিয়ে সাইন ইন করুন।'
            )}
          </p>
        </div>

        {currentUser && !isAdmin && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
            <div>
              {tr('Signed in as', 'বর্তমানে লগইন করা অ্যাকাউন্ট:')}{' '}
              <strong>{currentUser.full_name}</strong> ({currentUser.role}).
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/portal"
                className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 font-semibold text-amber-900 hover:bg-amber-100"
              >
                {tr('Go to My Portal', 'আমার পোর্টালে যান')}
              </Link>
              <button
                type="button"
                onClick={() => logout()}
                className="px-3 py-1.5 rounded-lg bg-amber-700 text-white font-semibold hover:bg-amber-800"
              >
                {tr('Sign Out First', 'সাইন আউট করুন')}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label htmlFor="admin-email" className="block font-bold text-slate-800 mb-1.5">
              {tr('Administrator Email', 'অ্যাডমিন ইমেইল')}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#047857] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} aria-hidden="true" />
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={backendConnected ? 'admin@agrihub.local' : 'admin@agrihub.com'}
                className="agri-input pl-9"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="admin-password" className="font-bold text-slate-800">
                {tr('Password', 'পাসওয়ার্ড')}
              </label>
              <Link to="/forgot-password" className="text-[#047857] font-semibold hover:underline">
                {tr('Reset password?', 'পাসওয়ার্ড ভুলে গেছেন?')}
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#047857] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} aria-hidden="true" />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="agri-input pl-9 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? tr('Hide password', 'পাসওয়ার্ড লুকান') : tr('Show password', 'পাসওয়ার্ড দেখুন')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#047857] focus:outline-none"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                ) : (
                  <Eye className="w-4 h-4" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={setPreset}
              className="text-[11px] font-semibold text-[#047857] hover:underline"
            >
              {backendConnected
                ? tr('Load Admin Credentials (admin@agrihub.local)', 'অ্যাডমিন তথ্য পূরণ করুন (admin@agrihub.local)')
                : tr('Load Admin Credentials (admin@agrihub.com)', 'অ্যাডমিন তথ্য পূরণ করুন (admin@agrihub.com)')}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="agri-btn agri-btn-primary w-full py-3"
          >
            <LogIn className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>{loading ? tr('Verifying...', 'যাচাই হচ্ছে...') : tr('Enter Admin Console', 'অ্যাডমিন কনসোলে প্রবেশ করুন')}</span>
          </button>
        </form>

        {isDemoMode && (
          <div className="p-3 rounded-xl bg-[#f0f6f2] border border-[#10b981]/25 text-[11px] text-slate-700 leading-relaxed">
            <strong className="text-[#047857]">
              {tr('Offline-First Mode Active:', 'অফলাইন-ফার্স্ট মোড চালু:')}
            </strong>{' '}
            {tr(
              'Works directly on Vercel even if the external PHP/MySQL API is offline. Click "Load Admin Credentials" above or sign in with your admin account to manage IndexedDB records.',
              'ব্যাকএন্ড এপিআই অফলাইনে থাকলেও এটি ভার্সেলে সরাসরি কাজ করবে। উপরে "অ্যাডমিন তথ্য পূরণ করুন" ব্যবহার করে সাইন ইন করুন।'
            )}
          </div>
        )}

        <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-slate-500">
          <Link to="/" className="inline-flex items-center gap-1.5 hover:text-[#047857] font-semibold">
            <ArrowLeft className="w-3.5 h-3.5 text-[#047857]" strokeWidth={1.75} />
            <span>{tr('Back to Home', 'হোমে ফিরুন')}</span>
          </Link>
          <Link to="/login" className="hover:text-[#047857] font-semibold">
            {tr('Member Sign In', 'সদস্য সাইন ইন')}
          </Link>
        </div>
      </div>
    </div>
  );
}