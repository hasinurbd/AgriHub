import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sprout,
  Truck,
  ShoppingBag,
  AlertTriangle,
  UserPlus,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { tr } = useLanguage();

  const [role, setRole] = useState<'buyer' | 'farmer' | 'supplier'>('buyer');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [taxNid, setTaxNid] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const ok = await register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
        phone: phone.trim() || '+880 1700-000000',
        business_name: businessName.trim() || `${fullName}'s Agro Enterprise`,
        tax_or_nid_no: taxNid.trim() || 'PENDING-REVIEW',
        address: address.trim() || 'Dhaka Trade Corridor'
      });

      if (ok) {
        navigate('/marketplace');
      } else {
        setError(tr('Registration could not be completed. Please review your details.', 'নিবন্ধন সম্পন্ন করা যায়নি। অনুগ্রহ করে তথ্যগুলো আবার দেখুন।'));
      }
    } catch (err: any) {
      setError(err.message || tr('Registration failed.', 'নিবন্ধন ব্যর্থ হয়েছে।'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#d1fae5]/35 via-[#f7faf8] to-white">
      <div className="agri-card rounded-3xl max-w-2xl w-full p-6 sm:p-10 shadow-lg bg-white space-y-6">
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

          <div className="mt-6">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {tr('Join the AgriHub Trade Network', 'অ্যাগ্রিহাব বাণিজ্য নেটওয়ার্কে যোগ দিন')}
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              {tr(
                "Create your verified account on Bangladesh's Trusted Agricultural Trade Network",
                'বাংলাদেশের বিশ্বস্ত কৃষি বাণিজ্য নেটওয়ার্কে আপনার যাচাইকৃত অ্যাকাউন্ট তৈরি করুন'
              )}
            </p>
          </div>
        </div>

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
          {/* Role Selector Tabs */}
          <div>
            <span className="block text-slate-800 font-bold mb-2">
              {tr('Choose Your Account Type', 'আপনার অ্যাকাউন্টের ধরন নির্বাচন করুন')}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setRole('buyer')}
                className={`p-3 rounded-xl border text-center font-bold transition flex flex-col items-center gap-1.5 ${
                  role === 'buyer'
                    ? 'bg-[#d1fae5]/75 border-[#10b981] text-[#047857] shadow-2xs'
                    : 'bg-[#f7faf8] hover:bg-[#d1fae5]/40 border-[#dce7e0] text-slate-700'
                }`}
              >
                <ShoppingBag className="w-5 h-5 text-[#047857] shrink-0" strokeWidth={1.75} />
                <div>{tr('Verified Buyer', 'ক্রেতা')}</div>
              </button>

              <button
                type="button"
                onClick={() => setRole('farmer')}
                className={`p-3 rounded-xl border text-center font-bold transition flex flex-col items-center gap-1.5 ${
                  role === 'farmer'
                    ? 'bg-[#d1fae5]/75 border-[#10b981] text-[#047857] shadow-2xs'
                    : 'bg-[#f7faf8] hover:bg-[#d1fae5]/40 border-[#dce7e0] text-slate-700'
                }`}
              >
                <Sprout className="w-5 h-5 text-[#047857] shrink-0" strokeWidth={1.75} />
                <div>{tr('Farmer / Grower', 'কৃষক / উৎপাদক')}</div>
              </button>

              <button
                type="button"
                onClick={() => setRole('supplier')}
                className={`p-3 rounded-xl border text-center font-bold transition flex flex-col items-center gap-1.5 ${
                  role === 'supplier'
                    ? 'bg-[#d1fae5]/75 border-[#10b981] text-[#047857] shadow-2xs'
                    : 'bg-[#f7faf8] hover:bg-[#d1fae5]/40 border-[#dce7e0] text-slate-700'
                }`}
              >
                <Truck className="w-5 h-5 text-[#047857] shrink-0" strokeWidth={1.75} />
                <div>{tr('Logistics / Storage', 'পরিবহন ও সংরক্ষণ')}</div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="reg-fullname" className="block text-slate-800 font-bold mb-1.5">
                {tr('Full Name', 'পূর্ণ নাম')}
              </label>
              <input
                id="reg-fullname"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={tr('e.g. Rahim Chowdhury', 'যেমন: রহিম চৌধুরী')}
                className="agri-input"
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-slate-800 font-bold mb-1.5">
                {tr('Email Address', 'ইমেইল ঠিকানা')}
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rahim@agrihub.bd"
                className="agri-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="reg-password" className="block text-slate-800 font-bold mb-1.5">
                {tr('Password', 'পাসওয়ার্ড')}
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tr('At least 6 characters', 'কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড')}
                  className="agri-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
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
            <div>
              <label htmlFor="reg-phone" className="block text-slate-800 font-bold mb-1.5">
                {tr('Phone Number', 'মোবাইল নম্বর')}
              </label>
              <input
                id="reg-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+880 1711-000000"
                className="agri-input font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="reg-business" className="block text-slate-800 font-bold mb-1.5">
                {tr('Farm / Organization Name', 'খামার বা প্রতিষ্ঠানের নাম')}
              </label>
              <input
                id="reg-business"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={tr('e.g. Dinajpur Agro Growers', 'যেমন: দিনাজপুর কৃষি সমবায়')}
                className="agri-input"
              />
            </div>
            <div>
              <label htmlFor="reg-nid" className="block text-slate-800 font-bold mb-1.5">
                {tr('Trade License / NID Number', 'ট্রেড লাইসেন্স / জাতীয় পরিচয়পত্র নম্বর')}
              </label>
              <input
                id="reg-nid"
                type="text"
                value={taxNid}
                onChange={(e) => setTaxNid(e.target.value)}
                placeholder="e.g. TR-994821"
                className="agri-input font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-address" className="block text-slate-800 font-bold mb-1.5">
              {tr('District & Location Address', 'জেলা ও ব্যবসার ঠিকানা')}
            </label>
            <input
              id="reg-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={tr('e.g. Rajshahi Agro Hub / Tejgaon, Dhaka', 'যেমন: রাজশাহী কৃষি অঞ্চল / তেজগাঁও, ঢাকা')}
              className="agri-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="agri-btn agri-btn-primary w-full py-3 mt-4"
          >
            <UserPlus className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>{loading ? tr('Creating Account...', 'অ্যাকাউন্ট তৈরি হচ্ছে...') : tr('Complete Registration', 'নিবন্ধন সম্পন্ন করুন')}</span>
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
          {tr('Already a member?', 'ইতোমধ্যে অ্যাকাউন্ট আছে?')}{' '}
          <Link to="/login" className="text-[#047857] font-bold hover:underline">
            {tr('Sign In here', 'এখানে সাইন ইন করুন')}
          </Link>
        </div>
      </div>
    </div>
  );
}
