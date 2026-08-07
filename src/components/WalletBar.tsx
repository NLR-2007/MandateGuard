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
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-400">Algorand Wallet:</span>
          {activeAddress ? (
            <>
              <Badge tone="human">Connected</Badge>
              <span className="font-mono text-sm text-white">
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
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors duration-200 hover:border-red-500/60 hover:text-red-300"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors duration-200 hover:bg-cyan-400"
          >
            Connect Algorand Wallet
          </button>
        )}
      </div>

      {/* Balance hint - read only, we never move funds automatically */}
      {activeAddress && balances && (
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span className="text-slate-400">
            ALGO: <span className="text-white">{balances.algo.toFixed(3)}</span>
          </span>
          <span className="text-slate-400">
            Test USDC:{' '}
            <span className="text-white">
              {balances.optedIn ? balances.usdc?.toFixed(3) : 'not opted in'}
            </span>
          </span>
          {!enoughForPayment && (
            <span className="text-yellow-300">
              Your TestNet wallet needs enough ALGO for transaction fees and Test USDC for
              the x402 payment.
            </span>
          )}
        </div>
      )}

      {activeAddress && (
        <p className="mt-3 text-xs text-slate-500">
          Only your public address is shown. MandateGuard never sees your seed phrase or
          private key — every payment is signed inside your wallet.
        </p>
      )}

      {/* Wallet picker */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">Connect a TestNet wallet</h3>
            <p className="mt-2 text-sm text-slate-400">
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
                  className="flex w-full items-center gap-3 rounded-lg border border-slate-700 px-4 py-3 text-left text-white transition-colors duration-200 hover:border-cyan-500"
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
              className="mt-5 w-full rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
