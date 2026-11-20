import React, { useState } from 'react';
import { Code2, Eye, Layers, ArrowRight } from 'lucide-react';
import type { DocDiagramType } from '../../types/docs';

interface DocsDiagramsProps {
  diagramType: DocDiagramType;
  diagramCode?: string;
  sectionTitle?: string;
}

export default function DocsDiagrams({
  diagramType,
  diagramCode,
  sectionTitle
}: DocsDiagramsProps) {
  const [viewMode, setViewMode] = useState<'visual' | 'source'>(
    diagramType === 'mermaid' ? 'source' : 'visual'
  );

  if (diagramType === 'none') return null;

  return (
    <div className="my-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
          <Layers className="w-4 h-4 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
          <span>
            {diagramType === 'architecture_svg'
              ? 'System Architecture Diagram (UI → API → Services → DB)'
              : diagramType === 'dataflow_svg'
              ? 'End-to-End Data & AI Flow (Input → Processing → AI → Output → Feedback)'
              : sectionTitle || 'Editable Mermaid Diagram Specification'}
          </span>
        </div>

        <div className="inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5 text-[11px] font-semibold">
          {diagramType !== 'mermaid' && (
            <button
              type="button"
              onClick={() => setViewMode('visual')}
              className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1 transition whitespace-nowrap shrink-0 ${
                viewMode === 'visual'
                  ? 'bg-[#047857] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Visual SVG</span>
            </button>
          )}
          {diagramCode && (
            <button
              type="button"
              onClick={() => setViewMode('source')}
              className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1 transition whitespace-nowrap shrink-0 ${
                viewMode === 'source'
                  ? 'bg-[#047857] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Mermaid DSL</span>
            </button>
          )}
        </div>
      </div>

      {viewMode === 'source' && diagramCode ? (
        <div className="p-4 bg-slate-950 text-slate-100 overflow-x-auto">
          <pre className="text-xs font-mono leading-relaxed">
            <code>{diagramCode}</code>
          </pre>
        </div>
      ) : diagramType === 'architecture_svg' ? (
        <div className="p-4 sm:p-6 overflow-x-auto">
          <svg
            viewBox="0 0 920 290"
            className="w-full min-w-[680px] h-auto select-none"
            role="img"
            aria-label="AgriHub 4-tier architecture diagram: Client UI and IndexedDB to API Gateway to Domain Services to Dual Storage"
          >
            <defs>
              <marker
                id="arch-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#047857" />
              </marker>
            </defs>

            {/* Layer 1: UI + IndexedDB */}
            <g transform="translate(16, 26)">
              <rect
                width="196"
                height="236"
                rx="14"
                fill="currentColor"
                className="text-emerald-50/70 dark:text-[#11241a]"
                stroke="#10b981"
                strokeOpacity="0.45"
                strokeWidth="1.25"
              />
              <text x="16" y="28" fontSize="10" fontWeight="700" fill="#047857" letterSpacing="0.8">
                1. PRESENTATION &amp; CACHE
              </text>
              <rect x="14" y="44" width="168" height="52" rx="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              <text x="24" y="66" fontSize="11.5" fontWeight="700" fill="#0f172a">React 19 + Vite SPA</text>
              <text x="24" y="83" fontSize="10" fill="#475569">Public Market · Admin · /docs</text>

              <rect x="14" y="108" width="168" height="52" rx="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              <text x="24" y="130" fontSize="11.5" fontWeight="700" fill="#0f172a">Dexie.js IndexedDB</text>
              <text x="24" y="147" fontSize="10" fill="#475569">Offline Tables + Docs CMS</text>

              <rect x="14" y="172" width="168" height="50" rx="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              <text x="24" y="194" fontSize="11.5" fontWeight="700" fill="#0f172a">Sync Mutation Queue</text>
              <text x="24" y="210" fontSize="10" fill="#475569">FIFO Coalesce + Conflict Check</text>
            </g>

            {/* Connectors 1 -> 2 */}
            <line x1="216" y1="96" x2="254" y2="96" stroke="#047857" strokeWidth="1.75" markerEnd="url(#arch-arrow)" />
            <line x1="216" y1="196" x2="254" y2="196" stroke="#047857" strokeWidth="1.75" strokeDasharray="4 3" markerEnd="url(#arch-arrow)" />

            {/* Layer 2: Edge / API */}
            <g transform="translate(258, 26)">
              <rect
                width="196"
                height="236"
                rx="14"
                fill="currentColor"
                className="text-slate-50 dark:text-[#101c16]"
                stroke="#94a3b8"
                strokeOpacity="0.45"
                strokeWidth="1.25"
              />
              <text x="16" y="28" fontSize="10" fontWeight="700" fill="#047857" letterSpacing="0.8">
                2. API &amp; EDGE GATEWAY
              </text>
              <rect x="14" y="44" width="168" height="54" rx="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              <text x="24" y="67" fontSize="11.5" fontWeight="700" fill="#0f172a">Vercel Edge / Express</text>
              <text x="24" y="84" fontSize="10" fill="#475569">/api/chat + /api/health Proxy</text>

              <rect x="14" y="112" width="168" height="54" rx="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              <text x="24" y="135" fontSize="11.5" fontWeight="700" fill="#0f172a">PHP 8 REST Gateway</text>
              <text x="24" y="152" fontSize="10" fill="#475569">VITE_API_BASE_URL + CORS</text>

              <rect x="14" y="178" width="168" height="44" rx="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              <text x="24" y="204" fontSize="11" fontWeight="700" fill="#0f172a">Bearer + Cookie Auth Guard</text>
            </g>

            {/* Connectors 2 -> 3 */}
            <line x1="458" y1="96" x2="496" y2="96" stroke="#047857" strokeWidth="1.75" markerEnd="url(#arch-arrow)" />
            <line x1="458" y1="168" x2="496" y2="168" stroke="#047857" strokeWidth="1.75" markerEnd="url(#arch-arrow)" />

            {/* Layer 3: Domain Services */}
            <g transform="translate(500, 26)">
              <rect
                width="196"
                height="236"
                rx="14"
                fill="currentColor"
                className="text-emerald-50/70 dark:text-[#11241a]"
                stroke="#10b981"
                strokeOpacity="0.45"
                strokeWidth="1.25"
              />
              <text x="16" y="28" fontSize="10" fontWeight="700" fill="#047857" letterSpacing="0.8">
                3. DOMAIN SERVICES
              </text>
              <rect x="14" y="44" width="168" height="40" rx="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              <text x="24" y="68" fontSize="11" fontWeight="700" fill="#0f172a">Catalog &amp; Batch Grading</text>

              <rect x="14" y="92" width="168" height="40" rx="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              <text x="24" y="116" fontSize="11" fontWeight="700" fill="#0f172a">Order Settlement &amp; PDF</text>

              <rect x="14" y="140" width="168" height="40" rx="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              <text x="24" y="164" fontSize="11" fontWeight="700" fill="#0f172a">Cold-Chain Dispatch Engine</text>

              <rect x="14" y="188" width="168" height="36" rx="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              <text x="24" y="210" fontSize="11" fontWeight="700" fill="#0f172a">Docs Gate &amp; Gemini Grounding</text>
            </g>

            {/* Connectors 3 -> 4 */}
            <line x1="700" y1="100" x2="736" y2="100" stroke="#047857" strokeWidth="1.75" markerEnd="url(#arch-arrow)" />
            <line x1="700" y1="196" x2="736" y2="196" stroke="#047857" strokeWidth="1.75" markerEnd="url(#arch-arrow)" />

            {/* Layer 4: Persistence & External */}
            <g transform="translate(740, 26)">
              <rect
                width="164"
                height="236"
                rx="14"
                fill="currentColor"
                className="text-slate-50 dark:text-[#101c16]"
                stroke="#94a3b8"
                strokeOpacity="0.45"
                strokeWidth="1.25"
              />
              <text x="14" y="28" fontSize="10" fontWeight="700" fill="#047857" letterSpacing="0.8">
                4. PERSISTENCE &amp; AI
              </text>
              <rect x="12" y="44" width="140" height="58" rx="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              <text x="22" y="69" fontSize="11.5" fontWeight="700" fill="#0f172a">MySQL 8 / PDO</text>
              <text x="22" y="86" fontSize="9.5" fill="#475569">Users · Products · Audits</text>

              <rect x="12" y="114" width="140" height="52" rx="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              <text x="22" y="137" fontSize="11.5" fontWeight="700" fill="#0f172a">IndexedDB v2</text>
              <text x="22" y="154" fontSize="9.5" fill="#475569">Zero-Downtime Fallback</text>

              <rect x="12" y="178" width="140" height="44" rx="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              <text x="22" y="204" fontSize="11" fontWeight="700" fill="#0f172a">Google Gemini API</text>
            </g>
          </svg>
        </div>
      ) : (
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-stretch">
            {[
              {
                step: '01 · INPUT',
                title: 'Field & User Capture',
                items: ['Harvest Batch Entry', 'Wholesale Checkout', 'Cold-Chain Telemetry', 'Bilingual User Query']
              },
              {
                step: '02 · PROCESSING',
                title: 'Local-First Engine',
                items: ['Dexie Write (<12ms)', 'Timestamp Versioning', 'Queue Coalescing', 'Server Reconciliation']
              },
              {
                step: '03 · AI & ROUTING',
                title: 'Gemini Grounding',
                items: ['Live Catalog Context', 'Zero-Secret /api/chat', 'Thermal Band Matching', 'EN / বাংলা Synthesis']
              },
              {
                step: '04 · OUTPUT',
                title: 'Verified Deliverables',
                items: ['Synced Order Ledger', 'BDT PDF Invoices', 'Live /docs Telemetry', 'Audit Trail Export']
              },
              {
                step: '05 · FEEDBACK',
                title: 'Closed-Loop Audit',
                items: ['Conflict Resolution UI', 'Sync Logs Inspection', 'KPI Metric Recompute', 'Schedule Verification']
              }
            ].map((stage, idx, arr) => (
              <div key={stage.step} className="relative flex items-stretch gap-2">
                <div className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] font-mono font-bold text-[#047857] dark:text-[#34d399] tracking-wider">
                      {stage.step}
                    </div>
                    <div className="text-xs font-bold text-[var(--text-primary)] mt-1">
                      {stage.title}
                    </div>
                    <ul className="mt-2.5 space-y-1.5 text-[11px] text-[var(--text-secondary)]">
                      {stage.items.map((item) => (
                        <li key={item} className="flex items-start gap-1.5">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-[#10b981] shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {idx < arr.length - 1 && (
                  <div className="hidden md:flex items-center justify-center text-[#047857] dark:text-[#10b981] shrink-0">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
