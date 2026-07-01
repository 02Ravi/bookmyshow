'use client';

import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { cn } from '@/lib/utils';

interface MarkdownProps {
  children: string;
  className?: string;
  compact?: boolean;
  dense?: boolean;
}

export function Markdown({
  children,
  className,
  compact = false,
  dense = false,
}: MarkdownProps) {
  const components: Components = {
    h1: ({ ...props }) => (
      <h1
        {...props}
        className={cn('text-lg font-bold text-[var(--bms-text)]', dense ? 'mb-1' : 'mb-2')}
      />
    ),
    h2: ({ ...props }) => (
      <h2
        {...props}
        className={cn('text-base font-bold text-[var(--bms-text)]', dense ? 'mb-1' : 'mb-2')}
      />
    ),
    h3: ({ ...props }) => (
      <h3
        {...props}
        className={cn('text-sm font-semibold text-[var(--bms-text)]', dense ? 'mb-1' : 'mb-1.5')}
      />
    ),
    p: ({ ...props }) => (
      <p
        {...props}
        className={cn(
          'text-[var(--bms-text)]',
          dense ? 'mb-1' : compact ? 'mb-2' : 'mb-3',
        )}
      />
    ),
    strong: ({ ...props }) => (
      <strong {...props} className="font-semibold text-[var(--bms-text)]" />
    ),
    ul: ({ ...props }) => (
      <ul
        {...props}
        className={cn(
          'list-disc pl-5 text-[var(--bms-text)]',
          dense ? 'mb-1' : compact ? 'mb-2' : 'mb-3',
        )}
      />
    ),
    ol: ({ ...props }) => (
      <ol
        {...props}
        className={cn(
          'list-decimal pl-5 text-[var(--bms-text)]',
          dense ? 'mb-1' : compact ? 'mb-2' : 'mb-3',
        )}
      />
    ),
    li: ({ ...props }) => <li {...props} className={dense ? 'mb-0.5' : 'mb-1'} />,
    a: ({ ...props }) => (
      <a
        {...props}
        className="text-[var(--bms-red)] underline hover:text-[var(--bms-red-hover)]"
        target="_blank"
        rel="noopener noreferrer"
      />
    ),
    code: ({ children, ...props }) => (
      <code
        {...props}
        className="rounded bg-[var(--bms-chat-muted)] px-1 py-0.5 font-mono text-xs"
      >
        {children}
      </code>
    ),
  };

  return (
    <div className={cn(dense ? 'space-y-1' : compact ? 'space-y-2' : 'space-y-3', className)}>
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  );
}
