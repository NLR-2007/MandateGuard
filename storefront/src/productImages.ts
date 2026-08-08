const PRODUCT_IMAGES: Record<string, string> = {
  'SSD-001': '/products/ssd-001.jpg',
  'SSD-002': '/products/ssd-002.jpg',
  'SSD-003': '/products/ssd-003.jpg',
  'SSD-004': '/products/ssd-004.jpg',
  'HDD-001': '/products/hdd-001.jpg',
  'BOOK-001': '/products/book-001.jpg',
  'BOOK-002': '/products/book-002.jpg',
  'BOOK-003': '/products/book-003.jpg',
  'BOOK-004': '/products/book-004.jpg',
  'LAP-001': '/products/lap-001.jpg',
  'LAP-002': '/products/lap-002.jpg',
  'ACC-001': '/products/acc-001.jpg',
  'ACC-002': '/products/acc-002.jpg',
  'ACC-003': '/products/acc-003.jpg',
}

/** Keeps product imagery consistent everywhere without coupling it to the guard API. */
export function productImage(id: string): string {
  return PRODUCT_IMAGES[id] ?? '/products/ssd-001.jpg'
}
