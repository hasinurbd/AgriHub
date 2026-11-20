import React, { Suspense, createContext, lazy, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  X,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Tag,
  Truck,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  CreditCard,
  Banknote,
  Smartphone
} from 'lucide-react';
import { AgriHubApi } from '../api';
import { INITIAL_ORDERS, OrderItem, ProductItem } from '../mockData';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { formatCurrency, formatNumber } from '../utils/formatters';
import {
  AVAILABLE_COUPONS,
  CheckoutCartItem,
  DeliveryZone,
  PaymentMethod,
  calculateOrderBreakdown,
  roundCurrency
} from '../utils/pricing';
import { normalizeApiOrderToOrderItem } from '../utils/invoiceGenerator';

const InvoiceModal = lazy(() => import('../components/common/InvoiceModal'));

const CART_STORAGE_KEY = 'agrihub_cart_v1';
const ORDERS_STORAGE_KEY = 'agrihub_orders_v1';

interface CartContextType {
  cartItems: CheckoutCartItem[];
  cartCount: number;
  drawerOpen: boolean;
  localOrders: OrderItem[];
  activeInvoiceOrder: OrderItem | null;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
  addToCart: (product: ProductItem, quantity?: number) => void;
  openOrderCheckout: (product: ProductItem, quantity?: number) => void;
  updateCartItemQuantity: (productId: number, quantity: number) => void;
  removeFromCart: (productId: number) => void;
  clearCart: () => void;
  openInvoice: (order: OrderItem | any) => void;
  closeInvoice: () => void;
  recordOrder: (order: OrderItem) => void;
  updateLocalOrderStatus: (orderId: number, status: OrderItem['orderStatus']) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function loadStoredCart(): CheckoutCartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadStoredOrders(): OrderItem[] {
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback to seed orders
  }
  return INITIAL_ORDERS;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, backendConnected } = useAuth();
  const { language, tr } = useLanguage();

  const [cartItems, setCartItems] = useState<CheckoutCartItem[]>(loadStoredCart);
  const [localOrders, setLocalOrders] = useState<OrderItem[]>(loadStoredOrders);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeInvoiceOrder, setActiveInvoiceOrder] = useState<OrderItem | null>(null);

  // Checkout form state
  const [deliveryZone, setDeliveryZone] = useState<DeliveryZone>('dhaka');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bkash_nagad');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+880 1711-000800');
  const [deliveryAddress, setDeliveryAddress] = useState(
    'FreshBasket Central Distribution Hub, Tejgaon, Dhaka 1215'
  );
  const [orderNotes, setOrderNotes] = useState('Fresh cold-chain delivery requested');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [cartToast, setCartToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      // ignore storage errors
    }
  }, [cartItems]);

  useEffect(() => {
    try {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(localOrders));
    } catch {
      // ignore storage errors
    }
  }, [localOrders]);

  useEffect(() => {
    if (currentUser) {
      setCustomerName((prev) => prev || currentUser.business_name || currentUser.full_name || '');
      setCustomerEmail((prev) => prev || currentUser.email || '');
      setCustomerPhone((prev) => currentUser.phone || prev);
      setDeliveryAddress((prev) => currentUser.address || prev);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showNotice = useCallback((msg: string) => {
    setCartToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setCartToast(null), 3200);
  }, []);

  const addToCart = useCallback(
    (product: ProductItem, quantity?: number) => {
      const maxAvail = Math.max(1, Number(product.quantityAvailable || 1));
      const desiredQty = Math.min(maxAvail, Math.max(1, quantity ?? Math.min(50, maxAvail)));

      setCartItems((prev) => {
        const existing = prev.find((item) => item.productId === product.id);
        if (existing) {
          const nextQty = Math.min(maxAvail, existing.quantity + desiredQty);
          return prev.map((item) =>
            item.productId === product.id
              ? {
                  ...item,
                  unitPrice: roundCurrency(Number(product.unitPrice)),
                  quantity: nextQty,
                  maxAvailable: maxAvail
                }
              : item
          );
        }
        return [
          ...prev,
          {
            productId: product.id,
            title: product.title,
            batchNumber: product.batchNumber,
            farmerName: product.farmerName,
            category: product.category,
            unitPrice: roundCurrency(Number(product.unitPrice)),
            unitType: product.unitType || 'kg',
            quantity: desiredQty,
            maxAvailable: maxAvail,
            storageTempCelsius: Number(product.storageTempCelsius ?? 4.5),
            isOrganic: Boolean(product.isOrganic)
          }
        ];
      });

      showNotice(
        tr(
          `${product.title} added to cart.`,
          `${product.title} কার্টে যোগ করা হয়েছে।`
        )
      );
    },
    [showNotice, tr]
  );

  const openOrderCheckout = useCallback(
    (product: ProductItem, quantity?: number) => {
      const maxAvail = Math.max(1, Number(product.quantityAvailable || 1));
      const desiredQty = Math.min(maxAvail, Math.max(1, quantity ?? Math.min(100, maxAvail)));

      setCartItems((prev) => {
        const existing = prev.find((item) => item.productId === product.id);
        if (existing) {
          return prev.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: Math.max(item.quantity, desiredQty), maxAvailable: maxAvail }
              : item
          );
        }
        return [
          ...prev,
          {
            productId: product.id,
            title: product.title,
            batchNumber: product.batchNumber,
            farmerName: product.farmerName,
            category: product.category,
            unitPrice: roundCurrency(Number(product.unitPrice)),
            unitType: product.unitType || 'kg',
            quantity: desiredQty,
            maxAvailable: maxAvail,
            storageTempCelsius: Number(product.storageTempCelsius ?? 4.5),
            isOrganic: Boolean(product.isOrganic)
          }
        ];
      });
      setCheckoutError(null);
      setDrawerOpen(true);
    },
    []
  );

  const updateCartItemQuantity = useCallback((productId: number, quantity: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const clamped = Math.min(item.maxAvailable, Math.max(1, Math.round(quantity || 1)));
        return { ...item, quantity: clamped };
      })
    );
  }, []);

  const removeFromCart = useCallback((productId: number) => {
    setCartItems((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setAppliedCoupon('');
    setCouponInput('');
  }, []);

  const openInvoice = useCallback((orderInput: OrderItem | any) => {
    if (!orderInput) return;
    const normalized =
      'orderNumber' in orderInput && Array.isArray(orderInput.items)
        ? (orderInput as OrderItem)
        : normalizeApiOrderToOrderItem(orderInput);
    setActiveInvoiceOrder(normalized);
  }, []);

  const closeInvoice = useCallback(() => {
    setActiveInvoiceOrder(null);
  }, []);

  const recordOrder = useCallback((order: OrderItem) => {
    setLocalOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
  }, []);

  const updateLocalOrderStatus = useCallback((orderId: number, status: OrderItem['orderStatus']) => {
    setLocalOrders((prev) =>
      prev.map((item) =>
        item.id === orderId
          ? {
              ...item,
              orderStatus: status,
              paymentStatus:
                status === 'delivered'
                  ? 'paid'
                  : status === 'cancelled'
                  ? 'refunded'
                  : item.paymentStatus
            }
          : item
      )
    );
  }, []);

  const breakdown = useMemo(
    () =>
      calculateOrderBreakdown({
        items: cartItems,
        couponCode: appliedCoupon,
        deliveryZone
      }),
    [cartItems, appliedCoupon, deliveryZone]
  );

  const handleApplyCoupon = (codeOverride?: string) => {
    const nextCode = (codeOverride ?? couponInput).trim().toUpperCase();
    setCouponInput(nextCode);
    setAppliedCoupon(nextCode);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);

    if (cartItems.length === 0) {
      setCheckoutError(tr('Your cart is empty.', 'আপনার কার্ট খালি রয়েছে।'));
      return;
    }

    if (!deliveryAddress.trim()) {
      setCheckoutError(tr('Delivery address is required.', 'ডেলিভারির ঠিকানা প্রদান করুন।'));
      return;
    }

    setSubmitting(true);
    try {
      let apiOrderNumber = '';
      let apiOrderId = Date.now();

      if (backendConnected) {
        const res = await AgriHubApi.createOrder({
          items: cartItems.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity
          })),
          delivery_address: deliveryAddress.trim(),
          notes: orderNotes.trim()
        });
        if (res.success && res.data) {
          apiOrderNumber = res.data.order_number || '';
          if (res.data.order_id) apiOrderId = Number(res.data.order_id);
        }
      }

      const orderNumber =
        apiOrderNumber || `AGRI-ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const invoiceNumber = `INV-${orderNumber.replace(/[^0-9A-Z]/gi, '').slice(-8)}`;
      const firstItem = cartItems[0];

      const newOrder: OrderItem = {
        id: apiOrderId,
        invoiceNumber,
        orderNumber,
        buyerName:
          customerName.trim() ||
          currentUser?.business_name ||
          currentUser?.full_name ||
          'Verified Buyer',
        buyerEmail: customerEmail.trim() || currentUser?.email || 'buyer@agrihub.bd',
        buyerPhone: customerPhone.trim() || '+880 1711-000800',
        productTitle:
          cartItems.length > 1
            ? `${firstItem.title} (+${cartItems.length - 1} ${tr('more', 'আরো')})`
            : firstItem.title,
        batchNumber: firstItem.batchNumber,
        unitPrice: firstItem.unitPrice,
        quantity: breakdown.totalUnits,
        unitType: cartItems.length === 1 ? firstItem.unitType : 'units',
        items: breakdown.items.map((line) => ({
          productId: line.productId,
          title: line.title,
          batchNumber: line.batchNumber,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          unitType: line.unitType,
          lineTotal: line.lineTotal
        })),
        subtotal: breakdown.subtotal,
        shippingFee: breakdown.shipping,
        discountAmount: breakdown.discount,
        couponCode: breakdown.couponApplied ? breakdown.couponCode : undefined,
        taxAmount: breakdown.tax,
        totalAmount: breakdown.grandTotal,
        paymentMethod,
        paymentStatus: paymentMethod === 'cod' ? 'pending' : 'escrow_held',
        orderStatus: 'placed',
        deliveryAddress: deliveryAddress.trim(),
        notes: orderNotes.trim(),
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
      };

      recordOrder(newOrder);
      clearCart();
      setDrawerOpen(false);
      setActiveInvoiceOrder(newOrder);
    } catch (err: any) {
      setCheckoutError(
        err?.message ||
          tr('Unable to complete checkout. Please try again.', 'চেকআউট সম্পন্ন করা যায়নি।')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cartCount = useMemo(() => cartItems.length, [cartItems]);

  const openCartDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeCartDrawer = useCallback(() => setDrawerOpen(false), []);

  const cartValue = useMemo<CartContextType>(
    () => ({
      cartItems,
      cartCount,
      drawerOpen,
      localOrders,
      activeInvoiceOrder,
      openCartDrawer,
      closeCartDrawer,
      addToCart,
      openOrderCheckout,
      updateCartItemQuantity,
      removeFromCart,
      clearCart,
      openInvoice,
      closeInvoice,
      recordOrder,
      updateLocalOrderStatus
    }),
    [
      cartItems,
      cartCount,
      drawerOpen,
      localOrders,
      activeInvoiceOrder,
      openCartDrawer,
      closeCartDrawer,
      addToCart,
      openOrderCheckout,
      updateCartItemQuantity,
      removeFromCart,
      clearCart,
      openInvoice,
      closeInvoice,
      recordOrder,
      updateLocalOrderStatus
    ]
  );

  return (
    <CartContext.Provider value={cartValue}>
      {children}

      {/* Compact Toast when adding to cart */}
      {cartToast && !drawerOpen && (
        <div
          role="status"
          aria-live="polite"
          className="no-print fixed bottom-5 left-4 sm:left-6 z-40 bg-white border border-[#10b981]/35 rounded-xl shadow-lg px-4 py-2.5 flex items-center gap-2.5 text-xs font-semibold text-slate-800"
        >
          <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0" strokeWidth={1.75} />
          <span>{cartToast}</span>
          <button
            type="button"
            onClick={() => {
              setCartToast(null);
              setDrawerOpen(true);
            }}
            className="text-[#047857] font-bold hover:underline ml-1"
          >
            {tr('View Cart', 'কার্ট দেখুন')}
          </button>
        </div>
      )}

      {/* Global Slide-Over Cart & Checkout Drawer */}
      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="agrihub-checkout-title"
          className="no-print fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex justify-end"
        >
          <div className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-[#dce7e0] flex flex-col justify-between">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-[#dce7e0] flex items-center justify-between bg-[#f7faf8]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#047857] text-white flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <div>
                  <h2 id="agrihub-checkout-title" className="font-bold text-slate-900 text-sm sm:text-base">
                    {tr('Trade Cart & Checkout', 'ট্রেড কার্ট ও চেকআউট')}
                  </h2>
                  <p className="text-[11px] text-slate-600">
                    {formatNumber(cartItems.length, language)}{' '}
                    {tr('harvest lots selected', 'টি ফসলের ব্যাচ নির্বাচিত')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={tr('Close checkout drawer', 'চেকআউট বন্ধ করুন')}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-[#d1fae5]/60 transition"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs">
              {cartItems.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#d1fae5]/75 text-[#047857] flex items-center justify-center mx-auto">
                    <ShoppingCart className="w-6 h-6" strokeWidth={1.75} />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {tr('Your procurement cart is empty', 'আপনার কার্টটি এখনো খালি')}
                  </h3>
                  <p className="text-xs text-slate-600 max-w-xs mx-auto">
                    {tr(
                      'Add fresh harvest lots from the Marketplace to calculate delivery, tax, and generate an official invoice.',
                      'ডেলিভারি, ভ্যাট ও ইনভয়েস তৈরি করতে মার্কেটপ্লেস থেকে তাজা কৃষিপণ্য কার্টে যোগ করুন।'
                    )}
                  </p>
                </div>
              ) : (
                <form id="agrihub-checkout-form" onSubmit={handleCheckoutSubmit} className="space-y-5">
                  {checkoutError && (
                    <div
                      role="alert"
                      className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" strokeWidth={1.75} />
                      <span>{checkoutError}</span>
                    </div>
                  )}

                  {/* Line Items */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                        {tr('Selected Harvest Lots', 'নির্বাচিত ফসলের ব্যাচ')}
                      </span>
                      <button
                        type="button"
                        onClick={clearCart}
                        className="text-[11px] font-semibold text-red-600 hover:underline"
                      >
                        {tr('Clear All', 'সব মুছুন')}
                      </button>
                    </div>

                    {cartItems.map((item) => {
                      const lineItem = breakdown.items.find((i) => i.productId === item.productId);
                      const lineTotal = lineItem ? lineItem.lineTotal : item.unitPrice * item.quantity;

                      return (
                        <div
                          key={item.productId}
                          className="p-3.5 rounded-xl bg-[#f7faf8] border border-[#dce7e0] space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                                {item.title}
                              </div>
                              <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-2 mt-0.5">
                                <span className="font-mono text-[#047857] font-semibold">
                                  {item.batchNumber}
                                </span>
                                <span>·</span>
                                <span>
                                  {formatCurrency(item.unitPrice, language)} / {item.unitType}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeFromCart(item.productId)}
                              aria-label={tr(`Remove ${item.title}`, `${item.title} সরান`)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-1">
                            <div className="inline-flex items-center border border-[#dce7e0] bg-white rounded-lg overflow-hidden">
                              <button
                                type="button"
                                onClick={() => updateCartItemQuantity(item.productId, item.quantity - 10)}
                                aria-label={tr('Decrease quantity', 'পরিমাণ কমান')}
                                className="px-2.5 py-1.5 text-[#047857] hover:bg-[#d1fae5]/60"
                              >
                                <Minus className="w-3.5 h-3.5" strokeWidth={1.75} />
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={item.maxAvailable}
                                value={item.quantity}
                                onChange={(e) =>
                                  updateCartItemQuantity(item.productId, Number(e.target.value))
                                }
                                aria-label={tr('Quantity', 'পরিমাণ')}
                                className="w-16 text-center font-mono font-bold text-slate-900 bg-transparent py-1 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => updateCartItemQuantity(item.productId, item.quantity + 10)}
                                aria-label={tr('Increase quantity', 'পরিমাণ বাড়ান')}
                                className="px-2.5 py-1.5 text-[#047857] hover:bg-[#d1fae5]/60"
                              >
                                <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                              </button>
                            </div>

                            <div className="text-right">
                              <div className="text-[10px] text-slate-500">
                                {formatNumber(item.quantity, language)} {item.unitType}
                              </div>
                              <div className="font-mono tabular-nums font-bold text-slate-900 text-sm">
                                {formatCurrency(lineTotal, language)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Delivery Zone & Coupon */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1.5">
                        <span className="inline-flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-[#047857]" strokeWidth={1.75} />
                          {tr('Cold-Chain Delivery Zone', 'ডেলিভারি অঞ্চল')}
                        </span>
                      </label>
                      <select
                        value={deliveryZone}
                        onChange={(e) => setDeliveryZone(e.target.value as DeliveryZone)}
                        className="agri-input"
                      >
                        <option value="dhaka">
                          {tr('Dhaka Metro Hub (BDT 450)', 'ঢাকা মেট্রো হাব (৳ ৪৫০)')}
                        </option>
                        <option value="regional">
                          {tr('Nationwide Corridor (BDT 850)', 'সারা দেশ করিডোর (৳ ৮৫০)')}
                        </option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="checkout-coupon" className="block font-bold text-slate-800 mb-1.5">
                        <span className="inline-flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-[#047857]" strokeWidth={1.75} />
                          {tr('Promo / Trade Coupon', 'প্রোমো কুপন কোড')}
                        </span>
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          id="checkout-coupon"
                          type="text"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value)}
                          placeholder="AGRI10"
                          className="agri-input flex-1 min-w-0 font-mono uppercase"
                        />
                        <button
                          type="button"
                          onClick={() => handleApplyCoupon()}
                          className="agri-btn agri-btn-primary agri-btn-sm shrink-0"
                        >
                          {tr('Apply', 'প্রয়োগ')}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Quick Coupon Suggestions + Validation */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] font-semibold text-slate-500">
                        {tr('Quick codes:', 'কুপন:')}
                      </span>
                      {AVAILABLE_COUPONS.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => handleApplyCoupon(c.code)}
                          title={language === 'bn' ? c.labelBn : c.labelEn}
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border transition ${
                            breakdown.couponCode === c.code && breakdown.couponApplied
                              ? 'bg-[#047857] text-white border-[#047857]'
                              : 'bg-[#d1fae5]/65 text-[#047857] border-[#10b981]/30 hover:bg-[#d1fae5]'
                          }`}
                        >
                          {c.code}
                        </button>
                      ))}
                    </div>
                    {(breakdown.couponErrorEn || breakdown.couponErrorBn) && (
                      <p className="text-[11px] text-amber-700">
                        {language === 'bn' ? breakdown.couponErrorBn : breakdown.couponErrorEn}
                      </p>
                    )}
                    {breakdown.subtotal > 0 && breakdown.subtotal < breakdown.freeShippingThreshold && (
                      <p className="text-[11px] text-[#047857]">
                        {tr(
                          `Free shipping on orders ${formatCurrency(breakdown.freeShippingThreshold, 'en')}+`,
                          `${formatCurrency(breakdown.freeShippingThreshold, 'bn')}+ অর্ডারে ফ্রি ডেলিভারি`
                        )}
                      </p>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div>
                    <span className="block font-bold text-slate-800 mb-2">
                      {tr('Payment Method', 'পেমেন্ট পদ্ধতি')}
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          id: 'bkash_nagad' as PaymentMethod,
                          label: tr('bKash / Nagad', 'বিকাশ / নগদ'),
                          icon: <Smartphone className="w-4 h-4 text-[#047857]" strokeWidth={1.75} />
                        },
                        {
                          id: 'bank_escrow' as PaymentMethod,
                          label: tr('Bank Transfer', 'ব্যাংক ট্রান্সফার'),
                          icon: <CreditCard className="w-4 h-4 text-[#047857]" strokeWidth={1.75} />
                        },
                        {
                          id: 'cod' as PaymentMethod,
                          label: tr('Cash on Delivery', 'ক্যাশ অন ডেলিভারি'),
                          icon: <Banknote className="w-4 h-4 text-[#047857]" strokeWidth={1.75} />
                        }
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPaymentMethod(opt.id)}
                          className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1.5 transition font-semibold text-[11px] ${
                            paymentMethod === opt.id
                              ? 'bg-[#d1fae5]/75 border-[#10b981] text-[#047857] shadow-2xs'
                              : 'bg-[#f7faf8] border-[#dce7e0] text-slate-700 hover:bg-[#d1fae5]/40'
                          }`}
                        >
                          {opt.icon}
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Buyer & Delivery Information */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="chk-name" className="block font-bold text-slate-800 mb-1.5">
                          {tr('Buyer / Organization Name', 'ক্রেতা বা প্রতিষ্ঠানের নাম')}
                        </label>
                        <input
                          id="chk-name"
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder={tr('e.g. FreshBasket Supermarkets', 'যেমন: ফ্রেশবাস্কেট সুপারমার্কেট')}
                          className="agri-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="chk-phone" className="block font-bold text-slate-800 mb-1.5">
                          {tr('Contact Phone', 'ফোন নম্বর')}
                        </label>
                        <input
                          id="chk-phone"
                          type="text"
                          required
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="agri-input font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="chk-email" className="block font-bold text-slate-800 mb-1.5">
                        {tr('Invoice Email Address', 'ইনভয়েস ইমেইল')}
                      </label>
                      <input
                        id="chk-email"
                        type="email"
                        required
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="orders@company.bd"
                        className="agri-input"
                      />
                    </div>

                    <div>
                      <label htmlFor="chk-address" className="block font-bold text-slate-800 mb-1.5">
                        {tr('Delivery Hub / Store Address', 'ডেলিভারি ঠিকানা')}
                      </label>
                      <input
                        id="chk-address"
                        type="text"
                        required
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="agri-input"
                      />
                    </div>

                    <div>
                      <label htmlFor="chk-notes" className="block font-bold text-slate-800 mb-1.5">
                        {tr('Handling Instructions', 'সংরক্ষণ ও পরিবহন নির্দেশনা')}
                      </label>
                      <input
                        id="chk-notes"
                        type="text"
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        className="agri-input"
                      />
                    </div>
                  </div>

                  {/* Standardized Mathematical Order Summary */}
                  <div className="p-4 rounded-2xl bg-[#d1fae5]/45 border border-[#10b981]/30 space-y-2">
                    <div className="flex items-center justify-between text-slate-700">
                      <span>{tr('Total Quantity:', 'মোট পরিমাণ:')}</span>
                      <span className="font-mono tabular-nums font-semibold">
                        {formatNumber(breakdown.totalUnits, language)}{' '}
                        {cartItems.length === 1 ? cartItems[0].unitType : tr('units', 'ইউনিট')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span>{tr('Subtotal:', 'উপমোট (Subtotal):')}</span>
                      <span className="font-mono tabular-nums font-semibold">
                        {formatCurrency(breakdown.subtotal, language)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span>{tr('Shipping:', 'পরিবহন খরচ:')}</span>
                      <span className="font-mono tabular-nums font-semibold">
                        {breakdown.shipping === 0
                          ? tr('Free', 'ফ্রি')
                          : formatCurrency(breakdown.shipping, language)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span>
                        {tr('Discount:', 'ছাড়:')}
                        {breakdown.couponApplied ? ` (${breakdown.couponCode})` : ''}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-[#047857]">
                        -{formatCurrency(breakdown.discount, language)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span>{tr('Tax / VAT (5%):', 'ভ্যাট ও কর (৫%):')}</span>
                      <span className="font-mono tabular-nums font-semibold">
                        {formatCurrency(breakdown.tax, language)}
                      </span>
                    </div>
                    <div className="pt-2.5 border-t border-[#10b981]/30 flex items-center justify-between text-sm font-bold text-slate-900">
                      <span>{tr('Grand Total:', 'সর্বমোট মূল্য:')}</span>
                      <span className="font-mono tabular-nums text-base text-[#047857]">
                        {formatCurrency(breakdown.grandTotal, language)}
                      </span>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Drawer Footer */}
            {cartItems.length > 0 && (
              <div className="p-4 sm:p-5 border-t border-[#dce7e0] bg-[#f7faf8] space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5 text-[#047857] font-semibold">
                    <ShieldCheck className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                    {tr('Protected payment & instant PDF invoice', 'সুরক্ষিত পেমেন্ট ও তাৎক্ষণিক PDF ইনভয়েস')}
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(breakdown.grandTotal, language)}
                  </span>
                </div>

                <button
                  type="submit"
                  form="agrihub-checkout-form"
                  disabled={submitting}
                  className="agri-btn agri-btn-primary w-full py-3 text-xs sm:text-sm"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                  <span>
                    {submitting
                      ? tr('Confirming & Generating Invoice...', 'অর্ডার ও ইনভয়েস তৈরি হচ্ছে...')
                      : tr('Place Order & View Invoice', 'অর্ডার সম্পন্ন করুন ও ইনভয়েস দেখুন')}
                  </span>
                  <ArrowRight className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Invoice Modal */}
      {activeInvoiceOrder && (
        <Suspense fallback={null}>
          <InvoiceModal order={activeInvoiceOrder} onClose={closeInvoice} />
        </Suspense>
      )}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
