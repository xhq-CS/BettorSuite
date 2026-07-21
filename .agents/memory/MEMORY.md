# Memory Index

- [Odds & stats API constraints](odds-api-constraints.md) — free-tier quirks of The Odds API and API-Sports that shaped the daily sync design; re-read before touching sync code.
- [Odds cache design](odds-cache-design.md) — one row per participant for main/team markets, per-line rows only for `_alternate` markets; replace per sport in a transaction, never clear on empty fetch.
