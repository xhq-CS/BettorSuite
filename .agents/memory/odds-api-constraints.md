---
name: Odds & stats API constraints
description: Free-tier quirks of The Odds API and API-Sports that constrain the daily sync
---

**The Odds API (free, ~500 req/mo):**
- Player props require the per-event endpoint; multiple markets (main + `_alternate`) batch into ONE call per event — always batch.
- Team markets (h2h, spreads, totals) come from the base `/sports/{key}/odds` endpoint — one call per sport.
- Sync caps at 4 events per sport to stay within quota (~10-25 calls/day total).

**API-Sports (free plan):**
- NBA only for stats; WNBA/MLB hosts return empty/plan errors.
- NBA seasons limited to 2022–2024.
- `/players?search=` works ONLY by last name and WITHOUT a season param (adding season demands a team param). Some stars (Jokic, Giannis, Embiid, SGA, Butler) never match on free plan.
- Season averages must be computed client-side from `/players/statistics?id&season` per-game logs.

**Why:** re-discovering these costs live API quota. **How to apply:** whenever modifying the daily sync or adding markets, batch alternate/main markets in one per-event call and never add per-market calls.
