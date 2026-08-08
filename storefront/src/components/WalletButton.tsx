import { useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'

/** Shortens an address for display: ABC123…XYZ9 */
export function shortAddress(address: string): string {
  return address.length <= 12 ? address : `${address.slice(0, 5)}…${address.slice(-4)}`
}

/**
 * Sign in with a wallet.
 *
 * NovaMart never sees a key. The wallet signs in its own window, and the shop
 * only learns the public address so it can show who is paying.
 */
export default function WalletButton() {
  const { wallets, activeAddress, activeWallet } = useWallet()
  const [open, setOpen] = useState(false)

  if (activeAddress) {
    return (
      <button
        className="btn btn-quiet btn-sm"
        onClick={() => void activeWallet?.disconnect()}
        title="Disconnect"
      >
        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--good)' }} />
        <span className="mono">{shortAddress(activeAddress)}</span>
      </button>
    )
  }

  return (
    <>
      <button className="btn btn-quiet btn-sm" onClick={() => setOpen(true)}>
        Sign in
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-6"
          style={{ background: 'rgba(20,22,26,0.45)' }}
          onClick={() => setOpen(false)}
        >
          <div
            /* An opaque background is not decoration: without it the panel is
               transparent over the overlay and the dark text vanishes. */
            className="card w-full max-w-sm p-6"
            style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="display text-[22px]">Sign in to pay</h3>
            <p className="mt-1 text-[14px]" style={{ color: 'var(--ink-soft)' }}>
              Make sure your wallet is on Algorand TestNet.
            </p>

            <div className="mt-5 space-y-2">
              {wallets.map((w) => (
                <button
                  key={w.id}
                  className="btn btn-quiet w-full justify-start"
                  onClick={async () => {
                    try {
                      await w.connect()
                    } finally {
                      setOpen(false)
                    }
                  }}
                >
                  {w.metadata.icon && (
                    <img src={w.metadata.icon} alt="" className="h-5 w-5 rounded" />
                  )}
                  {w.metadata.name}
                </button>
              ))}
            </div>

            <button className="btn btn-quiet mt-4 w-full" onClick={() => setOpen(false)}>
              Cancel
            </button>

            <p className="mt-4 text-[12px]" style={{ color: 'var(--ink-faint)' }}>
              NovaMart only ever sees your public address. Your keys stay in your wallet.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
