import type { Language } from '../context/LanguageContext';

const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBanglaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)] ?? d);
}

export function formatNumber(
  value: number,
  language: Language = 'en',
  options?: Intl.NumberFormatOptions
): string {
  const safe = Number.isFinite(value) ? value : 0;
  const locale = language === 'bn' ? 'en-IN' : 'en-US';
  const formatted = safe.toLocaleString(locale, options);
  return language === 'bn' ? toBanglaDigits(formatted) : formatted;
}

/**
 * Centralized Bangladeshi Taka (BDT / ৳) formatter.
 * English: BDT 1,250 | BDT 25,000 | BDT 150,000
 * Bangla: ৳ ১,২৫০ | ৳ ২৫,০০০ | ৳ ১,৫০,০০০
 */
export function formatCurrency(
  amount: number,
  language: Language = 'en',
  options?: { forceDecimals?: boolean }
): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const rounded = Math.round((safe + Number.EPSILON) * 100) / 100;
  const hasFraction = Math.abs(rounded % 1) > 0.001;
  const fractionDigits = options?.forceDecimals || hasFraction ? 2 : 0;
  const locale = language === 'bn' ? 'en-IN' : 'en-US';

  const formattedNumber = rounded.toLocaleString(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });

  if (language === 'bn') {
    return `৳ ${toBanglaDigits(formattedNumber)}`;
  }
  return `BDT ${formattedNumber}`;
}
