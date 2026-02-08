import { Connection, PublicKey } from '@solana/web3.js';
import { verifyUsdcPayment } from './solanaVerify.js';

function getRpcUrl() {
  return process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
}

/**
 * Scan recent signatures for `payTo` and return the first txSig that satisfies verifyUsdcPayment.
 */
export async function scanForPayment({ payTo, expectedAmountUsdc, requiredMemo, requiredReference, limit = 20 }) {
  const connection = new Connection(getRpcUrl(), 'confirmed');
  const addr = new PublicKey(payTo);

  const sigs = await connection.getSignaturesForAddress(addr, { limit }, 'confirmed');
  for (const s of sigs) {
    const v = await verifyUsdcPayment({
      txSig: s.signature,
      payTo,
      expectedAmountUsdc,
      requiredMemo,
      requiredReference,
    });
    if (v.ok) {
      return { ok: true, txSig: s.signature, details: v };
    }
  }

  return { ok: false, reason: 'not_found_in_recent', checked: sigs.length };
}
