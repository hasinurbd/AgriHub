import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  Check,
  Copy,
  Download,
  FileText,
  Lock,
  LogIn,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Unlock,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DocsProvider, useDocs } from '../../context/DocsContext';
import { useLiveDocsMetrics } from '../../hooks/useLiveDocsMetrics';
import { exportDocsToMarkdown, exportDocsToPdf } from '../../lib/docsStore';
import { formatCurrency } from '../../utils/formatters';
import type { DocSectionGroup, DocSectionItem } from '../../types/docs';
import DocsMarkdownRenderer from '../../components/docs/DocsMarkdownRenderer';
import DocsDiagrams from '../../components/docs/DocsDiagrams';
import TeamShowcaseGrid from '../../components/docs/TeamShowcaseGrid';

const DocsAdminWorkspace = lazy(() => import('../../components/docs/DocsAdminWorkspace'));

type GroupFilter = 'all' | DocSectionGroup | 'live';

function LiveTelemetryStrip({
  metrics,
  onRefresh,
  loading
}: {
  metrics: ReturnType<typeof useLiveDocsMetrics>['metrics'];
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <section
      aria-label="Live System Telemetry"
      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
          <Activity className="w-4 h-4 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
          <span>Live Application Telemetry (Auto-Synced from Store &amp; Offline DB)</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-muted)] tabular-nums">
          <span>
            {metrics.backendReachable ? 'Backend Online' : 'Offline-First Active'} ·{' '}
            {metrics.pendingSyncCount} queued
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="text-[#047857] dark:text-[#34d399] font-semibold inline-flex items-center gap-1 hover:underline"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 tabular-nums">
        <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]">
          <div className="text-[11px] text-[var(--text-muted)] font-medium">Active Harvest Lots</div>
          <div className="text-lg font-extrabold text-[var(--text-primary)] mt-1">
            {metrics.activeProductsCount}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            {metrics.totalStockUnits.toLocaleString()} units stocked
          </div>
        </div>

        <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]">
          <div className="text-[11px] text-[var(--text-muted)] font-medium">Catalog Value</div>
          <div className="text-lg font-extrabold text-[var(--text-primary)] mt-1">
            {formatCurrency(metrics.totalInventoryValueBdt)}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            {metrics.categoriesCount} produce categories
          </div>
        </div>

        <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]">
          <div className="text-[11px] text-[var(--text-muted)] font-medium">Network Members</div>
          <div className="text-lg font-extrabold text-[var(--text-primary)] mt-1">
            {metrics.usersCount}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            {metrics.verifiedFarmersCount} verified farmers
          </div>
        </div>

        <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]">
          <div className="text-[11px] text-[var(--text-muted)] font-medium">Trade Orders</div>
          <div className="text-lg font-extrabold text-[var(--text-primary)] mt-1">
            {metrics.ordersCount}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            GMV {formatCurrency(metrics.totalGmvBdt)}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]">
          <div className="text-[11px] text-[var(--text-muted)] font-medium">Cold-Chain Trips</div>
          <div className="text-lg font-extrabold text-[var(--text-primary)] mt-1">
            {metrics.activeShipmentsCount} / {metrics.shipmentsCount}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            {metrics.warehousesCount} regional depots
          </div>
        </div>

        <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]">
          <div className="text-[11px] text-[var(--text-muted)] font-medium">Sync Engine</div>
          <div className="text-lg font-extrabold text-[#047857] dark:text-[#34d399] mt-1 uppercase">
            {metrics.syncStatusLabel}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            IndexedDB Dexie v2
          </div>
        </div>
      </div>
    </section>
  );
}

function LiveFeatureMatrixTable({
  metrics
}: {
  metrics: ReturnType<typeof useLiveDocsMetrics>['metrics'];
}) {
  const rows = [
    {
      capability: 'Batch-Tracked Wholesale Marketplace',
      module: 'src/pages/public/MarketplacePage.tsx',
      state: 'Live',
      detail: `${metrics.activeProductsCount} active lots · ${metrics.categoriesCount} categories`
    },
    {
      capability: 'Offline-First Admin Panel (Dexie IndexedDB + Sync)',
      module: 'src/lib/offlineDb.ts · src/lib/syncService.ts',
      state: 'Live',
      detail: `${metrics.pendingSyncCount} pending queue items · status: ${metrics.syncStatusLabel}`
    },
    {
      capability: 'Cold-Chain Fleet & Warehouse Tracking',
      module: 'Logistics & Warehouses Console',
      state: 'Live',
      detail: `${metrics.shipmentsCount} shipments · ${metrics.warehousesCount} hubs monitored`
    },
    {
      capability: 'BDT Escrow Invoicing & PDF Export',
      module: 'src/utils/pdfExport.ts · jsPDF',
      state: 'Live',
      detail: `${metrics.ordersCount} recorded orders (${formatCurrency(metrics.totalGmvBdt)})`
    },
    {
      capability: 'Bilingual EN / বাংলা Gemini Assistant',
      module: 'api/chat.ts · AgriAssistantWidget.tsx',
      state: 'Live',
      detail: 'Live inventory grounded via /api/chat proxy'
    },
    {
      capability: 'Scheduled /docs Showcase & Admin CMS',
      module: '/docs · DocsContext · DocsAdminWorkspace',
      state: 'Live',
      detail: 'June 10–14 window + instant override + MD/PDF export'
    },
    {
      capability: 'IoT LoRaWAN Reefers Telemetry Webhook',
      module: 'Upcoming Q3 Connector',
      state: 'Upcoming',
      detail: 'Direct MQTT/HTTP ingest for automatic 5-min sensor streams'
    },
    {
      capability: 'Cooperative Micro-Credit Scoring Engine',
      module: 'Planned Q4 Analytics',
      state: 'Planned',
      detail: 'Harvest fulfillment reliability score for seasonal working capital'
    }
  ];

  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]">
            <th className="py-2.5 px-3.5 font-semibold text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
              Capability
            </th>
            <th className="py-2.5 px-3.5 font-semibold text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
              Module / Layer
            </th>
            <th className="py-2.5 px-3.5 font-semibold text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
              Status
            </th>
            <th className="py-2.5 px-3.5 font-semibold text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
              Live Verification
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)] tabular-nums">
          {rows.map((r) => (
            <tr key={r.capability} className="hover:bg-[var(--bg-surface-muted)]/60">
              <td className="py-2.5 px-3.5 font-semibold text-[var(--text-primary)]">
                {r.capability}
              </td>
              <td className="py-2.5 px-3.5 font-mono text-[11px] text-[var(--text-muted)]">
                {r.module}
              </td>
              <td className="py-2.5 px-3.5 font-mono font-bold">
                <span
                  className={
                    r.state === 'Live'
                      ? 'text-[#047857] dark:text-[#34d399]'
                      : r.state === 'Upcoming'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-[var(--text-muted)]'
                  }
                >
                  {r.state}
                </span>
              </td>
              <td className="py-2.5 px-3.5 text-[var(--text-secondary)]">{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocsPageContent() {
  const { isAdmin, currentUser } = useAuth();
  const {
    docsState,
    loading: docsLoading,
    accessEvaluation,
    updateAccessConfig,
    resetToDefaultJuneWindow
  } = useDocs();
  const { metrics, loading: metricsLoading, refreshMetrics } = useLiveDocsMetrics();

  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [activeSectionSlug, setActiveSectionSlug] = useState<string>('');
  const [studioOpen, setStudioOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);

  const visibleSections = useMemo(() => {
    const base = [...docsState.sections]
      .filter((s) => (isAdmin ? true : s.visible))
      .sort((a, b) => a.order - b.order);

    return base.filter((sec) => {
      if (groupFilter !== 'all' && groupFilter !== 'live' && sec.group !== groupFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        sec.title.toLowerCase().includes(q) ||
        sec.subtitle.toLowerCase().includes(q) ||
        sec.summary.toLowerCase().includes(q) ||
        sec.contentMarkdown.toLowerCase().includes(q) ||
        sec.highlights.some((h) => h.toLowerCase().includes(q)) ||
        sec.code.toLowerCase().includes(q)
      );
    });
  }, [docsState.sections, groupFilter, isAdmin, searchQuery]);

  // Track active TOC section on scroll
  useEffect(() => {
    if (visibleSections.length === 0) return;
    if (!activeSectionSlug) {
      setActiveSectionSlug(visibleSections[0].slug);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSectionSlug(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0.01 }
    );

    visibleSections.forEach((sec) => {
      const el = document.getElementById(sec.slug);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [visibleSections, activeSectionSlug]);

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback ignored inside restricted clipboard contexts
    }
  };

  const handleExportMarkdown = () => {
    const md = exportDocsToMarkdown(docsState, metrics);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AgriHub-Docs-${docsState.currentVersion}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await exportDocsToPdf(docsState, metrics);
    } finally {
      setExportingPdf(false);
    }
  };

  const jumpToSection = (slug: string) => {
    setActiveSectionSlug(slug);
    const el = document.getElementById(slug);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (docsLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-3 flex items-center gap-2.5 text-xs font-semibold text-[var(--text-secondary)]">
          <RefreshCw className="w-4 h-4 text-[#047857] animate-spin" />
          <span>Loading Documentation &amp; Pitch Deck...</span>
        </div>
      </div>
    );
  }

  // ==================== 403 / ACCESS GATE ====================
  if (!accessEvaluation.allowed && !isAdmin) {
    return (
      <div className="min-h-[76vh] flex items-center justify-center px-4 py-14">
        <div className="max-w-lg w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-10 space-y-6">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
              <ShieldAlert className="w-4 h-4" />
              <span>HTTP 403 · ADMIN ONLY</span>
            </div>
            <Lock className="w-4 h-4 text-[var(--text-muted)]" />
          </div>

          <div className="space-y-2.5">
            <h1 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
              {docsState.access.restrictedTitle}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {docsState.access.restrictedMessage}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link to="/" className="agri-btn agri-btn-primary">
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Home</span>
            </Link>

            <Link
              to="/admin/login?redirect=/docs"
              className="agri-btn agri-btn-secondary"
            >
              <LogIn className="w-4 h-4" />
              <span>Admin Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-16">
      {/* ================= ADMIN CONTROL STRIP ================= */}
      {isAdmin && (
        <div className="border-b border-[var(--border-subtle)] bg-[#f0f6f2] dark:bg-[#0e1b14]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {accessEvaluation.allowed ? (
                <Unlock className="w-4 h-4 text-[#047857] dark:text-[#34d399]" />
              ) : (
                <Lock className="w-4 h-4 text-amber-600" />
              )}
              <span className="font-bold text-[var(--text-primary)]">
                {accessEvaluation.allowed
                  ? 'Public Access: ACTIVE'
                  : 'Admin Preview Mode (Public Visitors See 403 Gate)'}
              </span>
              <span className="text-[var(--text-muted)] font-mono tabular-nums hidden sm:inline">
                · {accessEvaluation.windowSummary}
              </span>
              {currentUser && (
                <span className="text-[var(--text-muted)] hidden md:inline">
                  · Signed in as {currentUser.full_name}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!accessEvaluation.allowed ? (
                <button
                  type="button"
                  onClick={() =>
                    updateAccessConfig(
                      { visibilityEnabled: true, accessMode: 'manual_on' },
                      'Instant override ON from /docs bar'
                    )
                  }
                  className="agri-btn agri-btn-primary agri-btn-sm"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Publish Now (Override ON)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    updateAccessConfig(
                      { visibilityEnabled: false, accessMode: 'manual_off' },
                      'Locked /docs from /docs bar'
                    )
                  }
                  className="agri-btn agri-btn-secondary agri-btn-sm"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Lock Public Access (403)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => resetToDefaultJuneWindow()}
                className="agri-btn agri-btn-secondary agri-btn-sm"
                title="Restore June 10 (00:00) → June 14 (23:59) schedule"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                <span>June 10–14 Schedule</span>
              </button>

              <button
                type="button"
                onClick={() => setStudioOpen(!studioOpen)}
                className={`agri-btn agri-btn-sm ${
                  studioOpen ? 'agri-btn-primary' : 'agri-btn-secondary'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{studioOpen ? 'Hide Docs Studio' : 'Open Docs Studio'}</span>
              </button>

              <Link to="/admin/docs" className="agri-btn agri-btn-secondary agri-btn-sm">
                <Settings className="w-3.5 h-3.5" />
                <span>Admin Console</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ================= INLINE ADMIN DOCS STUDIO ================= */}
      {isAdmin && studioOpen && (
        <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Suspense
              fallback={
                <div className="p-4 text-xs text-[var(--text-secondary)]">
                  Loading Docs Studio...
                </div>
              }
            >
              <DocsAdminWorkspace
                embeddedOnDocsPage
                onCloseDrawer={() => setStudioOpen(false)}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* ================= EDITORIAL HEADER & EXPORT BAR ================= */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="space-y-2.5 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#047857] dark:text-[#34d399] font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>AGRIHUB LIVE DOCUMENTATION &amp; YC PITCH DECK</span>
                <span className="text-[var(--text-muted)]">·</span>
                <span className="text-[var(--text-secondary)] tabular-nums">
                  {docsState.currentVersion}
                </span>
                <span className="text-[var(--text-muted)]">·</span>
                <span className="text-[var(--text-secondary)] tabular-nums">
                  Published {new Date(docsState.lastPublishedAt).toLocaleDateString()}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-[var(--text-primary)] tracking-tight leading-tight">
                Cold-Chain Agricultural Commerce &amp; Offline-First Trade Infrastructure
              </h1>

              <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                Combined investor pitch deck, full engineering whitepaper, editable system architecture diagrams, and real-time platform telemetry synced directly with AgriHub&apos;s IndexedDB &amp; API state.
              </p>
            </div>

            {/* Export & Share Actions */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="agri-btn agri-btn-secondary agri-btn-sm"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#047857]" />
                    <span>Link Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Share Link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleExportMarkdown}
                className="agri-btn agri-btn-secondary agri-btn-sm"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Markdown (.md)</span>
              </button>

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="agri-btn agri-btn-primary agri-btn-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exportingPdf ? 'Generating PDF...' : 'Export PDF'}</span>
              </button>
            </div>
          </div>

          {/* Live System Telemetry Strip */}
          <LiveTelemetryStrip
            metrics={metrics}
            loading={metricsLoading}
            onRefresh={refreshMetrics}
          />

          {/* Search & Group Filter Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search slides, APIs, security, team, or roadmap..."
                className="agri-input pl-9 pr-8"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear documentation search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['all', `All Sections (${docsState.sections.filter((s) => isAdmin || s.visible).length})`],
                  ['pitch', 'YC Pitch Deck (01–12)'],
                  ['technical', 'Technical Spec (B–I)'],
                  ['operations', 'Operations & Security (J–O)']
                ] as Array<[GroupFilter, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setGroupFilter(key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap shrink-0 ${
                    groupFilter === key
                      ? 'bg-[#047857] text-white'
                      : 'bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ================= MAIN TWO-COLUMN DOCUMENTATION BODY ================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sticky Table of Contents */}
        <aside className="hidden lg:block lg:col-span-3 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Contents Index ({visibleSections.length})
          </div>
          <nav aria-label="Documentation Sections" className="space-y-0.5">
            {visibleSections.map((sec) => {
              const isActive = activeSectionSlug === sec.slug;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => jumpToSection(sec.slug)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-baseline gap-2 transition ${
                    isActive
                      ? 'bg-[#d1fae5]/60 dark:bg-[#14251c] text-[#047857] dark:text-[#34d399] font-bold'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="font-mono text-[11px] tabular-nums shrink-0 opacity-80">
                    {sec.code}
                  </span>
                  <span className="truncate">{sec.title}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Documentation Content Stream */}
        <div className="lg:col-span-9 space-y-6">
          {visibleSections.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center space-y-2">
              <div className="text-sm font-bold text-[var(--text-primary)]">
                No matching documentation sections
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Try clearing your search filter or switching tabs.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setGroupFilter('all');
                }}
                className="agri-btn agri-btn-secondary agri-btn-sm mt-2"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            visibleSections.map((sec: DocSectionItem) => (
              <section
                key={sec.id}
                id={sec.slug}
                className="scroll-mt-24 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-7 space-y-4"
              >
                {/* Section Header */}
                <div className="pb-3 border-b border-[var(--border-subtle)] flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                      <span className="font-bold text-[#047857] dark:text-[#34d399]">
                        SECTION {sec.code}
                      </span>
                      <span>·</span>
                      <span>{sec.subtitle}</span>
                      {!sec.visible && isAdmin && (
                        <>
                          <span>·</span>
                          <span className="text-amber-600 font-bold">HIDDEN FROM PUBLIC</span>
                        </>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight mt-1">
                      {sec.title}
                    </h2>
                  </div>

                  <a
                    href={`#${sec.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      jumpToSection(sec.slug);
                    }}
                    className="text-[11px] font-mono text-[var(--text-muted)] hover:text-[#047857] dark:hover:text-[#34d399]"
                  >
                    #{sec.slug}
                  </a>
                </div>

                {/* Executive Summary */}
                <p className="text-sm sm:text-[15px] font-medium text-[var(--text-primary)] leading-relaxed">
                  {sec.summary}
                </p>

                {/* Markdown Content */}
                <DocsMarkdownRenderer
                  markdown={sec.contentMarkdown}
                  highlightQuery={searchQuery}
                />

                {/* Dynamic Live Feature Matrix inside Section C */}
                {sec.slug === 'tech-feature-matrix' && (
                  <LiveFeatureMatrixTable metrics={metrics} />
                )}

                {/* Dynamic Live Telemetry Summary inside Slide 07 & Section M */}
                {(sec.slug === 'pitch-traction' || sec.slug === 'tech-analytics') && (
                  <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
                    <div>
                      <div className="text-[var(--text-muted)]">Live Harvest Lots</div>
                      <div className="text-base font-extrabold text-[var(--text-primary)] mt-0.5">
                        {metrics.activeProductsCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)]">Verified Farmers</div>
                      <div className="text-base font-extrabold text-[var(--text-primary)] mt-0.5">
                        {metrics.verifiedFarmersCount} / {metrics.usersCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)]">Live GMV (BDT)</div>
                      <div className="text-base font-extrabold text-[#047857] dark:text-[#34d399] mt-0.5">
                        {formatCurrency(metrics.totalGmvBdt)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)]">Cold-Chain Trips</div>
                      <div className="text-base font-extrabold text-[var(--text-primary)] mt-0.5">
                        {metrics.activeShipmentsCount} active ({metrics.shipmentsCount} total)
                      </div>
                    </div>
                  </div>
                )}

                {/* Diagrams inside D / E or custom diagram sections */}
                {sec.diagramType !== 'none' && (
                  <DocsDiagrams
                    diagramType={sec.diagramType}
                    diagramCode={sec.diagramCode}
                    sectionTitle={sec.title}
                  />
                )}

                {/* Mandatory Team Showcase Grid inside Slide 11 & Section N */}
                {(sec.slug === 'pitch-team' || sec.slug === 'tech-team-ref') && (
                  <TeamShowcaseGrid team={docsState.team} />
                )}

                {/* Key Highlights */}
                {sec.highlights.length > 0 && (
                  <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-[var(--text-secondary)]">
                    {sec.highlights.map((h) => (
                      <div key={h} className="inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-[#047857] dark:text-[#10b981] shrink-0" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <DocsProvider>
      <DocsPageContent />
    </DocsProvider>
  );
}
