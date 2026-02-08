// MVP: a single provider (Neojack) configured via env.

export function getProvider(providerId = 'neojack') {
  const id = providerId;
  return {
    id,
    name: process.env.PROVIDER_NAME || 'Neojack',
    telegramChatId: process.env.PROVIDER_TELEGRAM_CHAT_ID || '',
    // Solana address to receive payments.
    solanaPayTo: process.env.PROVIDER_SOL_ADDRESS || 'Bt6CgWWuvV2qjkbbVuwXhLptwMajZVerhAZCF7NA4VWW',
    // USDC mint on Solana (mainnet) for later; MVP treats token symbolically.
    defaultToken: process.env.DEFAULT_PAYMENT_TOKEN || 'USDC',
    minQuoteUsd: process.env.MIN_QUOTE_USD || '25',
    availability: process.env.PROVIDER_AVAILABILITY || 'best-effort',
  };
}

// Very simple acceptance logic for MVP.
export function evaluateRequest({ title, body, tags, budgetUsd }) {
  const t = `${title}\n${body}\n${(tags || []).join(',')}`.toLowerCase();
  const disallowed = ['illegal', 'malware', 'exploit', 'ddos', 'hack'];
  if (disallowed.some((w) => t.includes(w))) {
    return { accepted: false, quoteUsd: null, message: 'Not a supported request.' };
  }

  // If budget is given and too low, counter.
  const min = Number(process.env.MIN_QUOTE_USD || 25);
  const bud = budgetUsd ? Number(budgetUsd) : null;
  const quote = bud && bud >= min ? bud : min;

  return {
    accepted: true,
    quoteUsd: String(quote),
    message: 'Accepted. Pay to start. Response time best-effort; we will ping you on Telegram after payment.'
  };
}
