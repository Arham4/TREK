import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Map, FileText } from 'lucide-react'
import type { UseDocumentViewOptions, PlanViewMode } from './useDocumentView'
import PlanDocumentView from './PlanDocumentView'
import { useDocI18n } from './docI18n'

export interface PlanDocumentHostProps extends UseDocumentViewOptions {
  locale?: string
}

interface DocViewErrorBoundaryProps {
  onSwitchToMap: () => void
  children: React.ReactNode
}

interface DocViewErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class DocViewErrorBoundary extends React.Component<DocViewErrorBoundaryProps, DocViewErrorBoundaryState> {
  state: DocViewErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): DocViewErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[DocumentView Error]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-surface-card border border-edge rounded-2xl m-6 max-w-lg mx-auto mt-20 shadow-lg">
          <p className="text-title font-bold text-danger mb-2">
            Could not render Document View
          </p>
          <p className="text-body text-content-muted font-mono mb-4 text-xs bg-surface-secondary p-3 rounded-lg w-full text-left overflow-auto max-h-32">
            {this.state.error?.message}
          </p>
          <button
            type="button"
            onClick={this.props.onSwitchToMap}
            className="px-4 py-2 rounded-xl text-caption font-semibold bg-accent text-accent-text hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
          >
            Switch to Map View
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export const PlanDocumentHost: React.FC<PlanDocumentHostProps> = (props) => {
  const { tripId } = props
  const strings = useDocI18n()

  // 1. Feature flag check
  const [isEnabled] = useState<boolean>(() => {
    try {
      if (typeof window === 'undefined') return true
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('docView') === '0') return false
      if (urlParams.get('docView') === '1') return true
      return localStorage.getItem('trek_doc_view_enabled') !== 'false'
    } catch {
      return true
    }
  })

  // 2. View Mode state
  const [viewMode, setViewModeState] = useState<PlanViewMode>(() => {
    try {
      const saved = localStorage.getItem(`trek_plan_view_mode_${tripId}`) || localStorage.getItem('trek_plan_view_mode')
      return (saved === 'map' || saved === 'document') ? saved : 'document'
    } catch {
      return 'document'
    }
  })

  const setViewMode = useCallback((mode: PlanViewMode) => {
    setViewModeState(mode)
    try {
      localStorage.setItem('trek_plan_view_mode', mode)
      localStorage.setItem(`trek_plan_view_mode_${tripId}`, mode)
    } catch {}
  }, [tripId])

  // Keyboard shortcut Alt+D to toggle
  useEffect(() => {
    if (!isEnabled) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        setViewMode(viewMode === 'document' ? 'map' : 'document')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEnabled, viewMode, setViewMode])

  if (!isEnabled) return null

  const isBrowser = typeof document !== 'undefined'

  return (
    <>
      {/* ── Floating Pill in Map Mode (Directly on top of map corridor) ── */}
      {viewMode === 'map' && isBrowser && createPortal(
        <div
          data-testid="doc-plan-floating-toggle"
          className="flex items-center"
          style={{
            position: 'fixed',
            top: 'calc(var(--nav-h, 56px) + 44px + 14px)',
            right: 360,
            zIndex: 35,
            pointerEvents: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode('document')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-caption font-semibold bg-surface-card/95 hover:bg-surface-elevated text-content border border-edge shadow-md backdrop-blur-md transition-all hover:scale-105 cursor-pointer"
            title={strings.viewModeToggleHint}
            aria-label="Document Plan"
          >
            <FileText size={13} className="text-accent" />
            <span>Document Plan</span>
          </button>
        </div>,
        document.body
      )}



      {/* ── Full Stage Document View (covers map at z-35, below inspectors at z-50) ── */}
      {viewMode === 'document' && (
        <div
          data-testid="plan-document-stage"
          className="bg-surface text-content"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 35,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <DocViewErrorBoundary onSwitchToMap={() => setViewMode('map')}>
            <PlanDocumentView
              {...props}
              onSwitchToMap={() => setViewMode('map')}
            />
          </DocViewErrorBoundary>
        </div>
      )}
    </>
  )
}
export default PlanDocumentHost
