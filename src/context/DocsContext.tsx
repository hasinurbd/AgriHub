import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  DEFAULT_DOCS_ACCESS,
  DEFAULT_DOCS_STATE,
  DEFAULT_SCHEDULE_END,
  DEFAULT_SCHEDULE_START
} from '../data/defaultDocsData';
import {
  evaluateDocsAccess,
  loadDocsState,
  persistDocsState
} from '../lib/docsStore';
import type {
  DocSectionItem,
  DocsAccessConfig,
  DocsAccessEvaluation,
  DocsDocumentState,
  TeamConfig
} from '../types/docs';
import { useAuth } from './AuthContext';

interface DocsContextValue {
  docsState: DocsDocumentState;
  loading: boolean;
  accessEvaluation: DocsAccessEvaluation;
  hasUnsavedDraft: boolean;
  updateAccessConfig: (
    updates: Partial<DocsAccessConfig>,
    auditMessage?: string
  ) => Promise<void>;
  resetToDefaultJuneWindow: () => Promise<void>;
  updateTeamConfig: (nextTeam: TeamConfig) => Promise<void>;
  updateSection: (
    sectionId: string,
    updates: Partial<DocSectionItem>
  ) => Promise<void>;
  addSection: (
    partial: Pick<DocSectionItem, 'title' | 'subtitle' | 'summary' | 'contentMarkdown' | 'group' | 'code'> &
      Partial<DocSectionItem>
  ) => Promise<DocSectionItem>;
  deleteSection: (sectionId: string) => Promise<void>;
  reorderSections: (orderedIds: string[]) => Promise<void>;
  saveDraft: () => Promise<void>;
  publishVersion: (label: string, summary: string) => Promise<void>;
  rollbackVersion: (versionId: string) => Promise<void>;
  resetAllDocsToDefault: () => Promise<void>;
}

const DocsContext = createContext<DocsContextValue | undefined>(undefined);

function bumpPatchVersion(current: string): string {
  const match = current.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return 'v1.3.1';
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]) + 1;
  return `v${major}.${minor}.${patch}`;
}

export function DocsProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [docsState, setDocsState] = useState<DocsDocumentState>(DEFAULT_DOCS_STATE);
  const docsStateRef = useRef<DocsDocumentState>(DEFAULT_DOCS_STATE);
  const [loading, setLoading] = useState<boolean>(true);
  const [nowTick, setNowTick] = useState<Date>(() => new Date());

  useEffect(() => {
    let active = true;
    loadDocsState()
      .then((loaded) => {
        if (active) {
          docsStateRef.current = loaded;
          setDocsState(loaded);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Re-evaluate time-windowed schedules once per 30s
  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTick(new Date());
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const accessEvaluation = useMemo(
    () => evaluateDocsAccess(docsState.access, nowTick),
    [docsState.access, nowTick]
  );

  const actorName = currentUser?.full_name || currentUser?.email || 'Administrator';

  const commitState = useCallback(
    async (
      updater: (prev: DocsDocumentState) => DocsDocumentState,
      logAction?: string,
      logMessage?: string
    ) => {
      const nextSnapshot = updater(docsStateRef.current);
      docsStateRef.current = nextSnapshot;
      setDocsState(nextSnapshot);
      await persistDocsState(nextSnapshot, logAction, logMessage);
    },
    []
  );

  const updateAccessConfig = useCallback(
    async (updates: Partial<DocsAccessConfig>, auditMessage?: string) => {
      const nowIso = new Date().toISOString();
      await commitState(
        (prev) => ({
          ...prev,
          access: {
            ...prev.access,
            ...updates,
            updatedAt: nowIso,
            updatedBy: actorName
          }
        }),
        'DOCS_ACCESS_UPDATED',
        auditMessage || `Updated /docs access mode (${updates.accessMode || 'visibility'})`
      );
      setNowTick(new Date());
    },
    [actorName, commitState]
  );

  const resetToDefaultJuneWindow = useCallback(async () => {
    await updateAccessConfig(
      {
        visibilityEnabled: true,
        accessMode: 'scheduled',
        scheduleStart: DEFAULT_SCHEDULE_START,
        scheduleEnd: DEFAULT_SCHEDULE_END,
        restrictedTitle: DEFAULT_DOCS_ACCESS.restrictedTitle,
        restrictedMessage: DEFAULT_DOCS_ACCESS.restrictedMessage
      },
      'Reset /docs schedule to default showcase window (June 10 00:00 → June 14 23:59)'
    );
  }, [updateAccessConfig]);

  const updateTeamConfig = useCallback(
    async (nextTeam: TeamConfig) => {
      await commitState(
        (prev) => ({
          ...prev,
          publishStatus: 'draft',
          team: nextTeam
        }),
        'DOCS_TEAM_UPDATED',
        `Updated /docs team roster (${nextTeam.members.length} members)`
      );
    },
    [commitState]
  );

  const updateSection = useCallback(
    async (sectionId: string, updates: Partial<DocSectionItem>) => {
      const nowIso = new Date().toISOString();
      await commitState(
        (prev) => ({
          ...prev,
          publishStatus: 'draft',
          sections: prev.sections.map((sec) =>
            sec.id === sectionId
              ? {
                  ...sec,
                  ...updates,
                  updatedAt: nowIso
                }
              : sec
          )
        }),
        'DOCS_SECTION_EDITED',
        `Edited documentation section ${sectionId}`
      );
    },
    [commitState]
  );

  const addSection = useCallback(
    async (
      partial: Pick<
        DocSectionItem,
        'title' | 'subtitle' | 'summary' | 'contentMarkdown' | 'group' | 'code'
      > &
        Partial<DocSectionItem>
    ): Promise<DocSectionItem> => {
      const nowIso = new Date().toISOString();
      const maxOrder = docsState.sections.reduce((m, s) => Math.max(m, s.order), 0);
      const slugBase = partial.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 36);
      const id = `sec-${Date.now()}`;
      const created: DocSectionItem = {
        id,
        slug: partial.slug || `${slugBase || 'custom'}-${maxOrder + 1}`,
        code: partial.code || String(maxOrder + 1).padStart(2, '0'),
        group: partial.group,
        order: maxOrder + 1,
        title: partial.title,
        subtitle: partial.subtitle,
        summary: partial.summary,
        contentMarkdown: partial.contentMarkdown,
        highlights: partial.highlights || [],
        visible: partial.visible ?? true,
        status: 'draft',
        diagramType: partial.diagramType || 'none',
        diagramCode: partial.diagramCode,
        updatedAt: nowIso
      };

      await commitState(
        (prev) => ({
          ...prev,
          publishStatus: 'draft',
          sections: [...prev.sections, created]
        }),
        'DOCS_SECTION_ADDED',
        `Added custom section "${created.title}"`
      );
      return created;
    },
    [commitState, docsState.sections]
  );

  const deleteSection = useCallback(
    async (sectionId: string) => {
      await commitState(
        (prev) => ({
          ...prev,
          publishStatus: 'draft',
          sections: prev.sections
            .filter((s) => s.id !== sectionId)
            .map((s, idx) => ({ ...s, order: idx + 1 }))
        }),
        'DOCS_SECTION_DELETED',
        `Removed section ${sectionId}`
      );
    },
    [commitState]
  );

  const reorderSections = useCallback(
    async (orderedIds: string[]) => {
      await commitState(
        (prev) => {
          const map = new Map<string, DocSectionItem>(
            prev.sections.map((s) => [s.id, s])
          );
          const reordered: DocSectionItem[] = [];
          orderedIds.forEach((id, idx) => {
            const item = map.get(id);
            if (item) {
              reordered.push({ ...item, order: idx + 1 });
              map.delete(id);
            }
          });
          // Preserve any leftover sections safely
          for (const leftover of map.values()) {
            reordered.push({ ...leftover, order: reordered.length + 1 });
          }
          return {
            ...prev,
            publishStatus: 'draft',
            sections: reordered
          };
        },
        'DOCS_SECTIONS_REORDERED',
        `Reordered ${orderedIds.length} documentation sections`
      );
    },
    [commitState]
  );

  const saveDraft = useCallback(async () => {
    await commitState(
      (prev) => ({
        ...prev,
        publishStatus: 'draft'
      }),
      'DOCS_DRAFT_SAVED',
      `Saved /docs draft (${docsState.currentVersion})`
    );
  }, [commitState, docsState.currentVersion]);

  const publishVersion = useCallback(
    async (label: string, summary: string) => {
      const nowIso = new Date().toISOString();
      await commitState(
        (prev) => {
          const nextVersion = bumpPatchVersion(prev.currentVersion);
          const publishedSections: DocSectionItem[] = prev.sections.map((s) => ({
            ...s,
            status: 'published',
            updatedAt: nowIso
          }));
          const snapshot = {
            id: `ver-${Date.now()}`,
            version: nextVersion,
            label: label.trim() || `Release ${nextVersion}`,
            publishedAt: nowIso,
            author: actorName,
            summary: summary.trim() || 'Published documentation & pitch deck snapshot',
            sections: publishedSections,
            team: prev.team
          };
          return {
            ...prev,
            publishStatus: 'published',
            currentVersion: nextVersion,
            lastPublishedAt: nowIso,
            sections: publishedSections,
            versions: [snapshot, ...prev.versions].slice(0, 20)
          };
        },
        'DOCS_PUBLISHED',
        `Published /docs snapshot (${label || 'new release'})`
      );
    },
    [actorName, commitState]
  );

  const rollbackVersion = useCallback(
    async (versionId: string) => {
      const nowIso = new Date().toISOString();
      await commitState(
        (prev) => {
          const found = prev.versions.find((v) => v.id === versionId);
          if (!found) return prev;
          return {
            ...prev,
            publishStatus: 'published',
            currentVersion: found.version,
            lastPublishedAt: nowIso,
            sections: found.sections.map((s) => ({ ...s })),
            team: {
              ...found.team,
              members: found.team.members.map((m) => ({ ...m }))
            }
          };
        },
        'DOCS_VERSION_ROLLBACK',
        `Rolled back /docs to snapshot ${versionId}`
      );
    },
    [commitState]
  );

  const resetAllDocsToDefault = useCallback(async () => {
    await commitState(
      () => ({
        ...DEFAULT_DOCS_STATE,
        lastEditedAt: new Date().toISOString()
      }),
      'DOCS_RESET_DEFAULT',
      'Restored default YC pitch deck, technical whitepaper, team roster, and June 10–14 schedule'
    );
    setNowTick(new Date());
  }, [commitState]);

  const hasUnsavedDraft =
    docsState.publishStatus === 'draft' ||
    docsState.sections.some((s) => s.status === 'draft');

  const value = useMemo<DocsContextValue>(
    () => ({
      docsState,
      loading,
      accessEvaluation,
      hasUnsavedDraft,
      updateAccessConfig,
      resetToDefaultJuneWindow,
      updateTeamConfig,
      updateSection,
      addSection,
      deleteSection,
      reorderSections,
      saveDraft,
      publishVersion,
      rollbackVersion,
      resetAllDocsToDefault
    }),
    [
      docsState,
      loading,
      accessEvaluation,
      hasUnsavedDraft,
      updateAccessConfig,
      resetToDefaultJuneWindow,
      updateTeamConfig,
      updateSection,
      addSection,
      deleteSection,
      reorderSections,
      saveDraft,
      publishVersion,
      rollbackVersion,
      resetAllDocsToDefault
    ]
  );

  return <DocsContext.Provider value={value}>{children}</DocsContext.Provider>;
}

export function useDocs(): DocsContextValue {
  const ctx = useContext(DocsContext);
  if (!ctx) {
    throw new Error('useDocs must be used within a DocsProvider');
  }
  return ctx;
}
