import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Sprout,
  Truck,
  ShieldCheck,
  ShoppingBag,
  Store,
  Warehouse,
  Leaf,
  BadgeCheck,
  UserCheck,
  Users,
  Building2,
  BarChart3,
  TrendingUp,
  HeartHandshake,
  ArrowRight,
  CheckCircle2,
  Thermometer,
  MapPin,
  Lock,
  ChevronRight,
  Apple,
  Wheat,
  Milk,
  Droplets,
  Carrot,
  Star,
  Check,
  AlertTriangle,
  Send,
  Boxes,
  RefreshCw,
  X,
  Tag,
  Calendar,
  Clock,
  ShoppingCart,
  Workflow
} from 'lucide-react';
import { AgriHubApi, hasConfiguredBackend } from '../../api';
import { ensureOfflineDbSeeded, offlineDb } from '../../lib/offlineDb';
import {
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
  INITIAL_LOGISTICS,
  ProductItem,
  CategoryItem
} from '../../mockData';
import {
  useLanguage,
  translateCategoryName,
  translateCategoryDescription
} from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import harvestHeroImg from '../../assets/images/agrihub_bangladesh_harvest_1795088817019.jpg';
import freshMarketImg from '../../assets/images/agrihub_fresh_market_1795088815636.jpg';
import coldchainShowcaseImg from '../../assets/images/agrihub_coldchain_showcase_1794487417226.jpg';

type WorkflowStage = 'farmer' | 'collection' | 'logistics' | 'buyer';

function renderCategoryIcon(name: string, className = 'w-5 h-5') {
  const lower = name.toLowerCase();
  if (lower.includes('fruit') || lower.includes('berr')) return <Apple className={className} strokeWidth={1.75} />;
  if (lower.includes('grain') || lower.includes('cereal') || lower.includes('rice')) return <Wheat className={className} strokeWidth={1.75} />;
  if (lower.includes('dairy') || lower.includes('milk')) return <Milk className={className} strokeWidth={1.75} />;
  if (lower.includes('oil') || lower.includes('seed')) return <Droplets className={className} strokeWidth={1.75} />;
  if (lower.includes('veg')) return <Carrot className={className} strokeWidth={1.75} />;
  return <Leaf className={className} strokeWidth={1.75} />;
}

function normalizeApiProduct(p: any): ProductItem {
  return {
    id: Number(p.id),
    farmer_id: Number(p.farmer_id ?? p.farmer?.id ?? 0),
    farmerName:
      p.farmerName ||
      (p.farmer?.business_name
        ? `${p.farmer.name} (${p.farmer.business_name})`
        : p.farmer?.name || p.farmer_name || 'Verified Farmer'),
    farmLocation: p.farmLocation || p.farmer?.location || 'Rajshahi Agro Zone',
    category:
      typeof p.category === 'string'
        ? p.category
        : p.category?.name || p.category_name || 'Fresh Produce',
    category_id: Number(p.category_id ?? p.category?.id ?? 0),
    title: p.title || '',
    batchNumber: p.batchNumber || p.batch_number || '',
    harvestDate: p.harvestDate || p.harvest_date || '—',
    expiryDate: p.expiryDate || p.expiry_date || '—',
    unitPrice: Number(p.unitPrice ?? p.unit_price ?? 0),
    unitType: p.unitType || p.unit_type || 'kg',
    quantityAvailable: Number(p.quantityAvailable ?? p.quantity_available ?? 0),
    storageTempCelsius: Number(p.storageTempCelsius ?? p.storage_temp_celsius ?? 4.5),
    isOrganic: Boolean(p.isOrganic ?? p.is_organic),
    status: p.status || 'active'
  };
}

function normalizeApiCategory(c: any): CategoryItem {
  return {
    id: Number(c.id),
    name: c.name || '',
    slug: c.slug || '',
    description: c.description || '',
    skuCount: Number(c.skuCount ?? c.product_count ?? 0),
    tempRange: c.tempRange || '0°C – 18°C',
    iconName: c.iconName || 'Leaf'
  };
}

interface HomePageProps {
  targetSection?: 'how-it-works' | 'trusted-network' | 'contact';
}

export default function HomePage({ targetSection }: HomePageProps = {}) {
  const { language, tr } = useLanguage();
  const { addToCart, openOrderCheckout } = useCart();
  const location = useLocation();

  const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
  const [categories, setCategories] = useState<CategoryItem[]>(INITIAL_CATEGORIES);
  const [heroImgError, setHeroImgError] = useState(false);
  const [stageImgError, setStageImgError] = useState(false);

  useEffect(() => {
    const sectionToScroll =
      targetSection ||
      (location.pathname === '/how-it-works'
        ? 'how-it-works'
        : location.pathname === '/network'
        ? 'trusted-network'
        : location.pathname === '/contact'
        ? 'contact'
        : null);

    if (sectionToScroll) {
      const scrollTimer = setTimeout(() => {
        const element = document.getElementById(sectionToScroll);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return () => clearTimeout(scrollTimer);
    } else if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [targetSection, location.pathname]);

  // Interactive "How AgriHub Works" stage
  const [activeStage, setActiveStage] = useState<WorkflowStage>('farmer');

  // Origin Details Modal
  const [inspectLot, setInspectLot] = useState<ProductItem | null>(null);

  // Contact Inquiry Form State
  const [contactName, setContactName] = useState('');
  const [contactOrg, setContactOrg] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactRole, setContactRole] = useState('buyer');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);

  // Toast Feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInspectLot(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const loadData = async () => {
    try {
      await ensureOfflineDbSeeded();
      const [dbProds, dbCats] = await Promise.all([
        offlineDb.products.toArray(),
        offlineDb.categories.toArray()
      ]);

      if (dbProds.length > 0) {
        const sortedProds = [...dbProds].sort((a, b) => Number(b.id) - Number(a.id));
        setProducts(sortedProds);

        if (dbCats.length > 0) {
          setCategories(
            dbCats.map((c) => {
              const count = sortedProds.filter(
                (p) =>
                  p.status !== 'archived' &&
                  (Number(p.category_id) === Number(c.id) ||
                    p.category.toLowerCase() === c.name.toLowerCase())
              ).length;
              return { ...c, skuCount: count > 0 ? count : c.skuCount };
            })
          );
        }
      } else if (dbCats.length > 0) {
        setCategories(dbCats);
      }

      if (!hasConfiguredBackend()) {
        return;
      }

      const [prodsRes, catsRes] = await Promise.allSettled([
        AgriHubApi.getProducts(),
        AgriHubApi.getCategories()
      ]);
      if (
        prodsRes.status === 'fulfilled' &&
        prodsRes.value.success &&
        Array.isArray(prodsRes.value.data) &&
        prodsRes.value.data.length > 0
      ) {
        setProducts(prodsRes.value.data.map(normalizeApiProduct));
      }
      if (
        catsRes.status === 'fulfilled' &&
        catsRes.value.success &&
        Array.isArray(catsRes.value.data) &&
        catsRes.value.data.length > 0
      ) {
        setCategories(catsRes.value.data.map(normalizeApiCategory));
      }
    } catch {
      // Keep fallback produce catalog
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalInventoryValue = products.reduce(
    (acc, p) => acc + (p.quantityAvailable || 0) * (p.unitPrice || 0),
    0
  );

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactSubmitted(true);
    setTimeout(() => {
      setContactName('');
      setContactOrg('');
      setContactEmail('');
      setContactMessage('');
    }, 400);
  };

  const stages: {
    id: WorkflowStage;
    stepNum: string;
    title: string;
    shortDesc: string;
    icon: React.ReactNode;
    headline: string;
    description: string;
    bullets: string[];
    image: string;
    imageCaption: string;
  }[] = [
    {
      id: 'farmer',
      stepNum: tr('Step 01', 'ধাপ ০১'),
      title: tr('Farmer', 'কৃষক'),
      shortDesc: tr('Direct Harvest Listing', 'খামার থেকে সরাসরি ফসল'),
      icon: <Sprout className="w-5 h-5" strokeWidth={1.75} />,
      headline: tr('Harvested Fresh by Verified Bangladeshi Farmers', 'যাচাইকৃত বাংলাদেশি কৃষকদের হাতের তাজা ফসল'),
      description: tr(
        'Vetted growers and farming cooperatives across Rajshahi, Dinajpur, Bogura, and Rangpur register newly harvested crops with clear harvest dates, pricing, and organic status.',
        'রাজশাহী, দিনাজপুর, বগুড়া ও রংপুরের যাচাইকৃত কৃষক ও সমবায় সমিতি সরাসরি ক্ষেত থেকে তোলা ফসলের তারিখ, ন্যায্য দর ও মানের তথ্যসহ তালিকাভুক্ত করেন।'
      ),
      bullets: [
        tr('Direct farmer verification with NID & farm records', 'পরিচয় ও খামারের তথ্য যাচাইকৃত প্রকৃত কৃষক'),
        tr('Fair farm-gate prices without middleman layers', 'মধ্যস্বত্বভোগী ছাড়াই কৃষকের জন্য ন্যায্য মূল্য'),
        tr('Clear harvest dates and organic certification details', 'ফসল তোলার তারিখ ও অর্গানিক সনদের স্বচ্ছ তথ্য')
      ],
      image: harvestHeroImg,
      imageCaption: tr('Rajshahi Farmer Cooperative Harvest Inspection', 'রাজশাহী কৃষি সমবায়ে তাজা ফসল সংগ্রহ ও পরিদর্শন')
    },
    {
      id: 'collection',
      stepNum: tr('Step 02', 'ধাপ ০২'),
      title: tr('Collection', 'সংগ্রহ কেন্দ্র'),
      shortDesc: tr('Sorting & Cold Storage', 'বাছাই ও হিমাগার সংরক্ষণ'),
      icon: <Warehouse className="w-5 h-5" strokeWidth={1.75} />,
      headline: tr('Regional Collection Hubs & Quality Sorting', 'আঞ্চলিক সংগ্রহ কেন্দ্রে বাছাই ও মান নিয়ন্ত্রণ'),
      description: tr(
        'Produce arrives at nearby AgriHub collection hubs where batches are inspected, graded by freshness, weighed accurately, and pre-cooled inside hygienic cold storage.',
        'ফসল নিকটস্থ অ্যাগ্রিহাব সংগ্রহ কেন্দ্রে পৌঁছানোর পর সতেজতা ও আকার অনুযায়ী গ্রেডিং, সঠিক ওজন এবং স্বাস্থ্যসম্মত হিমাগারে সংরক্ষণ করা হয়।'
      ),
      bullets: [
        tr('Dedicated pre-cooling chambers protect crispness', 'ফসলের সতেজতা ধরে রাখতে আধুনিক হিমাগার ব্যবস্থা'),
        tr('Standardized grading and sealed packaging per batch', 'মান অনুযায়ী গ্রেডিং ও নিরাপদ প্যাকেজিং'),
        tr('Instant stock tracking prevents shortages or double-booking', 'সঠিক মজুত হিসাব থাকায় সরবরাহ ঘাটতি হয় না')
      ],
      image: freshMarketImg,
      imageCaption: tr('Quality-Graded Grains, Greens, Dairy & Fresh Harvests', 'মান যাচাইকৃত শস্য, সবজি, দুগ্ধ ও তাজা কৃষিপণ্য')
    },
    {
      id: 'logistics',
      stepNum: tr('Step 03', 'ধাপ ০৩'),
      title: tr('Logistics', 'পরিবহন'),
      shortDesc: tr('Cold-Chain Delivery', 'সারা দেশে কোল্ড-চেইন পরিবহন'),
      icon: <Truck className="w-5 h-5" strokeWidth={1.75} />,
      headline: tr('Reliable Refrigerated Transport Across 64 Districts', 'সারা দেশে তাপমাত্রা-নিয়ন্ত্রিত নিরাপদ পরিবহন'),
      description: tr(
        'Verified transport partners operate refrigerated trucks and covered vans on scheduled highway routes, preserving freshness from northern farms to Dhaka, Chattogram, and regional markets.',
        'নিবন্ধিত পরিবহন পার্টনাররা শীতাতপ নিয়ন্ত্রিত গাড়িতে নির্ধারিত সময়ে উত্তরবঙ্গের খামার থেকে ঢাকা, চট্টগ্রামসহ সারা দেশে পণ্য পৌঁছে দেন।'
      ),
      bullets: [
        tr('Continuous cooling below 5°C for perishable goods', 'পচনশীল পণ্যের জন্য ৫°সে-এর নিচে তাপমাত্রা সুরক্ষা'),
        tr('Scheduled dispatch routes with checkpoint updates', 'প্রতিটি যাত্রাপথে নির্দিষ্ট চেকপয়েন্ট আপডেট'),
        tr('Trained drivers handling delicate fruits, dairy & greens', 'ফল, দুগ্ধ ও সবজি পরিবহনে দক্ষ ও প্রশিক্ষিত চালক')
      ],
      image: coldchainShowcaseImg,
      imageCaption: tr('Refrigerated Transport & Cold-Chain Distribution Corridor', 'কোল্ড-চেইন পরিবহন ও নিরাপদ সরবরাহ ব্যবস্থা')
    },
    {
      id: 'buyer',
      stepNum: tr('Step 04', 'ধাপ ০৪'),
      title: tr('Buyer', 'ক্রেতা'),
      shortDesc: tr('Verified Doorstep Supply', 'নিশ্চিত ও সময়মতো সরবরাহ'),
      icon: <ShoppingBag className="w-5 h-5" strokeWidth={1.75} />,
      headline: tr('Secure Sourcing for Markets, Stores & Food Businesses', 'বাজার, সুপারশপ ও খাদ্য প্রতিষ্ঠানের জন্য নিরাপদ সংগ্রহ'),
      description: tr(
        'Retailers, superstores, restaurants, and bulk buyers order directly from verified lots with transparent pricing, protected payment terms, and reliable delivery schedules.',
        'সুপারশপ, হোটেল, খাদ্য প্রক্রিয়াজাতকারী ও পাইকারি ক্রেতারা স্বচ্ছ দামে ও নিরাপদ পেমেন্ট সুবিধায় সরাসরি যাচাইকৃত ফসল সংগ্রহ করতে পারেন।'
      ),
      bullets: [
        tr('Transparent pricing with zero hidden broker fees', 'কোনো গোপন চার্জ ছাড়াই সরাসরি ও স্বচ্ছ মূল্য'),
        tr('Protected payment release upon quality delivery', 'পণ্য বুঝে পাওয়ার পরই বিক্রেতার প্রাপ্য পরিশোধ'),
        tr('Consistent year-round sourcing across Bangladesh', 'সারা বছর নির্ভরযোগ্য ও নিয়মিত পণ্য সরবরাহ')
      ],
      image: freshMarketImg,
      imageCaption: tr('Farm-Fresh Produce Ready for Nationwide Buyers', 'সারা দেশের ক্রেতাদের জন্য প্রস্তুত তাজা কৃষিপণ্য')
    }
  ];

  const activeStageObj = stages.find(s => s.id === activeStage) || stages[0];

  return (
    <div className="space-y-24 pb-20 font-sans text-[var(--text-primary)] bg-[var(--bg-canvas)] transition-colors">
      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 right-4 z-50 agri-card flex items-center gap-3 px-4 py-3 shadow-lg text-sm font-medium max-w-md"
        >
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" strokeWidth={1.75} />}
          {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" strokeWidth={1.75} />}
          {toast.type === 'info' && <RefreshCw className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />}
          <span className="text-[var(--text-primary)]">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label={tr('Dismiss notification', 'বিজ্ঞপ্তি বন্ধ করুন')}
            className="ml-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* ================= 1. HERO SECTION ================= */}
      <section className="relative overflow-hidden pt-10 sm:pt-16 pb-24 bg-gradient-to-b from-[#d1fae5]/55 via-[var(--bg-surface)] to-[var(--bg-canvas)] dark:from-[#0b2318] dark:via-[#091710] dark:to-[#07110c] border-b border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Copy */}
            <div className="lg:col-span-7 space-y-6">


              <h1 className="text-3xl sm:text-5xl lg:text-[52px] font-extrabold text-[var(--text-primary)] tracking-tight leading-[1.12] [text-wrap:balance]">
                {tr('Buy Fresh Agricultural Produce Directly from ', 'যাচাইকৃত কৃষকদের কাছ থেকে সরাসরি ')}
                <span className="text-[#047857] dark:text-[#10b981]">
                  {tr('Verified Farmers', 'তাজা কৃষিপণ্য সংগ্রহ করুন')}
                </span>
              </h1>

              <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-2xl leading-relaxed">
                {tr(
                  'Connect directly with vetted growers, quality-checked collection hubs, and refrigerated transport across Bangladesh. Source fresh harvests securely with fair farm-gate pricing and nationwide distribution.',
                  'বাংলাদেশের যাচাইকৃত কৃষক, মানসম্মত সংগ্রহ কেন্দ্র এবং তাপমাত্রা-নিয়ন্ত্রিত পরিবহন নেটওয়ার্কের সাথে সরাসরি যুক্ত হোন। ন্যায্য দামে নিরাপদ ও তাজা কৃষিপণ্য পৌঁছে যাবে দেশের যেকোনো প্রান্তে।'
                )}
              </p>

              {/* Hero Key Benefits */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                  <Leaf className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
                  <span>{tr('Fresh Produce', 'তাজা কৃষিপণ্য')}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                  <UserCheck className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
                  <span>{tr('Verified Farmers', 'যাচাইকৃত কৃষক')}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                  <Lock className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
                  <span>{tr('Secure Sourcing', 'নিরাপদ সংগ্রহ')}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                  <Truck className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
                  <span>{tr('Nationwide Delivery', 'সারা দেশে ডেলিভারি')}</span>
                </div>
              </div>

              {/* Action Buttons (Single Primary + Non-Auth Secondary CTA) */}
              <div className="pt-2 flex flex-wrap items-center gap-3.5">
                <Link
                  to="/marketplace"
                  className="agri-btn agri-btn-primary agri-btn-lg group"
                >
                  <Store className="w-4 h-4" strokeWidth={1.75} />
                  <span>{tr('Browse Fresh Marketplace', 'তাজা পণ্যের মার্কেটপ্লেস দেখুন')}</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" strokeWidth={1.75} />
                </Link>

                <Link
                  to="/how-it-works"
                  className="agri-btn agri-btn-secondary agri-btn-lg"
                >
                  <Workflow className="w-4 h-4 text-[#047857]" strokeWidth={1.75} />
                  <span>{tr('See How It Works', 'কার্যপ্রণালী দেখুন')}</span>
                </Link>
              </div>

              {/* Unboxed Clean Trust Strip */}
              <div className="pt-6 border-t border-[var(--border-subtle)] grid grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="flex items-center gap-1.5 font-extrabold text-[var(--text-primary)] text-base sm:text-lg">
                    <BadgeCheck className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
                    <span>{formatNumber(100, language)}%</span>
                  </div>
                  <div className="text-[var(--text-muted)] font-medium text-[11px] mt-0.5">
                    {tr('Verified Grower Network', 'যাচাইকৃত কৃষক নেটওয়ার্ক')}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-extrabold text-[#047857] dark:text-[#10b981] text-base sm:text-lg">
                    <Thermometer className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
                    <span>{formatNumber(64, language)} {tr('Districts', 'জেলা')}</span>
                  </div>
                  <div className="text-[var(--text-muted)] font-medium text-[11px] mt-0.5">
                    {tr('Cold-Chain Reach', 'সারা দেশে কোল্ড-চেইন সেবা')}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-extrabold text-[var(--text-primary)] text-base sm:text-lg">
                    <ShieldCheck className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
                    <span>{tr('Protected', 'নিরাপদ')}</span>
                  </div>
                  <div className="text-[var(--text-muted)] font-medium text-[11px] mt-0.5">
                    {tr('Quality & Trade Guarantee', 'মান ও নিরাপদ লেনদেন')}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Visual Photograph */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-3xl overflow-hidden shadow-xl border-4 border-white dark:border-[#1c3629] bg-[#047857] group">
                {heroImgError ? (
                  <div className="w-full h-[380px] sm:h-[440px] bg-gradient-to-br from-[#047857] to-[#064e3b] flex flex-col items-center justify-center text-white p-8 text-center space-y-3">
                    <Sprout className="w-12 h-12 text-[#d1fae5]" strokeWidth={1.75} />
                    <div className="font-bold text-lg">
                      {tr("Bangladesh's Trusted Agricultural Trade Network", 'বাংলাদেশের বিশ্বস্ত কৃষি বাণিজ্য নেটওয়ার্ক')}
                    </div>
                  </div>
                ) : (
                  <img
                    src={harvestHeroImg}
                    alt={tr(
                      'Bangladeshi farmers inspecting fresh harvest produce with cold-chain transport',
                      'বাংলাদেশের কৃষকরা তাজা ফসল পরিদর্শন করছেন এবং কোল্ড-চেইন পরিবহন প্রস্তুত রয়েছে'
                    )}
                    referrerPolicy="no-referrer"
                    decoding="async"
                    fetchPriority="high"
                    onError={() => setHeroImgError(true)}
                    className="w-full h-[380px] sm:h-[440px] object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/25 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 2. TRADE ANALYTICS & NETWORK METRICS ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-20">
        <div className="agri-card p-6 sm:p-7 shadow-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Metric 1 */}
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#d1fae5]/75 dark:bg-[#047857]/25 border border-[#10b981]/25 text-[#047857] dark:text-[#10b981] flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div className="space-y-1 min-w-0">
              <span className="text-xs text-[var(--text-muted)] font-semibold block">
                {tr('Listed Produce Value', 'তালিকাভুক্ত পণ্যের মূল্য')}
              </span>
              <div className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] font-mono tabular-nums tracking-tight">
                {formatCurrency(totalInventoryValue, language)}
              </div>
              <div className="text-[11px] text-[#047857] dark:text-[#10b981] font-semibold">
                {tr('Transparent direct farm pricing', 'স্বচ্ছ ও সরাসরি খামার দর')}
              </div>
            </div>
          </div>

          {/* Metric 2 */}
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#d1fae5]/75 dark:bg-[#047857]/25 border border-[#10b981]/25 text-[#047857] dark:text-[#10b981] flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div className="space-y-1 min-w-0">
              <span className="text-xs text-[var(--text-muted)] font-semibold block">
                {tr('Fresh Harvest Lots', 'সক্রিয় ফসলের ব্যাচ')}
              </span>
              <div className="text-2xl font-extrabold text-[var(--text-primary)] font-mono tabular-nums tracking-tight">
                {formatNumber(products.length, language)} {tr('Lots', 'টি লট')}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                {tr('Quality-sorted and ready to ship', 'বাছাইকৃত ও ডেলিভারির জন্য প্রস্তুত')}
              </div>
            </div>
          </div>

          {/* Metric 3 */}
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#d1fae5]/75 dark:bg-[#047857]/25 border border-[#10b981]/25 text-[#047857] dark:text-[#10b981] flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div className="space-y-1 min-w-0">
              <span className="text-xs text-[var(--text-muted)] font-semibold block">
                {tr('Active Cold Routes', 'চলমান পরিবহন রুট')}
              </span>
              <div className="text-2xl font-extrabold text-[var(--text-primary)] font-mono tabular-nums tracking-tight">
                {formatNumber(INITIAL_LOGISTICS.length, language)} {tr('Routes', 'টি রুট')}
              </div>
              <div className="text-[11px] text-[#047857] dark:text-[#10b981] font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                {tr('Temperature-protected transit', 'তাপমাত্রা সুরক্ষিত পরিবহন')}
              </div>
            </div>
          </div>

          {/* Metric 4 */}
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#d1fae5]/75 dark:bg-[#047857]/25 border border-[#10b981]/25 text-[#047857] dark:text-[#10b981] flex items-center justify-center shrink-0">
              <HeartHandshake className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div className="space-y-1 min-w-0">
              <span className="text-xs text-[var(--text-muted)] font-semibold block">
                {tr('Farming Community', 'কৃষি কমিউনিটি')}
              </span>
              <div className="text-2xl font-extrabold text-[var(--text-primary)] font-mono tabular-nums tracking-tight">
                {formatNumber(240, language)}+ {tr('Partners', 'টি সমবায়')}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                {tr('Verified growers across Bangladesh', 'সারা দেশের যাচাইকৃত কৃষক ও সমবায়')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 3. SECTION A: HOW AGRIHUB WORKS ================= */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#047857] dark:text-[#10b981] uppercase tracking-wider">
            <Sprout className="w-4 h-4" strokeWidth={1.75} />
            <span>{tr('How AgriHub Works', 'অ্যাগ্রিহাব যেভাবে কাজ করে')}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight [text-wrap:balance]">
            {tr('From Bangladesh Farms to Your Doorstep in 4 Steps', 'বাংলাদেশের খামার থেকে আপনার প্রতিষ্ঠানে ৪টি সহজ ধাপে')}
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            {tr(
              'Click any stage below to see how fresh produce moves safely from Farmer → Collection → Logistics → Buyer.',
              'কৃষক → সংগ্রহ কেন্দ্র → পরিবহন → ক্রেতা—প্রতিটি ধাপে পণ্য কীভাবে নিরাপদে পৌঁছায় তা দেখতে নিচের যেকোনো ধাপে ক্লিক করুন।'
            )}
          </p>
        </div>

        {/* 4-Step Pipeline Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {stages.map((stage, idx) => {
            const isActive = activeStage === stage.id;
            return (
              <div key={stage.id} className="relative flex items-stretch">
                <button
                  type="button"
                  onClick={() => {
                    setActiveStage(stage.id);
                    setStageImgError(false);
                  }}
                  aria-pressed={isActive}
                  className={`w-full p-5 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer ${
                    isActive
                      ? 'bg-[#047857] dark:bg-[#10b981] text-white dark:text-[#042419] border-[#047857] dark:border-[#10b981] shadow-md'
                      : 'agri-card agri-card-interactive text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-[11px] font-bold font-mono uppercase tracking-wider ${
                        isActive ? 'text-[#d1fae5] dark:text-[#042419]/80' : 'text-[#047857] dark:text-[#10b981]'
                      }`}
                    >
                      {stage.stepNum}
                    </span>
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isActive
                          ? 'bg-white/15 dark:bg-[#042419]/15 text-white dark:text-[#042419]'
                          : 'bg-[#d1fae5]/75 dark:bg-[#047857]/25 text-[#047857] dark:text-[#10b981]'
                      }`}
                    >
                      {stage.icon}
                    </div>
                  </div>
                  <div>
                    <div className="font-extrabold text-base">{stage.title}</div>
                    <div
                      className={`text-xs mt-0.5 ${
                        isActive ? 'text-[#d1fae5] dark:text-[#042419]/85 font-medium' : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {stage.shortDesc}
                    </div>
                  </div>
                </button>
                {idx < stages.length - 1 && (
                  <div
                    className="hidden lg:flex items-center justify-center -mr-2.5 ml-1.5 z-10 text-[#10b981] shrink-0"
                    aria-hidden="true"
                  >
                    <ArrowRight className="w-4 h-4" strokeWidth={2} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Interactive Stage Detail Panel */}
        <div className="agri-card rounded-3xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-[#d1fae5]/75 dark:bg-[#047857]/25 border border-[#10b981]/30 text-[#047857] dark:text-[#d1fae5] text-xs font-bold">
              {activeStageObj.icon}
              <span>
                {activeStageObj.stepNum} · {activeStageObj.title}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] leading-snug">
              {activeStageObj.headline}
            </h3>

            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              {activeStageObj.description}
            </p>

            <ul className="space-y-2.5 pt-2 text-xs">
              {activeStageObj.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[var(--text-primary)] font-medium">
                  <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0 mt-0.5" strokeWidth={1.75} />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            <div className="pt-2">
              <Link to="/marketplace" className="agri-btn agri-btn-primary">
                <Store className="w-4 h-4" strokeWidth={1.75} />
                <span>{tr('Explore Available Harvests', 'উপলব্ধ ফসল দেখুন')}</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative rounded-2xl overflow-hidden border border-[var(--border-subtle)] shadow-md bg-[#047857]">
              {stageImgError ? (
                <div className="w-full h-72 sm:h-80 bg-gradient-to-br from-[#047857] to-[#064e3b] flex items-center justify-center text-[#d1fae5]">
                  <Warehouse className="w-12 h-12" strokeWidth={1.75} />
                </div>
              ) : (
                <img
                  src={activeStageObj.image}
                  alt={activeStageObj.imageCaption}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                  onError={() => setStageImgError(true)}
                  className="w-full h-72 sm:h-80 object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white text-xs font-semibold flex items-center justify-between gap-2">
                <span>{activeStageObj.imageCaption}</span>
                <span className="bg-[#047857]/90 border border-white/20 px-2.5 py-1 rounded-lg text-[11px] shrink-0">
                  {activeStageObj.stepNum}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 4. PRODUCE CATEGORIES SHOWCASE ================= */}
      <section id="categories" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#047857] dark:text-[#10b981] uppercase tracking-wider mb-1">
              <Leaf className="w-4 h-4" strokeWidth={1.75} />
              <span>{tr('Produce Categories', 'কৃষিপণ্যের বিভাগসমূহ')}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
              {tr('Browse Fresh Harvest Categories', 'বিভাগ অনুযায়ী তাজা কৃষিপণ্য')}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              {tr(
                'Sourced directly from regional farm clusters with dedicated storage standards',
                'সারা দেশের কৃষি অঞ্চল থেকে মানসম্মত সংরক্ষণে সরাসরি সংগৃহীত পণ্য'
              )}
            </p>
          </div>
          <Link
            to="/marketplace"
            className="text-xs font-bold text-[#047857] dark:text-[#10b981] hover:underline flex items-center gap-1 whitespace-nowrap"
          >
            <span>{tr('View All Categories', 'সব বিভাগ দেখুন')}</span>
            <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {categories.map(cat => {
            const catCount =
              cat.skuCount ||
              products.filter(p => p.category.toLowerCase() === cat.name.toLowerCase()).length;
            return (
              <Link
                key={cat.id}
                to={`/marketplace?category=${encodeURIComponent(cat.name)}`}
                className="agri-card agri-card-interactive p-5 group flex flex-col justify-between"
              >
                <div>
                  <div className="w-11 h-11 rounded-xl bg-[#d1fae5]/75 dark:bg-[#047857]/25 border border-[#10b981]/25 text-[#047857] dark:text-[#10b981] flex items-center justify-center group-hover:bg-[#047857] group-hover:text-white dark:group-hover:bg-[#10b981] dark:group-hover:text-[#042419] transition">
                    {renderCategoryIcon(cat.name, 'w-5 h-5')}
                  </div>

                  <h3 className="mt-4 font-bold text-[var(--text-primary)] text-sm group-hover:text-[#047857] dark:group-hover:text-[#10b981] transition">
                    {translateCategoryName(cat.name, language)}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2 leading-relaxed">
                    {translateCategoryDescription(cat.name, cat.description, language)}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-muted)] font-mono font-medium flex items-center gap-1">
                    <Boxes className="w-3.5 h-3.5 text-[#10b981]" strokeWidth={1.75} />
                    {formatNumber(catCount, language)} {tr('Lots', 'টি লট')}
                  </span>
                  <span className="text-[#047857] dark:text-[#10b981] font-bold group-hover:translate-x-0.5 transition flex items-center gap-0.5">
                    <span>{tr('Browse', 'দেখুন')}</span>
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ================= 5. FEATURED FRESH HARVEST LOTS ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#047857] dark:text-[#10b981] uppercase tracking-wider mb-1">
              <Store className="w-4 h-4" strokeWidth={1.75} />
              <span>{tr('Fresh Marketplace Highlights', 'আজকের সেরা তাজা ফসল')}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
              {tr('Featured Harvest Lots Ready to Ship', 'সরবরাহের জন্য প্রস্তুত নির্বাচিত ফসল')}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              {tr(
                'Order directly from verified Bangladeshi growers with quality assurance',
                'মানের নিশ্চয়তাসহ যাচাইকৃত কৃষকদের কাছ থেকে সরাসরি অর্ডার করুন'
              )}
            </p>
          </div>
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#047857] dark:text-[#10b981] hover:underline whitespace-nowrap"
          >
            <span>
              {tr(
                `Open Full Marketplace (${formatNumber(products.length, 'en')} Lots)`,
                `সম্পূর্ণ মার্কেটপ্লেস দেখুন (${formatNumber(products.length, 'bn')}টি লট)`
              )}
            </span>
            <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {products.slice(0, 3).map(product => {
            const isOutOfStock = (product.quantityAvailable || 0) <= 0;
            const isLowStock = (product.quantityAvailable || 0) > 0 && (product.quantityAvailable || 0) <= 200;
            const stockPct = Math.min(100, Math.round(((product.quantityAvailable || 0) / 3000) * 100));

            return (
              <div
                key={product.id}
                className="agri-card agri-card-interactive overflow-hidden flex flex-col justify-between group"
              >
                <div className="p-5 space-y-3.5">
                  {/* Unboxed Category + Clean Status Strip */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)] text-[11px]">
                    <span className="inline-flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                      {renderCategoryIcon(product.category, 'w-4 h-4 text-[#047857] dark:text-[#10b981]')}
                      <span>{translateCategoryName(product.category, language)}</span>
                    </span>
                    <div className="inline-flex items-center gap-2 text-[var(--text-secondary)] font-semibold">
                      {product.isOrganic && (
                        <span className="inline-flex items-center gap-1 text-[#047857] dark:text-[#10b981]">
                          <Leaf className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>{tr('Organic', 'অর্গানিক')}</span>
                        </span>
                      )}
                      {product.isOrganic && <span aria-hidden="true">·</span>}
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Thermometer className="w-3.5 h-3.5 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
                        {product.storageTempCelsius}°C
                      </span>
                    </div>
                  </div>

                  <h3 className="font-bold text-[var(--text-primary)] text-base leading-snug group-hover:text-[#047857] dark:group-hover:text-[#10b981] transition">
                    {product.title}
                  </h3>

                  {/* Unboxed Metadata */}
                  <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                    <div className="flex items-center gap-2 font-mono text-[11px] text-[#047857] dark:text-[#10b981] font-semibold">
                      <Tag className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                      <span>{product.batchNumber}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
                      <span className="truncate">{product.farmLocation}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <BadgeCheck className="w-3.5 h-3.5 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
                      <span className="truncate">
                        {tr('Verified Farmer:', 'যাচাইকৃত কৃষক:')}{' '}
                        <strong className="text-[var(--text-primary)]">{product.farmerName}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Stock indicator */}
                  <div className="pt-1 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-muted)] text-[11px] flex items-center gap-1.5">
                        <Boxes className="w-3.5 h-3.5" strokeWidth={1.75} />
                        {tr('Available:', 'উপলব্ধ:')}
                      </span>
                      <span className="font-mono font-bold text-[var(--text-primary)]">
                        {isOutOfStock ? (
                          <span className="text-red-600 dark:text-red-400">{tr('Out of Stock', 'মজুত শেষ')}</span>
                        ) : isLowStock ? (
                          <span className="text-amber-700 dark:text-amber-400">
                            {formatNumber(product.quantityAvailable, language)} {product.unitType} ({tr('Low Stock', 'সীমিত')})
                          </span>
                        ) : (
                          `${formatNumber(product.quantityAvailable, language)} ${product.unitType}`
                        )}
                      </span>
                    </div>
                    <div className="w-full bg-[var(--bg-surface-muted)] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isOutOfStock ? 'bg-red-500' : isLowStock ? 'bg-amber-500' : 'bg-[#047857] dark:bg-[#10b981]'
                        }`}
                        style={{ width: `${Math.max(6, stockPct)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="px-5 py-4 bg-[var(--bg-surface-muted)] border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
                      {tr('Trade Price', 'নির্ধারিত দর')}
                    </div>
                    <div className="text-lg font-extrabold text-[var(--text-primary)] font-mono tabular-nums truncate">
                      {formatCurrency(product.unitPrice, language)}
                      <span className="text-xs font-normal text-[var(--text-muted)] font-sans">/{product.unitType}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setInspectLot(product)}
                      aria-label={tr(`View origin details for ${product.title}`, `${product.title} এর উৎস তথ্য দেখুন`)}
                      className="agri-btn agri-btn-secondary agri-btn-sm h-9 w-9 p-0"
                      title={tr('Origin & Quality Details', 'উৎস ও মানের তথ্য')}
                    >
                      <ShieldCheck className="w-4 h-4 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
                    </button>

                    <button
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => addToCart(product)}
                      aria-label={tr(`Add ${product.title} to cart`, `${product.title} কার্টে যোগ করুন`)}
                      title={tr('Add to Trade Cart', 'কার্টে যোগ করুন')}
                      className="agri-btn agri-btn-secondary agri-btn-sm h-9 w-9 p-0"
                    >
                      <ShoppingCart className="w-4 h-4 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
                    </button>

                    <button
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => openOrderCheckout(product, Math.min(250, product.quantityAvailable || 100))}
                      className="agri-btn agri-btn-primary agri-btn-sm h-9"
                    >
                      <ShoppingBag className="w-4 h-4" strokeWidth={1.75} />
                      <span>{isOutOfStock ? tr('Sold Out', 'শেষ') : tr('Order Now', 'অর্ডার করুন')}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ================= 6. SECTION B: TRUSTED NETWORK ================= */}
      <section
        id="trusted-network"
        className="bg-[#d1fae5]/25 dark:bg-[#0a1911] py-16 border-y border-[var(--border-subtle)] scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#047857] dark:text-[#10b981] uppercase tracking-wider mb-1">
                <Users className="w-4 h-4" strokeWidth={1.75} />
                <span>{tr('Trusted Network', 'বিশ্বস্ত বাণিজ্য নেটওয়ার্ক')}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
                {tr(
                  'Connecting Verified Farmers, Suppliers & Buyers Nationwide',
                  'সারা দেশের যাচাইকৃত কৃষক, সরবরাহকারী ও ক্রেতাদের এক নির্ভরযোগ্য মেলবন্ধন'
                )}
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5">
                {tr(
                  'Every member in the AgriHub community completes identity, farm, or trade license verification before participating.',
                  'অ্যাগ্রিহাব কমিউনিটির প্রতিটি কৃষক, পরিবহন পার্টনার এবং ক্রেতা পরিচয় ও কাগজপত্র যাচাইয়ের পর যুক্ত হন।'
                )}
              </p>
            </div>

            <Link to="/contact" className="agri-btn agri-btn-primary self-start md:self-auto">
              <HeartHandshake className="w-4 h-4" strokeWidth={1.75} />
              <span>{tr('Partner With Us', 'আমাদের সাথে যুক্ত হোন')}</span>
            </Link>
          </div>

          {/* Three Core Verified Partner Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Verified Farmers */}
            <div className="agri-card agri-card-interactive p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#d1fae5]/80 dark:bg-[#047857]/30 border border-[#10b981]/30 text-[#047857] dark:text-[#10b981] flex items-center justify-center shrink-0">
                    <Sprout className="w-6 h-6" strokeWidth={1.75} />
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#047857] dark:text-[#10b981]">
                    <UserCheck className="w-4 h-4" strokeWidth={1.75} />
                    {tr('Verified Farmers', 'যাচাইকৃত কৃষক')}
                  </span>
                </div>

                <div>
                  <h3 className="font-extrabold text-[var(--text-primary)] text-lg">
                    {tr('Verified Farmers & Co-ops', 'যাচাইকৃত কৃষক ও সমবায়')}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                    {tr(
                      'Growers in Rajshahi, Dinajpur, Bogura, Rangpur, and Jessore sell fresh crops directly at fair prices without middlemen.',
                      'রাজশাহী, দিনাজপুর, বগুড়া, রংপুর ও যশোরের নিবন্ধিত কৃষকরা কোনো মধ্যস্বত্বভোগী ছাড়াই ন্যায্য দামে সরাসরি ফসল বিক্রি করেন।'
                    )}
                  </p>
                </div>

                <ul className="space-y-2 text-xs text-[var(--text-primary)] pt-2 border-t border-[var(--border-subtle)]">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#10b981] stroke-[2.25] shrink-0" />
                    <span>{tr('Identity & farm location verified', 'পরিচয় ও খামারের অবস্থান যাচাইকৃত')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#10b981] stroke-[2.25] shrink-0" />
                    <span>{tr('Direct harvest listing & fair payouts', 'সরাসরি মূল্য নির্ধারণ ও দ্রুত অর্থপ্রাপ্তি')}</span>
                  </li>
                </ul>
              </div>

              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>
                  <strong className="text-[var(--text-primary)]">{formatNumber(240, language)}+</strong> {tr('Active Co-ops', 'টি সমবায়')}
                </span>
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {formatNumber(4.9, language)} / {formatNumber(5, language)}
                </span>
              </div>
            </div>

            {/* 2. Verified Suppliers */}
            <div className="agri-card agri-card-interactive p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#d1fae5]/80 dark:bg-[#047857]/30 border border-[#10b981]/30 text-[#047857] dark:text-[#10b981] flex items-center justify-center shrink-0">
                    <Warehouse className="w-6 h-6" strokeWidth={1.75} />
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#047857] dark:text-[#10b981]">
                    <Truck className="w-4 h-4" strokeWidth={1.75} />
                    {tr('Verified Suppliers', 'যাচাইকৃত সরবরাহকারী')}
                  </span>
                </div>

                <div>
                  <h3 className="font-extrabold text-[var(--text-primary)] text-lg">
                    {tr('Verified Storage & Transport', 'যাচাইকৃত হিমাগার ও পরিবহন')}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                    {tr(
                      'Regional packhouses, cold storages, and refrigerated truck fleets keep every perishable lot fresh along highway routes.',
                      'আঞ্চলিক সংগ্রহ কেন্দ্র, হিমাগার এবং শীতাতপ নিয়ন্ত্রিত ট্রাক বহর পরিবহনের প্রতিটি ধাপে ফসলের সতেজতা অক্ষুণ্ণ রাখে।'
                    )}
                  </p>
                </div>

                <ul className="space-y-2 text-xs text-[var(--text-primary)] pt-2 border-t border-[var(--border-subtle)]">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#10b981] stroke-[2.25] shrink-0" />
                    <span>{tr('Temperature-controlled cold storage hubs', 'তাপমাত্রা-নিয়ন্ত্রিত আধুনিক হিমাগার')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#10b981] stroke-[2.25] shrink-0" />
                    <span>{tr('Insured highway cold-chain fleet', 'নিরাপদ ও নির্ধারিত সময়ে পরিবহন')}</span>
                  </li>
                </ul>
              </div>

              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>
                  <strong className="text-[var(--text-primary)]">{formatNumber(48, language)}</strong> {tr('Cold Fleet Trucks', 'টি কোল্ড-চেইন ট্রাক')}
                </span>
                <span className="flex items-center gap-1 text-[#047857] dark:text-[#10b981] font-bold">
                  <CheckCircle2 className="w-4 h-4" strokeWidth={1.75} /> {formatNumber(99.4, language)}% {tr('On-Time', 'সময়মতো')}
                </span>
              </div>
            </div>

            {/* 3. Verified Buyers */}
            <div className="agri-card agri-card-interactive p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#d1fae5]/80 dark:bg-[#047857]/30 border border-[#10b981]/30 text-[#047857] dark:text-[#10b981] flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6" strokeWidth={1.75} />
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#047857] dark:text-[#10b981]">
                    <BadgeCheck className="w-4 h-4" strokeWidth={1.75} />
                    {tr('Verified Buyers', 'যাচাইকৃত ক্রেতা')}
                  </span>
                </div>

                <div>
                  <h3 className="font-extrabold text-[var(--text-primary)] text-lg">
                    {tr('Verified Buyers & Retailers', 'যাচাইকৃত ক্রেতা ও বাজার')}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                    {tr(
                      'Supermarkets, retail chains, restaurants, and food processors across Dhaka, Chattogram, and Sylhet source confidently.',
                      'ঢাকা, চট্টগ্রাম, সিলেটসহ সারা দেশের সুপারশপ, হোটেল, রেস্তোরাঁ ও খাদ্য প্রতিষ্ঠানগুলো নিশ্চিন্তে তাজা পণ্য সংগ্রহ করে।'
                    )}
                  </p>
                </div>

                <ul className="space-y-2 text-xs text-[var(--text-primary)] pt-2 border-t border-[var(--border-subtle)]">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#10b981] stroke-[2.25] shrink-0" />
                    <span>{tr('Consistent grade & weight assurance', 'নির্ধারিত মান ও সঠিক ওজনের নিশ্চয়তা')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#10b981] stroke-[2.25] shrink-0" />
                    <span>{tr('Direct recurring harvest scheduling', 'নিয়মিত সাপ্তাহিক বা মাসিক সংগ্রহ সুবিধা')}</span>
                  </li>
                </ul>
              </div>

              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>
                  <strong className="text-[var(--text-primary)]">{formatNumber(180, language)}+</strong> {tr('Trade Buyers', 'টি বাণিজ্যিক ক্রেতা')}
                </span>
                <span className="flex items-center gap-1 text-[#047857] dark:text-[#10b981] font-bold">
                  <ShieldCheck className="w-4 h-4" strokeWidth={1.75} /> {tr('Trade Protected', 'সুরক্ষিত')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 7. SECTION C: WHY CHOOSE AGRIHUB ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#047857] dark:text-[#10b981] uppercase tracking-wider">
            <BadgeCheck className="w-4 h-4" strokeWidth={1.75} />
            <span>{tr('Why Choose AgriHub', 'কেন অ্যাগ্রিহাব বেছে নেবেন')}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight [text-wrap:balance]">
            {tr(
              'Built for Trust, Freshness & Faster Agricultural Trade',
              'আস্থা, সতেজতা ও দ্রুত কৃষি বাণিজ্যের নির্ভরযোগ্য মাধ্যম'
            )}
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            {tr(
              'Replace informal middlemen and uncertain quality with transparent sourcing across Bangladesh.',
              'অস্বচ্ছ মধ্যস্বত্বভোগী ও অনিশ্চিত মানের বদলে সরাসরি খামার থেকে নিরাপদ বাণিজ্য নিশ্চিত করুন।'
            )}
          </p>
        </div>

        {/* 4 Core Value Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="agri-card agri-card-interactive p-6 space-y-3">
            <div className="w-11 h-11 rounded-xl bg-[#d1fae5]/75 dark:bg-[#047857]/25 border border-[#10b981]/25 text-[#047857] dark:text-[#10b981] flex items-center justify-center">
              <Lock className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <h3 className="font-bold text-[var(--text-primary)] text-base">
              {tr('Secure Transactions', 'নিরাপদ লেনদেন')}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {tr(
                'Order stock is reserved immediately and payments remain protected until fresh produce is delivered and accepted.',
                'অর্ডার করার সাথে সাথেই মজুত সংরক্ষিত হয় এবং পণ্য বুঝে পাওয়ার পরই নিরাপদে অর্থ পরিশোধ সম্পন্ন হয়।'
              )}
            </p>
          </div>

          <div className="agri-card agri-card-interactive p-6 space-y-3">
            <div className="w-11 h-11 rounded-xl bg-[#d1fae5]/75 dark:bg-[#047857]/25 border border-[#10b981]/25 text-[#047857] dark:text-[#10b981] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <h3 className="font-bold text-[var(--text-primary)] text-base">
              {tr('Traceable Products', 'পণ্যের পূর্ণ উৎস তথ্য')}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {tr(
                'Every harvest batch carries its farm origin, harvest date, farmer verification, and cold-storage handling history.',
                'প্রতিটি ফসলের ব্যাচে খামারের অবস্থান, সংগ্রহের তারিখ, কৃষকের পরিচয় ও সংরক্ষণের তথ্য স্পষ্টভাবে উল্লেখ থাকে।'
              )}
            </p>
          </div>

          <div className="agri-card agri-card-interactive p-6 space-y-3">
            <div className="w-11 h-11 rounded-xl bg-[#d1fae5]/75 dark:bg-[#047857]/25 border border-[#10b981]/25 text-[#047857] dark:text-[#10b981] flex items-center justify-center">
              <BadgeCheck className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <h3 className="font-bold text-[var(--text-primary)] text-base">
              {tr('Quality Assurance', 'গুণগত মানের নিশ্চয়তা')}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {tr(
                'Dedicated hub inspection checks freshness, organic compliance, and continuous cooling below 5°C.',
                'সংগ্রহ কেন্দ্রে সতেজতা, অর্গানিক মান এবং ৫°সে-এর নিচে তাপমাত্রা নিয়ন্ত্রণ নিয়মিত পরীক্ষা করা হয়।'
              )}
            </p>
          </div>

          <div className="agri-card agri-card-interactive p-6 space-y-3">
            <div className="w-11 h-11 rounded-xl bg-[#d1fae5]/75 dark:bg-[#047857]/25 border border-[#10b981]/25 text-[#047857] dark:text-[#10b981] flex items-center justify-center">
              <TrendingUp className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <h3 className="font-bold text-[var(--text-primary)] text-base">
              {tr('Faster Procurement', 'দ্রুত ও সহজ সংগ্রহ')}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {tr(
                'Browse real-time availability, compare transparent farm prices, and schedule nationwide delivery in minutes.',
                'তাৎক্ষণিক মজুত ও সরাসরি দাম দেখে কয়েক মিনিটের মধ্যেই সারা দেশে ডেলিভারির জন্য অর্ডার সম্পন্ন করুন।'
              )}
            </p>
          </div>
        </div>

        {/* Comparison Card */}
        <div className="agri-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-surface-muted)] border-b border-[var(--border-subtle)] text-[var(--text-secondary)] font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-4 px-6">{tr('Trade Advantage', 'গুরুত্বপূর্ণ সুবিধা')}</th>
                  <th className="py-4 px-6 bg-[#d1fae5]/55 dark:bg-[#047857]/30 text-[#047857] dark:text-[#d1fae5] font-bold">
                    {tr('AgriHub Trade Network', 'অ্যাগ্রিহাব কৃষি বাণিজ্য নেটওয়ার্ক')}
                  </th>
                  <th className="py-4 px-6 text-[var(--text-muted)]">
                    {tr('Traditional Middlemen', 'প্রচলিত দালাল ও মধ্যস্বত্বভোগী ব্যবস্থা')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-xs">
                <tr>
                  <td className="py-4 px-6 font-semibold text-[var(--text-primary)]">
                    {tr('Direct Farm Pricing', 'সরাসরি খামার মূল্য')}
                  </td>
                  <td className="py-4 px-6 bg-[#d1fae5]/20 dark:bg-[#047857]/15 text-[#047857] dark:text-[#d1fae5] font-bold">
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" strokeWidth={1.75} />
                      {tr('0% hidden broker commission', '০% গোপন কমিশন, সরাসরি ন্যায্য দর')}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-2">
                      <X className="w-4 h-4 text-red-500 shrink-0" strokeWidth={1.75} />
                      {tr('18% – 30% extra middleman markups', '১৮% – ৩০% বাড়তি মধ্যস্বত্বভোগী খরচ')}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-semibold text-[var(--text-primary)]">
                    {tr('Freshness & Cold Storage', 'সতেজতা ও হিমাগার সুরক্ষা')}
                  </td>
                  <td className="py-4 px-6 bg-[#d1fae5]/20 dark:bg-[#047857]/15 text-[#047857] dark:text-[#d1fae5] font-bold">
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" strokeWidth={1.75} />
                      {tr('Cold-chain protected delivery nationwide', 'তাপমাত্রা-নিয়ন্ত্রিত পরিবহনে তাজা পণ্য')}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-2">
                      <X className="w-4 h-4 text-red-500 shrink-0" strokeWidth={1.75} />
                      {tr('High spoilage in open transit', 'খোলা পরিবহনে ফসল নষ্ট হওয়ার ঝুঁকি')}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-semibold text-[var(--text-primary)]">
                    {tr('Verified Origin & Organic Grade', 'যাচাইকৃত উৎস ও অর্গানিক মান')}
                  </td>
                  <td className="py-4 px-6 bg-[#d1fae5]/20 dark:bg-[#047857]/15 text-[#047857] dark:text-[#d1fae5] font-bold">
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" strokeWidth={1.75} />
                      {tr('Vetted farmers with clear harvest records', 'যাচাইকৃত কৃষক ও স্পষ্ট সংগ্রহের তারিখ')}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-2">
                      <X className="w-4 h-4 text-red-500 shrink-0" strokeWidth={1.75} />
                      {tr('Mixed lots with no origin records', 'উৎসবিহীন ও মিশ্রিত পণ্যের ঝুঁকি')}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-semibold text-[var(--text-primary)]">
                    {tr('Payment Protection', 'নিরাপদ অর্থ লেনদেন')}
                  </td>
                  <td className="py-4 px-6 bg-[#d1fae5]/20 dark:bg-[#047857]/15 text-[#047857] dark:text-[#d1fae5] font-bold">
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" strokeWidth={1.75} />
                      {tr('Protected payment settled after delivery check', 'পণ্য যাচাইয়ের পর নিরাপদে অর্থ পরিশোধ')}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-2">
                      <X className="w-4 h-4 text-red-500 shrink-0" strokeWidth={1.75} />
                      {tr('Delayed payments and high credit risk', 'বকেয়া ও অনিশ্চিত লেনদেনের ঝুঁকি')}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ================= 8. CONTACT & PARTNERSHIP SECTION ================= */}
      <section id="contact" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-20">
        <div className="agri-card rounded-3xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-4">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#047857] dark:text-[#10b981] uppercase tracking-wider">
              <Send className="w-4 h-4" strokeWidth={1.75} />
              <span>{tr('Partner With AgriHub', 'যোগাযোগ ও পার্টনারশিপ')}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
              {tr('Connect Your Farm, Transport Fleet, or Store', 'আপনার খামার, পরিবহন বা ব্যবসা যুক্ত করুন')}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              {tr(
                'Whether you represent a farmer cooperative, cold storage facility, transport partner, or retail buyer across Bangladesh, our trade team is ready to help.',
                'আপনি কৃষক সমবায়, হিমাগার, পরিবহন পার্টনার বা বাণিজ্যিক ক্রেতা যাই হোন না কেন—আমাদের দল আপনাকে সহায়তা করতে প্রস্তুত।'
              )}
            </p>

            <div className="space-y-3 pt-3 text-xs">
              <div className="flex items-center gap-2.5 text-[var(--text-primary)]">
                <Sprout className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
                <span>{tr('Direct onboarding for farmers & regional cooperatives', 'কৃষক ও আঞ্চলিক সমবায়ের জন্য সহজ নিবন্ধন')}</span>
              </div>
              <div className="flex items-center gap-2.5 text-[var(--text-primary)]">
                <Truck className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
                <span>{tr('Nationwide cold-chain transport coordination', 'সারা দেশে কোল্ড-চেইন পরিবহন সমন্বয়')}</span>
              </div>
              <div className="flex items-center gap-2.5 text-[var(--text-primary)]">
                <ShieldCheck className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
                <span>{tr('Dedicated quality & trade support team', 'নিবেদিত মান যাচাই ও বাণিজ্য সহায়তা দল')}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-[#d1fae5]/25 dark:bg-[#0a1810] border border-[var(--border-subtle)] rounded-2xl p-6">
            {contactSubmitted ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 bg-[#d1fae5] dark:bg-[#047857]/40 text-[#047857] dark:text-[#10b981] rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" strokeWidth={1.75} />
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  {tr('Request Received Successfully', 'আপনার বার্তা সফলভাবে পাঠানো হয়েছে')}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                  {tr(
                    'Thank you! An AgriHub trade coordinator will review your inquiry and contact you shortly.',
                    'ধন্যবাদ! অ্যাগ্রিহাবের একজন বাণিজ্য সমন্বয়কারী আপনার বার্তা দেখে দ্রুত যোগাযোগ করবেন।'
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setContactSubmitted(false)}
                  className="agri-btn agri-btn-ghost text-[#047857] dark:text-[#10b981]"
                >
                  {tr('Send another message', 'আরেকটি বার্তা পাঠান')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="contact-name" className="block text-[var(--text-primary)] font-bold mb-1">
                      {tr('Full Name', 'আপনার পূর্ণ নাম')}
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      value={contactName}
                      onChange={e => setContactName(e.target.value)}
                      placeholder={tr('e.g. Farhan Chowdhury', 'যেমন: ফারহান চৌধুরী')}
                      className="agri-input bg-[var(--bg-surface)]"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-org" className="block text-[var(--text-primary)] font-bold mb-1">
                      {tr('Farm / Organization', 'খামার বা প্রতিষ্ঠানের নাম')}
                    </label>
                    <input
                      id="contact-org"
                      type="text"
                      required
                      value={contactOrg}
                      onChange={e => setContactOrg(e.target.value)}
                      placeholder={tr('e.g. Bengal Fresh Ltd.', 'যেমন: বেঙ্গল ফ্রেশ লিমিটেড')}
                      className="agri-input bg-[var(--bg-surface)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="contact-email" className="block text-[var(--text-primary)] font-bold mb-1">
                      {tr('Email Address', 'ইমেইল ঠিকানা')}
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      value={contactEmail}
                      onChange={e => setContactEmail(e.target.value)}
                      placeholder="name@company.bd"
                      className="agri-input bg-[var(--bg-surface)]"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-role" className="block text-[var(--text-primary)] font-bold mb-1">
                      {tr('Your Role', 'আপনার ভূমিকা')}
                    </label>
                    <select
                      id="contact-role"
                      value={contactRole}
                      onChange={e => setContactRole(e.target.value)}
                      className="agri-input bg-[var(--bg-surface)]"
                    >
                      <option value="buyer">{tr('Verified Buyer / Store', 'ক্রেতা / ব্যবসায়ী')}</option>
                      <option value="farmer">{tr('Farmer / Cooperative', 'কৃষক / সমবায় সমিতি')}</option>
                      <option value="supplier">{tr('Cold Storage / Transport Partner', 'হিমাগার ও পরিবহন পার্টনার')}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-[var(--text-primary)] font-bold mb-1">
                    {tr('Produce or Trade Requirements', 'পণ্য বা বাণিজ্যের বিবরণ')}
                  </label>
                  <textarea
                    id="contact-message"
                    rows={3}
                    required
                    value={contactMessage}
                    onChange={e => setContactMessage(e.target.value)}
                    placeholder={tr(
                      'Share crop types, monthly quantities, or delivery regions...',
                      'ফসলের ধরন, প্রয়োজনীয় পরিমাণ বা ডেলিভারির জেলা উল্লেখ করুন...'
                    )}
                    className="agri-input bg-[var(--bg-surface)]"
                  />
                </div>

                <button type="submit" className="agri-btn agri-btn-primary w-full py-3">
                  <Send className="w-4 h-4" strokeWidth={1.75} />
                  <span>{tr('Submit Trade Inquiry', 'অনুরোধ জমা দিন')}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ================= PRODUCT ORIGIN & QUALITY MODAL ================= */}
      {inspectLot && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-origin-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="agri-card max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#d1fae5] dark:bg-[#047857]/30 text-[#047857] dark:text-[#10b981] flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 id="home-origin-modal-title" className="font-bold text-[var(--text-primary)] text-sm leading-tight">
                    {tr('Product Origin & Quality Card', 'পণ্যের উৎস ও মান সনদ')}
                  </h3>
                  <div className="font-mono text-[11px] text-[#047857] dark:text-[#10b981]">{inspectLot.batchNumber}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectLot(null)}
                aria-label={tr('Close origin details', 'তথ্য বন্ধ করুন')}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--bg-surface-muted)] transition"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] rounded-xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--text-muted)]">{tr('Product Name:', 'পণ্যের নাম:')}</span>
                  <span className="font-bold text-[var(--text-primary)] text-right">{inspectLot.title}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--text-muted)]">{tr('Verified Farmer:', 'যাচাইকৃত কৃষক:')}</span>
                  <span className="font-semibold text-[var(--text-primary)] text-right">{inspectLot.farmerName}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--text-muted)]">{tr('Farm Location:', 'খামারের অবস্থান:')}</span>
                  <span className="text-[var(--text-secondary)] text-right">{inspectLot.farmLocation}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" strokeWidth={1.75} />
                    {tr('Harvest Date:', 'সংগ্রহের তারিখ:')}
                  </span>
                  <span className="font-mono text-[var(--text-primary)]">{inspectLot.harvestDate}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
                    {tr('Best Before:', 'সংরক্ষণ মেয়াদ:')}
                  </span>
                  <span className="font-mono text-[var(--text-primary)]">{inspectLot.expiryDate}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--text-muted)]">{tr('Storage Temp:', 'সংরক্ষণ তাপমাত্রা:')}</span>
                  <span className="font-mono font-bold text-[#047857] dark:text-[#10b981]">{inspectLot.storageTempCelsius}°C</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--text-muted)]">{tr('Growing Standard:', 'উৎপাদন মান:')}</span>
                  <span className="font-semibold text-[#047857] dark:text-[#10b981]">
                    {inspectLot.isOrganic
                      ? tr('Certified Organic', 'সার্টিফাইড অর্গানিক')
                      : tr('Farm-Fresh Standard', 'স্বাভাবিক মানসম্মত')}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-[#d1fae5]/45 dark:bg-[#047857]/20 border border-[#10b981]/30 rounded-xl text-[11px] text-[#047857] dark:text-[#d1fae5] space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <BadgeCheck className="w-4 h-4 text-[#10b981] shrink-0" strokeWidth={1.75} />
                  <span>{tr('Verified Quality Record', 'যাচাইকৃত মানের রেকর্ড')}</span>
                </div>
                <p className="opacity-90 leading-relaxed">
                  {tr(
                    'This harvest lot comes from a vetted producer and is stored under temperature-controlled protection.',
                    'এই ফসলটি যাচাইকৃত কৃষকের কাছ থেকে সংগৃহীত এবং নির্ধারিত তাপমাত্রায় সুরক্ষিত রয়েছে।'
                  )}
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInspectLot(null)}
                className="agri-btn agri-btn-secondary"
              >
                {tr('Close', 'বন্ধ করুন')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const lot = inspectLot;
                  setInspectLot(null);
                  openOrderCheckout(lot, Math.min(250, lot.quantityAvailable || 100));
                }}
                className="agri-btn agri-btn-primary"
              >
                {tr('Order This Lot', 'অর্ডার করুন')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
