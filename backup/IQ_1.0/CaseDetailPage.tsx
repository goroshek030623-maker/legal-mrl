// @ts-nocheck
import { useState, useEffect } from 'react'
import { getAuthHeaders } from '../contexts/AuthContext'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

const actionLabels: Record<string, string> = {
  respond: 'Ответить на иск',
  objection: 'Возражение',
  settlement: 'Мировое соглашение',
  lawyer: 'Консультация юриста',
  contract: 'Договор',
  expert: 'Судебная экспертиза',
  claim: 'Претензия',
  close: 'Закрыть дело'
}

const actionEmojis: Record<string, string> = {
  respond: '⚖️',
  objection: '🛡️',
  settlement: '🤝',
  lawyer: '💬',
  contract: '📝',
  expert: '🔍',
  claim: '📄',
  close: '🚪'
}

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState('analysis')
  const [isEditing, setIsEditing] = useState(false)
  const [editedCase, setEditedCase] = useState({})
  const [analyzeProgress, setAnalyzeProgress] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [suggestedActions, setSuggestedActions] = useState<string[]>([])
  const [selectedAction, setSelectedAction] = useState<string | null>(null)
  const [generatedDoc, setGeneratedDoc] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [qrTimer, setQrTimer] = useState(0)
  const [paymentData, setPaymentData] = useState(null)

  const { data: caseData, isLoading, refetch } = useQuery({
    queryKey: ['case', id],
    queryFn: async () => {
      const res = await fetch(`/api/cases/${id}`, {
        headers: getAuthHeaders()
      })
      if (!res.ok) throw new Error('Failed to fetch case')
      return res.json()
    }
  })

  useEffect(() => {
    if (caseData?.generatedDocument && !generatedDoc) {
      setIsPaid(false)  // Reset payment status for new document
      setGeneratedDoc({
        id: `${id}-doc`,
        type: caseData.serviceType || 'document',
        status: 'completed',
        preview: caseData.generatedDocument.substring(0, 1000) + (caseData.generatedDocument.length > 1000 ? '...' : ''),
        fullText: caseData.generatedDocument,
        createdAt: new Date().toISOString()
      })
    }
  }, [caseData?.generatedDocument])

  useEffect(() => {
    if (caseData?.suggestedActions) {
      setSuggestedActions(caseData.suggestedActions)
    }
  }, [caseData?.suggestedActions])



  const handleUpdateCase = async () => {
    try {
      const res = await fetch(`/api/cases/${id}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(editedCase)
      })
      if (!res.ok) throw new Error('Failed to update case')
      setIsEditing(false)
      refetch()
    } catch (err: any) {
      alert('Ошибка обновления: ' + err.message)
    }
  }

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setAnalyzeProgress(0)
    const progressInterval = setInterval(() => {
      setAnalyzeProgress(prev => Math.min(prev + 5, 90))
    }, 500)
    try {
      const res = await fetch(`/api/cases/${id}/analyze`, { method: 'POST', headers: getAuthHeaders() })
      const data = await res.json()
      setSuggestedActions(data.suggestedActions || [])
      refetch()
    } catch (err: any) {
      alert('Ошибка анализа: ' + err.message)
    } finally {
      if (progressInterval) clearInterval(progressInterval)
      setAnalyzeProgress(100)
      setTimeout(() => {
        setIsAnalyzing(false)
        setAnalyzeProgress(0)
      }, 1000)
    }
  }

  const handleGenerateDocument = async (action: string) => {
    setIsGenerating(true)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 минут
      
      const res = await fetch(`/api/cases/${id}/generate-document`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, clientData: {} }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('Failed to generate document')
      const data = await res.json()
      setGeneratedDoc(data.document)
      refetch()
    } catch (err: any) {
      alert('Ошибка генерации: ' + err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async () => {
    if (!generatedDoc) return
    try {
      const res = await fetch(`/api/generated/${id}`, { headers: getAuthHeaders() })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        if (errData.paymentRequired) {
          alert('Документ доступен только после оплаты 499 ₽')
          return
        }
        throw new Error('Failed to download')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `document-${id}.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert('Ошибка скачивания: ' + err.message)
    }
  }

  const handlePayAndDownload = async () => {
    if (!generatedDoc || !id) return
    setIsPaying(true)
    try {
      const payRes = await fetch(`/api/cases/${id}/pay`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 499, method: 'sbp' })
      })
      const payData = await payRes.json()
      if (!payRes.ok) throw new Error(payData.error || 'Payment failed')
      
      if (payData.paymentUrl || payData.paymentQrImages || payData.paymentId) {
        setPaymentData(payData)
        setShowQrModal(true)
        setQrTimer(15) // 15 секунд задержка для кнопки "Я оплатил"
        // Start polling payment status
        const interval = setInterval(async () => {
          try {
            const res = await fetch(`/api/payments/${payData.paymentId}/status`)
            if (!res.ok) return
            const data = await res.json()
            if (data.paid) {
              setIsPaid(true)
              setShowQrModal(false)
              handleDownload()
              clearInterval(interval)
            }
          } catch (e) {
            console.log('Payment status check error:', e)
          }
        }, 5000)
        // Clean up interval after 10 minutes (max payment time)
        setTimeout(() => clearInterval(interval), 600000)
      } else {
        handleDownload()
      }
    } catch (err: any) {
      alert('Ошибка оплаты: ' + err.message)
    } finally {
      setIsPaying(false)
    }
  }

  const handleUpload = async () => {
    if (!uploadFiles?.length) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      Array.from(uploadFiles).forEach(file => formData.append('files', file))
      const res = await fetch(`/api/cases/${id}/documents`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      })
      if (!res.ok) throw new Error('Failed to upload')
      setUploadFiles(null)
      refetch()
    } catch (err: any) {
      alert('Ошибка загрузки: ' + err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      new: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      closed: 'bg-gray-100 text-gray-800'
    }
    const labels: Record<string, string> = {
      new: 'Новый',
      active: 'Активный',
      pending: 'В ожидании',
      closed: 'Закрыт'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  const getServiceTypeLabel = (type?: string) => {
    const labels: Record<string, string> = {
      consultation: 'Консультация',
      document: 'Документ',
      'case-analysis': 'Анализ дела',
      'contract-check': 'Проверка договора',
      'contractor-check': 'Проверка контрагента'
    }
    return labels[type || ''] || type
  }

  if (isLoading) return <div className="p-8 text-center">Загрузка...</div>
  if (!caseData) return <div className="p-8 text-center text-red-600">Дело не найдено</div>

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/cases" className="hover:underline">Мои дела</Link>
        <span>/</span>
        <span>{caseData.title}</span>
      </div>

      {/* Заголовок дела */}
      <div className="bg-white p-6 rounded-lg border">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold">{caseData.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Создано: {new Date(caseData.createdAt).toLocaleDateString('ru-RU')}
            </p>
          </div>
          {getStatusBadge(caseData.status)}
        </div>

        {caseData.description && (
          <p className="text-gray-700 mb-4">{caseData.description}</p>
        )}

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {isAnalyzing ? `Анализируем... ${analyzeProgress}%` : '🔍 AI-анализ'}
          </button>
          {isAnalyzing && (
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${analyzeProgress}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Результат анализа */}
      {caseData.analysis && (
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <h2 className="font-semibold text-blue-900 mb-2">Результат анализа</h2>
          <div className="text-blue-800 whitespace-pre-wrap">{caseData.analysis}</div>
        </div>
      )}

      {/* Рекомендуемые действия */}
      {suggestedActions.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm">3</div>
            <h2 className="text-lg font-semibold">Рекомендуемые действия</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestedActions.map((action, index) => (
              <button
                key={index}
                onClick={() => setSelectedAction(action)}
                className={`p-4 rounded-lg border text-left transition-all ${selectedAction === action ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-200' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'}`}
              >
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl">{actionEmojis[action] || '▶️'}</span>
                  <span className="font-semibold">{actionLabels[action] || action}</span>
                </div>
              </button>
            ))}
          </div>
          {selectedAction && (
            <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-purple-800 mb-2">
                Выбрано: <strong>{actionLabels[selectedAction] || selectedAction}</strong>
              </p>
              <button
                onClick={() => handleGenerateDocument(selectedAction)}
                disabled={isGenerating}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {isGenerating ? 'Генерация...' : '📝 Сформировать документ'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Сгенерированный документ */}
      {generatedDoc && (
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-lg font-semibold">Сформированный документ</h2>
            {!isPaid && (
              <button
                onClick={handlePayAndDownload}
                disabled={isPaying}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {isPaying ? 'Обработка...' : '💳 Оплатить 499 ₽'}
              </button>
            )}
            {isPaid && (
              <span className="text-green-600 font-medium">✅ Оплачено</span>
            )}
          </div>
          <div className="bg-white p-8 rounded border-2 border-gray-200 shadow-sm whitespace-pre-wrap text-base font-serif leading-relaxed text-justify text-gray-900 min-h-[400px]">
            {isPaid ? (
              generatedDoc.fullText
            ) : (
              <>
                {generatedDoc.fullText.substring(0, Math.floor(generatedDoc.fullText.length * 0.3))}
                <div className="relative mt-4">
                  <div className="h-32 bg-gradient-to-b from-transparent to-white relative z-10"></div>
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <div className="bg-white px-6 py-3 rounded-lg border shadow-lg text-center">
                      <p className="text-gray-700 font-medium mb-1">Продолжение доступно после оплаты</p>
                      <p className="text-sm text-gray-500">Сумма: 499 ₽</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          {isPaid && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={handleDownload}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
              >
                📥 Скачать документ (.docx)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Документы */}
      <div className="bg-white p-6 rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">Документы</h2>

        <div className="mb-4">
          <input
            type="file"
            multiple
            onChange={(e) => setUploadFiles(e.target.files)}
            className="w-full px-3 py-2 border rounded-lg mb-2"
            accept=".pdf,.doc,.docx,image/*"
          />
          {uploadFiles && uploadFiles.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Выбрано: {uploadFiles.length} файл(ов)
              </span>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {isUploading ? 'Загрузка...' : 'Загрузить'}
              </button>
            </div>
          )}
        </div>

        {caseData.documents?.length ? (
          <div className="space-y-2">
            {caseData.documents.map((doc: any) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {doc.type?.startsWith('image/') ? '📷' :
                     doc.type?.includes('pdf') ? '📄' : '📎'}
                  </span>
                  <div>
                    <p className="font-medium">{doc.name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(doc.uploadedAt).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                </div>
                <a
                  href={`/api/documents/${doc.id}`}
                  download
                  className="text-blue-600 hover:underline text-sm"
                >
                  Скачать
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            Пока нет документов. Загрузите материалы дела.
          </p>
        )}
      </div>
    
      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Оплата через СБП</h3>
            <p className="text-sm text-gray-600 mb-4">Сумма: 499 ₽</p>
            {paymentData?.paymentQrImages ? (
              <img src={paymentData.paymentQrImages.desktop || paymentData.paymentQrImages} alt="QR Code СБП" className="w-full mb-4 border" />
            ) : (
              <img src="/images/sbp-qr.png" alt="QR Code СБП" className="w-full mb-4 border" />
            )}
            <p className="text-xs text-gray-500 mb-4 text-center">Отсканируйте QR-код в приложении банка</p>
            {paymentData?.paymentUrl && (
              <a href={paymentData.paymentUrl} target="_blank" rel="noopener noreferrer" className="block text-blue-600 underline mb-4 text-center">
                Открыть в банке
              </a>
            )}
            <div className="flex gap-2">
              {qrTimer > 0 ? (
                <button
                  disabled
                  className="flex-1 bg-gray-300 text-gray-500 py-2 rounded-lg font-medium cursor-not-allowed"
                >
                  ⏱ Подождите {qrTimer} сек...
                </button>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/payments/${paymentData.paymentId}/status`)
                      if (!res.ok) throw new Error('Failed to check')
                      const data = await res.json()
                      if (data.paid) {
                        setIsPaid(true)
                        setShowQrModal(false)
                        handleDownload()
                      } else {
                        alert('Оплата не подтверждена. Если вы уже оплатили, подождите 1-2 минуты и попробуйте снова.')
                      }
                    } catch (e) {
                      alert('Ошибка проверки: ' + e.message)
                    }
                  }}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700"
                >
                  ✅ Проверить оплату и получить документ
                </button>
              )}
              <button
                onClick={() => setShowQrModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-300"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
