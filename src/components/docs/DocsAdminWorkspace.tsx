import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bold,
  CalendarClock,
  Check,
  Code,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Heading3,
  History,
  ImagePlus,
  Italic,
  Link2,
  List,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Table,
  Trash2,
  Unlock,
  Users,
  ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDocs } from '../../context/DocsContext';
import { resizeImageToUniformSquare } from '../../lib/docsStore';
import type {
  DocDiagramType,
  DocSectionGroup,
  DocSectionItem,
  DocsAccessMode,
  TeamMember
} from '../../types/docs';
import DocsMarkdownRenderer from './DocsMarkdownRenderer';
import DocsDiagrams from './DocsDiagrams';
import TeamShowcaseGrid from './TeamShowcaseGrid';

interface DocsAdminWorkspaceProps {
  embeddedOnDocsPage?: boolean;
  onCloseDrawer?: () => void;
}

type StudioTab = 'access' | 'sections' | 'team' | 'versions';

export default function DocsAdminWorkspace({
  embeddedOnDocsPage = false,
  onCloseDrawer
}: DocsAdminWorkspaceProps) {
  const {
    docsState,
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
  } = useDocs();

  const [studioTab, setStudioTab] = useState<StudioTab>('access');
  const sortedSections = [...docsState.sections].sort((a, b) => a.order - b.order);
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    sortedSections[0]?.id || 'pitch-problem'
  );
  const [previewSplit, setPreviewSplit] = useState<boolean>(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string>('');

  // New Section quick state
  const [showNewSectionForm, setShowNewSectionForm] = useState(false);
  const [newSecTitle, setNewSecTitle] = useState('');
  const [newSecGroup, setNewSecGroup] = useState<DocSectionGroup>('technical');
  const [newSecCode, setNewSecCode] = useState('P');
  const [newSecSummary, setNewSecSummary] = useState('');

  // Publish modal/form state
  const [pubLabel, setPubLabel] = useState('');
  const [pubSummary, setPubSummary] = useState('');

  // Team member creation state
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberBio, setNewMemberBio] = useState('');
  const [newMemberAvatar, setNewMemberAvatar] = useState('');
  const [uploadingMemberId, setUploadingMemberId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const notify = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? '' : curr));
    }, 3200);
  };

  const activeSection: DocSectionItem | undefined =
    sortedSections.find((s) => s.id === selectedSectionId) || sortedSections[0];

  const insertMarkdownSnippet = (before: string, after = '', placeholder = 'text') => {
    if (!activeSection) return;
    const el = textareaRef.current;
    const current = activeSection.contentMarkdown;
    if (!el) {
      updateSection(activeSection.id, {
        contentMarkdown: `${current}\n${before}${placeholder}${after}`
      });
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const selected = current.slice(start, end) || placeholder;
    const next =
      current.slice(0, start) + before + selected + after + current.slice(end);
    updateSection(activeSection.id, { contentMarkdown: next });
    window.requestAnimationFrame(() => {
      el.focus();
      const cursorPos = start + before.length + selected.length;
      el.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const handleDropReorder = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const ids = sortedSections.map((s) => s.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedId(null);
      return;
    }
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);
    setDraggedId(null);
    await reorderSections(ids);
    notify('Section order updated.');
  };

  const handleMoveStep = async (sectionId: string, dir: -1 | 1) => {
    const ids = sortedSections.map((s) => s.id);
    const idx = ids.indexOf(sectionId);
    const nextIdx = idx + dir;
    if (idx === -1 || nextIdx < 0 || nextIdx >= ids.length) return;
    const [item] = ids.splice(idx, 1);
    ids.splice(nextIdx, 0, item);
    await reorderSections(ids);
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecTitle.trim()) return;
    const created = await addSection({
      title: newSecTitle.trim(),
      code: newSecCode.trim() || 'EXT',
      group: newSecGroup,
      subtitle: `${newSecGroup.toUpperCase()} · Custom Documentation Section`,
      summary:
        newSecSummary.trim() ||
        'Custom technical specification or investor note maintained in Admin Studio.',
      contentMarkdown: `### Overview\n\nWrite detailed specification, benchmarks, or workflow notes here.`,
      highlights: ['Maintained live inside AgriHub Docs Studio']
    });
    setSelectedSectionId(created.id);
    setNewSecTitle('');
    setNewSecSummary('');
    setShowNewSectionForm(false);
    notify(`Created section "${created.title}".`);
  };

  const handleTeamMemberImageUpload = async (
    memberId: string,
    file: File | undefined
  ) => {
    if (!file) return;
    setUploadingMemberId(memberId);
    try {
      const squareDataUrl = await resizeImageToUniformSquare(file, 256);
      if (memberId === '__new__') {
        setNewMemberAvatar(squareDataUrl);
      } else {
        const nextMembers = docsState.team.members.map((m) =>
          m.id === memberId ? { ...m, avatarUrl: squareDataUrl } : m
        );
        await updateTeamConfig({ ...docsState.team, members: nextMembers });
      }
      notify('Portrait auto-cropped to uniform 256×256 1:1 square.');
    } catch {
      notify('Could not process image file. Try PNG or JPG.');
    } finally {
      setUploadingMemberId(null);
    }
  };

  const handleAddTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberRole.trim() || !newMemberEmail.trim()) {
      return;
    }
    const member: TeamMember = {
      id: `tm-${Date.now()}`,
      fullName: newMemberName.trim(),
      role: newMemberRole.trim(),
      email: newMemberEmail.trim(),
      avatarUrl: newMemberAvatar.trim(),
      bio: newMemberBio.trim() || undefined
    };
    await updateTeamConfig({
      ...docsState.team,
      members: [...docsState.team.members, member]
    });
    setNewMemberName('');
    setNewMemberRole('');
    setNewMemberEmail('');
    setNewMemberBio('');
    setNewMemberAvatar('');
    notify(`Added ${member.fullName} to Team showcase.`);
  };

  const handleMemberFieldChange = (
    memberId: string,
    field: keyof TeamMember,
    value: string
  ) => {
    const nextMembers = docsState.team.members.map((m) =>
      m.id === memberId ? { ...m, [field]: value } : m
    );
    updateTeamConfig({ ...docsState.team, members: nextMembers });
  };

  const handleRemoveTeamMember = async (memberId: string) => {
    const nextMembers = docsState.team.members.filter((m) => m.id !== memberId);
    await updateTeamConfig({ ...docsState.team, members: nextMembers });
    notify('Removed team member.');
  };

  const handleModeChange = async (mode: DocsAccessMode) => {
    if (mode === 'manual_off') {
      await updateAccessConfig({ accessMode: 'manual_off', visibilityEnabled: false });
      notify('/docs locked (403 Not Available for public visitors).');
    } else if (mode === 'manual_on') {
      await updateAccessConfig({ accessMode: 'manual_on', visibilityEnabled: true });
      notify('/docs published immediately (Instant Override ON).');
    } else if (mode === 'duration') {
      await updateAccessConfig({
        accessMode: 'duration',
        visibilityEnabled: true,
        durationStartedAt: new Date().toISOString()
      });
      notify(`Started ${docsState.access.durationHours}h duration window.`);
    } else {
      await updateAccessConfig({ accessMode: 'scheduled', visibilityEnabled: true });
      notify('Switched to scheduled date/time window.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] font-mono">
            <span className="font-bold text-[#047857] dark:text-[#34d399]">
              /docs CMS &amp; ACCESS CONTROL
            </span>
            <span>·</span>
            <span>{docsState.currentVersion}</span>
            <span>·</span>
            <span>{hasUnsavedDraft ? 'Unpublished Edits (Draft)' : 'Synced & Published'}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-tight mt-1">
            AgriHub Pitch Deck &amp; Technical Documentation Studio
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {toastMsg && (
            <span className="text-xs font-semibold text-[#047857] dark:text-[#34d399] inline-flex items-center gap-1 mr-2">
              <Check className="w-3.5 h-3.5" />
              <span>{toastMsg}</span>
            </span>
          )}

          <button
            type="button"
            onClick={async () => {
              await saveDraft();
              notify('Draft saved to IndexedDB.');
            }}
            className="agri-btn agri-btn-secondary agri-btn-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              await publishVersion(
                pubLabel || `Showcase ${docsState.currentVersion}`,
                pubSummary || 'Published from Docs Studio'
              );
              setPubLabel('');
              setPubSummary('');
              notify('Published new live snapshot.');
            }}
            className="agri-btn agri-btn-primary agri-btn-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publish Changes</span>
          </button>

          {!embeddedOnDocsPage && (
            <Link to="/docs" className="agri-btn agri-btn-secondary agri-btn-sm">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open /docs</span>
            </Link>
          )}

          {onCloseDrawer && (
            <button
              type="button"
              onClick={onCloseDrawer}
              className="agri-btn agri-btn-secondary agri-btn-sm"
            >
              <span>Close Studio</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border-subtle)] pb-3">
        {(
          [
            ['access', 'Visibility & Schedule', CalendarClock],
            ['sections', `Sections & WYSIWYG (${docsState.sections.length})`, FileText],
            ['team', `Team Showcase (${docsState.team.members.length})`, Users],
            ['versions', `Version History (${docsState.versions.length})`, History]
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStudioTab(key)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition whitespace-nowrap shrink-0 ${
              studioTab === key
                ? 'bg-[#047857] text-white'
                : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ================= TAB 1: ACCESS CONTROL & SCHEDULING ================= */}
      {studioTab === 'access' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Master Switch & Modes */}
          <div className="lg:col-span-7 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--border-subtle)]">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
                  Public /docs Endpoint Gate
                </div>
                <div className="text-base font-bold text-[var(--text-primary)] mt-0.5 flex items-center gap-2">
                  {accessEvaluation.allowed ? (
                    <Unlock className="w-4 h-4 text-[#047857] dark:text-[#10b981]" />
                  ) : (
                    <Lock className="w-4 h-4 text-amber-600" />
                  )}
                  <span>{accessEvaluation.statusLabel}</span>
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1 tabular-nums">
                  Active rule: {accessEvaluation.windowSummary}
                </div>
              </div>

              {/* Master ON / OFF Switch */}
              <button
                type="button"
                onClick={() => {
                  const nextOn = !docsState.access.visibilityEnabled;
                  updateAccessConfig(
                    {
                      visibilityEnabled: nextOn,
                      accessMode: nextOn
                        ? docsState.access.accessMode === 'manual_off'
                          ? 'scheduled'
                          : docsState.access.accessMode
                        : 'manual_off'
                    },
                    nextOn ? 'Enabled /docs master visibility' : 'Disabled /docs master visibility'
                  );
                  notify(nextOn ? 'Master visibility ON.' : 'Master visibility OFF (403 locked).');
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition whitespace-nowrap shrink-0 ${
                  docsState.access.visibilityEnabled
                    ? 'bg-[#047857] text-white hover:bg-[#065f46]'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {docsState.access.visibilityEnabled ? 'Visibility: ON' : 'Visibility: OFF (403)'}
                </span>
              </button>
            </div>

            {/* Mode Selector */}
            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-2">
                Publishing Mode &amp; Override Control
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(
                  [
                    [
                      'scheduled',
                      'Scheduled Window',
                      'Public only inside configured Start → End dates & times.'
                    ],
                    [
                      'duration',
                      'Duration Publishing',
                      'Public for X hours from activation timestamp.'
                    ],
                    [
                      'manual_on',
                      'Instant Override: ON',
                      'Immediately public 24/7 regardless of schedule dates.'
                    ],
                    [
                      'manual_off',
                      'Instant Override: OFF',
                      'Immediately returns 403 / Not Available to visitors.'
                    ]
                  ] as Array<[DocsAccessMode, string, string]>
                ).map(([modeKey, title, desc]) => {
                  const active = docsState.access.accessMode === modeKey;
                  return (
                    <button
                      key={modeKey}
                      type="button"
                      onClick={() => handleModeChange(modeKey)}
                      className={`p-3.5 rounded-xl border text-left transition ${
                        active
                          ? 'border-[#047857] bg-[#d1fae5]/35 dark:bg-[#14251c]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] hover:border-[#10b981]/50'
                      }`}
                    >
                      <div className="text-xs font-bold text-[var(--text-primary)] flex items-center justify-between">
                        <span>{title}</span>
                        {active && <Check className="w-3.5 h-3.5 text-[#047857] dark:text-[#34d399]" />}
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                        {desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Schedule Start/End Window */}
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  Scheduled Availability Window
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await resetToDefaultJuneWindow();
                    notify('Restored default June 10 (00:00) → June 14 (23:59) schedule.');
                  }}
                  className="text-[11px] font-semibold text-[#047857] dark:text-[#34d399] hover:underline inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Default: June 10 (00:00) → June 14 (23:59)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Start Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    value={docsState.access.scheduleStart}
                    onChange={(e) =>
                      updateAccessConfig({
                        scheduleStart: e.target.value,
                        accessMode: 'scheduled',
                        visibilityEnabled: true
                      })
                    }
                    className="agri-input font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    End Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    value={docsState.access.scheduleEnd}
                    onChange={(e) =>
                      updateAccessConfig({
                        scheduleEnd: e.target.value,
                        accessMode: 'scheduled',
                        visibilityEnabled: true
                      })
                    }
                    className="agri-input font-mono tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* Duration-based publishing */}
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  Duration-Based Publishing (Quick Showcase Window)
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await updateAccessConfig({
                      visibilityEnabled: true,
                      accessMode: 'duration',
                      durationStartedAt: new Date().toISOString()
                    });
                    notify(`Activated ${docsState.access.durationHours}h duration window from now.`);
                  }}
                  className="agri-btn agri-btn-primary agri-btn-sm"
                >
                  <span>Start {docsState.access.durationHours}h Window Now</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {[6, 12, 24, 48, 72, 120].map((hrs) => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() =>
                      updateAccessConfig({
                        durationHours: hrs,
                        accessMode: 'duration',
                        visibilityEnabled: true,
                        durationStartedAt: new Date().toISOString()
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg border font-mono font-semibold tabular-nums transition ${
                      docsState.access.durationHours === hrs &&
                      docsState.access.accessMode === 'duration'
                        ? 'bg-[#047857] text-white border-[#047857]'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[#10b981]'
                    }`}
                  >
                    {hrs}h
                  </button>
                ))}
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-[11px] text-[var(--text-muted)]">Custom hrs:</span>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={docsState.access.durationHours}
                    onChange={(e) =>
                      updateAccessConfig({
                        durationHours: Math.max(1, Number(e.target.value) || 24)
                      })
                    }
                    className="agri-input w-20 font-mono tabular-nums"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Restricted Gate Copy & Audit Info */}
          <div className="lg:col-span-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              403 / Restricted Showcase Gate Copy
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Displayed to non-admin visitors on <code className="font-mono">/docs</code> when visibility is OFF or outside the scheduled window. Signed-in Admins always bypass the lock with an Admin Preview banner.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Restricted Headline
                </label>
                <input
                  type="text"
                  value={docsState.access.restrictedTitle}
                  onChange={(e) =>
                    updateAccessConfig({ restrictedTitle: e.target.value })
                  }
                  className="agri-input"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Restricted Notice Message
                </label>
                <textarea
                  rows={4}
                  value={docsState.access.restrictedMessage}
                  onChange={(e) =>
                    updateAccessConfig({ restrictedMessage: e.target.value })
                  }
                  className="agri-input leading-relaxed"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] space-y-1 font-mono tabular-nums">
              <div>Last updated by: {docsState.access.updatedBy}</div>
              <div>Updated at: {new Date(docsState.access.updatedAt).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: SECTIONS & WYSIWYG EDITOR ================= */}
      {studioTab === 'sections' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Drag-and-Drop Reorder List */}
          <div className="lg:col-span-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle)]">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Document Outline
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Drag &amp; drop or use arrows to reorder
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewSectionForm(!showNewSectionForm)}
                className="agri-btn agri-btn-primary agri-btn-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Section</span>
              </button>
            </div>

            {showNewSectionForm && (
              <form
                onSubmit={handleCreateSection}
                className="p-3 rounded-xl border border-[#10b981]/40 bg-[var(--bg-surface-muted)] space-y-2.5 text-xs"
              >
                <div className="font-bold text-[var(--text-primary)]">New Documentation Section</div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Code (e.g. P)"
                    value={newSecCode}
                    onChange={(e) => setNewSecCode(e.target.value)}
                    className="agri-input font-mono"
                  />
                  <select
                    value={newSecGroup}
                    onChange={(e) => setNewSecGroup(e.target.value as DocSectionGroup)}
                    className="agri-input col-span-2"
                  >
                    <option value="pitch">YC Pitch Deck</option>
                    <option value="technical">Technical Spec</option>
                    <option value="operations">Operations &amp; Security</option>
                  </select>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Section Title"
                  value={newSecTitle}
                  onChange={(e) => setNewSecTitle(e.target.value)}
                  className="agri-input"
                />
                <input
                  type="text"
                  placeholder="Short executive summary"
                  value={newSecSummary}
                  onChange={(e) => setNewSecSummary(e.target.value)}
                  className="agri-input"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewSectionForm(false)}
                    className="px-2.5 py-1.5 text-xs text-[var(--text-secondary)]"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="agri-btn agri-btn-primary agri-btn-sm">
                    Create
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-1.5 max-h-[620px] overflow-y-auto pr-1">
              {sortedSections.map((sec, idx) => {
                const isSelected = activeSection?.id === sec.id;
                return (
                  <div
                    key={sec.id}
                    draggable
                    onDragStart={() => setDraggedId(sec.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropReorder(sec.id)}
                    className={`rounded-xl border p-2.5 transition cursor-grab active:cursor-grabbing ${
                      isSelected
                        ? 'border-[#047857] bg-[#d1fae5]/35 dark:bg-[#14251c]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[#10b981]/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                      <button
                        type="button"
                        onClick={() => setSelectedSectionId(sec.id)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--text-muted)]">
                          <span className="font-bold text-[#047857] dark:text-[#34d399]">
                            {sec.code}
                          </span>
                          <span>·</span>
                          <span className="uppercase">{sec.group}</span>
                          {!sec.visible && <span>· HIDDEN</span>}
                        </div>
                        <div className="text-xs font-semibold text-[var(--text-primary)] truncate mt-0.5">
                          {sec.title}
                        </div>
                      </button>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveStep(sec.id, -1)}
                          disabled={idx === 0}
                          aria-label="Move section up"
                          className="p-1 text-[var(--text-muted)] hover:text-[#047857] disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveStep(sec.id, 1)}
                          disabled={idx === sortedSections.length - 1}
                          aria-label="Move section down"
                          className="p-1 text-[var(--text-muted)] hover:text-[#047857] disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateSection(sec.id, { visible: !sec.visible })
                          }
                          aria-label={sec.visible ? 'Hide section' : 'Show section'}
                          className="p-1 text-[var(--text-muted)] hover:text-[#047857]"
                        >
                          {sec.visible ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: WYSIWYG Section Editor */}
          {activeSection && (
            <div className="lg:col-span-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="text-[11px] font-mono text-[#047857] dark:text-[#34d399]">
                    EDITING SECTION {activeSection.code} · {activeSection.slug}
                  </div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] mt-0.5">
                    {activeSection.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewSplit(!previewSplit)}
                    className="agri-btn agri-btn-secondary agri-btn-sm"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{previewSplit ? 'Edit Mode' : 'Live Preview'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (sortedSections.length <= 1) return;
                      deleteSection(activeSection.id);
                      const fallback = sortedSections.find((s) => s.id !== activeSection.id);
                      if (fallback) setSelectedSectionId(fallback.id);
                      notify('Section deleted.');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {previewSplit ? (
                <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] space-y-3">
                  <div className="text-xs font-mono text-[var(--text-muted)]">
                    {activeSection.subtitle}
                  </div>
                  <p className="text-sm font-medium text-[var(--text-primary)] leading-relaxed">
                    {activeSection.summary}
                  </p>
                  <DocsMarkdownRenderer markdown={activeSection.contentMarkdown} />
                  {activeSection.diagramType !== 'none' && (
                    <DocsDiagrams
                      diagramType={activeSection.diagramType}
                      diagramCode={activeSection.diagramCode}
                      sectionTitle={activeSection.title}
                    />
                  )}
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                    <div>
                      <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                        Code
                      </label>
                      <input
                        type="text"
                        value={activeSection.code}
                        onChange={(e) =>
                          updateSection(activeSection.id, { code: e.target.value })
                        }
                        className="agri-input font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                        Category Group
                      </label>
                      <select
                        value={activeSection.group}
                        onChange={(e) =>
                          updateSection(activeSection.id, {
                            group: e.target.value as DocSectionGroup
                          })
                        }
                        className="agri-input"
                      >
                        <option value="pitch">YC Pitch Deck</option>
                        <option value="technical">Technical Documentation</option>
                        <option value="operations">Operations &amp; Governance</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                        Subtitle
                      </label>
                      <input
                        type="text"
                        value={activeSection.subtitle}
                        onChange={(e) =>
                          updateSection(activeSection.id, { subtitle: e.target.value })
                        }
                        className="agri-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                      Section Title
                    </label>
                    <input
                      type="text"
                      value={activeSection.title}
                      onChange={(e) =>
                        updateSection(activeSection.id, { title: e.target.value })
                      }
                      className="agri-input font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                      Executive Summary (Shown at top of section)
                    </label>
                    <textarea
                      rows={2}
                      value={activeSection.summary}
                      onChange={(e) =>
                        updateSection(activeSection.id, { summary: e.target.value })
                      }
                      className="agri-input leading-relaxed"
                    />
                  </div>

                  {/* WYSIWYG Formatting Toolbar + Markdown Body */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <label className="font-semibold text-[var(--text-secondary)]">
                        Section Content (Rich Formatting &amp; Tables)
                      </label>
                      <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-1">
                        <button
                          type="button"
                          onClick={() => insertMarkdownSnippet('\n### ', '', 'Heading Title')}
                          title="Insert Heading"
                          className="p-1.5 rounded hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[#047857]"
                        >
                          <Heading3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdownSnippet('**', '**', 'bold text')}
                          title="Bold"
                          className="p-1.5 rounded hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[#047857]"
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdownSnippet('*', '*', 'italic text')}
                          title="Italic"
                          className="p-1.5 rounded hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[#047857]"
                        >
                          <Italic className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdownSnippet('`', '`', 'code')}
                          title="Inline Code"
                          className="p-1.5 rounded hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[#047857]"
                        >
                          <Code className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdownSnippet('\n- ', '', 'List bullet item')}
                          title="Bullet List"
                          className="p-1.5 rounded hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[#047857]"
                        >
                          <List className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertMarkdownSnippet(
                              '\n| Column A | Column B |\n| :--- | :--- |\n| Value 1 | Value 2 |\n',
                              '',
                              ''
                            )
                          }
                          title="Insert Table"
                          className="p-1.5 rounded hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[#047857]"
                        >
                          <Table className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdownSnippet('[', '](/marketplace)', 'Link Label')}
                          title="Insert Link"
                          className="p-1.5 rounded hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[#047857]"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <textarea
                      ref={textareaRef}
                      rows={11}
                      value={activeSection.contentMarkdown}
                      onChange={(e) =>
                        updateSection(activeSection.id, {
                          contentMarkdown: e.target.value
                        })
                      }
                      className="agri-input font-mono text-[12px] leading-relaxed"
                    />
                  </div>

                  {/* Highlights */}
                  <div>
                    <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                      Key Takeaways (One per line)
                    </label>
                    <textarea
                      rows={3}
                      value={activeSection.highlights.join('\n')}
                      onChange={(e) =>
                        updateSection(activeSection.id, {
                          highlights: e.target.value
                            .split('\n')
                            .map((line) => line.trim())
                            .filter(Boolean)
                        })
                      }
                      className="agri-input leading-relaxed"
                    />
                  </div>

                  {/* Editable Diagram Controls */}
                  <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                          Embedded Diagram Type
                        </label>
                        <select
                          value={activeSection.diagramType}
                          onChange={(e) =>
                            updateSection(activeSection.id, {
                              diagramType: e.target.value as DocDiagramType
                            })
                          }
                          className="agri-input"
                        >
                          <option value="none">No Diagram</option>
                          <option value="architecture_svg">
                            Interactive Architecture Diagram (SVG + Mermaid)
                          </option>
                          <option value="dataflow_svg">
                            Interactive Data &amp; AI Flow Diagram (SVG + Mermaid)
                          </option>
                          <option value="mermaid">Mermaid Source Diagram</option>
                        </select>
                      </div>
                    </div>

                    {activeSection.diagramType !== 'none' && (
                      <div>
                        <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                          Editable Mermaid Diagram Source
                        </label>
                        <textarea
                          rows={6}
                          value={activeSection.diagramCode || ''}
                          onChange={(e) =>
                            updateSection(activeSection.id, {
                              diagramCode: e.target.value
                            })
                          }
                          placeholder="flowchart LR..."
                          className="agri-input font-mono text-[11.5px]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: TEAM SHOWCASE EDITOR ================= */}
      {studioTab === 'team' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-[var(--text-primary)] mb-1">
                  Team Name (Optional)
                </label>
                <input
                  type="text"
                  value={docsState.team.teamName}
                  onChange={(e) =>
                    updateTeamConfig({ ...docsState.team, teamName: e.target.value })
                  }
                  className="agri-input"
                />
              </div>
              <div>
                <label className="block font-bold text-[var(--text-primary)] mb-1">
                  Team Tagline / Mission Statement
                </label>
                <input
                  type="text"
                  value={docsState.team.teamTagline}
                  onChange={(e) =>
                    updateTeamConfig({ ...docsState.team, teamTagline: e.target.value })
                  }
                  className="agri-input"
                />
              </div>
            </div>

            {/* Existing Team Members List */}
            <div className="space-y-3 pt-2">
              <div className="text-xs font-bold text-[var(--text-primary)]">
                Team Members (Uniform 1:1 Portrait Crop &amp; Auto-Resize)
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {docsState.team.members.map((member) => (
                  <div
                    key={member.id}
                    className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] flex gap-3.5 items-start"
                  >
                    <div className="w-20 shrink-0 space-y-2">
                      <div className="aspect-square w-20 rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-center">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.fullName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-bold text-[#047857] font-mono">
                            {member.fullName.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <label className="block text-center text-[11px] font-semibold text-[#047857] dark:text-[#34d399] cursor-pointer hover:underline">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            handleTeamMemberImageUpload(member.id, e.target.files?.[0])
                          }
                        />
                        {uploadingMemberId === member.id ? 'Resizing...' : 'Upload Photo'}
                      </label>
                    </div>

                    <div className="flex-1 min-w-0 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={member.fullName}
                          onChange={(e) =>
                            handleMemberFieldChange(member.id, 'fullName', e.target.value)
                          }
                          placeholder="Full Name"
                          className="agri-input font-semibold"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveTeamMember(member.id)}
                          aria-label={`Remove ${member.fullName}`}
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={member.role}
                        onChange={(e) =>
                          handleMemberFieldChange(member.id, 'role', e.target.value)
                        }
                        placeholder="Role in Application"
                        className="agri-input"
                      />
                      <input
                        type="email"
                        value={member.email}
                        onChange={(e) =>
                          handleMemberFieldChange(member.id, 'email', e.target.value)
                        }
                        placeholder="Email Address"
                        className="agri-input"
                      />
                      <input
                        type="text"
                        value={member.bio || ''}
                        onChange={(e) =>
                          handleMemberFieldChange(member.id, 'bio', e.target.value)
                        }
                        placeholder="Short responsibility summary"
                        className="agri-input"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add New Team Member */}
            <form
              onSubmit={handleAddTeamMember}
              className="p-4 rounded-xl border border-dashed border-[#10b981]/50 bg-[var(--bg-surface-muted)] space-y-3 text-xs"
            >
              <div className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#047857]" />
                <span>Add New Team Member</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="agri-input"
                />
                <input
                  type="text"
                  required
                  placeholder="Role in Application"
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  className="agri-input"
                />
                <input
                  type="email"
                  required
                  placeholder="Email Address"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="agri-input"
                />
                <div className="flex items-center gap-2">
                  <label className="agri-btn agri-btn-secondary agri-btn-sm cursor-pointer w-full justify-center">
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>{newMemberAvatar ? 'Photo Ready (1:1)' : 'Upload Photo (Auto 1:1)'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleTeamMemberImageUpload('__new__', e.target.files?.[0])
                      }
                    />
                  </label>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Short bio / engineering focus (optional)"
                  value={newMemberBio}
                  onChange={(e) => setNewMemberBio(e.target.value)}
                  className="agri-input flex-1"
                />
                <button type="submit" className="agri-btn agri-btn-primary agri-btn-sm">
                  Add Team Member
                </button>
              </div>
            </form>
          </div>

          {/* Live Preview of Team Grid */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Live Public Grid Preview (Appears in Slide 11 &amp; Section N)
            </div>
            <TeamShowcaseGrid team={docsState.team} compact />
          </div>
        </div>
      )}

      {/* ================= TAB 4: PUBLISH & VERSION HISTORY ================= */}
      {studioTab === 'versions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Create Release Snapshot
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Publishing commits all draft section edits, diagram updates, and team changes into an immutable snapshot for instant rollback.
            </p>
            <div>
              <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                Snapshot Label
              </label>
              <input
                type="text"
                placeholder="e.g. CloudCamp Final Jury Review"
                value={pubLabel}
                onChange={(e) => setPubLabel(e.target.value)}
                className="agri-input"
              />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                Release Summary
              </label>
              <textarea
                rows={3}
                placeholder="Summary of updated metrics, pitch slides, or API endpoints..."
                value={pubSummary}
                onChange={(e) => setPubSummary(e.target.value)}
                className="agri-input"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={async () => {
                  await publishVersion(pubLabel, pubSummary);
                  setPubLabel('');
                  setPubSummary('');
                  notify('Published new snapshot.');
                }}
                className="agri-btn agri-btn-primary agri-btn-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Publish Snapshot</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await resetAllDocsToDefault();
                  notify('Restored factory default pitch deck, technical spec, and June 10–14 schedule.');
                }}
                className="agri-btn agri-btn-secondary agri-btn-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Default Seed</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Published Snapshots ({docsState.versions.length})
            </h3>
            <div className="divide-y divide-[var(--border-subtle)]">
              {docsState.versions.map((ver) => (
                <div
                  key={ver.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#047857] dark:text-[#34d399]">
                        {ver.version}
                      </span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {ver.label}
                      </span>
                    </div>
                    <p className="text-[var(--text-secondary)] mt-0.5">{ver.summary}</p>
                    <div className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5 tabular-nums">
                      {ver.author} · {new Date(ver.publishedAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await rollbackVersion(ver.id);
                      notify(`Rolled back to ${ver.version}.`);
                    }}
                    className="agri-btn agri-btn-secondary agri-btn-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Rollback</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
