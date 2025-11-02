"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownPreviewProps = {
  content: string;
};

const markdownComponents: Components = {
  h1: ({ className, ...props }) => (
    <h1
      {...props}
      className={mergeClassNames(
        "mt-10 text-3xl font-semibold leading-tight text-text-primary first:mt-0",
        className
      )}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      {...props}
      className={mergeClassNames(
        "mt-8 text-2xl font-semibold leading-snug text-text-primary first:mt-0",
        className
      )}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      {...props}
      className={mergeClassNames(
        "mt-6 text-xl font-semibold leading-snug text-text-primary first:mt-0",
        className
      )}
    />
  ),
  p: ({ className, ...props }) => (
    <p
      {...props}
      className={mergeClassNames("text-base leading-relaxed text-text-muted", className)}
    />
  ),
  strong: ({ className, ...props }) => (
    <strong
      {...props}
      className={mergeClassNames("font-semibold text-text-primary", className)}
    />
  ),
  em: ({ className, ...props }) => (
    <em
      {...props}
      className={mergeClassNames("italic text-text-primary", className)}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      {...props}
      className={mergeClassNames(
        "ml-5 list-disc space-y-2 text-base leading-relaxed text-text-muted",
        className
      )}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      {...props}
      className={mergeClassNames(
        "ml-5 list-decimal space-y-2 text-base leading-relaxed text-text-muted",
        className
      )}
    />
  ),
  li: ({ className, ...props }) => (
    <li
      {...props}
      className={mergeClassNames("pl-1 marker:text-highlight", className)}
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      {...props}
      className={mergeClassNames(
        "border-l-4 border-highlight/40 bg-surface-elevated px-5 py-3 text-base italic text-text-primary/80",
        className
      )}
    />
  ),
  a: ({ className, href, ...props }) => (
    <a
      {...props}
      href={href ?? "#"}
      className={mergeClassNames(
        "font-medium text-highlight underline decoration-highlight/50 underline-offset-4 transition hover:text-highlight/80",
        className
      )}
      target="_blank"
      rel="noopener noreferrer"
    />
  ),
  code: ({ inline, className, children, ...props }) => {
    if (inline) {
      return (
        <code
          {...props}
          className={mergeClassNames(
            "rounded-md bg-surface-muted/40 px-1.5 py-0.5 text-sm text-text-primary",
            className
          )}
        >
          {children}
        </code>
      );
    }

    return (
      <pre className="my-4 overflow-x-auto rounded-2xl border border-border bg-surface-elevated p-4 text-sm text-text-muted">
        <code {...props} className={className}>
          {children}
        </code>
      </pre>
    );
  },
  table: ({ className, ...props }) => (
    <div className="my-6 overflow-hidden rounded-2xl border border-border">
      <table
        {...props}
        className={mergeClassNames("min-w-full divide-y divide-border", className)}
      >
        {props.children}
      </table>
    </div>
  ),
  thead: ({ className, ...props }) => (
    <thead
      {...props}
      className={mergeClassNames(
        "bg-surface-muted/40 text-left text-sm uppercase text-text-primary",
        className
      )}
    />
  ),
  tbody: ({ className, ...props }) => (
    <tbody
      {...props}
      className={mergeClassNames("divide-y divide-border", className)}
    />
  ),
  th: ({ className, ...props }) => (
    <th
      {...props}
      className={mergeClassNames("px-4 py-3 font-semibold tracking-wide", className)}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      {...props}
      className={mergeClassNames("px-4 py-3 text-sm", className)}
    />
  ),
  hr: () => <hr className="my-8 border-border/60" />,
};

function mergeClassNames(base: string, extra?: string) {
  return extra ? `${base} ${extra}` : base;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="flex flex-col gap-4">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
