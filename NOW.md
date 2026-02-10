# NOW — Escalatex402 (PAUSED)

## Status
This project is **paused** at Stevie’s request (2026-02-10).

## Where we left it
- Core protocol endpoints work and are hardened.
- Frontend exists: landing page, provider profile, request form (with QR), receipt page, demo page.
- Basic provider dashboard exists (inbox + request detail + lifecycle actions).
- Optional login-link auth exists (Telegram-delivered) behind `AUTH_ENABLED=1`.

## Next task when we resume
- **#23 Admin API: replace X-Admin-Secret with auth-based RBAC**

## Notes
If you want a clean restart later:
- confirm desired hosted mode (auth always on) vs self-host mode (secret optional)
- decide whether to ship a “single-provider mode” or introduce multi-provider handles

