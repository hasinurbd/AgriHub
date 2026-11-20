import type { Language } from '../context/LanguageContext';
import { formatCurrency, formatNumber } from './formatters';
import {
  InvoiceData,
  formatOrderStatusLabel,
  formatPaymentMethodLabel,
  formatPaymentStatusLabel
} from './invoiceGenerator';
import type { OrderItem } from '../mockData';

let cachedLogoDataUrl: string | null = null;

async function getLogoDataUrl(): Promise<string> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  try {
    const res = await fetch('/agrihub-logo.png');
    if (!res.ok) return '';
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        cachedLogoDataUrl = result;
        resolve(result);
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

function escapeHtml(text: string | number | undefined | null): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getStatusColors(status: string): { bg: string; border: string; text: string } {
  switch (status) {
    case 'paid':
    case 'delivered':
      return { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' };
    case 'escrow_held':
    case 'shipped':
    case 'confirmed':
      return { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' };
    case 'refunded':
    case 'cancelled':
      return { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' };
    default:
      return { bg: '#fffbeb', border: '#fde68a', text: '#92400e' };
  }
}

function getWebsiteOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://agrihub.bd';
}

function createPageContainer(fontFamily: string): HTMLDivElement {
  const page = document.createElement('div');
  page.style.width = '794px';
  page.style.minHeight = '1122px';
  page.style.backgroundColor = '#ffffff';
  page.style.color = '#0f172a';
  page.style.fontFamily = fontFamily;
  page.style.padding = '40px 44px 36px 44px';
  page.style.boxSizing = 'border-box';
  page.style.display = 'flex';
  page.style.flexDirection = 'column';
  page.style.justifyContent = 'space-between';
  page.style.position = 'relative';
  return page;
}

function buildHeaderHtml(
  docTitle: string,
  subtitle: string,
  logoDataUrl: string,
  invoice: InvoiceData,
  language: Language,
  isContinuation: boolean,
  pageIndex: number,
  totalPages: number
): string {
  const payColors = getStatusColors(invoice.paymentStatus);
  const delColors = getStatusColors(invoice.orderStatus);
  const payLabel = formatPaymentStatusLabel(invoice.paymentStatus, language);
  const delLabel = formatOrderStatusLabel(invoice.orderStatus, language);

  return `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:18px; border-bottom:2px solid #047857;">
        <div style="display:flex; align-items:center; gap:14px;">
          ${
            logoDataUrl
              ? `<img src="${logoDataUrl}" alt="AgriHub" style="height:38px; width:auto; object-fit:contain;" />`
              : `<div style="width:38px; height:38px; border-radius:8px; background:#047857; color:#ffffff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:16px;">A</div>`
          }
          <div>
            <div style="font-size:15px; font-weight:800; color:#064e3b; letter-spacing:-0.01em;">
              ${escapeHtml(
                language === 'bn'
                  ? 'অ্যাগ্রিহাব — বাংলাদেশের কৃষি বাণিজ্য নেটওয়ার্ক'
                  : 'AgriHub — Bangladesh Agricultural Trade Network'
              )}
            </div>
            <div style="font-size:11px; color:#475569; margin-top:2px;">
              ${escapeHtml(
                language === 'bn'
                  ? 'তেজগাঁও কৃষি বাণিজ্য কেন্দ্র, ঢাকা-১২১৫, বাংলাদেশ'
                  : 'Tejgaon Agricultural Trade Corridor, Dhaka 1215, Bangladesh'
              )}
            </div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:20px; font-weight:800; color:#047857; letter-spacing:0.02em;">
            ${escapeHtml(docTitle)}
          </div>
          <div style="font-size:11px; color:#64748b; margin-top:2px;">
            ${escapeHtml(subtitle)}${
              totalPages > 1
                ? ` · ${escapeHtml(
                    language === 'bn'
                      ? `পৃষ্ঠা ${formatNumber(pageIndex + 1, 'bn')} / ${formatNumber(totalPages, 'bn')}`
                      : `Page ${pageIndex + 1} of ${totalPages}`
                  )}`
                : ''
            }
          </div>
        </div>
      </div>

      ${
        isContinuation
          ? `<div style="margin-top:14px; padding:10px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; display:flex; justify-content:space-between; font-size:11px; color:#334155;">
               <span><strong>${escapeHtml(language === 'bn' ? 'ইনভয়েস নং:' : 'Invoice No.:')}</strong> ${escapeHtml(invoice.invoiceNumber)}</span>
               <span><strong>${escapeHtml(language === 'bn' ? 'অর্ডার নং:' : 'Order No.:')}</strong> ${escapeHtml(invoice.orderNumber)}</span>
               <span><strong>${escapeHtml(language === 'bn' ? 'ক্রেতা:' : 'Customer:')}</strong> ${escapeHtml(invoice.customer.name)}</span>
             </div>`
          : `<div style="margin-top:18px; display:grid; grid-template-columns:1fr 1fr; gap:16px;">
               <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px;">
                 <div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#047857; margin-bottom:8px;">
                   ${escapeHtml(language === 'bn' ? 'ইনভয়েস ও অর্ডার তথ্য' : 'Invoice & Order Info')}
                 </div>
                 <div style="font-size:11px; line-height:1.7; color:#334155;">
                   <div><strong>${escapeHtml(language === 'bn' ? 'ইনভয়েস নং:' : 'Invoice No.:')}</strong> <span style="font-family:monospace;">${escapeHtml(invoice.invoiceNumber)}</span></div>
                   <div><strong>${escapeHtml(language === 'bn' ? 'অর্ডার নং:' : 'Order No.:')}</strong> <span style="font-family:monospace;">${escapeHtml(invoice.orderNumber)}</span></div>
                   <div><strong>${escapeHtml(language === 'bn' ? 'তারিখ:' : 'Date:')}</strong> ${escapeHtml(invoice.issueDate)}</div>
                   <div><strong>${escapeHtml(language === 'bn' ? 'পেমেন্ট মাধ্যম:' : 'Payment Method:')}</strong> ${escapeHtml(formatPaymentMethodLabel(invoice.paymentMethod, language))}</div>
                 </div>
               </div>
               <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px;">
                 <div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#047857; margin-bottom:8px;">
                   ${escapeHtml(language === 'bn' ? 'ক্রেতা ও ডেলিভারি তথ্য' : 'Customer & Delivery Details')}
                 </div>
                 <div style="font-size:11px; line-height:1.7; color:#334155;">
                   <div><strong>${escapeHtml(language === 'bn' ? 'নাম:' : 'Name:')}</strong> ${escapeHtml(invoice.customer.name)}</div>
                   <div><strong>${escapeHtml(language === 'bn' ? 'ইমেইল:' : 'Email:')}</strong> ${escapeHtml(invoice.customer.email)}</div>
                   <div><strong>${escapeHtml(language === 'bn' ? 'ফোন:' : 'Phone:')}</strong> ${escapeHtml(invoice.customer.phone)}</div>
                   <div><strong>${escapeHtml(language === 'bn' ? 'ঠিকানা:' : 'Address:')}</strong> ${escapeHtml(invoice.customer.address)}</div>
                 </div>
               </div>
             </div>
             <div style="margin-top:14px; display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
               <span style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700; background:${payColors.bg}; border:1px solid ${payColors.border}; color:${payColors.text};">
                 ${escapeHtml(language === 'bn' ? 'পেমেন্ট অবস্থা:' : 'Payment Status:')} ${escapeHtml(payLabel)}
               </span>
               <span style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700; background:${delColors.bg}; border:1px solid ${delColors.border}; color:${delColors.text};">
                 ${escapeHtml(language === 'bn' ? 'ডেলিভারি অবস্থা:' : 'Delivery Status:')} ${escapeHtml(delLabel)}
               </span>
             </div>`
      }
    </div>
  `;
}

function buildItemsTableHtml(
  items: InvoiceData['items'],
  language: Language,
  startIndex: number
): string {
  const rowsHtml = items
    .map((item, idx) => {
      const rowNum = formatNumber(startIndex + idx + 1, language);
      const unitPrice = formatCurrency(item.unitPrice, language);
      const qtyStr = `${formatNumber(item.quantity, language)} ${escapeHtml(item.unitType)}`;
      const lineTotal = formatCurrency(item.lineTotal, language);
      const bg = idx % 2 === 1 ? '#f8fafc' : '#ffffff';

      return `
        <tr style="background:${bg}; border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 12px; font-size:11px; color:#64748b; text-align:center;">${escapeHtml(rowNum)}</td>
          <td style="padding:10px 12px; font-size:11.5px; color:#0f172a;">
            <div style="font-weight:700;">${escapeHtml(item.title)}</div>
            <div style="font-size:10px; color:#047857; font-family:monospace; margin-top:2px;">${escapeHtml(item.batchNumber)}</div>
          </td>
          <td style="padding:10px 12px; font-size:11.5px; color:#334155; text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap;">${escapeHtml(unitPrice)}</td>
          <td style="padding:10px 12px; font-size:11.5px; color:#334155; text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap;">${qtyStr}</td>
          <td style="padding:10px 12px; font-size:11.5px; font-weight:700; color:#0f172a; text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap;">${escapeHtml(lineTotal)}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <table style="width:100%; border-collapse:collapse; margin-top:16px; border:1px solid #cbd5e1; border-radius:8px; overflow:hidden;">
      <thead>
        <tr style="background:#065f46; color:#ffffff;">
          <th style="padding:10px 12px; font-size:10.5px; text-align:center; width:40px;">#</th>
          <th style="padding:10px 12px; font-size:10.5px; text-align:left;">${escapeHtml(language === 'bn' ? 'পণ্যের বিবরণ ও ব্যাচ' : 'Product Description & Batch')}</th>
          <th style="padding:10px 12px; font-size:10.5px; text-align:right;">${escapeHtml(language === 'bn' ? 'একক মূল্য' : 'Unit Price')}</th>
          <th style="padding:10px 12px; font-size:10.5px; text-align:right;">${escapeHtml(language === 'bn' ? 'পরিমাণ' : 'Quantity')}</th>
          <th style="padding:10px 12px; font-size:10.5px; text-align:right;">${escapeHtml(language === 'bn' ? 'মোট পরিমাণ' : 'Amount')}</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

function buildSummaryBoxHtml(invoice: InvoiceData, language: Language): string {
  return `
    <div style="margin-top:18px; display:flex; justify-content:space-between; align-items:flex-start; gap:20px;">
      <div style="flex:1; font-size:11px; color:#475569; line-height:1.6;">
        ${
          invoice.notes
            ? `<div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:10px 12px; color:#166534;">
                 <div style="font-weight:700; margin-bottom:3px;">${escapeHtml(language === 'bn' ? 'পরিবহন ও মান নির্দেশনা' : 'Delivery & Handling Notes')}</div>
                 <div>${escapeHtml(invoice.notes)}</div>
               </div>`
            : ''
        }
      </div>
      <div style="width:280px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:14px; font-size:11.5px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:7px; color:#475569;">
          <span>${escapeHtml(language === 'bn' ? 'উপমোট (Subtotal)' : 'Subtotal')}</span>
          <span style="font-weight:600; color:#0f172a; font-variant-numeric:tabular-nums;">${escapeHtml(formatCurrency(invoice.subtotal, language))}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:7px; color:#475569;">
          <span>${escapeHtml(language === 'bn' ? 'পরিবহন খরচ (Shipping)' : 'Shipping')}</span>
          <span style="font-weight:600; color:#0f172a; font-variant-numeric:tabular-nums;">${
            invoice.shipping === 0
              ? escapeHtml(language === 'bn' ? 'ফ্রি' : 'Free')
              : escapeHtml(formatCurrency(invoice.shipping, language))
          }</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:7px; color:#475569;">
          <span>${escapeHtml(
            language === 'bn'
              ? `ছাড়${invoice.couponCode ? ` (${invoice.couponCode})` : ''}`
              : `Discount${invoice.couponCode ? ` (${invoice.couponCode})` : ''}`
          )}</span>
          <span style="font-weight:600; color:#047857; font-variant-numeric:tabular-nums;">-${escapeHtml(formatCurrency(invoice.discount, language))}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:10px; color:#475569;">
          <span>${escapeHtml(language === 'bn' ? 'ভ্যাট ও প্রসেসিং কর (৫%)' : 'Tax / VAT (5%)')}</span>
          <span style="font-weight:600; color:#0f172a; font-variant-numeric:tabular-nums;">${escapeHtml(formatCurrency(invoice.tax, language))}</span>
        </div>
        <div style="border-top:2px solid #047857; padding-top:9px; display:flex; justify-content:space-between; align-items:center; font-size:13.5px; font-weight:800; color:#064e3b;">
          <span>${escapeHtml(language === 'bn' ? 'সর্বমোট মূল্য' : 'Grand Total')}</span>
          <span style="font-variant-numeric:tabular-nums;">${escapeHtml(formatCurrency(invoice.grandTotal, language))}</span>
        </div>
      </div>
    </div>
  `;
}

function buildFooterHtml(language: Language, pageIndex: number, totalPages: number): string {
  const origin = getWebsiteOrigin();
  return `
    <div style="margin-top:24px; padding-top:14px; border-top:1px solid #cbd5e1; display:flex; justify-content:space-between; align-items:flex-end; font-size:10px; color:#64748b;">
      <div>
        <div style="font-weight:700; color:#065f46; font-size:11px; margin-bottom:3px;">
          ${escapeHtml(
            language === 'bn'
              ? 'অ্যাগ্রিহাবের মাধ্যমে সরাসরি কৃষকদের কাছ থেকে সংগ্রহ করার জন্য ধন্যবাদ!'
              : 'Thank you for sourcing directly from verified farmers with AgriHub!'
          )}
        </div>
        <div>
          ${escapeHtml(
            language === 'bn'
              ? 'অ্যাগ্রিহাব কর্তৃক প্রস্তুতকৃত · সহায়তা: support@agrihub.bd · হটলাইন: +৮৮০ ৯৬১২-০০০৮০০'
              : 'Generated by AgriHub · Support: support@agrihub.bd · Hotline: +880 9612-000800'
          )}
        </div>
      </div>
      <div style="text-align:right;">
        <div>${escapeHtml(origin)}</div>
        <div style="margin-top:2px; font-weight:600;">
          ${escapeHtml(
            language === 'bn'
              ? `পৃষ্ঠা ${formatNumber(pageIndex + 1, 'bn')} / ${formatNumber(totalPages, 'bn')}`
              : `Page ${pageIndex + 1} of ${totalPages}`
          )}
        </div>
      </div>
    </div>
  `;
}

async function renderHtmlPagesToPdf(pages: HTMLDivElement[], filename: string): Promise<void> {
  if (typeof document === 'undefined') return;

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.zIndex = '-1';
  host.style.pointerEvents = 'none';
  document.body.appendChild(host);

  try {
    const [{ jsPDF }, { toPng }] = await Promise.all([
      import('jspdf'),
      import('html-to-image')
    ]);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    for (let i = 0; i < pages.length; i++) {
      const pageEl = pages[i];
      host.appendChild(pageEl);
      const dataUrl = await toPng(pageEl, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true
      });
      if (i > 0) {
        pdf.addPage();
      }
      pdf.addImage(dataUrl, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      host.removeChild(pageEl);
    }

    pdf.save(filename);
  } finally {
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  }
}

async function exportInvoiceDocument(
  invoice: InvoiceData,
  language: Language,
  mode: 'invoice' | 'summary'
): Promise<void> {
  const logoDataUrl = await getLogoDataUrl();
  const fontFamily =
    language === 'bn'
      ? "'Hind Siliguri', 'Noto Sans Bengali', 'Montserrat', sans-serif"
      : "'Montserrat', 'Hind Siliguri', sans-serif";

  const docTitle =
    mode === 'invoice'
      ? language === 'bn'
        ? 'ট্রেড ইনভয়েস'
        : 'TAX & TRADE INVOICE'
      : language === 'bn'
      ? 'অর্ডার সারাংশ'
      : 'ORDER SUMMARY';

  const subtitle =
    mode === 'invoice'
      ? language === 'bn'
        ? 'অফিশিয়াল ডিজিটাল রসিদ'
        : 'Official Digital Trade Receipt'
      : language === 'bn'
      ? 'সরবরাহ ও ক্রয় বিবরণী'
      : 'Procurement & Logistics Summary';

  const FIRST_PAGE_ROWS = 9;
  const NEXT_PAGE_ROWS = 14;
  const chunks: InvoiceData['items'][] = [];

  if (invoice.items.length <= FIRST_PAGE_ROWS) {
    chunks.push(invoice.items);
  } else {
    chunks.push(invoice.items.slice(0, FIRST_PAGE_ROWS));
    let offset = FIRST_PAGE_ROWS;
    while (offset < invoice.items.length) {
      chunks.push(invoice.items.slice(offset, offset + NEXT_PAGE_ROWS));
      offset += NEXT_PAGE_ROWS;
    }
  }

  const totalPages = chunks.length;
  const pages: HTMLDivElement[] = [];
  let runningIdx = 0;

  chunks.forEach((chunk, pageIndex) => {
    const pageEl = createPageContainer(fontFamily);
    const isLast = pageIndex === totalPages - 1;
    const headerHtml = buildHeaderHtml(
      docTitle,
      subtitle,
      logoDataUrl,
      invoice,
      language,
      pageIndex > 0,
      pageIndex,
      totalPages
    );
    const tableHtml = buildItemsTableHtml(chunk, language, runningIdx);
    const summaryHtml = isLast ? buildSummaryBoxHtml(invoice, language) : '';
    const footerHtml = buildFooterHtml(language, pageIndex, totalPages);

    pageEl.innerHTML = `
      <div>
        ${headerHtml}
        ${tableHtml}
        ${summaryHtml}
      </div>
      ${footerHtml}
    `;
    pages.push(pageEl);
    runningIdx += chunk.length;
  });

  const safeNum = (mode === 'invoice' ? invoice.invoiceNumber : invoice.orderNumber).replace(
    /[^a-zA-Z0-9_-]/g,
    '-'
  );
  const filename =
    mode === 'invoice'
      ? `AgriHub-Invoice-${safeNum}.pdf`
      : `AgriHub-Order-Summary-${safeNum}.pdf`;

  await renderHtmlPagesToPdf(pages, filename);
}

export async function downloadInvoicePdf(invoice: InvoiceData, language: Language): Promise<void> {
  await exportInvoiceDocument(invoice, language, 'invoice');
}

export async function downloadOrderSummaryPdf(invoice: InvoiceData, language: Language): Promise<void> {
  await exportInvoiceDocument(invoice, language, 'summary');
}

export async function downloadAdminOrdersReportPdf(
  orders: OrderItem[],
  language: Language
): Promise<void> {
  const logoDataUrl = await getLogoDataUrl();
  const fontFamily =
    language === 'bn'
      ? "'Hind Siliguri', 'Noto Sans Bengali', 'Montserrat', sans-serif"
      : "'Montserrat', 'Hind Siliguri', sans-serif";

  const ROWS_PER_PAGE = 14;
  const pagesData: OrderItem[][] = [];
  for (let i = 0; i < Math.max(1, orders.length); i += ROWS_PER_PAGE) {
    pagesData.push(orders.slice(i, i + ROWS_PER_PAGE));
  }

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const totalPages = pagesData.length;
  const origin = getWebsiteOrigin();

  const pages = pagesData.map((slice, pageIndex) => {
    const pageEl = createPageContainer(fontFamily);
    const isLast = pageIndex === totalPages - 1;
    const rowsHtml =
      slice.length === 0
        ? `<tr><td colspan="6" style="padding:20px; text-align:center; font-size:12px; color:#64748b;">${escapeHtml(
            language === 'bn' ? 'কোনো অর্ডার পাওয়া যায়নি।' : 'No orders recorded.'
          )}</td></tr>`
        : slice
            .map((o, idx) => {
              const bg = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
              return `
                <tr style="background:${bg}; border-bottom:1px solid #e2e8f0;">
                  <td style="padding:9px 10px; font-size:10.5px; font-family:monospace; font-weight:700; color:#047857;">${escapeHtml(o.orderNumber)}</td>
                  <td style="padding:9px 10px; font-size:10.5px; color:#0f172a;">${escapeHtml(o.buyerName)}</td>
                  <td style="padding:9px 10px; font-size:10.5px; color:#334155;">${escapeHtml(o.productTitle)}</td>
                  <td style="padding:9px 10px; font-size:10.5px; text-align:right;">${escapeHtml(formatNumber(o.quantity, language))} ${escapeHtml(o.unitType)}</td>
                  <td style="padding:9px 10px; font-size:10.5px; text-align:center;">${escapeHtml(formatPaymentStatusLabel(o.paymentStatus, language))}</td>
                  <td style="padding:9px 10px; font-size:10.5px; font-weight:700; text-align:right;">${escapeHtml(formatCurrency(o.totalAmount, language))}</td>
                </tr>
              `;
            })
            .join('');

    pageEl.innerHTML = `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:16px; border-bottom:2px solid #047857;">
          <div style="display:flex; align-items:center; gap:12px;">
            ${logoDataUrl ? `<img src="${logoDataUrl}" alt="AgriHub" style="height:34px; width:auto;" />` : ''}
            <div>
              <div style="font-size:14px; font-weight:800; color:#064e3b;">
                ${escapeHtml(language === 'bn' ? 'অ্যাগ্রিহাব বাণিজ্যিক অর্ডার প্রতিবেদন' : 'AgriHub Trade Orders Report')}
              </div>
              <div style="font-size:10.5px; color:#475569;">
                ${escapeHtml(language === 'bn' ? 'বাংলাদেশের কৃষি বাণিজ্য নেটওয়ার্ক' : 'Bangladesh Agricultural Trade Network')}
              </div>
            </div>
          </div>
          <div style="text-align:right; font-size:10.5px; color:#475569;">
            <div>${escapeHtml(new Date().toISOString().slice(0, 10))}</div>
            <div>${escapeHtml(
              language === 'bn'
                ? `মোট অর্ডার: ${formatNumber(orders.length, 'bn')}`
                : `Total Orders: ${orders.length}`
            )}</div>
          </div>
        </div>

        <table style="width:100%; border-collapse:collapse; margin-top:16px; border:1px solid #cbd5e1;">
          <thead>
            <tr style="background:#065f46; color:#ffffff;">
              <th style="padding:9px 10px; font-size:10px; text-align:left;">${escapeHtml(language === 'bn' ? 'অর্ডার নং' : 'Order No.')}</th>
              <th style="padding:9px 10px; font-size:10px; text-align:left;">${escapeHtml(language === 'bn' ? 'ক্রেতা' : 'Buyer')}</th>
              <th style="padding:9px 10px; font-size:10px; text-align:left;">${escapeHtml(language === 'bn' ? 'পণ্য' : 'Produce')}</th>
              <th style="padding:9px 10px; font-size:10px; text-align:right;">${escapeHtml(language === 'bn' ? 'পরিমাণ' : 'Qty')}</th>
              <th style="padding:9px 10px; font-size:10px; text-align:center;">${escapeHtml(language === 'bn' ? 'পেমেন্ট' : 'Payment')}</th>
              <th style="padding:9px 10px; font-size:10px; text-align:right;">${escapeHtml(language === 'bn' ? 'মোট মূল্য' : 'Total')}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        ${
          isLast
            ? `<div style="margin-top:18px; display:flex; justify-content:flex-end;">
                 <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px 16px; min-width:250px; display:flex; justify-content:space-between; font-size:13px; font-weight:800; color:#064e3b;">
                   <span>${escapeHtml(language === 'bn' ? 'সর্বমোট অর্ডার মূল্য:' : 'Total Orders Value:')}</span>
                   <span>${escapeHtml(formatCurrency(totalRevenue, language))}</span>
                 </div>
               </div>`
            : ''
        }
      </div>
      <div style="padding-top:12px; border-top:1px solid #cbd5e1; display:flex; justify-content:space-between; font-size:10px; color:#64748b;">
        <span>${escapeHtml(language === 'bn' ? 'অ্যাগ্রিহাব কর্তৃক প্রস্তুতকৃত · support@agrihub.bd' : 'Generated by AgriHub · support@agrihub.bd')}</span>
        <span>${escapeHtml(origin)} · ${escapeHtml(
          language === 'bn'
            ? `পৃষ্ঠা ${formatNumber(pageIndex + 1, 'bn')} / ${formatNumber(totalPages, 'bn')}`
            : `Page ${pageIndex + 1} of ${totalPages}`
        )}</span>
      </div>
    `;
    return pageEl;
  });

  await renderHtmlPagesToPdf(pages, `AgriHub-Orders-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
