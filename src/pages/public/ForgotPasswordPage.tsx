import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Mail, ShieldCheck, Lock, AlertTriangle, CheckCircle2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { AgriHubApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function ForgotPasswordPage() {
  const { currentUser } = useAuth();
  const { tr } = useLanguage();

  const [email, setEmail] = useState(currentUser?.email || '');
  const [verificationRef, setVerificationRef] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (newPassword.length < 6) {
      setError(tr('Password must be at least 6 characters long.', 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(tr('Passwords do not match.', 'পাসওয়ার্ড দুটি মেলেনি।'));
      return;
    }

    setLoading(true);
    try {
      const payload = currentUser
        ? { current_password: currentPassword, new_password: newPassword }
        : { email: email.trim(), verification_ref: verificationRef.trim(), new_password: newPassword };

      const res = await AgriHubApi.resetPassword(payload);
      if (res.success) {
        setSuccessMsg(
          res.message ||
            tr('Password updated successfully. You can now sign in.', 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে।')
        );
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(res.message || tr('Password reset failed.', 'পাসওয়ার্ড রিসেট করা যায়নি।'));
      }
    } catch (err: any) {
      setError(err?.message || tr('Unable to reset password right now.', 'এই মুহূর্তে পাসওয়ার্ড রিসেট করা যায়নি।'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center py-8 sm:py-12 px-4 bg-gradient-to-b from-[#d1fae5]/35 via-[#f7faf8] to-white">
      <div className="agri-card rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-lg bg-white space-y-6">
        <div className="flex items-center justify-between">
          <div className="w-11 h-11 rounded-2xl bg-[#d1fae5]/75 border border-[#10b981]/30 text-[#047857] flex items-center justify-center">
            <KeyRound className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <Link to="/login" className="text-xs font-semibold text-slate-600 hover:text-[#047857] inline-flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5 text-[#047857]" strokeWidth={1.75} />
            <span>{tr('Back to Sign In', 'সাইন ইনে ফিরুন')}</span>
          </Link>
        </div>

        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {currentUser ? tr('Update Account Password', 'পাসওয়ার্ড পরিবর্তন করুন') : tr('Reset Password', 'পাসওয়ার্ড রিসেট করুন')}
          </h1>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            {currentUser
              ? tr(
                  'Enter your current password and choose a new password for your AgriHub account.',
                  'আপনার বর্তমান পাসওয়ার্ড দিয়ে নতুন পাসওয়ার্ড সেট করুন।'
                )
              : tr(
                  'Verify your registered email along with your phone number or Trade License / NID to set a new password.',
                  'নতুন পাসওয়ার্ড সেট করতে নিবন্ধিত ইমেইল এবং মোবাইল নম্বর বা ট্রেড লাইসেন্স / জাতীয় পরিচয়পত্র নম্বর দিন।'
                )}
          </p>
        </div>

        {error && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-[#d1fae5]/60 border border-[#10b981]/35 text-[#047857] rounded-xl text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0" strokeWidth={1.75} />
              <span>{successMsg}</span>
            </div>
            <Link to="/login" className="inline-block text-[#047857] font-bold underline">
              {tr('Proceed to Sign In →', 'সাইন ইন করুন →')}
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {currentUser ? (
            <div>
              <label htmlFor="reset-current" className="block font-bold text-slate-800 mb-1.5">
                {tr('Current Password', 'বর্তমান পাসওয়ার্ড')}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#047857] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} aria-hidden="true" />
                <input
                  id="reset-current"
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="agri-input pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  aria-label={showCurrentPassword ? tr('Hide password', 'পাসওয়ার্ড লুকান') : tr('Show password', 'পাসওয়ার্ড দেখুন')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#047857] focus:outline-none"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                  ) : (
                    <Eye className="w-4 h-4" strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="reset-email" className="block font-bold text-slate-800 mb-1.5">
                  {tr('Registered Email', 'নিবন্ধিত ইমেইল')}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#047857] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="reset-email"
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
                <label htmlFor="reset-ref" className="block font-bold text-slate-800 mb-1.5">
                  {tr('Phone or Trade License / NID Number', 'মোবাইল নম্বর বা ট্রেড লাইসেন্স / এনআইডি নম্বর')}
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-[#047857] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="reset-ref"
                    type="text"
                    required
                    value={verificationRef}
                    onChange={(e) => setVerificationRef(e.target.value)}
                    placeholder="+880 1711-111111"
                    className="agri-input pl-9"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label htmlFor="reset-new" className="block font-bold text-slate-800 mb-1.5">
              {tr('New Password', 'নতুন পাসওয়ার্ড')}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#047857] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} aria-hidden="true" />
              <input
                id="reset-new"
                type={showNewPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={tr('Minimum 6 characters', 'কমপক্ষে ৬ অক্ষর')}
                className="agri-input pl-9 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                aria-label={showNewPassword ? tr('Hide password', 'পাসওয়ার্ড লুকান') : tr('Show password', 'পাসওয়ার্ড দেখুন')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#047857] focus:outline-none"
              >
                {showNewPassword ? (
                  <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                ) : (
                  <Eye className="w-4 h-4" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="reset-confirm" className="block font-bold text-slate-800 mb-1.5">
              {tr('Confirm New Password', 'নতুন পাসওয়ার্ড নিশ্চিত করুন')}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#047857] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} aria-hidden="true" />
              <input
                id="reset-confirm"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="agri-input pl-9 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? tr('Hide password', 'পাসওয়ার্ড লুকান') : tr('Show password', 'পাসওয়ার্ড দেখুন')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#047857] focus:outline-none"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                ) : (
                  <Eye className="w-4 h-4" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="agri-btn agri-btn-primary w-full py-3"
          >
            {loading ? tr('Updating...', 'হালনাগাদ হচ্ছে...') : tr('Save New Password', 'নতুন পাসওয়ার্ড সংরক্ষণ করুন')}
          </button>
        </form>
      </div>
    </div>
  );
}
