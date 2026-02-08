CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  createdAt INTEGER NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT NOT NULL,
  budgetUsd TEXT,
  providerId TEXT,
  quoteUsd TEXT,
  quoteMessage TEXT,
  paymentToken TEXT,
  payTo TEXT,
  paymentReference TEXT,
  paymentMemo TEXT,
  paidTxSig TEXT,
  paidAt INTEGER
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);

CREATE TABLE IF NOT EXISTS idempotency (
  k TEXT PRIMARY KEY,
  createdAt INTEGER NOT NULL,
  responseJson TEXT NOT NULL
);
