# OpenClaw integration notes

We want provider notifications to go to Stevie's Telegram chat via OpenClaw.

Approach:
- The app marks requests `paid` once the USDC transfer is verified.
- A small cron job (OpenClaw) runs periodically:
  - reads paid requests from SQLite
  - sends a Telegram message to chatId 432269510
  - marks the request status as `paid_notified`

This avoids shipping Telegram bot tokens inside the hackathon app.
