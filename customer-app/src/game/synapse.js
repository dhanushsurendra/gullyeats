/*
 * Synapse: the game itself, with no React (the arcade page owns the canvas,
 * loop, screens and speakers).
 *
 *   const game = createGame(seed, { width, height })
 *   step(game, dtMs)
 *   tap(game, x, y)          // a tap, in world units
 *   draw(ctx, game)
 *
 * A 45-second memory round. Eight neurons sit in a ring, each with its own
 * colour and note. A chain fires from neuron to neuron; tap it back in the
 * same order. Every finished chain is one link longer (3, 4, 5, ...), and only
 * the new link fires: the rest is yours to remember. The whole chain replays
 * on the first chain, after a miss, and on REVERSE chains (lengths 6, 10, 14,
 * ...), which are tapped backwards for double points.
 *
 * - Speed: finishing a chain quickly adds up to half its chain bonus.
 * - Shield: three chains in a row without a miss earn one free miss.
 * - Surge: the last 10 seconds fire faster and score double.
 * - Twist: one rule for the whole day (TWISTS), from the seed.
 *
 * A wrong tap, or none for a few seconds, is a miss and the chain replays;
 * three misses overload the brain and end the round. The layout, chain and
 * twist come from `seed` only, so one seed per day gives everyone the same
 * round; how far you get is down to memory and speed.
 */

export const WORLD_WIDTH = 360
export const ROUND_MS = 45000
export const SURGE_AT = 35000
export const NODES = 8
export const START_LENGTH = 3
export const MAX_MISSES = 3
export const SHIELD_CHAINS = 3
// Ceilings the server checks against (backend/controllers/gameController.js
// GAMES.synapse): a link is worth 10 x the chain's length, a finished chain
// 25 x its length plus up to half that again for speed; reverse and the
// Surge each double both.
export const LIMITS = { maxScore: 150000, maxLinks: 500, maxChains: 36, maxLength: 40, maxMisses: 3, linkPoints: 10, chainPoints: 25, reverse: 2, surge: 2, speed: 1.5, minTapMs: 80 }

export const TWISTS = {
  silent: { name: 'Silent day', text: 'Neurons only sing on the first chain. Watch closely.' },
  shuffle: { name: 'Shuffle day', text: 'The ring turns one step after every chain. Follow the colours.' },
  mirror: { name: 'Mirror day', text: 'Tap the neuron opposite the one that fires.' },
  ghost: { name: 'Ghost day', text: 'From 5 links, the new link only sings. Listen for it.' },
}
const TWIST_KEYS = Object.keys(TWISTS)

const NODE_R = 27
const HIT_R = 46
const INTRO_MS = 550
const REVERSE_INTRO_MS = 1100 // time to read "REVERSE"
const REST_MS = 650
const MISS_REST_MS = 1000
export const INPUT_MS = 3500 // longest wait for each tap
const SURGE_GAP = 0.75
// Speed bonus: full at 300 ms a tap or quicker, none from 900 ms.
const FAST_TAP = 300
const SLOW_TAP = 900

// C major pentatonic over two octaves, low to high around the ring.
const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51]
const COLORS = ['#22d3ee', '#a78bfa', '#f472b6', '#fe5200', '#fde047', '#4ade80', '#60a5fa', '#f87171']

// Small, fast, seedable random numbers (mulberry32).
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function seedFor(day) {
  let h = 2166136261
  for (const ch of `synapse:${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}
export const twistFor = (seed) => TWIST_KEYS[(seed >>> 7) % TWIST_KEYS.length]

const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export const isReverse = (length) => length >= 6 && length % 4 === 2
// Time between two firings: brisk at first, quick on long chains, quicker in the Surge.
export const gapFor = (length, surge = false) =>
  clamp(lerp(560, 300, (length - START_LENGTH) / 12), 300, 560) * (surge ? SURGE_GAP : 1)

// The day's chain: never the same neuron twice in a row.
function makeSequence(rand) {
  const seq = []
  while (seq.length < LIMITS.maxLength) {
    const n = Math.floor(rand() * NODES)
    if (n !== seq.at(-1)) seq.push(n)
  }
  return seq
}

export function createGame(seed, { width = WORLD_WIDTH, height = 640 } = {}) {
  const w = WORLD_WIDTH
  const h = Math.round(clamp((height / width) * WORLD_WIDTH, 520, 820))
  const rand = rng(seed)
  const cx = w / 2
  const cy = clamp(h * 0.56, 300, h - 170)
  const turn = rand() * Math.PI * 2
  // Places on the ring; a neuron sits in slot (its index + the ring's turn).
  const slots = Array.from({ length: NODES }, (_, i) => ({
    a: turn + (i / NODES) * Math.PI * 2,
    r: 122 + (rand() - 0.5) * 20,
  }))
  return {
    w,
    h,
    cx,
    cy,
    seed,
    twist: twistFor(seed),
    slots,
    nodes: COLORS.map((color, i) => ({ color, note: NOTES[i] })),
    turn: 0, // shuffle day: how far the ring has turned
    turnFrom: 0, // ...and where it turns from, during a rest
    seq: makeSequence(rand),
    t: 0,
    over: false,
    surge: false,
    length: START_LENGTH,
    phase: 'show', // show | input | rest
    phaseAt: 0,
    full: true, // this showing replays the whole chain
    gap: gapFor(START_LENGTH), // ms between firings in this showing
    fired: 0, // neurons of this showing fired so far
    next: 0, // taps made on this chain
    lastTapAt: 0,
    score: 0,
    links: 0,
    chains: 0,
    longest: 0,
    misses: 0,
    reverses: 0,
    run: 0, // chains in a row without a miss
    shield: false,
    saves: 0,
    fastMs: 0, // quickest finished chain, in ms per tap
    points: { links: 0, chains: 0, speed: 0 },
    lit: new Array(NODES).fill(-1), // until when each neuron glows
    pulses: [], // { from, to, at, ms }: a spark running down an axon
    popups: [],
    rings: [],
    flash: null,
    banner: null, // { text, color, until }
    events: [], // for sound; the page empties it
  }
}

// Where neuron i is drawn and tapped (the ring turns smoothly on shuffle day).
export function posOf(game, i) {
  let turn = game.turn
  if (game.phase === 'rest' && game.turnFrom !== game.turn) {
    turn = lerp(game.turnFrom, game.turn, clamp((game.t - game.phaseAt) / (game.restMs * 0.8), 0, 1))
  }
  const k = (((i + turn) % NODES) + NODES) % NODES
  const lo = Math.floor(k)
  const a = game.slots[lo]
  const b = game.slots[(lo + 1) % NODES]
  const f = k - lo
  let angle = b.a - a.a
  if (angle < 0) angle += Math.PI * 2
  const ang = a.a + angle * f
  const r = lerp(a.r, b.r, f)
  return { x: game.cx + Math.cos(ang) * r, y: game.cy + Math.sin(ang) * r }
}

export const chainOf = (game) => game.seq.slice(0, game.length)
const mirrored = (game, n) => (game.twist === 'mirror' ? (n + NODES / 2) % NODES : n)
// The neurons to tap for this chain, in order.
export const expectedOrder = (game) => {
  const chain = chainOf(game).map((n) => mirrored(game, n))
  return isReverse(game.length) ? chain.reverse() : chain
}
// What this showing fires: the whole chain, or only its new link.
const shownOf = (game) => (game.full ? chainOf(game) : chainOf(game).slice(-1))
const introOf = (game) => (isReverse(game.length) ? REVERSE_INTRO_MS : INTRO_MS)
const fireAt = (game, i) => game.phaseAt + introOf(game) + i * game.gap
// Ghost day: the chain's newest link only sings, from 5 links on.
const isGhost = (game, index) => game.twist === 'ghost' && game.length >= 5 && index === game.length - 1

function startShow(game, full) {
  game.phase = 'show'
  game.phaseAt = game.t
  game.full = full || isReverse(game.length) || game.length === START_LENGTH
  game.gap = gapFor(game.length, game.surge)
  game.fired = 0
  game.next = 0
  if (isReverse(game.length)) {
    game.banner = { text: '⟲ REVERSE', color: '#fde047', until: game.t + REVERSE_INTRO_MS }
    game.events.push({ type: 'reverse' })
  }
}

function rest(game, ms) {
  game.phase = 'rest'
  game.phaseAt = game.t
  game.restMs = ms
}

function miss(game, why) {
  game.run = 0
  game.flash = { color: '#ff3b3b', life: 1 }
  game.events.push({ type: 'wrong' })
  if (game.shield) {
    // The shield takes it: no miss, but the chain still replays.
    game.shield = false
    game.saves += 1
    game.popups.push({ x: game.cx, y: game.cy + 6, text: 'Shield saved you!', color: '#7df9ff', life: 1.2 })
    game.events.push({ type: 'shieldBreak' })
  } else {
    game.misses += 1
    game.popups.push({ x: game.cx, y: game.cy + 6, text: why, color: '#ff6b6b', life: 1.2 })
  }
  if (game.misses >= MAX_MISSES) {
    game.over = true
    game.banner = { text: 'OVERLOAD', color: '#ff6b6b', until: Infinity }
    game.events.push({ type: 'over', crashed: true })
    return
  }
  game.replay = true
  rest(game, MISS_REST_MS)
}

export function step(game, dtMs) {
  if (game.over) return game
  const dt = Math.min(dtMs, 100) // a frozen tab doesn't fast-forward the round
  game.t += dt
  const s = dt / 1000

  if (!game.surge && game.t >= SURGE_AT) {
    game.surge = true
    game.banner = { text: 'SURGE · x2', color: '#f472b6', until: game.t + 1200 }
    game.events.push({ type: 'surge' })
  }

  if (game.phase === 'show') {
    const shown = shownOf(game)
    const offset = game.length - shown.length // index in the chain of the first one shown
    while (game.fired < shown.length && game.t >= fireAt(game, game.fired)) {
      const n = shown[game.fired]
      const at = fireAt(game, game.fired)
      const ghost = isGhost(game, offset + game.fired)
      if (!ghost) {
        game.lit[n] = at + game.gap * 0.7
        const prev = offset + game.fired - 1
        if (prev >= 0) game.pulses.push({ from: game.seq[prev], to: n, at: at - game.gap * 0.45, ms: game.gap * 0.45 })
      }
      const silent = game.twist === 'silent' && game.chains > 0
      game.events.push({ type: 'fire', note: silent ? null : game.nodes[n].note, ghost })
      game.fired += 1
    }
    if (game.t >= fireAt(game, shown.length - 1) + game.gap) {
      game.phase = 'input'
      game.phaseAt = game.t
      game.lastTapAt = game.t
    }
  } else if (game.phase === 'input') {
    if (game.t - game.lastTapAt > INPUT_MS) miss(game, 'too slow')
  } else if (game.t >= game.phaseAt + game.restMs) {
    game.turnFrom = game.turn
    startShow(game, game.replay)
    game.replay = false
  }

  for (const p of game.popups) {
    p.y -= 26 * s
    p.life -= s * 1.2
  }
  for (const r of game.rings) {
    r.r += 120 * s
    r.life -= s * 2.2
  }
  if (game.flash) game.flash.life -= s * 3
  game.popups = game.popups.filter((p) => p.life > 0)
  game.rings = game.rings.filter((r) => r.life > 0)
  game.pulses = game.pulses.filter((p) => game.t < p.at + p.ms + 200)

  if (!game.over && game.t >= ROUND_MS) {
    game.t = ROUND_MS
    game.over = true
    game.events.push({ type: 'over', crashed: false })
  }
  return game
}

function finishChain(game) {
  const mult = (isReverse(game.length) ? LIMITS.reverse : 1) * (game.surge ? LIMITS.surge : 1)
  const msPerTap = Math.max(1, Math.round((game.t - game.phaseAt) / game.length))
  const base = LIMITS.chainPoints * game.length * mult
  const speed = Math.round(base * (LIMITS.speed - 1) * clamp((SLOW_TAP - msPerTap) / (SLOW_TAP - FAST_TAP), 0, 1))
  game.score += base + speed
  game.points.chains += base
  game.points.speed += speed
  game.chains += 1
  game.longest = game.length
  game.fastMs = game.fastMs ? Math.min(game.fastMs, msPerTap) : msPerTap
  if (isReverse(game.length)) game.reverses += 1
  game.banner = {
    text: speed ? `CHAIN ${game.length}! +${base} ⚡+${speed}` : `CHAIN ${game.length}! +${base}`,
    color: '#7df9ff',
    until: game.t + REST_MS + 300,
  }
  game.events.push({ type: 'chain', length: game.length })
  game.run += 1
  if (game.run >= SHIELD_CHAINS && !game.shield) {
    game.shield = true
    game.run = 0
    game.popups.push({ x: game.cx, y: game.cy + 34, text: '🛡 Shield ready', color: '#7df9ff', life: 1.4 })
    game.events.push({ type: 'shieldUp' })
  }
  game.length = Math.min(game.length + 1, LIMITS.maxLength)
  if (game.twist === 'shuffle') game.turn += 1
  rest(game, REST_MS)
}

// A tap at (x, y). Only counts on a neuron, and only on your turn.
export function tap(game, x, y) {
  if (game.over || game.phase !== 'input') return null
  let hit = -1
  let best = HIT_R
  for (let i = 0; i < NODES; i++) {
    const p = posOf(game, i)
    const d = Math.hypot(p.x - x, p.y - y)
    if (d <= best) {
      best = d
      hit = i
    }
  }
  if (hit === -1) return null

  const node = game.nodes[hit]
  const at = posOf(game, hit)
  const want = expectedOrder(game)[game.next]
  game.lit[hit] = game.t + 220
  if (hit !== want) {
    game.rings.push({ x: at.x, y: at.y, r: NODE_R, life: 1, color: '#ff3b3b' })
    miss(game, 'wrong neuron')
    return 'wrong'
  }

  const mult = (isReverse(game.length) ? LIMITS.reverse : 1) * (game.surge ? LIMITS.surge : 1)
  const pts = LIMITS.linkPoints * game.length * mult
  game.score += pts
  game.points.links += pts
  game.links += 1
  game.next += 1
  game.lastTapAt = game.t
  game.rings.push({ x: at.x, y: at.y, r: NODE_R, life: 1, color: node.color })
  game.popups.push({ x: at.x, y: at.y - NODE_R - 6, text: `+${pts}`, color: '#ffffff', life: 0.8 })
  game.events.push({ type: 'link', note: node.note })

  if (game.next === game.length) finishChain(game)
  return 'right'
}

export function result(game) {
  return {
    score: game.score,
    durationMs: Math.round(game.t),
    points: { ...game.points },
    twist: game.twist,
    stats: {
      links: game.links,
      chains: game.chains,
      longest: game.longest,
      misses: game.misses,
      reverses: game.reverses,
      saves: game.saves,
      fastMs: game.fastMs,
    },
  }
}

// ---- Drawing ---------------------------------------------------------------

export function draw(ctx, game) {
  const { w, h, nodes, t } = game
  const pos = nodes.map((_, i) => posOf(game, i))

  const bg = ctx.createRadialGradient(game.cx, game.cy, 20, game.cx, game.cy, h * 0.8)
  bg.addColorStop(0, game.surge ? '#3a0f3f' : '#1d1046')
  bg.addColorStop(1, '#070b1f')
  ctx.fillStyle = bg
  ctx.fillRect(-20, -20, w + 40, h + 40)

  // Dendrites: each neuron to its neighbours and across the ring.
  ctx.strokeStyle = game.surge ? 'rgba(244, 114, 182, 0.18)' : 'rgba(167, 139, 250, 0.13)'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i < NODES; i++) {
    for (const k of [1, 3]) {
      const a = pos[i]
      const b = pos[(i + k) % NODES]
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
    }
  }
  ctx.stroke()

  // Sparks running between firing neurons (a still line with reduced motion).
  for (const p of game.pulses) {
    const a = pos[p.from]
    const b = pos[p.to]
    const k = clamp((t - p.at) / p.ms, 0, 1)
    const fade = clamp(1 - (t - p.at - p.ms) / 200, 0, 1)
    ctx.globalAlpha = fade * 0.7
    ctx.strokeStyle = nodes[p.to].color
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(lerp(a.x, b.x, game.calm ? 1 : k), lerp(a.y, b.y, game.calm ? 1 : k))
    ctx.stroke()
    if (!game.calm && k < 1) {
      ctx.globalAlpha = fade
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(lerp(a.x, b.x, k), lerp(a.y, b.y, k), 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1

  nodes.forEach((n, i) => {
    const { x, y } = pos[i]
    const on = t < game.lit[i]
    if (on) {
      ctx.globalAlpha = 0.35
      ctx.fillStyle = n.color
      ctx.beginPath()
      ctx.arc(x, y, NODE_R + 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    ctx.fillStyle = on ? n.color : '#1b1440'
    ctx.beginPath()
    ctx.arc(x, y, NODE_R, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = n.color
    ctx.globalAlpha = on ? 1 : 0.6
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.globalAlpha = 1
    // A dim core, so each neuron reads as its colour even when off.
    ctx.fillStyle = on ? '#ffffff' : n.color
    ctx.globalAlpha = on ? 0.9 : 0.35
    ctx.beginPath()
    ctx.arc(x, y, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  })

  for (const ring of game.rings) {
    ctx.globalAlpha = Math.max(0, ring.life)
    ctx.strokeStyle = ring.color
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // The middle of the ring says whose turn it is.
  ctx.textAlign = 'center'
  const banner = game.banner && t < game.banner.until ? game.banner : null
  if (banner) {
    ctx.fillStyle = banner.color
    ctx.font = `800 ${banner.text.length > 16 ? 17 : 22}px Poppins, system-ui, sans-serif`
    ctx.fillText(banner.text, game.cx, game.cy + 8)
  } else if (game.phase === 'show') {
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = '700 16px Poppins, system-ui, sans-serif'
    ctx.fillText(game.full ? 'WATCH' : 'NEW LINK', game.cx, game.cy - 4)
    ctx.font = '600 12px Poppins, system-ui, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    const ghost = isGhost(game, game.length - 1) && game.fired >= (game.full ? game.length : 1)
    ctx.fillText(ghost ? '👻 listen…' : `${game.length} links`, game.cx, game.cy + 16)
  } else if (game.phase === 'input') {
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 18px Poppins, system-ui, sans-serif'
    ctx.fillText(isReverse(game.length) ? 'BACKWARDS!' : game.twist === 'mirror' ? 'MIRROR IT' : 'YOUR TURN', game.cx, game.cy - 6)
    // One dot per link: filled as you go.
    const gap = Math.min(12, 150 / game.length)
    const x0 = game.cx - ((game.length - 1) * gap) / 2
    for (let i = 0; i < game.length; i++) {
      ctx.fillStyle = i < game.next ? '#7df9ff' : 'rgba(255,255,255,0.22)'
      ctx.beginPath()
      ctx.arc(x0 + i * gap, game.cy + 14, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
    // Time left for the next tap.
    const left = clamp(1 - (t - game.lastTapAt) / INPUT_MS, 0, 1)
    ctx.strokeStyle = left < 0.35 ? '#ff6b6b' : 'rgba(125, 249, 255, 0.5)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(game.cx, game.cy + 2, 46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left)
    ctx.stroke()
  }

  // Misses left, and the shield, under the time.
  for (let i = 0; i < MAX_MISSES; i++) {
    ctx.fillStyle = i < MAX_MISSES - game.misses ? '#a78bfa' : 'rgba(255,255,255,0.18)'
    ctx.beginPath()
    ctx.arc(w - 22 - i * 16, 60, 5, 0, Math.PI * 2)
    ctx.fill()
  }
  if (game.shield) {
    ctx.strokeStyle = '#7df9ff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(w - 22 - MAX_MISSES * 16, 60, 6, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.font = '700 14px Poppins, system-ui, sans-serif'
  for (const p of game.popups) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life))
    ctx.fillStyle = p.color
    ctx.fillText(p.text, p.x, p.y)
  }
  ctx.globalAlpha = 1

  if (game.flash?.life > 0) {
    ctx.strokeStyle = game.flash.color
    ctx.globalAlpha = Math.max(0, game.flash.life) * 0.8
    ctx.lineWidth = 10
    ctx.strokeRect(0, 0, w, h)
    ctx.globalAlpha = 1
  }
}
