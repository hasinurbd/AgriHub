import React, { useState } from 'react';
import { Mail, Users } from 'lucide-react';
import type { TeamConfig, TeamMember } from '../../types/docs';

interface TeamShowcaseGridProps {
  team: TeamConfig;
  compact?: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'AH';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function TeamMemberCard({ member }: { member: TeamMember }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showFallback = !member.avatarUrl || imgFailed;

  return (
    <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden flex flex-col transition hover:border-[#10b981]/60">
      {/* Uniform 1:1 Portrait Frame */}
      <div className="aspect-square w-full bg-[var(--bg-surface-muted)] overflow-hidden border-b border-[var(--border-subtle)] relative">
        {!showFallback ? (
          <img
            src={member.avatarUrl}
            alt={`${member.fullName} — ${member.role}`}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#f0f6f2] dark:bg-[#14251c] text-[#047857] dark:text-[#34d399]">
            <span className="text-3xl font-extrabold tracking-tight font-mono">
              {getInitials(member.fullName)}
            </span>
          </div>
        )}
      </div>

      {/* Consistent Card Metadata */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-[var(--text-primary)] tracking-tight leading-snug">
            {member.fullName}
          </h4>
          <p className="text-xs font-semibold text-[#047857] dark:text-[#34d399] mt-0.5 leading-snug">
            {member.role}
          </p>
          {member.bio && (
            <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
              {member.bio}
            </p>
          )}
        </div>

        <a
          href={`mailto:${member.email}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[#047857] dark:hover:text-[#34d399] transition truncate pt-2 border-t border-[var(--border-subtle)]"
        >
          <Mail className="w-3.5 h-3.5 shrink-0 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
          <span className="truncate">{member.email}</span>
        </a>
      </div>
    </article>
  );
}

export default function TeamShowcaseGrid({ team, compact = false }: TeamShowcaseGridProps) {
  return (
    <div className={compact ? 'my-4' : 'my-5'}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 mb-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#047857] dark:text-[#10b981]" strokeWidth={1.75} />
          <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
            {team.teamName || 'Core Engineering & Operations Team'}
          </h3>
        </div>
        <span className="text-xs font-mono text-[var(--text-muted)] tabular-nums">
          {team.members.length} contributors
        </span>
      </div>

      {team.teamTagline && (
        <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] mb-4 leading-relaxed">
          {team.teamTagline}
        </p>
      )}

      {team.members.length === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)]">
          No team members listed yet. Add team members in the Admin Docs Studio.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {team.members.map((member) => (
            <TeamMemberCard key={member.id} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}
