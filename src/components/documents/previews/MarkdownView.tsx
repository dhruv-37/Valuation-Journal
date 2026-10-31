import { Fragment } from 'react';
import type { Block, Inline } from '../../../lib/markdown';
import { isSafeUrl } from '../../../lib/format';

/** Renders parsed Markdown as React elements (never as raw HTML). */
export function MarkdownView({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-ink-2">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}

const HEADING_CLASS = [
  'font-display text-[30px] leading-tight font-medium tracking-tight text-ink',
  'font-display text-[24px] leading-tight font-medium tracking-tight text-ink pt-2',
  'font-display text-[20px] leading-snug font-medium text-ink pt-1',
  'text-[16px] font-semibold text-ink',
  'text-[15px] font-semibold text-ink',
  'text-[13px] font-semibold tracking-wide text-muted uppercase',
];

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${Math.min(6, block.level)}` as 'h1';
      return (
        <Tag className={HEADING_CLASS[block.level - 1]}>
          <Inlines nodes={block.children} />
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p>
          <Inlines nodes={block.children} />
        </p>
      );
    case 'quote':
      return (
        <blockquote className="border-l-2 border-gold/50 pl-4 font-display text-[17px] text-ink italic">
          <Inlines nodes={block.children} />
        </blockquote>
      );
    case 'code':
      return <pre className="overflow-x-auto rounded-xl border border-line bg-surface-2 px-4 py-3 font-mono text-[13px] leading-[1.7] text-ink">{block.text}</pre>;
    case 'rule':
      return <hr className="border-line" />;
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <List className={`space-y-1 pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'} marker:text-faint`}>
          {block.items.map((item, i) => (
            <li key={i}>
              <Inlines nodes={item} />
            </li>
          ))}
        </List>
      );
    }
    case 'table':
      return (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-[13.5px]">
            <thead className="bg-surface-2 text-ink">
              <tr>
                {block.header.map((cell, i) => (
                  <th key={i} className="border-b border-line px-3 py-2 font-semibold">
                    <Inlines nodes={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="border-b border-line last:border-0">
                  {row.map((cell, c) => (
                    <td key={c} className="px-3 py-2 align-top">
                      <Inlines nodes={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.type) {
          case 'text':
            return <Fragment key={i}>{node.text}</Fragment>;
          case 'strong':
            return (
              <strong key={i} className="font-semibold text-ink">
                <Inlines nodes={node.children} />
              </strong>
            );
          case 'em':
            return (
              <em key={i}>
                <Inlines nodes={node.children} />
              </em>
            );
          case 'code':
            return (
              <code key={i} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.88em] text-ink">
                {node.text}
              </code>
            );
          case 'link':
            // Only web links are clickable; anything else (javascript:, file:) stays as text.
            return isSafeUrl(node.href) ? (
              <a key={i} href={node.href} target="_blank" rel="noopener noreferrer" className="text-gold underline-offset-2 hover:underline">
                <Inlines nodes={node.children} />
              </a>
            ) : (
              <Fragment key={i}>
                <Inlines nodes={node.children} />
              </Fragment>
            );
        }
      })}
    </>
  );
}
