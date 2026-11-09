/*
 * Zero Reflex: the game itself, with no React (the arcade page owns the
 * canvas, loop, screens and speakers).
 *
 *   const game = createGame(seed, { width, height })
 *   step(game, dtMs)
 *   tap(game, x, y)          // a tap, in world units
 *   draw(ctx, game)
 *
 * The arcade shell is pages/Play.jsx. A 30-second round in rules. Each rule
 * says what to tap ("Tap CYAN", "Tap ▲", "Tap anything but ORANGE"; from 8 s
 * also "Tap CYAN ▲" and "Tap anything but ▲"); a FREEZE rule says tap nothing
 * at all, while targets still pop up to tempt you. Fast correct taps score
 * more, and a streak multiplies them. Wrong taps cost points and break the
 * streak.
 *
 * - Golden stars: now and then a gold ★ pops up; tap it under any rule but a
 *   freeze for a bonus.
 * - Surge: the last 5 seconds spawn faster and score double.
 * - Twist: one rule for the whole day (TWISTS), from the seed.
 *
 * Rules, targets, places and timings come from `seed` and the clock only, so
 * one seed per day gives everyone the same round.
 */

export const WORLD_WIDTH = 360
export const ROUND_MS = 30000
export const SURGE_AT = 25000
// Ceilings the server checks against (backend/controllers/gameController.js
// GAMES.reflex): a hit is worth at most 150 x3, a held freeze 100, a golden
// star 200; the Surge doubles all three.
export const LIMITS = { maxScore: 80000, maxHits: 120, maxHolds: 8, maxGolds: 10, hitPoints: 900, holdPoints: 200, goldPoints: 400, minAvgMs: 150, minBestMs: 100 }

export const TWISTS = {
  tiny: { name: 'Tiny day', text: 'Every target is smaller. Aim carefully.' },
  rush: { name: 'Rush day', text: 'More targets, and they vanish faster.' },
  blackout: { name: 'Blackout day', text: 'Each rule hides after a second. Remember it.' },
  drift: { name: 'Drift day', text: 'Targets float around. Catch them.' },
}
const TWIST_KEYS = Object.keys(TWISTS)

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
const HARD_RULES_AT = 8000 // "both" and "anything but a shape" from here
const BLACKOUT_MS = 1000 // blackout day: how long a rule stays readable
const TARGET_R = 30
const TINY_R = 21
const WRONG_PENALTY = 40
const FREEZE_PENALTY = 60
const HOLD_BONUS = 100
const GOLD_POINTS = 200
const GOLD_LIFE = 950
const GOLD = '#fbbf24'

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
export const twistFor = (seed) => TWIST_KEYS[(seed >>> 9) % TWIST_KEYS.length]

const pick = (rand, list) => list[Math.floor(rand() * list.length)]
const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const nextOf = (keys, k) => keys[(keys.indexOf(k) + 1) % keys.length]

// Does a target count as "tap me" under a rule?
export function wanted(rule, target) {
  if (target.gold) return rule.kind !== 'freeze'
  if (rule.kind === 'color') return target.color === rule.color
  if (rule.kind === 'shape') return target.shape === rule.shape
  if (rule.kind === 'not') return target.color !== rule.color
  if (rule.kind === 'notShape') return target.shape !== rule.shape
  if (rule.kind === 'both') return target.color === rule.color && target.shape === rule.shape
  return false // freeze
}

export function ruleText(rule) {
  if (rule.kind === 'color') return { top: 'TAP', main: COLORS[rule.color].name, color: COLORS[rule.color].fill }
  if (rule.kind === 'shape') return { top: 'TAP', main: SHAPES[rule.shape], color: '#ffffff' }
  if (rule.kind === 'not') return { top: 'TAP ANYTHING BUT', main: COLORS[rule.color].name, color: COLORS[rule.color].fill }
  if (rule.kind === 'notShape') return { top: 'TAP ANYTHING BUT', main: SHAPES[rule.shape], color: '#ffffff' }
  if (rule.kind === 'both') return { top: 'TAP ONLY', main: `${COLORS[rule.color].name} ${SHAPES[rule.shape]}`, color: COLORS[rule.color].fill }
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
    const kinds = t >= HARD_RULES_AT ? ['color', 'shape', 'not', 'both', 'both', 'notShape'] : ['color', 'color', 'shape', 'not']
    const kind = freeze ? 'freeze' : pick(rand, kinds)
    const rule = { kind, start: t, end: Math.min(ROUND_MS, t + len) }
    if (['color', 'not', 'both'].includes(kind)) rule.color = pick(rand, COLOR_KEYS)
    if (['shape', 'notShape', 'both'].includes(kind)) rule.shape = pick(rand, SHAPE_KEYS)
    // Never the same rule twice in a row: it would look like nothing changed.
    const prev = rules.at(-1)
    if (prev && prev.kind === kind && kind !== 'freeze') {
      if (rule.color && rule.color === prev.color) rule.color = nextOf(COLOR_KEYS, rule.color)
      else if (rule.shape && rule.shape === prev.shape) rule.shape = nextOf(SHAPE_KEYS, rule.shape)
    }
    // About half the rules bring one golden star, somewhere in the middle.
    const goldRoll = rand()
    const goldWhen = rand()
    if (!freeze && goldRoll < 0.5 && rule.end - rule.start > 2200) {
      rule.goldAt = Math.round(rule.start + RULE_INTRO + 300 + goldWhen * (rule.end - rule.start - RULE_INTRO - 1500))
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
  const twist = twistFor(seed)
  return {
    w,
    h,
    seed,
    twist,
    r: twist === 'tiny' ? TINY_R : TARGET_R,
    rand,
    fx: rng(seed ^ 0x9e3779b9), // looks only
    t: 0,
    over: false,
    surge: false,
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
    golds: 0,
    points: { hits: 0, holds: 0, gold: 0 },
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
const surgeOf = (game) => (game.surge ? 2 : 1)

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

function lifeOf(game) {
  const life = lerp(1150, 700, game.t / ROUND_MS)
  return game.twist === 'rush' ? life * 0.8 : life
}

function spawn(game, rule, gold = false) {
  const { rand } = game
  const all = slots(game)
  const free = all.map((_, i) => i).filter((i) => !game.targets.some((tg) => tg.slot === i))
  // Always roll the same numbers, used or not, so the round stays the same for everyone.
  const slotRoll = rand()
  const right = rand() < (rule.kind === 'freeze' ? 0 : 0.6)
  const c = pick(rand, COLOR_KEYS)
  const sh = pick(rand, SHAPE_KEYS)
  const jx = (rand() - 0.5) * 24
  const jy = (rand() - 0.5) * 24
  const share = rand() // "both" rules: a wrong target that matches half the rule
  const heading = rand() * Math.PI * 2 // drift day
  if (!free.length) return
  const slotIndex = free[Math.floor(slotRoll * free.length)]
  const slot = all[slotIndex]
  let color = c
  let shape = sh
  // Make it right or wrong for the rule, keeping the other attribute random.
  if (rule.kind === 'color') color = right ? rule.color : c === rule.color ? nextOf(COLOR_KEYS, c) : c
  if (rule.kind === 'shape') shape = right ? rule.shape : sh === rule.shape ? nextOf(SHAPE_KEYS, sh) : sh
  if (rule.kind === 'not') color = right ? (c === rule.color ? nextOf(COLOR_KEYS, c) : c) : rule.color
  if (rule.kind === 'notShape') shape = right ? (sh === rule.shape ? nextOf(SHAPE_KEYS, sh) : sh) : rule.shape
  if (rule.kind === 'both') {
    if (right) {
      color = rule.color
      shape = rule.shape
    } else {
      if (share < 0.4) color = rule.color
      else if (share < 0.8) shape = rule.shape
      if (color === rule.color && shape === rule.shape) shape = nextOf(SHAPE_KEYS, shape)
    }
  }
  const speed = game.twist === 'drift' ? 30 + 25 * (game.t / ROUND_MS) : 0
  game.targets.push({
    slot: slotIndex,
    x: slot.x + jx,
    y: slot.y + jy,
    vx: Math.cos(heading) * speed,
    vy: Math.sin(heading) * speed,
    color,
    shape,
    gold,
    born: game.t,
    life: gold ? GOLD_LIFE : lifeOf(game),
  })
}

export function step(game, dtMs) {
  if (game.over) return game
  const dt = Math.min(dtMs, 100) // a frozen tab doesn't fast-forward the round
  game.t += dt
  const s = dt / 1000

  if (!game.surge && game.t >= SURGE_AT) {
    game.surge = true
    game.popups.push({ x: game.w / 2, y: 170, text: 'SURGE · x2', color: '#f472b6', life: 1.4 })
    game.events.push({ type: 'surge' })
  }

  // Next rule? A freeze nobody tapped through earns its bonus.
  let rule = currentRule(game)
  if (game.t >= rule.end) {
    if (rule.kind === 'freeze' && !game.tappedInRule) {
      const bonus = HOLD_BONUS * surgeOf(game)
      game.holds += 1
      game.score += bonus
      game.points.holds += bonus
      game.popups.push({ x: game.w / 2, y: game.h / 2, text: `Held it! +${bonus}`, color: '#7df9ff', life: 1.2 })
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

  const every = lerp(480, 300, game.t / ROUND_MS) * (game.twist === 'rush' ? 0.8 : 1) * (game.surge ? 0.8 : 1)
  while (game.t >= game.spawnAt && game.spawnAt < rule.end - 250) {
    spawn(game, rule)
    game.spawnAt += every
  }
  if (rule.goldAt && !rule.goldDone && game.t >= rule.goldAt) {
    rule.goldDone = true
    spawn(game, rule, true)
    game.events.push({ type: 'goldIn' })
  }

  // Drift day: targets float, bouncing off the arena's edges.
  for (const tg of game.targets) {
    if (!tg.vx && !tg.vy) continue
    tg.x += tg.vx * s
    tg.y += tg.vy * s
    if (tg.x < game.r + 6 || tg.x > game.w - game.r - 6) tg.vx *= -1
    if (tg.y < 175 + game.r || tg.y > game.h - game.r - 10) tg.vy *= -1
    tg.x = clamp(tg.x, game.r + 6, game.w - game.r - 6)
    tg.y = clamp(tg.y, 175 + game.r, game.h - game.r - 10)
  }

  // Missed a target you should have tapped (a golden star just goes).
  for (const tg of game.targets) {
    if (game.t - tg.born < tg.life) continue
    tg.gone = true
    if (!tg.gold && wanted(rule, tg)) {
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
  // The gold star first: it may sit over another target.
  const near = game.targets.filter((tg) => Math.hypot(tg.x - x, tg.y - y) <= game.r + 10)
  const hit = near.find((tg) => tg.gold) || near[0]
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
  if (hit.gold) {
    const pts = GOLD_POINTS * surgeOf(game)
    game.golds += 1
    game.score += pts
    game.points.gold += pts
    game.rings.push({ x: hit.x, y: hit.y, r: game.r, life: 1, color: GOLD })
    game.popups.push({ x: hit.x, y: hit.y - 10, text: `★ +${pts}`, color: GOLD, life: 1.1 })
    game.events.push({ type: 'gold' })
    return 'gold'
  }
  if (wanted(rule, hit)) {
    const ms = Math.round(game.t - hit.born)
    game.reactions.push(ms)
    game.streak += 1
    game.hits += 1
    // 50 for the tap, up to 100 more for speed (full under 250 ms, none past 850 ms).
    const pts = Math.round((50 + clamp((850 - ms) / 6, 0, 100)) * multiplier(game.streak) * surgeOf(game))
    game.score += pts
    game.points.hits += pts
    game.rings.push({ x: hit.x, y: hit.y, r: game.r, life: 1, color: COLORS[hit.color].fill })
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
    points: { ...game.points },
    twist: game.twist,
    stats: {
      hits: game.hits,
      wrong: game.wrong,
      missed: game.missed,
      holds: game.holds,
      golds: game.golds,
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
  } else if (shape === 'triangle') {
    ctx.moveTo(x, y - r)
    ctx.lineTo(x + r * 1.05, y + r * 0.8)
    ctx.lineTo(x - r * 1.05, y + r * 0.8)
    ctx.closePath()
  } else if (shape === 'star') {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const rr = i % 2 ? r * 0.45 : r * 1.05
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
    }
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
  bg.addColorStop(0, freeze ? '#1f0a14' : game.surge ? '#1f0a2a' : '#070b1f')
  bg.addColorStop(1, freeze ? '#2a0b1a' : game.surge ? '#3a0f3f' : '#151036')
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

  // The rule, big. It pulses in when it changes; on blackout day it hides after a second.
  const age = game.t - rule.start
  const hidden = game.twist === 'blackout' && !freeze && age > BLACKOUT_MS
  const text = hidden ? { top: 'REMEMBER THE RULE', main: '?', color: 'rgba(255,255,255,0.35)' } : ruleText(rule)
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
  const size = ['shape', 'notShape'].includes(rule.kind) && !hidden ? 46 : rule.kind === 'both' && !hidden ? 32 : 38
  ctx.font = `800 ${size}px Poppins, system-ui, sans-serif`
  ctx.fillText(text.main, 0, 12)
  ctx.restore()
  // How long this rule lasts.
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.fillRect(w / 2 - 60, 146, 120, 3)
  ctx.fillStyle = hidden ? 'rgba(255,255,255,0.5)' : text.color
  ctx.fillRect(w / 2 - 60, 146, 120 * Math.max(0, left), 3)

  for (const tg of game.targets) {
    const age = game.t - tg.born
    const life = 1 - age / tg.life
    const grow = Math.min(1, age / 90)
    const r = game.r * (0.6 + 0.4 * grow)
    const fill = tg.gold ? GOLD : COLORS[tg.color].fill
    // A ring that shrinks as time runs out.
    ctx.strokeStyle = tg.gold ? 'rgba(251,191,36,0.6)' : 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(tg.x, tg.y, game.r + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * life)
    ctx.stroke()
    ctx.fillStyle = fill
    shapePath(ctx, tg.gold ? 'star' : tg.shape, tg.x, tg.y, r)
    ctx.fill()
    ctx.strokeStyle = tg.gold ? '#ffffff' : 'rgba(255,255,255,0.55)'
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
