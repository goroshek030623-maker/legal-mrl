import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Helmet } from 'react-helmet-async'

export default function HomePage() {
  const { user } = useAuth()
  const isAdmin = user?.isAdmin || false

  return (
    <>
      <Helmet>
        <title>DokIQ — Юридический помощник</title>
        <meta name="description" content="Загрузите материалы дела, получите экспертный анализ и рекомендации. Иски, договоры, претензии онлайн." />
        <link rel="canonical" href="https://dokiq.ru/app/" />
      </Helmet>
      <div className="space-y-8">
        <div className="text-center py-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Юридический помощник
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Загрузите материалы дела, получите Экспертный анализ и рекомендации по составлению документов
          </p>
          <div className="mt-6 inline-block bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 px-8 py-3 rounded-xl font-bold text-xl shadow-lg shadow-yellow-500/40 border-2 border-yellow-300">
            Любой документ — 499 ₽
          </div>
          <div className="mt-8 flex justify-center gap-4 flex-wrap">
            <Link
              to="/cases/new"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:scale-105 active:scale-95 transition-all duration-200"
            >
              ✨ Создать дело
            </Link>
            <Link
              to="/cases"
              className="inline-flex items-center gap-2 bg-slate-700 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-600 hover:scale-105 active:scale-95 transition-all duration-200 border border-slate-600"
            >
              📋 Мои дела
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 active:scale-95 transition-all duration-200"
              >
                👑 Админка
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
