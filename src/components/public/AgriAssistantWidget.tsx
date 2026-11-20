import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageCircle,
  X,
  Send,
  Sprout,
  ShoppingBag,
  Truck,
  HelpCircle,
  Search,
  RefreshCw,
  AlertTriangle,
  Globe,
  ArrowRight
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { resolveChatApiUrl } from '../../api';
import { INITIAL_PRODUCTS, INITIAL_WAREHOUSES } from '../../mockData';
import { formatCurrency } from '../../utils/formatters';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  matchedProducts?: { id: number; title: string; unitPrice: number; unitType: string; category: string }[];
  error?: boolean;
}

export default function AgriAssistantWidget() {
  const { language, toggleLanguage, tr } = useLanguage();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  const catalogSummary = useMemo(() => {
    const topItems = INITIAL_PRODUCTS.slice(0, 20)
      .map(
        (p) =>
          `${p.title} (${p.category}) — ${formatCurrency(p.unitPrice, language)}/${p.unitType}, ${p.quantityAvailable} ${p.unitType} available, ${p.storageTempCelsius}°C, ${p.isOrganic ? 'Organic' : 'Standard'}`
      )
      .join('\n');
    const hubs = INITIAL_WAREHOUSES.map((w) => `${w.name} (${w.region}, ${w.tempRangeCelsius})`).join('; ');
    return `Sample Products:\n${topItems}\n\nRegional Cold-Chain Hubs: ${hubs}`;
  }, [language]);

  const findMatchingProducts = (query: string) => {
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3);
    if (tokens.length === 0) return [];
    const matches = INITIAL_PRODUCTS.filter((p) => {
      const hay = `${p.title} ${p.category} ${p.farmLocation}`.toLowerCase();
      return tokens.some((t) => hay.includes(t));
    });
    return matches.slice(0, 3).map((p) => ({
      id: p.id,
      title: p.title,
      unitPrice: p.unitPrice,
      unitType: p.unitType,
      category: p.category
    }));
  };

  const quickPrompts = [
    {
      icon: Search,
      label: tr('Find produce', 'পণ্য খুঁজুন'),
      prompt: tr(
        'What fresh mangoes, aromatic rice, and mustard oil lots are currently available?',
        'বর্তমানে কোন কোন আম, সুগন্ধি চাল ও সরিষার তেলের লট পাওয়া যাচ্ছে?'
      )
    },
    {
      icon: Sprout,
      label: tr('Farmer guide', 'কৃষক সহায়তা'),
      prompt: tr(
        'How can a verified farmer register and list harvest batches on AgriHub?',
        'একজন কৃষক কীভাবে অ্যাগ্রিহাবে নিবন্ধন করে ফসল বিক্রি করতে পারেন?'
      )
    },
    {
      icon: ShoppingBag,
      label: tr('Buyer guide', 'ক্রেতা সহায়তা'),
      prompt: tr(
        'How do wholesale buyers order produce and track delivery?',
        'ক্রেতারা কীভাবে পাইকারি অর্ডার করবেন ও ডেলিভারি ট্র্যাক করবেন?'
      )
    },
    {
      icon: Truck,
      label: tr('Cold-chain', 'কোল্ড-চেইন'),
      prompt: tr(
        'How does AgriHub maintain cold storage temperatures from farm to buyer?',
        'খামার থেকে ক্রেতা পর্যন্ত হিমাগার ও পরিবহনে তাপমাত্রা কীভাবে নিয়ন্ত্রিত হয়?'
      )
    }
  ];

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    if (!textOverride) {
      setInput('');
    }
    setLastFailedPrompt(null);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setLoading(true);

    const matchedProducts = findMatchingProducts(text);

    try {
      const response = await fetch(resolveChatApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          language,
          catalogSummary,
          history: messages
            .filter((m) => !m.error)
            .slice(-8)
            .map((m) => ({ role: m.role, text: m.text }))
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success || !payload?.reply) {
        throw new Error(
          payload?.message ||
            tr(
              'Unable to get an assistant response right now.',
              'এই মুহূর্তে সহায়কের উত্তর পাওয়া যাচ্ছে না।'
            )
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          text: payload.reply,
          matchedProducts: matchedProducts.length > 0 ? matchedProducts : undefined
        }
      ]);
    } catch (err: any) {
      setLastFailedPrompt(text);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text:
            err?.message ||
            tr(
              'Assistant could not connect. Please try again.',
              'সহায়কের সাথে সংযোগ স্থাপন করা যায়নি। আবার চেষ্টা করুন।'
            ),
          matchedProducts: matchedProducts.length > 0 ? matchedProducts : undefined,
          error: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={tr('AgriHub Agricultural Assistant', 'অ্যাগ্রিহাব কৃষি সহায়ক')}
          className="mb-2.5 w-[calc(100vw-2rem)] sm:w-80 max-h-[410px] bg-white rounded-2xl shadow-2xl border border-[var(--border-subtle)] flex flex-col overflow-hidden"
        >
          {/* Compact Header */}
          <div className="bg-[#047857] text-white px-3.5 py-2.5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                <Sprout className="w-3.5 h-3.5 text-[#d1fae5]" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold truncate">
                  {tr('AgriHub Assistant', 'কৃষি সহায়ক')}
                </div>
                <div className="text-[10px] text-[#d1fae5] truncate">
                  {tr('Quick produce & trade help', 'পণ্য ও বাণিজ্য সহায়তা')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={toggleLanguage}
                className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[10px] font-bold flex items-center gap-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                title={tr('Switch to বাংলা', 'Switch to English')}
              >
                <Globe className="w-3 h-3" strokeWidth={1.75} />
                <span>{language === 'en' ? 'বাংলা' : 'EN'}</span>
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={tr('Close assistant', 'সহায়ক বন্ধ করুন')}
                className="p-1 rounded-lg hover:bg-white/20 text-[#d1fae5] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-[#f7faf8] min-h-[160px] max-h-[240px]"
          >
            {messages.length === 0 ? (
              <div className="space-y-2.5">
                <div className="bg-white border border-[var(--border-subtle)] rounded-xl p-3 text-[11px] text-slate-600 leading-relaxed">
                  <div className="font-bold text-[#047857] mb-0.5">
                    {tr('Welcome to AgriHub Assistant', 'অ্যাগ্রিহাব কৃষি সহায়কে স্বাগতম')}
                  </div>
                  <p>
                    {tr(
                      'Ask about available crops, farmers, wholesale ordering, or delivery.',
                      'তাজা পণ্য, কৃষক, পাইকারি অর্ডার বা ডেলিভারি সম্পর্কে প্রশ্ন করুন।'
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {quickPrompts.map((q, idx) => {
                    const Icon = q.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => sendMessage(q.prompt)}
                        className="text-left p-2 rounded-xl bg-white hover:bg-[#d1fae5]/45 border border-[var(--border-subtle)] hover:border-[#10b981] text-[11px] font-semibold text-slate-700 hover:text-[#047857] transition flex items-center gap-1.5"
                      >
                        <Icon className="w-3.5 h-3.5 text-[#047857] shrink-0" strokeWidth={1.75} />
                        <span className="truncate">{q.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-xl px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-[#047857] text-white font-medium rounded-br-xs'
                        : msg.error
                        ? 'bg-amber-50 border border-amber-200 text-amber-950 rounded-bl-xs'
                        : 'bg-white border border-[var(--border-subtle)] text-slate-800 rounded-bl-xs'
                    }`}
                  >
                    {msg.error && (
                      <div className="flex items-center gap-1 font-bold text-amber-800 mb-0.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                        <span>{tr('Notice', 'বার্তা')}</span>
                      </div>
                    )}
                    {msg.text}
                  </div>

                  {msg.matchedProducts && msg.matchedProducts.length > 0 && (
                    <div className="mt-1.5 w-full max-w-[88%] space-y-1">
                      {msg.matchedProducts.map((p) => (
                        <Link
                          key={p.id}
                          to={`/marketplace?search=${encodeURIComponent(p.title.split(' ')[0])}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-[var(--border-subtle)] hover:border-[#10b981] text-[11px] transition"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{p.title}</div>
                            <div className="text-slate-500">
                              {formatCurrency(p.unitPrice, language)}/{p.unitType}
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-[#047857] shrink-0" strokeWidth={1.75} />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}

            {loading && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-white border border-[var(--border-subtle)] rounded-xl px-2.5 py-1.5 w-fit">
                <RefreshCw className="w-3.5 h-3.5 text-[#047857] animate-spin" strokeWidth={1.75} />
                <span>{tr('Thinking...', 'উত্তর তৈরি হচ্ছে...')}</span>
              </div>
            )}

            {lastFailedPrompt && !loading && (
              <button
                type="button"
                onClick={() => sendMessage(lastFailedPrompt)}
                className="text-[11px] font-bold text-[#047857] hover:underline inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" strokeWidth={1.75} />
                <span>{tr('Retry', 'আবার চেষ্টা করুন')}</span>
              </button>
            )}
          </div>

          {/* Compact Footer Quick Links & Input */}
          <div className="border-t border-[var(--border-subtle)] bg-white p-2.5 space-y-2 shrink-0">
            <div className="flex items-center justify-between text-[11px] text-slate-600 px-0.5">
              <Link
                to="/marketplace"
                onClick={() => setOpen(false)}
                className="hover:text-[#047857] font-semibold inline-flex items-center gap-1 transition"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-[#047857]" strokeWidth={1.75} />
                <span>{tr('Marketplace', 'মার্কেটপ্লেস')}</span>
              </Link>
              <Link
                to="/contact"
                onClick={() => setOpen(false)}
                className="hover:text-[#047857] font-semibold inline-flex items-center gap-1 transition"
              >
                <HelpCircle className="w-3.5 h-3.5 text-[#047857]" strokeWidth={1.75} />
                <span>{tr('Trade Support', 'বাণিজ্য সহায়তা')}</span>
              </Link>
            </div>

            <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={tr('Ask about crops or orders...', 'পণ্য বা অর্ডার সম্পর্কে লিখুন...')}
                className="agri-input flex-1 py-2"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label={tr('Send message', 'বার্তা পাঠান')}
                className="agri-btn agri-btn-primary h-8 w-8 p-0 shrink-0 rounded-lg"
              >
                <Send className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Compact Circular Floating Toggle Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={tr('Open AgriHub Assistant', 'অ্যাগ্রিহাব কৃষি সহায়ক খুলুন')}
        title={tr('AgriHub Assistant', 'কৃষি সহায়ক')}
        className="ml-auto w-11 h-11 rounded-full bg-[#047857] hover:bg-[#065f46] text-white shadow-lg border border-[#10b981]/40 flex items-center justify-center transition-transform duration-200 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981] focus-visible:ring-offset-2"
      >
        {open ? (
          <X className="w-5 h-5" strokeWidth={1.75} />
        ) : (
          <MessageCircle className="w-5 h-5" strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}
