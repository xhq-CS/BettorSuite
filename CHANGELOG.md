# Changelog

All notable BettorSuite releases are documented here. The project follows
[Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

## [2.8.0] - 2026-08-21

### Added

- Persistent dark and light theme preferences with accessible desktop and mobile switches.
- A signed-in color system based on deep navy surfaces, gold primary actions, mint positive states, and restrained blue communication accents.

### Improved

- Direct Messages and group chat now use layered dark canvases, high-contrast incoming and outgoing bubbles, readable timestamps, and theme-matched composers.
- Daily Cards use quieter structural dividers, consistent dark metadata rows, and compact status treatments without bright white separators.
- Shared bet slips use subtle outer borders, low-contrast metric dividers, and clearer settled-state colors.
- Community discovery uses a dark search surface and readable result cards instead of a white gradient panel.
- Leaderboard podiums and ranking tables now preserve rank hierarchy while keeping usernames, results, ROI, and weekly form legible.
- Profit Boost controls use a restrained amber tint with a dark percentage field and a clearer enabled switch.

### Accessibility

- Increased text-to-surface contrast across the affected social and betting components and kept status meaning available through labels and icons, not color alone.

### Compatibility

- This is a backward-compatible interface release with no database migration or API contract changes.

## [2.7.0] - 2026-08-15

### Added

- An interactive signed-out landing experience that previews Book Keeper, Mock Betting, Daily Cards, public profiles, and the community before account creation.
- One-time password recovery with hashed 30-minute reset tokens, generic request responses, and transactional email support through Resend.
- An account Security page for password changes, active-session review, individual session revocation, and remote sign-out.
- User blocking, private safety reports, and privacy-rights requests with an administrator-only review inbox.
- Public Privacy Policy, Terms of Use, Community Guidelines, Responsible Gambling, and Privacy Request pages.
- Launch-ready Open Graph and X/Twitter metadata with dedicated BettorSuite share artwork.
- Database schema and migration support for reset tokens, policy consent, session metadata, user blocks, safety reports, and privacy requests.

### Changed

- Signed-out visitors now enter through the product landing page while `/login` and `/signup` remain dedicated account routes.
- Blocking is enforced across profiles, search, follows, Direct Messages, shared slips, group content, and the public War Room.
- Administrator tooling now includes report review, privacy-request status management, and safer account investigation context.
- Search-engine rules now allow the public launch and legal pages to be indexed.

### Security

- Password resets invalidate every existing session after the password is changed.
- Reset tokens are single-use and never stored in plaintext.
- Recovery responses do not reveal whether an email address belongs to an account.
- Password recovery and sensitive account actions use dedicated rate limits and authenticated ownership checks.
- Server-side filters prevent blocked accounts from bypassing interface restrictions through direct API calls.

### Deployment

- Added `RESEND_API_KEY` and `EMAIL_FROM` configuration for recovery email. The sender must be verified before password recovery can deliver production messages.
- Added `lib/db/migrations/v2.7.0.sql` for existing databases; new environments are also covered by the current Drizzle schema.

## [2.6.0] - 2026-07-31

### Bug Fixes

- Fixed private nickname persistence with an atomic database update and ensured each nickname is visible only to its creator across profiles, search, Direct Messages, groups, the War Room, and leaderboard views.

### Quality of Life

- Added Delivered and Read receipts to the latest outgoing Direct Message; Delivered confirms server persistence and Read confirms the recipient opened the conversation.
- Added Online, Idle, and Offline avatar indicators to profiles, follower lists, community search, leaderboard, Direct Messages, groups, and the War Room.
- Added activity-aware presence heartbeats, a 25-minute idle threshold, explicit logout and page-exit handling, and a server-side stale-session fallback.

## [2.5.3] - 2026-07-28

### Improved

- Restored an explicit dropdown for every supported league and sport alongside a separate optional custom-entry field.
- Replaced the small winning trophy with a larger, layered gold winner seal while preserving readable bet details across desktop and mobile.
- Replaced the scaled raster artwork with a crisp, centered native SVG trophy and removed the surrounding sparkles and obsolete bitmap asset.
- Applied the updated bet-entry and winner treatments consistently to Book Keeper and Mock Betting.
- Replaced the quiet single-frequency message ping with a louder, compressed two-note notification chime.

## [2.5.0] - 2026-07-28

### Added

- User-level Book Keeper access inside the administrator Control Room, including current wallet balance, reconciliation history, and tracked-bet review.
- Exact-balance admin reconciliations that create immutable wallet-history and moderation-audit records without consuming a member's personal monthly reconciliation allowance.
- Admin discovery and removal of shared bet slips and Daily Cards across profiles, the War Room, private groups, and Direct Messages.
- A shared, site-matched date picker for placing and configuring Book Keeper and Mock Betting entries.
- A transparent, overlapping winner-trophy accent for successful desktop and mobile Bet History entries.

### Changed

- Winning status pills now remain clean and text-only while the trophy acts as a separate celebratory history accent.
- Daily Card removal from the Control Room clearly removes the owned card and every shared copy, while individual share removal affects only that selected post.

### Security

- All new moderation endpoints remain admin-only, require a reason, verify that content belongs to the selected account, use transactional deletion or reconciliation, and write to the existing audit trail.

## [2.4.0] - 2026-07-28

### Added

- An admin-only Control Room with account search, audited profile moderation, user bet review, result correction, wallet-safe bet reversal, data-only resets, permanent account deletion, and an audit trail.
- Optional private Book Keeper break-even baselines and owner-only Today, Week, Month, and All-Time performance views.
- Optional bet dates, custom leagues, sport-specific bet menus, private nicknames, clickable follower/following lists, and self-service account deletion.
- Optional manual Total Payout values in Book Keeper and Mock Betting.
- Daily Card reposting, live pick-result synchronization, and support for two-pick cards.
- Consolidated Group Settings and a subtle unread-message notification sound.

### Changed

- Corrected profit boosts to calculate and display whole-number boosted American odds while preserving the original odds.
- Renamed remaining Potential Payout labels to Total Payout and restored Pending terminology throughout betting surfaces.
- Bet calendars, profit curves, leaderboard streaks, and profile streaks now use the selected bet date in the application timezone.
- Winning history rows now include a site-matched trophy treatment.

### Fixed

- Corrected the `-122` plus `25%` boost case to `+103`, producing a `$20.30` total payout on a `$10` wager.
- Corrected weekday alignment and per-day P&L in seven-day form strips.
- Kept Daily Card results current across profiles, groups, Direct Messages, and the War Room after a source bet is settled.

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

[2.8.0]: https://github.com/xhq-CS/BettorSuite/compare/v2.7.0...v2.8.0
[2.7.0]: https://github.com/xhq-CS/BettorSuite/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/xhq-CS/BettorSuite/compare/v2.5.3...v2.6.0
[2.5.3]: https://github.com/xhq-CS/BettorSuite/compare/v2.5.0...v2.5.3
[2.5.0]: https://github.com/xhq-CS/BettorSuite/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/xhq-CS/BettorSuite/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/xhq-CS/BettorSuite/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/xhq-CS/BettorSuite/compare/v2.1.1...v2.2.0
[2.1.1]: https://github.com/xhq-CS/BettorSuite/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/xhq-CS/BettorSuite/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/xhq-CS/BettorSuite/compare/v1.5.1...v2.0.0
[1.5.1]: https://github.com/xhq-CS/BettorSuite/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/xhq-CS/BettorSuite/compare/v1.0.0...v1.5.0
[1.0.0]: https://github.com/xhq-CS/BettorSuite/releases/tag/v1.0.0
