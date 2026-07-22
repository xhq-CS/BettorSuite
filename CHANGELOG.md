# Changelog

All notable BettorStats releases are documented here. The project follows
[Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

## [1.5.1] - 2026-07-22

### Added

- Owner-only group editing with validated names and descriptions.
- Confirmed member removal and permanent group deletion controls.

### Fixed

- Migrated the official administrator identity from `@andy_admin` to `@admin` while preserving its account data.
- Normalized PostgreSQL SSL verification so successful Vercel requests no longer appear as runtime errors.
- Corrected shared modal positioning and mobile width so confirmation forms stay fully visible.

## [1.5.0] - 2026-07-21

### Second build - social betting

BettorStats grows from a personal tracking app into a social betting platform while keeping account data private and user-scoped.

### Added

- Public profiles with avatars, bios, follows, tracked performance, filters, and seven-day form.
- Direct messages and group access from both Community and Messages.
- Shareable straight bets, parlays, winning tickets, open slips, and daily cards.
- Tail flows for Book Keeper and Mock Betting with wallet limits and optional user-entered odds.
- Daily Card publishing from profiles, groups, and the public War Room.
- Parlay leg editors, expandable histories, profit boosts, and unit-based reporting.
- Community search for people and groups, plus clickable leaderboard profiles.

### Improved

- Renamed Bet Tracker to Book Keeper.
- Rebuilt Book Keeper and Mock Betting histories, calendars, charts, wallets, filters, and settlement controls around the same interaction model.
- Ranked the leaderboard by profitability and added Monday-to-Sunday form indicators.
- Made chats feel like modern messaging, with multiline input, editing, deletion, bet sharing, and tail actions.
- Tightened responsive layouts, spacing, table alignment, status sizing, modal behavior, notifications, and financial formatting.

## [1.0.0] - 2026-07-21

### First build - public foundation

The first deployable BettorStats release replaced manual betting records with one private account for sportsbook tracking, risk-free mock betting, and community discussion.

### Added

- Secure account registration, login, session handling, and user-scoped PostgreSQL data.
- Book Keeper fundamentals for logging, settling, editing, deleting, and reviewing real sportsbook bets.
- Mock Betting with a virtual bankroll, unit configuration, wallet controls, profit reporting, and history.
- Community foundations with groups, group chat, the public War Room, and leaderboard.
- Admin login and production-ready Vercel routing, API bundling, security headers, and database configuration.

[1.5.1]: https://github.com/xhq-CS/BettorStats-V1/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/xhq-CS/BettorStats-V1/compare/v1.0.0...v1.5.0
[1.0.0]: https://github.com/xhq-CS/BettorStats-V1/releases/tag/v1.0.0
