import Link from "next/link";
import { useState, type ReactNode } from "react";

export function EntityCard({
  href,
  title,
  meta,
  badge,
  imageUrl,
  imageAlt,
  onClick,
}: {
  href: string;
  title: string;
  meta?: ReactNode;
  badge?: ReactNode;
  imageUrl?: string | null;
  imageAlt?: string;
  onClick?: () => void;
}) {
  const mark = title.trim().charAt(0).toUpperCase() || "B";
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const src = imageUrl && failedUrl !== imageUrl ? imageUrl : null;
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex min-h-28 flex-col gap-3 rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-12 items-center justify-center overflow-hidden rounded-xl bg-secondary text-lg font-semibold text-primary">
          {src ? (
            // Stored logos are on the API host, which next/image is not set up to optimise.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={imageAlt ?? ""} className="size-full object-cover" onError={() => setFailedUrl(src)} />
          ) : (
            mark
          )}
        </span>
        {badge}
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        {meta ? <p className="mt-1 text-sm text-muted-foreground">{meta}</p> : null}
      </div>
    </Link>
  );
}
