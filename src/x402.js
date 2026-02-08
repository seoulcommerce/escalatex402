// Minimal x402-style payload (not a formal spec).

export function build402Payload({
  requestId,
  amountUsd,
  token,
  payTo,
  reference,
  memo,
  mint,
  payUrl,
  expiresAt,
  retryUrl,
}) {
  return {
    error: 'payment_required',
    type: 'x402-payment-required',
    requestId,
    network: 'solana',
    payment: {
      token, // 'USDC'
      mint,
      amount: String(amountUsd),
      recipient: payTo,
      reference,
      memo,
      pay_url: payUrl,
      expires_at: expiresAt,
    },
    retry_url: retryUrl,
  };
}
