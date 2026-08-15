<p align="center">
  <img src="./artifacts/bettorsuite/public/brand/bettorsuite-mark-512.png" width="104" alt="BettorSuite logo" />
</p>

<h1 align="center">BettorSuite</h1>

<p align="center">
  <strong>Track the action. Test the angle. Share the edge.</strong>
</p>

<p align="center">
  A private sportsbook journal, risk-free strategy lab, and social betting community.<br />
  No paper slips. No spreadsheet archaeology. Just the ledger, the lab, and the people who get it.
</p>

<p align="center">
  <a href="https://github.com/xhq-CS/BettorSuite/releases/latest"><img alt="Latest release" src="https://img.shields.io/badge/release-v2.7.0-3866e8?style=flat-square" /></a>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-149eca?style=flat-square&logo=react&logoColor=white" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-backed-4169e1?style=flat-square&logo=postgresql&logoColor=white" />
  <img alt="Vercel" src="https://img.shields.io/badge/Vercel-ready-000000?style=flat-square&logo=vercel&logoColor=white" />
</p>

![BettorSuite product artwork](./artifacts/bettorsuite/public/bettorsuite-social.png)

## The pitch

BettorSuite gives bettors one clean home for the full loop: record real sportsbook action, test ideas without risking money, package picks into Daily Cards, and talk through the card with a community. Performance comes from tracked results—not victory-lap screenshots.

> **BettorSuite is not a sportsbook.** It does not accept wagers, move gambling funds, or provide live sports data. Every bet and result is entered by the user.

## Pick your lane

| Area | What it does | The point |
| --- | --- | --- |
| **Book Keeper** | Logs straight bets and parlays against a sportsbook-style wallet with controlled reconciliations and an audit trail. | A record you can trust, even when the week gets loud. |
| **Mock Betting** | Runs the same ideas against a flexible virtual bankroll. | Test the angle before you pay tuition. |
| **Profiles + Leaderboard** | Publishes tracked picks, form, ROI, units, and Daily Cards. | Receipts over noise. |
| **Community** | Connects the War Room, private groups, Direct Messages, shared slips, and tail flows. | Less screenshot spam. More context. |
| **Control Room** | Gives administrators audited moderation, account support, content controls, and safety reports. | Serious tools without a cockpit full of clutter. |

## What ships in the suite

- Straight bets, parlays, expandable legs, profit boosts, manual payouts, custom leagues, and sport-aware bet types.
- Dollar and unit reporting, calendar views, result filters, profit curves, wallet history, break-even baselines, and seven-day form.
- Public picks and profiles, follows, private nicknames, presence, delivery/read receipts, and clickable leaderboards.
- Daily Cards with two or more picks that can be posted once, reused, and shared to profiles, groups, DMs, or the War Room.
- Tail flows that copy an open pick into Book Keeper or Mock Betting while letting the user choose their own wager, sportsbook, and available odds.
- Group ownership, invites, member roles, chat controls, moderation, notification muting, and context-aware navigation.
- Account recovery, password changes, session management, account deletion, user blocking, private reporting, and privacy requests.

## Current release

### v2.7.0 — Public Launch & Trust Layer

BettorSuite has a real front door now—and a proper lock.

- Added an interactive signed-out landing experience with direct login and sign-up paths.
- Added one-time password recovery, password changes, active-session management, and remote sign-out.
- Added user blocking, reporting, privacy requests, and a dedicated administrator safety inbox.
- Added public Privacy, Terms, Community Guidelines, and Responsible Gambling pages.
- Added launch-ready social metadata, share artwork, and search-engine indexing rules.
- Tightened blocked-user visibility and interaction rules across the War Room, groups, DMs, profiles, search, and shared content.

Read the full [changelog](./CHANGELOG.md) or the [v2.7.0 release notes](./docs/releases/v2.7.0.md).

## How the product fits together

```text
React + Vite client
        │
        ▼
Express API ───── account, betting, social, moderation, safety
        │
        ▼
Drizzle ORM + PostgreSQL
```

| Workspace | Responsibility |
| --- | --- |
| `artifacts/bettorsuite` | React application, responsive UI, routes, and client state |
| `artifacts/api-server` | Express API, authentication, business rules, and moderation |
| `lib/db` | Drizzle schema, migrations, and database access |
| `lib/api-spec` | OpenAPI source contract |
| `lib/api-zod` | Generated runtime validation and API types |
| `lib/api-client-react` | Generated typed React client |

## Stack

- React 19, TypeScript, Vite, and Tailwind CSS
- TanStack Query for client data synchronization
- Express 5, Drizzle ORM, and PostgreSQL
- Zod-generated request validation and API types
- Vercel Functions, Web Analytics, and Speed Insights
- Resend-compatible transactional email for account recovery

## Run it locally

### Requirements

- Node.js 24.x
- pnpm `11.15.1`
- A PostgreSQL database

### Setup

```bash
git clone https://github.com/xhq-CS/BettorSuite.git
cd BettorSuite
pnpm install
cp .env.example .env.local
pnpm db:push
```

Start the API in one terminal:

```bash
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/api-server start
```

Start the web app in another:

```bash
pnpm dev
```

The app opens at `http://127.0.0.1:5173` and proxies `/api` to `http://127.0.0.1:3000` by default.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled PostgreSQL connection string |
| `APP_ORIGIN` | Yes | Canonical production URL used for CORS, cookies, and recovery links |
| `ADMIN_EMAIL` | Yes | Bootstrap administrator email |
| `ADMIN_USERNAME` | Yes | Bootstrap administrator username |
| `ADMIN_PASSWORD` | Yes | Bootstrap administrator password; minimum 14 characters |
| `RESEND_API_KEY` | For recovery email | Sends password-reset mail |
| `EMAIL_FROM` | For recovery email | Verified sender identity for reset mail |
| `LOG_LEVEL` | No | Server logging level; defaults to `info` |

Copy names from [`.env.example`](./.env.example), keep real values out of Git, and read the full [deployment guide](./DEPLOYMENT.md) before shipping.

## Quality gates

```bash
pnpm typecheck     # Validate every TypeScript workspace
pnpm build         # Type-check and build the complete project
pnpm vercel-build  # Reproduce the production Vercel build
```

## Release track

Releases follow [Semantic Versioning](https://semver.org/). The newest release always comes first.

| Version | Release | Focus |
| --- | --- | --- |
| `v2.7.0` | Public Launch & Trust Layer | Landing, recovery, session security, blocking, reports, and legal surfaces |
| `v2.6.0` | Live Social Presence | Presence, read receipts, and reliable private nicknames |
| `v2.5.3` | Clearer Bet Entry | League selection, winner polish, and louder message alerts |
| `v2.5.0` | Moderation & Interface Polish | Admin Book Keeper support, audited reconciliation, and content controls |
| `v2.4.0` | Control Room & Precision Tracking | Admin operations, break-even tracking, custom markets, and Daily Card sync |
| `v2.3.0` | Accountable Book Keeper | Strict wallet ledger, reconciliation limits, and profile photo editing |
| `v2.2.0` | BettorSuite Rebrand | Product rename, observability, and repository cleanup |
| `v2.0.0` | Community-First Platform | Group moderation, notifications, and removal of external sports-data APIs |
| `v1.5.0` | Social Betting | Profiles, DMs, shared slips, tailing, and Daily Cards |
| `v1.0.0` | Public Foundation | Private accounts, tracking, Mock Betting, community, and Vercel deployment |

The repository `VERSION` file and every workspace package manifest carry the same release number. Small fixes and quality-of-life changes stay grouped under those categories in both the changelog and GitHub Releases.

## Privacy, safety, and responsible use

- Account data is scoped to the authenticated user; no preview or demo account ships in production.
- Password-reset tokens are one-time, expire after 30 minutes, and are stored as hashes.
- Blocking and moderation rules are enforced by the API, not only hidden in the interface.
- BettorSuite does not guarantee profit or promote chasing losses. Users are responsible for following the laws and age requirements where they live.
- Public policy pages are product-ready templates, not legal advice. The final operator identity, contact details, jurisdiction, and business practices should be reviewed by qualified counsel before a broad launch.

## Release history

Detailed, latest-first release notes live in [CHANGELOG.md](./CHANGELOG.md). Published builds are available on the [GitHub Releases page](https://github.com/xhq-CS/BettorSuite/releases).
