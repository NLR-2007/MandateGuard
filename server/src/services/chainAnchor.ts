// On-chain mandate anchor - reads Algorand TestNet.
//
// What an anchor is:
//   When a human approves a policy, MandateGuard fingerprints it (SHA-256).
//   The wallet then writes that fingerprint into the note field of a real
//   Algorand TestNet transaction. From that moment the intent is timestamped
//   on a public ledger, so nobody - including us - can change the policy
//   afterwards and pretend it always said something else.
//
// What this file does NOT do:
//   It never signs anything and never holds a key. The wallet signs in its own
//   UI; this file only READS the chain back to confirm what was written.
//   That is the point: the server does not take the browser's word for it.

import { explorerTxUrl } from '../x402/x402Config.js'

/** Marks a note as ours and leaves room for future formats. */
export const NOTE_PREFIX = 'MG1:'

const INDEXER = 'https://testnet-idx.algonode.cloud'

/** The exact bytes that must appear in the transaction note. */
export function expectedNote(mandateHash: string): string {
  return `${NOTE_PREFIX}${mandateHash}`
}

export interface ChainAnchor {
  txId: string
  note: string
  sender: string
  confirmedRound: number
  /** Unix seconds, from the block itself - not from our clock. */
  roundTime: number
  explorerUrl: string
}

export interface AnchorCheck {
  ok: boolean
  reason: string | null
  anchor: ChainAnchor | null
}

function decodeNote(base64: string | undefined): string {
  if (!base64) return ''
  try {
    return Buffer.from(base64, 'base64').toString('utf8')
  } catch {
    return ''
  }
}

/**
 * Reads one transaction from the public TestNet indexer.
 *
 * The indexer lags a second or two behind the node that confirmed the
 * transaction, so a "not found" right after submitting is normal. We retry a
 * few times before giving up rather than reporting a false failure.
 */
export async function readTransaction(
  txId: string,
  attempts = 5,
): Promise<ChainAnchor | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(`${INDEXER}/v2/transactions/${txId}`)

      if (res.ok) {
        const body = (await res.json()) as {
          transaction?: {
            note?: string
            sender?: string
            'confirmed-round'?: number
            'round-time'?: number
          }
        }
        const txn = body.transaction
        if (!txn) return null

        return {
          txId,
          note: decodeNote(txn.note),
          sender: txn.sender ?? '',
          confirmedRound: txn['confirmed-round'] ?? 0,
          roundTime: txn['round-time'] ?? 0,
          explorerUrl: explorerTxUrl(txId),
        }
      }

      // 404 means "not indexed yet" far more often than "does not exist".
      if (res.status !== 404) return null
    } catch {
      // Network hiccup - fall through to the wait and try again.
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1200))
    }
  }

  return null
}

/**
 * Independent proof. Given a transaction id and the fingerprint we expect,
 * this answers: does Algorand really carry that fingerprint?
 *
 * A judge can run the same check by hand on the explorer.
 */
export async function verifyAnchor(
  txId: string,
  mandateHash: string,
): Promise<AnchorCheck> {
  const trimmed = txId.trim()

  if (!/^[A-Z2-7]{52}$/.test(trimmed)) {
    return { ok: false, reason: 'That is not a valid Algorand transaction id.', anchor: null }
  }

  const anchor = await readTransaction(trimmed)

  if (!anchor) {
    return {
      ok: false,
      reason: 'Algorand TestNet has no confirmed transaction with that id yet.',
      anchor: null,
    }
  }

  const wanted = expectedNote(mandateHash)

  if (anchor.note !== wanted) {
    return {
      ok: false,
      reason: `The transaction note does not match this mandate. Expected ${wanted.slice(0, 16)}…, found ${anchor.note.slice(0, 16) || '(empty)'}…`,
      anchor,
    }
  }

  return { ok: true, reason: null, anchor }
}
