# Escalatex Protocol Spec v0.1

Status: Draft / v0.1 (frozen)

Goal: Define a minimal, composable “paid escalation inbox” protocol that any human provider (e.g., a dev) can self-host or use via a hosted provider.

---

## 0. Canonical Endpoint Rule

### 0.1 Canonical path
The canonical Escalatex endpoint for a provider is:

- `/.well-known/escalatex`

This is the only path that tools/agents should assume exists.

### 0.2 Hosted aliases
Hosted implementations MAY expose shorter vanity paths (aliases) such as:

- `https://host.tld/@handle`
- `https://handle.host.tld/`

However, these aliases MUST be equivalent to the canonical endpoint.

Recommendation for clients: accept a *provider base URL* and always probe:

- `{base_url}/.well-known/escalatex`

---

## 1. Concepts

- **Provider**: the person/service offering attention/time.
- **Requester**: a user/agent submitting a request.
- **Request**: structured message representing work/help needed.
- **Tier**: pricing + response target offering.

### 1.1 States
A request results in one of these states:

- `accepted`
- `requires_payment`
- `busy`

---

## 2. Endpoints (v0.1)

### 2.1 Provider discovery (capabilities)

`GET /.well-known/escalatex`

Returns provider capabilities (tiers, hours, identity hints, limits).

#### 200 Response (Capabilities Object)

```json
{
  "protocol": "escalatex/0.1",
  "provider": {
    "handle": "neojack",
    "display_name": "Neo Jack",
    "timezone": "Asia/Seoul"
  },
  "availability": {
    "hours": {
      "days": [1, 2, 3, 4, 5],
      "start": "09:00",
      "end": "18:00"
    }
  },
  "limits": {
    "max_open_requests": 5
  },
  "tiers": [
    {
      "id": "24h",
      "label": "Response within 24 hours",
      "price": { "amount": "10", "currency": "USDC" },
      "target": "first_response"
    },
    {
      "id": "2h",
      "label": "Response within 2 hours",
      "price": { "amount": "50", "currency": "USDC" },
      "target": "first_response"
    },
    {
      "id": "15m_interrupt",
      "label": "Interrupt (within 15 minutes)",
      "price": { "amount": "200", "currency": "USDC" },
      "target": "interrupt"
    }
  ],
  "contact": {
    "email": "optional",
    "telegram": "optional"
  }
}
```

Notes:
- `days` uses ISO weekday numbers: Monday=1 … Sunday=7.
- `hours` are interpreted in `provider.timezone`.

### 2.2 Create escalation request

`POST /.well-known/escalatex`

Creates a request. Returns `accepted`, `requires_payment`, or `busy`.

#### Request body

```json
{
  "subject": "Need help debugging a Solana Pay reference mismatch",
  "details": "I’m seeing reference not detected in tx. Can you take a look?",
  "desired_tier": "24h",
  "budget": { "amount": "10", "currency": "USDC" },
  "requester": {
    "name": "optional",
    "email": "optional",
    "wallet": "optional"
  },
  "meta": {
    "source": "openclaw",
    "idempotency_key": "optional"
  }
}
```

Required:
- `subject` (string)
- `details` (string)

Optional:
- `desired_tier` (string) — must match one of `tiers[].id` if supplied
- `budget` (object)
- `requester` (object)
- `meta` (object)

Recommended headers:
- `Content-Type: application/json`
- `Idempotency-Key: <string>` (see §4)

---

## 3. Responses & Status Codes

### 3.1 Accepted (no payment required)

HTTP 200

```json
{
  "protocol": "escalatex/0.1",
  "status": "accepted",
  "request": {
    "id": "req_abc123",
    "receipt_url": "https://provider.tld/r/req_abc123"
  },
  "message": "Request accepted. You will receive a response soon."
}
```

### 3.2 Requires Payment (402-style payload)

HTTP 200 (v0.1 uses 200 to keep a single JSON envelope; clients should key on `status`)

```json
{
  "protocol": "escalatex/0.1",
  "status": "requires_payment",
  "request": {
    "id": "req_def456",
    "receipt_url": "https://provider.tld/r/req_def456"
  },
  "quote": {
    "tier_id": "24h",
    "price": { "amount": "10", "currency": "USDC" },
    "expires_at": "2026-02-09T03:00:00Z"
  },
  "payment": {
    "chain": "solana",
    "currency": "USDC",
    "recipient": "SOLANA_RECIPIENT_ADDRESS",
    "amount": "10",
    "reference": "SOLANA_REFERENCE_PUBKEY",
    "memo": "ESCALATEX:req_def456",
    "pay_url": "solana:SOLANA_RECIPIENT_ADDRESS?amount=10&reference=...&spl-token=..."
  },
  "message": "Payment required to escalate this request."
}
```

Normative notes:
- `reference` MUST be unique per request and bind payment to the request.
- `pay_url` SHOULD be a Solana Pay transfer request URL when using Solana.
- `memo` MAY be included as an additional binding hint.

### 3.3 Busy

HTTP 409

```json
{
  "protocol": "escalatex/0.1",
  "status": "busy",
  "reason": "outside_working_hours",
  "next_available_at": "2026-02-09T00:00:00Z",
  "interrupt": {
    "available": true,
    "quote": {
      "tier_id": "15m_interrupt",
      "price": { "amount": "200", "currency": "USDC" },
      "expires_at": "2026-02-08T15:00:00Z"
    },
    "payment": {
      "chain": "solana",
      "currency": "USDC",
      "recipient": "SOLANA_RECIPIENT_ADDRESS",
      "amount": "200",
      "reference": "SOLANA_REFERENCE_PUBKEY",
      "memo": "ESCALATEX:interrupt",
      "pay_url": "solana:..."
    }
  },
  "message": "Provider is currently unavailable."
}
```

Suggested `reason` values:
- `outside_working_hours`
- `queue_full`
- `maintenance`
- `manual_pause`

---

## 4. Idempotency (Recommended)

Clients (especially agents) SHOULD send an idempotency key to avoid duplicate requests due to retries.

### 4.1 Request header

`Idempotency-Key: <string>`

### 4.2 Server behavior

Same `Idempotency-Key` + same provider endpoint within a reasonable window SHOULD return the same `request.id` and same status/quote (if not expired).

---

## 5. Receipt / Status Page (Optional but recommended)

`GET /r/:id`

A human-friendly receipt/status page for the request.

Minimum recommended content:
- Request ID
- Current state: `created | requires_payment | paid | acknowledged | completed | refunded`
- Chosen tier + price
- Payment details (tx signature when available)
- Timestamp(s)

---

## 6. Security & Abuse Considerations (v0.1)

- Providers SHOULD implement basic rate limiting.
- Providers MAY implement allowlists/denylists.
- Hosted implementations SHOULD protect provider configuration endpoints with auth.
- Payment-required flows SHOULD define a refund policy (e.g., auto-refund if not acknowledged by SLA).

---

## 7. Versioning

This document defines `escalatex/0.1`.

Backward-incompatible changes MUST increment the minor version (e.g., `0.2`).

Clients SHOULD treat unknown fields as optional and ignore them.

---

## 8. Compliance

Escalatex is a protocol for paid prioritization and does not guarantee completion of work.

Payment SHOULD be interpreted as “priority review / response SLA” unless explicitly stated otherwise by the provider.
