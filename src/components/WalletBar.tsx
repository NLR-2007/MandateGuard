import { useEffect, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import Badge from './Badge'
/** Shortens an address for display: ABC123...XYZ9 */
export function shortAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const USDC_TESTNET_ASSET_ID = 10458941
const ALGOD = 'https://testnet-api.algonode.cloud'
interface Balances {
  algo: number
  usdc: number | null
  optedIn: boolean
}

/** Reads public balances from a TestNet node. Read-only, no signing. */
async function fetchBalances(address: string): Promise<Balances | null> {
  try {
    const res = await fetch(`${ALGOD}/v2/accounts/${address}`)
    if (!res.ok) return null
    const json = await res.json()

    const assets: { 'asset-id': number; amount: number }[] = json.assets ?? []
    const usdc = assets.find((a) => Number(a['asset-id']) === USDC_TESTNET_ASSET_ID)

    return {
      algo: (json.amount ?? 0) / 1e6,
      usdc: usdc ? usdc.amount / 1e6 : null,
      optedIn: Boolean(usdc),
    }
  } catch {
    return null
  }
}

export default function WalletBar() {
  const { wallets, activeAddress, activeWallet } = useWallet()
  const [open, setOpen] = useState(false)
  const [balances, setBalances] = useState<Balances | null>(null)

  useEffect(() => {
    if (!activeAddress) {
      setBalances(null)
      return
    }
    void fetchBalances(activeAddress).then(setBalances)
  }, [activeAddress])

  const enoughForPayment =
    balances !== null && balances.optedIn && (balances.usdc ?? 0) >= 0.005 && balances.algo > 0

  return (
    <div className="block p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="label">Wallet</span>
          {activeAddress ? (
            <>
              <Badge tone="human">Connected</Badge>
              <span className="mono text-[13px]">
                {shortAddress(activeAddress)}
              </span>
              <Badge tone="neutral">TestNet</Badge>
            </>
          ) : (
            <Badge tone="neutral">Not Connected</Badge>
          )}
        </div>

        {activeAddress ? (
          <button
            onClick={() => void activeWallet?.disconnect()}
            className="btn btn-sm"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="btn btn-solid btn-sm"
          >
            Connect Algorand Wallet
          </button>
        )}
      </div>

      {/* Balance hint - read only, we never move funds automatically */}
      {activeAddress && balances && (
        <div className="mt-4 flex flex-wrap gap-6">
          <span className="label">
            ALGO <span className="mono ml-1 text-[12px]" style={{ color: 'var(--ink)'
}}>{balances.algo.toFixed(3)}</span>
          </span>
          <span className="label">
            USDC <span className="mono ml-1 text-[12px]" style={{ color: 'var(--ink)'
}}>{balances.optedIn ? balances.usdc?.toFixed(3) : 'not opted in'}</span>
          </span>
          {!enoughForPayment && (
            <span className="text-[12px]" style={{ color: 'var(--ochre)'
}}>
              Your TestNet wallet needs enough ALGO for transaction fees and Test USDC for
              the x402 payment.
            </span>
          )}
        </div>
      )}

      {activeAddress && (
        <p className="footnote mt-3">
          Only your public address is shown. MandateGuard never sees your seed phrase or
          private key — every payment is signed inside your wallet.
        </p>
      )}

      {/* Wallet picker */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(23,22,15,0.55)] p-6"
          onClick={() => setOpen(false)}
        >
          <div
            /* An opaque background is not decoration here: without it the panel
               is transparent over the dark overlay and the dark text vanishes. */
            className="w-full max-w-sm border border-[var(--rule)] p-6 shadow-2xl"
            style={{ background: 'var(--paper-card)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="display text-[24px]">Connect a TestNet wallet</h3>
            <p className="mt-2 text-[13px]" style={{ color: 'var(--ink-soft)'
}}>
              Make sure your wallet is switched to Algorand TestNet.
            </p>

            <div className="mt-5 space-y-3">
              {wallets.map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={async () => {
                    try {
                      await wallet.connect()
                    } finally {
                      setOpen(false)
                    }
                  }}
                  className="btn flex w-full items-center gap-3 text-left"
                >
                  {wallet.metadata.icon && (
                    <img src={wallet.metadata.icon} alt="" className="h-6 w-6 rounded" />
                  )}
                  {wallet.metadata.name}
                </button>
              ))}
            </div>

            <button
              onClick={() => setOpen(false)}
              className="btn btn-sm mt-5 w-full"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
