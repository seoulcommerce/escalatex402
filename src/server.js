import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

// TODO: POST /requests
// TODO: provider evaluation + quote
// TODO: GET /requests/:id -> 402 if unpaid
// TODO: Solana USDC payment verification
// TODO: Telegram notifications

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`[escalate402] listening on :${port}`);
});
