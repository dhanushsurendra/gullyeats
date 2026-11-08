/*
 * Zero Reflex: the game itself, with no React (the arcade page owns the
 * canvas, loop, screens and speakers).
 *
 *   const game = createGame(seed, { width, height })
 *   step(game, dtMs)
 *   tap(game, x, y)          // a tap, in world units
 *   draw(ctx, game)
 *
 * The arcade shell is pages/Play.jsx. A 20-second round in rules. Each rule says what to tap ("Tap CYAN",
 * "Tap ▲", "Tap anything but ORANGE"); a FREEZE rule says tap nothing at all,
 * while targets still pop up to tempt you. Fast correct taps score more, and a
 * streak multiplies them. Wrong taps cost points and break the streak.
 *
 * Rules, targets, places and timings come from `seed` and the clock only, so
 * one seed per day gives everyone the same round.
 */

export const WORLD_WIDTH = 360
export const ROUND_MS = 20000
// Ceilings the server checks against (backend/controllers/gameController.js
// GAMES.reflex): a hit is worth at most 150 x3, a held freeze 100.
export const LIMITS = { maxScore: 25000, maxHits: 70, maxHolds: 6, hitPoints: 450, holdPoints: 100, minAvgMs: 150, minBestMs: 100 }

const COLORS = {
  cyan: { fill: '#22d3ee', name: 'CYAN' },
  violet: { fill: '#a78bfa', name: 'PURPLE' },
  yellow: { fill: '#fde047', name: 'YELLOW' },
  orange: { fill: '#fe5200', name: 'ORANGE' },
}
const SHAPES = { circle: '●', square: '■', triangle: '▲', diamond: '◆' }
const COLOR_KEYS = Object.keys(COLORS)
const SHAPE_KEYS = Object.keys(SHAPES)

const RULE_INTRO = 700 // the new rule shows alone before targets come
const TARGET_R = 30
const WRONG_PENALTY = 40
const FREEZE_PENALTY = 60
const HOLD_BONUS = 100

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
  for (const ch of `reflex:${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)]
const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Does a target count as "tap me" under a rule?
export function wanted(rule, target) {
  if (rule.kind === 'color') return target.color === rule.color
  if (rule.kind === 'shape') return target.shape === rule.shape
  if (rule.kind === 'not') return target.color !== rule.color
  return false // freeze
}

export function ruleText(rule) {
  if (rule.kind === 'color') return { top: 'TAP', main: COLORS[rule.color].name, color: COLORS[rule.color].fill }
  if (rule.kind === 'shape') return { top: 'TAP', main: SHAPES[rule.shape], color: '#ffffff' }
  if (rule.kind === 'not') return { top: 'TAP ANYTHING BUT', main: COLORS[rule.color].name, color: COLORS[rule.color].fill }
  return { top: 'DON’T TAP', main: 'FREEZE', color: '#ff6b6b' }
}

// The whole round's rules: ~3.5 s each, a short freeze now and then, never two freezes in a row.
function makeRules(rand) {
  const rules = []
  let t = 0
  let lastFreeze = true // no freeze first
  while (t < ROUND_MS) {
    const freeze = !lastFreeze && rules.length >= 2 && rand() < 0.3
    let len = freeze ? 1800 + rand() * 600 : 3200 + rand() * 900
    // Too little left for another rule: this one runs to the end.
    if (ROUND_MS - (t + len) < 1500) len = ROUND_MS - t
    const kind = freeze ? 'freeze' : pick(rand, ['color', 'color', 'shape', 'not'])
    const rule = { kind, start: t, end: Math.min(ROUND_MS, t + len) }
    if (kind === 'color' || kind === 'not') rule.color = pick(rand, COLOR_KEYS)
    if (kind === 'shape') rule.shape = pick(rand, SHAPE_KEYS)
    // Never the same rule twice in a row: it would look like nothing changed.
    const prev = rules.at(-1)
    if (prev && prev.kind === kind && kind !== 'freeze') {
      if (rule.color && rule.color === prev.color) rule.color = COLOR_KEYS[(COLOR_KEYS.indexOf(rule.color) + 1) % 4]
      if (rule.shape && rule.shape === prev.shape) rule.shape = SHAPE_KEYS[(SHAPE_KEYS.indexOf(rule.shape) + 1) % 4]
    }
    rules.push(rule)
    lastFreeze = freeze
    t += len
  }
  return rules
}

export function createGame(seed, { width = WORLD_WIDTH, height = 640 } = {}) {
  const w = WORLD_WIDTH
  const h = Math.round(clamp((height / width) * WORLD_WIDTH, 520, 820))
  const rand = rng(seed)
  return {
    w,
    h,
    seed,
    rand,
    fx: rng(seed ^ 0x9e3779b9), // looks only
    t: 0,
    over: false,
    rules: makeRules(rand),
    ruleIndex: 0,
    targets: [],
    spawnAt: RULE_INTRO,
    score: 0,
    streak: 0,
    hits: 0,
    wrong: 0,
    missed: 0,
    holds: 0,
    reactions: [],
    tappedInRule: false,
    flash: null, // { color, life }: screen edge flash for right/wrong
    popups: [],
    rings: [],
    events: [], // for sound; the page empties it
  }
}

export const currentRule = (game) => game.rules[game.ruleIndex]
const multiplier = (streak) => (streak >= 10 ? 3 : streak >= 5 ? 2 : 1)
export const multiplierOf = (game) => multiplier(game.streak)

// The arena: below the rule banner and HUD, a 3 x 4 grid of slots so targets never overlap.
function slots(game) {
  const top = 190
  const bottom = game.h - 40
  const cols = 3
  const rows = 4
  const out = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({ x: ((c + 0.5) / cols) * game.w, y: top + ((r + 0.5) / rows) * (bottom - top) })
    }
  }
  return out
}

function spawn(game, rule) {
  const { rand } = game
  const p = game.t / ROUND_MS
  const all = slots(game)
  const free = all.map((_, i) => i).filter((i) => !game.targets.some((tg) => tg.slot === i))
  // Always roll the same numbers, used or not, so the round stays the same for everyone.
  const slotRoll = rand()
  const right = rand() < (rule.kind === 'freeze' ? 0 : 0.6)
  const c = pick(rand, COLOR_KEYS)
  const sh = pick(rand, SHAPE_KEYS)
  const jx = (rand() - 0.5) * 24
  const jy = (rand() - 0.5) * 24
  if (!free.length) return
  const slotIndex = free[Math.floor(slotRoll * free.length)]
  const slot = all[slotIndex]
  let color = c
  let shape = sh
  // Make it right or wrong for the rule, keeping the other attribute random.
  if (rule.kind === 'color') color = right ? rule.color : c === rule.color ? COLOR_KEYS[(COLOR_KEYS.indexOf(c) + 1) % 4] : c
  if (rule.kind === 'shape') shape = right ? rule.shape : sh === rule.shape ? SHAPE_KEYS[(SHAPE_KEYS.indexOf(sh) + 1) % 4] : sh
  if (rule.kind === 'not') color = right ? (c === rule.color ? COLOR_KEYS[(COLOR_KEYS.indexOf(c) + 1) % 4] : c) : rule.color
  game.targets.push({
    slot: slotIndex,
    x: slot.x + jx,
    y: slot.y + jy,
    color,
    shape,
    born: game.t,
    life: lerp(1150, 700, p),
  })
}

export function step(game, dtMs) {
  if (game.over) return game
  const dt = Math.min(dtMs, 100) // a frozen tab doesn't fast-forward the round
  game.t += dt
  const s = dt / 1000

  // Next rule? A freeze nobody tapped through earns its bonus.
  let rule = currentRule(game)
  if (game.t >= rule.end) {
    if (rule.kind === 'freeze' && !game.tappedInRule) {
      game.holds += 1
      game.score += HOLD_BONUS
      game.popups.push({ x: game.w / 2, y: game.h / 2, text: `Held it! +${HOLD_BONUS}`, color: '#7df9ff', life: 1.2 })
      game.events.push({ type: 'hold' })
    }
    game.ruleIndex = Math.min(game.ruleIndex + 1, game.rules.length - 1)
    game.tappedInRule = false
    // Targets from the old rule go, so nothing is judged by the wrong rule.
    game.targets = []
    rule = currentRule(game)
    game.spawnAt = Math.max(game.spawnAt, rule.start + RULE_INTRO)
    game.events.push({ type: 'rule', freeze: rule.kind === 'freeze' })
  }

  while (game.t >= game.spawnAt && game.spawnAt < rule.end - 250) {
    spawn(game, rule)
    game.spawnAt += lerp(480, 300, game.t / ROUND_MS)
  }

  // Missed a target you should have tapped.
  for (const tg of game.targets) {
    if (game.t - tg.born < tg.life) continue
    tg.gone = true
    if (wanted(rule, tg)) {
      game.missed += 1
      game.streak = 0
      game.popups.push({ x: tg.x, y: tg.y, text: 'missed', color: 'rgba(255,255,255,0.6)', life: 0.8 })
      game.events.push({ type: 'missed' })
    }
  }
  game.targets = game.targets.filter((tg) => !tg.gone)

  for (const p of game.popups) {
    p.y -= 28 * s
    p.life -= s * 1.3
  }
  for (const r of game.rings) {
    r.r += 160 * s
    r.life -= s * 2.5
  }
  if (game.flash) game.flash.life -= s * 3
  game.popups = game.popups.filter((p) => p.life > 0)
  game.rings = game.rings.filter((r) => r.life > 0)

  if (game.t >= ROUND_MS) {
    game.t = ROUND_MS
    game.over = true
    game.events.push({ type: 'over', crashed: false })
  }
  return game
}

// A tap at (x, y). Taps on empty space only count during a freeze.
export function tap(game, x, y) {
  if (game.over) return null
  const rule = currentRule(game)
  const hit = game.targets.find((tg) => Math.hypot(tg.x - x, tg.y - y) <= TARGET_R + 10)
  if (rule.kind === 'freeze') {
    if (!hit && game.t < rule.start + RULE_INTRO) return null // still reading the rule
    game.tappedInRule = true
    game.wrong += 1
    game.streak = 0
    game.score = Math.max(0, game.score - FREEZE_PENALTY)
    game.flash = { color: '#ff3b3b', life: 1 }
    game.popups.push({ x, y, text: `FREEZE! -${FREEZE_PENALTY}`, color: '#ff6b6b', life: 1 })
    if (hit) game.targets = game.targets.filter((tg) => tg !== hit)
    game.events.push({ type: 'wrong' })
    return 'wrong'
  }
  if (!hit) return null
  game.targets = game.targets.filter((tg) => tg !== hit)
  if (wanted(rule, hit)) {
    const ms = Math.round(game.t - hit.born)
    game.reactions.push(ms)
    game.streak += 1
    game.hits += 1
    // 50 for the tap, up to 100 more for speed (full under 250 ms, none past 850 ms).
    const pts = Math.round((50 + clamp((850 - ms) / 6, 0, 100)) * multiplier(game.streak))
    game.score += pts
    game.rings.push({ x: hit.x, y: hit.y, r: TARGET_R, life: 1, color: COLORS[hit.color].fill })
    game.popups.push({ x: hit.x, y: hit.y - 10, text: `+${pts}`, color: '#ffffff', life: 1 })
    game.popups.push({ x: hit.x, y: hit.y + 22, text: `${ms} ms`, color: 'rgba(255,255,255,0.7)', life: 0.9 })
    game.events.push({ type: 'right', streak: game.streak })
    return 'right'
  }
  game.wrong += 1
  game.streak = 0
  game.score = Math.max(0, game.score - WRONG_PENALTY)
  game.flash = { color: '#ff3b3b', life: 1 }
  game.popups.push({ x: hit.x, y: hit.y, text: `-${WRONG_PENALTY}`, color: '#ff6b6b', life: 1 })
  game.events.push({ type: 'wrong' })
  return 'wrong'
}

export function result(game) {
  const r = game.reactions
  const avgMs = r.length ? Math.round(r.reduce((a, b) => a + b, 0) / r.length) : 0
  return {
    score: game.score,
    durationMs: Math.round(game.t),
    stats: {
      hits: game.hits,
      wrong: game.wrong,
      missed: game.missed,
      holds: game.holds,
      avgMs,
      bestMs: r.length ? Math.min(...r) : 0,
    },
  }
}

// ---- Drawing ---------------------------------------------------------------

function shapePath(ctx, shape, x, y, r) {
  ctx.beginPath()
  if (shape === 'circle') ctx.arc(x, y, r, 0, Math.PI * 2)
  else if (shape === 'square') {
    // roundRect is missing on older phone browsers.
    if (ctx.roundRect) ctx.roundRect(x - r * 0.88, y - r * 0.88, r * 1.76, r * 1.76, 8)
    else ctx.rect(x - r * 0.88, y - r * 0.88, r * 1.76, r * 1.76)
  }
  else if (shape === 'triangle') {
    ctx.moveTo(x, y - r)
    ctx.lineTo(x + r * 1.05, y + r * 0.8)
    ctx.lineTo(x - r * 1.05, y + r * 0.8)
    ctx.closePath()
  } else {
    ctx.moveTo(x, y - r * 1.1)
    ctx.lineTo(x + r, y)
    ctx.lineTo(x, y + r * 1.1)
    ctx.lineTo(x - r, y)
    ctx.closePath()
  }
}

export function draw(ctx, game) {
  const { w, h } = game
  const rule = currentRule(game)
  const freeze = rule.kind === 'freeze'

  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, freeze ? '#1f0a14' : '#070b1f')
  bg.addColorStop(1, freeze ? '#2a0b1a' : '#151036')
  ctx.fillStyle = bg
  ctx.fillRect(-20, -20, w + 40, h + 40)

  // Faint grid, for the arcade look.
  ctx.strokeStyle = 'rgba(125, 249, 255, 0.05)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= w; x += 36) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
  }
  for (let y = 0; y <= h; y += 36) {
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
  }
  ctx.stroke()

  // The rule, big. It pulses in when it changes.
  const text = ruleText(rule)
  const age = game.t - rule.start
  const pop = age < 250 ? 1 + (1 - age / 250) * 0.25 : 1
  const left = 1 - (game.t - rule.start) / (rule.end - rule.start)
  ctx.save()
  ctx.translate(w / 2, 120)
  ctx.scale(pop, pop)
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = '700 13px Poppins, system-ui, sans-serif'
  ctx.fillText(text.top, 0, -30)
  ctx.fillStyle = text.color
  ctx.font = `800 ${rule.kind === 'shape' ? 46 : 38}px Poppins, system-ui, sans-serif`
  ctx.fillText(text.main, 0, 12)
  ctx.restore()
  // How long this rule lasts.
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.fillRect(w / 2 - 60, 146, 120, 3)
  ctx.fillStyle = text.color
  ctx.fillRect(w / 2 - 60, 146, 120 * Math.max(0, left), 3)

  for (const tg of game.targets) {
    const age = game.t - tg.born
    const life = 1 - age / tg.life
    const grow = Math.min(1, age / 90)
    const r = TARGET_R * (0.6 + 0.4 * grow)
    const fill = COLORS[tg.color].fill
    // A ring that shrinks as time runs out.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(tg.x, tg.y, TARGET_R + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * life)
    ctx.stroke()
    ctx.fillStyle = fill
    shapePath(ctx, tg.shape, tg.x, tg.y, r)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  for (const ring of game.rings) {
    ctx.globalAlpha = Math.max(0, ring.life)
    ctx.strokeStyle = ring.color
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  ctx.textAlign = 'center'
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
