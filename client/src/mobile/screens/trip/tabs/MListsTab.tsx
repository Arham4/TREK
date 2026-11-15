import type { MTabScreenProps } from './tabModel'
import MPackingListTab from './MPackingListTab'
import MTodoListTab from './MTodoListTab'
import { OutfitsPlannerPanel } from '../../../../components/Outfits/OutfitsPlannerPanel'
import { TabScroller } from './tabChrome'

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
    // The outfits panel's page layout stacks in this one scroll body (with the
    // same top/dock clearance every other list tab gets) instead of bringing
    // its own inner scroller, which trapped touch scrolling on the phone.
    return (
      <TabScroller wide="full">
        <OutfitsPlannerPanel tripId={planner.trip.id} canEdit={planner.can('packing_edit', planner.trip)} layout="page" />
      </TabScroller>
    )
  }
  return <MPackingListTab planner={planner} />
}
