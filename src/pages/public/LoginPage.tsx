import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  AlertTriangle,
  LogIn,
  Sprout,
  Truck,
  ShoppingBag,
  Mail,
  Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import coldchainShowcaseImg from '../../assets/images/agrihub_coldchain_showcase_1794487417226.jpg';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { tr } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = await login(email.trim(), password);
      if (user) {
        if (user.role === 'admin') {
          navigate('/admin/dashboard');
        } else if (user.role === 'farmer') {
          navigate('/farmer');
        } else if (user.role === 'supplier') {
          navigate('/logistics');
        } else {
          navigate('/buyer');
        }
      } else {
        setError(tr('Invalid email or password. Please check your login details.', 'ইমেইল বা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।'));
      }
    } catch (err: any) {
      setError(err.message || tr('Sign in failed. Please check your credentials.', 'সাইন ইন করা যায়নি। অনুগ্রহ করে তথ্য যাচাই করুন।'));
    } finally {
      setLoading(false);
    }
  };

  const setPreset = (presetEmail: string) => {
    setEmail(presetEmail);
    setPassword('Password123!');
  };

  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#d1fae5]/35 via-[#f7faf8] to-white">
      <div className="agri-card rounded-3xl max-w-4xl w-full overflow-hidden shadow-lg grid grid-cols-1 md:grid-cols-2">
        {/* Left: Form & Member Sign-In Options */}
        <div className="p-6 sm:p-10 flex flex-col justify-between bg-white">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981]"
            >
              <img
                src="/agrihub-logo.png"
                alt="AgriHub"
                referrerPolicy="no-referrer"
                className="h-9 w-auto object-contain"
              />
            </Link>

            <div className="mt-7 sm:mt-8">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {tr('Sign In to AgriHub', 'অ্যাগ্রিহাবে সাইন ইন করুন')}
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                {tr(
                  "Access Bangladesh's Trusted Agricultural Trade Network",
                  'বাংলাদেশের বিশ্বস্ত কৃষি বাণিজ্য নেটওয়ার্কে প্রবেশ করুন'
                )}
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" strokeWidth={1.75} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-xs">
              <div>
                <label htmlFor="login-email" className="block text-slate-800 font-bold mb-1.5">
                  {tr('Email Address', 'ইমেইল ঠিকানা')}
                </label>
                <div className="relative">
                  <Mail
                    className="w-4 h-4 text-[#047857] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@agrihub.bd"
                    className="agri-input pl-9"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-slate-800 font-bold mb-1.5">
                  {tr('Password', 'পাসওয়ার্ড')}
                </label>
                <div className="relative">
                  <Lock
                    className="w-4 h-4 text-[#047857] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="agri-input pl-9"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1">
                <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded border-slate-300 text-[#047857] focus:ring-[#10b981]"
                  />
                  <span>{tr('Keep me signed in', 'লগইন ধরে রাখুন')}</span>
                </label>
                <Link to="/forgot-password" className="text-[#047857] font-semibold hover:underline">
                  {tr('Need help signing in?', 'পাসওয়ার্ড ভুলে গেছেন?')}
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="agri-btn agri-btn-primary w-full py-3 mt-2"
              >
                <LogIn className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span>{loading ? tr('Signing in...', 'যাচাই চলছে...') : tr('Sign In', 'সাইন ইন করুন')}</span>
              </button>
            </form>
          </div>

          {/* Quick Member Selection (Public Roles Only) */}
          <div className="mt-8 pt-4 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-500 block mb-2.5 uppercase tracking-wider">
              {tr('Quick Member Access', 'সদস্য অ্যাকাউন্ট নির্বাচন')}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setPreset('farmer@agrihub.local')}
                className={`p-2.5 rounded-xl border text-left font-semibold transition flex items-center gap-2 ${
                  email === 'farmer@agrihub.local'
                    ? 'bg-[#d1fae5]/75 border-[#10b981] text-[#047857]'
                    : 'bg-[#f7faf8] hover:bg-[#d1fae5]/45 border-[#dce7e0] text-slate-800'
                }`}
              >
                <Sprout className="w-4 h-4 text-[#047857] shrink-0" strokeWidth={1.75} />
                <span className="truncate">{tr('Farmer', 'কৃষক')}</span>
              </button>

              <button
                type="button"
                onClick={() => setPreset('supplier@agrihub.local')}
                className={`p-2.5 rounded-xl border text-left font-semibold transition flex items-center gap-2 ${
                  email === 'supplier@agrihub.local'
                    ? 'bg-[#d1fae5]/75 border-[#10b981] text-[#047857]'
                    : 'bg-[#f7faf8] hover:bg-[#d1fae5]/45 border-[#dce7e0] text-slate-800'
                }`}
              >
                <Truck className="w-4 h-4 text-[#047857] shrink-0" strokeWidth={1.75} />
                <span className="truncate">{tr('Transport', 'পরিবহন')}</span>
              </button>

              <button
                type="button"
                onClick={() => setPreset('buyer@agrihub.local')}
                className={`p-2.5 rounded-xl border text-left font-semibold transition flex items-center gap-2 ${
                  email === 'buyer@agrihub.local'
                    ? 'bg-[#d1fae5]/75 border-[#10b981] text-[#047857]'
                    : 'bg-[#f7faf8] hover:bg-[#d1fae5]/45 border-[#dce7e0] text-slate-800'
                }`}
              >
                <ShoppingBag className="w-4 h-4 text-[#047857] shrink-0" strokeWidth={1.75} />
                <span className="truncate">{tr('Buyer', 'ক্রেতা')}</span>
              </button>
            </div>

            <div className="mt-4 text-center">
              <span className="text-slate-500">{tr('New to AgriHub?', 'অ্যাগ্রিহাবে নতুন?')} </span>
              <Link to="/register" className="text-[#047857] font-bold hover:underline">
                {tr('Create an Account', 'নতুন অ্যাকাউন্ট খুলুন')}
              </Link>
            </div>
          </div>
        </div>

        {/* Right: Trade Network Showcase */}
        <div className="hidden md:block relative bg-[#047857] overflow-hidden">
          <img
            src={coldchainShowcaseImg}
            alt={tr('Fresh agricultural harvest storage and transport', 'তাজা কৃষিপণ্য সংরক্ষণ ও পরিবহন')}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />

          <div className="absolute bottom-8 left-8 right-8 p-5 rounded-2xl bg-white/95 backdrop-blur-md border border-white/80 shadow-xl space-y-2">
            <div className="flex items-center gap-2 text-[#047857] text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span>{tr('Verified Agricultural Trade', 'যাচাইকৃত কৃষি বাণিজ্য')}</span>
            </div>
            <div className="text-base font-bold text-slate-900 leading-snug">
              {tr("Bangladesh's Trusted Agricultural Trade Network", 'বাংলাদেশের বিশ্বস্ত কৃষি বাণিজ্য নেটওয়ার্ক')}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {tr(
                'Connecting vetted farmers, regional storage hubs, refrigerated carriers, and buyers with reliable nationwide delivery.',
                'যাচাইকৃত কৃষক, আঞ্চলিক হিমাগার, কোল্ড-চেইন পরিবহন ও ক্রেতাদের নিরাপদ ডেলিভারির মাধ্যমে যুক্ত করছে।'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
