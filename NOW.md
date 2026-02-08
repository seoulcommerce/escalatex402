# NOW — Escalate402

## Goal
Paid escalation for in-demand devs: request support → accept/quote → x402 (HTTP 402) payment request → Solana settlement → provider notified on Telegram.

## Current status
- Colosseum project created (draft).
- Repo scaffold pushed.
- MVP server endpoints implemented:
  - POST /requests
  - GET /requests/:id (402 until paid)
  - POST /requests/:id/confirm-paid (manual)
  - GET /admin/requests

## Next steps
1) Add real Solana USDC verification (Helius RPC) instead of manual confirm.
2) Add provider Telegram notification path via OpenClaw message tool (polling or webhook).
3) Add simple frontend page for demo.

