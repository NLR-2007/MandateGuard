import { type CSSProperties, useCallback, useEffect, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import {
  ANCHOR_FEE_ALGO,
  ANCHOR_STAGE_LABELS,
  type AnchorStage,
  describeAnchorError,
  writeAnchor,
} from '../services/anchorClient'
import { type AnchorStatus, confirmMandateAnchor, getMandateAnchor } from '../services/api'

/**
 * Writes the approved policy's fingerprint onto Algorand TestNet.
 *
 * Why this exists: MandateGuard's audit trail is only as trustworthy as the
 * database holding it, and we control that database. Putting the fingerprint
 * on a public chain removes us from the trust equation. Afterwards, editing
 * the policy changes its fingerprint, and the chain no longer agrees.
 *
 * The wallet signs. This component never handles a key.
 */
export default function MandateAnchor({ mandateId }: { mandateId: string }) {
  const { activeAddress, signTransactions } = useWallet()

  const [status, setStatus] = useState<AnchorStatus | null>(null)
  const [stage, setStage] = useState<AnchorStage>('idle')
  const [error, setError] = useState('')
  const [rechecking, setRechecking] = useState(false)

  const load = useCallback(async () => {
    try {
      setStatus(await getMandateAnchor(mandateId))
    } catch {
      // A missing anchor is not an error worth shouting about.
    }
  }, [mandateId])

  useEffect(() => {
    void load()
  }, [load])

  const handleAnchor = async () => {
    if (!status || !activeAddress || !signTransactions) return

    setError('')
    try {
      const { txId } = await writeAnchor({
        mandateHash: status.mandateHash,
        signer: {
          address: activeAddress,
          signTransactions: signTransactions as unknown as (
            txns: Uint8Array[],
          ) => Promise<(Uint8Array | null)[]>,
        },
        onStage: setStage,
      })

      // The server now reads the chain back. If the note does not match the
      // fingerprint it computed itself, it refuses the transaction id.
      setStage('verifying')
      await confirmMandateAnchor(mandateId, txId)

      setStage('done')
      await load()
    } catch (err) {
      setStage('failed')
      setError(describeAnchorError(err))
    }
  }

  const handleRecheck = async () => {
    setRechecking(true)
    setError('')
    await load()
    setRechecking(false)
  }

  const busy = stage !== 'idle' && stage !== 'done' && stage !== 'failed'

  if (!status) return null

  const anchored = status.anchored && status.anchor

  return (
    <div className="block mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="label">Proof on Algorand</span>
        {anchored && (
          <span className={`tag ${status.stillMatches ? 'tag-green' : 'tag-red'}`}>
            {status.stillMatches ? 'matches the chain' : 'does not match'}
          </span>
        )}
      </div>

      <p className="footnote mt-3">
        This policy's fingerprint can be written into a public Algorand TestNet
        transaction. After that, changing even one word of the policy changes the
        fingerprint — and the chain stops agreeing with us.
      </p>

      <div className="mt-4">
        <span className="label">Fingerprint written to the chain</span>
        {/* While the write is in flight the fingerprint shimmers, so the moment
            it travels to the chain is visible rather than a frozen screen. */}
        <p
          className={`mono mt-1 break-all text-[12px] ${busy ? 'to-chain' : ''}`}
          style={busy ? undefined : { color: 'var(--ink-soft)' }}
        >
          {status.expectedNote}
        </p>
      </div>

      {!anchored && (
        <>
          <button
            className="btn btn-solid mt-5"
            onClick={handleAnchor}
            disabled={busy || !activeAddress}
          >
            {busy ? ANCHOR_STAGE_LABELS[stage] + '…' : 'Write proof to Algorand'}
          </button>
          <p className="footnote mt-2">
            {activeAddress
              ? `Sends a 0 ALGO transaction to your own address. Network fee ${ANCHOR_FEE_ALGO} ALGO. No money moves.`
              : 'Your wallet signs this. Connect it at the top of the page.'}
          </p>
        </>
      )}

      {anchored && status.anchor && (
        <div className="mt-5 space-y-2">
          <Line label="Transaction" value={status.anchor.txId} mono i={0} />
          <Line label="Block" value={`round ${status.anchor.confirmedRound}`} i={1} />
          <Line
            label="Written at"
            value={
              status.anchor.roundTime
                ? new Date(status.anchor.roundTime * 1000).toLocaleString()
                : '—'
            }
            i={2}
          />
          <Line label="Network" value={status.anchor.network} i={3} />

          <div className="flex flex-wrap gap-3 pt-3">
            <a
              className="btn btn-sm"
              href={status.anchor.explorerUrl}
              target="_blank"
              rel="noreferrer"
            >
              View on Algorand Explorer
            </a>
            <button className="btn btn-sm" onClick={handleRecheck} disabled={rechecking}>
              {rechecking ? 'Reading the chain…' : 'Check the chain again'}
            </button>
          </div>

          <p className="footnote pt-2">
            "Check the chain again" re-reads the transaction from a public Algorand
            node every time. The proof is not stored in our answer — it is read
            back from the ledger.
          </p>
        </div>
      )}

      {status.anchored && status.stillMatches === false && status.reason && (
        <p className="mt-3 text-[13px]" style={{ color: 'var(--oxblood)' }}>
          {status.reason}
        </p>
      )}

      {error && (
        <p className="mt-3 text-[13px]" style={{ color: 'var(--oxblood)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

function Line({
  label,
  value,
  mono,
  i = 0,
}: {
  label: string
  value: string
  mono?: boolean
  i?: number
}) {
  return (
    <div
      className="tick flex flex-wrap items-baseline justify-between gap-2"
      style={{ '--i': i } as CSSProperties}
    >
      <span className="label">{label}</span>
      <span
        className={`${mono ? 'mono break-all' : ''} text-[13px]`}
        style={{ color: 'var(--ink)' }}
      >
        {value}
      </span>
    </div>
  )
}
