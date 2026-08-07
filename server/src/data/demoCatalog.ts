// A pretend shop. Phase 5 has no real shopping website, so the AI agent
// picks from this fixed list. Nothing here touches money or a blockchain.

export interface CatalogItem {
  id: string
  product: string
  price: number
  seller: string
  warrantyAvailable: boolean
  receiverWallet: string
}

export const demoCatalog: CatalogItem[] = [
  {
    id: 'SSD-001',
    product: '1TB SSD',
    price: 4800,
    seller: 'SecureStore',
    warrantyAvailable: true,
    receiverWallet: 'ALGO-SECURE-STORE',
  },
  {
    id: 'SSD-002',
    product: '1TB SSD',
    price: 4500,
    seller: 'OtherStore',
    warrantyAvailable: true,
    receiverWallet: 'ALGO-OTHER-STORE',
  },
  {
    id: 'SSD-003',
    product: '2TB SSD',
    price: 4900,
    seller: 'SecureStore',
    warrantyAvailable: true,
    receiverWallet: 'ALGO-SECURE-STORE',
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
  receiverWallet: 'ALGO-UNKNOWN-WALLET',
}
