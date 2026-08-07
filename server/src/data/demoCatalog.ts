// The shop the AI agent buys from.
//
// It is a fixed catalogue, not a live marketplace - said plainly rather than
// dressed up. What IS real: the seller wallets below are genuine Algorand
// TestNet addresses, so when the agent pays an approved seller, test USDC
// actually moves to that account and anyone can check it on the explorer.

/** Real TestNet accounts. Public addresses only - never keys. */
export const SELLER_WALLETS = {
  /** The approved seller. Opted in to USDC 10458941, so it can receive. */
  SecureStore: 'MW5HJTYSG2OENK5SQXUUOQZXS2WOMIBID5IECVNGC2YZGBN22RP2GOISDY',
  /** Not on any approved list. Never receives anything - MandateGuard stops
      an order long before payment, which is exactly the point. */
  OtherStore: 'BI76R3JWX25FG4EAS7ZCN3KYCLLMALOZSNBC6YHJPA73CULCKQGAI23CA4',
} as const

export interface CatalogItem {
  id: string
  product: string
  /** In rupees. Converted to test USDC at the demo rate when paying. */
  price: number
  seller: string
  warrantyAvailable: boolean
  receiverWallet: string
  category: 'storage' | 'books' | 'accessories' | 'laptops'
  rating: number
  inStock: boolean
}

export const demoCatalog: CatalogItem[] = [
  // ── Storage ───────────────────────────────────────────
  {
    id: 'SSD-001',
    product: '1TB SSD',
    price: 4800,
    seller: 'SecureStore',
    warrantyAvailable: true,
    receiverWallet: SELLER_WALLETS.SecureStore,
    category: 'storage',
    rating: 4.6,
    inStock: true,
  },
  {
    id: 'SSD-002',
    product: '1TB SSD',
    price: 4500,
    seller: 'OtherStore',
    warrantyAvailable: true,
    receiverWallet: SELLER_WALLETS.OtherStore,
    category: 'storage',
    rating: 4.1,
    inStock: true,
  },
  {
    id: 'SSD-003',
    product: '2TB SSD',
    price: 4900,
    seller: 'SecureStore',
    warrantyAvailable: true,
    receiverWallet: SELLER_WALLETS.SecureStore,
    category: 'storage',
    rating: 4.8,
    inStock: true,
  },
  {
    id: 'SSD-004',
    product: '1TB SSD',
    price: 6200,
    seller: 'SecureStore',
    warrantyAvailable: true,
    receiverWallet: SELLER_WALLETS.SecureStore,
    category: 'storage',
    rating: 4.9,
    inStock: true,
  },
  {
    id: 'HDD-001',
    product: '4TB Hard Drive',
    price: 3900,
    seller: 'SecureStore',
    warrantyAvailable: true,
    receiverWallet: SELLER_WALLETS.SecureStore,
    category: 'storage',
    rating: 4.2,
    inStock: true,
  },

  // ── Books ─────────────────────────────────────────────
  {
    id: 'BOOK-001',
    product: 'Clean Code',
    price: 850,
    seller: 'SecureStore',
    warrantyAvailable: false,
    receiverWallet: SELLER_WALLETS.SecureStore,
    category: 'books',
    rating: 4.7,
    inStock: true,
  },
  {
    id: 'BOOK-002',
    product: 'The Pragmatic Programmer',
    price: 1200,
    seller: 'SecureStore',
    warrantyAvailable: false,
    receiverWallet: SELLER_WALLETS.SecureStore,
    category: 'books',
    rating: 4.9,
    inStock: true,
  },
  {
    id: 'BOOK-003',
    product: 'Designing Data-Intensive Applications',
    price: 1650,
    seller: 'OtherStore',
    warrantyAvailable: false,
    receiverWallet: SELLER_WALLETS.OtherStore,
    category: 'books',
    rating: 4.8,
    inStock: true,
  },
  {
    id: 'BOOK-004',
    product: 'Clean Code',
    price: 1100,
    seller: 'OtherStore',
    warrantyAvailable: false,
    receiverWallet: SELLER_WALLETS.OtherStore,
    category: 'books',
    rating: 4.3,
    inStock: true,
  },

  // ── Laptops ───────────────────────────────────────────
  // Far outside any sensible SSD budget. These exist so the demo has a
  // request that MUST be refused: the product is wrong AND the price is
  // wrong, which is exactly what an agent going off-script looks like.
  {
    id: 'LAP-001',
    product: 'Gaming Laptop',
    price: 85000,
    seller: 'OtherStore',
    warrantyAvailable: true,
    receiverWallet: SELLER_WALLETS.OtherStore,
    category: 'laptops',
    rating: 4.6,
    inStock: true,
  },
  {
    id: 'LAP-002',
    product: 'Ultrabook',
    price: 62000,
    seller: 'OtherStore',
    warrantyAvailable: true,
    receiverWallet: SELLER_WALLETS.OtherStore,
    category: 'laptops',
    rating: 4.4,
    inStock: true,
  },

  // ── Accessories ───────────────────────────────────────
  {
    id: 'ACC-001',
    product: 'Mechanical Keyboard',
    price: 3200,
    seller: 'SecureStore',
    warrantyAvailable: true,
    receiverWallet: SELLER_WALLETS.SecureStore,
    category: 'accessories',
    rating: 4.5,
    inStock: true,
  },
  {
    id: 'ACC-002',
    product: 'USB-C Hub',
    price: 1800,
    seller: 'SecureStore',
    warrantyAvailable: true,
    receiverWallet: SELLER_WALLETS.SecureStore,
    category: 'accessories',
    rating: 4.0,
    inStock: true,
  },
  {
    id: 'ACC-003',
    product: 'Laptop Stand',
    price: 1450,
    seller: 'OtherStore',
    warrantyAvailable: false,
    receiverWallet: SELLER_WALLETS.OtherStore,
    category: 'accessories',
    rating: 4.4,
    inStock: false,
  },
]

/**
 * The controlled "manipulated order" used for the security demo.
 *
 * We never ask the AI to misbehave. The attack sample is fixed data so the
 * hackathon demo is predictable - but it still goes through the SAME real
 * MandateGuard verifier as any other order.
 */
export const manipulatedOrderTemplate = {
  product: '1TB SSD',
  quantity: 2,
  price: 4900,
  seller: 'OtherStore',
  warrantyAdded: true,
  receiverWallet: SELLER_WALLETS.OtherStore,
}
