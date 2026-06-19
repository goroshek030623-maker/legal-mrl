import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  base: "/app/",
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "https://hearts-exactly-cached-infrared.trycloudflare.com",
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
})
