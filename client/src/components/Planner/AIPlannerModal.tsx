import React, { useState, useRef, useEffect } from 'react'
import { Sparkles, X, Send, Loader2, ChevronDown } from 'lucide-react'
import { settingsApi } from '../../api/client'
import ReactDOM from 'react-dom'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AIPlannerModalProps {
  tripId: number
  dayId?: number
  onClose: () => void
  onPlanApplied?: (undoLog: any[]) => void
}

export default function AIPlannerModal({ tripId, dayId, onClose, onPlanApplied }: AIPlannerModalProps): React.ReactElement {
  const isDay = dayId !== undefined
  const [messages, setMessages] = useState<Message[]>([])
  const [prompt, setPrompt] = useState('')
  const [model] = useState('gemini')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasGenerated, setHasGenerated] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const callApi = async (userPrompt: string) => {
    setLoading(true)
    setError(null)

    const newMessages: Message[] = [...messages, { role: 'user', content: userPrompt }]
    setMessages(newMessages)
    setPrompt('')

    const endpoint = isDay
      ? `/api/trips/${tripId}/days/${dayId}/ai-plan`
      : `/api/trips/${tripId}/ai-plan`

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: userPrompt,
          history: messages,
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(err.error || `Request failed (${resp.status})`)
      }
      const data = await resp.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.text || '(no response)' }])
      setHasGenerated(true)
      if (data.planApplied && onPlanApplied) {
        onPlanApplied(data.undoLog || []);
      }
    } catch (e: any) {
      setError(e.message || 'Request failed')
      // Remove the user message we optimistically added
      setMessages(messages)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = () => {
    const text = prompt.trim()
    if (!text || loading) return
    callApi(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const modal = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          width: '100%', maxWidth: 620,
          maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
          border: '1px solid var(--border-primary)',
          overflow: 'hidden',
          margin: 16,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '18px 20px 16px',
          borderBottom: '1px solid var(--border-faint)',
          flexShrink: 0,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={17} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
              {isDay ? 'Plan This Day' : 'Magic Trip Planner'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>
              {isDay
                ? 'AI will generate a schedule for this day'
                : 'AI will create an itinerary from your unplanned places'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-faint)', padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Chat area */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: 12,
          minHeight: 0,
        }}>
          {messages.length === 0 && !loading && (
            <div style={{
              textAlign: 'center', padding: '32px 0',
              color: 'var(--text-faint)', fontSize: 13,
            }}>
              <Sparkles size={32} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
              {isDay
                ? 'Describe what you want to do today, or just hit Generate.'
                : 'Describe your trip priorities, or just hit Generate.'}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                  : 'var(--bg-secondary)',
                color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                fontSize: 13, lineHeight: 1.6,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                border: msg.role === 'assistant' ? '1px solid var(--border-faint)' : 'none',
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '10px 14px',
                borderRadius: '14px 14px 14px 4px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-faint)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
                <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>Generating…</span>
              </div>
            </div>
          )}

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444', fontSize: 13,
            }}>
              ⚠ {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div style={{
          padding: '12px 16px 16px',
          borderTop: '1px solid var(--border-faint)',
          flexShrink: 0,
        }}>
          {!hasGenerated && (
            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8 }}>
              Optional: add a prompt to guide the AI (max 500 chars)
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value.slice(0, 500))}
              onKeyDown={handleKeyDown}
              placeholder={hasGenerated ? 'Refine the plan… (Enter to send)' : 'e.g. "Avoid museums, focus on food…" (Enter to send)'}
              rows={2}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: 10,
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontFamily: 'inherit',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.5,
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={loading}
              title={hasGenerated ? 'Send' : 'Generate'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 40, height: 40, borderRadius: 10,
                background: loading ? 'var(--bg-secondary)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none', cursor: loading ? 'default' : 'pointer',
                color: loading ? 'var(--text-faint)' : '#fff',
                flexShrink: 0,
              }}
            >
              {loading
                ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                : <Send size={16} />}
            </button>
          </div>
          {prompt.length > 400 && (
            <p style={{ fontSize: 10, color: prompt.length >= 500 ? '#ef4444' : 'var(--text-faint)', marginTop: 4, textAlign: 'right' }}>
              {prompt.length}/500
            </p>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return ReactDOM.createPortal(modal, document.body)
}
