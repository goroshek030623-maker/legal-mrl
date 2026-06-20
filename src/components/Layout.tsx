import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { token, user, logout } = useAuth()
  const [showFeedback, setShowFeedback] = useState(false)
  const [fbName, setFbName] = useState('')
  const [fbEmail, setFbEmail] = useState('')
  const [fbMessage, setFbMessage] = useState('')
  const [fbSent, setFbSent] = useState(false)
  const [fbLoading, setFbLoading] = useState(false)

  const isActive = (path: string) => location.pathname === path

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    setFbLoading(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || ''
      const res = await fetch(apiUrl + '/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fbName, email: fbEmail, message: fbMessage })
      })
      if (res.ok) {
        setFbSent(true)
        setFbName('')
        setFbEmail('')
        setFbMessage('')
        setTimeout(() => { setFbSent(false); setShowFeedback(false) }, 3000)
      }
    } catch (err) {
      console.error('Feedback error:', err)
    }
    setFbLoading(false)
  }

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
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span className="text-sm text-slate-400">
            DokIQ — Юридический помощник. Не заменяет консультацию адвоката.
          </span>
          <button
            onClick={() => setShowFeedback(true)}
            className="text-sm text-yellow-400 hover:text-yellow-300 underline underline-offset-2"
          >
            Обратная связь
          </button>
        </div>
      </footer>

      {showFeedback && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowFeedback(false)}>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Обратная связь</h3>
              <button onClick={() => setShowFeedback(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>
            {fbSent ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-green-400 font-medium">Спасибо! Сообщение отправлено.</p>
              </div>
            ) : (
              <form onSubmit={submitFeedback} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Имя</label>
                  <input
                    type="text"
                    value={fbName}
                    onChange={e => setFbName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-yellow-400"
                    placeholder="Ваше имя"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={fbEmail}
                    onChange={e => setFbEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-yellow-400"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Сообщение</label>
                  <textarea
                    value={fbMessage}
                    onChange={e => setFbMessage(e.target.value)}
                    required
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-yellow-400 resize-none"
                    placeholder="Опишите ваш вопрос или предложение..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={fbLoading}
                  className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 py-2.5 rounded-lg font-bold hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {fbLoading ? 'Отправка...' : 'Отправить'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
