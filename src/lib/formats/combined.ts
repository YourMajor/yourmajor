// Low Gross / Low Net combined — emit a single ranking that surfaces both gross and net.
// We rank primarily by net (so the "leader" of the combined event is the net winner),
// but the per-row PlayerStanding carries both grossVsPar and netVsPar so a UI can render
// two separate columns and crown two winners.

import { strokePlayStrategy } from './strokePlay'
import type { FormatStrategy } from './types'

export const lowGrossLowNetStrategy: FormatStrategy = {
  id: 'LOW_GROSS_LOW_NET',
  computeStandings(ctx) {
    return strokePlayStrategy.computeStandings(ctx)
  },
}
