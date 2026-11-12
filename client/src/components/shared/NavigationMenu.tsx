import { Navigation } from 'lucide-react'
import type { NavigationTarget } from '../Planner/placeNavigation'
import { navigationTargetLabel, openNavigationTarget } from '../Planner/placeNavigation'
import { useTranslation } from '../../i18n'
import { AnchoredMenu } from './AnchoredMenu'

interface NavigationMenuProps {
  targets: NavigationTarget[]
  /** The element the menu is anchored to; it is measured, never moved. */
  anchor: HTMLElement | null
  onClose: () => void
  /** Heading above the list. Omitted on desktop, where the trigger says it. */
  title?: string
}

/** The map-app picker: the menu frame is AnchoredMenu's, the entries are the targets. */
export function NavigationMenu({ targets, anchor, onClose, title }: NavigationMenuProps) {
  const { t } = useTranslation()
  return (
    <AnchoredMenu
      anchor={anchor}
      onClose={onClose}
      title={title}
      items={targets.map(target => ({
        key: target.id,
        label: navigationTargetLabel(target, t),
        icon: <Navigation size={13} />,
        onSelect: () => openNavigationTarget(target),
      }))}
    />
  )
}
