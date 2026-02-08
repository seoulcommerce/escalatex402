# Escalatex — Support Matrix (OSS)

This document defines what we officially support for the open-source, self-hostable Escalatex reference implementation.

## Runtime

- **Node.js:** 20+ (tested on 22)
- **Package manager:** npm

## Datastores

| Mode | Status | Notes |
|---|---:|---|
| SQLite (local file) | ✅ Supported (default) | Best for single-provider/self-host quickstart |
| Postgres | 🟡 Planned | Recommended for hosted/multi-instance deployments |

## Deploy targets

| Target | Status | Notes |
|---|---:|---|
| Docker | ✅ Supported | Recommended primary install path |
| VPS (systemd/pm2) | 🟡 Documented later | Supported as “best effort” once docs land |
| Render | 🟡 Best-effort | Works, but not the primary OSS install story |
| Fly.io | 🟡 Planned | Good fit for container deploy |
| Railway | 🟡 Planned | Good fit for container deploy |
| Vercel | ❌ Not recommended | Long-running server + SQLite are a poor fit |

## Notifications

| Channel | Status | Notes |
|---|---:|---|
| Telegram | ✅ Supported | Bot token + chat id |
| Email | 🟡 Planned | Postmark/Sendgrid |
| Slack | 🟡 Planned | Webhook |

## Payments

| Network | Asset | Status | Notes |
|---|---|---:|---|
| Solana | USDC | ✅ Supported | Solana Pay URL + reference + memo binding |
| Solana | SOL | 🟡 Planned | Optional |

## Compatibility promises

- We prioritize **protocol stability** (`docs/spec/*`) over implementation internals.
- Minor releases may add optional fields but should not break v0.1 clients.
