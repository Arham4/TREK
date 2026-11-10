import type { MTabScreenProps } from './tabModel'
import MPackingListTab from './MPackingListTab'
import MTodoListTab from './MTodoListTab'
import { OutfitsPlannerPanel } from '../../../components/Outfits/OutfitsPlannerPanel'

/**
 * Tab 4 — Listen (spec 03 §4). The header segmented switcher (Packing/To-do/Outfits,
 * with the packed/open/outfit badges) lives in the shell
 * (`MTripShell.tsx`, `trTab === 'listen'`) and drives `shell.listsTab`; this
 * panel renders the body for whichever sub-tab is active.
 */
export default function MListsTab({ planner, shell }: MTabScreenProps) {
  if (shell.listsTab === 'todo') {
    return <MTodoListTab planner={planner} />
  }
  if (shell.listsTab === 'outfits') {
    return (
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <OutfitsPlannerPanel tripId={planner.trip.id} canEdit={planner.can('packing_edit', planner.trip)} />
      </div>
    )
  }
  return <MPackingListTab planner={planner} />
}
