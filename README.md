# BettorSuite

> Track the action. Test the angle. Share the edge.

BettorSuite is an all-in-one sportsbook journal, mock betting workspace, and social community. It replaces manual paper tracking with private account data, consistent performance analytics, shareable picks, and conversations built around the bets themselves.

**Current version:** `v2.5.2`

## What is in v2

- **Book Keeper** - Log straight bets and parlays, track sportsbook balances, settle results, review calendar activity, filter history, and measure profit in dollars or units.
- **Mock Betting** - Test the same ideas against a virtual bankroll without risking real money.
- **Profiles and leaderboard** - Publish tracked picks, follow bettors, compare verified performance, and see seven-day form at a glance.
- **Community** - Find groups and bettors, talk in private groups or the public War Room, and share open or settled tickets.
- **Daily Cards** - Package two or more picks by league and publish or repost them to profiles, groups, Direct Messages, or the War Room.
- **Tail a bet** - Copy an open pick into Book Keeper or Mock Betting, choose the sportsbook, set the wager, and optionally enter the price available at your own book.
- **Messages** - Send direct messages, picks, parlays, and Daily Cards one-to-one.

## Release history

### v2.5.2 - Crisp winner trophy

This visual fix replaces the raster trophy artwork with a centered native SVG trophy, removes the distracting sparkles and scaling blur, and deletes the obsolete bitmap asset while preserving the layered gold winner seal.

### v2.5.1 - Winner-seal polish

This visual patch replaces the small winner trophy with a larger, more distinctive BettorSuite winner seal. The new treatment combines a layered gold medallion, inset ring, trophy artwork, depth, and a compact WINNER ribbon while preserving readable bet details across desktop and mobile Book Keeper and Mock Betting histories.

### v2.5.0 - Moderation and interface polish

This release expands the administrator Control Room with complete user-level Book Keeper access, exact-balance admin reconciliations, wallet-history review, and audited removal of shared bet slips and Daily Cards from profiles, groups, Direct Messages, and the War Room. It also introduces a consistent BettorSuite date picker across betting forms and a new overlapping winner-trophy treatment for successful Bet History entries.

### v2.4.0 - Control Room and precision tracking

This release adds an audited administrator Control Room for account and bet moderation, private Book Keeper break-even baselines, date-aware performance ranges, custom leagues with sport-specific bet types, corrected whole-number profit-boost odds, manual payout overrides, private nicknames, clickable follow lists, account deletion, live Daily Card results, reusable cards, consolidated Group Settings, and notification sounds.

### v2.3.0 - Accountable Book Keeper

Book Keeper now behaves like a sportsbook ledger instead of a flexible simulator. Bets debit the wallet when placed and credit it when settled, financial terms lock after placement, settled results require a reasoned correction, and settled entries cannot be deleted. Deposits and withdrawals remain unlimited and auditable, while direct balance reconciliations are limited to three per calendar month. This release also fixes profile photo uploads and adds a circular crop-and-zoom editor before saving an avatar.

### v2.2.0 - BettorSuite rebrand and observability

This release renames the platform to BettorSuite, preserves the existing BS visual identity, enables Vercel Web Analytics and Speed Insights, and removes unused frontend scaffold components, legacy internal naming, redundant assets, and obsolete placeholders.

### v2.1.1 - Repository cleanup

This maintenance release removes obsolete internal agent-memory files that documented retired sports-data integrations. Application behavior and user data are unchanged.

### v2.1.0 - Messaging controls

This feature release adds persistent, per-user Direct Message notification muting, suppresses muted conversations from unread totals, centers notification badges across Messages, and replaces the ambiguous follow icon with clear Follow and Following controls.

### v2.0.0 - Community-first platform

This major release removes the legacy live sports-data ingestion surface and focuses the platform on user-entered tracking and social betting. It also adds complete group moderation, chat notification controls, leave-group support, invitation visibility in Messages, and unread message badges.

### v1.5.1 - Group ownership and deployment polish

The maintenance release cleans up misleading Vercel database warnings, standardizes the official administrator as `@admin`, and adds secure owner-only group editing, member removal, and deletion.

### v1.5.0 - Second build

The social betting release added public profiles, follows, direct messages, shared slips, tailing, Daily Cards, expanded parlays, profit boosts, unified history tools, wallet enforcement, and a profitability-first leaderboard.

### v1.0.0 - First build

The public foundation introduced secure accounts, private user-scoped data, sportsbook tracking, Mock Betting, groups, the War Room, the leaderboard, administrator access, and a Vercel-ready Express/PostgreSQL deployment.

See [CHANGELOG.md](CHANGELOG.md) for the detailed release notes.

## Technology

- React 19, TypeScript, Vite, and Tailwind CSS
- TanStack Query for client data synchronization
- Express API with Drizzle ORM and PostgreSQL
- Zod-generated API validation and types
- Vercel deployment configuration for the frontend and API
- Vercel Web Analytics and Speed Insights for privacy-conscious traffic and performance measurement

## Local development

Requirements: Node.js, pnpm `11.15.1`, and PostgreSQL.

```bash
pnpm install
cp .env.example .env.local
pnpm db:push
pnpm dev
```

The frontend runs at `http://127.0.0.1:5173` and uses the local API configured by the workspace.

## Useful commands

```bash
pnpm dev          # Start the application locally
pnpm typecheck    # Validate all TypeScript projects
pnpm build        # Type-check and build the workspace
pnpm vercel-build # Build the API and frontend for Vercel
pnpm db:push      # Apply the Drizzle schema to PostgreSQL
```

## Configuration and deployment

Copy the required names from [.env.example](.env.example). Never commit real credentials. Production setup and verification are documented in [DEPLOYMENT.md](DEPLOYMENT.md).

## Versioning

BettorSuite uses semantic versioning:

- `MAJOR` for incompatible product or data-contract changes.
- `MINOR` for backward-compatible features.
- `PATCH` for backward-compatible fixes and polish.

The current release is recorded in `VERSION` and the workspace package manifests. Each published release receives a matching Git tag such as `v2.5.2`.

## Privacy

Account data is tied to the authenticated user. No preview or demo account is included in production, and secrets must remain in local or Vercel environment variables.
