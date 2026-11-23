import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Truck,
  Mail,
  Phone,
  MapPin,
  Lock,
  Sprout,
  Warehouse,
  Leaf,
  BadgeCheck,
  Store,
  KeyRound,
  Carrot,
  Apple,
  Wheat,
  ShoppingBag
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function Footer() {
  const { tr } = useLanguage();

  return (
    <footer className="bg-[var(--bg-surface)] text-[var(--text-secondary)] text-xs border-t border-[var(--border-subtle)] transition-colors">
      {/* Trust Pillars Summary Bar */}
      <div className="border-b border-[var(--border-subtle)] bg-[#d1fae5]/30 dark:bg-[#0b1811]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#d1fae5]/80 dark:bg-[#047857]/30 border border-[#10b981]/30 flex items-center justify-center shrink-0 text-[#047857] dark:text-[#10b981]">
              <Sprout className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <div className="font-bold text-[var(--text-primary)] text-sm">
                {tr('Verified Farmers', 'যাচাইকৃত কৃষক')}
              </div>
              <p className="text-[var(--text-secondary)] text-xs mt-1 leading-relaxed">
                {tr(
                  'Direct harvest sourcing from vetted farmers and agricultural cooperatives across Bangladesh.',
                  'সারা দেশের যাচাইকৃত কৃষক ও সমবায় সমিতি থেকে সরাসরি তাজা ফসল সংগ্রহ।'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#d1fae5]/80 dark:bg-[#047857]/30 border border-[#10b981]/30 flex items-center justify-center shrink-0 text-[#047857] dark:text-[#10b981]">
              <Truck className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <div className="font-bold text-[var(--text-primary)] text-sm">
                {tr('Cold-Chain Protection', 'কোল্ড-চেইন সুরক্ষা')}
              </div>
              <p className="text-[var(--text-secondary)] text-xs mt-1 leading-relaxed">
                {tr(
                  'Temperature-controlled transport keeps fruits, vegetables, and dairy fresh nationwide.',
                  'তাপমাত্রা-নিয়ন্ত্রিত পরিবহনে সারা দেশে ফল, সবজি ও দুগ্ধজাত পণ্য থাকে সম্পূর্ণ সতেজ।'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#d1fae5]/80 dark:bg-[#047857]/30 border border-[#10b981]/30 flex items-center justify-center shrink-0 text-[#047857] dark:text-[#10b981]">
              <BadgeCheck className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <div className="font-bold text-[var(--text-primary)] text-sm">
                {tr('Quality Assurance', 'মানের নিশ্চয়তা')}
              </div>
              <p className="text-[var(--text-secondary)] text-xs mt-1 leading-relaxed">
                {tr(
                  'Every harvest lot is sorted, graded, and tracked from regional collection centers.',
                  'প্রতিটি ফসলের লট আঞ্চলিক সংগ্রহ কেন্দ্রে যাচাই ও গ্রেডিং করে পাঠানো হয়।'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#d1fae5]/80 dark:bg-[#047857]/30 border border-[#10b981]/30 flex items-center justify-center shrink-0 text-[#047857] dark:text-[#10b981]">
              <Lock className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <div className="font-bold text-[var(--text-primary)] text-sm">
                {tr('Secure Trade Payments', 'নিরাপদ লেনদেন')}
              </div>
              <p className="text-[var(--text-secondary)] text-xs mt-1 leading-relaxed">
                {tr(
                  'Transparent BDT pricing and protected trade settlements for both farmers and buyers.',
                  'কৃষক ও ক্রেতা উভয়ের জন্য ন্যায্য টাকা দর এবং সুরক্ষিত পেমেন্ট নিশ্চয়তা।'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Multi-Column Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-5 gap-8">
        {/* Brand & Mission */}
        <div className="md:col-span-2 space-y-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981] rounded-xl"
          >
            <div className="bg-white p-1.5 rounded-xl border border-[var(--border-subtle)] dark:border-transparent shadow-2xs">
              <img
                src="/agrihub-logo.png"
                alt="AgriHub"
                referrerPolicy="no-referrer"
                className="h-8 w-auto object-contain"
              />
            </div>
          </Link>

          <p className="text-[var(--text-secondary)] text-xs leading-relaxed max-w-sm">
            {tr(
              "AgriHub is Bangladesh's Trusted Agricultural Trade Network, uniting verified farmers, regional storage hubs, refrigerated transport partners, and buyers nationwide.",
              'অ্যাগ্রিহাব হলো বাংলাদেশের বিশ্বস্ত কৃষি বাণিজ্য নেটওয়ার্ক—যা যাচাইকৃত কৃষক, সংগ্রহ কেন্দ্র, কোল্ড-চেইন পরিবহন এবং সারা দেশের ক্রেতাদের একসাথে যুক্ত করে।'
            )}
          </p>

          <div className="space-y-2.5 text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
              <span>{tr('Tejgaon Agricultural Trade Hub, Dhaka 1208, Bangladesh', 'তেজগাঁও কৃষি বাণিজ্য হাব, ঢাকা ১২০৮, বাংলাদেশ')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
              <span>support@agrihub.bd</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
              <span>{tr('+880 2-881-2474 (Trade Support Desk)', '+৮৮০ ২-৮৮১-২৪৭৪ (বাণিজ্য সহায়তা ডেস্ক)')}</span>
            </div>
          </div>
        </div>

        {/* Produce Catalog */}
        <div className="space-y-3.5">
          <div className="font-bold text-[var(--text-primary)] text-xs uppercase tracking-wider">
            {tr('Produce Catalog', 'কৃষিপণ্য তালিকা')}
          </div>
          <ul className="space-y-2.5 text-xs">
            <li>
              <Link to="/marketplace" className="hover:text-[#047857] dark:hover:text-[#10b981] transition inline-flex items-center gap-2">
                <Store className="w-3.5 h-3.5 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
                <span>{tr('All Harvest Lots', 'সকল ফসলের ব্যাচ')}</span>
              </Link>
            </li>
            <li>
              <Link to="/marketplace?category=Vegetables" className="hover:text-[#047857] dark:hover:text-[#10b981] transition inline-flex items-center gap-2">
                <Carrot className="w-3.5 h-3.5 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
                <span>{tr('Fresh Vegetables', 'তাজা শাকসবজি')}</span>
              </Link>
            </li>
            <li>
              <Link to="/marketplace?category=Fruits" className="hover:text-[#047857] dark:hover:text-[#10b981] transition inline-flex items-center gap-2">
                <Apple className="w-3.5 h-3.5 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
                <span>{tr('Fruits & Berries', 'তাজা ফলমূল')}</span>
              </Link>
            </li>
            <li>
              <Link to="/marketplace?category=Grains" className="hover:text-[#047857] dark:hover:text-[#10b981] transition inline-flex items-center gap-2">
                <Wheat className="w-3.5 h-3.5 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
                <span>{tr('Grains & Rice', 'চাল ও খাদ্যশস্য')}</span>
              </Link>
            </li>
            <li>
              <Link
                to="/marketplace?organic=true"
                className="hover:text-[#047857] transition inline-flex items-center gap-2 text-[var(--text-secondary)] font-normal"
              >
                <Leaf className="w-3.5 h-3.5 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
                <span>{tr('Organic Produce', 'অর্গানিক পণ্য')}</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* Trade Network */}
        <div className="space-y-3.5">
          <div className="font-bold text-[var(--text-primary)] text-xs uppercase tracking-wider">
            {tr('Trade Network', 'বাণিজ্য নেটওয়ার্ক')}
          </div>
          <ul className="space-y-2.5 text-xs">
            <li className="flex items-center gap-2">
              <Sprout className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
              <span>{tr('Direct Farm Sourcing', 'সরাসরি খামার থেকে সংগ্রহ')}</span>
            </li>
            <li className="flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
              <span>{tr('Regional Collection Hubs', 'আঞ্চলিক সংগ্রহ ও সংরক্ষণ কেন্দ্র')}</span>
            </li>
            <li className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
              <span>{tr('Nationwide Cold Transport', 'সারা দেশে কোল্ড-চেইন পরিবহন')}</span>
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
              <span>{tr('Origin & Quality Checks', 'উৎস ও গুণগত মান যাচাই')}</span>
            </li>
          </ul>
        </div>

        {/* Member Portals */}
        <div className="space-y-3.5">
          <div className="font-bold text-[var(--text-primary)] text-xs uppercase tracking-wider">
            {tr('Member Workspaces', 'সদস্য ওয়ার্কস্পেস')}
          </div>
          <ul className="space-y-2.5 text-xs">
            <li>
              <Link to="/farmer" className="hover:text-[#047857] dark:hover:text-[#10b981] transition inline-flex items-center gap-2">
                <Sprout className="w-3.5 h-3.5 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
                <span>{tr('Farmer Harvest Portal', 'কৃষক ফসল পোর্টাল')}</span>
              </Link>
            </li>
            <li>
              <Link to="/logistics" className="hover:text-[#047857] dark:hover:text-[#10b981] transition inline-flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
                <span>{tr('Transport & Cold-Chain Portal', 'পরিবহন ও কোল্ড-চেইন পোর্টাল')}</span>
              </Link>
            </li>
            <li>
              <Link to="/buyer" className="hover:text-[#047857] dark:hover:text-[#10b981] transition inline-flex items-center gap-2">
                <ShoppingBag className="w-3.5 h-3.5 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
                <span>{tr('Buyer Procurement Portal', 'ক্রেতা ক্রয় পোর্টাল')}</span>
              </Link>
            </li>
            <li>
              <Link to="/admin/dashboard" className="hover:text-[#047857] dark:hover:text-[#10b981] transition inline-flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
                <span>{tr('Admin Console', 'অ্যাডমিন কনসোল')}</span>
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-[#047857] transition inline-flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#047857]" strokeWidth={1.75} />
                <span>{tr('Trade Partnership Inquiry', 'পার্টনারশিপ যোগাযোগ')}</span>
              </Link>
            </li>
            <li>
              <Link
                to="/forgot-password"
                className="hover:text-[#047857] dark:hover:text-[#10b981] transition inline-flex items-center gap-2"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
                <span>{tr('Account Password Help', 'পাসওয়ার্ড সহায়তা')}</span>
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[var(--text-muted)]">
          <div>
            © {new Date().getFullYear()}{' '}
            {tr(
              "AgriHub — Bangladesh's Trusted Agricultural Trade Network. All rights reserved.",
              'অ্যাগ্রিহাব — বাংলাদেশের বিশ্বস্ত কৃষি বাণিজ্য নেটওয়ার্ক। সর্বস্বত্ব সংরক্ষিত।'
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[var(--text-secondary)] font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
              <span>{tr('Verified Trade Protection · BDT (৳)', 'সুরক্ষিত কৃষি বাণিজ্য · টাকা (৳)')}</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
