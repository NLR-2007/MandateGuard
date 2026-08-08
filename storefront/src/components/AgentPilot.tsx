import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLive } from '../api'

/**
 * Drives the shop the way a shopper would.
 *
 * When the agent settles on a product, this opens that product's page - the
 * same thing a person clicking the card would do. When the order is paid, it
 * moves on to the receipt. An audience should watch the shop being used, not
 * read a status line about it.
 *
 * It reacts only to CHANGES. Navigating on every poll would yank the page out
 * from under whoever is reading it, which is exactly what it used to do.
 */
export default function AgentPilot() {
  const navigate = useNavigate()
  const lastItem = useRef<string | null>(null)
  const lastOrder = useRef<string | null>(null)

  useEffect(() => {
    let stop = false

    const tick = async () => {
      try {
        const live = await getLive()
        if (stop) return

        // A new product was chosen - open it.
        if (live.itemId && live.itemId !== lastItem.current) {
          lastItem.current = live.itemId
          navigate(`/p/${live.itemId}`)
        }

        // The run finished and cleared - forget it, so the next run opens again.
        if (!live.itemId) lastItem.current = null

        // Paid - show the receipt once.
        if (live.phase === 'PAID' && live.orderId && live.orderId !== lastOrder.current) {
          lastOrder.current = live.orderId
          navigate(`/order/${live.orderId}`)
        }
      } catch {
        /* the guard is down; the shop keeps working */
      }
    }

    void tick()
    const id = setInterval(tick, 1200)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [navigate])

  return null
}
