/**
 * Round statistics and peer-relative findings.
 *
 * CLIENT-SAFE — no prisma import, same contract as scoring-utils.ts. Consumed by
 * both the per-round scorecard insights and the career profile so the two agree.
 *
 * Scope note: the schema captures strokes, putts, fairwayHit and gir per hole and
 * nothing else. True Strokes Gained (Broadie) needs shot-level start/end distances,
 * so it is not computable here and is not attempted. Everything below is derivable
 * from those four fields plus par.
 */

export interface HoleStatRow {
  par: number
  strokes: number
  putts?: number | null
  fairwayHit?: boolean | null
  gir?: boolean | null
}

/** A rate plus the denominator it was computed from. Null when under-sampled. */
export interface Rate {
  value: number
  /** Opportunities the rate was measured over. */
  sample: number
  /** Same measure normalised to an 18-hole round, where that is meaningful. */
  per18?: number
}

export interface RoundStats {
  holes: number
  vsPar: number
  counts: { eagle: number; birdie: number; par: number; bogey: number; double: number }
  parType: { par3: Rate | null; par4: Rate | null; par5: Rate | null }
  fairways: Rate | null
  gir: Rate | null
  /** Up-and-down rate after missing a green — the highest-leverage short-game measure. */
  scrambling: Rate | null
  /** Putts taken on greens hit in regulation. Immune to the survivorship bias in putts-per-hole. */
  puttsPerGir: Rate | null
  threePutts: Rate | null
  doublePlus: Rate | null
  birdieConversion: Rate | null
  /** Strokes spent above bogey on blow-up holes. */
  strokesLostToDamage: number
}

export interface PeerBaseline {
  handicap: number
  scrambling: number
  puttsPerGir: number
  threePuttsPer18: number
  doublePlusPer18: number
}

export interface Finding {
  kind: 'strength' | 'weakness'
  area: string
  /** One sentence, for the headline verdict. */
  headline: string
  /** The supporting detail, including the peer figure it was judged against. */
  message: string
  /** Strokes per 18 vs the peer baseline. Positive is better than peer. */
  impact: number
  /**
   * Where the player and the peer sit, for the comparison gauge. Plain data
   * only — findings cross the server/client boundary as props on the profile
   * page, so a formatter function here would fail to serialise.
   */
  gauge?: GaugeSpec
}

export type GaugeFormat = 'percent' | 'putts' | 'count'

export interface GaugeSpec {
  value: number
  peer: number
  /** Upper bound of the track. */
  max: number
  format: GaugeFormat
  /** True where a smaller number is the better one (three-putts, blow-ups). */
  lowerIsBetter?: boolean
}

export function formatGauge(n: number, format: GaugeFormat): string {
  if (format === 'percent') return `${Math.round(n * 100)}%`
  if (format === 'putts') return n.toFixed(2)
  return n.toFixed(1)
}

// ─── Minimum samples ────────────────────────────────────────────────────────
// A verdict off three holes is noise dressed as insight. Each rate returns null
// below its threshold and emits no finding.

const MIN_SCRAMBLE_ATTEMPTS = 6
const MIN_GREENS_HIT = 5
const MIN_HOLES_WITH_PUTTS = 9
const MIN_HOLES = 9
const MIN_FAIRWAY_HOLES = 8

/** Emit a finding only once it is worth at least this many strokes per round. */
const MIN_IMPACT = 0.5

// ─── Peer baselines ─────────────────────────────────────────────────────────
/**
 * Published amateur benchmarks by handicap, interpolated between anchors.
 *
 * SOURCE: external research, NOT YourMajor data — Shot Scope and Arccos tracking
 * datasets as reported by MyGolfSpy and Golfity (2024–25). Any UI that shows these
 * must attribute them as typical amateur figures. Do not present them as our own
 * measurements, and do not invent anchors: add a row only with a citation.
 *
 *   scrambling      — up-and-down % after missing a green
 *   puttsPerGir     — putts taken on greens hit in regulation
 *   threePuttsPer18 — three-putts per 18 holes
 *   doublePlusPer18 — holes of double bogey or worse per 18 holes
 */
const BASELINE_ANCHORS: PeerBaseline[] = [
  { handicap: 0,  scrambling: 0.60, puttsPerGir: 1.85, threePuttsPer18: 0.8, doublePlusPer18: 0.3 },
  { handicap: 10, scrambling: 0.28, puttsPerGir: 2.00, threePuttsPer18: 2.4, doublePlusPer18: 2.0 },
  { handicap: 15, scrambling: 0.22, puttsPerGir: 2.06, threePuttsPer18: 3.8, doublePlusPer18: 3.5 },
  { handicap: 25, scrambling: 0.15, puttsPerGir: 2.18, threePuttsPer18: 5.8, doublePlusPer18: 6.5 },
]

/** Linear interpolation between anchors, clamped at both ends. */
export function peerBaseline(handicap: number): PeerBaseline {
  const h = Number.isFinite(handicap) ? handicap : 15
  const first = BASELINE_ANCHORS[0]
  const last = BASELINE_ANCHORS[BASELINE_ANCHORS.length - 1]
  if (h <= first.handicap) return { ...first, handicap: h }
  if (h >= last.handicap) return { ...last, handicap: h }

  for (let i = 1; i < BASELINE_ANCHORS.length; i++) {
    const hi = BASELINE_ANCHORS[i]
    if (h > hi.handicap) continue
    const lo = BASELINE_ANCHORS[i - 1]
    const t = (h - lo.handicap) / (hi.handicap - lo.handicap)
    const mix = (a: number, b: number) => a + (b - a) * t
    return {
      handicap: h,
      scrambling: mix(lo.scrambling, hi.scrambling),
      puttsPerGir: mix(lo.puttsPerGir, hi.puttsPerGir),
      threePuttsPer18: mix(lo.threePuttsPer18, hi.threePuttsPer18),
      doublePlusPer18: mix(lo.doublePlusPer18, hi.doublePlusPer18),
    }
  }
  return { ...last, handicap: h }
}

// ─── Stats ──────────────────────────────────────────────────────────────────

function rate(value: number, sample: number, min: number, per18?: number): Rate | null {
  if (sample < min) return null
  return per18 === undefined ? { value, sample } : { value, sample, per18 }
}

function avgVsPar(rows: HoleStatRow[], min: number): Rate | null {
  if (rows.length < min) return null
  const total = rows.reduce((s, r) => s + (r.strokes - r.par), 0)
  return { value: total / rows.length, sample: rows.length }
}

export function computeRoundStats(rows: HoleStatRow[]): RoundStats {
  const holes = rows.length
  const diff = (r: HoleStatRow) => r.strokes - r.par
  const scale18 = holes > 0 ? 18 / holes : 0

  const counts = {
    eagle: rows.filter((r) => diff(r) <= -2).length,
    birdie: rows.filter((r) => diff(r) === -1).length,
    par: rows.filter((r) => diff(r) === 0).length,
    bogey: rows.filter((r) => diff(r) === 1).length,
    double: rows.filter((r) => diff(r) >= 2).length,
  }

  // Fairways are only in play off the tee on par 4s and 5s.
  const fairwayRows = rows.filter((r) => r.par >= 4 && r.fairwayHit != null)
  const fairwaysHit = fairwayRows.filter((r) => r.fairwayHit === true).length

  const girRows = rows.filter((r) => r.gir != null)
  const greensHit = girRows.filter((r) => r.gir === true)
  const greensMissed = girRows.filter((r) => r.gir === false)

  // Scrambling: par or better after missing the green.
  const scrambled = greensMissed.filter((r) => diff(r) <= 0).length

  // Putts per GIR: only greens hit in regulation, which is what makes this
  // comparable across players. Putts per hole rewards missing greens.
  const girWithPutts = greensHit.filter((r) => r.putts != null)
  const girPuttTotal = girWithPutts.reduce((s, r) => s + (r.putts ?? 0), 0)

  const holesWithPutts = rows.filter((r) => r.putts != null)
  const threePuttCount = holesWithPutts.filter((r) => (r.putts ?? 0) >= 3).length

  const damageRows = rows.filter((r) => diff(r) >= 2)
  // Strokes spent beyond a bogey on blow-up holes — what damage control is worth.
  const strokesLostToDamage = damageRows.reduce((s, r) => s + (diff(r) - 1), 0)

  const birdiesFromGir = greensHit.filter((r) => diff(r) <= -1).length

  return {
    holes,
    vsPar: rows.reduce((s, r) => s + diff(r), 0),
    counts,
    parType: {
      par3: avgVsPar(rows.filter((r) => r.par === 3), 1),
      par4: avgVsPar(rows.filter((r) => r.par === 4), 1),
      par5: avgVsPar(rows.filter((r) => r.par === 5), 1),
    },
    fairways: rate(
      fairwayRows.length > 0 ? fairwaysHit / fairwayRows.length : 0,
      fairwayRows.length,
      MIN_FAIRWAY_HOLES
    ),
    gir: rate(girRows.length > 0 ? greensHit.length / girRows.length : 0, girRows.length, MIN_HOLES),
    scrambling: rate(
      greensMissed.length > 0 ? scrambled / greensMissed.length : 0,
      greensMissed.length,
      MIN_SCRAMBLE_ATTEMPTS
    ),
    puttsPerGir: rate(
      girWithPutts.length > 0 ? girPuttTotal / girWithPutts.length : 0,
      girWithPutts.length,
      MIN_GREENS_HIT
    ),
    threePutts: rate(
      threePuttCount,
      holesWithPutts.length,
      MIN_HOLES_WITH_PUTTS,
      holesWithPutts.length > 0 ? threePuttCount * (18 / holesWithPutts.length) : 0
    ),
    doublePlus: rate(counts.double, holes, MIN_HOLES, counts.double * scale18),
    birdieConversion: rate(
      greensHit.length > 0 ? birdiesFromGir / greensHit.length : 0,
      greensHit.length,
      MIN_GREENS_HIT
    ),
    strokesLostToDamage,
  }
}

// ─── Findings ───────────────────────────────────────────────────────────────

const pct = (n: number) => `${Math.round(n * 100)}%`

/**
 * Peer-relative findings, ranked by strokes per 18. The most negative impact is
 * the single thing worth practising, which is the whole point of the ranking.
 */
export function statFindings(stats: RoundStats, handicap: number): Finding[] {
  const peer = peerBaseline(handicap)
  const found: Finding[] = []
  const hcpLabel = `${Math.round(peer.handicap)}-handicap`

  const push = (
    area: string,
    impact: number,
    headline: string,
    message: string,
    gauge: GaugeSpec
  ) => {
    if (Math.abs(impact) < MIN_IMPACT) return
    found.push({ kind: impact < 0 ? 'weakness' : 'strength', area, headline, message, impact, gauge })
  }

  const cost = (n: number) => Math.abs(n).toFixed(1)

  if (stats.scrambling) {
    const missesPer18 = stats.holes > 0 ? stats.scrambling.sample * (18 / stats.holes) : 0
    // A missed up-and-down is very close to exactly one dropped stroke.
    const impact = (stats.scrambling.value - peer.scrambling) * missesPer18
    push(
      'Short game',
      impact,
      impact < 0
        ? `Your short game is costing about ${cost(impact)} shots a round.`
        : `Your short game is saving about ${cost(impact)} shots a round.`,
      impact < 0
        ? `Up and down ${pct(stats.scrambling.value)} of the time after missing a green. A ${hcpLabel} averages ${pct(peer.scrambling)}. This is the biggest single lever most players have.`
        : `Up and down ${pct(stats.scrambling.value)} of the time after missing a green, against ${pct(peer.scrambling)} for a ${hcpLabel}.`,
      { value: stats.scrambling.value, peer: peer.scrambling, max: 0.7, format: 'percent' }
    )
  }

  if (stats.puttsPerGir) {
    const greensPer18 = stats.holes > 0 ? stats.puttsPerGir.sample * (18 / stats.holes) : 0
    const impact = (peer.puttsPerGir - stats.puttsPerGir.value) * greensPer18
    push(
      'Putting',
      impact,
      impact < 0
        ? `Putting is costing about ${cost(impact)} shots a round.`
        : `Putting is saving about ${cost(impact)} shots a round.`,
      `${stats.puttsPerGir.value.toFixed(2)} putts on greens you hit in regulation, against ${peer.puttsPerGir.toFixed(2)} for a ${hcpLabel}. Measured on greens hit so that missing them cannot flatter the number.`,
      { value: stats.puttsPerGir.value, peer: peer.puttsPerGir, max: 2.6, format: 'putts', lowerIsBetter: true }
    )
  }

  if (stats.threePutts?.per18 !== undefined) {
    const impact = peer.threePuttsPer18 - stats.threePutts.per18
    push(
      'Lag putting',
      impact,
      impact < 0
        ? `Three-putts are costing about ${cost(impact)} shots a round.`
        : `Avoiding three-putts is saving about ${cost(impact)} shots a round.`,
      impact < 0
        ? `${stats.threePutts.per18.toFixed(1)} three-putts a round, against ${peer.threePuttsPer18.toFixed(1)} for a ${hcpLabel}. Distance control on the first putt, not the short ones, is what closes this.`
        : `${stats.threePutts.per18.toFixed(1)} three-putts a round, under the ${peer.threePuttsPer18.toFixed(1)} a ${hcpLabel} averages.`,
      { value: stats.threePutts.per18, peer: peer.threePuttsPer18, max: 7, format: 'count', lowerIsBetter: true }
    )
  }

  if (stats.doublePlus?.per18 !== undefined) {
    const impact = peer.doublePlusPer18 - stats.doublePlus.per18
    push(
      'Damage control',
      impact,
      impact < 0
        ? `Blow-up holes are costing about ${cost(impact)} shots a round.`
        : `Keeping big numbers off the card is saving about ${cost(impact)} shots a round.`,
      impact < 0
        ? `${stats.doublePlus.per18.toFixed(1)} holes of double bogey or worse a round, against ${peer.doublePlusPer18.toFixed(1)} for a ${hcpLabel}. Taking the safe miss on those holes beats chasing birdies on the rest.`
        : `${stats.doublePlus.per18.toFixed(1)} holes of double bogey or worse a round, against ${peer.doublePlusPer18.toFixed(1)} for a ${hcpLabel}.`,
      { value: stats.doublePlus.per18, peer: peer.doublePlusPer18, max: 7, format: 'count', lowerIsBetter: true }
    )
  }

  // Birdie conversion and driving accuracy are emitted as strengths only. As
  // weaknesses they point a mid-handicap at the wrong practice — converting more
  // greens matters far less than hitting them — and the ranked findings above
  // already name what does. They carry no impact and never win the headline.
  if (stats.birdieConversion && stats.birdieConversion.value >= 0.2) {
    found.push({
      kind: 'strength',
      area: 'Converting',
      headline: `Turning ${pct(stats.birdieConversion.value)} of greens into birdies.`,
      message: 'When you find the green you make it count.',
      impact: 0,
    })
  }

  if (stats.fairways && stats.fairways.value >= 0.7) {
    found.push({
      kind: 'strength',
      area: 'Off the tee',
      headline: `${pct(stats.fairways.value)} of fairways found.`,
      message: 'Accuracy off the tee is not what is holding your scores up.',
      impact: 0,
    })
  }

  return found.sort((a, b) => a.impact - b.impact)
}

/** The single most costly finding, or null when nothing clears the threshold. */
export function topFinding(findings: Finding[]): Finding | null {
  const worst = findings.find((f) => f.kind === 'weakness')
  return worst ?? findings[0] ?? null
}
