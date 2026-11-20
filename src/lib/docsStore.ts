import {
  DEFAULT_DOCS_STATE,
  DEFAULT_SCHEDULE_END,
  DEFAULT_SCHEDULE_START
} from '../data/defaultDocsData';
import type {
  DocsAccessConfig,
  DocsAccessEvaluation,
  DocsDocumentState,
  LiveDocsMetrics
} from '../types/docs';
import { addSyncLog, offlineDb } from './offlineDb';

const LOCAL_STORAGE_DOCS_KEY = 'agrihub_docs_state_v2';
const DOCS_RECORD_ID = 'primary_v2';

function formatReadableWindow(startIso: string, endIso: string): string {
  const fmt = (raw: string) => {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };
  return `${fmt(startIso)} → ${fmt(endIso)}`;
}

/**
 * Evaluates whether public visitors can access `/docs` right now based on:
 * 1. Master visibility switch (ON / OFF)
 * 2. Access mode: manual_on | manual_off | scheduled | duration
 * Default schedule is June 10 (00:00) -> June 14 (23:59).
 */
export function evaluateDocsAccess(
  access: DocsAccessConfig,
  nowDate: Date = new Date()
): DocsAccessEvaluation {
  if (!access.visibilityEnabled || access.accessMode === 'manual_off') {
    return {
      allowed: false,
      reason: 'manual_off',
      statusLabel: 'Disabled by Administrator',
      windowSummary: 'Public access manually disabled'
    };
  }

  if (access.accessMode === 'manual_on') {
    return {
      allowed: true,
      reason: 'manual_on',
      statusLabel: 'Public (Instant Override ON)',
      windowSummary: 'Always accessible until disabled or switched to schedule'
    };
  }

  if (access.accessMode === 'duration') {
    const startedMs = new Date(access.durationStartedAt || nowDate.toISOString()).getTime();
    const hours = Math.max(1, Number(access.durationHours || 24));
    const endMs = startedMs + hours * 3600 * 1000;
    const nowMs = nowDate.getTime();
    const windowSummary = `${hours}h window (${new Date(startedMs).toLocaleString()} → ${new Date(endMs).toLocaleString()})`;

    if (nowMs >= startedMs && nowMs <= endMs) {
      return {
        allowed: true,
        reason: 'duration_active',
        statusLabel: `Public (${hours}h Duration Active)`,
        windowSummary
      };
    }

    return {
      allowed: false,
      reason: 'duration_expired',
      statusLabel: 'Duration Window Expired',
      windowSummary
    };
  }

  // Default: 'scheduled' (June 10 00:00 -> June 14 23:59)
  const startStr = access.scheduleStart || DEFAULT_SCHEDULE_START;
  const endStr = access.scheduleEnd || DEFAULT_SCHEDULE_END;
  const startMs = new Date(startStr).getTime();
  const endMs = new Date(endStr).getTime();
  const nowMs = nowDate.getTime();
  const windowSummary = formatReadableWindow(startStr, endStr);

  if (!Number.isNaN(startMs) && nowMs < startMs) {
    return {
      allowed: false,
      reason: 'scheduled_before',
      statusLabel: 'Scheduled (Opens Later)',
      windowSummary
    };
  }

  if (!Number.isNaN(endMs) && nowMs > endMs) {
    return {
      allowed: false,
      reason: 'scheduled_after',
      statusLabel: 'Scheduled Window Ended',
      windowSummary
    };
  }

  return {
    allowed: true,
    reason: 'scheduled_active',
    statusLabel: 'Public (Scheduled Window Active)',
    windowSummary
  };
}

export async function loadDocsState(): Promise<DocsDocumentState> {
  try {
    const stored = await offlineDb.docsState.get(DOCS_RECORD_ID);
    if (stored && Array.isArray(stored.sections) && stored.sections.length > 0) {
      return stored;
    }
  } catch {
    // Fallback to localStorage below
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DOCS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DocsDocumentState;
      if (parsed && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
        await offlineDb.docsState.put({ ...parsed, id: DOCS_RECORD_ID }).catch(() => {});
        return parsed;
      }
    }
  } catch {
    // Use default seed
  }

  await offlineDb.docsState.put({ ...DEFAULT_DOCS_STATE, id: DOCS_RECORD_ID }).catch(() => {});
  try {
    localStorage.setItem(
      LOCAL_STORAGE_DOCS_KEY,
      JSON.stringify({ ...DEFAULT_DOCS_STATE, id: DOCS_RECORD_ID })
    );
  } catch {}
  return { ...DEFAULT_DOCS_STATE, id: DOCS_RECORD_ID };
}

export async function persistDocsState(
  nextState: DocsDocumentState,
  logAction?: string,
  logMessage?: string
): Promise<DocsDocumentState> {
  const stamped: DocsDocumentState = {
    ...nextState,
    id: DOCS_RECORD_ID,
    lastEditedAt: new Date().toISOString()
  };

  try {
    await offlineDb.docsState.put(stamped);
  } catch {
    // Ignore IndexedDB quota issues
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_DOCS_KEY, JSON.stringify(stamped));
  } catch {
    // Ignore localStorage quota issues
  }

  if (logAction && logMessage) {
    await addSyncLog({
      level: 'info',
      action: logAction,
      entityType: 'system',
      message: logMessage
    });
  }

  return stamped;
}

export function exportDocsToMarkdown(
  state: DocsDocumentState,
  metrics: LiveDocsMetrics
): string {
  const sortedSections = [...state.sections]
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  const lines: string[] = [
    `# AgriHub — YC Pitch Deck & Live Technical Documentation`,
    ``,
    `- **Version**: ${state.currentVersion}`,
    `- **Published**: ${new Date(state.lastPublishedAt).toUTCString()}`,
    `- **Team**: ${state.team.teamName}`,
    ``,
    `## Live Platform Snapshot`,
    `- Active Harvest Batches: ${metrics.activeProductsCount} (${metrics.totalStockUnits.toLocaleString()} units)`,
    `- Registered Network Members: ${metrics.usersCount} (${metrics.verifiedFarmersCount} verified farmers)`,
    `- Trade Orders & GMV: ${metrics.ordersCount} orders (BDT ${metrics.totalGmvBdt.toLocaleString()})`,
    `- Active Cold-Chain Shipments: ${metrics.activeShipmentsCount} / ${metrics.shipmentsCount}`,
    `- Offline Sync Queue: ${metrics.pendingSyncCount} pending (${metrics.syncStatusLabel})`,
    ``,
    `---`,
    ``
  ];

  for (const sec of sortedSections) {
    lines.push(`## ${sec.code}. ${sec.title}`);
    lines.push(`*${sec.subtitle}*`);
    lines.push(``);
    lines.push(`> ${sec.summary}`);
    lines.push(``);
    lines.push(sec.contentMarkdown);
    if (sec.highlights.length > 0) {
      lines.push(``);
      lines.push(`**Key Highlights:**`);
      for (const h of sec.highlights) {
        lines.push(`- ${h}`);
      }
    }
    if (sec.diagramCode) {
      lines.push(``);
      lines.push('```mermaid');
      lines.push(sec.diagramCode);
      lines.push('```');
    }
    if (sec.slug === 'pitch-team' || sec.slug === 'tech-team-ref') {
      lines.push(``);
      lines.push(`### ${state.team.teamName}`);
      for (const m of state.team.members) {
        lines.push(`- **${m.fullName}** — ${m.role} (${m.email})`);
      }
    }
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  return lines.join('\n');
}

export async function exportDocsToPdf(
  state: DocsDocumentState,
  metrics: LiveDocsMetrics
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 46;
  const maxWidth = pageWidth - margin * 2;
  let y = 54;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 54) {
      pdf.addPage();
      y = 54;
    }
  };

  // Cover Header
  pdf.setFillColor(4, 120, 87);
  pdf.rect(0, 0, pageWidth, 112, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.text('AgriHub — Pitch Deck & Technical Documentation', margin, 48);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10.5);
  pdf.text(
    `Version ${state.currentVersion}  |  Live Platform Snapshot  |  ${state.team.teamName}`,
    margin,
    72
  );
  pdf.text(`Generated ${new Date().toLocaleString()}`, margin, 90);

  y = 138;
  pdf.setTextColor(15, 23, 42);

  // Live Telemetry Box
  pdf.setFillColor(240, 246, 242);
  pdf.roundedRect(margin, y, maxWidth, 64, 8, 8, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('LIVE SYSTEM TELEMETRY', margin + 14, y + 20);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.text(
    `Batches: ${metrics.activeProductsCount}   Stock: ${metrics.totalStockUnits.toLocaleString()} units   Members: ${metrics.usersCount}   Orders: ${metrics.ordersCount}   GMV: BDT ${metrics.totalGmvBdt.toLocaleString()}`,
    margin + 14,
    y + 42
  );
  y += 88;

  const sortedSections = [...state.sections]
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  for (const sec of sortedSections) {
    ensureSpace(88);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(4, 120, 87);
    pdf.text(`${sec.code}. ${sec.title}`, margin, y);
    y += 16;

    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(sec.subtitle, margin, y);
    y += 16;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(30, 41, 59);
    const summaryLines = pdf.splitTextToSize(sec.summary, maxWidth);
    ensureSpace(summaryLines.length * 14 + 12);
    pdf.text(summaryLines, margin, y);
    y += summaryLines.length * 14 + 6;

    const cleanBody = sec.contentMarkdown
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^###?\s+/gm, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .trim();

    if (cleanBody) {
      const bodyLines = pdf.splitTextToSize(cleanBody, maxWidth);
      for (const line of bodyLines) {
        ensureSpace(14);
        pdf.text(line, margin, y);
        y += 13;
      }
    }

    if (sec.slug === 'pitch-team' || sec.slug === 'tech-team-ref') {
      y += 6;
      for (const m of state.team.members) {
        ensureSpace(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`• ${m.fullName} — ${m.role} (${m.email})`, margin + 8, y);
        pdf.setFont('helvetica', 'normal');
        y += 14;
      }
    }

    y += 14;
    pdf.setDrawColor(220, 231, 224);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 18;
  }

  pdf.save(`AgriHub-Docs-${state.currentVersion}.pdf`);
}

/**
 * Resizes an uploaded image File cleanly into a square 256x256 JPEG data URL
 * so all Team Profile Pictures share identical aspect ratio and lightweight storage.
 */
export function resizeImageToUniformSquare(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
