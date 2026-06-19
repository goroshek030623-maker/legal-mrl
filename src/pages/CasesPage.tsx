import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getAuthHeaders } from '../contexts/AuthContext'

interface Case {
  id: string
  title: string
  status: string
  createdAt: string
  documentCount: number
  caseType?: string
}

export default function CasesPage() {
  const { data: cases, isLoading } = useQuery({
    queryKey: ['cases'],
    queryFn: async () => {
      const res = await fetch('/api/cases', { headers: getAuthHeaders() })
      const data = await res.json() as Case[]
      return data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
  })

  if (isLoading) return <div className="text-center py-8">Загрузка...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Мои запросы</h1>
        <div className="flex gap-2">
          <Link
            to="/cases/new?type=legal"
            className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-400 text-sm shadow-lg shadow-red-500/20"
          >
            + Юридический
          </Link>
          <Link
            to="/cases/new?type=business"
            className="bg-yellow-500 text-slate-900 px-4 py-2 rounded-lg font-bold hover:bg-yellow-400 text-sm shadow-lg shadow-yellow-500/20"
          >
            + Деловой
          </Link>
        </div>
      </div>

      {!cases?.length ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700 backdrop-blur">
          <p className="text-slate-400 mb-4">У вас пока нет запросов</p>
          <div className="flex justify-center gap-2">
            <Link
              to="/cases/new?type=legal"
              className="text-yellow-400 font-medium hover:text-yellow-300 hover:underline"
            >
              Создать юридический
            </Link>
            <span className="text-slate-400">|</span>
            <Link
              to="/cases/new?type=business"
              className="text-yellow-400 font-medium hover:text-yellow-300 hover:underline"
            >
              Создать деловой
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {cases.map((c) => {
            const isLegal = c.caseType !== 'business'
            return (
              <Link
                key={c.id}
                to={`/cases/${c.id}`}
                className="block bg-slate-800/50 p-6 rounded-lg border border-slate-700 backdrop-blur hover:border-yellow-500/50 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isLegal ? 'bg-red-900/30 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {isLegal ? 'Юридический' : 'Деловой'}
                      </span>
                    </div>
                    <h3 className="font-semibold text-lg">{c.title}</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Создано: {new Date(c.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    c.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                    c.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {c.status === 'active' ? 'Активно' :
                     c.status === 'pending' ? 'На рассмотрении' :
                     'Завершено'}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mt-2">
                  Документов: {c.documentCount}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}