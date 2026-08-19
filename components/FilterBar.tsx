"use client";

import { cn } from "@/lib/utils";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Horizontal scrollable segmented filter (sticky-friendly). */
export function FilterBar<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: FilterOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("scroll-thin flex gap-1.5 overflow-x-auto pb-1", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "border-accent bg-accent text-accent-ink"
                : "border-edge bg-surface-2 text-ink-dim hover:bg-surface-3 hover:text-ink"
            )}
          >
            {opt.label}
            {opt.count !== undefined ? (
              <span className={cn("tnum ml-1.5", active ? "text-accent-ink/80" : "text-ink-faint")}>
                {opt.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Labeled select for secondary filters (position, team, league, sort). */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <label className={cn("flex items-center gap-1.5 text-[11px] font-medium text-ink-faint", className)}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-edge bg-surface-2 px-2 py-1.5 text-xs font-medium text-ink focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
