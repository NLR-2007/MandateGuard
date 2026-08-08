import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { Product } from './api'

/** An ordinary shopping basket. Nothing clever happens here. */
interface CartValue {
  items: Product[]
  add: (p: Product) => void
  remove: (id: string) => void
  clear: () => void
  total: number
}

const CartContext = createContext<CartValue>({
  items: [],
  add: () => {},
  remove: () => {},
  clear: () => {},
  total: 0,
})

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Product[]>([])

  const add = useCallback((p: Product) => setItems((list) => [...list, p]), [])
  const remove = useCallback(
    (id: string) =>
      setItems((list) => {
        const i = list.findIndex((p) => p.id === id)
        if (i < 0) return list
        return [...list.slice(0, i), ...list.slice(i + 1)]
      }),
    [],
  )
  const clear = useCallback(() => setItems([]), [])

  const total = useMemo(() => items.reduce((sum, p) => sum + p.price, 0), [items])

  return (
    <CartContext.Provider value={{ items, add, remove, clear, total }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartValue {
  return useContext(CartContext)
}
