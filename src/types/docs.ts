export type DocsAccessMode = 'manual_on' | 'manual_off' | 'scheduled' | 'duration';

export interface DocsAccessConfig {
  visibilityEnabled: boolean;
  accessMode: DocsAccessMode;
  scheduleStart: string; // ISO local datetime string e.g. '2026-06-10T00:00'
  scheduleEnd: string;   // ISO local datetime string e.g. '2026-06-14T23:59'
  durationHours: number;
  durationStartedAt: string; // ISO timestamp
  restrictedTitle: string;
  restrictedMessage: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TeamMember {
  id: string;
  fullName: string;
  role: string;
  email: string;
  avatarUrl: string;
  bio?: string;
}

export interface TeamConfig {
  teamName: string;
  teamTagline: string;
  members: TeamMember[];
}

export type DocSectionGroup = 'pitch' | 'technical' | 'operations';

export type DocDiagramType = 'none' | 'architecture_svg' | 'dataflow_svg' | 'mermaid';

export interface DocSectionItem {
  id: string;
  slug: string;
  code: string; // e.g. '01', 'A1', 'B', 'C'
  group: DocSectionGroup;
  order: number;
  title: string;
  subtitle: string;
  summary: string;
  contentMarkdown: string;
  highlights: string[];
  visible: boolean;
  status: 'published' | 'draft';
  diagramType: DocDiagramType;
  diagramCode?: string;
  updatedAt: string;
}

export interface DocsVersionSnapshot {
  id: string;
  version: string;
  label: string;
  publishedAt: string;
  author: string;
  summary: string;
  sections: DocSectionItem[];
  team: TeamConfig;
}

export interface DocsDocumentState {
  id: string; // singleton key 'primary'
  access: DocsAccessConfig;
  team: TeamConfig;
  sections: DocSectionItem[];
  publishStatus: 'published' | 'draft';
  currentVersion: string;
  lastPublishedAt: string;
  lastEditedAt: string;
  versions: DocsVersionSnapshot[];
}

export interface DocsAccessEvaluation {
  allowed: boolean;
  reason:
    | 'manual_on'
    | 'manual_off'
    | 'scheduled_active'
    | 'scheduled_before'
    | 'scheduled_after'
    | 'duration_active'
    | 'duration_expired';
  statusLabel: string;
  windowSummary: string;
}

export interface LiveDocsMetrics {
  productsCount: number;
  activeProductsCount: number;
  totalStockUnits: number;
  totalInventoryValueBdt: number;
  categoriesCount: number;
  usersCount: number;
  verifiedFarmersCount: number;
  buyersCount: number;
  suppliersCount: number;
  ordersCount: number;
  totalGmvBdt: number;
  shipmentsCount: number;
  activeShipmentsCount: number;
  warehousesCount: number;
  pendingSyncCount: number;
  syncStatusLabel: string;
  backendReachable: boolean;
  lastCheckedAt: string;
}
