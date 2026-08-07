import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // algosdk and the x402 client expect Node's Buffer in the browser.
    nodePolyfills({ globals: { Buffer: true } }),
  ],
})
