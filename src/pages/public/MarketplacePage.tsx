import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Sprout,
  CheckCircle2,
  Thermometer,
  MapPin,
  ShoppingBag,
  Store,
  X,
  AlertTriangle,
  ShieldCheck,
  BadgeCheck,
  RefreshCw,
  Apple,
  Wheat,
  Milk,
  Droplets,
  Carrot,
  Leaf,
  Calendar,
  Clock,
  Boxes,
  Tag,
  Star,
  ShoppingCart
} from 'lucide-react';
import { AgriHubApi, hasConfiguredBackend } from '../../api';
import { ensureOfflineDbSeeded, offlineDb } from '../../lib/offlineDb';
import {
  mergeServerCategoriesToDexie,
  mergeServerProductsToDexie
} from '../../lib/syncService';
import {
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
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

function renderCategoryIcon(name: string, className = 'w-4 h-4') {
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
    status: p.status || 'active',
    imageUrl: p.imageUrl || p.image_url || undefined
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

export default function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { language, tr } = useLanguage();
  const { addToCart, openOrderCheckout } = useCart();

  const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
  const [categories, setCategories] = useState<CategoryItem[]>(INITIAL_CATEGORIES);
  const [loading, setLoading] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>(
    searchParams.get('q') || searchParams.get('search') || ''
  );
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('category') || 'all');
  const [organicOnly, setOrganicOnly] = useState<boolean>(searchParams.get('organic') === 'true');
  const [inStockOnly] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'qty_desc'>('newest');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 12;

  const [inspectLot, setInspectLot] = useState<ProductItem | null>(null);
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

  const loadMarketData = async () => {
    setLoading(true);
    try {
      await ensureOfflineDbSeeded();
      const [localProds, localCats] = await Promise.all([
        offlineDb.products.toArray(),
        offlineDb.categories.toArray()
      ]);
      if (localProds.length > 0) {
        setProducts([...localProds].sort((a, b) => Number(b.id) - Number(a.id)));
      }
      if (localCats.length > 0) {
        setCategories(localCats);
      }

      if (!hasConfiguredBackend()) {
        return;
      }

      const [prodsRes, catsRes] = await Promise.allSettled([
        AgriHubApi.getProducts(),
        AgriHubApi.getCategories()
      ]);

      const nowIso = new Date().toISOString();
      if (prodsRes.status === 'fulfilled' && prodsRes.value.success && Array.isArray(prodsRes.value.data) && prodsRes.value.data.length > 0) {
        const normalized = prodsRes.value.data.map((raw: any) => ({
          ...normalizeApiProduct(raw),
          syncStatus: 'synced' as const,
          localUpdatedAt: nowIso,
          serverUpdatedAt: raw.updated_at || raw.created_at || nowIso
        }));
        await mergeServerProductsToDexie(normalized);
        const refreshed = await offlineDb.products.toArray();
        setProducts([...refreshed].sort((a, b) => Number(b.id) - Number(a.id)));
      }
      if (catsRes.status === 'fulfilled' && catsRes.value.success && Array.isArray(catsRes.value.data) && catsRes.value.data.length > 0) {
        const normalizedCats = catsRes.value.data.map((raw: any) => ({
          ...normalizeApiCategory(raw),
          syncStatus: 'synced' as const,
          localUpdatedAt: nowIso,
          serverUpdatedAt: raw.created_at || nowIso
        }));
        await mergeServerCategoriesToDexie(normalizedCats);
        setCategories(await offlineDb.categories.toArray());
      }
    } catch {
      // Keep IndexedDB / fallback catalog
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarketData();
  }, []);

  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) setSelectedCategory(cat);
    const qParam = searchParams.get('q') || searchParams.get('search');
    if (qParam !== null) setSearchQuery(qParam);
  }, [searchParams]);

  const updateCategoryFilter = (catName: string) => {
    setSelectedCategory(catName);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (catName === 'all') next.delete('category');
      else next.set('category', catName);
      return next;
    });
  };

  const updateOrganicFilter = (checked: boolean) => {
    setOrganicOnly(checked);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (checked) next.set('organic', 'true');
      else next.delete('organic');
      return next;
    });
  };

  const filteredProducts = useMemo(() => {
    const result = products.filter(p => {
      if (p.status === 'archived') return false;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        q === '' ||
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.batchNumber.toLowerCase().includes(q) ||
        p.farmerName.toLowerCase().includes(q) ||
        p.farmLocation.toLowerCase().includes(q);

      const matchCategory =
        selectedCategory === 'all' ||
        p.category.toLowerCase().includes(selectedCategory.toLowerCase());

      const matchOrganic = !organicOnly || p.isOrganic;
      const matchStock = !inStockOnly || (p.quantityAvailable || 0) > 0;

      return matchQuery && matchCategory && matchOrganic && matchStock;
    });

    result.sort((a, b) => {
      if (sortBy === 'price_asc') return (a.unitPrice || 0) - (b.unitPrice || 0);
      if (sortBy === 'price_desc') return (b.unitPrice || 0) - (a.unitPrice || 0);
      if (sortBy === 'qty_desc') return (b.quantityAvailable || 0) - (a.quantityAvailable || 0);
      return (b.id || 0) - (a.id || 0);
    });

    return result;
  }, [products, searchQuery, selectedCategory, organicOnly, inStockOnly, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, organicOnly, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, currentPage]);

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col font-sans transition-colors">
      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 right-4 left-4 sm:left-auto z-50 agri-card flex items-center gap-3 px-4 py-3 shadow-lg text-sm font-medium max-w-md"
        >
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" strokeWidth={1.75} />}
          {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" strokeWidth={1.75} />}
          {toast.type === 'info' && <RefreshCw className="w-4 h-4 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />}
          <span className="text-[var(--text-primary)] text-xs sm:text-sm">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label={tr('Dismiss notification', 'বিজ্ঞপ্তি বন্ধ করুন')}
            className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* Marketplace Header & Category Cards */}
      <div className="bg-gradient-to-b from-[#d1fae5]/45 to-[var(--bg-surface)] dark:from-[#0b2318] dark:to-[var(--bg-surface)] border-b border-[var(--border-subtle)] py-8 px-3 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold text-[#047857] dark:text-[#10b981] uppercase tracking-wider mb-1">
                <Store className="w-4 h-4" strokeWidth={1.75} />
                <span>{tr("Bangladesh's Verified Agricultural Marketplace", 'বাংলাদেশের যাচাইকৃত কৃষি মার্কেটপ্লেস')}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
                {tr('Fresh Harvest Marketplace', 'তাজা কৃষিপণ্য মার্কেটপ্লেস')}
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 max-w-2xl">
                {tr(
                  'Buy fresh fruits, grains, dairy, oils, and vegetables directly from verified Bangladeshi farmers with quality assurance and cold-chain protection.',
                  'মানের নিশ্চয়তা ও কোল্ড-চেইন সুরক্ষাসহ সরাসরি যাচাইকৃত বাংলাদেশি কৃষকদের কাছ থেকে তাজা ফল, চাল, দুগ্ধ, তেল ও সবজি সংগ্রহ করুন।'
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={loadMarketData}
              disabled={loading}
              className="agri-btn agri-btn-secondary self-start md:self-auto"
            >
              <RefreshCw
                className={`w-4 h-4 text-[#047857] dark:text-[#10b981] ${loading ? 'animate-spin' : ''}`}
                strokeWidth={1.75}
              />
              <span>{loading ? tr('Refreshing...', 'হালনাগাদ হচ্ছে...') : tr('Refresh Produce', 'পণ্য হালনাগাদ করুন')}</span>
            </button>
          </div>

          {/* Interactive Visual Category Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => updateCategoryFilter('all')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981] ${
                selectedCategory === 'all'
                  ? 'bg-[#047857] dark:bg-[#10b981] text-white dark:text-[#042419] border-[#047857] dark:border-[#10b981] shadow-md'
                  : 'agri-card agri-card-interactive text-[var(--text-primary)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    selectedCategory === 'all'
                      ? 'bg-white/15 dark:bg-[#042419]/15 text-white dark:text-[#042419]'
                      : 'bg-[#d1fae5]/75 dark:bg-[#047857]/25 text-[#047857] dark:text-[#10b981]'
                  }`}
                >
                  <Boxes className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <span
                  className={`text-[11px] font-mono font-bold ${
                    selectedCategory === 'all' ? 'text-[#d1fae5] dark:text-[#042419]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {formatNumber(products.length, language)}
                </span>
              </div>
              <div>
                <div className="font-bold text-xs">{tr('All Produce', 'সব কৃষিপণ্য')}</div>
                <div
                  className={`text-[10px] mt-0.5 ${
                    selectedCategory === 'all' ? 'text-[#d1fae5] dark:text-[#042419]/80' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {tr('View full catalog', 'সকল ব্যাচ দেখুন')}
                </div>
              </div>
            </button>

            {categories.map(cat => {
              const count = products.filter(p => p.category.toLowerCase().includes(cat.name.toLowerCase())).length;
              const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => updateCategoryFilter(cat.name)}
                  className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981] ${
                    isSelected
                      ? 'bg-[#047857] dark:bg-[#10b981] text-white dark:text-[#042419] border-[#047857] dark:border-[#10b981] shadow-md'
                      : 'agri-card agri-card-interactive text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSelected
                          ? 'bg-white/15 dark:bg-[#042419]/15 text-white dark:text-[#042419]'
                          : 'bg-[#d1fae5]/75 dark:bg-[#047857]/25 text-[#047857] dark:text-[#10b981]'
                      }`}
                    >
                      {renderCategoryIcon(cat.name, 'w-4 h-4')}
                    </div>
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        isSelected ? 'text-[#d1fae5] dark:text-[#042419]' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {formatNumber(count, language)}
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-xs leading-snug line-clamp-1">
                      {translateCategoryName(cat.name, language)}
                    </div>
                    <div
                      className={`text-[10px] mt-0.5 line-clamp-1 ${
                        isSelected ? 'text-[#d1fae5] dark:text-[#042419]/80' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {translateCategoryDescription(cat.name, cat.description, language)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Search & Sort Controls */}
          <div className="pt-4 border-t border-[var(--border-subtle)] grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-6 relative">
              <label htmlFor="market-search" className="sr-only">
                {tr('Search produce', 'পণ্য খুঁজুন')}
              </label>
              <Search
                className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <input
                id="market-search"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={tr('Search crop, farmer name, batch code, or district...', 'ফসলের নাম, কৃষক, ব্যাচ কোড বা জেলা খুঁজুন...')}
                className="agri-input bg-[var(--bg-surface)] pl-9 pr-8"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={tr('Clear search', 'অনুসন্ধান মুছুন')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
            </div>

            <div className="md:col-span-3">
              <label htmlFor="market-sort" className="sr-only">
                {tr('Sort produce', 'সাজান')}
              </label>
              <select
                id="market-sort"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="agri-input bg-[var(--bg-surface)] font-medium"
              >
                <option value="newest">{tr('Newest Harvest First', 'সর্বশেষ সংগৃহীত ফসল')}</option>
                <option value="price_asc">{tr('Price: Low to High', 'দাম: কম থেকে বেশি')}</option>
                <option value="price_desc">{tr('Price: High to Low', 'দাম: বেশি থেকে কম')}</option>
                <option value="qty_desc">{tr('Highest Stock Available', 'সর্বোচ্চ মজুত')}</option>
              </select>
            </div>

            <div className="md:col-span-3 flex items-center md:justify-end">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-xs text-[#047857] dark:text-[#d1fae5] bg-[#d1fae5]/55 dark:bg-[#047857]/25 border border-[#10b981]/30 px-3.5 py-2.5 rounded-xl w-full md:w-auto justify-center md:justify-start">
                <input
                  type="checkbox"
                  checked={organicOnly}
                  onChange={e => updateOrganicFilter(e.target.checked)}
                  className="rounded border-[#10b981] text-[#047857] focus:ring-[#10b981]"
                />
                <Leaf className="w-4 h-4 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
                <span>{tr('Certified Organic Only', 'শুধু অর্গানিক পণ্য')}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Main Product Grid */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)] pb-3 border-b border-[var(--border-subtle)]">
          <div>
            {tr('Showing', 'প্রদর্শিত হচ্ছে')}{' '}
            <strong className="text-[var(--text-primary)] font-mono">{formatNumber(filteredProducts.length, language)}</strong>{' '}
            {tr('verified harvest lots ready for delivery', 'টি যাচাইকৃত ফসলের ব্যাচ ডেলিভারির জন্য প্রস্তুত')}
          </div>
          <div className="flex items-center gap-1.5 text-[#047857] dark:text-[#10b981] font-semibold">
            <ShieldCheck className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>{tr('Quality checked & cold-chain protected', 'মান যাচাইকৃত ও কোল্ড-চেইন সুরক্ষিত')}</span>
          </div>
        </div>

        {filteredProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {paginatedProducts.map(product => {
                const isOutOfStock = (product.quantityAvailable || 0) <= 0;
                const isLowStock = (product.quantityAvailable || 0) > 0 && (product.quantityAvailable || 0) <= 200;
                const stockPercentage = Math.min(100, Math.round(((product.quantityAvailable || 0) / 3000) * 100));
                const isFeatured = product.id % 5 === 1 || (product.isOrganic && product.quantityAvailable >= 1500);

                return (
                  <div
                    key={product.id}
                    className="agri-card agri-card-interactive overflow-hidden flex flex-col justify-between group"
                  >
                    <div>
                      {/* Clean Agricultural Top Strip (Zero Pill Clutter) */}
                      <div className="px-5 py-3.5 bg-[#d1fae5]/35 dark:bg-[#047857]/20 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                          {renderCategoryIcon(product.category, 'w-4 h-4 text-[#047857] dark:text-[#10b981]')}
                          <span>{translateCategoryName(product.category, language)}</span>
                        </span>

                        <div className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] font-semibold">
                          {isFeatured && (
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              <span>{tr('Featured', 'নির্বাচিত')}</span>
                            </span>
                          )}
                          {isFeatured && (product.isOrganic || true) && <span aria-hidden="true">·</span>}
                          {product.isOrganic && (
                            <>
                              <span className="inline-flex items-center gap-1 text-[#047857] dark:text-[#10b981]">
                                <Leaf className="w-3.5 h-3.5" strokeWidth={1.75} />
                                <span>{tr('Organic', 'অর্গানিক')}</span>
                              </span>
                              <span aria-hidden="true">·</span>
                            </>
                          )}
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Thermometer className="w-3.5 h-3.5 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
                            {product.storageTempCelsius}°C
                          </span>
                        </div>
                      </div>

                      {product.imageUrl && (
                        <div className="aspect-[16/9] w-full bg-[var(--bg-surface-muted)] border-b border-[var(--border-subtle)] overflow-hidden">
                          <img
                            src={product.imageUrl}
                            alt={product.title}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                          />
                        </div>
                      )}

                      <div className="p-5 space-y-3">
                        <h3 className="font-bold text-[var(--text-primary)] text-base group-hover:text-[#047857] dark:group-hover:text-[#10b981] transition leading-snug">
                          {product.title}
                        </h3>

                        {/* Clean Unboxed Metadata */}
                        <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                            <span className="inline-flex items-center gap-1 font-mono text-[#047857] dark:text-[#10b981] font-semibold">
                              <Tag className="w-3.5 h-3.5" strokeWidth={1.75} />
                              <span>{product.batchNumber}</span>
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 font-semibold text-[#047857] dark:text-[#10b981]">
                              <BadgeCheck className="w-3.5 h-3.5" strokeWidth={1.75} />
                              <span>{tr('Verified Farmer', 'যাচাইকৃত কৃষক')}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-2 pt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
                            <span className="truncate">{product.farmLocation}</span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px]">
                            <Sprout className="w-3.5 h-3.5 text-[#047857] dark:text-[#10b981] shrink-0" strokeWidth={1.75} />
                            <span className="truncate font-semibold text-[var(--text-primary)]">
                              {product.farmerName}
                            </span>
                          </div>
                        </div>

                        {/* Harvest & Freshness Dates */}
                        <div className="pt-3 border-t border-[var(--border-subtle)] grid grid-cols-2 gap-2 text-[11px] text-[var(--text-secondary)]">
                          <div className="flex items-start gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)] mt-0.5 shrink-0" strokeWidth={1.75} />
                            <div>
                              <span className="block text-[var(--text-muted)]">{tr('Harvested', 'সংগ্রহের তারিখ')}</span>
                              <span className="font-medium text-[var(--text-primary)]">{product.harvestDate}</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[var(--text-muted)] mt-0.5 shrink-0" strokeWidth={1.75} />
                            <div>
                              <span className="block text-[var(--text-muted)]">{tr('Best Before', 'মেয়াদ সীমা')}</span>
                              <span className="font-medium text-[var(--text-primary)]">{product.expiryDate}</span>
                            </div>
                          </div>
                        </div>

                        {/* Stock Indicator */}
                        <div className="pt-1 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
                              {isOutOfStock ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-red-500" strokeWidth={1.75} />
                              ) : isLowStock ? (
                                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" strokeWidth={1.75} />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" strokeWidth={1.75} />
                              )}
                              <span>
                                {isOutOfStock
                                  ? tr('Out of Stock', 'মজুত শেষ')
                                  : isLowStock
                                  ? tr('Low Stock', 'সীমিত মজুত')
                                  : tr('In Stock', 'পর্যাপ্ত মজুত')}
                              </span>
                            </span>
                            <span className="font-mono font-bold text-[var(--text-primary)]">
                              {isOutOfStock
                                ? formatNumber(0, language)
                                : `${formatNumber(product.quantityAvailable, language)} ${product.unitType}`}
                            </span>
                          </div>
                          <div className="w-full bg-[var(--bg-surface-muted)] rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isOutOfStock ? 'bg-red-500' : isLowStock ? 'bg-amber-500' : 'bg-[#047857] dark:bg-[#10b981]'
                              }`}
                              style={{ width: `${Math.max(5, stockPercentage)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pricing & Standardized Action Footer */}
                    <div className="px-5 py-4 bg-[var(--bg-surface-muted)] border-t border-[var(--border-subtle)] flex items-center justify-between gap-2.5">
                      <div className="min-w-0">
                        <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
                          {tr('Trade Price', 'নির্ধারিত দর')}
                        </div>
                        <div className="text-base sm:text-lg font-extrabold text-[var(--text-primary)] font-mono truncate">
                          {formatCurrency(product.unitPrice, language)}
                          <span className="text-xs font-normal text-[var(--text-muted)] font-sans">/{product.unitType}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setInspectLot(product)}
                          aria-label={tr(`View origin details for ${product.title}`, `${product.title} এর উৎস দেখুন`)}
                          className="agri-btn agri-btn-secondary agri-btn-sm h-9 w-9 p-0"
                          title={tr('Origin & Quality Card', 'উৎস ও মান সনদ')}
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

            {totalPages > 1 && (
              <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] text-xs">
                <span className="text-[var(--text-secondary)]">
                  {tr('Page', 'পৃষ্ঠা')} <strong className="text-[var(--text-primary)] font-mono">{formatNumber(currentPage, language)}</strong>{' '}
                  {tr('of', 'এর মধ্যে')} <strong className="text-[var(--text-primary)] font-mono">{formatNumber(totalPages, language)}</strong>
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="agri-btn agri-btn-secondary agri-btn-sm"
                  >
                    {tr('Previous', 'পূর্ববর্তী')}
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`w-9 h-9 rounded-xl font-mono font-bold transition cursor-pointer ${
                        currentPage === page
                          ? 'bg-[#047857] dark:bg-[#10b981] text-white dark:text-[#042419]'
                          : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[#d1fae5]/45 dark:hover:bg-[#10b981]/15'
                      }`}
                    >
                      {formatNumber(page, language)}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="agri-btn agri-btn-secondary agri-btn-sm"
                  >
                    {tr('Next', 'পরবর্তী')}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="agri-card p-10 sm:p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-[#d1fae5] dark:bg-[#047857]/30 text-[#047857] dark:text-[#10b981] rounded-full flex items-center justify-center mx-auto">
              <Sprout className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <h3 className="font-bold text-[var(--text-primary)] text-base">
              {tr('No Matching Harvest Lots', 'কোনো মিল পাওয়া যায়নি')}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
              {tr(
                "We couldn't find produce matching your current search or category selection.",
                'আপনার অনুসন্ধান বা নির্বাচিত বিভাগের সাথে কোনো ফসলের মিল পাওয়া যায়নি।'
              )}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                updateCategoryFilter('all');
                updateOrganicFilter(false);
              }}
              className="agri-btn agri-btn-primary mt-2"
            >
              {tr('Reset Filters', 'সব ফিল্টার মুছুন')}
            </button>
          </div>
        )}
      </div>

      {/* ================= PRODUCT ORIGIN & QUALITY MODAL ================= */}
      {inspectLot && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="market-origin-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        >
          <div className="agri-card max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#d1fae5] dark:bg-[#047857]/30 text-[#047857] dark:text-[#10b981] flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 id="market-origin-modal-title" className="font-bold text-[var(--text-primary)] text-sm leading-tight">
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
                  <span className="text-[var(--text-muted)]">{tr('Harvest Date:', 'সংগ্রহের তারিখ:')}</span>
                  <span className="font-mono text-[var(--text-primary)]">{inspectLot.harvestDate}</span>
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
