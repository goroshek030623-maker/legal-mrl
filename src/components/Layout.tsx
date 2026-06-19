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
          <div className="flex justify-between h-16 items-center gap-2 sm:gap-4">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2 text-xl font-bold text-white">
                <img src="/images/logo.png" alt="DokIQ" className="h-8 w-8 rounded" />
                DokIQ
              </Link>
            </div>
            <nav className="flex items-center gap-2 sm:gap-3 md:gap-4 overflow-x-auto scrollbar-hide">
              {token ? (
                <>
                  <Link
                    to="/"
                    className={`px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap ${
                      isActive('/') ? 'bg-yellow-500/20 text-yellow-400' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Главная
                  </Link>
                  <Link
                    to="/cases"
                    className={`px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap ${
                      isActive('/cases') ? 'bg-yellow-500/20 text-yellow-400' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Мои дела
                  </Link>
                  <Link
                    to="/cases/new"
                    className="bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-bold hover:brightness-110 transition-all whitespace-nowrap shadow-lg shadow-yellow-500/20"
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
                  <div className="flex items-center gap-2 sm:gap-3 ml-2 sm:ml-4 shrink-0">
                    <span className="text-xs sm:text-sm text-slate-300 hidden sm:inline">{user?.fullName || user?.email}</span>
                    <button
                      onClick={logout}
                      className="text-xs sm:text-sm text-red-400 hover:text-red-300 whitespace-nowrap"
                    >
                      Выйти
                    </button>
                  </div>
                </>
              ) : (
                <Link
                  to="/login"
                  className="bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-bold hover:brightness-110 transition-all whitespace-nowrap shadow-lg shadow-yellow-500/20"
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
