# Fantasy Aggregator

**Every league. Every player. One Sunday.**

Fantasy Aggregator is a live command center for your entire fantasy football portfolio. Instead of flipping between ESPN, Sleeper, Yahoo and a scores app all Sunday, connect your leagues once and see:

1. **Players** — every NFL player you roster across every league, normalized into one canonical card per player, with live stats, per-league fantasy scoring, and red-zone awareness.
2. **Teams** — every weekly fantasy matchup you're playing, with live scores, projections and win probability.
3. **NFL Games** — real games ranked by *your* fantasy exposure, with possession, field position and a mini-field visualization.
4. **Your Sunday** — a dashboard that answers "what's happening with everything I own, and am I winning?" in one glance.

The differentiating idea is the **portfolio**: the same NFL player can matter to you in several leagues at once. Fantasy Aggregator computes cross-league **exposure** and **portfolio impact** instead of showing five disconnected teams.

---

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000 → "Explore demo"
```

No configuration is required. With zero environment variables you get:

- **Demo mode** — a fully seeded, deterministic simulated NFL Sunday (5 leagues, ~33 rostered players, 9 games, live drives, red-zone moments, alerts). All demo player names are fictional.
- **Sleeper connection** — Sleeper's API is public and read-only, so entering a Sleeper username imports real leagues, rosters, starters, matchups and league scoring settings with no credentials.

Other commands:

```bash
npm test           # vitest unit tests (scoring engine, exposure, importance, demo sim)
npm run lint       # eslint
npx tsc --noEmit   # typecheck
npm run build      # production build
npm start          # serve the production build
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in what you have. Everything is optional; features light up as credentials appear.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase auth (sign up / log in) and persistence. Without them, auth pages offer demo mode instead. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, for privileged jobs (canonical player directory upkeep). |
| `SPORTRADAR_API_KEY` (+ `SPORTRADAR_ACCESS_LEVEL`) | Real live NFL data (schedule, scores, possession, field position, player stats). Server-only — never shipped to the client. |
| `YAHOO_CLIENT_ID` / `YAHOO_CLIENT_SECRET` | Enables the Yahoo OAuth connection flow. Without them Yahoo shows as "needs configuration" — no fake OAuth. |

Database schema (with RLS policies) lives in `supabase/migrations/0001_init.sql` — run it against your Supabase project (SQL editor or `supabase db push`).

## Architecture

The system has **two fundamentally different data categories**, joined in the middle:

```
FANTASY PROVIDERS                LIVE NFL PROVIDERS
(who do I own, where,            (what is actually happening
 how does my league score?)       on the field right now?)

lib/providers/fantasy/           lib/providers/live/
  base.ts    FantasyProvider       base.ts    LiveSportsProvider
  sleeper.ts real, public API      sportradar.ts real, env-gated
  demo.ts    seeded world          demo.ts    deterministic simulation
  yahoo.ts   env-gated OAuth
  espn.ts    interface only
        \\                          /
         \\                        /
   lib/server/portfolio.ts  ← provider selection + player-ID mapping
              |
      PortfolioSnapshot (one normalized payload)
              |
   lib/portfolio/aggregate.ts  ← the join: ownership × live stats
              |                   exposure, portfolio impact, game
              |                   ranking, matchup win probability
       React UI (components/, app/)
```

Key rules the codebase follows:

- **Normalization** — components never see raw Sleeper/Sportradar payloads. Every provider normalizes into the internal types in `lib/types.ts` (`NormalizedPlayer`, `NormalizedLeague`, `NormalizedRosterSlot`, `NormalizedMatchup`, `NormalizedNFLGame`, `NormalizedPlayerGameStats`).
- **One canonical player** — a player rostered in four leagues is one record with four `roster_slots`, never four player objects. Provider IDs (`sleeper`, `sportradar_id`, `espn_id`, `yahoo_id` — harvested from Sleeper's directory) live on the canonical record and are used to join fantasy ownership to live stats. When no direct ID exists, a conservative name+team+position fallback matcher is used; ambiguous players are logged and never silently merged.
- **Scoring is ours** — live providers supply *raw* football statistics only. `lib/scoring/engine.ts` computes fantasy points per league from each league's own scoring settings, so the same catch can be worth 22.4 in your PPR league and 18.9 in your half-PPR league, displayed side by side.
- **Portfolio math is isolated and tested** — `lib/portfolio/exposure.ts` (roster/starter exposure, portfolio impact excludes bench), `lib/portfolio/importance.ts` (game ranking: `starters*2 + bench`, tunable in one place), `lib/portfolio/winProbability.ts` (clearly-unofficial MVP estimate, replaceable).
- **One batched payload** — the UI polls `GET /api/portfolio` (20s while games are live, 2min otherwise, paused when the tab is hidden). No per-player requests, no N+1. Derivation is memoized client-side per snapshot.

### Provider priority

```
Fantasy:  Sleeper (connected) → Demo
Live NFL: Sportradar (SPORTRADAR_API_KEY set)
          → Sleeper weekly stats/schedule (always on for Sleeper users)
          → Demo simulation (demo fantasy only)
```

Simulated live stats are **never** mixed into real fantasy data: with Sleeper connected but no Sportradar key, the app shows Sleeper's real per-league points and matchup scores and labels the live feed as unavailable ("NO LIVE FEED" badge) instead of faking games.

### Demo mode

`lib/demo/data.ts` seeds the fictional world (5 leagues with different scoring formats, user + opponent rosters, 9 NFL games). `lib/demo/simulation.ts` runs a **deterministic 50-minute scripted cycle**: touchdowns, red-zone drives, a halftime, a game going final, an evening game kicking off — all as a pure function of wall-clock time, so polling shows believable progression and two requests at the same instant agree. "Reset Demo" (Settings) restarts the cycle via a cookie offset. A "DEMO LIVE" badge is always visible in demo mode.

### Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing (redirects into the app when a session exists) |
| `/dashboard` | Your Sunday: summary, most important game, biggest swing, live alerts, matchup strip |
| `/players`, `/players/[id]` | Portfolio player list (filters/sort) and player detail |
| `/teams`, `/teams/[id]` | Matchup list and full matchup detail (both lineups, league scoring) |
| `/games`, `/games/[id]` | NFL games ranked by your exposure; game detail with mini field |
| `/onboarding` | Provider connection flow |
| `/settings` | Connections, display (theme, compact cards), data, account |
| `/api/portfolio` | The snapshot endpoint the UI polls |
| `/api/connections/sleeper` | POST connect / DELETE disconnect |
| `/api/sync/sleeper` | POST manual "Sync Now" |
| `/api/demo/{enter,exit,reset}` | Demo session management |

Auth/entry is enforced in `proxy.ts` (Next.js middleware): protected routes require a demo cookie, a Sleeper connection, or a Supabase session.

## Adding a fantasy provider

1. Create `lib/providers/fantasy/<name>.ts` implementing `FantasyProvider` (`getUser`, `getLeagues`, `getScoringSettings`, `syncUserFantasyData`). Normalize everything into the internal types; store the provider's own IDs in `providerIds`.
2. Store unknown scoring-settings keys as-is — the scoring engine applies any key that matches a stat, and preserves the rest.
3. Wire selection in `lib/server/portfolio.ts` and add a connection card (see `components/SleeperConnectCard.tsx`).
4. Do **not** scrape private/undocumented endpoints. If there's no supported API, the provider ships as "Coming Soon" (see `espn.ts`).

## Adding a live NFL data provider

1. Create `lib/providers/live/<name>.ts` implementing `LiveSportsProvider` (`getCurrentWeek`, `getSchedule`, `getLiveGames`, `getGame`, `getPlayerGameStats`).
2. Return **raw stats** with Sleeper-compatible stat keys (`rec`, `rec_yd`, `pass_td`, …) — never fantasy points.
3. Batch per game. Attach `playerName`/`position`/`nflTeam` hints so the fallback matcher can map players lacking a direct external ID.
4. Gate on an environment variable server-side, and swap it in via `lib/server/portfolio.ts`. The UI needs no changes — that's the point of the normalized snapshot.

## Current integration status

| Integration | Status |
| --- | --- |
| Demo fantasy + demo live simulation | ✅ fully working, default |
| Sleeper (fantasy) | ✅ real, public API: username → leagues, rosters, starters/bench, matchups, per-league scoring, external player IDs |
| Sleeper (live layer) | ✅ real weekly player stat lines, projections and game statuses from Sleeper's public stats/schedule endpoints — scored locally per league; no key needed. (No clock/possession/field position — that's Sportradar.) |
| Sportradar NFL v7 | ✅ implemented, enabled by `SPORTRADAR_API_KEY` (verify endpoint payloads against your account's tier) |
| Supabase auth + schema | ✅ implemented, enabled by env vars; full RLS in migrations |
| Yahoo | 🟡 provider skeleton + OAuth URL builder; token exchange/import to be completed when credentials exist |
| ESPN / NFL Fantasy | ⏳ interface + DB support only — shown as "Coming Soon" (no scraping) |

## Testing

`npm test` covers:

- **Scoring engine** — same stat line under PPR / half-PPR / standard / custom rules produces different totals; unknown keys; negative plays.
- **Exposure** — 3-of-5 rostered = 60%, 2-of-5 starting = 40%.
- **Portfolio impact** — starters-only sum (bench excluded, reported separately).
- **Game importance** — more active starters outrank bench-only exposure.
- **Demo simulation** — deterministic per instant, progresses over time, loops cleanly, seeded shape (5 leagues, live/red-zone/final/upcoming games), and end-to-end aggregation (duplicate ownership normalization, per-league scoring differences, matchup win probabilities).

## Security notes

- All provider API keys are server-only (`SPORTRADAR_API_KEY`, Yahoo secrets); routes touching them are server routes.
- Supabase Row Level Security isolates each user's fantasy data; the shared canonical player/game tables are read-only to authenticated users.
- User input (Sleeper usernames) is validated before hitting provider APIs.
- No secrets in git; see `.env.example`.
