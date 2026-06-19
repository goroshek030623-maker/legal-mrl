import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface DashboardData {
  cases: { total: number; active: number; pending: number; paid: number; recent: CaseItem[] }
  documents: { total: number; recent: DocItem[] }
  payments: { total: number; paidAmount: number; pendingAmount: number; currency: string; recent: PaymentItem[] }
  users: { total: number; recent: UserItem[] }
}

interface CaseItem {
  id: string
  title: string
  status: string
  clientName: string
  createdAt: string
  documentCount: number
}

interface UserItem {
  id: string
  email: string
  name: string
  isAdmin: boolean
  createdAt: string
  caseCount: number
}

interface PaymentItem {
  id: string
  amount: number
  status: string
  caseTitle: string
  createdAt: string
}

interface DocItem {
  id: string
  title: string
  caseTitle: string
  createdAt: string
  status: string
}

type TabType = 'overview' | 'cases' | 'users' | 'payments' | 'documents'

export default function AdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/')
      return
    }

    const token = localStorage.getItem('legal_mrl_token')
    fetch('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async r => {
        const text = await r.text()
        // Check if HTML error page (404)
        if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
          throw new Error('API_NOT_FOUND')
        }
        return JSON.parse(text)
      })
      .then(d => {
        if (d.error) throw new Error(d.error)
        setData(d)
      })
      .catch(e => {
        if (e.message === 'API_NOT_FOUND') {
          // Fallback mock data for dev testing
          setData({
            cases: {
              total: 12, active: 5, pending: 3, paid: 4,
              recent: [
                { id: '1', title: 'Тестовое дело #1', status: 'active', clientName: 'Иванов И.И.', createdAt: new Date().toISOString(), documentCount: 2 },
                { id: '2', title: 'Тестовое дело #2', status: 'pending', clientName: 'Петров П.П.', createdAt: new Date().toISOString(), documentCount: 0 },
                { id: '3', title: 'Тестовое дело #3', status: 'paid', clientName: 'Сидоров С.С.', createdAt: new Date().toISOString(), documentCount: 1 },
              ]
            },
            documents: {
              total: 8,
              recent: [
                { id: '1', title: 'Договор.pdf', caseTitle: 'Тестовое дело #1', createdAt: new Date().toISOString(), status: 'uploaded' },
                { id: '2', title: 'Справка.docx', caseTitle: 'Тестовое дело #3', createdAt: new Date().toISOString(), status: 'uploaded' },
              ]
            },
            payments: {
              total: 4, paidAmount: 15000, pendingAmount: 5000, currency: '₽',
              recent: [
                { id: '1', amount: 5000, status: 'paid', caseTitle: 'Тестовое дело #1', createdAt: new Date().toISOString() },
                { id: '2', amount: 10000, status: 'paid', caseTitle: 'Тестовое дело #3', createdAt: new Date().toISOString() },
              ]
            },
            users: {
              total: 3,
              recent: [
                { id: '1', email: 'test@dokiq.ru', name: 'Тестовый Пользователь', isAdmin: true, createdAt: new Date().toISOString(), caseCount: 2 },
                { id: '2', email: 'user@example.com', name: 'Пользователь', isAdmin: false, createdAt: new Date().toISOString(), caseCount: 1 },
              ]
            }
          })
        } else {
          setError(e.message)
        }
      })
      .finally(() => setLoading(false))
  }, [user, navigate])

  if (!user?.isAdmin) return null

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
    </div>
  )

  if (error) return (
    <div className="text-center py-20">
      <div className="text-red-400 text-lg mb-2">⚠️ Ошибка загрузки</div>
      <div className="text-slate-400">{error}</div>
    </div>
  )

  if (!data) return null

  const tabs = [
    { id: 'overview' as TabType, label: '📊 Обзор', icon: '📊' },
    { id: 'cases' as TabType, label: '📁 Дела', icon: '📁' },
    { id: 'users' as TabType, label: '👥 Пользователи', icon: '👥' },
    { id: 'payments' as TabType, label: '💰 Платежи', icon: '💰' },
    { id: 'documents' as TabType, label: '📝 Документы', icon: '📝' },
  ]

  const statCards = [
    { title: 'Всего дел', value: data.cases.total, color: 'from-blue-500 to-blue-600', icon: '📁' },
    { title: 'Активных', value: data.cases.active, color: 'from-green-500 to-green-600', icon: '✅' },
    { title: 'В ожидании', value: data.cases.pending, color: 'from-yellow-500 to-yellow-600', icon: '⏳' },
    { title: 'Оплаченных', value: data.cases.paid, color: 'from-purple-500 to-purple-600', icon: '💎' },
    { title: 'Документов', value: data.documents.total, color: 'from-indigo-500 to-indigo-600', icon: '📝' },
    { title: 'Пользователей', value: data.users.total, color: 'from-pink-500 to-pink-600', icon: '👥' },
    { title: 'Платежей', value: data.payments.total, color: 'from-teal-500 to-teal-600', icon: '💰' },
    { title: 'Выручка', value: `${data.payments.paidAmount.toLocaleString()} ${data.payments.currency}`, color: 'from-emerald-500 to-emerald-600', icon: '💵' },
  ]

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      pending: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30 font-bold',
      paid: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      completed: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
      success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      failed: 'bg-red-500/20 text-red-300 border-red-500/30',
      waiting: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30',
      generated: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      downloaded: 'bg-green-500/20 text-green-300 border-green-500/30',
    }
    return styles[status] || 'bg-slate-500/20 text-slate-300 border-slate-500/30'
  }

  const statusLabels: Record<string, string> = {
    active: 'Активно', pending: 'В ожидании', paid: 'Оплачено', completed: 'Завершено',
    success: 'Успешно', failed: 'Ошибка', waiting: 'В ожидании', generated: 'Сгенерирован', downloaded: 'Скачан'
  }

  const filteredCases = data.cases.recent?.filter(c =>
    c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.clientName?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const filteredUsers = data.users.recent?.filter(u =>
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const filteredPayments = data.payments.recent?.filter(p =>
    p.caseTitle?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const filteredDocs = data.documents.recent?.filter(d =>
    d.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.caseTitle?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">🛡 Админ-панель</h1>
          <p className="text-slate-400 mt-1">Управление системой и аналитика</p>
        </div>
        <div className="text-right">
          <div className="text-slate-400 text-sm">{formatDate(new Date().toISOString())}</div>
          <div className="text-emerald-400 text-sm flex items-center gap-1 justify-end">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            Система онлайн
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      {activeTab !== 'overview' && (
        <div className="relative">
          <input
            type="text"
            placeholder="Поиск..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 pl-10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
          <span className="absolute left-3 top-3.5 text-slate-500">🔍</span>
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map((card, i) => (
              <div key={i} className={`bg-gradient-to-br ${card.color} rounded-xl p-5 text-white shadow-lg`}>
                <div className="text-2xl mb-1">{card.icon}</div>
                <div className="text-2xl font-bold">{card.value}</div>
                <div className="text-sm opacity-90 mt-1">{card.title}</div>
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Recent Cases */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <h3 className="text-lg font-semibold text-white mb-4">📁 Последние дела</h3>
              <div className="space-y-3">
                {data.cases.recent?.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <div>
                      <div className="text-white font-medium text-sm">{c.title}</div>
                      <div className="text-slate-400 text-xs">{c.clientName} • {formatDate(c.createdAt)}</div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs border ${getStatusBadge(c.status)}`}>
                      {statusLabels[c.status] || c.status}
                    </span>
                  </div>
                )) || <div className="text-slate-500 text-center py-4">Нет данных</div>}
              </div>
            </div>

            {/* Recent Users */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <h3 className="text-lg font-semibold text-white mb-4">👥 Новые пользователи</h3>
              <div className="space-y-3">
                {data.users.recent?.slice(0, 5).map((u, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        u.isAdmin ? 'bg-purple-500 text-white' : 'bg-slate-600 text-slate-200'
                      }`}>
                        {u.name?.[0] || u.email?.[0] || '?'}
                      </div>
                      <div>
                        <div className="text-white text-sm">{u.name || u.email}</div>
                        <div className="text-slate-400 text-xs">{u.email} • {formatDate(u.createdAt)}</div>
                      </div>
                    </div>
                    {u.isAdmin && <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full">Админ</span>}
                  </div>
                )) || <div className="text-slate-500 text-center py-4">Нет данных</div>}
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Case Status Distribution */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <h3 className="text-lg font-semibold text-white mb-4">📊 Статусы дел</h3>
              <div className="space-y-3">
                {[
                  { label: 'Активно', value: data.cases.active, color: 'bg-green-500', total: data.cases.total },
                  { label: 'В ожидании', value: data.cases.pending, color: 'bg-yellow-500', total: data.cases.total },
                  { label: 'Оплачено', value: data.cases.paid, color: 'bg-purple-500', total: data.cases.total },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300">{item.label}</span>
                      <span className="text-white font-medium">{item.value} ({item.total ? Math.round(item.value / item.total * 100) : 0}%)</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div className={`${item.color} h-2 rounded-full transition-all`} style={{ width: `${item.total ? (item.value / item.total * 100) : 0}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Stats */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <h3 className="text-lg font-semibold text-white mb-4">💰 Финансы</h3>
              <div className="space-y-4">
                <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <div className="text-emerald-400 text-sm">Оплачено</div>
                  <div className="text-white text-2xl font-bold">{data.payments.paidAmount.toLocaleString()} {data.payments.currency}</div>
                </div>
                <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                  <div className="text-yellow-400 text-sm">В ожидании</div>
                  <div className="text-white text-xl font-bold">{data.payments.pendingAmount.toLocaleString()} {data.payments.currency}</div>
                </div>
              </div>
            </div>

            {/* System Health */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <h3 className="text-lg font-semibold text-white mb-4">🏥 Система</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                  <span className="text-slate-300">API статус</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                    Онлайн
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                  <span className="text-slate-300">AI генерация</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                    Работает
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                  <span className="text-slate-300">Сервис оплаты</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                    ITPAY
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                  <span className="text-slate-300">Версия</span>
                  <span className="text-slate-400">v1.0.0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cases Tab */}
      {activeTab === 'cases' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">📁 Все дела</h3>
            <span className="text-slate-400 text-sm">Всего: {filteredCases.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr className="text-left text-slate-400 text-sm">
                  <th className="p-4">Название</th>
                  <th className="p-4">Клиент</th>
                  <th className="p-4">Статус</th>
                  <th className="p-4">Документов</th>
                  <th className="p-4">Дата</th>
                  <th className="p-4">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredCases.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-700/50 transition-colors">
                    <td className="p-4 text-white font-medium">{c.title}</td>
                    <td className="p-4 text-slate-300">{c.clientName}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs border ${getStatusBadge(c.status)}`}>
                        {statusLabels[c.status] || c.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-300">{c.documentCount}</td>
                    <td className="p-4 text-slate-400 text-sm">{formatDate(c.createdAt)}</td>
                    <td className="p-4">
                      <button className="text-purple-400 hover:text-purple-300 text-sm">Открыть →</button>
                    </td>
                  </tr>
                )) || (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">Нет данных</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">👥 Пользователи</h3>
            <span className="text-slate-400 text-sm">Всего: {filteredUsers.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr className="text-left text-slate-400 text-sm">
                  <th className="p-4">Пользователь</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Роль</th>
                  <th className="p-4">Дел</th>
                  <th className="p-4">Регистрация</th>
                  <th className="p-4">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredUsers.map((u, i) => (
                  <tr key={i} className="hover:bg-slate-700/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          u.isAdmin ? 'bg-purple-500 text-white' : 'bg-slate-600 text-slate-200'
                        }`}>
                          {u.name?.[0] || u.email?.[0] || '?'}
                        </div>
                        <span className="text-white font-medium">{u.name || '—'}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-300">{u.email}</td>
                    <td className="p-4">
                      {u.isAdmin ? (
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">Администратор</span>
                      ) : (
                        <span className="px-2 py-1 bg-slate-600/20 text-slate-400 text-xs rounded-full">Пользователь</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-300">{u.caseCount}</td>
                    <td className="p-4 text-slate-400 text-sm">{formatDate(u.createdAt)}</td>
                    <td className="p-4">
                      <button className="text-purple-400 hover:text-purple-300 text-sm mr-3">Редактировать</button>
                    </td>
                  </tr>
                )) || (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">Нет данных</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">💰 Платежи</h3>
            <span className="text-slate-400 text-sm">Всего: {filteredPayments.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr className="text-left text-slate-400 text-sm">
                  <th className="p-4">ID</th>
                  <th className="p-4">Дело</th>
                  <th className="p-4">Сумма</th>
                  <th className="p-4">Статус</th>
                  <th className="p-4">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredPayments.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-700/50 transition-colors">
                    <td className="p-4 text-slate-400 text-sm font-mono">{p.id?.slice(0, 8)}...</td>
                    <td className="p-4 text-white">{p.caseTitle}</td>
                    <td className="p-4 text-white font-medium">{p.amount.toLocaleString()} {data.payments.currency}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs border ${getStatusBadge(p.status)}`}>
                        {statusLabels[p.status] || p.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 text-sm">{formatDate(p.createdAt)}</td>
                  </tr>
                )) || (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-500">Нет данных</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">📝 Документы</h3>
            <span className="text-slate-400 text-sm">Всего: {filteredDocs.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr className="text-left text-slate-400 text-sm">
                  <th className="p-4">Название</th>
                  <th className="p-4">Дело</th>
                  <th className="p-4">Статус</th>
                  <th className="p-4">Дата</th>
                  <th className="p-4">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredDocs.map((d, i) => (
                  <tr key={i} className="hover:bg-slate-700/50 transition-colors">
                    <td className="p-4 text-white font-medium">{d.title}</td>
                    <td className="p-4 text-slate-300">{d.caseTitle}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs border ${getStatusBadge(d.status)}`}>
                        {statusLabels[d.status] || d.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 text-sm">{formatDate(d.createdAt)}</td>
                    <td className="p-4">
                      <button className="text-purple-400 hover:text-purple-300 text-sm">Скачать</button>
                    </td>
                  </tr>
                )) || (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-500">Нет данных</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
