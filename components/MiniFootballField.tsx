import type { NormalizedNFLGame } from "@/lib/types";
import { cn, downDistanceLabel, fieldPositionLabel } from "@/lib/utils";

/**
 * Reusable horizontal mini football field.
 *
 * Reads: "my player's offense is N yards from the end zone" at a glance.
 * The possessing team drives left -> right; the right 20 yards shade red
 * when the ball is inside them.
 */
export function MiniFootballField({
  game,
  className,
  compact = false,
}: {
  game: NormalizedNFLGame;
  className?: string;
  compact?: boolean;
}) {
  const hasBall = game.ballYardLine !== null && game.possessionTeam !== null;
  if (!hasBall) return null;

  const yard = game.ballYardLine!;
  const offense = game.possessionTeam!;
  const defense = offense === game.homeTeam ? game.awayTeam : game.homeTeam;

  // Geometry: 30px end zones, 280px of field (2.8 px per yard).
  const EZ = 30;
  const FIELD = 280;
  const W = EZ * 2 + FIELD;
  const H = compact ? 44 : 56;
  const ballX = EZ + (yard / 100) * FIELD;
  const inRedZone = game.redZone;
  const fieldPos = fieldPositionLabel(game);
  const downDist = downDistanceLabel(game);

  return (
    <figure className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${offense} ball at ${fieldPos ?? "unknown"}${inRedZone ? ", red zone" : ""}`}
        className="block w-full"
      >
        {/* field */}
        <rect x={EZ} y={4} width={FIELD} height={H - 20} rx={3} className="fill-field" />
        {/* red zone shading (final 20 yards before the defense's goal line) */}
        <rect
          x={EZ + 0.8 * FIELD}
          y={4}
          width={0.2 * FIELD}
          height={H - 20}
          className={inRedZone ? "fill-redzone/35" : "fill-field-line/25"}
        />
        {/* yard lines */}
        {Array.from({ length: 9 }).map((_, i) => (
          <line
            key={i}
            x1={EZ + ((i + 1) / 10) * FIELD}
            x2={EZ + ((i + 1) / 10) * FIELD}
            y1={5}
            y2={H - 17}
            className="stroke-field-line"
            strokeWidth={1}
          />
        ))}
        {/* end zones */}
        <rect x={0} y={4} width={EZ} height={H - 20} rx={3} className="fill-surface-3" />
        <rect x={EZ + FIELD} y={4} width={EZ} height={H - 20} rx={3} className={inRedZone ? "fill-redzone/60" : "fill-surface-3"} />
        <text
          x={EZ / 2}
          y={H / 2 - 3}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-ink-dim"
          fontSize={9}
          fontWeight={700}
        >
          {offense}
        </text>
        <text
          x={EZ + FIELD + EZ / 2}
          y={H / 2 - 3}
          textAnchor="middle"
          dominantBaseline="central"
          className={inRedZone ? "fill-white" : "fill-ink-dim"}
          fontSize={9}
          fontWeight={700}
        >
          {defense}
        </text>
        {/* drive direction */}
        <path
          d={`M ${ballX + 8} ${H - 22} l 10 3.5 l -10 3.5 z`}
          className="fill-ink-faint"
          opacity={ballX + 22 < EZ + FIELD ? 1 : 0}
        />
        {/* ball marker (static — no animation) */}
        <circle
          cx={ballX}
          cy={H / 2 - 3}
          r={4.5}
          className={inRedZone ? "fill-redzone" : "fill-ink"}
          stroke="var(--bg)"
          strokeWidth={1.5}
        />
      </svg>
      {!compact && (
        <figcaption className="mt-0.5 flex items-center justify-between text-[10px] font-medium text-ink-dim">
          <span className="tnum">
            {offense} ball{fieldPos ? ` · ${fieldPos}` : ""}
          </span>
          <span className="tnum">
            {downDist ?? ""}
            {inRedZone ? (downDist ? " · " : "") + "RED ZONE" : ""}
          </span>
        </figcaption>
      )}
    </figure>
  );
}
