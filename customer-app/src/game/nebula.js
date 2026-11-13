/*
 * Nebula Rush: the game itself, with no React. The arcade page owns the
 * canvas, the loop, the screens and the speakers; this file owns the rules.
 *
 *   const game = createGame(seed, { width, height })
 *   step(game, dtMs, { dx, dy, bomb })  // dx/dy: finger movement in world units; bomb: a double-tap
 *   draw(ctx, game)                    // ctx already scaled to world units
 *   game.events                        // what happened since the page last emptied it (sound, haptics)
 *
 * The world is 360 units wide. Rocks fall the way gravity points; gravity
 * turns every 10 s (with a warning). The ship fires on its own, against
 * gravity. A 55 s round runs through four sectors:
 *   0-15 s  Asteroid Belt   rocks and the first comets
 *   15-30 s Drone Nest      hunter drones that chase the ship and shoot back
 *   30-40 s Comet Storm     comets twice as often
 *   40-55 s Mothership      the boss: burst, aimed and laser attacks; gravity
 *                           stops turning; every point doubled (the Surge)
 * Also out there: energy orbs (combo up to x5; every 8 charge a Nova bomb,
 * fired with a double-tap), power-ups (Shield, Overdrive, Magnet). Skimming
 * past a rock is a near miss (+5). Three hits end the round.
 *
 * Each day also has an anomaly (low gravity, a swarm, ...), picked by the seed.
 *
 * Everything the player meets (what spawns, where and when, gravity turns,
 * boss attacks) comes from `seed` and the clock only, never from what the
 * player does, so one seed per day gives everyone the same daily challenge.
 */

export const WORLD_WIDTH = 360
export const ROUND_MS = 55000
export const BOSS_AT = 40000
export const SURGE_AT = BOSS_AT // the boss fight is the Surge
export const MAX_HITS = 3
export const KILL_POINTS = { big: 20, small: 10, comet: 15 }
export const DRONE_POINTS = 50
export const ENERGY_POINTS = 25
export const NEAR_POINTS = 5
export const BOSS_HP = 120
export const BOSS_HIT_POINTS = 5
export const BOSS_POINTS = 1000
export const MAX_COMBO = 5
export const SURGE_MULTIPLIER = 2
export const BOMB_ENERGY = 8
// Ceilings the server checks against (backend/controllers/gameController.js
// GAMES.nebula): a score can't beat SURGE x (kills x 20 + drones x 50 +
// energy x 25 x MAX_COMBO + near x 5 + boss hits x 5 + boss x 1000). Each
// boss hit takes one of its BOSS_HP, so there are never more than that.
export const LIMITS = { maxScore: 50000, maxKills: 600, maxDrones: 6, maxEnergy: 40, maxNear: 500, maxBossHits: 120, killPoints: 20, dronePoints: 50, energyPoints: 125, nearPoints: 5, bossHitPoints: 5, bossPoints: 1000, surge: 2 }

export const SECTORS = [
  { at: 0, name: 'ASTEROID BELT' },
  { at: 15000, name: 'DRONE NEST' },
  { at: 30000, name: 'COMET STORM' },
  { at: BOSS_AT, name: 'MOTHERSHIP' },
]

// The day's twist. Each only scales numbers the round already has.
export const ANOMALIES = {
  calm: { name: 'Clear skies', text: 'No anomaly today. Pure skill.' },
  lowg: { name: 'Low gravity', text: 'Rocks bend slowly after a shift.', gravity: 0.5 },
  comets: { name: 'Comet shower', text: 'Twice the comets, all round.', cometEvery: 0.5 },
  swarm: { name: 'Swarm', text: 'Two extra hunter drones.', extraDrones: 2 },
  heavy: { name: 'Heavy belt', text: 'More big rocks.', big: 0.15 },
  rapid: { name: 'Rapid shifts', text: 'Gravity turns every 7 s.', flipEvery: 7000 },
}

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
const DRONE_FIRE_EVERY = 1600
const BOSS_R = 40
const BOSS_ATTACK_EVERY = 2000
const LANCE_WARN = 900
const LANCE_END = 1500
const LANCE_HALF = 14 // half the laser's width
const NOVA_SPEED = 560
const NOVA_BOSS_DAMAGE = 25
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
export function anomalyFor(seed) {
  const ids = Object.keys(ANOMALIES)
  return ids[Math.floor(rng(seed ^ 0xa5a5a5a5)() * ids.length)]
}

const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export function createGame(seed, { width = WORLD_WIDTH, height = 640 } = {}) {
  const w = WORLD_WIDTH
  const h = Math.round(clamp((height / width) * WORLD_WIDTH, 520, 820))
  const fx = rng(seed ^ 0x9e3779b9) // looks only (sparks, stars, clouds): never changes play
  const extra = rng(seed ^ 0x51ed270b) // comets, drones, power-ups: their own stream
  const anomaly = anomalyFor(seed)
  const A = ANOMALIES[anomaly]
  const mod = { gravity: A.gravity ?? 1, cometEvery: A.cometEvery ?? 1, big: A.big ?? 0, flipEvery: A.flipEvery ?? FLIP_EVERY }
  const droneTimes = [16000, 20000, 24500, 28500, ...(A.extraDrones ? [18000, 26500] : [])].sort((a, b) => a - b)
  const layer = (n, zmin, zmax) => Array.from({ length: n }, () => ({ x: fx() * w, y: fx() * h, z: zmin + fx() * (zmax - zmin) }))
  return {
    w,
    h,
    seed,
    anomaly,
    mod,
    rand: rng(seed),
    extra,
    bossRand: rng(seed ^ 0xb055b055), // the boss's own stream: killing it early can't shift later spawns
    fx,
    t: 0,
    started: false,
    over: false,
    score: 0,
    points: { rocks: 0, drones: 0, energy: 0, near: 0, boss: 0 },
    kills: 0,
    drones: 0,
    energy: 0,
    near: 0,
    hits: 0,
    powers: 0,
    bombs: 0,
    bossHits: 0,
    bossDown: 0,
    combo: 1,
    maxCombo: 1,
    surge: false,
    sector: 0,
    ship: { x: w / 2, y: h * 0.78, inv: 0, shield: false, tilt: 0 },
    power: { overdrive: 0, magnet: 0 }, // ms left
    bomb: 0, // Nova bombs held (0 or 1)
    bombCharge: 0, // energy toward the next one
    nova: null, // the blast wave: { x, y, r }
    boss: null,
    g: 0, // index into DIRS
    nextG: null, // the turn being warned about
    flipAt: mod.flipEvery,
    spawnAt: 600,
    orbAt: ORB_EVERY,
    cometAt: 8000 * mod.cometEvery + extra() * 2000,
    droneAt: droneTimes.map((t) => t + extra() * 1500),
    powerAt: 6000 + extra() * 2000,
    powerTurn: Math.floor(extra() * 3),
    fireAt: 0,
    rocks: [],
    bullets: [],
    shots: [], // enemy fire
    orbs: [],
    powerups: [],
    sparks: [],
    popups: [],
    flashes: [], // full-screen tints: { color, life }
    freeze: 0, // ms of hit-stop asked of the page (looks only)
    // Set by the page: skin (ship colours), tips (first round ever), calm (reduced motion).
    skin: null,
    tips: false,
    tipsShown: {},
    tip: null,
    calm: false,
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
  const big = rand() < lerp(0.25, 0.45, p) + game.mod.big
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
  game.rocks.push({ kind: 'drone', x: at.x, y: at.y, vx: d.x * 60, vy: d.y * 60, r: 17, hp: 4, a: 0, spin: 1.2, shotAt: game.t + 1400 })
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

function spawnBoss(game) {
  // The attack order for the day: a seeded shuffle.
  const order = ['burst', 'aimed', 'lance']
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(game.bossRand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  game.boss = { x: -999, y: -999, r: BOSS_R, hp: BOSS_HP, enter: 0, order, attack: 0, attackAt: game.t + 2600, lance: null, flash: 0 }
  placeBoss(game)
  emit(game, 'bossIn')
  tip(game, 'boss', 'Shoot the Mothership. Watch for its laser line!')
}

// The boss hangs near the edge things come from and sways across it; on entry it glides in from beyond.
function placeBoss(game) {
  const b = game.boss
  const d = DIRS[game.g]
  const across = d.y ? game.w / 2 : game.h / 2
  const along = d.y ? game.h / 2 : game.w / 2
  const ease = 1 - (1 - b.enter) ** 3
  const back = along - (d.y ? 130 : 80) + (1 - ease) * 170 // clear of the score and timer when it hangs at the top
  const sway = Math.sin((game.t - BOSS_AT) / 1400) * (across - 80) * ease
  b.x = game.w / 2 - d.x * back - d.y * sway
  b.y = game.h / 2 - d.y * back + d.x * sway
}

// Where something sits across the laser's lanes (the axis the boss sways along).
function laneOf(game, x, y) {
  const d = DIRS[game.g]
  return -d.y * (x - game.w / 2) + d.x * (y - game.h / 2)
}

function aimShot(game, x, y, spread, speed) {
  const a = Math.atan2(game.ship.y - y, game.ship.x - x) + spread
  game.shots.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 5 })
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

// A tip for a first-time pilot, once each.
function tip(game, key, text) {
  if (!game.tips || game.tipsShown[key]) return
  game.tipsShown[key] = true
  game.tip = { text, life: 4 }
}

const outside = (game, o, pad = 60) => o.x < -pad || o.x > game.w + pad || o.y < -pad || o.y > game.h + pad
const touching = (a, b, r) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < r * r

function award(game, base, src, x, y, color, size) {
  const pts = base * (game.surge ? SURGE_MULTIPLIER : 1)
  game.score += pts
  game.points[src] += pts
  if (x !== undefined) popup(game, x, y, `+${pts}`, color, size)
  return pts
}

// Something hit the ship: a shield soaks it, else lose a hull pip.
function hurt(game) {
  const ship = game.ship
  if (ship.shield) {
    ship.shield = false
    ship.inv = 600
    game.flashes.push({ color: '34, 211, 238', life: 0.5 })
    popup(game, ship.x, ship.y - 26, 'SHIELD', '#7df9ff')
    emit(game, 'shieldBreak')
    return
  }
  game.hits += 1
  game.combo = 1
  ship.inv = INVULNERABLE_MS
  game.shake = 12
  game.flashes.push({ color: '255, 59, 59', life: 0.7 })
  burst(game, ship.x, ship.y, '#fe5200', 18)
  popup(game, ship.x, ship.y - 24, 'HIT', '#ff6b6b')
  emit(game, 'hit', { left: MAX_HITS - game.hits })
}

function destroy(game, r) {
  r.dead = true
  if (r.kind === 'drone') {
    game.drones += 1
    award(game, DRONE_POINTS, 'drones', r.x, r.y, '#f472b6')
    burst(game, r.x, r.y, '#f472b6', 22, 220)
    game.flashes.push({ color: '244, 114, 182', life: 0.5 })
    game.shake = Math.max(game.shake, 8)
    game.freeze = Math.max(game.freeze, 60)
    emit(game, 'boom', { size: 'drone' })
    return
  }
  game.kills += 1
  const base = r.kind === 'comet' ? KILL_POINTS.comet : r.big ? KILL_POINTS.big : KILL_POINTS.small
  award(game, base, 'rocks', r.x, r.y, r.kind === 'comet' ? '#fde68a' : '#7df9ff')
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
        novaHit: r.novaHit,
      })
    }
  }
}

function damageBoss(game, n) {
  const b = game.boss
  b.hp -= n
  b.flash = 1
  if (b.hp > 0) return
  game.bossDown = 1
  game.boss = null
  game.shots = []
  award(game, BOSS_POINTS, 'boss', b.x, b.y, '#fde047', 26)
  for (const c of ['#fe5200', '#f472b6', '#fde047', '#ffffff']) burst(game, b.x, b.y, c, 22, 300)
  game.flashes.push({ color: '255, 255, 255', life: 0.9 })
  game.shake = 18
  game.freeze = 260
  popup(game, game.w / 2, game.h / 2 + 40, 'MOTHERSHIP DOWN', '#fde047', 22)
  emit(game, 'bossDown')
}

function tick(game, dt, input) {
  const s = dt / 1000
  game.t += dt
  const d = DIRS[game.g]
  const ship = game.ship

  if (!game.started) {
    game.started = true
    popup(game, game.w / 2, game.h / 2 - 40, SECTORS[0].name, '#7df9ff', 22)
    if (game.anomaly !== 'calm') popup(game, game.w / 2, game.h / 2 - 8, `Anomaly: ${ANOMALIES[game.anomaly].name}`, '#c084fc', 14)
    tip(game, 'move', 'Drag anywhere to fly. You fire on your own.')
  }

  const next = SECTORS[game.sector + 1]
  if (next && game.t >= next.at) {
    game.sector += 1
    popup(game, game.w / 2, game.h / 2 - 40, next.name, game.sector === 3 ? '#fe5200' : '#7df9ff', 24)
    emit(game, 'sector', { index: game.sector })
  }

  if (!game.surge && surgeOn(game)) {
    game.surge = true
    game.flashes.push({ color: '254, 82, 0', life: 0.8 })
    popup(game, game.w / 2, game.h / 2, 'SURGE  x2', '#fe5200', 26)
    emit(game, 'surge')
    spawnBoss(game)
  }

  // Gravity turns: warn first, then turn. The next direction is one of the
  // other three. No turns once the Mothership arrives.
  if (game.nextG === null && game.flipAt < BOSS_AT && game.t >= game.flipAt - FLIP_WARNING) {
    game.nextG = (game.g + 1 + Math.floor(game.rand() * 3)) % 4
    emit(game, 'warn')
    tip(game, 'gravity', 'Gravity is turning! Rocks will fall the way of the arrow.')
  }
  if (game.nextG !== null && game.t >= game.flipAt) {
    game.g = game.nextG
    game.nextG = null
    game.flipAt += game.mod.flipEvery
    game.shake = 6
    game.flashes.push({ color: '253, 224, 71', life: 0.35 })
    emit(game, 'shift')
  }

  // Ship follows the finger (relative drag), stays on screen, leans into the turn.
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

  // Nova bomb: a double-tap sets off the one held.
  if (input?.bomb && game.bomb) {
    game.bomb = 0
    game.bombs += 1
    game.nova = { x: ship.x, y: ship.y, r: 0 }
    game.flashes.push({ color: '125, 249, 255', life: 0.7 })
    game.shake = 10
    emit(game, 'bomb')
  }

  // Engine trail (looks only).
  if (game.sparks.length < 320) {
    const flame = game.skin?.flame || ['#fe5200', '#fde047']
    game.sparks.push({ x: ship.x + d.x * 12, y: ship.y + d.y * 12, vx: d.x * 90 + (game.fx() - 0.5) * 30, vy: d.y * 90 + (game.fx() - 0.5) * 30, life: 0.5, color: game.fx() < 0.5 ? flame[0] : flame[1], size: 2.5 })
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

  // Spawning: all on the clock (never on whether the boss is still up). Fewer rocks in the boss fight.
  while (game.t >= game.spawnAt) {
    spawnRock(game)
    game.spawnAt += lerp(1000, 420, game.t / ROUND_MS) * (surgeOn(game) ? 1.4 : 1)
  }
  while (game.t >= game.orbAt) {
    spawnOrb(game)
    game.orbAt += ORB_EVERY
  }
  while (game.t >= game.cometAt) {
    spawnComet(game)
    const storm = game.t >= SECTORS[2].at && game.t < BOSS_AT
    game.cometAt += (2600 + game.extra() * 1600) * game.mod.cometEvery * (storm ? 0.45 : 1)
  }
  while (game.droneAt.length && game.t >= game.droneAt[0]) {
    game.droneAt.shift()
    spawnDrone(game)
  }
  while (game.t >= game.powerAt) {
    spawnPowerup(game)
    game.powerAt += 8000 + game.extra() * 2500
  }

  // Move. Rocks bend toward the current gravity; drones hunt the ship and shoot at it.
  for (const r of game.rocks) {
    if (r.kind === 'drone') {
      const tx = ship.x - r.x
      const ty = ship.y - r.y
      const len = Math.hypot(tx, ty) || 1
      r.vx = lerp(r.vx, d.x * 55 + (tx / len) * 85, Math.min(1, 1.5 * s))
      r.vy = lerp(r.vy, d.y * 55 + (ty / len) * 85, Math.min(1, 1.5 * s))
      if (game.t >= r.shotAt) {
        r.shotAt += DRONE_FIRE_EVERY
        if (!outside(game, r, -10)) {
          aimShot(game, r.x, r.y, 0, 150)
          emit(game, 'enemyShot')
        }
      }
    } else if (r.kind === 'rock') {
      r.vx += d.x * GRAVITY * game.mod.gravity * s
      r.vy += d.y * GRAVITY * game.mod.gravity * s
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
  for (const b of game.shots) {
    b.x += b.vx * s
    b.y += b.vy * s
  }

  // The Mothership: glides in, sways, attacks on the clock.
  const boss = game.boss
  if (boss) {
    boss.enter = Math.min(1, boss.enter + s / 2)
    boss.flash = Math.max(0, boss.flash - s * 8)
    placeBoss(game)
    if (game.t >= boss.attackAt) {
      boss.attackAt += BOSS_ATTACK_EVERY
      const kind = boss.order[boss.attack % boss.order.length]
      boss.attack += 1
      if (kind === 'burst') {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + boss.attack * 0.26
          game.shots.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, r: 5 })
        }
        emit(game, 'enemyShot', { big: true })
      } else if (kind === 'aimed') {
        for (const k of [-0.22, 0, 0.22]) aimShot(game, boss.x, boss.y, k, 190)
        emit(game, 'enemyShot', { big: true })
      } else {
        const across = d.y ? game.w / 2 : game.h / 2
        boss.lance = { at: game.t, lane: (game.bossRand() * 2 - 1) * (across - 40), live: false }
        emit(game, 'laserWarn')
      }
    }
    const lance = boss.lance
    if (lance) {
      const age = game.t - lance.at
      if (age >= LANCE_END) boss.lance = null
      else if (age >= LANCE_WARN) {
        if (!lance.live) {
          lance.live = true
          game.shake = Math.max(game.shake, 6)
          emit(game, 'laser')
        }
        if (!ship.inv && Math.abs(laneOf(game, ship.x, ship.y) - lance.lane) < LANCE_HALF + SHIP_R * 0.6) hurt(game)
      }
    }
    if (!ship.inv && touching(ship, boss, boss.r + SHIP_R * 0.6)) hurt(game)
  }

  // Bullets hit the boss, rocks, comets and drones.
  for (const b of game.bullets) {
    if (game.boss && game.boss.enter > 0.3 && touching(b, game.boss, game.boss.r)) {
      b.dead = true
      game.bossHits += 1
      award(game, BOSS_HIT_POINTS, 'boss')
      if (game.bossHits % 3 === 0) emit(game, 'ping')
      burst(game, b.x, b.y, '#f9a8d4', 2)
      damageBoss(game, 1)
      continue
    }
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

  // The Nova's ring: destroys rocks and comets, cripples drones, clears enemy fire, dents the boss.
  const nova = game.nova
  if (nova) {
    nova.r += NOVA_SPEED * s
    for (const r of game.rocks) {
      if (r.dead || r.novaHit === nova || !touching(nova, r, nova.r + r.r)) continue
      r.novaHit = nova
      if (r.kind === 'drone') {
        r.hp -= 3
        r.flash = 1
        if (r.hp <= 0) destroy(game, r)
      } else destroy(game, r)
    }
    for (const b of game.shots) if (touching(nova, b, nova.r)) b.dead = true
    if (game.boss && game.boss.novaHit !== nova && touching(nova, game.boss, nova.r + game.boss.r)) {
      game.boss.novaHit = nova
      damageBoss(game, NOVA_BOSS_DAMAGE)
    }
    if (nova.r > 480) game.nova = null
  }

  // Enemy fire hits the ship.
  for (const b of game.shots) {
    if (b.dead || ship.inv || !touching(ship, b, SHIP_R * 0.7 + b.r)) continue
    b.dead = true
    hurt(game)
  }

  // Rocks hit the ship, or skim past it.
  for (const r of game.rocks) {
    if (r.dead) continue
    const dist = Math.hypot(ship.x - r.x, ship.y - r.y)
    if (dist < r.r + SHIP_R * 0.8) {
      if (ship.inv) continue
      r.dead = true
      burst(game, r.x, r.y, '#ffffff', 10)
      hurt(game)
      continue
    }
    if (!r.nearDone && r.kind !== 'drone' && dist < r.r + SHIP_R + NEAR_GAP) r.nearCheck = true
    // Counted once it has passed, still untouched.
    if (r.nearCheck && !r.nearDone && dist > r.r + SHIP_R + NEAR_GAP + 6) {
      r.nearDone = true
      if (ship.inv) continue // passing through a blinking ship isn't skill
      game.near += 1
      award(game, NEAR_POINTS, 'near')
      popup(game, ship.x + 22, ship.y - 10, 'close!', '#fde68a', 11)
      emit(game, 'near')
    }
  }

  // Energy: builds the combo and charges the Nova.
  for (const o of game.orbs) {
    if (o.dead || !touching(ship, o, o.r + SHIP_R + 4)) continue
    o.dead = true
    game.energy += 1
    const pts = award(game, ENERGY_POINTS * game.combo, 'energy')
    popup(game, o.x, o.y, game.combo > 1 ? `+${pts} x${game.combo}` : `+${pts}`, '#fde047')
    burst(game, o.x, o.y, '#fde047', 10)
    emit(game, 'energy', { combo: game.combo })
    game.combo = Math.min(MAX_COMBO, game.combo + 1)
    game.maxCombo = Math.max(game.maxCombo, game.combo)
    tip(game, 'energy', 'Energy chains a combo up to x5, and charges a Nova bomb.')
    if (!game.bomb && ++game.bombCharge >= BOMB_ENERGY) {
      game.bomb = 1
      game.bombCharge = 0
      popup(game, ship.x, ship.y - 34, 'NOVA READY', '#7df9ff', 15)
      emit(game, 'bombReady')
      tip(game, 'bomb', 'Nova bomb ready: double-tap to blast everything around you.')
    }
  }

  // Power-ups.
  for (const p of game.powerups) {
    if (p.dead || !touching(ship, p, p.r + SHIP_R + 6)) continue
    p.dead = true
    game.powers += 1
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
  if (game.tip && (game.tip.life -= s) <= 0) game.tip = null
  game.shake = Math.max(0, game.shake - 40 * s)

  game.rocks = game.rocks.filter((r) => !r.dead && !outside(game, r))
  game.orbs = game.orbs.filter((o) => !o.dead && !outside(game, o))
  game.powerups = game.powerups.filter((p) => !p.dead && !outside(game, p))
  game.bullets = game.bullets.filter((b) => !b.dead && !outside(game, b, 10))
  game.shots = game.shots.filter((b) => !b.dead && !outside(game, b, 10))
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
    tick(game, total / n, { dx: (input.dx || 0) / n, dy: (input.dy || 0) / n, bomb: i === 0 && input.bomb })
  }
  return game
}

export const result = (game) => ({
  score: game.score,
  durationMs: Math.round(game.t),
  stats: {
    kills: game.kills,
    drones: game.drones,
    energy: game.energy,
    near: game.near,
    hits: game.hits,
    boss: game.bossDown,
    bossHits: game.bossHits,
    maxCombo: game.maxCombo,
    bombs: game.bombs,
    powers: game.powers,
  },
  points: { ...game.points },
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
// The ship's colours; a skin (game.skin, see pilot.js) replaces them.
export const DEFAULT_SKIN = { wing: '#67e8f9', edge: '#22d3ee', hull: '#e0f2fe', cockpit: '#a78bfa', flame: ['#fe5200', '#fde047'] }

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

// The laser: a blinking line while it charges, then a beam across the screen.
function drawLance(ctx, game, lance) {
  const d = DIRS[game.g]
  const live = game.t - lance.at >= LANCE_WARN
  const half = live ? LANCE_HALF : 1.5
  ctx.save()
  // Lanes run along gravity; rotate so the lane is vertical.
  ctx.translate(game.w / 2, game.h / 2)
  ctx.rotate(Math.atan2(d.y, d.x) - Math.PI / 2)
  const x = -lance.lane
  const len = 900
  if (live) {
    ctx.fillStyle = 'rgba(244, 114, 182, 0.35)'
    ctx.fillRect(x - half * 1.8, -len, half * 3.6, len * 2)
    ctx.fillStyle = '#fbcfe8'
    ctx.fillRect(x - half * 0.5, -len, half, len * 2)
  } else {
    ctx.globalAlpha = Math.floor(game.t / 90) % 2 ? 0.9 : 0.35
    ctx.fillStyle = '#f472b6'
    ctx.fillRect(x - half, -len, half * 2, len * 2)
  }
  ctx.restore()
}

function drawBoss(ctx, game, b) {
  const d = DIRS[game.g]
  ctx.save()
  ctx.translate(b.x, b.y)
  ctx.rotate(Math.atan2(d.y, d.x) - Math.PI / 2) // local +y faces the ship's side
  // Saucer body, glow under a sharp edge.
  ctx.beginPath()
  ctx.ellipse(0, 0, b.r * 1.3, b.r * 0.62, 0, 0, Math.PI * 2)
  ctx.fillStyle = b.flash > 0.5 ? '#fbcfe8' : '#2a0f3d'
  ctx.fill()
  ctx.strokeStyle = '#f472b6'
  ctx.globalAlpha = 0.3
  ctx.lineWidth = 9
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.lineWidth = 2.5
  ctx.stroke()
  // Dome on the far side.
  ctx.fillStyle = '#4c1d95'
  ctx.beginPath()
  ctx.arc(0, -b.r * 0.25, b.r * 0.55, Math.PI, 0)
  ctx.fill()
  ctx.strokeStyle = '#c084fc'
  ctx.lineWidth = 2
  ctx.stroke()
  // Running lights.
  for (let i = -2; i <= 2; i++) {
    ctx.fillStyle = Math.floor(game.t / 160 + i) % 2 ? '#fde047' : '#fe5200'
    ctx.fillRect(i * b.r * 0.42 - 2, b.r * 0.12, 4, 4)
  }
  // The core, pulsing toward the ship.
  const pulse = 8 + Math.sin(game.t / 90) * 2
  ctx.fillStyle = b.flash ? '#ffffff' : '#fe5200'
  ctx.beginPath()
  ctx.arc(0, b.r * 0.45, pulse, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawShip(ctx, game, x, y, skin, od) {
  const d = DIRS[game.g]
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(Math.atan2(-d.y, -d.x) + Math.PI / 2 + game.ship.tilt)
  const flame = (od ? 16 : 10) + game.fx() * 8
  ctx.fillStyle = skin.flame[0]
  ctx.beginPath()
  ctx.moveTo(-6, 10)
  ctx.lineTo(0, 10 + flame)
  ctx.lineTo(6, 10)
  ctx.fill()
  ctx.fillStyle = skin.flame[1]
  ctx.beginPath()
  ctx.moveTo(-3, 10)
  ctx.lineTo(0, 10 + flame * 0.55)
  ctx.lineTo(3, 10)
  ctx.fill()
  // Wings, then the hull.
  ctx.fillStyle = od ? '#fdba74' : skin.wing
  ctx.beginPath()
  ctx.moveTo(-4, 2)
  ctx.lineTo(-SHIP_R - 4, SHIP_R + 2)
  ctx.lineTo(-4, SHIP_R - 2)
  ctx.moveTo(4, 2)
  ctx.lineTo(SHIP_R + 4, SHIP_R + 2)
  ctx.lineTo(4, SHIP_R - 2)
  ctx.fill()
  ctx.fillStyle = skin.hull
  ctx.strokeStyle = od ? '#fe5200' : skin.edge
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, -SHIP_R - 5)
  ctx.lineTo(SHIP_R * 0.7, SHIP_R)
  ctx.lineTo(0, SHIP_R - 5)
  ctx.lineTo(-SHIP_R * 0.7, SHIP_R)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = skin.cockpit
  ctx.beginPath()
  ctx.arc(0, -3, 3.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function draw(ctx, game) {
  const { w, h } = game
  const d = DIRS[game.g]
  ctx.save()
  if (game.shake && !game.calm) ctx.translate((game.fx() - 0.5) * game.shake, (game.fx() - 0.5) * game.shake)

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

  if (game.boss?.lance) drawLance(ctx, game, game.boss.lance)

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
  if (game.boss) drawBoss(ctx, game, game.boss)

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

  // Enemy fire: pink with a white core, so it reads apart from everything friendly.
  for (const b of game.shots) {
    ctx.fillStyle = 'rgba(244, 114, 182, 0.45)'
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff1f8'
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r * 0.6, 0, Math.PI * 2)
    ctx.fill()
  }

  for (const p of game.sparks) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life))
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  ctx.globalAlpha = 1

  // The Nova's ring.
  if (game.nova) {
    ctx.strokeStyle = `rgba(125, 249, 255, ${Math.max(0, 1 - game.nova.r / 480)})`
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(game.nova.x, game.nova.y, game.nova.r, 0, Math.PI * 2)
    ctx.stroke()
  }

  const skin = game.skin || DEFAULT_SKIN
  // Ship: points against gravity, leans into turns, flame trails with gravity. Blinks while recovering.
  const ship = game.ship
  if (!ship.inv || Math.floor(ship.inv / 100) % 2 === 0) {
    if (ship.shield) {
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(ship.x, ship.y, SHIP_R + 9 + Math.sin(game.t / 120) * 1.5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = 'rgba(34, 211, 238, 0.1)'
      ctx.fill()
    }
    drawShip(ctx, game, ship.x, ship.y, skin, game.power.overdrive > 0)
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

  // Full-screen tints (hit, shift, surge, bomb), and the Surge's glowing edge.
  if (!game.calm) {
    for (const f of game.flashes) {
      ctx.fillStyle = `rgba(${f.color}, ${Math.max(0, f.life) * 0.22})`
      ctx.fillRect(-20, -20, w + 40, h + 40)
    }
  }
  if (game.surge) {
    ctx.strokeStyle = `rgba(254, 82, 0, ${0.35 + Math.sin(game.t / 140) * 0.2})`
    ctx.lineWidth = 6
    ctx.strokeRect(0, 0, w, h)
  }

  // A first-timer's tip, in a box near the bottom.
  if (game.tip) {
    ctx.globalAlpha = Math.min(1, game.tip.life * 2)
    ctx.font = '600 12px Poppins, system-ui, sans-serif'
    const tw = Math.min(w - 32, ctx.measureText(game.tip.text).width + 24)
    ctx.fillStyle = 'rgba(17, 10, 46, 0.88)'
    ctx.fillRect((w - tw) / 2, h - 74, tw, 30)
    ctx.strokeStyle = '#7df9ff'
    ctx.lineWidth = 1
    ctx.strokeRect((w - tw) / 2, h - 74, tw, 30)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.fillText(game.tip.text, w / 2, h - 54, w - 44)
    ctx.globalAlpha = 1
  }
}
