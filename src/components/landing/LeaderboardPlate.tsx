/**
 * The signature component of the marketing world: the product's own leaderboard
 * rendered as broadcast furniture on a bone plate.
 *
 * The markup below renders the board LIVE through 12, and that is the readable
 * rest state: a round in progress is the proof this page exists to make. The
 * hero's scroll sequence plays it forward from there, never backward. If that
 * sequence never runs, on mobile or under reduced motion, nothing is missing.
 *
 * The player names and scores are a DEMONSTRATION, not records. They are period
 * golfers, deliberately recognisable as illustration rather than customer data.
 * Swap for a real captured leaderboard when one is available.
 */

type Row = {
  pos: string
  name: string
  today: string
  thru: string
  total: string
}

const ROWS: Row[] = [
  { pos: '1', name: 'J. Palmer', today: '-3', thru: '12', total: '-6' },
  { pos: '2', name: 'T. Watson', today: 'E', thru: '12', total: '-2' },
  { pos: '3', name: 'B. Hogan', today: '+2', thru: '12', total: 'E' },
  { pos: 'T4', name: 'S. Snead', today: '+1', thru: '12', total: '+1' },
  { pos: 'T4', name: 'G. Player', today: '+3', thru: '12', total: '+1' },
]

/**
 * The same round at three points, in the DOM order of ROWS above. The first
 * entry is the rendered rest state, so the sequence only ever runs forward.
 *
 * `slot` is the position the row occupies on the board, which lets the hero
 * move a row instead of reordering the list. Palmer leads through 16 and loses
 * it on the last two holes; that lead change is the only reason a pinned hero
 * earns the scroll it costs.
 *
 * Every total is the player's starting total plus today, so the three states
 * are arithmetically the same round: Palmer -3, Watson -2, Hogan -2, Snead E,
 * Player -2.
 */
export type RoundCell = { pos: string; today: string; thru: string; total: string; slot: number }

export const ROUND_STATES: RoundCell[][] = [
  [
    { pos: '1', today: '-3', thru: '12', total: '-6', slot: 0 },
    { pos: '2', today: 'E', thru: '12', total: '-2', slot: 1 },
    { pos: '3', today: '+2', thru: '12', total: 'E', slot: 2 },
    { pos: 'T4', today: '+1', thru: '12', total: '+1', slot: 3 },
    { pos: 'T4', today: '+3', thru: '12', total: '+1', slot: 4 },
  ],
  [
    { pos: '1', today: '-2', thru: '16', total: '-5', slot: 0 },
    { pos: '2', today: '-2', thru: '16', total: '-4', slot: 1 },
    { pos: '3', today: '+1', thru: '16', total: '-1', slot: 2 },
    { pos: 'T4', today: 'E', thru: '16', total: 'E', slot: 3 },
    { pos: 'T4', today: '+2', thru: '16', total: 'E', slot: 4 },
  ],
  [
    { pos: '2', today: '-1', thru: 'F', total: '-4', slot: 1 },
    { pos: '1', today: '-3', thru: 'F', total: '-5', slot: 0 },
    { pos: '3', today: '+1', thru: 'F', total: '-1', slot: 2 },
    { pos: 'T4', today: 'E', thru: 'F', total: 'E', slot: 3 },
    { pos: 'T4', today: '+2', thru: 'F', total: 'E', slot: 4 },
  ],
]

export function scoreColor(score: string) {
  if (score.startsWith('-')) return 'var(--mk-under-par)'
  if (score === 'E') return 'var(--mk-ink)'
  return 'var(--mk-over-par)'
}

/* Fixed data columns set the plate's min-content width, and on a 320px phone
   that width was driving the whole hero grid wider than the viewport. They step
   down rather than letting the page overflow. */
const COLS =
  'grid grid-cols-[2.25rem_1fr_2.5rem_2.25rem_3rem] sm:grid-cols-[3rem_1fr_4rem_3.5rem_4rem] px-3 sm:px-4'

export function LeaderboardPlate() {
  return (
    <div className="mk-plate overflow-hidden">
      {/* Header row: deep green with the gold rule beneath it. */}
      <div
        className={`${COLS} items-center py-3`}
        style={{
          backgroundColor: 'var(--mk-green-deep)',
          borderBottom: '2px solid var(--mk-gold)',
        }}
      >
        {['Pos', 'Player', 'Today', 'Thru', 'Total'].map((label, i) => (
          <span
            key={label}
            className={`text-[0.6875rem] font-semibold uppercase tracking-[0.14em] ${
              i === 1 ? 'text-left' : 'text-center'
            }`}
            style={{ color: 'var(--mk-gold)' }}
          >
            {label}
          </span>
        ))}
      </div>

      {ROWS.map((row) => (
        <div
          key={row.name}
          data-row
          className={`${COLS} relative items-center py-3.5`}
          style={{
            borderBottom: '1px solid var(--mk-rule-ink)',
            backgroundColor: 'var(--mk-bone)',
          }}
        >
          <span data-cell="pos" className="mk-data text-center text-sm" style={{ color: 'var(--mk-ink)' }}>
            {row.pos}
          </span>
          <span className="truncate text-sm font-medium" style={{ color: 'var(--mk-ink)' }}>
            {row.name}
          </span>
          <span
            data-cell="today"
            className="mk-data text-center text-sm"
            style={{ color: scoreColor(row.today) }}
          >
            {row.today}
          </span>
          <span
            data-cell="thru"
            className="mk-data text-center text-sm"
            style={{ color: 'var(--mk-over-par)' }}
          >
            {row.thru}
          </span>
          <span
            data-cell="total"
            className="mk-data text-center text-base"
            style={{ color: scoreColor(row.total) }}
          >
            {row.total}
          </span>
        </div>
      ))}

      <p className="px-4 py-3 text-xs" style={{ color: 'var(--mk-over-par)' }}>
        Example leaderboard
      </p>
    </div>
  )
}
