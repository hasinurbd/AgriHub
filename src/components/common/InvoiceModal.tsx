import React, { useMemo, useState, useEffect } from 'react';
import {
  X,
  FileDown,
  FileText,
  Printer,
  CheckCircle2,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Truck,
  MapPin,
  Phone,
  Mail,
  User
} from 'lucide-react';
import type { OrderItem } from '../../mockData';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import {
  buildInvoiceFromOrder,
  formatOrderStatusLabel,
  formatPaymentMethodLabel,
  formatPaymentStatusLabel
} from '../../utils/invoiceGenerator';
import { downloadInvoicePdf, downloadOrderSummaryPdf } from '../../utils/pdfExport';

interface InvoiceModalProps {
  order: OrderItem | any | null;
  onClose: () => void;
}

function getPaymentBadgeClasses(status: string) {
  switch (status) {
    case 'paid':
    case 'escrow_held':
      return 'bg-[#d1fae5]/75 text-[#047857] border-[#10b981]/35';
    case 'refunded':
      return 'bg-red-50 text-red-800 border-red-200';
    default:
      return 'bg-amber-50 text-amber-800 border-amber-200';
  }
}

function getDeliveryBadgeClasses(status: string) {
  switch (status) {
    case 'delivered':
    case 'shipped':
    case 'confirmed':
      return 'bg-[#d1fae5]/75 text-[#047857] border-[#10b981]/35';
    case 'cancelled':
      return 'bg-red-50 text-red-800 border-red-200';
    default:
      return 'bg-amber-50 text-amber-800 border-amber-200';
  }
}

export default function InvoiceModal({ order, onClose }: InvoiceModalProps) {
  const { language, tr } = useLanguage();
  const [downloadingType, setDownloadingType] = useState<'invoice' | 'summary' | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    if (!order) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [order, onClose]);

  const invoice = useMemo(() => {
    if (!order) return null;
    return buildInvoiceFromOrder(order);
  }, [order]);

  if (!order || !invoice) return null;

  const handleDownload = async (mode: 'invoice' | 'summary') => {
    setPdfError(null);
    setDownloadingType(mode);
    try {
      if (mode === 'invoice') {
        await downloadInvoicePdf(invoice, language);
      } else {
        await downloadOrderSummaryPdf(invoice, language);
      }
    } catch (err: any) {
      setPdfError(
        err?.message ||
          tr(
            'Could not generate the PDF file. Please try Print Invoice instead.',
            'পিডিএফ তৈরি করা যায়নি। অনুগ্রহ করে প্রিন্ট অপশন ব্যবহার করুন।'
          )
      );
    } finally {
      setDownloadingType(null);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const originUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://agrihub.bd';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="agrihub-invoice-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white border border-[#dce7e0] rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Action Toolbar (hidden when printing) */}
        <div className="no-print px-4 sm:px-6 py-3.5 bg-[#f7faf8] border-b border-[#dce7e0] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-[#047857] shrink-0" strokeWidth={1.75} />
            <h2 id="agrihub-invoice-modal-title" className="font-bold text-slate-900 text-sm truncate">
              {tr('Invoice & Trade Receipt', 'ইনভয়েস ও বাণিজ্য রসিদ')} ·{' '}
              <span className="font-mono text-[#047857]">{invoice.invoiceNumber}</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={downloadingType !== null}
              onClick={() => handleDownload('invoice')}
              className="agri-btn agri-btn-primary agri-btn-sm"
            >
              <FileDown className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
              <span>
                {downloadingType === 'invoice'
                  ? tr('Generating...', 'তৈরি হচ্ছে...')
                  : tr('Invoice PDF', 'ইনভয়েস PDF')}
              </span>
            </button>

            <button
              type="button"
              disabled={downloadingType !== null}
              onClick={() => handleDownload('summary')}
              className="agri-btn agri-btn-secondary agri-btn-sm"
            >
              <FileText className="w-3.5 h-3.5 text-[#047857] shrink-0" strokeWidth={1.75} />
              <span>
                {downloadingType === 'summary'
                  ? tr('Generating...', 'তৈরি হচ্ছে...')
                  : tr('Order Summary PDF', 'অর্ডার সারাংশ PDF')}
              </span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="agri-btn agri-btn-secondary agri-btn-sm"
            >
              <Printer className="w-3.5 h-3.5 text-[#047857] shrink-0" strokeWidth={1.75} />
              <span className="hidden sm:inline">{tr('Print', 'প্রিন্ট')}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label={tr('Close invoice modal', 'ইনভয়েস বন্ধ করুন')}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-[#d1fae5]/60 transition"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {pdfError && (
          <div className="no-print mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" strokeWidth={1.75} />
            <span>{pdfError}</span>
          </div>
        )}

        {/* Printable Branded Invoice Body */}
        <div className="overflow-y-auto p-4 sm:p-6">
          <div
            id="agrihub-printable-invoice"
            className="bg-white border border-[#dce7e0] rounded-2xl p-5 sm:p-8 space-y-6 text-slate-800"
          >
            {/* 1. Brand Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-[#047857]">
              <div className="flex items-center gap-3.5">
                <img
                  src="/agrihub-logo.png"
                  alt="AgriHub"
                  className="h-9 sm:h-10 w-auto object-contain shrink-0"
                />
                <div>
                  <div className="font-bold text-[#047857] text-sm sm:text-base leading-tight">
                    {tr(
                      'AgriHub — Bangladesh Agricultural Trade Network',
                      'অ্যাগ্রিহাব — বাংলাদেশের কৃষি বাণিজ্য নেটওয়ার্ক'
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {tr(
                      'Tejgaon Agricultural Trade Corridor, Dhaka 1215, Bangladesh',
                      'তেজগাঁও কৃষি বাণিজ্য কেন্দ্র, ঢাকা-১২১৫, বাংলাদেশ'
                    )}
                  </div>
                </div>
              </div>

              <div className="sm:text-right">
                <div className="text-lg sm:text-xl font-bold text-[#047857] tracking-wide">
                  {tr('TAX & TRADE INVOICE', 'ট্রেড ইনভয়েস')}
                </div>
                <div className="text-[11px] text-slate-500">
                  {tr('Official Digital Receipt', 'অফিশিয়াল ডিজিটাল রসিদ')}
                </div>
              </div>
            </div>

            {/* 2. Invoice Info + Customer Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-[#f7faf8] border border-[#dce7e0] rounded-xl p-4 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#047857] mb-2">
                  {tr('Invoice & Order Info', 'ইনভয়েস ও অর্ডার তথ্য')}
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">{tr('Invoice No.:', 'ইনভয়েস নং:')}</span>
                  <span className="font-mono font-bold text-slate-900">{invoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">{tr('Order No.:', 'অর্ডার নং:')}</span>
                  <span className="font-mono font-semibold text-[#047857]">{invoice.orderNumber}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">{tr('Issue Date:', 'তারিখ:')}</span>
                  <span className="font-mono text-slate-800">{invoice.issueDate}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">{tr('Payment Method:', 'পেমেন্ট মাধ্যম:')}</span>
                  <span className="font-semibold text-slate-800 text-right">
                    {formatPaymentMethodLabel(invoice.paymentMethod, language)}
                  </span>
                </div>
              </div>

              <div className="bg-[#f7faf8] border border-[#dce7e0] rounded-xl p-4 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#047857] mb-2">
                  {tr('Customer & Delivery Details', 'ক্রেতা ও ডেলিভারি তথ্য')}
                </div>
                <div className="flex items-start gap-2">
                  <User className="w-3.5 h-3.5 text-[#047857] mt-0.5 shrink-0" strokeWidth={1.75} />
                  <span className="font-bold text-slate-900">{invoice.customer.name}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="w-3.5 h-3.5 text-[#047857] mt-0.5 shrink-0" strokeWidth={1.75} />
                  <span className="text-slate-600 break-all">{invoice.customer.email}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#047857] mt-0.5 shrink-0" strokeWidth={1.75} />
                  <span className="font-mono text-slate-600">{invoice.customer.phone}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#047857] mt-0.5 shrink-0" strokeWidth={1.75} />
                  <span className="text-slate-700">{invoice.customer.address}</span>
                </div>
              </div>
            </div>

            {/* 3. Payment & Delivery Status Badges */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border font-bold ${getPaymentBadgeClasses(
                  invoice.paymentStatus
                )}`}
              >
                {invoice.paymentStatus === 'paid' || invoice.paymentStatus === 'escrow_held' ? (
                  <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.75} />
                ) : (
                  <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
                )}
                <span>
                  {tr('Payment:', 'পেমেন্ট:')} {formatPaymentStatusLabel(invoice.paymentStatus, language)}
                </span>
              </span>

              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border font-bold ${getDeliveryBadgeClasses(
                  invoice.orderStatus
                )}`}
              >
                {invoice.orderStatus === 'delivered' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                ) : (
                  <Truck className="w-3.5 h-3.5" strokeWidth={1.75} />
                )}
                <span>
                  {tr('Delivery:', 'ডেলিভারি:')} {formatOrderStatusLabel(invoice.orderStatus, language)}
                </span>
              </span>
            </div>

            {/* 4. Itemized Product Table */}
            <div className="overflow-x-auto border border-[#dce7e0] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#047857] text-white">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3">{tr('Product Description & Batch', 'পণ্যের বিবরণ ও ব্যাচ')}</th>
                    <th className="py-2.5 px-3 text-right">{tr('Unit Price', 'একক মূল্য')}</th>
                    <th className="py-2.5 px-3 text-right">{tr('Quantity', 'পরিমাণ')}</th>
                    <th className="py-2.5 px-3 text-right">{tr('Amount', 'মোট')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoice.items.map((item, idx) => (
                    <tr key={`${item.batchNumber}-${idx}`} className="bg-white even:bg-[#f7faf8]">
                      <td className="py-3 px-3 text-center font-mono text-slate-500">
                        {formatNumber(idx + 1, language)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{item.title}</div>
                        <div className="font-mono text-[11px] text-[#047857] mt-0.5">{item.batchNumber}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatCurrency(item.unitPrice, language)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatNumber(item.quantity, language)} {item.unitType}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(item.lineTotal, language)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 5. Totals Breakdown & Notes */}
            <div className="flex flex-col md:flex-row justify-between gap-5 items-start">
              <div className="flex-1 text-xs">
                {invoice.notes && (
                  <div className="p-3.5 rounded-xl bg-[#d1fae5]/45 border border-[#10b981]/30 text-[#047857] space-y-1">
                    <div className="font-bold">
                      {tr('Delivery & Cold-Chain Notes', 'পরিবহন ও কোল্ড-চেইন নির্দেশনা')}
                    </div>
                    <p className="text-slate-700">{invoice.notes}</p>
                  </div>
                )}
              </div>

              <div className="w-full md:w-80 bg-[#f7faf8] border border-[#dce7e0] rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>{tr('Subtotal', 'উপমোট')}</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {formatCurrency(invoice.subtotal, language)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{tr('Shipping', 'পরিবহন খরচ')}</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {invoice.shipping === 0
                      ? tr('Free', 'ফ্রি')
                      : formatCurrency(invoice.shipping, language)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    {tr('Discount', 'ছাড়')}
                    {invoice.couponCode ? ` (${invoice.couponCode})` : ''}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-[#047857]">
                    -{formatCurrency(invoice.discount, language)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{tr('Tax / VAT (5%)', 'ভ্যাট ও কর (৫%)')}</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {formatCurrency(invoice.tax, language)}
                  </span>
                </div>
                <div className="pt-2.5 border-t-2 border-[#047857] flex justify-between items-center text-sm font-bold text-[#047857]">
                  <span>{tr('Grand Total', 'সর্বমোট মূল্য')}</span>
                  <span className="font-mono tabular-nums text-base">
                    {formatCurrency(invoice.grandTotal, language)}
                  </span>
                </div>
              </div>
            </div>

            {/* 6. Branded Footer */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-2 text-[11px] text-slate-500">
              <div>
                <div className="font-bold text-[#047857]">
                  {tr(
                    'Thank you for sourcing directly from verified farmers with AgriHub!',
                    'অ্যাগ্রিহাবের মাধ্যমে সরাসরি কৃষকদের কাছ থেকে সংগ্রহ করার জন্য ধন্যবাদ!'
                  )}
                </div>
                <div>
                  {tr(
                    'Generated by AgriHub · Support: support@agrihub.bd · Hotline: +880 9612-000800',
                    'অ্যাগ্রিহাব কর্তৃক প্রস্তুতকৃত · সহায়তা: support@agrihub.bd · হটলাইন: +৮৮০ ৯৬১২-০০০৮০০'
                  )}
                </div>
              </div>
              <div className="sm:text-right font-mono text-[10px] text-slate-400">{originUrl}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
