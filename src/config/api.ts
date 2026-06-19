/// <reference types="vite/client" />
// Базовый URL для API запросов
// В development: используется Vite proxy (относительные пути)
// В production: используется VITE_API_URL из .env или fallback

export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Helper для полного URL
export function apiUrl(path: string): string {
  if (path.startsWith('http')) return path;
  const base = API_BASE_URL.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${cleanPath}` : cleanPath;
}
