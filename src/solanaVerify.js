import { Connection, PublicKey } from '@solana/web3.js';

// Mainnet USDC mint.
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function getRpcUrl() {
  return process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
}

/**
 * Verify that a given signature includes a USDC balance increase for `payTo`.
 *
 * NOTE: This is a pragmatic hackathon verifier:
 * - It does not require a memo/reference.
 * - It checks token balance deltas from transaction meta.
 */
export async function verifyUsdcPayment({ txSig, payTo, expectedAmountUsdc, requiredMemo = null, requiredReference = null }) {
  const connection = new Connection(getRpcUrl(), 'confirmed');
  const payToPk = new PublicKey(payTo);

  const tx = await connection.getTransaction(txSig, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });

  if (!tx || !tx.meta) {
    return { ok: false, reason: 'tx_not_found_or_no_meta' };
  }

  const mint = USDC_MINT;

  // Optional: verify memo/reference binding.
  if (requiredMemo || requiredReference) {
    const keys = (tx.transaction.message?.accountKeys || []).map((k) => (typeof k === 'string' ? k : k.toBase58()));
    const hasRef = requiredReference ? keys.includes(requiredReference) : true;

    // Parse memo if present.
    let memoOk = true;
    if (requiredMemo) {
      memoOk = false;
      for (const ix of tx.transaction.message.instructions || []) {
        // Memo program id
        const programId = keys[ix.programIdIndex];
        if (programId === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr') {
          const data = Buffer.from(ix.data, 'base64').toString('utf8');
          if (data.includes(requiredMemo)) {
            memoOk = true;
            break;
          }
        }
      }
    }

    if (!hasRef || !memoOk) {
      return { ok: false, reason: 'missing_reference_or_memo', hasRef, memoOk };
    }
  }

  // Compute delta for token balances for the owner=payTo and mint=USDC.
  const pre = tx.meta.preTokenBalances || [];
  const post = tx.meta.postTokenBalances || [];

  const sumFor = (arr) =>
    arr
      .filter((b) => b.mint === mint && b.owner === payToPk.toBase58())
      .reduce((acc, b) => {
        const ui = b.uiTokenAmount;
        const amount = ui && ui.amount ? Number(ui.amount) : 0;
        return acc + amount;
      }, 0);

  const preAmt = sumFor(pre);
  const postAmt = sumFor(post);

  // amounts are in base units (6 decimals for USDC)
  const expectedBase = Math.round(Number(expectedAmountUsdc) * 1_000_000);
  const delta = postAmt - preAmt;

  if (delta < expectedBase) {
    return {
      ok: false,
      reason: 'insufficient_delta',
      deltaBase: delta,
      expectedBase,
    };
  }

  return {
    ok: true,
    mint,
    deltaBase: delta,
    expectedBase,
    slot: tx.slot,
    blockTime: tx.blockTime,
  };
}
