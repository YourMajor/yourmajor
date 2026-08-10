/**
 * The golf ball, drawn once and shared by every set piece that flies one
 * (BallDropDivider, TubeRun). Illustration style matched to the user's
 * reference: a near-white ball with a large clean highlight to the upper
 * left, dimples drawn as CRESCENT strokes (the shadowed far wall of each
 * dent) marching along arcs concentric to the light source, and a soft
 * turned-edge rim on the shadow side. No filled dots — dots read as a
 * wiffle ball.
 *
 * Server-safe: pure SVG markup, no client code. Render one GolfBallDefs
 * per <svg> (ids are svg-document-global, so give each mounted svg its own
 * `id`), then any number of GolfBall instances referencing it.
 */

// Light direction: up-left. All shading and dimple geometry derives from it.
const LIGHT = { x: -0.55, y: -0.62 } // in units of r, relative to ball center

function arcPath(cx: number, cy: number, rr: number, a1: number, a2: number) {
  const x1 = cx + rr * Math.cos(a1)
  const y1 = cy + rr * Math.sin(a1)
  const x2 = cx + rr * Math.cos(a2)
  const y2 = cy + rr * Math.sin(a2)
  const large = a2 - a1 > Math.PI ? 1 : 0
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rr.toFixed(2)} ${rr.toFixed(2)} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

/** Crescent dimples along rings concentric to the highlight. */
function dimpleField(r: number): string[] {
  const paths: string[] = []
  const hx = LIGHT.x * r
  const hy = LIGHT.y * r
  const dimpleR = 0.075 * r
  for (let k = 0; k < 4; k++) {
    const ringR = (0.62 + k * 0.3) * r
    const step = (0.3 * r) / ringR
    for (let a = 0; a < Math.PI * 2; a += step) {
      const px = hx + ringR * Math.cos(a)
      const py = hy + ringR * Math.sin(a)
      // Keep crescents on the ball, shy of the rim.
      if (Math.hypot(px, py) > 0.86 * r) continue
      // The crescent faces away from the light: the shadowed dent wall.
      const phi = Math.atan2(py - hy, px - hx)
      paths.push(arcPath(px, py, dimpleR, phi - 1.75, phi + 1.75))
    }
  }
  return paths
}

export function GolfBallDefs({ id, r }: { id: string; r: number }) {
  return (
    <defs>
      <radialGradient id={`${id}-shade`} cx="0.36" cy="0.3" r="0.95">
        <stop offset="0" stopColor="var(--mk-bone-bright)" />
        <stop offset="0.55" stopColor="var(--mk-bone)" />
        <stop offset="1" stopColor="color-mix(in oklab, var(--mk-bone) 76%, var(--mk-green-deep))" />
      </radialGradient>
      <clipPath id={`${id}-clip`}>
        <circle r={r} />
      </clipPath>
      <g id={`${id}-detail`}>
        {/* Turned edge on the shadow side: a soft rim band, lower right. */}
        <path
          d={arcPath(0, 0, 0.9 * r, -0.55, 2.1)}
          fill="none"
          stroke="color-mix(in oklab, var(--mk-ink) 10%, transparent)"
          strokeWidth={0.11 * r}
          strokeLinecap="round"
        />
        {/* The crescent dimple field. */}
        {dimpleField(r).map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="color-mix(in oklab, var(--mk-ink) 19%, transparent)"
            strokeWidth={0.034 * r}
            strokeLinecap="round"
          />
        ))}
      </g>
    </defs>
  )
}

export function GolfBall({
  defsId,
  cx,
  cy,
  r,
}: {
  defsId: string
  cx: number
  cy: number
  r: number
}) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r={r} fill={`url(#${defsId}-shade)`} />
      <use href={`#${defsId}-detail`} clipPath={`url(#${defsId}-clip)`} />
    </g>
  )
}
