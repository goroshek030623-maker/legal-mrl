import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  base: "/app/",
  server: {
    port: 5174,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:3002",
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
