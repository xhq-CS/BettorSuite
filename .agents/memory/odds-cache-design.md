---
name: Odds cache design
description: Row-shape and replacement rules for the odds_cache table
---

- Unique index is (sport, market, playerName, line). Only `_alternate` markets are allowed multiple rows (line ladder) per participant; main player props and team markets must collapse to ONE row per participant, taken deterministically from the most-preferred bookmaker (books disagree on lines, otherwise you get duplicate rows that readers collapse arbitrarily).
- Team markets are stored in the same table with market keys `team_h2h`, `team_spreads` (playerName = team), and `team_totals` (playerName = event label "Away @ Home").
- Sync replaces a sport's rows with delete+insert inside a single transaction, and skips the replace entirely when the fetch collected zero rows (API failure must not wipe yesterday's cache).

**Why:** a code review caught both the duplicate-main-line bug and the cache-wipe-on-failure race. **How to apply:** keep these invariants when adding markets or changing sync flow.
