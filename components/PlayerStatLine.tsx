import type { Position, RawStatLine } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Position-aware compact stat line, e.g. "7 REC · 94 YDS · 1 TD". */
export function statLineText(position: Position, stats: RawStatLine | null): string {
  if (!stats) return "—";
  const parts: string[] = [];
  const n = (v: number | undefined) => v ?? 0;
  switch (position) {
    case "QB": {
      if (stats.pass_att) parts.push(`${n(stats.pass_cmp)}/${n(stats.pass_att)}`);
      if (stats.pass_yd) parts.push(`${stats.pass_yd} PA YDS`);
      if (stats.pass_td) parts.push(`${stats.pass_td} TD`);
      if (stats.pass_int) parts.push(`${stats.pass_int} INT`);
      if (stats.rush_yd) parts.push(`${stats.rush_yd} RU YDS`);
      if (stats.rush_td) parts.push(`${stats.rush_td} RU TD`);
      break;
    }
    case "RB": {
      if (stats.rush_att) parts.push(`${stats.rush_att} CAR`);
      if (stats.rush_yd !== undefined) parts.push(`${stats.rush_yd} YDS`);
      if (stats.rush_td) parts.push(`${stats.rush_td} TD`);
      if (stats.rec) parts.push(`${stats.rec} REC`);
      if (stats.rec_yd) parts.push(`${stats.rec_yd} REC YDS`);
      if (stats.rec_td) parts.push(`${stats.rec_td} REC TD`);
      break;
    }
    case "WR":
    case "TE": {
      if (stats.rec !== undefined || stats.rec_tgt !== undefined)
        parts.push(`${n(stats.rec)} REC${stats.rec_tgt ? ` (${stats.rec_tgt} TGT)` : ""}`);
      if (stats.rec_yd !== undefined) parts.push(`${n(stats.rec_yd)} YDS`);
      if (stats.rec_td) parts.push(`${stats.rec_td} TD`);
      if (stats.rush_yd) parts.push(`${stats.rush_yd} RU YDS`);
      break;
    }
    case "K": {
      const fgm =
        n(stats.fgm) ||
        n(stats.fgm_0_19) + n(stats.fgm_20_29) + n(stats.fgm_30_39) + n(stats.fgm_40_49) + n(stats.fgm_50p);
      if (fgm) parts.push(`${fgm} FG`);
      if (stats.xpm) parts.push(`${stats.xpm} XP`);
      break;
    }
    case "DST": {
      if (stats.sack) parts.push(`${stats.sack} SACK`);
      if (stats.int) parts.push(`${stats.int} INT`);
      if (stats.def_td) parts.push(`${stats.def_td} TD`);
      if (stats.pts_allow !== undefined) parts.push(`${stats.pts_allow} PA`);
      break;
    }
  }
  return parts.length > 0 ? parts.join(" · ") : "No stats yet";
}

export function PlayerStatLine({
  position,
  stats,
  className,
}: {
  position: Position;
  stats: RawStatLine | null;
  className?: string;
}) {
  return (
    <p className={cn("tnum text-xs font-medium text-ink-dim", className)}>
      {statLineText(position, stats)}
    </p>
  );
}
