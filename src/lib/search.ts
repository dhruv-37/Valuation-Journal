import type { ChecklistItem, ID, KnowledgeCard, KnowledgeExtract, Phase, ResearchDocument, Snapshot } from '../types';

export type SearchKind = 'phase' | 'task' | 'card' | 'snapshot' | 'extract' | 'document';

export interface SearchResult {
  kind: SearchKind;
  id: ID;
  phaseId: ID;
  title: string;
  /** Short excerpt around the match (empty when the title matched). */
  snippet: string;
  /** Which field matched, shown as a hint. */
  field: string;
  score: number;
  card?: KnowledgeCard;
  snapshot?: Snapshot;
  extract?: KnowledgeExtract;
  document?: ResearchDocument;
  done?: boolean;
}

export const tokenize = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean);

/** Every token must appear somewhere in the record; the title-heavy match wins. */
export function search(
  query: string,
  data: {
    phases: Phase[];
    tasks: ChecklistItem[];
    cards: KnowledgeCard[];
    snapshots?: Snapshot[];
    extracts?: KnowledgeExtract[];
    documents?: ResearchDocument[];
    /** Documents whose stored text contains every token, with an excerpt (see useDocumentTextMatches). */
    documentText?: Map<ID, string>;
  },
  limit = 50,
): SearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const results: SearchResult[] = [];

  const match = (fields: { name: string; text: string; weight: number }[]) => {
    let score = 0;
    let best: { name: string; text: string; weight: number } | null = null;
    for (const token of tokens) {
      let hit = false;
      for (const f of fields) {
        if (f.text.toLowerCase().includes(token)) {
          hit = true;
          score += f.weight;
          if (!best || f.weight > best.weight) best = f;
        }
      }
      if (!hit) return null;
    }
    return { score, best: best! };
  };

  for (const p of data.phases) {
    const m = match([
      { name: 'Phase', text: p.title, weight: 10 },
      { name: 'Description', text: p.description, weight: 4 },
      { name: 'Objective', text: p.objectives.join(' · '), weight: 3 },
    ]);
    if (m) results.push({ kind: 'phase', id: p.id, phaseId: p.id, title: p.title, field: m.best.name, snippet: m.best.name === 'Phase' ? p.description : excerpt(m.best.text, tokens), score: m.score + 2 });
  }

  for (const t of data.tasks) {
    const m = match([{ name: 'Task', text: t.text, weight: 6 }]);
    if (m) results.push({ kind: 'task', id: t.id, phaseId: t.phaseId, title: t.text, field: 'Checklist', snippet: '', score: m.score, done: t.done });
  }

  for (const c of data.cards) {
    const m = match([
      { name: 'Title', text: c.title, weight: 8 },
      { name: 'Tag', text: c.tags.map((t) => `#${t}`).join(' '), weight: 6 },
      { name: 'Content', text: c.content, weight: 3 },
      { name: 'Source', text: c.source ?? '', weight: 2 },
    ]);
    if (m) {
      const snippetSource = m.best.name === 'Title' || m.best.name === 'Tag' ? c.content : m.best.text;
      results.push({ kind: 'card', id: c.id, phaseId: c.phaseId, title: c.title || 'Untitled card', field: m.best.name, snippet: excerpt(snippetSource, tokens), score: m.score + (c.pinned ? 1 : 0), card: c });
    }
  }

  for (const s of data.snapshots ?? []) {
    const m = match([
      { name: 'Title', text: s.title, weight: 8 },
      { name: 'Tag', text: s.tags.map((t) => `#${t}`).join(' '), weight: 6 },
      { name: 'Caption', text: s.caption, weight: 4 },
      { name: 'Description', text: s.description, weight: 3 },
    ]);
    if (m) {
      const snippetSource = m.best.name === 'Title' || m.best.name === 'Tag' ? s.caption || s.description : m.best.text;
      results.push({ kind: 'snapshot', id: s.id, phaseId: s.phaseId, title: s.title || 'Untitled snapshot', field: m.best.name, snippet: excerpt(snippetSource, tokens), score: m.score + (s.pinned ? 1 : 0), snapshot: s });
    }
  }

  for (const e of data.extracts ?? []) {
    const m = match([
      { name: 'Title', text: e.title, weight: 8 },
      { name: 'Tag', text: e.tags.map((t) => `#${t}`).join(' '), weight: 6 },
      { name: 'Text', text: e.text, weight: 3 },
      { name: 'Source', text: [e.sourceDocument, e.location].filter(Boolean).join(' '), weight: 2 },
    ]);
    if (m) {
      const snippetSource = m.best.name === 'Text' ? m.best.text : e.text;
      results.push({ kind: 'extract', id: e.id, phaseId: e.phaseId, title: e.title || e.text.slice(0, 80), field: m.best.name, snippet: excerpt(snippetSource, tokens), score: m.score + (e.pinned ? 1 : 0), extract: e });
    }
  }

  for (const d of data.documents ?? []) {
    const contentHit = data.documentText?.get(d.id);
    const m = match([
      { name: 'Title', text: d.title, weight: 8 },
      { name: 'Tag', text: d.tags.map((t) => `#${t}`).join(' '), weight: 6 },
      { name: 'File name', text: d.fileName, weight: 5 },
      { name: 'Description', text: d.description, weight: 3 },
      // The full text is matched elsewhere; a hit stands in for every token here.
      { name: 'Content', text: contentHit !== undefined ? tokens.join(' ') : '', weight: 2 },
    ]);
    if (m) {
      // Text around the match inside the file is the most useful context when there is one.
      const snippet = contentHit ?? (m.best.name === 'Description' ? excerpt(d.description, tokens) : d.description);
      results.push({ kind: 'document', id: d.id, phaseId: d.phaseId ?? '', title: d.title || d.fileName, field: m.best.name, snippet, score: m.score, document: d });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function excerpt(text: string, tokens: string[], radius = 70): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const lower = flat.toLowerCase();
  const index = tokens.map((t) => lower.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, index - radius);
  const end = Math.min(flat.length, index + radius * 1.6);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
}

/** Splits text into plain and matched segments for highlighting. */
export function highlight(text: string, tokens: string[]): { text: string; hit: boolean }[] {
  if (tokens.length === 0 || !text) return [{ text, hit: false }];
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  // With one capture group, split() puts matches at odd indices.
  return text
    .split(re)
    .map((part, i) => ({ text: part, hit: i % 2 === 1 }))
    .filter((part) => part.text);
}
