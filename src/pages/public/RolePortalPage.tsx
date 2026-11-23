import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sprout,
  ShoppingBag,
  Truck,
  Warehouse,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Thermometer,
  Search,
  MapPin,
  PackageCheck,
  XCircle,
  FileText,
  FileDown,
  Eye
} from 'lucide-react';
import { AgriHubApi, hasConfiguredBackend } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useOfflineSync } from '../../context/OfflineSyncContext';
import { useLanguage, translateRole } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { ensureOfflineDbSeeded, offlineDb } from '../../lib/offlineDb';
import { INITIAL_WAREHOUSES, OrderItem } from '../../mockData';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import {
  buildInvoiceFromOrder,
  formatOrderStatusLabel,
  normalizeApiOrderToOrderItem
} from '../../utils/invoiceGenerator';
import { downloadInvoicePdf, downloadOrderSummaryPdf } from '../../utils/pdfExport';

export default function RolePortalPage({ expectedRole }: { expectedRole?: 'farmer' | 'buyer' | 'supplier' }) {
  const { currentUser, backendConnected } = useAuth();
  const { saveProductOfflineFirst, saveShipmentOfflineFirst, isBackendReachable } = useOfflineSync();
  const { language, tr } = useLanguage();
  const { localOrders, openInvoice, updateLocalOrderStatus } = useCart();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);

  // Farmer new batch form
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState('250');
  const [unitType, setUnitType] = useState('kg');
  const [qty, setQty] = useState('500');
  const [temp, setTemp] = useState('4.5');
  const [isOrganic, setIsOrganic] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Buyer tracking search
  const [trackingCode, setTrackingCode] = useState('');
  const [trackingResult, setTrackingResult] = useState<any | null>(null);
  const [trackingError, setTrackingError] = useState('');

  const activeRole = (currentUser?.role || 'buyer') as 'admin' | 'farmer' | 'supplier' | 'buyer';

  const loadPortalData = async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureOfflineDbSeeded();
      const [dbProds, dbCats, dbOrders, dbShips] = await Promise.all([
        offlineDb.products.toArray(),
        offlineDb.categories.toArray(),
        offlineDb.orders.toArray(),
        offlineDb.shipments.toArray()
      ]);

      const formattedProds = dbProds
        .filter((p) => (activeRole === 'farmer' && currentUser?.id ? p.farmer_id === currentUser.id || true : true))
        .map((p) => ({
          id: p.id,
          title: p.title,
          batch_number: p.batchNumber,
          quantity_available: p.quantityAvailable,
          unit_type: p.unitType,
          unit_price: p.unitPrice
        }));
      setProducts(formattedProds);
      setCategories(dbCats);
      if (dbCats.length > 0) setCategoryId(Number(dbCats[0].id));
      setOrders(dbOrders);
      setShipments(
        dbShips.map((s) => ({
          id: s.id,
          tracking_code: s.trackingCode,
          origin_hub: s.originHub,
          destination_hub: s.destinationHub,
          temperature_celsius: s.currentTempCelsius,
          status: s.status
        }))
      );

      if (!hasConfiguredBackend()) {
        return;
      }

      const [prodsRes, catsRes, ordsRes, shipsRes] = await Promise.allSettled([
        AgriHubApi.getProducts(activeRole === 'farmer' ? { farmer_id: currentUser?.id } : undefined),
        AgriHubApi.getCategories(),
        AgriHubApi.getOrders(),
        AgriHubApi.getShipments()
      ]);

      if (prodsRes.status === 'fulfilled' && prodsRes.value.success && Array.isArray(prodsRes.value.data)) {
        setProducts(prodsRes.value.data);
      }
      if (catsRes.status === 'fulfilled' && catsRes.value.success && Array.isArray(catsRes.value.data)) {
        const list = catsRes.value.data;
        setCategories(list);
        if (list.length > 0) setCategoryId(Number(list[0].id));
      }
      if (ordsRes.status === 'fulfilled' && ordsRes.value.success && Array.isArray(ordsRes.value.data)) {
        setOrders(ordsRes.value.data);
      }
      if (shipsRes.status === 'fulfilled' && shipsRes.value.success && Array.isArray(shipsRes.value.data)) {
        setShipments(shipsRes.value.data);
      }
    } catch (err: any) {
      setError(err?.message || tr('Unable to load portal data.', 'পোর্টাল তথ্য লোড করা যায়নি।'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadPortalData();
    }
  }, [currentUser?.id, activeRole]);

  // Prevent cross-role access if user manually enters another role's URL
  if (expectedRole && currentUser && currentUser.role !== expectedRole && currentUser.role !== 'admin') {
    const userPortalPath =
      currentUser.role === 'farmer'
        ? '/farmer'
        : currentUser.role === 'supplier'
        ? '/logistics'
        : '/buyer';

    return (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center p-4 bg-[#f7faf8]">
        <div className="agri-card rounded-2xl max-w-md w-full p-7 shadow-lg bg-white text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <h1 className="text-lg font-bold text-slate-900">
            {tr('Portal Access Restricted', 'পোর্টাল প্রবেশাধিকার সীমিত')}
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            {tr(
              `Your account is registered as "${translateRole(currentUser.role, language)}". You do not have access to this workspace.`,
              `আপনার অ্যাকাউন্টটি "${translateRole(currentUser.role, language)}" হিসেবে নিবন্ধিত।`
            )}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <Link to={userPortalPath} className="agri-btn agri-btn-primary">
              {tr('Open My Portal', 'আমার পোর্টালে যান')}
            </Link>
            <Link to="/marketplace" className="agri-btn agri-btn-secondary">
              {tr('Browse Marketplace', 'মার্কেটপ্লেস')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setNotice(null);
    try {
      const cat = categories.find((c) => Number(c.id) === Number(categoryId));
      const payload = {
        title: title.trim(),
        category_id: categoryId,
        farmer_id: currentUser?.id || 2,
        batch_number: `BATCH-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        unit_price: parseFloat(unitPrice),
        unit_type: unitType,
        quantity_available: parseFloat(qty),
        storage_temp_celsius: parseFloat(temp),
        is_organic: isOrganic,
        status: 'active'
      };
      await saveProductOfflineFirst(
        {
          farmer_id: payload.farmer_id,
          farmerName: currentUser?.full_name || 'Registered Farmer',
          farmLocation: currentUser?.address || 'Bangladesh Agro Hub',
          category: cat?.name || 'Fresh Produce',
          category_id: categoryId,
          title: payload.title,
          batchNumber: payload.batch_number,
          harvestDate: new Date().toISOString().split('T')[0],
          expiryDate: '',
          unitPrice: payload.unit_price,
          unitType: payload.unit_type,
          quantityAvailable: payload.quantity_available,
          storageTempCelsius: payload.storage_temp_celsius,
          isOrganic: payload.is_organic,
          status: 'active'
        },
        'create',
        payload
      );
      setNotice({
        type: 'success',
        text: isBackendReachable
          ? tr('Harvest batch listed and synced.', 'ফসলের ব্যাচ সফলভাবে যুক্ত ও সিঙ্ক হয়েছে।')
          : tr('Harvest batch saved locally (queued for sync).', 'ব্যাচটি সংরক্ষিত হয়েছে এবং অনলাইন হলে সিঙ্ক হবে।')
      });
      setShowAddBatch(false);
      setTitle('');
      loadPortalData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || tr('Failed to list harvest batch.', 'ব্যাচ যুক্ত করা যায়নি।') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOrderStatus = async (orderId: number, status: OrderItem['orderStatus']) => {
    setNotice(null);
    try {
      if (backendConnected) {
        const res = await AgriHubApi.updateOrderStatus(orderId, status);
        if (res.success) {
          setNotice({ type: 'success', text: res.message || tr('Order updated.', 'অর্ডার হালনাগাদ হয়েছে।') });
          loadPortalData();
        }
      } else {
        updateLocalOrderStatus(orderId, status);
        setNotice({ type: 'success', text: tr('Order status updated.', 'অর্ডার অবস্থা হালনাগাদ হয়েছে।') });
      }
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || tr('Unable to update order.', 'অর্ডার হালনাগাদ করা যায়নি।') });
    }
  };

  const mergedOrders: OrderItem[] = React.useMemo(() => {
    const normalizedApi = orders.map(normalizeApiOrderToOrderItem);
    const seen = new Set(normalizedApi.map((o) => o.orderNumber));
    const combined = [...normalizedApi];
    for (const lo of localOrders) {
      if (!seen.has(lo.orderNumber)) {
        combined.push(lo);
      }
    }
    return combined;
  }, [orders, localOrders]);

  const handleDirectPdf = async (order: OrderItem, mode: 'invoice' | 'summary') => {
    try {
      const invoice = buildInvoiceFromOrder(order);
      if (mode === 'invoice') {
        await downloadInvoicePdf(invoice, language);
      } else {
        await downloadOrderSummaryPdf(invoice, language);
      }
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || tr('Could not generate PDF.', 'পিডিএফ তৈরি করা যায়নি।')
      });
    }
  };

  const handleShipmentUpdate = async (shipmentId: number, status: string, currentTemp: number) => {
    setNotice(null);
    try {
      const existing = await offlineDb.shipments.get(shipmentId);
      if (existing) {
        await saveShipmentOfflineFirst(
          {
            ...existing,
            status: status as any,
            currentTempCelsius: currentTemp
          },
          'update',
          {
            shipment_id: shipmentId,
            status,
            temperature_celsius: currentTemp
          }
        );
      } else {
        await AgriHubApi.updateShipment({
          shipment_id: shipmentId,
          status,
          temperature_celsius: currentTemp
        });
      }
      setNotice({
        type: 'success',
        text: isBackendReachable
          ? tr('Shipment status updated.', 'চালানের অবস্থা হালনাগাদ হয়েছে।')
          : tr('Shipment status saved offline (queued for sync).', 'চালানের অবস্থা অফলাইনে সংরক্ষিত হয়েছে।')
      });
      loadPortalData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || tr('Failed to update shipment.', 'চালান হালনাগাদ করা যায়নি।') });
    }
  };

  const handleTrackShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingCode.trim()) return;
    setTrackingError('');
    setTrackingResult(null);
    try {
      if (hasConfiguredBackend() && isBackendReachable) {
        const res = await AgriHubApi.track(trackingCode.trim());
        if (res.success && res.data) {
          setTrackingResult(res.data);
          return;
        }
      }
      const localMatch = await offlineDb.shipments
        .where('trackingCode')
        .equalsIgnoreCase(trackingCode.trim())
        .first();
      if (localMatch) {
        setTrackingResult({
          tracking_code: localMatch.trackingCode,
          status: localMatch.status,
          origin_hub: localMatch.originHub,
          destination_hub: localMatch.destinationHub,
          temperature_celsius: localMatch.currentTempCelsius
        });
      } else {
        setTrackingError(tr('No shipment found for this tracking code.', 'এই ট্র্যাকিং কোডে কোনো চালান পাওয়া যায়নি।'));
      }
    } catch (err: any) {
      setTrackingError(err?.message || tr('Unable to find tracking code.', 'ট্র্যাকিং তথ্য পাওয়া যায়নি।'));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="agri-card bg-white p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#d1fae5]/75 border border-[#10b981]/30 text-[#047857] flex items-center justify-center shrink-0">
            {activeRole === 'farmer' ? (
              <Sprout className="w-6 h-6" strokeWidth={1.75} />
            ) : activeRole === 'supplier' ? (
              <Truck className="w-6 h-6" strokeWidth={1.75} />
            ) : (
              <ShoppingBag className="w-6 h-6" strokeWidth={1.75} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                {activeRole === 'farmer'
                  ? tr('Farmer Harvest Portal', 'কৃষক ফসল ও বিক্রয় পোর্টাল')
                  : activeRole === 'supplier'
                  ? tr('Transport & Cold-Chain Portal', 'পরিবহন ও কোল্ড-চেইন পোর্টাল')
                  : tr('Buyer Procurement Portal', 'ক্রেতা ক্রয় ও ট্র্যাকিং পোর্টাল')}
              </h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-[#d1fae5]/70 text-[#047857] border border-[#10b981]/30 capitalize">
                {translateRole(activeRole, language)}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {currentUser?.full_name} · {currentUser?.business_name || currentUser?.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadPortalData}
            disabled={loading}
            className="agri-btn agri-btn-secondary agri-btn-sm"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#047857] ${loading ? 'animate-spin' : ''}`}
              strokeWidth={1.75}
            />
            <span>{tr('Refresh', 'রিফ্রেশ')}</span>
          </button>

          {activeRole === 'farmer' && (
            <button
              type="button"
              onClick={() => setShowAddBatch((prev) => !prev)}
              className="agri-btn agri-btn-primary agri-btn-sm"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>{tr('List Harvest Batch', 'নতুন ফসলের ব্যাচ যোগ')}</span>
            </button>
          )}

          {activeRole === 'buyer' && (
            <Link to="/marketplace" className="agri-btn agri-btn-primary agri-btn-sm">
              <ShoppingBag className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>{tr('Browse Produce', 'মার্কেটপ্লেস দেখুন')}</span>
            </Link>
          )}
        </div>
      </div>

      {notice && (
        <div
          role={notice.type === 'error' ? 'alert' : 'status'}
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-[#d1fae5]/60 border-[#10b981]/35 text-[#047857]'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0" strokeWidth={1.75} />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" strokeWidth={1.75} />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {!backendConnected && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" strokeWidth={1.75} />
          <span>
            {tr(
              'Live updates are currently paused. Showing your saved trade records.',
              'লাইভ আপডেট সাময়িকভাবে বিরতিতে আছে। আপনার সংরক্ষিত বাণিজ্য তথ্য দেখানো হচ্ছে।'
            )}
          </span>
        </div>
      )}

      {error && (
        <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900">
          {error}
        </div>
      )}

      {/* Farmer Create Harvest Batch Form */}
      {activeRole === 'farmer' && showAddBatch && (
        <form
          onSubmit={handleCreateBatch}
          className="agri-card bg-white border-[#10b981]/35 p-6 space-y-4 text-xs"
        >
          <h2 className="text-sm font-bold text-slate-900">
            {tr('Register New Harvest Batch', 'নতুন ফসলের ব্যাচ নিবন্ধন করুন')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label htmlFor="portal-batch-title" className="block font-bold text-slate-800 mb-1.5">
                {tr('Produce Title', 'পণ্যের নাম')}
              </label>
              <input
                id="portal-batch-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={tr('e.g. Rajshahi Himsagar Mangoes', 'যেমন: রাজশাহীর হিমসাগর আম')}
                className="agri-input"
              />
            </div>

            <div>
              <label htmlFor="portal-batch-cat" className="block font-bold text-slate-800 mb-1.5">
                {tr('Category', 'বিভাগ')}
              </label>
              <select
                id="portal-batch-cat"
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="agri-input"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="portal-batch-qty" className="block font-bold text-slate-800 mb-1.5">
                {tr('Quantity Available', 'মজুদ পরিমাণ')}
              </label>
              <div className="flex gap-2">
                <input
                  id="portal-batch-qty"
                  type="number"
                  min="1"
                  required
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="agri-input"
                />
                <select
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value)}
                  aria-label="Unit type"
                  className="agri-input w-24 shrink-0"
                >
                  <option value="kg">kg</option>
                  <option value="ton">ton</option>
                  <option value="liter">liter</option>
                  <option value="crate">crate</option>
                  <option value="bag">bag</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="portal-batch-price" className="block font-bold text-slate-800 mb-1.5">
                {tr('Unit Price (BDT)', 'একক মূল্য (৳)')}
              </label>
              <input
                id="portal-batch-price"
                type="number"
                step="0.5"
                min="1"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="agri-input"
              />
            </div>

            <div>
              <label htmlFor="portal-batch-temp" className="block font-bold text-slate-800 mb-1.5">
                {tr('Storage Temp (°C)', 'সংরক্ষণ তাপমাত্রা (°C)')}
              </label>
              <input
                id="portal-batch-temp"
                type="number"
                step="0.5"
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                className="agri-input"
              />
            </div>

            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOrganic}
                  onChange={(e) => setIsOrganic(e.target.checked)}
                  className="rounded border-slate-300 text-[#047857] focus:ring-[#10b981]"
                />
                <span>{tr('Certified Organic', 'অর্গানিক পণ্য')}</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddBatch(false)}
              className="agri-btn agri-btn-secondary agri-btn-sm"
            >
              {tr('Cancel', 'বাতিল')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="agri-btn agri-btn-primary agri-btn-sm"
            >
              {submitting ? tr('Saving...', 'সংরক্ষণ হচ্ছে...') : tr('Publish Batch', 'ব্যাচ প্রকাশ করুন')}
            </button>
          </div>
        </form>
      )}

      {/* Buyer Shipment Tracking Lookup */}
      {activeRole === 'buyer' && (
        <div className="agri-card bg-white p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#047857]" strokeWidth={1.75} />
            <span>{tr('Track Delivery & Origin', 'ডেলিভারি ও উৎস ট্র্যাক করুন')}</span>
          </h2>
          <form onSubmit={handleTrackShipment} className="flex flex-col sm:flex-row gap-2.5 text-xs">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-[#047857] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                strokeWidth={1.75}
              />
              <input
                type="text"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                placeholder={tr('Enter tracking code (e.g. TRK-COLD-2026-8812)', 'ট্র্যাকিং কোড দিন (যেমন: TRK-COLD-2026-8812)')}
                className="agri-input pl-9"
              />
            </div>
            <button type="submit" className="agri-btn agri-btn-primary whitespace-nowrap">
              {tr('Track Shipment', 'ট্র্যাক করুন')}
            </button>
          </form>

          {trackingError && <p className="text-xs text-red-600">{trackingError}</p>}

          {trackingResult && (
            <div className="p-4 rounded-xl bg-[#d1fae5]/45 border border-[#10b981]/30 text-xs grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-slate-600 block">{tr('Tracking Code', 'ট্র্যাকিং কোড')}</span>
                <strong className="font-mono text-[#047857]">{trackingResult.tracking_code}</strong>
              </div>
              <div>
                <span className="text-slate-600 block">{tr('Status', 'অবস্থা')}</span>
                <strong className="capitalize text-slate-900">{String(trackingResult.status).replace('_', ' ')}</strong>
              </div>
              <div>
                <span className="text-slate-600 block">{tr('Route', 'রুট')}</span>
                <strong className="text-slate-900">
                  {trackingResult.origin_hub} → {trackingResult.destination_hub}
                </strong>
              </div>
              <div>
                <span className="text-slate-600 block">{tr('Storage Temp', 'তাপমাত্রা')}</span>
                <strong className="font-mono text-[#047857]">{trackingResult.temperature_celsius ?? '—'}°C</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Role Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Orders Table */}
        <div className="lg:col-span-7 agri-card bg-white overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-[#047857]" strokeWidth={1.75} />
              <span>{tr('Orders & Invoices', 'অর্ডার ও ইনভয়েস তালিকা')}</span>
            </h2>
            <span className="text-xs font-mono font-semibold text-slate-600">
              {formatNumber(mergedOrders.length, language)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f7faf8] text-slate-600 uppercase text-[11px] border-b border-[#dce7e0]">
                <tr>
                  <th className="py-3 px-4">{tr('Order', 'অর্ডার')}</th>
                  <th className="py-3 px-4">{tr('Total', 'মোট')}</th>
                  <th className="py-3 px-4">{tr('Status', 'অবস্থা')}</th>
                  <th className="py-3 px-4 text-right">{tr('Invoice & Action', 'ইনভয়েস ও পদক্ষেপ')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mergedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 px-4 text-center text-slate-500">
                      {tr('No orders found for your account yet.', 'আপনার অ্যাকাউন্টে এখনো কোনো অর্ডার নেই।')}
                    </td>
                  </tr>
                ) : (
                  mergedOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-[#f7faf8]">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-[#047857]">{o.orderNumber}</div>
                        <div className="text-[11px] text-slate-500">
                          {o.productTitle || tr('Agricultural Produce', 'কৃষিপণ্য')}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(o.totalAmount, language)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-[#f7faf8] border border-[#dce7e0] text-slate-700">
                          {formatOrderStatusLabel(o.orderStatus, language)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => openInvoice(o)}
                            className="px-2.5 py-1 rounded-lg bg-[#d1fae5]/75 hover:bg-[#d1fae5] text-[#047857] border border-[#10b981]/30 font-semibold inline-flex items-center gap-1"
                            title={tr('View Branded Invoice', 'ইনভয়েস দেখুন')}
                          >
                            <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>{tr('Invoice', 'ইনভয়েস')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDirectPdf(o, 'invoice')}
                            className="p-1.5 rounded-lg bg-[#f7faf8] hover:bg-[#d1fae5]/60 text-[#047857] border border-[#dce7e0]"
                            title={tr('Download Invoice PDF', 'ইনভয়েস PDF ডাউনলোড')}
                          >
                            <FileDown className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDirectPdf(o, 'summary')}
                            className="p-1.5 rounded-lg bg-[#f7faf8] hover:bg-[#d1fae5]/60 text-[#047857] border border-[#dce7e0]"
                            title={tr('Download Order Summary PDF', 'অর্ডার সারাংশ PDF ডাউনলোড')}
                          >
                            <FileText className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </button>
                          {activeRole === 'buyer' && o.orderStatus === 'placed' && (
                            <button
                              type="button"
                              onClick={() => handleOrderStatus(o.id, 'cancelled')}
                              className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold inline-flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                              <span>{tr('Cancel', 'বাতিল')}</span>
                            </button>
                          )}
                          {activeRole === 'farmer' && o.orderStatus === 'placed' && (
                            <button
                              type="button"
                              onClick={() => handleOrderStatus(o.id, 'confirmed')}
                              className="px-2.5 py-1 rounded-lg bg-[#d1fae5]/75 hover:bg-[#d1fae5] text-[#047857] border border-[#10b981]/30 font-semibold"
                            >
                              {tr('Confirm', 'নিশ্চিত করুন')}
                            </button>
                          )}
                          {activeRole === 'farmer' && o.orderStatus === 'confirmed' && (
                            <button
                              type="button"
                              onClick={() => handleOrderStatus(o.id, 'processing')}
                              className="px-2.5 py-1 rounded-lg bg-[#d1fae5]/75 hover:bg-[#d1fae5] text-[#047857] border border-[#10b981]/30 font-semibold"
                            >
                              {tr('Prepare Dispatch', 'প্রস্তুত করুন')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Farmer Harvest Batches OR Shipments & Regional Hubs */}
        <div className="lg:col-span-5 space-y-6">
          {activeRole === 'farmer' && (
            <div className="agri-card bg-white p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sprout className="w-4 h-4 text-[#047857]" strokeWidth={1.75} />
                <span>{tr('My Harvest Batches', 'আমার ফসলের ব্যাচ')}</span>
              </h2>
              {products.length === 0 ? (
                <p className="text-xs text-slate-500">{tr('No batches listed yet.', 'এখনো কোনো ব্যাচ যুক্ত করা হয়নি।')}</p>
              ) : (
                <div className="space-y-2.5">
                  {products.slice(0, 6).map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-[#f7faf8] border border-[#dce7e0] flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{p.title}</div>
                        <div className="font-mono text-[11px] text-[#047857]">{p.batch_number}</div>
                      </div>
                      <div className="text-right font-mono shrink-0">
                        <div className="font-bold text-slate-900">
                          {formatNumber(Number(p.quantity_available), language)} {p.unit_type}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatCurrency(Number(p.unit_price), language)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeRole === 'supplier' && (
            <div className="agri-card bg-white p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#047857]" strokeWidth={1.75} />
                <span>{tr('Assigned Cold-Chain Shipments', 'নির্ধারিত কোল্ড-চেইন চালান')}</span>
              </h2>
              {shipments.length === 0 ? (
                <p className="text-xs text-slate-500">{tr('No shipments assigned yet.', 'এখনো কোনো চালান নির্ধারিত হয়নি।')}</p>
              ) : (
                <div className="space-y-3">
                  {shipments.map((s) => (
                    <div key={s.id} className="p-3.5 rounded-xl bg-[#f7faf8] border border-[#dce7e0] space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#047857]">{s.tracking_code}</span>
                        <span className="inline-flex items-center gap-1 font-mono text-[#047857] bg-[#d1fae5]/70 px-2 py-0.5 rounded border border-[#10b981]/30">
                          <Thermometer className="w-3 h-3" strokeWidth={1.75} />
                          {s.temperature_celsius ?? 4.2}°C
                        </span>
                      </div>
                      <div className="text-slate-600">
                        {s.origin_hub} → {s.destination_hub}
                      </div>
                      {s.status !== 'delivered' && (
                        <div className="flex gap-2 pt-1">
                          {s.status !== 'in_transit' && (
                            <button
                              type="button"
                              onClick={() => handleShipmentUpdate(s.id, 'in_transit', Number(s.temperature_celsius ?? 4.2))}
                              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                            >
                              {tr('Mark In Transit', 'যাত্রাপথে')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleShipmentUpdate(s.id, 'delivered', Number(s.temperature_celsius ?? 4.2))}
                            className="agri-btn agri-btn-primary agri-btn-sm"
                          >
                            {tr('Mark Delivered', 'ডেলিভারি সম্পন্ন')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Regional Warehouses Reference */}
          <div className="agri-card bg-white p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-[#047857]" strokeWidth={1.75} />
              <span>{tr('Regional Cold-Chain Hubs', 'আঞ্চলিক কোল্ড-চেইন হিমাগার')}</span>
            </h2>
            <div className="space-y-2 text-xs">
              {INITIAL_WAREHOUSES.map((w) => (
                <div
                  key={w.id}
                  className="p-3 rounded-xl bg-[#f7faf8] border border-[#dce7e0] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{w.name}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#047857] shrink-0" strokeWidth={1.75} />
                      <span className="truncate">{w.region}</span>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-[#047857] bg-[#d1fae5]/70 border border-[#10b981]/30 px-2 py-0.5 rounded shrink-0">
                    {w.tempRangeCelsius}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
