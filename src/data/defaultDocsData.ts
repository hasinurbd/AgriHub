import type {
  DocSectionItem,
  DocsAccessConfig,
  DocsDocumentState,
  TeamConfig
} from '../types/docs';

import leadAvatarImg from '../assets/images/team_member_lead_1795170423111.jpg';
import productAvatarImg from '../assets/images/team_member_product_1795170424489.jpg';
import systemsAvatarImg from '../assets/images/team_member_systems_1795170423897.jpg';
import dataAvatarImg from '../assets/images/team_member_data_1795170423782.jpg';

export const DEFAULT_SCHEDULE_START = '2026-06-10T00:00';
export const DEFAULT_SCHEDULE_END = '2026-06-14T23:59';

export const DEFAULT_DOCS_ACCESS: DocsAccessConfig = {
  visibilityEnabled: false,
  accessMode: 'manual_off',
  scheduleStart: DEFAULT_SCHEDULE_START,
  scheduleEnd: DEFAULT_SCHEDULE_END,
  durationHours: 120,
  durationStartedAt: DEFAULT_SCHEDULE_START,
  restrictedTitle: 'Documentation Restricted · Admin Only',
  restrictedMessage:
    'This documentation and pitch deck workspace is hidden from public visitors. Only authenticated administrators may view or manage this page.',
  updatedAt: '2026-06-10T00:00:00.000Z',
  updatedBy: 'System Administrator'
};

export const DEFAULT_TEAM_CONFIG: TeamConfig = {
  teamName: 'AgriHub Engineering & Product Team',
  teamTagline:
    'Building resilient cold-chain commerce and offline-first agricultural infrastructure for Bangladesh.',
  members: [
    {
      id: 'tm-1',
      fullName: 'Hasinur Rahman',
      role: 'Founder & Lead Full-Stack Architect',
      email: 'hasinur@agrihub.bd',
      avatarUrl: leadAvatarImg,
      bio: 'System architecture, PHP/MySQL trade API, Vercel edge deployment, and offline-first Dexie sync engine.'
    },
    {
      id: 'tm-2',
      fullName: 'Nusrat Jahan',
      role: 'Head of Product & Cold-Chain Operations',
      email: 'nusrat@agrihub.bd',
      avatarUrl: productAvatarImg,
      bio: 'B2B agricultural trade workflows, producer onboarding, and regional hub fulfillment strategy.'
    },
    {
      id: 'tm-3',
      fullName: 'Tahmidul Karim',
      role: 'Senior Frontend & Offline Systems Engineer',
      email: 'tahmid@agrihub.bd',
      avatarUrl: systemsAvatarImg,
      bio: 'React 19 interfaces, bilingual EN/বাংলা accessibility, PDF invoicing, and conflict resolution UX.'
    },
    {
      id: 'tm-4',
      fullName: 'Farhana Tasnim',
      role: 'AI & Supply-Chain Intelligence Engineer',
      email: 'farhana@agrihub.bd',
      avatarUrl: dataAvatarImg,
      bio: 'Gemini-powered bilingual trade assistant, catalog context grounding, and thermal risk alerting.'
    }
  ]
};

const NOW_ISO = '2026-06-10T00:00:00.000Z';

export const DEFAULT_DOCS_SECTIONS: DocSectionItem[] = [
  // ================= A. YC-STYLE PITCH DECK =================
  {
    id: 'pitch-problem',
    slug: 'pitch-problem',
    code: '01',
    group: 'pitch',
    order: 1,
    title: 'Problem: Fragmented Harvests & Rural Connectivity Gaps',
    subtitle: 'YC Pitch Deck · Slide 01 — The Core Market Friction',
    summary:
      'Over 30% of perishable produce in Bangladesh spoils between farm gate and urban wholesale markets due to uncoordinated middlemen, zero cold-chain visibility, and unreliable rural internet.',
    contentMarkdown: `### Why Perishable Agriculture Bleeds Value Today

Across Bangladesh's major production belts (Rajshahi, Bogura, Rangpur, Sylhet), smallholder cooperatives face three compounding failures every harvest cycle:

- **High Post-Harvest Spoilage (28–34%)**: Without temperature-logged collection hubs and coordinated reefer dispatch, mangoes, tomatoes, dairy, and greens degrade rapidly in transit.
- **Opaque 4-Layer Brokerage Chains**: Farmers receive volatile farm-gate prices while institutional buyers pay inflated spot rates with zero batch traceability.
- **Software Failure in Low-Connectivity Zones**: Standard cloud-only admin dashboards stall when collection hub dispatchers experience cellular dead zones or backend downtime.`,
    highlights: [
      '30%+ perishable loss across unrefrigerated corridors',
      'Zero unified batch traceability from harvest date to buyer depot',
      'Rural dispatch operations break under intermittent connectivity'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'pitch-solution',
    slug: 'pitch-solution',
    code: '02',
    group: 'pitch',
    order: 2,
    title: 'Solution: Cold-Chain Marketplace with Offline-First Control',
    subtitle: 'YC Pitch Deck · Slide 02 — Product Thesis',
    summary:
      'AgriHub unifies verified producers, regional cold warehouses, refrigerated fleet partners, and wholesale buyers on one bilingual BDT platform powered by an IndexedDB offline-first engine.',
    contentMarkdown: `### One Network from Harvest Batch to Verified Delivery

AgriHub replaces fragmented phone brokerage with a structured, auditable B2B agricultural trade platform:

- **Batch-Tracked Wholesale Marketplace**: Every harvest lot records farm origin, harvest/expiry dates, organic status, storage temperature target (°C), and real-time BDT inventory.
- **Cold-Chain Dispatch & Tracking**: Assign reefer vehicles, monitor target temperatures (2°C–8°C), and share milestone tracking codes (\`TRK-COLD-*\`) with buyers.
- **Offline-First Admin & Operations Console**: Powered by **Dexie.js (IndexedDB)**, administrators can create, edit, or dispatch records offline with automatic FIFO synchronization and conflict resolution when connectivity returns.`,
    highlights: [
      'End-to-end batch traceability & digital BDT invoicing (PDF)',
      'Role-dedicated workspaces for Farmers, Buyers, Carriers, and Admins',
      '100% functional offline Admin Panel with idempotent background sync'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'pitch-why-now',
    slug: 'pitch-why-now',
    code: '03',
    group: 'pitch',
    order: 3,
    title: 'Why Now: Digital Rails Meet Modern Edge Resilience',
    subtitle: 'YC Pitch Deck · Slide 03 — Market & Technology Inflection',
    summary:
      'Smartphone adoption among agro cooperatives, digital BDT escrow settlements, and browser-native IndexedDB + Gemini AI make reliable nationwide agro-logistics viable for the first time.',
    contentMarkdown: `### Converging Shifts in 2026

- **Modern Browser Capabilities**: IndexedDB storage via Dexie.js now delivers sub-10ms local persistence and background synchronization directly inside standard mobile and desktop browsers—eliminating expensive native device lock-in.
- **Bilingual AI Adoption**: Grounded LLM assistants (Gemini) allow semi-technical farmers and buyers to search batches, verify storage temperatures, and navigate procurement in natural **English and Bangla (বাংলা)**.
- **Decoupled Cloud Economics**: Combining zero-config Vercel edge hosting with portable PHP 8 / MySQL REST APIs keeps infrastructure burn near zero while scaling regionally.`,
    highlights: [
      'Browser-native offline persistence removes native app friction',
      'Natural-language bilingual EN/বাংলা AI trade support',
      'Protected digital BDT trade settlements & audit trails'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'pitch-demo',
    slug: 'pitch-demo',
    code: '04',
    group: 'pitch',
    order: 4,
    title: 'Product Demo: Live Walkthrough & Interactive Modules',
    subtitle: 'YC Pitch Deck · Slide 04 — Live System Capabilities',
    summary:
      'Judges and investors can test every workflow directly from the live deployment—including Marketplace checkout, bilingual PDF invoice generation, and simulated offline sync conflict resolution.',
    contentMarkdown: `### Experience AgriHub Live in Under 2 Minutes

1. **Public Marketplace (\`/marketplace\`)**: Filter live produce batches by category, organic certification, stock availability, and cold-storage temperature; add to Trade Cart and generate instant BDT PDF invoices.
2. **Role Workspaces (\`/farmer\`, \`/buyer\`, \`/logistics\`)**: Publish harvest batches as a cooperative farmer, update reefer transit milestones as a logistics partner, or track shipments by tracking code as a buyer.
3. **Offline-First Admin Console (\`/admin/dashboard\`)**: Manage inventory, orders, users, categories, warehouses, and open the **Sync Monitor** to inspect Dexie IndexedDB queues, idempotency keys, and 3-way conflict resolution.`,
    highlights: [
      'Instant sandbox mode even when external database is offline',
      'One-click bilingual switch (English ↔ বাংলা) across every view',
      'Interactive Sync Monitor with live queue & conflict testing'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'pitch-market',
    slug: 'pitch-market',
    code: '05',
    group: 'pitch',
    order: 5,
    title: 'Market Opportunity: Bangladesh Agro-Wholesale & Cold-Chain',
    subtitle: 'YC Pitch Deck · Slide 05 — Bottom-Up Market Sizing',
    summary:
      'Targeting Bangladesh’s multi-billion-dollar domestic perishable wholesale and cold-chain logistics corridor, beginning with high-spoilage fruits, vegetables, dairy, and aromatic grains.',
    contentMarkdown: `### Addressable Market Breakdown

| Tier | Scope | Annual Opportunity (BDT / USD Eq.) | Focus |
| :--- | :--- | :--- | :--- |
| **TAM** | Total Bangladesh Perishable & Staple Agro-Wholesale Trade | **~BDT 4.2 Trillion** (~$35B) | All farm-to-retail produce & staple distribution |
| **SAM** | Organized Inter-District Cold-Chain & Urban Retail Sourcing | **~BDT 380 Billion** (~$3.1B) | Supermarkets, hospitality, institutional buyers, & major districts |
| **SOM (3-Yr)** | Primary Agro Corridors (Rajshahi–Bogura–Dhaka–Chattogram) | **~BDT 18 Billion** (~$150M GMV) | High-margin horticulture, dairy, and graded rice batches |`,
    highlights: [
      'Dhaka metro consumes over 60% of inter-district graded horticulture',
      'Cold-chain efficiency alone recovers 15–20% net margin per batch',
      'Fragmented B2B procurement ready for centralized digital rails'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'pitch-business-model',
    slug: 'pitch-business-model',
    code: '06',
    group: 'pitch',
    order: 6,
    title: 'Business Model: Transaction Take-Rate & Cold-Chain SaaS',
    subtitle: 'YC Pitch Deck · Slide 06 — Unit Economics & Revenue Streams',
    summary:
      'AgriHub monetizes through a 2.5% verified trade marketplace fee, cold-chain dispatch coordination margins, and regional storage SaaS tooling for cooperatives.',
    contentMarkdown: `### Multi-Engine Revenue Architecture

- **Marketplace Trade Fee (2.0% – 3.0% GMV)**: Applied cleanly on settled wholesale orders with automated BDT breakdown (subtotal, corridor delivery, platform tax/escrow).
- **Cold-Chain Dispatch Fee (5% – 8% freight share)**: Earned by optimizing backhaul capacity across partner refrigerated carriers.
- **Enterprise Cooperative & Warehouse Plan (BDT 8,500 / month)**: Multi-hub thermal telemetry, offline sync fleet seats, KYC verification workflows, and automated PDF compliance exports.`,
    highlights: [
      'Asset-light logistics coordination avoids owning heavy truck capex',
      'Transparent BDT fee structure aligns platform take-rate with saved spoilage',
      'High retention via embedded inventory, invoicing, and audit history'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'pitch-traction',
    slug: 'pitch-traction',
    code: '07',
    group: 'pitch',
    order: 7,
    title: 'Traction & Live System Telemetry',
    subtitle: 'YC Pitch Deck · Slide 07 — Auto-Synced Platform Metrics',
    summary:
      'All headline metrics below synchronize directly with AgriHub’s active database and Dexie IndexedDB store in real time—no static screenshots or stale pitch deck figures.',
    contentMarkdown: `### Live Platform Proof

Unlike static investor slides, AgriHub’s traction figures reflect the live state of batches, verified producers, wholesale orders, and regional cold-chain hubs currently active in the system. When an admin adds a new harvest batch or processes an order, these metrics update immediately.`,
    highlights: [
      'Live KPI cards synced straight from active platform storage',
      'Full order-to-invoice audit trail with downloadable PDF proof',
      'Multi-role operational readiness verified across 4 user types'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'pitch-competition',
    slug: 'pitch-competition',
    code: '08',
    group: 'pitch',
    order: 8,
    title: 'Competition: Structural Superiority Over Brokers & Classifieds',
    subtitle: 'YC Pitch Deck · Slide 08 — Competitive Landscape',
    summary:
      'Traditional brokers lack transparency and cold-chain accountability, while generic B2B apps fail offline and omit perishability controls.',
    contentMarkdown: `### Competitive Comparison Matrix

| Capability | Traditional Aratdar / Brokers | Generic B2B / Classifieds | **AgriHub Platform** |
| :--- | :--- | :--- | :--- |
| **Transparent BDT Pricing & Tax** | Opaque commission layers | Unverified listings | Standardized breakdown + PDF Invoice |
| **Batch Thermal Tracking (°C)** | None | None | Harvest-to-hub target °C + reefer logs |
| **Offline Rural Admin Continuity** | Paper ledgers | Fails without internet | **Dexie IndexedDB + Auto FIFO Sync** |
| **Conflict-Safe Concurrent Edits** | Manual disputes | Overwrites silently | 3-Way Merge / Server / Local Resolver |
| **Bilingual EN / বাংলা AI Copilot** | None | None | Live catalog-grounded Gemini assistant |`,
    highlights: [
      'Replaces error-prone paper ledgers without sacrificing offline speed',
      'Purpose-built for perishable cold-chain constraints, not generic SKUs',
      'Full bilingual accessibility lowers onboarding barriers'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'pitch-advantage',
    slug: 'pitch-advantage',
    code: '09',
    group: 'pitch',
    order: 9,
    title: 'Unique Advantage: Hybrid Edge-Sync & Bilingual Grounding',
    subtitle: 'YC Pitch Deck · Slide 09 — Defensible Technical Moat',
    summary:
      'Our idempotent Dexie.js mutation queue coalesces edits offline, detects concurrent server changes, and pairs seamlessly with a stateless PHP/MySQL core.',
    contentMarkdown: `### Why AgriHub Is Hard to Replicate

1. **Idempotent Offline-First Sync Engine**: Every offline edit attaches a deterministic \`X-Idempotency-Key\`, coalesces redundant \`CREATE + UPDATE\` cycles locally, swaps temporary negative IDs for canonical MySQL keys on reconnect, and flags HTTP \`409\` or timestamp collisions for operator resolution.
2. **Dual-Runtime Portability**: Frontend ships seamlessly on Vercel with serverless AI routes, connecting to any cloud PHP/MySQL backend (Render, Railway, Hostinger) via \`NEXT_PUBLIC_API_URL\` / \`VITE_API_BASE_URL\` with strict CORS & \`SameSite=None\` session cookies.`,
    highlights: [
      'Zero duplicate uploads via queue coalescing & idempotency headers',
      'Survives full backend or MySQL outage without losing operator work',
      'First-class bilingual English & Bengali semantic UI + AI experience'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'pitch-gtm',
    slug: 'pitch-gtm',
    code: '10',
    group: 'pitch',
    order: 10,
    title: 'Go-To-Market: High-Value Corridor Density Strategy',
    subtitle: 'YC Pitch Deck · Slide 10 — Distribution & Rollout',
    summary:
      'Land regional producer cooperatives along the Rajshahi–Bogura–Dhaka corridor, anchor demand via institutional supermarket buyers, and expand cold-chain capacity hub by hub.',
    contentMarkdown: `### 3-Phase Corridor Playbook

- **Phase 1 — Anchor Supply & Buyer Hubs**: Onboard verified mango, vegetable, and rice cooperatives in Rajshahi & Bogura paired with Dhaka central cold-storage depots.
- **Phase 2 — Carrier Utilization Loops**: Equip refrigerated fleet operators with \`/logistics\` portals for temperature checkpoint logging and backhaul scheduling.
- **Phase 3 — National Federation**: Open self-serve regional warehouse onboarding across Chattogram, Sylhet, and Rangpur corridors.`,
    highlights: [
      'Corridor-by-corridor density ensures high reefer truck load factors',
      'KYC-verified farmer badges build instant trust with urban buyers',
      'Zero hardware lock-in speeds cooperative onboarding to <15 minutes'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'pitch-team',
    slug: 'pitch-team',
    code: '11',
    group: 'pitch',
    order: 11,
    title: 'Team: Founding Builders & Systems Leadership',
    subtitle: 'YC Pitch Deck · Slide 11 — Who Builds AgriHub',
    summary:
      'A cross-functional engineering, product, and agricultural AI team combining full-stack systems depth with deep domain understanding of South Asian food corridors.',
    contentMarkdown: `### Execution-Focused Founding Team

Our team blends distributed web systems engineering, offline-first data architecture, agricultural supply-chain operations, and applied Gemini AI workflows. Every member profile below is live-editable directly from the Docs Studio.`,
    highlights: [
      'Full-stack architecture across React 19, TypeScript, PHP 8, and MySQL',
      'Proven offline-first sync engineering & cloud-native deployment',
      'Direct collaboration with regional agro cooperatives and cold-chain carriers'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'pitch-vision',
    slug: 'pitch-vision',
    code: '12',
    group: 'pitch',
    order: 12,
    title: 'Vision: Zero-Spoilage Digital Food Infrastructure',
    subtitle: 'YC Pitch Deck · Slide 12 — Long-Term Horizon',
    summary:
      'To become the operating system for perishable agricultural commerce across South Asia—guaranteeing fair farm-gate livelihoods and predictable cold-chain supply.',
    contentMarkdown: `### The 5-Year Horizon

AgriHub aims to make fresh, traceable, cold-chain-protected agriculture the default standard across regional food corridors—powering predictive harvest pricing, automated IoT thermal escrow release, and borderless export readiness for smallholder cooperatives.`,
    highlights: [
      'Cut preventable post-harvest corridor spoilage below 5%',
      'Direct financial inclusion & digital trade history for 100,000+ farmers',
      'Real-time cold-chain intelligence from field harvest to retail shelf'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },

  // ================= B–O. FULL TECHNICAL DOCUMENTATION =================
  {
    id: 'tech-overview',
    slug: 'tech-overview',
    code: 'B',
    group: 'technical',
    order: 13,
    title: 'Product Overview & Core Personas',
    subtitle: 'Section B · Functional Scope, Target Users & Use Cases',
    summary:
      'AgriHub serves four strictly separated RBAC roles—Farmer, Buyer, Logistics Supplier, and Administrator—unified across public discovery and protected operational consoles.',
    contentMarkdown: `### Target Personas & Primary Workflows

- **Producers / Farmers (\`/farmer\`)**: Register verified cooperative profiles, publish harvest batches with target storage temperatures, and confirm wholesale orders.
- **Wholesale Buyers (\`/marketplace\`, \`/buyer\`)**: Browse graded batches, build multi-item Trade Cart orders, generate bilingual PDF invoices, and track reefer delivery codes.
- **Cold-Chain Suppliers (\`/logistics\`)**: Receive dispatched shipments, log route checkpoints, update cargo temperature (°C), and confirm delivery.
- **Platform Administrators (\`/admin/*\`)**: Oversee KPI analytics, manage categories/products/users/warehouses offline or online, resolve sync conflicts, and control \`/docs\` visibility schedules.`,
    highlights: [
      '4 role-scoped workspaces protected by session + RBAC verification',
      'Bilingual English & Bangla (Hind Siliguri) switcher across all UI & PDFs',
      'Instant fallback to local IndexedDB sandbox if external API is unreachable'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'tech-feature-matrix',
    slug: 'tech-feature-matrix',
    code: 'C',
    group: 'technical',
    order: 14,
    title: 'Feature Matrix (Live-Synced)',
    subtitle: 'Section C · Current Production Capabilities & Planned Modules',
    summary:
      'Live status matrix synchronized against active AgriHub subsystems, offline Dexie stores, AI endpoints, and upcoming roadmap extensions.',
    contentMarkdown: `### System Capability Inventory

This matrix reflects modules actively wired in the running application alongside upcoming engineering releases.`,
    highlights: [
      'Live-synced operational telemetry embedded directly below',
      'Clear distinction between Live, Syncing/Beta, and Planned modules',
      'Zero-downtime graceful degradation across offline intervals'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'tech-architecture',
    slug: 'tech-architecture',
    code: 'D',
    group: 'technical',
    order: 15,
    title: 'System Architecture Diagram',
    subtitle: 'Section D · UI → API Gateway → Domain Services → Dual Persistence',
    summary:
      'Decoupled React 19 SPA with Dexie IndexedDB local engine communicating over CORS-hardened HTTPS to PHP 8 / MySQL REST endpoints and Vercel Serverless Gemini AI routes.',
    contentMarkdown: `### Architectural Layers

1. **Presentation & Local Store Layer**: React 19 + TypeScript + Tailwind CSS v4 paired with **Dexie.js (\`agrihub_offline_v1\`)** storing cached entities, FIFO \`syncQueue\`, \`conflicts\`, \`syncLogs\`, and \`docsState\`.
2. **Edge & AI Gateway**: Vercel Serverless Functions (\`/api/chat\`, \`/api/health\`) or local Express dev server guarding \`GEMINI_API_KEY\` server-side.
3. **Configurable Backend REST API**: Environment-driven PHP 8.2 endpoints (\`NEXT_PUBLIC_API_URL\` / \`VITE_API_BASE_URL\`) deployed on Render, Railway, or Hostinger with \`PDO\` prepared statements and MySQL 8.`,
    highlights: [
      'Switch between Visual Interactive Diagram and editable Mermaid DSL',
      'Cross-origin credentialed sessions (SameSite=None; Secure)',
      'Idempotency header support prevents duplicate replay writes'
    ],
    visible: true,
    status: 'published',
    diagramType: 'architecture_svg',
    diagramCode: `flowchart LR
  UI["React 19 SPA + Tailwind v4"] --> Dexie["Dexie.js IndexedDB Cache & Queue"]
  Dexie -->|Online Auto-Sync + X-Idempotency-Key| PHP["PHP 8.2 REST API (Render/Railway)"]
  UI -->|POST /api/chat| Edge["Vercel Serverless / Express AI Proxy"]
  Edge --> Gemini["Gemini 4 Hydrogen (@google/genai)"]
  PHP --> MySQL["MySQL 8 Relational DB"]`,
    updatedAt: NOW_ISO
  },
  {
    id: 'tech-dataflow',
    slug: 'tech-dataflow',
    code: 'E',
    group: 'technical',
    order: 16,
    title: 'Data & AI Execution Flow',
    subtitle: 'Section E · Input → Queue Processing → AI Grounding → Output → Feedback',
    summary:
      'Every operator mutation and AI query follows a deterministic pipeline ensuring instant UI feedback, zero lost writes, and live catalog grounding.',
    contentMarkdown: `### End-to-End Pipeline Mechanics

- **Input**: Admin/User actions (batch registration, order status update, warehouse edits) or natural-language marketplace questions.
- **Processing & Coalescing**: Write immediately to IndexedDB; coalesce redundant operations on pending items; attach unique \`idempotencyKey\`.
- **AI Grounding Layer**: Marketplace catalog summary is passed cleanly to \`/api/chat\` system instructions so Gemini responses cite real prices and temperatures in BDT / °C.
- **Output & Feedback**: Reactive UI refreshes within 15ms; when backend health returns true, background worker replays queue and reconciles server IDs & conflicts.`,
    highlights: [
      'Sub-15ms optimistic local persistence via IndexedDB transactions',
      'Automatic connectivity probe triggers replay on network recovery',
      'Live conflict detection surfaces 3-way resolution in Admin UI'
    ],
    visible: true,
    status: 'published',
    diagramType: 'dataflow_svg',
    diagramCode: `flowchart LR
  Input["User Mutation / Chat Query"] --> Local["IndexedDB Transaction & Queue Coalesce"]
  Local --> Net{"Backend Reachable?"}
  Net -->|Yes| Replay["PHP API Replay + Conflict Check"]
  Net -->|No| Cache["Persist Offline & Notify UI"]
  Input --> AI["/api/chat + Live Catalog Context"]
  AI --> Reply["Bilingual BDT Response"]`,
    updatedAt: NOW_ISO
  },
  {
    id: 'tech-stack',
    slug: 'tech-stack',
    code: 'F',
    group: 'technical',
    order: 17,
    title: 'Technology Stack',
    subtitle: 'Section F · Frontend, Backend, Database, AI & Infrastructure',
    summary:
      'Modern TypeScript SPA tooling paired with portable PHP/MySQL REST services and serverless Gemini inference.',
    contentMarkdown: `### Complete Stack Inventory

| Layer | Technologies | Role |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide React | Modular bilingual UI, responsive dashboards, lazy routes |
| **Offline Persistence** | Dexie.js 4 (\`agrihub_offline_v1\`), LocalStorage fallback | Local-first tables, FIFO queue, conflict & log storage |
| **Documents & Export** | jsPDF 4, html-to-image, Markdown serializer | Branded BDT invoices, admin order reports, \`/docs\` PDF/MD export |
| **Backend API** | PHP 8.2 (CORS + PDO), Express / Vercel Node Serverless | Auth sessions, CRUD endpoints, \`/api/chat\` proxy |
| **Relational DB** | MySQL 8 (\`database/schema.sql\`) | ACID order inventory, user KYC, shipments, audit logs |
| **AI & Grounding** | \`@google/genai\` (\`gemini-4-hydrogen\`) | Bilingual agricultural trade assistant & catalog QA |`,
    highlights: [
      'Zero external CSS framework bloat—clean Tailwind CSS v4 tokens',
      'Vite `envPrefix` supports both `NEXT_PUBLIC_API_URL` and `VITE_API_BASE_URL`',
      'Portable across Vercel, Render, Railway, and Hostinger'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'tech-api-docs',
    slug: 'tech-api-docs',
    code: 'G',
    group: 'technical',
    order: 18,
    title: 'API Documentation & Auth Model',
    subtitle: 'Section G · Exposed REST Endpoints, Headers & Error Semantics',
    summary:
      'Comprehensive reference for AgriHub PHP REST endpoints, Vercel serverless AI routes, cross-origin credentialed cookies, and idempotency contracts.',
    contentMarkdown: `### Endpoint Reference

| Method | Endpoint | Auth / Role | Purpose |
| :--- | :--- | :--- | :--- |
| \`POST\` | \`/api/chat\` | Public (Server Proxy) | Grounded bilingual Gemini AI trade chat |
| \`GET\` | \`/api/health\` | Public | Serverless health & AI key status check |
| \`POST\` | \`/auth/login.php\` | Public | Issues credentialed PHP session cookie |
| \`GET\` | \`/auth/me.php\` | Session Cookie | Validates active session & role metadata |
| \`GET/POST/PUT/DEL\` | \`/admin/products.php\` | \`admin\` | Batch CRUD (\`X-Idempotency-Key\` supported) |
| \`GET/POST/PUT/DEL\` | \`/admin/categories.php\` | \`admin\` | Produce category taxonomy CRUD |
| \`GET/POST/PUT/PATCH/DEL\` | \`/admin/users.php\` | \`admin\` | Member directory & farmer KYC verification |
| \`GET/POST\` | \`/orders/index.php\`, \`/orders/update_status.php\` | Authenticated | Wholesale orders & escrow status transitions |
| \`GET/POST\` | \`/logistics/index.php\`, \`/logistics/update.php\` | \`admin\` / \`supplier\` | Reefer dispatch & thermal checkpoints |

### Security & Header Contract
- All cross-origin API requests use \`credentials: "include"\` paired with explicit server \`Origin\` reflection (no wildcard \`*\`).
- Offline replay mutations include \`X-Idempotency-Key\` to guard against duplicate submissions.`,
    highlights: [
      'Dynamic `isOriginAllowed()` supports Vercel preview URLs safely',
      'Clean JSON responses even on database or 503 service faults',
      'Structured HTTP 409 conflict signaling for concurrent updates'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'tech-data-layer',
    slug: 'tech-data-layer',
    code: 'H',
    group: 'technical',
    order: 19,
    title: 'Data Layer, Caching & Privacy Handling',
    subtitle: 'Section H · Dual Storage Schema, Coalescing & Data Protection',
    summary:
      'Normalized MySQL relational schemas mirror structured Dexie IndexedDB object stores for instant offline reads and privacy-safe state isolation.',
    contentMarkdown: `### Storage & Sync Design

- **IndexedDB Object Stores (\`agrihub_offline_v1\`)**:
  - Domain tables: \`products\`, \`categories\`, \`users\`, \`orders\`, \`shipments\`, \`warehouses\`
  - Sync & Docs tables: \`syncQueue\`, \`conflicts\`, \`syncLogs\`, \`docsState\`
- **Queue Coalescing Rules**:
  - \`CREATE + UPDATE\` on a temporary negative ID merges payloads before reaching the server.
  - \`CREATE + DELETE\` offline removes both queue and local record without hitting the backend.
- **Privacy Controls**: Password hashes remain strictly server-side (\`password_hash\`); PII is masked in public marketplace payloads; Gemini API keys never ship in client bundles.`,
    highlights: [
      'Bounded audit/sync logs (auto-pruned to 250 most recent entries)',
      'Non-destructive server merges never clobber pending offline edits',
      'Zero client-side secret exposure'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'tech-ai-layer',
    slug: 'tech-ai-layer',
    code: 'I',
    group: 'technical',
    order: 20,
    title: 'AI Layer: Grounded Bilingual Intelligence',
    subtitle: 'Section I · Gemini 4 Hydrogen Architecture, Grounding & Guardrails',
    summary:
      'Server-side Gemini integration grounds responses in real catalog prices, batch quantities, and cold-storage specs while enforcing strict currency and safety rules.',
    contentMarkdown: `### Grounded Trade Assistant Mechanics

- **Model & Execution**: Runs \`gemini-4-hydrogen\` with low thinking latency via \`@google/genai\` inside Vercel Serverless / Express \`/api/chat\`.
- **Context Grounding (Catalog RAG)**: Client packages an up-to-date snapshot of active Marketplace harvest batches (price in BDT, stock, temperature °C, farm origin) inside \`catalogSummary\`.
- **Explainability & Guardrails**: System prompt forces transparent Bangladeshi Taka (\`BDT\` / \`৳\`) formatting, forbids fabricated order confirmations, and adapts seamlessly between English and Bangla.`,
    highlights: [
      'Server-only GEMINI_API_KEY isolation',
      'Live inventory snapshot grounding prevents stale price hallucinations',
      'Natural Bangla & English agricultural domain fluency'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'tech-roadmap',
    slug: 'tech-roadmap',
    code: 'J',
    group: 'operations',
    order: 21,
    title: 'Product Roadmap',
    subtitle: 'Section J · Short, Mid & Long-Term Engineering Milestones',
    summary:
      'Phased execution plan spanning immediate hackathon hardening through automated IoT cold-chain telemetry and mobile financial escrow.',
    contentMarkdown: `### Phased Delivery Timeline

- **Short Term (Immediate / v1.x)**:
  - Live \`/docs\` access-controlled Pitch Deck & Technical Documentation system
  - Automated Dexie.js offline-first admin operations across all core entities
- **Mid Term (Q1–Q2 2027)**:
  - Automated **bKash / Nagad / SSLCommerz** escrow payout webhooks
  - Direct MQTT / Webhook ingestion from refrigerated truck temperature sensors
- **Long Term (2027+)**:
  - Predictive regional spoilage & demand forecasting across 64 districts
  - Cross-border phytosanitary & export compliance packs`,
    highlights: [
      'Short-term focus on zero-downtime reliability & judge transparency',
      'Mid-term financial & IoT automation loops',
      'Long-term nationwide predictive agro-logistics graph'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'tech-performance',
    slug: 'tech-performance',
    code: 'K',
    group: 'operations',
    order: 22,
    title: 'Performance & Scalability Strategy',
    subtitle: 'Section K · Rendering Speed, Bundle Splitting & Sync Efficiency',
    summary:
      'Lazy route code splitting keeps public landing latency minimal, while local IndexedDB hydration ensures Admin and Docs views render instantaneously.',
    contentMarkdown: `### Engineering Benchmarks & Optimizations

- **Code-Split Route Architecture**: Heavy consoles (\`AdminPanel\`, \`DocsPage\`, \`MarketplacePage\`) load via \`React.lazy()\` + \`Suspense\` only when navigated.
- **Zero-Blocking Local Hydration**: Admin Console renders directly from IndexedDB immediately on mount while live API calls resolve asynchronously in the background.
- **Batched FIFO Sync & Memoized Filtering**: Client-side search, table pagination, and \`useMemo\` KPI calculations prevent unnecessary DOM thrashing even at 1,000+ cached batches.`,
    highlights: [
      'Instant UI readiness from IndexedDB even on slow 2G/3G links',
      'Coalesced sync batches reduce API payloads by 40–70% during bursts',
      'Clean Tailwind v4 utility CSS keeps stylesheet footprint small'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'tech-security',
    slug: 'tech-security',
    code: 'L',
    group: 'operations',
    order: 23,
    title: 'Security, RBAC & Access Governance',
    subtitle: 'Section L · Authentication, Origin Control & Docs Access Scheduling',
    summary:
      'Defense-in-depth security pairing PDO prepared queries, strict CORS origin allowlisting, RBAC route guards, and time-windowed `/docs` publishing controls.',
    contentMarkdown: `### Security Architecture

- **Role-Based Access Control (RBAC)**: Strict \`ProtectedAdminRoute\` and PHP session checks enforce role boundaries across \`admin\`, \`farmer\`, \`supplier\`, and \`buyer\`.
- **Cross-Origin Session Hardening**: Dynamic origin allowlist validates exact origins + \`https://*.vercel.app\` previews when enabled, pairing \`SameSite=None\` with \`Secure\` cookies over HTTPS.
- **Documentation Access Governance**: \`/docs\` checks master visibility, active Start/End windows (default: **June 10 00:00 → June 14 23:59**), and duration timers before exposing pitch/architecture internals to non-admin visitors.`,
    highlights: [
      'Prepared PDO statements eliminate SQL injection vectors',
      'XSS-safe HTML escaping inside PDF report generators',
      'Admin instant override & schedule controls protect showcase materials'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'tech-analytics',
    slug: 'tech-analytics',
    code: 'M',
    group: 'operations',
    order: 24,
    title: 'Analytics & Operational KPIs',
    subtitle: 'Section M · Real-Time Usage Metrics & Supply-Chain Indicators',
    summary:
      'Live operational metrics derived directly from active harvest batches, order value, cold-chain utilization, and synchronization queue health.',
    contentMarkdown: `### Key Performance Indicators Monitored

- **Trade Liquidity**: Active harvest batches, cumulative available stock units, total BDT inventory value, and Gross Merchandise Volume (GMV).
- **Supply Quality**: Verified farmer KYC rate (%), organic batch ratio, and cold-chain temperature compliance.
- **System Reliability**: IndexedDB cache hit rate, pending sync queue depth, and resolved vs. unresolved edit conflicts.`,
    highlights: [
      'Real-time calculations backed by live Dexie + PHP API state',
      'Exportable PDF & CSV compliance snapshots',
      'Immediate alert indicators for low stock or thermal anomalies'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'tech-team-ref',
    slug: 'tech-team-ref',
    code: 'N',
    group: 'operations',
    order: 25,
    title: 'Team & Contributors Directory',
    subtitle: 'Section N · Synchronized Team Registry & Contact Points',
    summary:
      'Directly linked to the Team Registry in Slide 11, providing uniform profile cards, system ownership roles, and direct contributor contact addresses.',
    contentMarkdown: `### Ownership & Maintainer Directory

All contributor profiles, roles, email addresses, and portraits below sync dynamically with the **Team Showcase** configured in the Admin Docs Studio.`,
    highlights: [
      'Uniform 1:1 portrait framing with resilient monogram fallback',
      'Direct one-click contributor email links',
      'Managed dynamically without code redeploys'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  },
  {
    id: 'tech-changelog',
    slug: 'tech-changelog',
    code: 'O',
    group: 'operations',
    order: 26,
    title: 'Changelog & Release History',
    subtitle: 'Section O · Audited Platform Evolution Log',
    summary:
      'Chronological record of AgriHub architectural milestones, production hardening updates, and documentation snapshots.',
    contentMarkdown: `### Platform Release Log

- **v1.3.0 — Live /docs Pitch Deck & Technical Documentation System**: Added access-controlled \`/docs\` portal, June 10–14 default showcase scheduler, instant admin visibility override, uniform Team Showcase, interactive Architecture & Data Flow SVG/Mermaid diagrams, live telemetry sync, WYSIWYG editor with drag/drop reordering, versioning, and Markdown/PDF exports.
- **v1.2.0 — Offline-First Admin & Vercel Production Refactor**: Integrated Dexie.js IndexedDB persistence, FIFO sync queue with \`X-Idempotency-Key\`, 3-way conflict resolution, cross-origin CORS/cookie hardening, and Vercel serverless routes.
- **v1.1.0 — Bilingual Marketplace & PDF Invoicing**: Launched English / বাংলা switcher, Trade Cart checkout, branded BDT PDF invoices, and Gemini AI Trade Assistant.
- **v1.0.0 — Core PHP & MySQL Trade Network**: Released initial multi-role portals, MySQL schema, and cold-chain shipment tracking.`,
    highlights: [
      'Every published Docs Studio snapshot is recorded in Version History',
      'Admins can roll back documentation state to prior versions anytime',
      'Full traceability between platform releases and live features'
    ],
    visible: true,
    status: 'published',
    diagramType: 'none',
    updatedAt: NOW_ISO
  }
];

export const DEFAULT_DOCS_STATE: DocsDocumentState = {
  id: 'primary_v2',
  access: DEFAULT_DOCS_ACCESS,
  team: DEFAULT_TEAM_CONFIG,
  sections: DEFAULT_DOCS_SECTIONS,
  publishStatus: 'published',
  currentVersion: 'v1.3.0',
  lastPublishedAt: NOW_ISO,
  lastEditedAt: NOW_ISO,
  versions: [
    {
      id: 'ver-1.3.0',
      version: 'v1.3.0',
      label: 'CloudCamp Live /docs & Offline-First Release',
      publishedAt: NOW_ISO,
      author: 'System Administrator',
      summary:
        'Initial release of unified YC Pitch Deck, Technical Whitepaper, Access Scheduler (Jun 10–14 default), and Team Showcase.',
      sections: DEFAULT_DOCS_SECTIONS,
      team: DEFAULT_TEAM_CONFIG
    }
  ]
};
