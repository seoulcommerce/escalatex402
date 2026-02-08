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
  -d '{"subject":"Need help debugging my 402 verifier","details":"USDC payment not detected","desired_sla":"2h"}'
```

Response includes:
- `status: requires_payment | accepted | busy`
- if `requires_payment`: `payment.payment.pay_url` (Solana Pay URL), `recipient`, `amount`, `mint`, `reference`, `memo`, `expires_at`

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
For the hackathon MVP, provider notifications are sent via **OpenClaw** (cron/poller + `message` tool), not via an embedded Telegram bot token.

## Config
Defaults live in `src/config.js` (tiers, working hours, handle). Override via env or a future `escalatex.config.json`.
