// Writing a mandate fingerprint to Algorand TestNet.
//
// The transaction is a 0 ALGO payment from the connected wallet to itself.
// It moves no money. Its only purpose is the note field, which carries
// "MG1:<fingerprint>". The cost is one network fee, 0.001 ALGO.
//
// Why bother: once that transaction is confirmed, the human's approved policy
// is timestamped on a public ledger. If anyone later edits the policy - us
// included - the fingerprint changes and no longer matches the chain. The lie
// becomes visible.
//
// This file never sees a private key. The wallet signs in its own window.

import algosdk from 'algosdk'

const ALGOD = 'https://testnet-api.algonode.cloud'

/** Must match NOTE_PREFIX in server/src/services/chainAnchor.ts. */
export const NOTE_PREFIX = 'MG1:'

export const ANCHOR_FEE_ALGO = 0.001

/** The exact text written into the transaction note. */
export function anchorNote(mandateHash: string): string {
  return `${NOTE_PREFIX}${mandateHash}`
}

export type AnchorStage =
  | 'idle'
  | 'building'
  | 'awaiting-wallet'
  | 'submitting'
  | 'confirming'
  | 'verifying'
  | 'done'
  | 'failed'

export const ANCHOR_STAGE_LABELS: Record<AnchorStage, string> = {
  idle: 'Ready',
  building: 'Preparing the transaction',
  'awaiting-wallet': 'Waiting for your wallet',
  submitting: 'Sending to Algorand TestNet',
  confirming: 'Waiting for confirmation',
  verifying: 'MandateGuard is reading it back',
  done: 'Written to Algorand',
  failed: 'Stopped',
}

export interface AnchorSigner {
  address: string
  signTransactions: (txns: Uint8Array[]) => Promise<(Uint8Array | null)[]>
}

/**
 * Builds, signs and submits the anchor transaction.
 * Returns the confirmed Algorand transaction id.
 */
export async function writeAnchor(params: {
  mandateHash: string
  signer: AnchorSigner
  onStage: (stage: AnchorStage) => void
}): Promise<{ txId: string; confirmedRound: number }> {
  const { mandateHash, signer, onStage } = params

  onStage('building')

  const algod = new algosdk.Algodv2('', ALGOD, '')
  const suggestedParams = await algod.getTransactionParams().do()

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    // To itself, for zero. Only the note matters.
    sender: signer.address,
    receiver: signer.address,
    amount: 0,
    note: new TextEncoder().encode(anchorNote(mandateHash)),
    suggestedParams,
  })

  // Computed from the transaction itself, so it is known before submitting
  // and does not depend on what any server reports back.
  const txId = txn.txID()

  onStage('awaiting-wallet')

  const encoded = algosdk.encodeUnsignedTransaction(txn)
  const signed = await signer.signTransactions([encoded])
  const signedTxn = signed[0]

  if (!signedTxn) {
    throw new Error('The wallet did not sign the transaction.')
  }

  onStage('submitting')
  await algod.sendRawTransaction(signedTxn).do()

  onStage('confirming')
  const confirmation = await algosdk.waitForConfirmation(algod, txId, 6)

  return {
    txId,
    confirmedRound: Number(confirmation.confirmedRound ?? 0),
  }
}

/** Turns a wallet or network failure into one plain sentence. */
export function describeAnchorError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (/reject|denied|cancel|declined|closed/i.test(message)) {
    return 'You cancelled the signature. Nothing was written to Algorand.'
  }
  if (/overspend|insufficient|balance|below min/i.test(message)) {
    return `This wallet needs a little TestNet ALGO for the network fee (${ANCHOR_FEE_ALGO} ALGO).`
  }
  if (/timeout|timed out|not confirmed|wait/i.test(message)) {
    return 'Algorand did not confirm the transaction in time. Nothing was recorded.'
  }
  if (/network|fetch|Failed to fetch/i.test(message)) {
    return 'Cannot reach an Algorand TestNet node right now.'
  }
  return message
}
