"use client";

interface ReferenceImageCardProps {
  imagePath?: string;
  description: string;
  onClick: () => void;
}

export function ReferenceImageCard({
  imagePath,
  description,
  onClick,
}: ReferenceImageCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group overflow-hidden rounded-lg border border-border/30 bg-surface transition-all hover:border-border hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="aspect-video overflow-hidden bg-border/40">
        {imagePath ? (
          <img
            src={imagePath}
            alt={description}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              const parent = target.parentElement;
              if (parent) {
                parent.classList.add(
                  "flex",
                  "items-center",
                  "justify-center"
                );
                parent.innerHTML = `<span class="text-sm text-text-muted">Image not available</span>`;
              }
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-text-muted">No image available</span>
          </div>
        )}
      </div>
      <div className="border-t border-border/20 bg-surface-muted/50 p-3">
        <p className="line-clamp-2 text-left text-xs text-text-muted">
          {description}
        </p>
      </div>
    </button>
  );
}
