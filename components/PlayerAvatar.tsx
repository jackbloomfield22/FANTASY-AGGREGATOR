import type { NormalizedPlayer, Position } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Position-colored initials avatar — the visual anchor of every player row
 * (Sleeper-style identity coding without headshots). QB pink, RB teal,
 * WR blue, TE orange, K purple, DST bronze.
 */

export const POSITION_TEXT: Record<Position, string> = {
  QB: "text-pos-qb",
  RB: "text-pos-rb",
  WR: "text-pos-wr",
  TE: "text-pos-te",
  K: "text-pos-k",
  DST: "text-pos-dst",
};

const POSITION_AVATAR: Record<Position, string> = {
  QB: "bg-pos-qb/15 text-pos-qb ring-pos-qb/30",
  RB: "bg-pos-rb/15 text-pos-rb ring-pos-rb/30",
  WR: "bg-pos-wr/15 text-pos-wr ring-pos-wr/30",
  TE: "bg-pos-te/15 text-pos-te ring-pos-te/30",
  K: "bg-pos-k/15 text-pos-k ring-pos-k/30",
  DST: "bg-pos-dst/15 text-pos-dst ring-pos-dst/30",
};

const SIZES = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-14 w-14 text-lg",
} as const;

function initials(player: NormalizedPlayer): string {
  if (player.position === "DST") return player.nflTeam.slice(0, 3);
  const a = player.firstName?.[0] ?? player.fullName[0] ?? "?";
  const b = player.lastName?.[0] ?? "";
  return `${a}${b}`.toUpperCase();
}

export function PlayerAvatar({
  player,
  size = "sm",
  className,
}: {
  player: NormalizedPlayer;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full font-black ring-1 ring-inset",
        SIZES[size],
        POSITION_AVATAR[player.position] ?? POSITION_AVATAR.WR,
        className
      )}
    >
      {initials(player)}
    </span>
  );
}
