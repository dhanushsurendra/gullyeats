/*
 * Nebula Rush: the game itself, with no React. The arcade page owns the
 * canvas, the loop, the screens and the speakers; this file owns the rules.
 *
 *   const game = createGame(seed, { width, height })
 *   step(game, dtMs, { dx, dy })   // dx/dy: how far the finger moved, in world units
 *   draw(ctx, game)               // ctx already scaled to world units
 *   game.events                   // what happened since the page last emptied it (for sound)
 *
 * The world is 360 units wide. Rocks fall the way gravity points; gravity
 * turns every 10 s (with a warning). The ship fires on its own, against
 * gravity. Also out there:
 *   - comets: small, fast, straight; 15 points
 *   - hunter drones: drift in and chase the ship, take 4 shots; 50 points
 *   - energy orbs: build a combo up to x5
 *   - power-ups: Shield (soaks one hit), Overdrive (fast 5-way fire), Magnet (pulls energy in)
 * Skimming past a rock without touching it is a near miss (+5). The last
 * 10 s are the Surge: more rocks, every point doubled. 45 s, or three hits,
 * ends the round.
 *
 * Everything the player meets (what spawns, where and when, gravity turns)
 * comes from `seed` and the clock only, never from what the player does, so
 * one seed per day gives everyone the same daily challenge.
 */

export const WORLD_WIDTH = 360
export const ROUND_MS = 45000
export const SURGE_AT = 35000
export const MAX_HITS = 3
export const KILL_POINTS = { big: 20, small: 10, comet: 15 }
export const DRONE_POINTS = 50
export const ENERGY_POINTS = 25
export const NEAR_POINTS = 5
export const MAX_COMBO = 5
export const SURGE_MULTIPLIER = 2
// Ceilings the server checks against (backend/controllers/gameController.js
// GAMES.nebula): a score can't beat SURGE x (kills x 20 + drones x 50 +
// energy x 25 x MAX_COMBO + near x 5). The spawn schedule can't produce more.
export const LIMITS = { maxScore: 40000, maxKills: 500, maxDrones: 6, maxEnergy: 40, maxNear: 400, killPoints: 20, dronePoints: 50, energyPoints: 125, nearPoints: 5, surge: 2 }

const FLIP_EVERY = 10000
const FLIP_WARNING = 1500
const FIRE_EVERY = 180
const OVERDRIVE_FIRE_EVERY = 110
const ORB_EVERY = 2600
const INVULNERABLE_MS = 1200
const SHIP_R = 13
const NEAR_GAP = 16 // a rock this close to the hull, untouched, is a near miss
const BULLET_SPEED = 620
const GRAVITY = 260 // how hard rocks bend toward a new gravity
export const POWER_MS = { overdrive: 6000, magnet: 7000 }
const POWERS = ['shield', 'overdrive', 'magnet']
const DIRS = [
  { x: 0, y: 1, name: 'down' },
  { x: -1, y: 0, name: 'left' },
  { x: 0, y: -1, name: 'up' },
  { x: 1, y: 0, name: 'right' },
]

// Small, fast, seedable random numbers (mulberry32).
export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Today's seed: the same for everyone on an IST day.
export function istDay(t = Date.now()) {
  return new Date(t + 5.5 * 36e5).toISOString().slice(0, 10)
}
export function seedFor(day) {
  let h = 2166136261
  for (const ch of `nebula:${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export function createGame(seed, { width = WORLD_WIDTH, height = 640 } = {}) {
  const w = WORLD_WIDTH
  const h = Math.round(clamp((height / width) * WORLD_WIDTH, 520, 820))
  const fx = rng(seed ^ 0x9e3779b9) // looks only (sparks, stars, clouds): never changes play
  const extra = rng(seed ^ 0x51ed270b) // comets, drones, power-ups: their own stream, so rocks match v1's pattern
  const layer = (n, zmin, zmax) => Array.from({ length: n }, () => ({ x: fx() * w, y: fx() * h, z: zmin + fx() * (zmax - zmin) }))
  return {
    w,
    h,
    seed,
    rand: rng(seed),
    extra,
    fx,
    t: 0,
    over: false,
    score: 0,
    kills: 0,
    drones: 0,
    energy: 0,
    near: 0,
    hits: 0,
    combo: 1,
    maxCombo: 1,
    surge: false,
    ship: { x: w / 2, y: h * 0.78, inv: 0, shield: false, tilt: 0 },
    power: { overdrive: 0, magnet: 0 }, // ms left
    g: 0, // index into DIRS
    nextG: null, // the turn being warned about
    flipAt: FLIP_EVERY,
    spawnAt: 600,
    orbAt: ORB_EVERY,
    cometAt: 8000 + extra() * 2000,
    droneAt: [14000, 25000, 37000].map((t) => t + extra() * 3000),
    powerAt: 6000 + extra() * 2000,
    powerTurn: Math.floor(extra() * 3),
    fireAt: 0,
    rocks: [],
    bullets: [],
    orbs: [],
    powerups: [],
    sparks: [],
    popups: [],
    flashes: [], // full-screen tints: { color, life }
    stars: [layer(45, 0.25, 0.6), layer(25, 0.7, 1.2)],
    clouds: Array.from({ length: 4 }, (_, i) => ({
      x: fx() * w,
      y: fx() * h,
      r: 140 + fx() * 120,
      color: ['124, 58, 237', '34, 211, 238', '254, 82, 0', '236, 72, 153'][i],
    })),
    shake: 0,
    events: [],
  }
}

export const gravityOf = (game) => DIRS[game.g]
export const surgeOn = (game) => game.t >= SURGE_AT

const emit = (game, type, data) => game.events.push({ type, ...data })

// A point just outside the edge things come from (opposite gravity).
function upstream(game, along) {
  const d = DIRS[game.g]
  if (d.y === 1) return { x: along * game.w, y: -30 }
  if (d.y === -1) return { x: along * game.w, y: game.h + 30 }
  if (d.x === 1) return { x: -30, y: along * game.h }
  return { x: game.w + 30, y: along * game.h }
}

function rockShape(r, rand) {
  return Array.from({ length: 9 }, () => r * (0.72 + rand() * 0.38))
}

function spawnRock(game) {
  const { rand, t } = game
  const p = t / ROUND_MS
  const big = rand() < lerp(0.25, 0.45, p)
  const r = big ? 24 + rand() * 6 : 12 + rand() * 5
  const d = DIRS[game.g]
  const speed = lerp(110, 210, p) * (big ? 0.85 : 1.1) * (0.85 + rand() * 0.3)
  const drift = (rand() - 0.5) * 70
  const at = upstream(game, 0.08 + rand() * 0.84)
  const rock = {
    kind: 'rock',
    x: at.x,
    y: at.y,
    vx: d.x * speed + (d.y ? drift : 0),
    vy: d.y * speed + (d.x ? drift : 0),
    r,
    big,
    hp: big ? 3 : 1,
    spin: (rand() - 0.5) * 3,
    a: rand() * Math.PI * 2,
    shape: rockShape(r, rand),
    hue: rand() < 0.5 ? 'cyan' : 'violet',
  }
  game.rocks.push(rock)
  game.onSpawn?.(rock, game.t) // tests only
}

function spawnComet(game) {
  const d = DIRS[game.g]
  const at = upstream(game, 0.1 + game.extra() * 0.8)
  game.rocks.push({ kind: 'comet', x: at.x, y: at.y, vx: d.x * 390, vy: d.y * 390, r: 8, hp: 1, a: 0, spin: 0 })
  emit(game, 'comet')
}

function spawnDrone(game) {
  const d = DIRS[game.g]
  const at = upstream(game, 0.2 + game.extra() * 0.6)
  game.rocks.push({ kind: 'drone', x: at.x, y: at.y, vx: d.x * 60, vy: d.y * 60, r: 17, hp: 4, a: 0, spin: 1.2 })
  emit(game, 'drone')
}

function spawnPowerup(game) {
  const d = DIRS[game.g]
  const at = upstream(game, 0.15 + game.extra() * 0.7)
  const kind = POWERS[game.powerTurn % POWERS.length]
  game.powerTurn += 1 + Math.floor(game.extra() * 2)
  game.powerups.push({ kind, x: at.x, y: at.y, vx: d.x * 85, vy: d.y * 85, r: 13, a: 0 })
}

function spawnOrb(game) {
  const { rand } = game
  const d = DIRS[game.g]
  const at = upstream(game, 0.12 + rand() * 0.76)
  game.orbs.push({ x: at.x, y: at.y, vx: d.x * 95, vy: d.y * 95, r: 9, a: 0 })
}

function burst(game, x, y, color, n, speed = 160) {
  if (game.sparks.length > 320) return // plenty on screen; cheap phones thank you
  for (let i = 0; i < n; i++) {
    const a = game.fx() * Math.PI * 2
    const s = 40 + game.fx() * speed
    game.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color, size: 2 + game.fx() * 2 })
  }
}

function popup(game, x, y, text, color, size = 13) {
  game.popups.push({ x, y, text, color, life: 1, size })
}

const outside = (game, o, pad = 60) => o.x < -pad || o.x > game.w + pad || o.y < -pad || o.y > game.h + pad
const touching = (a, b, r) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < r * r

function award(game, base, x, y, color) {
  const pts = base * (game.surge ? SURGE_MULTIPLIER : 1)
  game.score += pts
  if (x !== undefined) popup(game, x, y, `+${pts}`, color)
  return pts
}

function destroy(game, r) {
  r.dead = true
  if (r.kind === 'drone') {
    game.drones += 1
    award(game, DRONE_POINTS, r.x, r.y, '#f472b6')
    burst(game, r.x, r.y, '#f472b6', 22, 220)
    game.flashes.push({ color: '244, 114, 182', life: 0.5 })
    game.shake = Math.max(game.shake, 8)
    emit(game, 'boom', { size: 'drone' })
    return
  }
  game.kills += 1
  const base = r.kind === 'comet' ? KILL_POINTS.comet : r.big ? KILL_POINTS.big : KILL_POINTS.small
  award(game, base, r.x, r.y, r.kind === 'comet' ? '#fde68a' : '#7df9ff')
  burst(game, r.x, r.y, r.kind === 'comet' ? '#fde68a' : r.hue === 'cyan' ? '#22d3ee' : '#a78bfa', r.big ? 16 : 9)
  emit(game, 'boom', { size: r.big ? 'big' : 'small' })
  if (r.big) {
    // Fixed split (no random numbers), so play can't change what spawns next.
    const side = { x: -r.vy, y: r.vx }
    const len = Math.hypot(side.x, side.y) || 1
    for (const k of [-1, 1]) {
      game.rocks.push({
        kind: 'rock',
        x: r.x,
        y: r.y,
        vx: r.vx * 0.8 + (side.x / len) * 90 * k,
        vy: r.vy * 0.8 + (side.y / len) * 90 * k,
        r: r.r * 0.55,
        big: false,
        hp: 1,
        spin: r.spin * -1.5,
        a: r.a,
        shape: r.shape.map((v) => v * 0.55),
        hue: r.hue,
      })
    }
  }
}

function tick(game, dt, input) {
  const s = dt / 1000
  game.t += dt
  const d = DIRS[game.g]

  if (!game.surge && surgeOn(game)) {
    game.surge = true
    game.flashes.push({ color: '254, 82, 0', life: 0.8 })
    popup(game, game.w / 2, game.h / 2, 'SURGE  x2', '#fe5200', 30)
    emit(game, 'surge')
  }

  // Gravity turns: warn first, then turn. The next direction is one of the other three.
  if (game.nextG === null && game.t >= game.flipAt - FLIP_WARNING) {
    game.nextG = (game.g + 1 + Math.floor(game.rand() * 3)) % 4
    emit(game, 'warn')
  }
  if (game.t >= game.flipAt) {
    game.g = game.nextG
    game.nextG = null
    game.flipAt += FLIP_EVERY
    game.shake = 6
    game.flashes.push({ color: '253, 224, 71', life: 0.35 })
    emit(game, 'shift')
  }

  // Ship follows the finger (relative drag), stays on screen, leans into the turn.
  const ship = game.ship
  const mx = input?.dx || 0
  const my = input?.dy || 0
  ship.x = clamp(ship.x + mx, SHIP_R, game.w - SHIP_R)
  ship.y = clamp(ship.y + my, SHIP_R, game.h - SHIP_R)
  const side = d.y ? mx * d.y : -my * d.x // sideways relative to where the ship points
  ship.tilt = lerp(ship.tilt, clamp(side * 0.12, -0.45, 0.45), Math.min(1, 12 * s))
  ship.inv = Math.max(0, ship.inv - dt)
  for (const k of Object.keys(game.power)) {
    if (game.power[k] > 0 && (game.power[k] -= dt) <= 0) {
      game.power[k] = 0
      emit(game, 'powerEnd', { kind: k })
    }
  }

  // Engine trail (looks only).
  if (game.sparks.length < 320) {
    game.sparks.push({ x: ship.x + d.x * 12, y: ship.y + d.y * 12, vx: d.x * 90 + (game.fx() - 0.5) * 30, vy: d.y * 90 + (game.fx() - 0.5) * 30, life: 0.5, color: game.fx() < 0.5 ? '#fe5200' : '#fde047', size: 2.5 })
  }

  // Auto-fire against gravity: a slight three-way spread; five-way and faster in Overdrive.
  if (game.t >= game.fireAt) {
    const od = game.power.overdrive > 0
    game.fireAt = game.t + (od ? OVERDRIVE_FIRE_EVERY : FIRE_EVERY)
    const base = Math.atan2(-d.y, -d.x)
    for (const k of od ? [-0.26, -0.13, 0, 0.13, 0.26] : [-0.13, 0, 0.13]) {
      const a = base + k
      game.bullets.push({ x: ship.x, y: ship.y, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, hot: od })
    }
    emit(game, 'shoot', { overdrive: od })
  }

  // Spawning: all on the clock.
  while (game.t >= game.spawnAt) {
    spawnRock(game)
    game.spawnAt += lerp(1000, 420, game.t / ROUND_MS) * (surgeOn(game) ? 0.7 : 1)
  }
  while (game.t >= game.orbAt) {
    spawnOrb(game)
    game.orbAt += ORB_EVERY
  }
  while (game.t >= game.cometAt) {
    spawnComet(game)
    game.cometAt += 2600 + game.extra() * 1600
  }
  while (game.droneAt.length && game.t >= game.droneAt[0]) {
    game.droneAt.shift()
    spawnDrone(game)
  }
  while (game.t >= game.powerAt) {
    spawnPowerup(game)
    game.powerAt += 8000 + game.extra() * 2500
  }

  // Move. Rocks bend toward the current gravity; drones hunt the ship.
  for (const r of game.rocks) {
    if (r.kind === 'drone') {
      const tx = ship.x - r.x
      const ty = ship.y - r.y
      const len = Math.hypot(tx, ty) || 1
      r.vx = lerp(r.vx, d.x * 55 + (tx / len) * 85, Math.min(1, 1.5 * s))
      r.vy = lerp(r.vy, d.y * 55 + (ty / len) * 85, Math.min(1, 1.5 * s))
    } else if (r.kind === 'rock') {
      r.vx += d.x * GRAVITY * s
      r.vy += d.y * GRAVITY * s
      const sp = Math.hypot(r.vx, r.vy)
      if (sp > 300) {
        r.vx *= 300 / sp
        r.vy *= 300 / sp
      }
    }
    r.x += r.vx * s
    r.y += r.vy * s
    r.a += r.spin * s
  }
  const magnet = game.power.magnet > 0
  for (const o of game.orbs) {
    const pull = magnet && Math.hypot(ship.x - o.x, ship.y - o.y) < 190
    if (pull) {
      const len = Math.hypot(ship.x - o.x, ship.y - o.y) || 1
      o.vx = lerp(o.vx, ((ship.x - o.x) / len) * 330, Math.min(1, 6 * s))
      o.vy = lerp(o.vy, ((ship.y - o.y) / len) * 330, Math.min(1, 6 * s))
    } else {
      o.vx = lerp(o.vx, d.x * 95, Math.min(1, 2 * s))
      o.vy = lerp(o.vy, d.y * 95, Math.min(1, 2 * s))
    }
    o.x += o.vx * s
    o.y += o.vy * s
    o.a += s
  }
  for (const p of game.powerups) {
    p.vx = lerp(p.vx, d.x * 85, Math.min(1, 2 * s))
    p.vy = lerp(p.vy, d.y * 85, Math.min(1, 2 * s))
    p.x += p.vx * s
    p.y += p.vy * s
    p.a += s
  }
  for (const b of game.bullets) {
    b.x += b.vx * s
    b.y += b.vy * s
  }

  // Bullets hit rocks, comets and drones.
  for (const b of game.bullets) {
    for (const r of game.rocks) {
      if (r.dead || !touching(b, r, r.r + 3)) continue
      b.dead = true
      r.hp -= 1
      if (r.hp > 0) {
        burst(game, b.x, b.y, r.kind === 'drone' ? '#f9a8d4' : '#9be7ff', 3)
        r.flash = 1
        emit(game, 'ping')
      } else destroy(game, r)
      break
    }
  }

  // Rocks hit the ship (a shield soaks one hit), or skim past it.
  for (const r of game.rocks) {
    if (r.dead) continue
    const dist = Math.hypot(ship.x - r.x, ship.y - r.y)
    if (dist < r.r + SHIP_R * 0.8) {
      if (ship.inv) continue
      r.dead = true
      burst(game, r.x, r.y, '#ffffff', 10)
      if (ship.shield) {
        ship.shield = false
        ship.inv = 600
        game.flashes.push({ color: '34, 211, 238', life: 0.5 })
        popup(game, ship.x, ship.y - 26, 'SHIELD', '#7df9ff')
        emit(game, 'shieldBreak')
        continue
      }
      game.hits += 1
      game.combo = 1
      ship.inv = INVULNERABLE_MS
      game.shake = 12
      game.flashes.push({ color: '255, 59, 59', life: 0.7 })
      burst(game, ship.x, ship.y, '#fe5200', 18)
      popup(game, ship.x, ship.y - 24, 'HIT', '#ff6b6b')
      emit(game, 'hit', { left: MAX_HITS - game.hits })
      continue
    }
    if (!r.nearDone && r.kind !== 'drone' && dist < r.r + SHIP_R + NEAR_GAP) r.nearCheck = true
    // Counted once it has passed, still untouched.
    if (r.nearCheck && !r.nearDone && dist > r.r + SHIP_R + NEAR_GAP + 6) {
      r.nearDone = true
      if (ship.inv) continue // passing through a blinking ship isn't skill
      game.near += 1
      award(game, NEAR_POINTS)
      popup(game, ship.x + 22, ship.y - 10, 'close!', '#fde68a', 11)
      emit(game, 'near')
    }
  }

  // Energy.
  for (const o of game.orbs) {
    if (o.dead || !touching(ship, o, o.r + SHIP_R + 4)) continue
    o.dead = true
    game.energy += 1
    const pts = award(game, ENERGY_POINTS * game.combo)
    popup(game, o.x, o.y, game.combo > 1 ? `+${pts} x${game.combo}` : `+${pts}`, '#fde047')
    burst(game, o.x, o.y, '#fde047', 10)
    emit(game, 'energy', { combo: game.combo })
    game.combo = Math.min(MAX_COMBO, game.combo + 1)
    game.maxCombo = Math.max(game.maxCombo, game.combo)
  }

  // Power-ups.
  for (const p of game.powerups) {
    if (p.dead || !touching(ship, p, p.r + SHIP_R + 6)) continue
    p.dead = true
    if (p.kind === 'shield') ship.shield = true
    else game.power[p.kind] = POWER_MS[p.kind]
    const label = { shield: 'SHIELD UP', overdrive: 'OVERDRIVE', magnet: 'MAGNET' }[p.kind]
    popup(game, ship.x, ship.y - 30, label, POWER_STYLE[p.kind].color, 15)
    burst(game, p.x, p.y, POWER_STYLE[p.kind].color, 14)
    emit(game, 'power', { kind: p.kind })
  }

  for (const p of game.sparks) {
    p.x += p.vx * s
    p.y += p.vy * s
    p.vx *= 0.96
    p.vy *= 0.96
    p.life -= s * 1.8
  }
  for (const p of game.popups) {
    p.y -= 30 * s
    p.life -= s * (p.size > 20 ? 0.7 : 1.4)
  }
  for (const f of game.flashes) f.life -= s * 2.5
  for (const r of game.rocks) if (r.flash) r.flash = Math.max(0, r.flash - s * 8)
  game.shake = Math.max(0, game.shake - 40 * s)

  game.rocks = game.rocks.filter((r) => !r.dead && !outside(game, r))
  game.orbs = game.orbs.filter((o) => !o.dead && !outside(game, o))
  game.powerups = game.powerups.filter((p) => !p.dead && !outside(game, p))
  game.bullets = game.bullets.filter((b) => !b.dead && !outside(game, b, 10))
  game.sparks = game.sparks.filter((p) => p.life > 0)
  game.popups = game.popups.filter((p) => p.life > 0)
  game.flashes = game.flashes.filter((f) => f.life > 0)

  if (game.hits >= MAX_HITS || game.t >= ROUND_MS) {
    game.t = Math.min(game.t, ROUND_MS)
    game.over = true
    emit(game, 'over', { crashed: game.hits >= MAX_HITS })
  }
}

// Advance by dtMs in small fixed steps, so a slow frame can't let a rock pass
// through the ship. The finger movement is spread over the steps.
export function step(game, dtMs, input = {}) {
  if (game.over) return game
  const total = Math.min(dtMs, 100) // a frozen tab doesn't fast-forward the round
  const n = Math.max(1, Math.ceil(total / 16))
  for (let i = 0; i < n && !game.over; i++) {
    tick(game, total / n, { dx: (input.dx || 0) / n, dy: (input.dy || 0) / n })
  }
  return game
}

export const result = (game) => ({
  score: game.score,
  durationMs: Math.round(game.t),
  stats: { kills: game.kills, drones: game.drones, energy: game.energy, near: game.near, hits: game.hits, maxCombo: game.maxCombo },
})

// ---- Drawing ---------------------------------------------------------------

const ROCK_COLORS = {
  cyan: { fill: '#0e2a3d', edge: '#22d3ee' },
  violet: { fill: '#24154a', edge: '#a78bfa' },
}
export const POWER_STYLE = {
  shield: { color: '#22d3ee', letter: 'S' },
  overdrive: { color: '#fe5200', letter: 'O' },
  magnet: { color: '#c084fc', letter: 'M' },
}

function arrow(ctx, cx, cy, dir, size) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(Math.atan2(dir.y, dir.x) - Math.PI / 2)
  ctx.beginPath()
  ctx.moveTo(0, size)
  ctx.lineTo(size * 0.7, 0)
  ctx.lineTo(size * 0.25, 0)
  ctx.lineTo(size * 0.25, -size)
  ctx.lineTo(-size * 0.25, -size)
  ctx.lineTo(-size * 0.25, 0)
  ctx.lineTo(-size * 0.7, 0)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// The painted nebula, drawn once into its own canvas (gradients every frame are slow on cheap phones).
function backdrop(game) {
  if (game.backdrop !== undefined) return game.backdrop
  game.backdrop = null
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = game.w
  c.height = game.h
  const ctx = c.getContext('2d')
  if (!ctx) return null
  const bg = ctx.createLinearGradient(0, 0, 0, game.h)
  bg.addColorStop(0, '#060a1c')
  bg.addColorStop(0.6, '#0f0a2b')
  bg.addColorStop(1, '#1a0a30')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, game.w, game.h)
  for (const cl of game.clouds) {
    const g = ctx.createRadialGradient(cl.x, cl.y, 0, cl.x, cl.y, cl.r)
    g.addColorStop(0, `rgba(${cl.color}, 0.16)`)
    g.addColorStop(1, `rgba(${cl.color}, 0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, game.w, game.h)
  }
  game.backdrop = c
  return c
}

function drawRock(ctx, r) {
  ctx.save()
  ctx.translate(r.x, r.y)
  if (r.kind === 'comet') {
    // A bright head with a tail along its path.
    const len = Math.hypot(r.vx, r.vy) || 1
    const tail = ctx.createLinearGradient(0, 0, (-r.vx / len) * 60, (-r.vy / len) * 60)
    tail.addColorStop(0, 'rgba(253, 230, 138, 0.8)')
    tail.addColorStop(1, 'rgba(253, 230, 138, 0)')
    ctx.strokeStyle = tail
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo((-r.vx / len) * 60, (-r.vy / len) * 60)
    ctx.stroke()
    ctx.fillStyle = '#fffbeb'
    ctx.beginPath()
    ctx.arc(0, 0, r.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }
  ctx.rotate(r.a)
  if (r.kind === 'drone') {
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      if (i) ctx.lineTo(Math.cos(a) * r.r, Math.sin(a) * r.r)
      else ctx.moveTo(Math.cos(a) * r.r, Math.sin(a) * r.r)
    }
    ctx.closePath()
    ctx.fillStyle = r.flash ? '#fbcfe8' : '#3b0d2e'
    ctx.fill()
    ctx.strokeStyle = '#f472b6'
    ctx.globalAlpha = 0.3
    ctx.lineWidth = 7
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.rotate(-r.a)
    ctx.fillStyle = '#f472b6'
    ctx.beginPath()
    ctx.arc(0, 0, 5, 0, Math.PI * 2)
    ctx.fill()
    // Health pips.
    for (let i = 0; i < r.hp; i++) ctx.fillRect(-9 + i * 5, r.r + 5, 3, 3)
    ctx.restore()
    return
  }
  const c = ROCK_COLORS[r.hue]
  ctx.beginPath()
  r.shape.forEach((rad, i) => {
    const a = (i / r.shape.length) * Math.PI * 2
    if (i) ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad)
    else ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad)
  })
  ctx.closePath()
  ctx.fillStyle = r.flash ? '#e0f2fe' : c.fill
  ctx.fill()
  // A soft wide stroke under a sharp one: a glow without shadowBlur (slow on cheap phones).
  ctx.strokeStyle = c.edge
  ctx.globalAlpha = 0.25
  ctx.lineWidth = 6
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.lineWidth = r.big && r.hp < 3 ? 1.2 : 2
  ctx.stroke()
  ctx.restore()
}

export function draw(ctx, game) {
  const { w, h } = game
  const d = DIRS[game.g]
  ctx.save()
  if (game.shake) ctx.translate((game.fx() - 0.5) * game.shake, (game.fx() - 0.5) * game.shake)

  const bd = backdrop(game)
  if (bd) ctx.drawImage(bd, -20, -20, w + 40, h + 40)
  else {
    ctx.fillStyle = '#0b0a24'
    ctx.fillRect(-20, -20, w + 40, h + 40)
  }

  // Two star layers stream with gravity, near ones faster.
  for (const [i, layer] of game.stars.entries()) {
    ctx.fillStyle = i ? '#e0e7ff' : '#818cf8'
    for (const st of layer) {
      const x = (((st.x + d.x * game.t * 0.06 * st.z) % w) + w) % w
      const y = (((st.y + d.y * game.t * 0.06 * st.z) % h) + h) % h
      ctx.globalAlpha = 0.25 + st.z * 0.45
      if (i && game.surge) ctx.fillRect(x, y, Math.max(1.5, Math.abs(d.x) * 9), Math.max(1.5, Math.abs(d.y) * 9)) // warp streaks
      else ctx.fillRect(x, y, st.z * 2, st.z * 2)
    }
  }
  ctx.globalAlpha = 1

  // Gravity warning: the new direction, big and blinking.
  if (game.nextG !== null) {
    const nd = DIRS[game.nextG]
    const blink = Math.floor(game.t / 150) % 2
    ctx.globalAlpha = blink ? 0.9 : 0.45
    ctx.fillStyle = '#fde047'
    arrow(ctx, w / 2, h / 2, nd, 46)
    ctx.globalAlpha = 1
    ctx.font = '700 15px Poppins, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('GRAVITY SHIFT', w / 2, h / 2 + 78)
  }

  for (const o of game.orbs) {
    const pulse = 1 + Math.sin(o.a * 6) * 0.15
    // A ring, not a filled halo: translucent yellow on navy turns brown.
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.55)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(o.x, o.y, o.r * 1.9 * pulse, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#fde047'
    ctx.beginPath()
    ctx.arc(o.x, o.y, o.r * pulse, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fffbe0'
    ctx.beginPath()
    ctx.arc(o.x - 2, o.y - 2, o.r * 0.35, 0, Math.PI * 2)
    ctx.fill()
  }

  for (const p of game.powerups) {
    const st = POWER_STYLE[p.kind]
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(Math.sin(p.a * 3) * 0.3)
    const s = p.r * (1 + Math.sin(p.a * 7) * 0.08)
    ctx.strokeStyle = st.color
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 8
    ctx.strokeRect(-s, -s, s * 2, s * 2)
    ctx.globalAlpha = 1
    ctx.fillStyle = '#0b1026'
    ctx.fillRect(-s, -s, s * 2, s * 2)
    ctx.lineWidth = 2
    ctx.strokeRect(-s, -s, s * 2, s * 2)
    ctx.fillStyle = st.color
    ctx.font = '800 15px Poppins, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(st.letter, 0, 1)
    ctx.textBaseline = 'alphabetic'
    ctx.restore()
  }

  for (const r of game.rocks) drawRock(ctx, r)

  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  for (const hot of [false, true]) {
    ctx.strokeStyle = hot ? '#fdba74' : '#7df9ff'
    ctx.beginPath()
    for (const b of game.bullets) {
      if (Boolean(b.hot) !== hot) continue
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018)
    }
    ctx.stroke()
  }

  for (const p of game.sparks) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life))
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  ctx.globalAlpha = 1

  // Ship: points against gravity, leans into turns, flame trails with gravity. Blinks while recovering.
  const ship = game.ship
  if (!ship.inv || Math.floor(ship.inv / 100) % 2 === 0) {
    ctx.save()
    ctx.translate(ship.x, ship.y)
    if (ship.shield) {
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, SHIP_R + 9 + Math.sin(game.t / 120) * 1.5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = 'rgba(34, 211, 238, 0.1)'
      ctx.fill()
    }
    ctx.rotate(Math.atan2(-d.y, -d.x) + Math.PI / 2 + ship.tilt)
    const od = game.power.overdrive > 0
    const flame = (od ? 16 : 10) + game.fx() * 8
    ctx.fillStyle = '#fe5200'
    ctx.beginPath()
    ctx.moveTo(-6, 10)
    ctx.lineTo(0, 10 + flame)
    ctx.lineTo(6, 10)
    ctx.fill()
    ctx.fillStyle = '#fde047'
    ctx.beginPath()
    ctx.moveTo(-3, 10)
    ctx.lineTo(0, 10 + flame * 0.55)
    ctx.lineTo(3, 10)
    ctx.fill()
    // Wings, then the hull.
    ctx.fillStyle = od ? '#fdba74' : '#67e8f9'
    ctx.beginPath()
    ctx.moveTo(-4, 2)
    ctx.lineTo(-SHIP_R - 4, SHIP_R + 2)
    ctx.lineTo(-4, SHIP_R - 2)
    ctx.moveTo(4, 2)
    ctx.lineTo(SHIP_R + 4, SHIP_R + 2)
    ctx.lineTo(4, SHIP_R - 2)
    ctx.fill()
    ctx.fillStyle = '#e0f2fe'
    ctx.strokeStyle = od ? '#fe5200' : '#22d3ee'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, -SHIP_R - 5)
    ctx.lineTo(SHIP_R * 0.7, SHIP_R)
    ctx.lineTo(0, SHIP_R - 5)
    ctx.lineTo(-SHIP_R * 0.7, SHIP_R)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#a78bfa'
    ctx.beginPath()
    ctx.arc(0, -3, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Magnet field.
  if (game.power.magnet > 0) {
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.25)'
    ctx.setLineDash([4, 8])
    ctx.lineDashOffset = -game.t / 30
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(ship.x, ship.y, 60 + ((game.t / 8) % 130), 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }

  ctx.textAlign = 'center'
  for (const p of game.popups) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life))
    ctx.fillStyle = p.color
    ctx.font = `800 ${p.size}px Poppins, system-ui, sans-serif`
    ctx.fillText(p.text, p.x, p.y)
  }
  ctx.globalAlpha = 1
  ctx.restore()

  // Full-screen tints (hit, shift, surge), and the Surge's glowing edge.
  for (const f of game.flashes) {
    ctx.fillStyle = `rgba(${f.color}, ${Math.max(0, f.life) * 0.22})`
    ctx.fillRect(-20, -20, w + 40, h + 40)
  }
  if (game.surge) {
    ctx.strokeStyle = `rgba(254, 82, 0, ${0.35 + Math.sin(game.t / 140) * 0.2})`
    ctx.lineWidth = 6
    ctx.strokeRect(0, 0, w, h)
  }
}
