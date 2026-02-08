import { Connection, PublicKey } from '@solana/web3.js';

// Mainnet USDC mint.
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function getRpcUrl() {
  return process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
}

/**
 * Verify that a given signature includes a USDC payment to `payTo`.
 *
 * This verifier is stricter than the hackathon MVP:
 * - Requires that the tx contains an SPL Token `transferChecked` for the USDC mint.
 * - Binds the payment to the request via `requiredReference` (account key present)
 *   and `requiredMemo` (memo instruction contains substring).
 * - Confirms that the transfer destination token account owner is `payTo`.
 */
export async function verifyUsdcPayment({
  txSig,
  payTo,
  expectedAmountUsdc,
  requiredMemo = null,
  requiredReference = null,
}) {
  const connection = new Connection(getRpcUrl(), 'confirmed');
  const payToPk = new PublicKey(payTo);

  const tx = await connection.getParsedTransaction(txSig, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });

  if (!tx || !tx.meta) {
    return { ok: false, reason: 'tx_not_found_or_no_meta' };
  }

  const mint = USDC_MINT;
  const keys = (tx.transaction.message?.accountKeys || []).map((k) => (k.pubkey ? k.pubkey.toBase58() : String(k)));

  // 1) Reference binding: reference pubkey must appear in account keys.
  if (requiredReference) {
    const hasRef = keys.includes(requiredReference);
    if (!hasRef) return { ok: false, reason: 'missing_reference', hasRef: false };
  }

  // 2) Memo binding: memo ix must include requiredMemo substring.
  if (requiredMemo) {
    let memoOk = false;

    // Parsed transactions may expose memo as a parsed instruction; but we also handle raw base64.
    for (const ix of tx.transaction.message.instructions || []) {
      const programId = (ix.programId && ix.programId.toBase58) ? ix.programId.toBase58() : (ix.programId || '');

      // Memo program id
      if (programId === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr') {
        // Some RPCs return memo as string in `parsed`, others as base64 in `data`.
        const parsed = ix.parsed;
        if (typeof parsed === 'string' && parsed.includes(requiredMemo)) memoOk = true;
        if (!memoOk && ix.data) {
          try {
            const data = Buffer.from(ix.data, 'base64').toString('utf8');
            if (data.includes(requiredMemo)) memoOk = true;
          } catch {}
        }
      }

      if (memoOk) break;
    }

    if (!memoOk) return { ok: false, reason: 'missing_memo', memoOk: false };
  }

  // 3) Parse SPL Token transferChecked instructions (including inner instructions).
  const expectedBase = Math.round(Number(expectedAmountUsdc) * 1_000_000);

  const postBalances = tx.meta.postTokenBalances || [];
  const tokenOwnerByAccountIndex = new Map();
  for (const b of postBalances) {
    if (b && typeof b.accountIndex === 'number') {
      tokenOwnerByAccountIndex.set(b.accountIndex, b.owner);
    }
  }

  const collect = [];

  function maybeCollectInstruction(ix) {
    if (!ix) return;
    // parsed instruction shape: { program: 'spl-token', parsed: { type, info } }
    if (ix.program !== 'spl-token' || !ix.parsed) return;
    const { type, info } = ix.parsed;
    if (type !== 'transferChecked') return;
    if (!info || info.mint !== mint) return;

    // amount is base units string
    const amountBase = Number(info.tokenAmount?.amount || 0);
    const decimals = Number(info.tokenAmount?.decimals ?? 6);
    if (decimals !== 6) return; // USDC should be 6

    // Destination is a token account; ensure its owner is payTo
    const dest = info.destination;
    const destIndex = keys.indexOf(dest);
    const destOwner = destIndex >= 0 ? tokenOwnerByAccountIndex.get(destIndex) : null;

    if (destOwner !== payToPk.toBase58()) return;

    collect.push({ amountBase, dest, destOwner, source: info.source, authority: info.authority });
  }

  for (const ix of tx.transaction.message.instructions || []) {
    maybeCollectInstruction(ix);
  }

  for (const inner of tx.meta.innerInstructions || []) {
    for (const ix of inner.instructions || []) {
      maybeCollectInstruction(ix);
    }
  }

  const totalBase = collect.reduce((a, t) => a + t.amountBase, 0);

  if (totalBase < expectedBase) {
    return {
      ok: false,
      reason: 'insufficient_transfer_amount',
      expectedBase,
      totalBase,
      matchedTransfers: collect,
    };
  }

  return {
    ok: true,
    mint,
    expectedBase,
    totalBase,
    matchedTransfers: collect,
    slot: tx.slot,
    blockTime: tx.blockTime,
  };
}
