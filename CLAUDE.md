# Fantasy Aggregator — project guide

Live fantasy football portfolio command center. Next.js 16 (App Router) + TypeScript + Tailwind 4 + optional Supabase. See README.md for full architecture.

## Commands

```bash
npm run dev        # dev server
npm test           # vitest (lib/**/*.test.ts)
npm run lint       # eslint (zero warnings expected)
npx tsc --noEmit   # typecheck
npm run build      # production build — must pass before pushing
```

## Workflow

- Push directly to `main` (repo owner's preference). Keep `main` green: lint + tsc + tests + build before every push.
- No secrets in git. New env vars go in `.env.example` with a comment.

## Architecture rules (do not break)

- **Two provider families, never conflated**: fantasy providers (`lib/providers/fantasy/*`, who you own + league scoring) vs live NFL providers (`lib/providers/live/*`, raw football reality). They join only in `lib/server/portfolio.ts`.
- **Normalization boundary**: components/pages only see the normalized types in `lib/types.ts`. Raw Sleeper/Sportradar payloads never leave their provider module.
- **One canonical player** per NFL player, with `providerIds` (sleeper/sportradar/espn/yahoo) used for cross-provider joins. Never create per-league player objects.
- **Scoring is local**: live providers return raw stat lines (Sleeper-style keys); `lib/scoring/engine.ts` applies each league's own settings. Never let a provider compute fantasy points for display (Sleeper `players_points` is only a fallback when no live stats exist, via `RosterSlot.providerPoints`).
- **Portfolio impact excludes bench** (starters-only sum); bench points shown separately. Exposure = rostered/total and starting/total. These are tested — keep tests passing.
- **One batched snapshot**: the UI polls `GET /api/portfolio` only. No per-player fetches, no N+1.
- **Demo is deterministic**: `lib/demo/simulation.ts` is a pure function of wall-clock time on a 50-min scripted cycle. No `Math.random()` at request time; new demo data must keep `simulation.test.ts` determinism tests green.
- **No scraping** of authenticated/private fantasy endpoints (ESPN stays "Coming Soon" until a supported API exists). No fake OAuth. Sleeper's public, unauthenticated stats/projections/schedule endpoints (`api.sleeper.app`) are allowed by owner decision — they power the real live layer; parse them defensively (they're not in Sleeper's written docs).
- **Secrets are server-only** (`SPORTRADAR_API_KEY`, Yahoo credentials): only touched in server routes / `lib/server/*` / provider modules with `import "server-only"` where applicable.

## Conventions

- Styling: Tailwind utilities against the design tokens in `app/globals.css` (`bg-surface`, `text-ink-dim`, `text-live`, `redzone-glow`, `tnum`, …). Dark is the default theme; light overrides come from `[data-theme="light"]` + system fallback. Don't hardcode hex colors in components.
- Status must never be color-only — pair color with text/icon (see `StatusBadge`, `MatchupStatusBadge`).
- Client pages wrap content in `DataGate` (skeleton → error → data). New pages should follow `app/(app)/players/page.tsx` as the pattern.
- Session state lives in cookies (`fa-demo`, `fa-demo-epoch`, `fa-sleeper`) — helpers in `lib/server/session.ts`. Route protection in `proxy.ts`.
- Analytics: fire-and-forget `track()` from `lib/analytics.ts`; add new event names to its union type.
- Demo player names are fictional — never introduce real NFL player names into `lib/demo/data.ts`.
