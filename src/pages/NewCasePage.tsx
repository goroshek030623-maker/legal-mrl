import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuthHeaders } from '../contexts/AuthContext'

export default function NewCasePage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('description', description)
      files.forEach((file) => {
        formData.append('files', file)
      })

      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      })

      if (!res.ok) throw new Error('Failed to create case')

      const data = await res.json()
      navigate(`/cases/${data.id}`)
    } catch (err) {
      alert('Ошибка при создании дела: ' + (err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 text-white">Новое дело</h1>

      <form onSubmit={handleSubmit} className="space-y-6 bg-slate-800/50 p-6 rounded-lg border border-slate-700 backdrop-blur">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Название дела
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 bg-slate-900 border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            placeholder="Например: Иск о взыскании задолженности"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Описание ситуации
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 bg-slate-900 border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            placeholder="Опишите ситуацию кратко..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Материалы дела
          </label>
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            className="w-full px-3 py-2 bg-slate-900 border-slate-600 rounded-lg text-white"
            accept=".pdf,.doc,.docx,image/*"
          />
          <p className="text-xs text-slate-400 mt-1">
            PDF, DOC, DOCX, JPG, PNG (до 50MB)
          </p>
          {files.length > 0 && (
            <div className="mt-2 space-y-1">
              {files.map((file, i) => (
                <div key={i} className="text-sm text-slate-300 bg-slate-900 px-3 py-2 rounded border border-slate-700">
                  {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-yellow-500 text-slate-900 py-2 rounded-lg font-bold hover:bg-yellow-400 disabled:opacity-50 shadow-lg shadow-yellow-500/20"
          >
            {isSubmitting ? 'Создание...' : 'Создать дело'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/cases')}
            className="px-6 py-2 border border-slate-600 rounded-lg font-medium text-slate-300 hover:bg-slate-700"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}