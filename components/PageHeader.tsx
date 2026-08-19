import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-4 flex flex-wrap items-end justify-between gap-2", className)}>
      <div>
        <h1 className="text-xl font-black uppercase tracking-wide text-ink">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-dim">{subtitle}</p> : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </header>
  );
}
