import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: string
  email: string
  fullName?: string | null
  isAdmin?: boolean
}

interface AuthContextType {
  token: string | null
  user: User | null
  login: (token: string, user: any) => void
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('legal_mrl_token')
    if (stored) {
      setToken(stored)
      // Проверяем /api/me для получения актуального isAdmin
      fetch('/api/me', { headers: { Authorization: `Bearer ${stored}` } })
        .then(r => r.json())
        .then(d => {
          if (!d.error) {
            const u = { id: d.id, email: d.email, fullName: d.fullName, isAdmin: d.isAdmin }
            localStorage.setItem('legal_mrl_user', JSON.stringify(u))
            setUser(u)
          }
        })
        .catch(() => {
          // Fallback: берём из localStorage если API недоступен
          const storedUser = localStorage.getItem('legal_mrl_user')
          if (storedUser) {
            try { setUser(JSON.parse(storedUser)) } catch {}
          }
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = (newToken: string, newUser: any) => {
    localStorage.setItem('legal_mrl_token', newToken)
    localStorage.setItem('legal_mrl_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem('legal_mrl_token')
    localStorage.removeItem('legal_mrl_user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('legal_mrl_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}
