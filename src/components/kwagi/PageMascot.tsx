// Cursor-following mascot for the web landing page. Copied from the page-mascot skill
// (MIT, https://www.npmjs.com/package/page-mascot) so it adds no dependency. It renders DOM
// elements, so import it only from web-only screens.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'

const DIRECTIONS = [
  'up-left',
  'up',
  'up-right',
  'left',
  'center',
  'right',
  'down-left',
  'down',
  'down-right',
] as const

const REACTIONS = [
  'blink',
  'heart',
  'sparkle',
  'surprised',
  'wink',
  'bashful',
  'sleepy',
  'dizzy',
  'delighted',
] as const

type Direction = (typeof DIRECTIONS)[number]
type Reaction = (typeof REACTIONS)[number]

// Clockwise from the right, matching atan2 with y pointing down.
const CLOCKWISE: Direction[] = [
  'right',
  'down-right',
  'down',
  'down-left',
  'left',
  'up-left',
  'up',
  'up-right',
]
const SECTOR = (Math.PI * 2) / CLOCKWISE.length
const HYSTERESIS = 0.12
const DEAD_ZONE = 70

const PAYOFFS: Reaction[] = ['heart', 'sparkle', 'delighted']
const BOOP_PAYOFF = 120
// Long enough to read the expression. It also stays for as long as the cursor rests on him.
const BOOP_END = BOOP_PAYOFF + 1400
const DIZZY_AFTER = 4
const DIZZY_WINDOW = 1600
const DIZZY_END = 1800
// Returning to his normal face is a short crossfade; reacting is instant, so a click feels answered.
const SETTLE_MS = 160

// Making him turn his head too much also makes him dizzy: two full turns of the cursor around
// him within three seconds, counted only while the cursor is nearby.
const SPIN_LIMIT = Math.PI * 4
const SPIN_WINDOW = 3000
const SPIN_RANGE = 360
const SPIN_COOLDOWN = 4000

// background-size 300% makes each cell a clean 0/50/100% step on both axes.
function cell(index: number): CSSProperties {
  return { backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%` }
}

function wrap(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

const layer: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundSize: '300% 300%',
  backgroundRepeat: 'no-repeat',
}

export type MascotProps = {
  /** The 3x3 sheet of head directions. A served path, or an imported image. */
  directions: string
  /** The 3x3 sheet of expressions. */
  reactions: string
  size?: number
  className?: string
  /** What a screen reader calls it. */
  label?: string
}

export function Mascot(props: MascotProps) {
  const { directions, reactions, size = 140, className, label = 'mascot' } = props

  const buttonRef = useRef<HTMLButtonElement>(null)
  const timersRef = useRef<number[]>([])
  const boopsRef = useRef({ count: 0, at: 0 })
  const hoverRef = useRef({ over: false, holding: false })
  const [direction, setDirection] = useState<Direction>('center')
  // The face stays set after a reaction ends, so it can fade out without changing.
  const [face, setFace] = useState<Reaction>('blink')
  const [reacting, setReacting] = useState(false)

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(window.clearTimeout)
    timersRef.current = []
    hoverRef.current.holding = false
  }, [])

  const later = useCallback((ms: number, run: () => void) => {
    timersRef.current.push(window.setTimeout(run, ms))
  }, [])

  const show = useCallback((next: Reaction) => {
    setFace(next)
    setReacting(true)
  }, [])

  const dizzy = useCallback(() => {
    clearTimers()
    show('dizzy')
    later(DIZZY_END, () => setReacting(false))
  }, [clearTimers, later, show])

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      return
    }

    let sector = -1
    let pointer: { x: number; y: number } | null = null
    let lastAngle: number | null = null
    let turns: { at: number; by: number }[] = []
    let restUntil = 0

    // Adds up how far the cursor has swung around him lately.
    const countTurn = (angle: number, distance: number) => {
      const now = Date.now()
      if (distance > SPIN_RANGE || now < restUntil) {
        lastAngle = null
        turns = []
        return
      }
      if (lastAngle !== null) {
        turns.push({ at: now, by: Math.abs(wrap(angle - lastAngle)) })
      }
      lastAngle = angle
      turns = turns.filter((turn) => now - turn.at < SPIN_WINDOW)
      if (turns.reduce((sum, turn) => sum + turn.by, 0) >= SPIN_LIMIT) {
        turns = []
        lastAngle = null
        restUntil = now + DIZZY_END + SPIN_COOLDOWN
        dizzy()
      }
    }

    const aim = (moved = false) => {
      const button = buttonRef.current
      if (!button || !pointer) {
        return
      }

      const box = button.getBoundingClientRect()
      const dx = pointer.x - (box.left + box.width / 2)
      const dy = pointer.y - (box.top + box.height / 2)
      const distance = Math.hypot(dx, dy)

      if (distance < DEAD_ZONE) {
        sector = -1
        setDirection('center')
        return
      }

      const angle = Math.atan2(dy, dx)
      if (moved) {
        countTurn(angle, distance)
      }

      // Hold the current sector until the pointer is well past its edge.
      if (sector !== -1 && Math.abs(wrap(angle - sector * SECTOR)) < SECTOR / 2 + HYSTERESIS) {
        return
      }

      sector = (Math.round(angle / SECTOR) + CLOCKWISE.length) % CLOCKWISE.length
      setDirection(CLOCKWISE[sector])
    }

    const onPointerMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY }
      aim(true)
    }
    const onScroll = () => aim()

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', onScroll)
    }
  }, [dizzy])

  useEffect(() => {
    return () => {
      timersRef.current.forEach(window.clearTimeout)
    }
  }, [])

  const boop = () => {
    clearTimers()

    const now = Date.now()
    const boops = boopsRef.current
    boops.count = now - boops.at < DIZZY_WINDOW ? boops.count + 1 : 1
    boops.at = now

    if (boops.count >= DIZZY_AFTER) {
      boops.count = 0
      dizzy()
      return
    }

    show('blink')
    later(BOOP_PAYOFF, () => show(PAYOFFS[(boops.count - 1) % PAYOFFS.length]))
    later(BOOP_END, () => {
      // While the cursor rests on him he keeps the expression; it ends when the cursor leaves.
      if (hoverRef.current.over) hoverRef.current.holding = true
      else setReacting(false)
    })
  }

  const onPointerEnter = (event: ReactPointerEvent) => {
    if (event.pointerType === 'mouse') hoverRef.current.over = true
  }

  const onPointerLeave = () => {
    const hover = hoverRef.current
    hover.over = false
    if (!hover.holding) return
    hover.holding = false
    setReacting(false)
  }

  const fade = `opacity ${reacting ? 0 : SETTLE_MS}ms ease`

  // Inline styles so the file drops into any project without a CSS framework.
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={boop}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      aria-label={`Boop the ${label}`}
      className={className}
      style={{
        position: 'relative',
        display: 'block',
        flexShrink: 0,
        width: size,
        height: size,
        padding: 0,
        border: 0,
        background: 'transparent',
        appearance: 'none',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Kwagi stays still on click: only his expression changes. */}
      <span style={{ position: 'relative', display: 'block', width: '100%', height: '100%' }}>
        <span
          style={{
            ...layer,
            backgroundImage: `url(${directions})`,
            ...cell(DIRECTIONS.indexOf(direction)),
            opacity: reacting ? 0 : 1,
            transition: fade,
          }}
        />
        {/* Always mounted so the sheet is fetched up front, never on the first click. */}
        <span
          style={{
            ...layer,
            backgroundImage: `url(${reactions})`,
            ...cell(REACTIONS.indexOf(face)),
            opacity: reacting ? 1 : 0,
            transition: fade,
          }}
        />
      </span>
    </button>
  )
}
