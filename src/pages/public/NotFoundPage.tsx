import React from 'react';
import { Link } from 'react-router-dom';
import { Sprout, Home, Store } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function NotFoundPage() {
  const { tr } = useLanguage();

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center py-14 px-4 bg-gradient-to-b from-[#d1fae5]/35 via-[#f7faf8] to-white">
      <div className="agri-card rounded-3xl max-w-lg w-full p-6 sm:p-10 shadow-lg bg-white text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-[#d1fae5]/75 border border-[#10b981]/30 text-[#047857] flex items-center justify-center mx-auto">
          <Sprout className="w-7 h-7" strokeWidth={1.75} />
        </div>

        <div className="text-xs font-bold uppercase tracking-wider text-[#047857]">
          404 · {tr('Page Not Found', 'পৃষ্ঠাটি পাওয়া যায়নি')}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          {tr("We couldn't find that route", 'এই ঠিকানাটি খুঁজে পাওয়া যায়নি')}
        </h1>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          {tr(
            'The page you requested may have moved or is unavailable. Return to the AgriHub trade network or browse fresh produce in the marketplace.',
            'আপনি যে পৃষ্ঠাটি খুঁজছেন তা পাওয়া যায়নি। হোম পেজে ফিরুন অথবা মার্কেটপ্লেস থেকে তাজা কৃষিপণ্য দেখুন।'
          )}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link to="/" className="agri-btn agri-btn-primary">
            <Home className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>{tr('Return Home', 'হোমে ফিরুন')}</span>
          </Link>
          <Link to="/marketplace" className="agri-btn agri-btn-secondary">
            <Store className="w-4 h-4 text-[#047857] shrink-0" strokeWidth={1.75} />
            <span>{tr('Browse Marketplace', 'মার্কেটপ্লেস দেখুন')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
