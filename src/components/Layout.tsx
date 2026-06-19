import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { token, user, logout } = useAuth()

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900/80 backdrop-blur border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2 text-xl font-bold text-white">
                <img src="/images/logo.png" alt="DokIQ" className="h-8 w-8 rounded" />
                DokIQ
              </Link>
            </div>
            <nav className="flex items-center space-x-4">
              {token ? (
                <>
                  <Link
                    to="/"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isActive('/') ? 'bg-yellow-500/20 text-yellow-400' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Главная
                  </Link>
                  <Link
                    to="/cases"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isActive('/cases') ? 'bg-yellow-500/20 text-yellow-400' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Мои дела
                  </Link>
                  <Link
                    to="/cases/new"
                    className="bg-yellow-500 text-slate-900 px-4 py-2 rounded-md text-sm font-bold hover:bg-yellow-400"
                  >
                    Новое дело
                  </Link>
                  {user?.isAdmin && (
                    <Link
                      to="/admin"
                      className={`px-3 py-2 rounded-md text-sm font-medium ${
                        isActive('/admin') ? 'bg-purple-100 text-purple-900' : 'text-purple-400 hover:text-purple-300'
                      }`}
                    >
                      🛡 Админ
                    </Link>
                  )}
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-sm text-slate-300">{user?.fullName || user?.email}</span>
                    <button
                      onClick={logout}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Выйти
                    </button>
                  </div>
                </>
              ) : (
                <Link
                  to="/login"
                  className="bg-yellow-500 text-slate-900 px-4 py-2 rounded-md text-sm font-bold hover:bg-yellow-400"
                >
                  Войти
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {children}
      </main>

      <footer className="bg-slate-900/80 backdrop-blur border-t border-slate-700/50 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-slate-400">
          DokIQ — Юридический помощник. Не заменяет консультацию адвоката.
        </div>
      </footer>
    </div>
  )
}
