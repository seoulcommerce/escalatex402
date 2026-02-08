import { Keypair } from '@solana/web3.js';
import crypto from 'crypto';

export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export function makeReferencePubkey() {
  // Generate a random public key (no private key persisted).
  return Keypair.generate().publicKey.toBase58();
}

export function makePaymentMemo({ requestId, reference }) {
  // Unique, human-readable, and easy to match in transactions.
  // Example: Escalatex402:REQ:<uuid>:REF:<pubkey>
  return `Escalatex402:REQ:${requestId}:REF:${reference}`;
}

/**
 * Build a Solana Pay transfer request URL.
 * Spec reference: https://github.com/solana-labs/solana-pay
 */
export function buildSolanaPayUrl({ recipient, amount, reference, memo, label, message, mint = USDC_MINT }) {
  const base = `solana:${recipient}`;
  const qs = new URLSearchParams();

  // USDC amount is expressed in token units.
  qs.set('amount', String(amount));
  qs.set('spl-token', mint);

  if (reference) qs.set('reference', reference);
  if (memo) qs.set('memo', memo);
  if (label) qs.set('label', label);
  if (message) qs.set('message', message);

  return `${base}?${qs.toString()}`;
}
