import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface AnchoredMenuItem {
  key: string | number
  label: string
  icon?: ReactNode
  onSelect: () => void
}

interface AnchoredMenuProps {
  /** The element the menu is anchored to; it is measured, never moved. */
  anchor: HTMLElement | null
  items: AnchoredMenuItem[]
  onClose: () => void
  /** Heading above the list. */
  title?: string
  /** Accessible name of the menu itself. */
  label?: string
  minWidth?: number
}

const GAP = 6
const EDGE = 8

/**
 * A menu that hangs off a trigger.
 *
 * Portalled rather than nested, because its call sites sit inside panels that
 * clip their overflow — a menu rendered in place would be cut off at the panel
 * edge. Being in the body means the position has to be computed, and computed
 * after the menu has a size: opening near the bottom of the window flips it
 * above the trigger instead of letting it run off the screen, and a menu wider
 * than the space to its right is pulled back inside.
 */
export function AnchoredMenu({ anchor, items, onClose, title, label, minWidth = 186 }: AnchoredMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Layout effect, not effect: the menu is placed before the browser paints, so
  // it never appears at the wrong spot for a frame and jumps.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !anchor) return
    const place = () => {
      const a = anchor.getBoundingClientRect()
      const m = el.getBoundingClientRect()
      const below = window.innerHeight - a.bottom
      const flip = below < m.height + GAP + EDGE && a.top > below
      const top = flip ? Math.max(EDGE, a.top - m.height - GAP) : a.bottom + GAP
      const left = Math.min(Math.max(EDGE, a.left), window.innerWidth - m.width - EDGE)
      setPos({ top, left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor, items.length])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchor?.contains(e.target as Node)) onClose()
    }
    // Capture phase and prevented: a dialog behind the menu also closes on Escape, but not on one the menu took.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [anchor, onClose])

  if (items.length === 0) return null

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      style={{
        position: 'fixed',
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        // Hidden until measured, so the first paint is never in the wrong place.
        visibility: pos ? 'visible' : 'hidden',
        zIndex: 99999,
        minWidth,
        maxHeight: `calc(100vh - ${EDGE * 2}px)`,
        overflowY: 'auto',
        // Portaled and fixed like CustomSelect's list, so it chains to the viewport
        // unless told otherwise (#2078).
        overscrollBehavior: 'contain',
        padding: 5,
        background: 'var(--bg-card)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        boxShadow: '0 10px 34px rgba(0,0,0,0.16)',
        animation: 'trek-menu-enter 180ms cubic-bezier(0.23, 1, 0.32, 1)',
        willChange: 'transform, opacity',
      }}
    >
      {title && (
        <div style={{
          padding: '5px 10px 7px',
          fontSize: 'calc(11px * var(--fs-scale-caption, 1))',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
        }}>
          {title}
        </div>
      )}
      {items.map(item => (
        <button type="button"
          key={item.key}
          role="menuitem"
          onClick={() => { item.onSelect(); onClose() }}
          style={{
            display: 'flex', alignItems: 'center', gap: 9, width: '100%',
            padding: '8px 10px', borderRadius: 8, border: 'none',
            background: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 'calc(12.5px * var(--fs-scale-body, 1))', fontWeight: 500,
            textAlign: 'start', color: 'var(--text-primary)',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
        >
          {item.icon && <span style={{ flexShrink: 0, color: 'var(--text-faint)', display: 'flex' }}>{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  )
}
