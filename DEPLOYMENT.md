# Vercel deployment

## 1. Create the project

Import this repository into Vercel and keep the project root set to the repository root. `vercel.json` contains the Vite build, static output, SPA routing, Express function, and security headers.

## 2. Connect PostgreSQL

Create a serverless PostgreSQL database and add its pooled connection string as `DATABASE_URL` in Vercel for Production and Preview.

Apply the schema once from a trusted local shell or CI environment:

```bash
DATABASE_URL="postgresql://..." pnpm --filter @workspace/db push
```

Do not run schema pushes as part of every Vercel build.

Version `v2.3.0` adds the `tracker_wallet_transactions` ledger table. Apply the schema before promoting this release so Book Keeper wallet activity can be recorded safely.

## 3. Add environment variables

Copy the names from `.env.example` into Vercel Project Settings → Environment Variables. Use different administrator passwords for Preview and Production. Never commit real values.

Required: `DATABASE_URL`, `APP_ORIGIN`, `ADMIN_EMAIL`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` (14+ characters).

Password recovery also requires `RESEND_API_KEY` and `EMAIL_FROM`. Install Resend from the Vercel Marketplace or add an API key manually, verify the sending domain, and set `EMAIL_FROM` to a monitored address such as `BettorSuite Security <security@example.com>`. Until these are configured, the API intentionally does not send reset mail.

## 4. Deploy and verify

- `/api/healthz` returns `{ "status": "ok" }`
- `/admin/login` displays the administrator login
- `/` displays the public BettorSuite product tour for signed-out visitors
- `/login`, `/signup`, `/forgot-password`, and `/reset-password` provide account access and recovery
- `/privacy`, `/terms`, `/community-guidelines`, `/responsible-gambling`, and `/privacy-request` are publicly available
- Registration, login, logout, Book Keeper, Mock Betting, Community, War Room, Groups, and Leaderboard work with the production database

No preview or demo account is included in the application. Create the first administrator with the configured `ADMIN_EMAIL`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` values.

## 5. Observability

Enable Web Analytics and Speed Insights in the Vercel project, then keep the root-level `Analytics` and `SpeedInsights` components mounted in the frontend application. After deployment, verify that these paths return JavaScript successfully:

- `/_vercel/insights/script.js`
- `/_vercel/speed-insights/script.js`

Traffic analytics and Core Web Vitals begin populating after visitors use the production site.
