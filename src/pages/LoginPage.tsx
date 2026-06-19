import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const url = isRegister ? '/api/register' : '/api/login'
    const body = isRegister
      ? { email, password, fullName }
      : { email, password }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ошибка')

      login(data.token, { id: data.userId, email: data.email, fullName: data.fullName })
      navigate('/')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-slate-800/50 p-8 rounded-lg border border-slate-700 backdrop-blur">
        <h1 className="text-2xl font-bold mb-6 text-center text-white">
          {isRegister ? 'Регистрация' : 'Вход'}
        </h1>

        {error && (
          <div className="bg-red-900/30 text-red-400 p-3 rounded-lg mb-4 text-sm border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border-slate-600 rounded-lg text-white placeholder-slate-500"
              required
              placeholder="you@example.com"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">ФИО</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border-slate-600 rounded-lg text-white placeholder-slate-500"
                placeholder="Иванов Иван Иванович"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border-slate-600 rounded-lg text-white placeholder-slate-500"
              required
              minLength={6}
              placeholder="минимум 6 символов"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-yellow-500 text-slate-900 py-2 rounded-lg font-bold hover:bg-yellow-400 disabled:opacity-50 shadow-lg shadow-yellow-500/20"
          >
            {isLoading ? 'Загрузка...' : isRegister ? 'Создать аккаунт' : 'Войти'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          {isRegister ? (
            <p>
              Уже есть аккаунт?{' '}
              <button onClick={() => setIsRegister(false)} className="text-yellow-400 hover:text-yellow-300 hover:underline">
                Войти
              </button>
            </p>
          ) : (
            <p>
              Нет аккаунта?{' '}
              <button onClick={() => setIsRegister(true)} className="text-yellow-400 hover:text-yellow-300 hover:underline">
                Регистрация
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
