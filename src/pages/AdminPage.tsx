import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface DashboardData {
  cases: { total: number; active: number; pending: number; paid: number }
  documents: { total: number }
  payments: { total: number; paidAmount: number; pendingAmount: number; currency: string }
  users: { total: number }
}

export default function AdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/')
      return
    }

    const token = localStorage.getItem('legal_mrl_token')
    fetch('/api/dashboard', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setData(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [user, navigate])

  if (!user?.isAdmin) return null

  if (loading) return <div className="text-center py-20 text-slate-400">Загрузка...</div>
  if (error) return <div className="text-center py-20 text-red-400">Ошибка: {error}</div>
  if (!data) return null

  const cards = [
    { title: 'Всего дел', value: data.cases.total, color: 'bg-blue-500' },
    { title: 'Активных', value: data.cases.active, color: 'bg-green-500' },
    { title: 'В ожидании', value: data.cases.pending, color: 'bg-yellow-500' },
    { title: 'Оплаченных', value: data.cases.paid, color: 'bg-purple-500' },
    { title: 'Документов', value: data.documents.total, color: 'bg-indigo-500' },
    { title: 'Пользователей', value: data.users.total, color: 'bg-pink-500' },
    { title: 'Платежей', value: data.payments.total, color: 'bg-teal-500' },
    { title: 'Оплачено', value: `${data.payments.paidAmount} ${data.payments.currency}`, color: 'bg-emerald-500' },
    { title: 'В ожидании', value: `${data.payments.pendingAmount} ${data.payments.currency}`, color: 'bg-orange-500' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">🛡 Админ-панель</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <div key={i} className={`${card.color} text-white p-6 rounded-xl shadow-lg`}>
            <div className="text-3xl font-bold">{card.value}</div>
            <div className="text-sm opacity-90 mt-1">{card.title}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
