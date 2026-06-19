/// <reference types="vite/client" />
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

// === API URL patch for production ===
// GitHub Pages can't proxy to backend, so we patch fetch to use absolute URL
const API_BASE_URL = import.meta.env.VITE_API_URL || ''
if (API_BASE_URL) {
  const originalFetch = window.fetch
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
    let url = typeof input === 'string' ? input : input.toString()
    if (url.startsWith('/api')) {
      url = API_BASE_URL.replace(/\/$/, '') + url
      return originalFetch(url, init)
    }
    return originalFetch(input, init)
  }
}

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/app">
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </HelmetProvider>
    </BrowserRouter>
  </React.StrictMode>
)// UNIQUE_MARKER_12345
