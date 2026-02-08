# Escalate402

Paid escalation for in-demand developers: request support, get accepted/quoted, receive an x402 (HTTP 402) payment request, pay on Solana, and the provider is notified on Telegram.

## Dev
```bash
npm install
npm run dev
```

## Endpoints (planned)
- `POST /requests`
- `GET /requests/:id` (returns 402 until paid)
- `POST /providers/:id/evaluate`

