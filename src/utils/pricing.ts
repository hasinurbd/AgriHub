export type DeliveryZone = 'dhaka' | 'regional';
export type PaymentMethod = 'bkash_nagad' | 'bank_escrow' | 'cod';

export interface CheckoutCartItem {
  productId: number;
  title: string;
  batchNumber: string;
  farmerName: string;
  category: string;
  unitPrice: number;
  unitType: string;
  quantity: number;
  maxAvailable: number;
  storageTempCelsius: number;
  isOrganic: boolean;
}

export interface PricedLineItem {
  productId: number;
  title: string;
  batchNumber: string;
  unitPrice: number;
  unitType: string;
  quantity: number;
  lineTotal: number;
}

export interface OrderPricingBreakdown {
  items: PricedLineItem[];
  itemCount: number;
  totalUnits: number;
  subtotal: number;
  shipping: number;
  discount: number;
  taxRate: number;
  tax: number;
  grandTotal: number;
  freeShippingThreshold: number;
  couponCode: string;
  couponApplied: boolean;
  couponErrorEn?: string;
  couponErrorBn?: string;
}

export const FREE_SHIPPING_THRESHOLD = 100000;
export const STANDARD_TAX_RATE = 0.05;

export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateLineTotal(unitPrice: number, quantity: number): number {
  const safePrice = Math.max(0, Number(unitPrice) || 0);
  const safeQty = Math.max(0, Number(quantity) || 0);
  return roundCurrency(safePrice * safeQty);
}

export function normalizeCouponCode(code?: string): string {
  return (code || '').trim().toUpperCase();
}

export const AVAILABLE_COUPONS = [
  {
    code: 'AGRI10',
    labelEn: '10% off produce subtotal (up to BDT 15,000)',
    labelBn: 'মোট পণ্যের মূল্যে ১০% ছাড় (সর্বোচ্চ ৳ ১৫,০০০)'
  },
  {
    code: 'FRESH500',
    labelEn: 'BDT 500 off orders BDT 2,500+',
    labelBn: '৳ ২,৫০০+ অর্ডারে ৳ ৫০০ ছাড়'
  },
  {
    code: 'FREESHIP',
    labelEn: 'Free nationwide cold-chain shipping',
    labelBn: 'ফ্রি সারা দেশে কোল্ড-চেইন পরিবহন'
  }
];

export function evaluateCoupon(
  rawCode: string,
  subtotal: number
): {
  code: string;
  applied: boolean;
  discount: number;
  freeShipping: boolean;
  errorEn?: string;
  errorBn?: string;
} {
  const code = normalizeCouponCode(rawCode);
  if (!code) {
    return { code: '', applied: false, discount: 0, freeShipping: false };
  }

  if (code === 'AGRI10') {
    if (subtotal <= 0) {
      return {
        code,
        applied: false,
        discount: 0,
        freeShipping: false,
        errorEn: 'Add items to apply AGRI10.',
        errorBn: 'AGRI10 ব্যবহার করতে পণ্য যোগ করুন।'
      };
    }
    const discount = Math.min(15000, roundCurrency(subtotal * 0.1));
    return { code, applied: true, discount, freeShipping: false };
  }

  if (code === 'FRESH500') {
    if (subtotal < 2500) {
      return {
        code,
        applied: false,
        discount: 0,
        freeShipping: false,
        errorEn: 'FRESH500 requires a minimum subtotal of BDT 2,500.',
        errorBn: 'FRESH500 ব্যবহার করতে ন্যূনতম ৳ ২,৫০০ টাকার পণ্য প্রয়োজন।'
      };
    }
    return { code, applied: true, discount: 500, freeShipping: false };
  }

  if (code === 'FREESHIP') {
    return { code, applied: true, discount: 0, freeShipping: true };
  }

  return {
    code,
    applied: false,
    discount: 0,
    freeShipping: false,
    errorEn: 'Invalid coupon code. Try AGRI10, FRESH500, or FREESHIP.',
    errorBn: 'সঠিক কুপন কোড নয়। AGRI10, FRESH500 অথবা FREESHIP চেষ্টা করুন।'
  };
}

export function calculateShippingFee(
  subtotal: number,
  deliveryZone: DeliveryZone = 'dhaka',
  freeShippingCoupon = false
): number {
  if (subtotal <= 0) return 0;
  if (freeShippingCoupon || subtotal >= FREE_SHIPPING_THRESHOLD) return 0;
  return deliveryZone === 'dhaka' ? 450 : 850;
}

export function calculateOrderBreakdown(params: {
  items: Array<{
    productId: number;
    title: string;
    batchNumber: string;
    unitPrice: number;
    unitType: string;
    quantity: number;
  }>;
  couponCode?: string;
  deliveryZone?: DeliveryZone;
  taxRate?: number;
}): OrderPricingBreakdown {
  const pricedItems: PricedLineItem[] = params.items
    .filter((item) => Number(item.quantity) > 0)
    .map((item) => {
      const unitPrice = roundCurrency(Math.max(0, Number(item.unitPrice) || 0));
      const quantity = Math.max(0, Number(item.quantity) || 0);
      return {
        productId: item.productId,
        title: item.title,
        batchNumber: item.batchNumber,
        unitPrice,
        unitType: item.unitType,
        quantity,
        lineTotal: calculateLineTotal(unitPrice, quantity)
      };
    });

  const subtotal = roundCurrency(pricedItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const totalUnits = roundCurrency(pricedItems.reduce((sum, item) => sum + item.quantity, 0));

  const coupon = evaluateCoupon(params.couponCode || '', subtotal);
  const discount = roundCurrency(Math.min(subtotal, coupon.discount));
  const shipping = calculateShippingFee(subtotal, params.deliveryZone || 'dhaka', coupon.freeShipping);

  const taxRate = params.taxRate ?? STANDARD_TAX_RATE;
  const taxableAmount = Math.max(0, roundCurrency(subtotal - discount));
  const tax = roundCurrency(taxableAmount * taxRate);

  const grandTotal = roundCurrency(Math.max(0, subtotal - discount + shipping + tax));

  return {
    items: pricedItems,
    itemCount: pricedItems.length,
    totalUnits,
    subtotal,
    shipping,
    discount,
    taxRate,
    tax,
    grandTotal,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    couponCode: coupon.code,
    couponApplied: coupon.applied,
    couponErrorEn: coupon.errorEn,
    couponErrorBn: coupon.errorBn
  };
}
