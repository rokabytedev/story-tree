type EmptyStateProps = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface-muted/40 px-6 py-12 text-center">
      <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
      <p className="mt-2 text-sm text-text-muted">{message}</p>
    </div>
  );
}
