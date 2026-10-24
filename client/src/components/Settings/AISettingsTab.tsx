import React, { useState } from 'react'
import { Sparkles, Eye, EyeOff, Save } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { useToast } from '../shared/Toast'
import { settingsApi } from '../../api/client'
import Section from './Section'

export default function AISettingsTab(): React.ReactElement {
  const { t } = useTranslation()
  const toast = useToast()

  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState('gemini')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key')
      return
    }
    setSaving(true)
    try {
      await settingsApi.setBulk({ ai_api_key: apiKey.trim(), ai_model: model })
      toast.success('AI settings saved')
      setApiKey('')
    } catch {
      toast.error('Failed to save AI settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title="AI Planner" icon={Sparkles}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
        Configure your AI model to unlock the Magic Planner feature. Your API key is stored encrypted.
      </p>

      {/* API Key */}
      <div>
        <label
          style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}
        >
          API Key
        </label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Paste your Gemini API key…"
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => setShowKey(v => !v)}
            title={showKey ? 'Hide key' : 'Show key'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: 8,
              border: '1px solid var(--border-primary)',
              background: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
            }}
          >
            {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 5 }}>
          Get a free key at{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)' }}
          >
            aistudio.google.com
          </a>
          . Leave blank to keep your current key.
        </p>
      </div>

      {/* Model */}
      <div>
        <label
          style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}
        >
          Model
        </label>
        <select
          value={model}
          onChange={e => setModel(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--border-primary)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          <option value="gemini">Gemini (Google)</option>
        </select>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', borderRadius: 8,
          border: 'none', background: 'var(--accent)', color: 'var(--accent-text)',
          fontSize: 13, fontWeight: 500, cursor: saving ? 'default' : 'pointer',
          opacity: saving ? 0.6 : 1, fontFamily: 'inherit',
        }}
      >
        {saving
          ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          : <Save size={14} />}
        {saving ? 'Saving…' : 'Save'}
      </button>
    </Section>
  )
}
