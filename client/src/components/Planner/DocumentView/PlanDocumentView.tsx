import React, { useRef, useEffect } from 'react'
import {
  Calendar, MapPin, Sparkles, Search, Filter, Ticket,
  Map, PanelLeftOpen, X, CheckCircle2
} from 'lucide-react'
import type { UseDocumentViewOptions } from './useDocumentView'
import { useDocumentView } from './useDocumentView'
import { DocumentOutlineRail } from './DocumentOutlineRail'
import { DocumentDaySection } from './DocumentDaySection'
import { DocumentUnassignedDrawer } from './DocumentUnassignedDrawer'
import { formatDate } from '../../../utils/formatters'
import { useDocI18n } from './docI18n'

export interface PlanDocumentViewProps extends UseDocumentViewOptions {
  onSwitchToMap: () => void
  locale?: string
}

export const PlanDocumentView: React.FC<PlanDocumentViewProps> = (props) => {
  const { onSwitchToMap, locale = 'en' } = props
  const strings = useDocI18n()
  const doc = useDocumentView(props)
  const containerRef = useRef<HTMLDivElement>(null)

  // Scroll spy to highlight active day in the rail
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const daySections = doc.filteredDays.map(d => ({
        id: d.id,
        el: document.getElementById(`doc-day-${d.id}`),
      }))

      const containerTop = container.scrollTop + 140
      for (let i = daySections.length - 1; i >= 0; i--) {
        const item = daySections[i]
        if (item.el && item.el.offsetTop <= containerTop) {
          doc.setActiveDayId(item.id)
          break
        }
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [doc.filteredDays, doc.setActiveDayId])

  // Total stop counter
  const totalStops = Array.from(doc.mergedItemsMap.values()).reduce((sum, items) => {
    return sum + items.filter(i => i.type === 'place').length
  }, 0)

  const totalBookings = props.reservations?.length ?? 0

  return (
    <div className="flex h-full w-full bg-surface text-content overflow-hidden relative font-sans">
      {/* ── Left Sticky Outline Rail ── */}
      {doc.outlineOpen && (
        <DocumentOutlineRail
          trip={props.trip}
          days={doc.sortedDays}
          activeDayId={doc.activeDayId}
          mergedItemsMap={doc.mergedItemsMap}
          unassignedCount={doc.unassignedPlaces.length}
          unassignedOpen={doc.unassignedDrawerOpen}
          onToggleUnassigned={() => doc.setUnassignedDrawerOpen(v => !v)}
          onSelectDay={doc.scrollToDay}
          compactMode={doc.compactMode}
          onToggleCompact={() => doc.setCompactMode(v => !v)}
          onSwitchToMap={onSwitchToMap}
          onClose={() => doc.setOutlineOpen(false)}
          locale={doc.locale}
        />
      )}

      {/* ── Main Document Scroll Container ── */}
      <main
        ref={containerRef}
        className="flex-1 h-full overflow-y-auto overscroll-contain px-4 sm:px-8 lg:px-14 py-6 sm:py-10"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="max-w-3xl lg:max-w-4xl mx-auto">
          {/* Cover Hero Banner if present */}
          {props.trip.cover_image && (
            <div className="w-full h-44 sm:h-56 md:h-64 rounded-3xl overflow-hidden mb-6 relative shadow-md">
              <img
                src={props.trip.cover_image.startsWith('http') || props.trip.cover_image.startsWith('/')
                  ? props.trip.cover_image
                  : `/uploads/${props.trip.cover_image}`}
                alt={props.trip.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-black/20 pointer-events-none" />
            </div>
          )}

          {/* ── Dossier Hero Header (Google Docs style) ── */}
          <header className="mb-8 pb-6 border-b border-edge-faint">
            <div className="flex items-center justify-between gap-4 mb-2.5">
              <div className="flex items-center gap-2">
                {!doc.outlineOpen && (
                  <button
                    type="button"
                    onClick={() => doc.setOutlineOpen(true)}
                    className="p-1.5 rounded-xl bg-surface-card hover:bg-surface-elevated text-content border border-edge transition-colors shadow-xs cursor-pointer"
                    title="Open outline"
                  >
                    <PanelLeftOpen size={16} />
                  </button>
                )}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-caption font-bold tracking-wider uppercase bg-accent/10 text-accent">
                  <Sparkles size={13} />
                  <span>Trip Plan</span>
                </span>
              </div>

              {/* View on Map Switcher Button */}
              <button
                type="button"
                onClick={onSwitchToMap}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-caption font-semibold bg-surface-card hover:bg-surface-elevated text-content border border-edge transition-colors shadow-xs cursor-pointer"
                title={strings.viewModeToggleHint}
              >
                <Map size={14} className="text-accent" />
                <span>{strings.viewModeMap}</span>
              </button>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-content tracking-tight mb-2">
              {props.trip.title}
            </h1>

            {props.trip.start_date && (
              <p className="text-body font-semibold text-content-muted flex items-center gap-2 mb-4">
                <Calendar size={15} className="text-accent" />
                <span>
                  {formatDate(props.trip.start_date, doc.locale)}
                  {props.trip.end_date && props.trip.end_date !== props.trip.start_date
                    ? ` – ${formatDate(props.trip.end_date, doc.locale)}`
                    : ''}
                </span>
                <span className="text-content-faint">·</span>
                <span className="text-content-faint">
                  {doc.sortedDays.length} {strings.statsDays.toLowerCase()}
                </span>
              </p>
            )}

            {/* Stat Counters Bar */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap pt-1">
              <div className="px-3 py-1.5 rounded-xl bg-surface-card border border-edge-faint text-caption font-semibold flex items-center gap-2 shadow-xs">
                <MapPin size={13} className="text-accent" />
                <span className="text-content font-bold">{totalStops}</span>
                <span className="text-content-muted">{strings.statsPlaces}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-surface-card border border-edge-faint text-caption font-semibold flex items-center gap-2 shadow-xs">
                <Ticket size={13} className="text-amber-500" />
                <span className="text-content font-bold">{totalBookings}</span>
                <span className="text-content-muted">{strings.statsBookings}</span>
              </div>
              <button
                type="button"
                onClick={() => doc.setUnassignedDrawerOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-surface-card hover:bg-surface-elevated border border-edge-faint text-caption font-semibold flex items-center gap-2 text-content cursor-pointer transition-all hover:border-edge shadow-xs"
              >
                <Sparkles size={13} className="text-blue-500" />
                <span className="font-bold">{doc.unassignedPlaces.length}</span>
                <span className="text-content-muted">{strings.statsUnassigned}</span>
              </button>
            </div>
          </header>

          {/* ── Sticky Toolbar: Search + View Modes ── */}
          <div className="sticky top-0 z-20 mb-8 py-2.5 bg-surface/90 backdrop-blur-md flex items-center justify-between gap-3 flex-wrap border-b border-edge-faint">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-faint pointer-events-none" />
              <input
                type="text"
                value={doc.searchQuery}
                onChange={e => doc.setSearchQuery(e.target.value)}
                placeholder={strings.filterSearchPlaceholder}
                className="w-full pl-9 pr-8 py-1.5 rounded-xl text-caption bg-surface-card border border-edge-faint focus:border-accent focus:outline-none transition-colors shadow-xs"
              />
              {doc.searchQuery && (
                <button
                  type="button"
                  onClick={() => doc.setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-faint hover:text-content p-0.5 rounded cursor-pointer"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => doc.setShowOnlyActiveDays(v => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-caption font-medium border transition-colors cursor-pointer ${
                  doc.showOnlyActiveDays
                    ? 'bg-accent text-accent-text border-accent shadow-xs'
                    : 'bg-surface-card text-content-muted hover:text-content border-edge-faint'
                }`}
              >
                <Filter size={12} />
                <span>{doc.showOnlyActiveDays ? strings.filterActiveOnly : strings.filterAll}</span>
              </button>

              {/* Sticky Return-to-Map Pill (Handy when scrolled down) */}
              <button
                type="button"
                onClick={onSwitchToMap}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-caption font-semibold bg-surface-card hover:bg-surface-elevated text-content border border-edge-faint hover:border-edge transition-colors shadow-xs cursor-pointer"
                title={strings.viewModeToggleHint}
              >
                <Map size={13} className="text-accent" />
                <span className="hidden sm:inline">{strings.viewModeMap}</span>
              </button>
            </div>
          </div>

          {/* ── Days Chapters Flow ── */}
          <div className="space-y-4">
            {doc.filteredDays.map((day, idx) => (
              <DocumentDaySection
                key={day.id}
                day={day}
                index={idx}
                items={doc.mergedItemsMap.get(day.id) || []}
                bookends={doc.dayBookendsMap.get(day.id)}
                categories={props.categories}
                compactMode={doc.compactMode}
                reservations={props.reservations}
                locale={doc.locale}
                timeFormat={doc.timeFormat}
                onPlaceClick={props.onPlaceClick}
                onEditPlace={props.onEditPlace}
                onRemoveAssignment={props.onRemoveAssignment}
                onMoveItem={doc.moveItem}
                onDayDetail={props.onDayDetail}
                onAddPlaceForDay={props.onAddPlaceForDay}
                onAddTransport={props.onAddTransport}
                onAddReservation={props.onAddReservation}
              />
            ))}
          </div>

          {/* ── Document Footer ── */}
          <footer className="mt-16 pt-8 pb-16 border-t border-edge-faint text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 text-accent mb-3">
              <CheckCircle2 size={20} />
            </div>
            <h4 className="text-title font-bold text-content mb-1">End of Itinerary</h4>
            <p className="text-body text-content-muted max-w-md mx-auto">
              {doc.sortedDays.length} days of adventure planned. Have a wonderful trip!
            </p>
          </footer>
        </div>
      </main>

      {/* ── Pull-out Unassigned Places Drawer ── */}
      <DocumentUnassignedDrawer
        isOpen={doc.unassignedDrawerOpen}
        onClose={() => doc.setUnassignedDrawerOpen(false)}
        places={doc.unassignedPlaces}
        categories={props.categories}
        days={doc.sortedDays}
        onAssignToDay={props.onAssignToDay}
        onPlaceClick={props.onPlaceClick}
      />
    </div>
  )
}
export default PlanDocumentView
