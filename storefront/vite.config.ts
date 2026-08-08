import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// Port 5174 so the shop and MandateGuard's own console run side by side.
// The Buffer polyfill is required: the x402 signing path uses it in the
// browser, and without it transactions fail at signing time.
export default defineConfig({
  plugins: [react(), tailwindcss(), nodePolyfills({ globals: { Buffer: true } })],
  server: { port: 5174 },
})
