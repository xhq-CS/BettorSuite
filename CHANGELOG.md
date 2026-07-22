# Changelog

All notable BettorSuite releases are documented here. The project follows
[Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

## [2.3.0] - 2026-07-22

### Added

- An auditable Book Keeper wallet ledger covering initial setup, deposits, withdrawals, wagers, payouts, refunds, bet removals, and settled-result corrections.
- Three reasoned sportsbook-balance reconciliations per user per calendar month, with deposits and withdrawals excluded from the limit.
- Recent wallet activity and reconciliation availability in the Book Keeper wallet manager.
- A circular profile photo editor with drag positioning, zoom, reset, validation, and optimized WebP output.

### Changed

- Locked wager, odds, bet type, parlay legs, and profit boosts after a Book Keeper bet is placed.
- Limited open-entry removal to pending bets and required a reason; settled bets remain in the permanent ledger.
- Required a reason to correct a settled result and prevented settled bets from being reopened.
- Kept Mock Betting flexible for strategy testing while making Book Keeper reflect real sportsbook activity.

### Fixed

- Repaired profile photo selection and upload across production security settings.
- Kept Book Keeper wallet changes synchronized with bet placement, settlement, corrections, and open-entry removal.

## [2.2.0] - 2026-07-22

### Added

- Vercel Web Analytics and Speed Insights instrumentation at the application root.
- Production-side enablement for both Vercel observability products.

### Changed

- Renamed the product from BettorStats to BettorSuite across the interface, metadata, documentation, and generated API descriptions.
- Renamed the frontend workspace from the retired `propedge` identifier to `bettorsuite`.
- Renamed public brand assets while preserving the existing BS mark.

### Removed

- Unused shadcn scaffold components and their now-unneeded frontend dependencies.
- A redundant full-size logo asset, obsolete placeholder files, and temporary image-generation output.

### Compatibility

- Kept the existing session cookie identifier so signed-in users are not logged out by the rebrand.

## [2.1.1] - 2026-07-22

### Removed

- Obsolete `.agents` memory files for the retired odds, stats, and scheduled sports-data integrations.

### Maintenance

- Reduced repository-only metadata without changing application behavior, production data, or public APIs.

## [2.1.0] - 2026-07-22

### Added

- Persistent per-user mute and unmute controls for Direct Message conversations.
- A documented Direct Message notification preference endpoint and generated client contracts.

### Improved

- Muted Direct Messages no longer contribute to global or conversation-level unread badges.
- Centered unread counts inside consistently sized navigation, group, and Direct Message badges.
- Replaced the ambiguous follow icon in Messages search with explicit Follow and Following buttons.
- Improved responsive wrapping for Direct Message header actions.

## [2.0.0] - 2026-07-22

### Added

- Unread Messages navigation badges covering direct messages, group messages, and pending group invitations.
- Per-user group notification muting and self-service group leaving.
- Owner and platform-admin group moderation for member removal, posting mutes, message removal, group editing, and group deletion.
- Hidden moderation state so only owners and administrators can see which members are muted.
- Context-aware group navigation that returns users to Messages or Community based on where the group was opened.

### Improved

- Unified muted-channel copy and enforced posting permissions on both the client and server.
- Made group invitation activity visible and actionable inside Messages.
- Reworked group membership counts and read timestamps for reliable unread state.

### Removed

- Live sports score, news, leader, team, player, and trending-stat API routes.
- External ESPN sports-data requests and all related player/team/stat route implementations.
- Player, team, game-stat, odds-cache, player-stat-cache, and scheduled-sync database schema source.
- Player/team/trending OpenAPI operations, generated client methods, validators, and types.

### Breaking changes

- Removed `/api/players`, `/api/teams`, `/api/stats/trending`, and `/api/livestats` endpoints. BettorStats now treats league and bet details as user-entered tracker metadata and does not ingest external sports data.

## [1.5.1] - 2026-07-22

### Added

- Owner-only group editing with validated names and descriptions.
- Confirmed member removal and permanent group deletion controls.

### Fixed

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

[2.3.0]: https://github.com/xhq-CS/BettorSuite/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/xhq-CS/BettorSuite/compare/v2.1.1...v2.2.0
[2.1.1]: https://github.com/xhq-CS/BettorSuite/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/xhq-CS/BettorSuite/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/xhq-CS/BettorSuite/compare/v1.5.1...v2.0.0
[1.5.1]: https://github.com/xhq-CS/BettorSuite/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/xhq-CS/BettorSuite/compare/v1.0.0...v1.5.0
[1.0.0]: https://github.com/xhq-CS/BettorSuite/releases/tag/v1.0.0
