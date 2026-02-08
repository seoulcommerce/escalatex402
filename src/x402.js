// Minimal x402-style payload (not a formal spec).

export function build402Payload({ requestId, amountUsd, token, payTo, reference, expiresAt }) {
  return {
    type: 'x402-payment-required',
    requestId,
    network: 'solana',
    token, // 'USDC' (MVP)
    amountUsd,
    payTo,
    reference,
    expiresAt,
    // In a fuller implementation we'd include mint addresses, decimals, and a Solana Pay URL.
  };
}
