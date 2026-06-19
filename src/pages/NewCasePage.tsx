import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuthHeaders } from '../contexts/AuthContext'

export default function NewCasePage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Client data
  const [entityType, setEntityType] = useState<'individual' | 'company'>('individual')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [inn, setInn] = useState('')
  const [ogrn, setOgrn] = useState('')

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
      
      // Client data
      const clientData = {
        entityType,
        fullName: entityType === 'individual' ? fullName : contactPerson,
        companyName: entityType === 'company' ? companyName : undefined,
        contactPerson: entityType === 'company' ? contactPerson : undefined,
        phone,
        email,
        address,
        inn: inn || undefined,
        ogrn: ogrn || undefined
      }
      formData.append('clientData', JSON.stringify(clientData))
      
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
        {/* Тип лица */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Тип клиента
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setEntityType('individual')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                entityType === 'individual' 
                  ? 'bg-yellow-500 text-slate-900' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              👤 Физическое лицо
            </button>
            <button
              type="button"
              onClick={() => setEntityType('company')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                entityType === 'company' 
                  ? 'bg-yellow-500 text-slate-900' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              🏢 Юридическое лицо
            </button>
          </div>
        </div>

        {/* ФИО / Название компании */}
        {entityType === 'individual' ? (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              ФИО <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-900 border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              placeholder="Иванов Иван Иванович"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Название организации <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-900 border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              placeholder="ООО Ромашка"
            />
          </div>
        )}

        {/* Контактное лицо (только для юр) */}
        {entityType === 'company' && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Контактное лицо <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-900 border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              placeholder="Иванов Иван Иванович"
            />
          </div>
        )}

        {/* Телефон и Email */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Телефон <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-900 border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              placeholder="+7 999 123-45-67"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-900 border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              placeholder="example@mail.ru"
            />
          </div>
        </div>

        {/* Адрес */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Адрес <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            className="w-full px-3 py-2 bg-slate-900 border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            placeholder="г. Москва, ул. Примерная, д. 1, кв. 1"
          />
        </div>

        {/* ИНН и ОГРН */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              ИНН {entityType === 'company' && <span className="text-red-400">*</span>}
            </label>
            <input
              type="text"
              value={inn}
              onChange={(e) => setInn(e.target.value)}
              required={entityType === 'company'}
              maxLength={entityType === 'company' ? 10 : 12}
              className="w-full px-3 py-2 bg-slate-900 border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              placeholder={entityType === 'company' ? '10 цифр' : '12 цифр'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              ОГРН {entityType === 'company' && <span className="text-red-400">*</span>}
            </label>
            <input
              type="text"
              value={ogrn}
              onChange={(e) => setOgrn(e.target.value)}
              required={entityType === 'company'}
              maxLength={13}
              className="w-full px-3 py-2 bg-slate-900 border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              placeholder="13 цифр"
            />
          </div>
        </div>

        <div className="border-t border-slate-700 pt-6">
          <h2 className="text-lg font-semibold text-white mb-4">📋 Описание дела</h2>
          
          <div className="mb-4">
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

          <div className="mb-4">
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
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-yellow-500 text-slate-900 py-3 rounded-lg font-bold hover:bg-yellow-400 disabled:opacity-50 shadow-lg shadow-yellow-500/20"
          >
            {isSubmitting ? 'Создание...' : '✨ Создать дело'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/cases')}
            className="px-6 py-3 border border-slate-600 rounded-lg font-medium text-slate-300 hover:bg-slate-700"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}
