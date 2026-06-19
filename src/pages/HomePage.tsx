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
          <div className="mt-6 inline-block bg-yellow-500/20 text-yellow-400 px-6 py-3 rounded-lg font-bold text-xl border border-yellow-500/30">
            Любой документ — 499 ₽
          </div>
          <div className="mt-8 flex justify-center gap-4 flex-wrap">
            <Link
              to="/cases/new"
              className="bg-yellow-500 text-slate-900 px-6 py-3 rounded-lg font-bold hover:bg-yellow-400 transition-colors"
            >
              ✨ Создать дело
            </Link>
            <Link
              to="/cases"
              className="bg-slate-700 text-white px-6 py-3 rounded-lg font-bold hover:bg-slate-600 transition-colors"
            >
              📋 Мои дела
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className="bg-purple-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-purple-500 transition-colors"
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
