# BettorStats

> Track the action. Test the angle. Share the edge.

BettorStats is an all-in-one sportsbook journal, mock betting simulator, and social community. It replaces manual paper tracking with private account data, consistent performance analytics, shareable picks, and conversations built around the bets themselves.

**Current version:** `v1.5.1`

## What is in v1.5

- **Book Keeper** - Log straight bets and parlays, track sportsbook balances, settle results, review calendar activity, filter history, and measure profit in dollars or units.
- **Mock Betting** - Test the same ideas against a virtual bankroll without risking real money.
- **Profiles and leaderboard** - Publish tracked picks, follow bettors, compare verified performance, and see seven-day form at a glance.
- **Community** - Find groups and bettors, talk in private groups or the public War Room, and share open or settled tickets.
- **Daily Cards** - Package three or more picks by league and publish them to a profile, group, or the War Room.
- **Tail a bet** - Copy an open pick into Book Keeper or Mock Betting, choose the sportsbook, set the wager, and optionally enter the price available at your own book.
- **Messages** - Send direct messages, picks, parlays, and Daily Cards one-to-one.

## Release history

### v1.5.1 - Group ownership and deployment polish

The maintenance release cleans up misleading Vercel database warnings, standardizes the official administrator as `@admin`, and adds secure owner-only group editing, member removal, and deletion.

### v1.0.0 - First build

The public foundation introduced secure accounts, private user-scoped data, sportsbook tracking, Mock Betting, groups, the War Room, the leaderboard, administrator access, and a Vercel-ready Express/PostgreSQL deployment.

### v1.5.0 - Second build

The social betting release added public profiles, follows, direct messages, shared slips, tailing, Daily Cards, expanded parlays, profit boosts, unified history tools, wallet enforcement, and a profitability-first leaderboard.

See [CHANGELOG.md](CHANGELOG.md) for the detailed release notes.

## Technology

- React 19, TypeScript, Vite, and Tailwind CSS
- TanStack Query for client data synchronization
- Express API with Drizzle ORM and PostgreSQL
- Zod-generated API validation and types
- Vercel deployment configuration for the frontend and API

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

BettorStats uses semantic versioning:

- `MAJOR` for incompatible product or data-contract changes.
- `MINOR` for backward-compatible features.
- `PATCH` for backward-compatible fixes and polish.

The current release is recorded in `VERSION` and the workspace package manifests. Each published release receives a matching Git tag such as `v1.5.0`.

## Privacy

Account data is tied to the authenticated user. No preview or demo account is included in production, and secrets must remain in local or Vercel environment variables.
