import React, { useState } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Database,
  Clock,
  Layers,
  X,
  Check,
  GitMerge,
  Trash2,
  Activity
} from 'lucide-react';
import { useOfflineSync } from '../../context/OfflineSyncContext';
import { useLanguage } from '../../context/LanguageContext';
import type { SyncConflictRecord } from '../../lib/offlineDb';

export default function OfflineSyncBar() {
  const { tr } = useLanguage();
  const {
    syncStatus,
    isNavigatorOnline,
    isBackendReachable,
    pendingCount,
    conflictCount,
    lastSyncedAt,
    queueItems,
    conflicts,
    syncLogs,
    triggerSync,
    resolveConflict,
    simulateConflict,
    clearCompletedQueue
  } = useOfflineSync();

  const [monitorOpen, setMonitorOpen] = useState(false);
  const [monitorTab, setMonitorTab] = useState<'logs' | 'queue' | 'conflicts'>('logs');
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [mergePrice, setMergePrice] = useState<Record<number, string>>({});
  const [mergeQty, setMergeQty] = useState<Record<number, string>>({});

  const statusConfig = {
    online: {
      label: tr('Online', 'অনলাইন'),
      classes: 'bg-emerald-50 text-[#047857] border-[#10b981]/35',
      icon: <Wifi className="w-3.5 h-3.5 text-[#047857]" strokeWidth={1.75} />
    },
    offline: {
      label: isNavigatorOnline
        ? tr('Offline (Local Cache)', 'অফলাইন (লোকাল ক্যাশ)')
        : tr('Offline', 'অফলাইন'),
      classes: 'bg-amber-50 text-amber-800 border-amber-300/70',
      icon: <WifiOff className="w-3.5 h-3.5 text-amber-700" strokeWidth={1.75} />
    },
    syncing: {
      label: tr('Syncing...', 'সিঙ্ক হচ্ছে...'),
      classes: 'bg-sky-50 text-sky-800 border-sky-300/70',
      icon: <RefreshCw className="w-3.5 h-3.5 text-sky-700 animate-spin" strokeWidth={1.75} />
    },
    synced: {
      label: tr('Synced', 'সিঙ্ক সম্পন্ন'),
      classes: 'bg-[#d1fae5]/70 text-[#047857] border-[#10b981]/40',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#047857]" strokeWidth={1.75} />
    }
  }[syncStatus];

  const handleResolve = async (
    conflict: SyncConflictRecord,
    mode: 'local' | 'server' | 'merge'
  ) => {
    if (!conflict.id) return;
    setResolvingId(conflict.id);
    try {
      if (mode === 'merge') {
        const nextPrice = Number(
          mergePrice[conflict.id] ??
            conflict.localData.unitPrice ??
            conflict.serverData.unit_price ??
            0
        );
        const nextQty = Number(
          mergeQty[conflict.id] ??
            conflict.localData.quantityAvailable ??
            conflict.serverData.quantity_available ??
            0
        );
        await resolveConflict(conflict.id, 'merge', {
          ...conflict.serverData,
          ...conflict.localData,
          unit_price: nextPrice,
          unitPrice: nextPrice,
          quantity_available: nextQty,
          quantityAvailable: nextQty
        });
      } else {
        await resolveConflict(conflict.id, mode);
      }
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <>
      <div className="bg-white border border-[var(--border-subtle)] rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Primary Sync Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold ${statusConfig.classes}`}
          >
            {statusConfig.icon}
            <span>{statusConfig.label}</span>
          </span>

          {/* IndexedDB Cache Active Indicator */}
          <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
            <Database className="w-3.5 h-3.5 text-[#047857]" strokeWidth={1.75} />
            <span>
              {isBackendReachable
                ? tr('IndexedDB + Live PHP API', 'IndexedDB + লাইভ পিএইচপি এপিআই')
                : tr('IndexedDB Offline-First Cache', 'IndexedDB অফলাইন-ফার্স্ট ক্যাশ')}
            </span>
          </span>

          {/* Pending Queue Count */}
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setMonitorTab('queue');
                setMonitorOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-bold hover:bg-amber-100 transition"
            >
              <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>
                {pendingCount} {tr('Pending Sync', 'সিঙ্ক বাকি')}
              </span>
            </button>
          )}

          {/* Conflict Alert Badge */}
          {conflictCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setMonitorTab('conflicts');
                setMonitorOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 font-bold hover:bg-red-100 transition"
            >
              <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>
                {conflictCount} {tr('Conflict(s)', 'দ্বন্দ্ব')}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {lastSyncedAt && (
            <span className="hidden md:inline text-[11px] text-slate-500 font-mono">
              {tr('Last sync:', 'সর্বশেষ সিঙ্ক:')}{' '}
              {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          <button
            type="button"
            onClick={() => triggerSync(true)}
            disabled={syncStatus === 'syncing'}
            className="h-8 px-3 rounded-lg border border-[var(--border-subtle)] bg-[#f7faf8] hover:bg-[#d1fae5]/45 text-[#047857] font-semibold inline-flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`}
              strokeWidth={1.75}
            />
            <span>{tr('Sync Now', 'এখনই সিঙ্ক করুন')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMonitorTab(conflictCount > 0 ? 'conflicts' : 'logs');
              setMonitorOpen(true);
            }}
            className="h-8 px-3 rounded-lg bg-[#047857] hover:bg-[#065f46] text-white font-semibold inline-flex items-center gap-1.5 transition"
          >
            <Activity className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>{tr('Sync Monitor', 'সিঙ্ক মনিটর')}</span>
          </button>
        </div>
      </div>

      {/* ================= SYNC MONITOR, QUEUE & CONFLICT RESOLVER MODAL ================= */}
      {monitorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[var(--border-subtle)] rounded-2xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-xs">
            <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 bg-[#f7faf8]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#d1fae5] text-[#047857] flex items-center justify-center">
                  <Database className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {tr('Offline-First Sync Engine & Monitoring', 'অফলাইন-ফার্স্ট সিঙ্ক ও মনিটরিং')}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {tr(
                      'Dexie.js IndexedDB queue with idempotency keys & conflict resolution',
                      'IndexedDB কিউ, ডুপ্লিকেট প্রতিরোধ ও কনফ্লিক্ট সমাধান ব্যবস্থা'
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMonitorOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs & Quick Judge Controls */}
            <div className="px-6 py-3 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 bg-white">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMonitorTab('logs')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition ${
                    monitorTab === 'logs'
                      ? 'bg-[#047857] text-white'
                      : 'bg-[#f0f6f2] text-slate-700 hover:bg-[#d1fae5]/60'
                  }`}
                >
                  {tr('Sync Logs', 'সিঙ্ক লগ')} ({syncLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMonitorTab('queue')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition ${
                    monitorTab === 'queue'
                      ? 'bg-[#047857] text-white'
                      : 'bg-[#f0f6f2] text-slate-700 hover:bg-[#d1fae5]/60'
                  }`}
                >
                  {tr('Offline Queue', 'অফলাইন কিউ')} ({queueItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMonitorTab('conflicts')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition inline-flex items-center gap-1 ${
                    monitorTab === 'conflicts'
                      ? 'bg-[#047857] text-white'
                      : conflictCount > 0
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-[#f0f6f2] text-slate-700 hover:bg-[#d1fae5]/60'
                  }`}
                >
                  <span>{tr('Conflicts', 'দ্বন্দ্ব')} ({conflictCount})</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    simulateConflict();
                    setMonitorTab('conflicts');
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 font-semibold hover:bg-amber-100 transition inline-flex items-center gap-1"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  <span>{tr('Simulate Conflict', 'কনফ্লিক্ট টেস্ট করুন')}</span>
                </button>
                {queueItems.some((q) => q.status === 'completed') && (
                  <button
                    type="button"
                    onClick={clearCompletedQueue}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-semibold hover:bg-slate-50 transition inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{tr('Clear Completed', 'সম্পন্ন মুছুন')}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3 bg-[#f7faf8]">
              {monitorTab === 'logs' && (
                <div className="space-y-2">
                  {syncLogs.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      {tr('No sync events recorded yet.', 'কোনো সিঙ্ক লগ নেই।')}
                    </div>
                  ) : (
                    syncLogs.map((log) => (
                      <div
                        key={log.id}
                        className="bg-white border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 flex items-start justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                log.level === 'success'
                                  ? 'bg-[#d1fae5] text-[#047857]'
                                  : log.level === 'warning'
                                  ? 'bg-amber-100 text-amber-800'
                                  : log.level === 'error'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {log.action}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">
                              {log.entityType}
                              {log.entityId ? ` #${log.entityId}` : ''}
                            </span>
                          </div>
                          <p className="text-slate-800 font-medium">{log.message}</p>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {monitorTab === 'queue' && (
                <div className="space-y-2">
                  {queueItems.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      {tr(
                        'Offline queue is empty. Edit or create a record to observe local-first queuing.',
                        'অফলাইন কিউ খালি।'
                      )}
                    </div>
                  ) : (
                    queueItems.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white border border-[var(--border-subtle)] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-[#f0f6f2] text-[#047857] border border-[#10b981]/25">
                              {item.operation} • {item.entityType}
                            </span>
                            <span className="font-bold text-slate-900">{item.entityLabel}</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            Idempotency Key: {item.idempotencyKey}
                          </div>
                          {item.lastError && (
                            <div className="text-[11px] text-red-600">{item.lastError}</div>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg ${
                            item.status === 'completed'
                              ? 'bg-[#d1fae5] text-[#047857]'
                              : item.status === 'conflict'
                              ? 'bg-red-100 text-red-700'
                              : item.status === 'syncing'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {monitorTab === 'conflicts' && (
                <div className="space-y-3">
                  {conflicts.length === 0 ? (
                    <div className="bg-white border border-[var(--border-subtle)] rounded-xl p-8 text-center space-y-2">
                      <Layers className="w-7 h-7 text-[#047857] mx-auto" strokeWidth={1.75} />
                      <div className="font-bold text-slate-900">
                        {tr('No Unresolved Sync Conflicts', 'কোনো অনিষ্পন্ন দ্বন্দ্ব নেই')}
                      </div>
                      <p className="text-slate-500 max-w-md mx-auto">
                        {tr(
                          'If a record is modified both locally offline and on the server, it appears here for manual resolution.',
                          'একই তথ্য অফলাইনে এবং সার্ভারে আলাদাভাবে পরিবর্তন হলে এখানে সমাধানের জন্য দেখা যাবে।'
                        )}
                      </p>
                    </div>
                  ) : (
                    conflicts.map((c) => {
                      const localPrice = c.localData.unitPrice ?? c.localData.unit_price ?? '';
                      const serverPrice = c.serverData.unit_price ?? c.serverData.unitPrice ?? '';
                      const localQty =
                        c.localData.quantityAvailable ?? c.localData.quantity_available ?? '';
                      const serverQty =
                        c.serverData.quantity_available ?? c.serverData.quantityAvailable ?? '';

                      return (
                        <div
                          key={c.id}
                          className="bg-white border border-red-200 rounded-xl p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-red-600" />
                              <span className="font-bold text-slate-900 text-sm">
                                {c.entityLabel}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                {c.entityType} #{c.entityId}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">
                              {new Date(c.detectedAt).toLocaleString()}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1">
                              <div className="font-bold text-amber-900">
                                {tr('Local Offline Change', 'লোকাল অফলাইন পরিবর্তন')}
                              </div>
                              <div className="font-mono text-[11px] text-slate-700">
                                Price: {String(localPrice)} | Qty: {String(localQty)}
                              </div>
                            </div>
                            <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200 space-y-1">
                              <div className="font-bold text-sky-900">
                                {tr('Server Version', 'সার্ভার সংস্করণ')}
                              </div>
                              <div className="font-mono text-[11px] text-slate-700">
                                Price: {String(serverPrice)} | Qty: {String(serverQty)}
                              </div>
                            </div>
                          </div>

                          {/* Optional custom merge values */}
                          <div className="grid grid-cols-2 gap-3 pt-1">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                {tr('Merged Price (Optional)', 'মার্জ মূল্য')}
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={mergePrice[c.id!] ?? String(localPrice)}
                                onChange={(e) =>
                                  setMergePrice((prev) => ({ ...prev, [c.id!]: e.target.value }))
                                }
                                className="agri-input h-8 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                {tr('Merged Stock Qty (Optional)', 'মার্জ পরিমাণ')}
                              </label>
                              <input
                                type="number"
                                step="1"
                                value={mergeQty[c.id!] ?? String(localQty)}
                                onChange={(e) =>
                                  setMergeQty((prev) => ({ ...prev, [c.id!]: e.target.value }))
                                }
                                className="agri-input h-8 text-xs font-mono"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              disabled={resolvingId === c.id}
                              onClick={() => handleResolve(c, 'server')}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition"
                            >
                              {tr('Use Server Version', 'সার্ভার গ্রহণ করুন')}
                            </button>
                            <button
                              type="button"
                              disabled={resolvingId === c.id}
                              onClick={() => handleResolve(c, 'local')}
                              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition inline-flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{tr('Keep Local Edit', 'লোকাল রাখুন')}</span>
                            </button>
                            <button
                              type="button"
                              disabled={resolvingId === c.id}
                              onClick={() => handleResolve(c, 'merge')}
                              className="px-3 py-1.5 rounded-lg bg-[#047857] hover:bg-[#065f46] text-white font-semibold transition inline-flex items-center gap-1"
                            >
                              <GitMerge className="w-3.5 h-3.5" />
                              <span>{tr('Apply Merge', 'মার্জ করুন')}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
