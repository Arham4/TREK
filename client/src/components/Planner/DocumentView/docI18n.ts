import { useTranslation } from '../../../i18n'

export interface DocI18nStrings {
  viewModeMap: string
  viewModeDocument: string
  viewModeToggleHint: string
  outlineTitle: string
  outlineJumpTo: string
  outlineUnplanned: string
  dayMorning: string
  dayNight: string
  dayNoItems: string
  dayAddPlace: string
  dayAddNote: string
  dayAddTransport: string
  dayDetails: string
  filterAll: string
  filterActiveOnly: string
  filterSearchPlaceholder: string
  compactToggle: string
  statsDays: string
  statsPlaces: string
  statsBookings: string
  statsUnassigned: string
  assignToDay: string
  assignedTo: string
  notesSection: string
  unassignedDrawerTitle: string
  unassignedDrawerEmpty: string
  close: string
  walkTime: string
  driveTime: string
  transitTime: string
  viewOnMap: string
}

const EN_STRINGS: DocI18nStrings = {
  viewModeMap: 'Map View',
  viewModeDocument: 'Document View',
  viewModeToggleHint: 'Toggle Document / Map View (Alt+D)',
  outlineTitle: 'Itinerary Outline',
  outlineJumpTo: 'Jump to Day',
  outlineUnplanned: 'Unassigned Places',
  dayMorning: 'Morning / Wake up',
  dayNight: 'Night / Lodging',
  dayNoItems: 'No activities scheduled for this day yet.',
  dayAddPlace: 'Add Place',
  dayAddNote: 'Add Note',
  dayAddTransport: 'Add Transport',
  dayDetails: 'Day Details & Weather',
  filterAll: 'All Days',
  filterActiveOnly: 'Days with Activities',
  filterSearchPlaceholder: 'Search places, notes, or cities...',
  compactToggle: 'Compact View',
  statsDays: 'Days',
  statsPlaces: 'Stops',
  statsBookings: 'Bookings',
  statsUnassigned: 'Unplanned',
  assignToDay: 'Assign to Day',
  assignedTo: 'Assigned to',
  notesSection: 'Day Notes',
  unassignedDrawerTitle: 'Unassigned Places & Ideas',
  unassignedDrawerEmpty: 'All places have been scheduled into the itinerary!',
  close: 'Close',
  walkTime: 'walk',
  driveTime: 'drive',
  transitTime: 'transit',
  viewOnMap: 'View on map',
}

const DE_STRINGS: Partial<DocI18nStrings> = {
  viewModeMap: 'Kartenansicht',
  viewModeDocument: 'Dokumentansicht',
  viewModeToggleHint: 'Zwischen Dokument und Karte wechseln (Alt+D)',
  outlineTitle: 'Reiseplan-Gliederung',
  outlineJumpTo: 'Zu Tag springen',
  outlineUnplanned: 'Ungeplante Orte',
  dayMorning: 'Morgen / Aufwachen',
  dayNight: 'Nacht / Unterkunft',
  dayNoItems: 'Für diesen Tag sind noch keine Aktivitäten geplant.',
  dayAddPlace: 'Ort hinzufügen',
  dayAddNote: 'Notiz hinzufügen',
  dayAddTransport: 'Transport hinzufügen',
  dayDetails: 'Tagesdetails & Wetter',
  filterAll: 'Alle Tage',
  filterActiveOnly: 'Tage mit Aktivitäten',
  filterSearchPlaceholder: 'Orte, Notizen oder Städte suchen...',
  compactToggle: 'Kompaktansicht',
  statsDays: 'Tage',
  statsPlaces: 'Stopps',
  statsBookings: 'Buchungen',
  statsUnassigned: 'Ungeplant',
  assignToDay: 'Zu Tag zuweisen',
  assignedTo: 'Zugewiesen an',
  notesSection: 'Tagesnotizen',
  unassignedDrawerTitle: 'Ungeplante Orte & Ideen',
  unassignedDrawerEmpty: 'Alle Orte sind bereits im Reiseplan eingeteilt!',
  close: 'Schließen',
  walkTime: 'zu Fuß',
  driveTime: 'Fahrt',
  transitTime: 'Öffentliche',
  viewOnMap: 'Auf Karte zeigen',
}

export function useDocI18n(): DocI18nStrings {
  const { language } = useTranslation()
  const base = language.startsWith('de') ? DE_STRINGS : {}
  return { ...EN_STRINGS, ...base }
}
