type CodeBlockProps = {
  content: string;
  languageLabel?: string;
};

export function CodeBlock({
  content,
  languageLabel = "text",
}: CodeBlockProps) {
  return (
    <div className="rounded-2xl border border-border bg-[#0b1224]">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs uppercase tracking-[0.3em] text-text-muted">
        <span>{languageLabel}</span>
        <span className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-[#f87171]" aria-hidden />
          <span className="h-2 w-2 rounded-full bg-[#facc15]" aria-hidden />
          <span className="h-2 w-2 rounded-full bg-[#4ade80]" aria-hidden />
        </span>
      </div>
      <pre className="overflow-x-auto px-4 py-5 text-xs leading-6 text-text-muted">
        <code>{content}</code>
      </pre>
    </div>
  );
}
