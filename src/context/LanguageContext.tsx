import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

export type Language = 'en' | 'bn';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  tr: (en: string, bn: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'agrihub_lang';

const CATEGORY_BN_MAP: Record<string, string> = {
  'fruits & berries': 'তাজা ফলমূল',
  'grains & cereals': 'চাল ও খাদ্যশস্য',
  'dairy & cold chain': 'দুগ্ধ ও হিমায়িত পণ্য',
  'oils & seeds': 'ভোজ্য তেল ও বীজ',
  'vegetables': 'তাজা শাকসবজি',
};

const CATEGORY_DESC_BN_MAP: Record<string, string> = {
  'fruits & berries': 'বাগানের বাছাইকৃত আম, মৌসুমি ফল এবং যত্নে সংরক্ষিত তাজা ফলমূল।',
  'grains & cereals': 'মানসম্মত গুদামে সংরক্ষিত সুগন্ধি চাল, গম, ভুট্টা ও বিভিন্ন খাদ্যশস্য।',
  'dairy & cold chain': 'খামার থেকে সরাসরি সংগৃহীত খাঁটি দুধ, মাখন ও তাপমাত্রা-নিয়ন্ত্রিত দুগ্ধপণ্য।',
  'oils & seeds': 'খাঁটি সরিষা বীজ, সূর্যমুখী ও স্বাস্থ্যসম্মত ভোজ্য তেল।',
  'vegetables': 'মাঠ পর্যায়ের কৃষকদের কাছ থেকে সংগৃহীত টাটকা ও বিষমুক্ত মৌসুমি সবজি।',
};

export function translateCategoryName(name: string, language: Language): string {
  if (language === 'en') return name;
  return CATEGORY_BN_MAP[name.trim().toLowerCase()] || name;
}

export function translateCategoryDescription(name: string, description: string, language: Language): string {
  if (language === 'en') return description;
  return CATEGORY_DESC_BN_MAP[name.trim().toLowerCase()] || description;
}

export function translateRole(role: string, language: Language): string {
  if (language === 'en') return role;
  const r = role.trim().toLowerCase();
  if (r === 'admin') return 'অ্যাডমিন';
  if (r === 'farmer') return 'কৃষক';
  if (r === 'supplier') return 'পরিবহন ও সরবরাহ';
  if (r === 'buyer') return 'ক্রেতা';
  return role;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'bn' ? 'bn' : 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Ignore storage write failure
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language === 'bn' ? 'bn' : 'en';
    }
  }, [language]);

  const setLanguage = useCallback((lang: Language) => setLanguageState(lang), []);
  const toggleLanguage = useCallback(
    () => setLanguageState((prev) => (prev === 'en' ? 'bn' : 'en')),
    []
  );
  const tr = useCallback((en: string, bn: string) => (language === 'bn' ? bn : en), [language]);

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage, tr }),
    [language, setLanguage, toggleLanguage, tr]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
