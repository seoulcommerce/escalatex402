# Escalatex402

**Paid escalation inbox (self-hosted) using HTTP 402 + Solana Pay.**

A developer runs a small service that exposes a single public intake endpoint. Humans *or agents* can submit an escalation request and get an immediate response:
- `200 accepted` (free / allowlisted — future)
- `402 payment_required` with a standardized x402-style payload + **Solana Pay** link
- `409 busy` with next availability + optional **interrupt tier** quote

When a matching USDC payment is detected on Solana, the provider is notified on Telegram (via OpenClaw).

## Quick start
```bash
npm install
npm run dev
# open http://127.0.0.1:8787
```

## Well-known protocol (what agents should use)

The protocol spec lives at: `docs/spec/0.1.md`.

Additional docs:
- Support matrix: `docs/support-matrix.md`
- Storage strategy: `docs/storage.md`

### `GET /.well-known/escalatex` — capabilities document
Machine-discoverable profile so agents can decide whether to post.

Example:
```bash
curl http://127.0.0.1:8787/.well-known/escalatex
```

### `POST /.well-known/escalatex` — intake
Canonical “paid inbox” endpoint.

Example:
```bash
curl -X POST http://127.0.0.1:8787/.well-known/escalatex \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-1' \
  -d '{"subject":"Need help debugging my 402 verifier","details":"USDC payment not detected","desired_tier":"2h"}'
```

Response envelope:
- HTTP 200 with `status: accepted | requires_payment`
- HTTP 409 with `status: busy`

When `status=requires_payment`, response includes a Solana Pay `pay_url` plus `recipient`, `amount`, `mint`, `reference`, `memo`.

## Implementation endpoints (used by the demo UI)
These are internal helpers; the public protocol is the well-known endpoint above.

- `POST /requests` — internal create
- `GET /requests/:id` — returns **402** JSON until paid
- `POST /requests/:id/check` — scans recent on-chain txs and marks paid
- `POST /requests/:id/confirm-paid` — verify by tx signature
- `GET /r/:id` — receipt page
- `GET /admin/requests` — recent requests

## Payment intent binding (important)
Payments are bound to a request using both:
- `memo`: `Escalatex402:REQ:<requestId>:REF:<reference>`
- `reference`: a unique public key included in the Solana Pay URL

Verification requires the USDC delta to the provider wallet **and** the memo/reference match.

## Provider notifications (Telegram)

For hosted deployments (Render, etc.) the app can send Telegram notifications directly.

Set env vars:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID` (for Stevie: `432269510`)
- `PUBLIC_BASE_URL` (e.g. `https://escalatex402.onrender.com`) so receipt links are clickable

(Alternative: route notifications via OpenClaw, but that requires network access between the hosted app and your OpenClaw instance.)

## Config
Defaults live in `src/config.js` (tiers, working hours, handle). Override via env or a future `escalatex.config.json`.
