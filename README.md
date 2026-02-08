# Escalate402

Paid escalation for in-demand developers: request support, get accepted/quoted, receive an x402 (HTTP 402) payment request, pay on Solana, and the provider is notified on Telegram.

## Dev
```bash
npm install
npm run dev
```

## Endpoints (MVP)
- `POST /requests`
  - creates request + returns quote + payment instructions
- `GET /requests/:id`
  - returns **402** with x402-style JSON until paid
- `POST /requests/:id/confirm-paid`
  - MVP helper (manual). Later: on-chain verification.
- `GET /admin/requests`

## Telegram notifications
For hackathon MVP we will notify the provider in Telegram **via OpenClaw** (not via a bot token inside this server).

