import type { OrderItem, OrderLineItem } from '../mockData';
import type { Language } from '../context/LanguageContext';
import { calculateLineTotal, roundCurrency } from './pricing';

export interface InvoiceData {
  invoiceNumber: string;
  orderNumber: string;
  issueDate: string;
  paymentMethod: string;
  paymentStatus: OrderItem['paymentStatus'];
  orderStatus: OrderItem['orderStatus'];
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  items: OrderLineItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  couponCode?: string;
  tax: number;
  grandTotal: number;
  notes?: string;
}

export function formatPaymentMethodLabel(method: string | undefined, language: Language): string {
  switch (method) {
    case 'bkash_nagad':
      return language === 'bn' ? 'বিকাশ / নগদ মোবাইল পেমেন্ট' : 'bKash / Nagad Mobile Pay';
    case 'bank_escrow':
      return language === 'bn' ? 'ব্যাংক ট্রান্সফার (সুরক্ষিত)' : 'Bank Transfer (Protected)';
    case 'cod':
      return language === 'bn' ? 'ক্যাশ অন ডেলিভারি' : 'Cash on Delivery';
    default:
      return language === 'bn' ? 'অ্যাগ্রিহাব নিরাপদ পেমেন্ট' : 'AgriHub Protected Trade Pay';
  }
}

export function formatPaymentStatusLabel(
  status: OrderItem['paymentStatus'] | string,
  language: Language
): string {
  switch (status) {
    case 'paid':
      return language === 'bn' ? 'পরিশোধিত' : 'Paid';
    case 'escrow_held':
      return language === 'bn' ? 'সুরক্ষিত (এসক্রো)' : 'Paid (Protected)';
    case 'refunded':
      return language === 'bn' ? 'ফেরত প্রদান' : 'Refunded';
    default:
      return language === 'bn' ? 'অপেক্ষমাণ' : 'Pending';
  }
}

export function formatOrderStatusLabel(
  status: OrderItem['orderStatus'] | string,
  language: Language
): string {
  switch (status) {
    case 'placed':
      return language === 'bn' ? 'অর্ডার সম্পন্ন' : 'Placed';
    case 'confirmed':
      return language === 'bn' ? 'নিশ্চিতকৃত' : 'Confirmed';
    case 'processing':
      return language === 'bn' ? 'প্রক্রিয়াধীন' : 'Processing';
    case 'shipped':
      return language === 'bn' ? 'পরিবহনে রয়েছে' : 'Shipped';
    case 'delivered':
      return language === 'bn' ? 'ডেলিভারি সম্পন্ন' : 'Delivered';
    case 'cancelled':
      return language === 'bn' ? 'বাতিল' : 'Cancelled';
    default:
      return String(status || 'Placed');
  }
}

export function normalizeApiOrderToOrderItem(raw: any): OrderItem {
  if (!raw) {
    throw new Error('Order record is empty');
  }

  const rawItems: any[] = Array.isArray(raw.items) ? raw.items : [];
  const firstItem = rawItems[0];

  const mappedItems: OrderLineItem[] =
    rawItems.length > 0
      ? rawItems.map((it: any) => {
          const qty = Math.max(0, Number(it.quantity ?? 0));
          const unitPrice = roundCurrency(
            Number(it.unit_price ?? it.unitPrice ?? 0) ||
              (qty > 0 && it.line_total ? Number(it.line_total) / qty : 0)
          );
          const lineTotal = roundCurrency(
            Number(it.line_total ?? it.lineTotal ?? 0) || calculateLineTotal(unitPrice, qty)
          );
          return {
            productId: Number(it.product_id ?? it.productId ?? 0) || undefined,
            title: it.title || it.product_title || 'Agricultural Produce',
            batchNumber: it.batch_number || it.batchNumber || '—',
            unitPrice,
            quantity: qty,
            unitType: it.unit_type || it.unitType || 'kg',
            lineTotal
          };
        })
      : [
          {
            title: raw.productTitle || raw.product_title || 'Wholesale Produce Order',
            batchNumber: raw.batchNumber || raw.batch_number || '—',
            unitPrice:
              Number(raw.unitPrice ?? raw.unit_price ?? 0) ||
              (Number(raw.quantity) > 0
                ? roundCurrency(Number(raw.totalAmount ?? raw.total_amount ?? 0) / Number(raw.quantity))
                : 0),
            quantity: Number(raw.quantity || 1),
            unitType: raw.unitType || raw.unit_type || 'unit',
            lineTotal: roundCurrency(Number(raw.totalAmount ?? raw.total_amount ?? 0))
          }
        ];

  const computedSubtotal = roundCurrency(
    mappedItems.reduce((sum, item) => sum + item.lineTotal, 0)
  );
  const rawTotal = roundCurrency(Number(raw.totalAmount ?? raw.total_amount ?? computedSubtotal));

  const hasBreakdown =
    raw.subtotal !== undefined ||
    raw.shippingFee !== undefined ||
    raw.taxAmount !== undefined ||
    raw.discountAmount !== undefined;

  const subtotal = roundCurrency(Number(raw.subtotal ?? computedSubtotal));
  const shippingFee = roundCurrency(Number(raw.shippingFee ?? raw.shipping_fee ?? 0));
  const discountAmount = roundCurrency(Number(raw.discountAmount ?? raw.discount_amount ?? 0));
  const taxAmount = roundCurrency(Number(raw.taxAmount ?? raw.tax_amount ?? 0));

  const totalAmount = hasBreakdown
    ? roundCurrency(Math.max(0, subtotal - discountAmount + shippingFee + taxAmount))
    : rawTotal;

  const idNum = Number(raw.id || Date.now());
  const orderNumber = String(raw.orderNumber || raw.order_number || `AGRI-ORD-${idNum}`);
  const invoiceNumber =
    raw.invoiceNumber ||
    raw.invoice_number ||
    `INV-${orderNumber.replace(/[^0-9A-Z]/gi, '').slice(-8) || idNum}`;

  return {
    id: idNum,
    invoiceNumber,
    orderNumber,
    buyerName: raw.buyerName || raw.buyer?.business_name || raw.buyer?.name || 'Verified Buyer',
    buyerEmail: raw.buyerEmail || raw.buyer?.email || '',
    buyerPhone: raw.buyerPhone || raw.buyer?.phone || '',
    productTitle:
      raw.productTitle ||
      (mappedItems.length > 1
        ? `${mappedItems[0].title} (+${mappedItems.length - 1} more)`
        : mappedItems[0]?.title || 'Agricultural Produce'),
    batchNumber: raw.batchNumber || mappedItems[0]?.batchNumber || '—',
    unitPrice: raw.unitPrice ?? mappedItems[0]?.unitPrice ?? 0,
    quantity: Number(raw.quantity ?? firstItem?.quantity ?? mappedItems[0]?.quantity ?? 0),
    unitType: raw.unitType || firstItem?.unit_type || mappedItems[0]?.unitType || 'kg',
    items: mappedItems,
    subtotal,
    shippingFee,
    discountAmount,
    couponCode: raw.couponCode || raw.coupon_code || undefined,
    taxAmount,
    totalAmount,
    paymentMethod: raw.paymentMethod || raw.payment_method || 'bank_escrow',
    paymentStatus: (raw.paymentStatus || raw.payment_status || 'pending') as OrderItem['paymentStatus'],
    orderStatus: (raw.orderStatus || raw.order_status || 'placed') as OrderItem['orderStatus'],
    deliveryAddress: raw.deliveryAddress || raw.delivery_address || 'Dhaka Distribution Hub, Bangladesh',
    notes: raw.notes || '',
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString().replace('T', ' ').slice(0, 16)
  };
}

export function buildInvoiceFromOrder(orderInput: OrderItem | any): InvoiceData {
  const order =
    orderInput && 'orderNumber' in orderInput && Array.isArray(orderInput.items)
      ? (orderInput as OrderItem)
      : normalizeApiOrderToOrderItem(orderInput);

  const items: OrderLineItem[] =
    order.items && order.items.length > 0
      ? order.items.map((item) => ({
          ...item,
          unitPrice: roundCurrency(item.unitPrice),
          lineTotal: calculateLineTotal(item.unitPrice, item.quantity)
        }))
      : [
          {
            title: order.productTitle,
            batchNumber: order.batchNumber,
            unitPrice:
              order.unitPrice && order.unitPrice > 0
                ? roundCurrency(order.unitPrice)
                : order.quantity > 0
                ? roundCurrency(order.totalAmount / order.quantity)
                : order.totalAmount,
            quantity: order.quantity || 1,
            unitType: order.unitType || 'kg',
            lineTotal:
              order.unitPrice && order.unitPrice > 0
                ? calculateLineTotal(order.unitPrice, order.quantity || 1)
                : roundCurrency(order.totalAmount)
          }
        ];

  const itemsSubtotal = roundCurrency(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const subtotal = order.subtotal !== undefined ? roundCurrency(order.subtotal) : itemsSubtotal;
  const shipping = order.shippingFee !== undefined ? roundCurrency(order.shippingFee) : 0;
  const discount = order.discountAmount !== undefined ? roundCurrency(order.discountAmount) : 0;
  const tax = order.taxAmount !== undefined ? roundCurrency(order.taxAmount) : 0;

  const computedTotal = roundCurrency(Math.max(0, subtotal - discount + shipping + tax));
  const grandTotal =
    order.subtotal !== undefined || order.taxAmount !== undefined || order.shippingFee !== undefined
      ? computedTotal
      : roundCurrency(order.totalAmount || computedTotal);

  return {
    invoiceNumber:
      order.invoiceNumber || `INV-${String(order.orderNumber).replace(/[^0-9A-Z]/gi, '').slice(-8)}`,
    orderNumber: order.orderNumber,
    issueDate: order.createdAt || new Date().toISOString().replace('T', ' ').slice(0, 16),
    paymentMethod: order.paymentMethod || 'bank_escrow',
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    customer: {
      name: order.buyerName || 'Verified Buyer',
      email: order.buyerEmail || 'buyer@agrihub.bd',
      phone: order.buyerPhone || '+880 1700-000000',
      address: order.deliveryAddress || 'Bangladesh Trade Hub'
    },
    items,
    subtotal,
    shipping,
    discount,
    couponCode: order.couponCode,
    tax,
    grandTotal,
    notes: order.notes
  };
}
