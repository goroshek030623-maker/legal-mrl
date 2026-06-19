import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function HomePage() {
  const { user } = useAuth()
  const isAdmin = user?.isAdmin || false

  return (
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
            className="bg-yellow-500 text-slate-900 px-6 py-3 rounded-lg font-bold hover:bg-yellow-400 shadow-lg shadow-yellow-500/20"
          >
            Создать дело
          </Link>
          <Link
            to="/cases"
            className="border border-yellow-500 text-yellow-400 px-6 py-3 rounded-lg font-bold hover:bg-yellow-500/10"
          >
            Мои дела
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className="bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700"
            >
              🛡 Админ-панель
            </Link>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 backdrop-blur hover:border-yellow-500/30 transition-all">
          <div className="text-2xl mb-2">📁</div>
          <h3 className="font-semibold mb-2">Загрузка материалов</h3>
          <p className="text-slate-300 text-sm">PDF, DOC, фото — всё что связано с делом</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 backdrop-blur hover:border-yellow-500/30 transition-all">
          <div className="text-2xl mb-2">🤖</div>
          <h3 className="font-semibold mb-2">Экспертный анализ</h3>
          <p className="text-slate-300 text-sm">Изучаем ситуацию и предлагаем стратегию</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 backdrop-blur hover:border-yellow-500/30 transition-all">
          <div className="text-2xl mb-2">📄</div>
          <h3 className="font-semibold mb-2">Готовые документы</h3>
          <p className="text-slate-300 text-sm">Иски, отзывы, ходатайства — по шаблонам</p>
        </div>
      </div>
    </div>
  )
}
