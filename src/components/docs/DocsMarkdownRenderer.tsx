import React from 'react';

interface DocsMarkdownRendererProps {
  markdown: string;
  highlightQuery?: string;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderInlineText(
  text: string,
  highlightQuery?: string,
  keyPrefix = 'in'
): React.ReactNode[] {
  // Parse inline markdown: `code`, **bold**, *italic*, [label](url)
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(tokenRegex);

  const applyHighlight = (segment: string, idx: number): React.ReactNode => {
    const q = highlightQuery?.trim();
    if (!q || q.length < 2) return segment;
    const regex = new RegExp(`(${escapeRegExp(q)})`, 'ig');
    const chunks = segment.split(regex);
    if (chunks.length === 1) return segment;
    return chunks.map((c, j) =>
      c.toLowerCase() === q.toLowerCase() ? (
        <mark
          key={`${keyPrefix}-hl-${idx}-${j}`}
          className="bg-amber-200/80 dark:bg-amber-500/30 text-slate-950 dark:text-amber-100 rounded-xs px-0.5"
        >
          {c}
        </mark>
      ) : (
        c
      )
    );
  };

  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={`${keyPrefix}-code-${idx}`}
          className="font-mono text-[12px] px-1.5 py-0.5 rounded bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] text-[#047857] dark:text-[#34d399]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong
          key={`${keyPrefix}-b-${idx}`}
          className="font-semibold text-[var(--text-primary)]"
        >
          {applyHighlight(part.slice(2, -2), idx)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={`${keyPrefix}-i-${idx}`} className="italic">
          {applyHighlight(part.slice(1, -1), idx)}
        </em>
      );
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const href = linkMatch[2];
      const isExternal = href.startsWith('http://') || href.startsWith('https://');
      return (
        <a
          key={`${keyPrefix}-a-${idx}`}
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="text-[#047857] dark:text-[#34d399] font-semibold underline decoration-[#10b981]/50 underline-offset-2 hover:decoration-[#047857]"
        >
          {linkMatch[1]}
        </a>
      );
    }
    return <React.Fragment key={`${keyPrefix}-t-${idx}`}>{applyHighlight(part, idx)}</React.Fragment>;
  });
}

function isTableDivider(line: string): boolean {
  const trimmed = line.trim();
  return /^\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?$/.test(trimmed);
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

export default function DocsMarkdownRenderer({
  markdown,
  highlightQuery
}: DocsMarkdownRendererProps) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      i++;
      continue;
    }

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || 'text';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <div
          key={`pre-${i}`}
          className="my-4 rounded-xl border border-[var(--border-subtle)] bg-slate-950 text-slate-100 overflow-hidden"
        >
          <div className="px-3.5 py-1.5 border-b border-slate-800 text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>{lang}</span>
            <span>spec</span>
          </div>
          <pre className="p-3.5 text-xs font-mono leading-relaxed overflow-x-auto">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Markdown Table
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      isTableDivider(lines[i + 1])
    ) {
      const headers = splitTableRow(lines[i]);
      i += 2; // skip header & divider
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      blocks.push(
        <div
          key={`tbl-${i}`}
          className="my-4 overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]">
                {headers.map((h, hIdx) => (
                  <th
                    key={`th-${hIdx}`}
                    className="py-2.5 px-3.5 font-semibold text-[11px] uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap"
                  >
                    {renderInlineText(h, highlightQuery, `th-${i}-${hIdx}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] tabular-nums">
              {rows.map((row, rIdx) => (
                <tr
                  key={`tr-${rIdx}`}
                  className="hover:bg-[var(--bg-surface-muted)]/60 transition-colors"
                >
                  {headers.map((_, cIdx) => (
                    <td
                      key={`td-${cIdx}`}
                      className="py-2.5 px-3.5 text-[var(--text-secondary)] align-top leading-relaxed"
                    >
                      {renderInlineText(
                        row[cIdx] || '',
                        highlightQuery,
                        `td-${i}-${rIdx}-${cIdx}`
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      blocks.push(
        <h4
          key={`h4-${i}`}
          className="text-sm sm:text-base font-bold text-[var(--text-primary)] tracking-tight mt-5 mb-2"
        >
          {renderInlineText(line.slice(4), highlightQuery, `h4-${i}`)}
        </h4>
      );
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push(
        <h3
          key={`h3-${i}`}
          className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight mt-6 mb-2.5"
        >
          {renderInlineText(line.slice(3), highlightQuery, `h3-${i}`)}
        </h3>
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push(
        <blockquote
          key={`bq-${i}`}
          className="my-3.5 pl-4 py-1 border-l-2 border-[#047857] dark:border-[#10b981] text-sm text-[var(--text-secondary)] italic leading-relaxed"
        >
          {renderInlineText(quoteLines.join(' '), highlightQuery, `bq-${i}`)}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-3 space-y-2 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
          {items.map((item, idx) => (
            <li key={`li-${idx}`} className="flex items-start gap-2.5">
              <span
                aria-hidden="true"
                className="mt-2 w-1.5 h-1.5 rounded-full bg-[#047857] dark:bg-[#10b981] shrink-0"
              />
              <span>{renderInlineText(item, highlightQuery, `li-${i}-${idx}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="my-3 space-y-2 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
          {items.map((item, idx) => (
            <li key={`oli-${idx}`} className="flex items-start gap-2.5">
              <span className="font-mono text-xs font-semibold text-[#047857] dark:text-[#34d399] tabular-nums mt-0.5 shrink-0">
                {String(idx + 1).padStart(2, '0')}.
              </span>
              <span>{renderInlineText(item, highlightQuery, `oli-${i}-${idx}`)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line)) {
      blocks.push(<hr key={`hr-${i}`} className="my-5 border-[var(--border-subtle)]" />);
      i++;
      continue;
    }

    // Standard Paragraph (collect consecutive text lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('> ') &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !(lines[i].trim().includes('|') && i + 1 < lines.length && isTableDivider(lines[i + 1]))
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }

    if (paraLines.length > 0) {
      blocks.push(
        <p
          key={`p-${i}`}
          className="my-3 text-[13.5px] sm:text-sm leading-[1.7] text-[var(--text-secondary)]"
        >
          {renderInlineText(paraLines.join(' '), highlightQuery, `p-${i}`)}
        </p>
      );
    } else {
      i++;
    }
  }

  return <div className="space-y-1">{blocks}</div>;
}
