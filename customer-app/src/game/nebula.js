/*
 * Nebula Rush: the game itself, with no React. The page owns the canvas, the
 * loop and the screens; this file owns the rules.
 *
 *   const game = createGame(seed, { width, height })
 *   step(game, dtMs, { dx, dy })   // dx/dy: how far the finger moved, in world units
 *   draw(ctx, game)               // ctx already scaled to world units
 *
 * The world is 360 units wide. Rocks fall the way gravity points; gravity
 * turns every 10 s (with a warning). The ship fires on its own, against
 * gravity, at the rocks coming in. Energy orbs build a combo. 45 s, or three
 * hits, ends the round.
 *
 * Everything the player meets (rocks, orbs, gravity turns) comes from `seed`
 * and the clock only, never from what the player does, so one seed per day
 * gives everyone the same daily challenge.
 */

export const WORLD_WIDTH = 360
export const ROUND_MS = 45000
export const MAX_HITS = 3
export const KILL_POINTS = { big: 20, small: 10 }
export const ENERGY_POINTS = 25
export const MAX_COMBO = 5
// Ceilings the server checks against (backend/controllers/gameController.js
// GAMES.nebula). The spawn schedule below can't produce more than these.
// energyPoints = ENERGY_POINTS x MAX_COMBO.
export const LIMITS = { maxScore: 20000, maxKills: 400, maxEnergy: 40, killPoints: 20, energyPoints: 125 }

const FLIP_EVERY = 10000
const FLIP_WARNING = 1500
const FIRE_EVERY = 180
const ORB_EVERY = 2600
const INVULNERABLE_MS = 1200
const SHIP_R = 13
const BULLET_SPEED = 620
const GRAVITY = 260 // how hard rocks bend toward a new gravity
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
  const fx = rng(seed ^ 0x9e3779b9) // looks only (sparks, stars): never changes play
  const stars = Array.from({ length: 70 }, () => ({ x: fx() * w, y: fx() * h, z: 0.3 + fx() * 0.9 }))
  return {
    w,
    h,
    seed,
    rand: rng(seed),
    fx,
    t: 0,
    over: false,
    score: 0,
    kills: 0,
    energy: 0,
    hits: 0,
    combo: 1,
    ship: { x: w / 2, y: h * 0.78, inv: 0 },
    g: 0, // index into DIRS
    nextG: null, // the turn being warned about
    flipAt: FLIP_EVERY,
    spawnAt: 600,
    orbAt: ORB_EVERY,
    fireAt: 0,
    rocks: [],
    bullets: [],
    orbs: [],
    sparks: [],
    popups: [],
    stars,
    shake: 0,
  }
}

export const gravityOf = (game) => DIRS[game.g]

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

function spawnOrb(game) {
  const { rand } = game
  const d = DIRS[game.g]
  const at = upstream(game, 0.12 + rand() * 0.76)
  game.orbs.push({ x: at.x, y: at.y, vx: d.x * 95, vy: d.y * 95, r: 9, a: 0 })
}

function burst(game, x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = game.fx() * Math.PI * 2
    const s = 40 + game.fx() * 160
    game.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color })
  }
}

function popup(game, x, y, text, color) {
  game.popups.push({ x, y, text, color, life: 1 })
}

const outside = (game, o, pad = 60) => o.x < -pad || o.x > game.w + pad || o.y < -pad || o.y > game.h + pad
const touching = (a, b, r) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < r * r

function tick(game, dt, input) {
  const s = dt / 1000
  game.t += dt
  const d = DIRS[game.g]

  // Gravity turns: warn first, then turn. The next direction is one of the other three.
  if (game.nextG === null && game.t >= game.flipAt - FLIP_WARNING) {
    game.nextG = (game.g + 1 + Math.floor(game.rand() * 3)) % 4
  }
  if (game.t >= game.flipAt) {
    game.g = game.nextG
    game.nextG = null
    game.flipAt += FLIP_EVERY
    game.shake = 6
  }

  // Ship follows the finger (relative drag), stays on screen.
  const ship = game.ship
  ship.x = clamp(ship.x + (input?.dx || 0), SHIP_R, game.w - SHIP_R)
  ship.y = clamp(ship.y + (input?.dy || 0), SHIP_R, game.h - SHIP_R)
  ship.inv = Math.max(0, ship.inv - dt)

  // Auto-fire against gravity: a slight three-way spread, so near misses still land.
  if (game.t >= game.fireAt) {
    game.fireAt = game.t + FIRE_EVERY
    const base = Math.atan2(-d.y, -d.x)
    for (const k of [-0.13, 0, 0.13]) {
      const a = base + k
      game.bullets.push({ x: ship.x, y: ship.y, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED })
    }
  }

  // Spawning speeds up through the round.
  while (game.t >= game.spawnAt) {
    spawnRock(game)
    game.spawnAt += lerp(800, 400, game.t / ROUND_MS)
  }
  while (game.t >= game.orbAt) {
    spawnOrb(game)
    game.orbAt += ORB_EVERY
  }

  // Move. Rocks and orbs bend toward the current gravity.
  for (const r of game.rocks) {
    r.vx += d.x * GRAVITY * s
    r.vy += d.y * GRAVITY * s
    const sp = Math.hypot(r.vx, r.vy)
    const max = 300
    if (sp > max) {
      r.vx *= max / sp
      r.vy *= max / sp
    }
    r.x += r.vx * s
    r.y += r.vy * s
    r.a += r.spin * s
  }
  for (const o of game.orbs) {
    o.vx = lerp(o.vx, d.x * 95, Math.min(1, 2 * s))
    o.vy = lerp(o.vy, d.y * 95, Math.min(1, 2 * s))
    o.x += o.vx * s
    o.y += o.vy * s
    o.a += s
  }
  for (const b of game.bullets) {
    b.x += b.vx * s
    b.y += b.vy * s
  }

  // Bullets hit rocks. Big rocks take three hits and split in two.
  for (const b of game.bullets) {
    for (const r of game.rocks) {
      if (r.dead || !touching(b, r, r.r + 3)) continue
      b.dead = true
      r.hp -= 1
      if (r.hp > 0) {
        burst(game, b.x, b.y, '#9be7ff', 3)
        break
      }
      r.dead = true
      game.kills += 1
      const pts = r.big ? KILL_POINTS.big : KILL_POINTS.small
      game.score += pts
      popup(game, r.x, r.y, `+${pts}`, '#7df9ff')
      burst(game, r.x, r.y, r.hue === 'cyan' ? '#22d3ee' : '#a78bfa', r.big ? 14 : 8)
      if (r.big) {
        // Fixed split (no random numbers), so play can't change what spawns next.
        const side = { x: -r.vy, y: r.vx }
        const len = Math.hypot(side.x, side.y) || 1
        for (const k of [-1, 1]) {
          game.rocks.push({
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
      break
    }
  }

  // Rocks hit the ship.
  if (!ship.inv) {
    for (const r of game.rocks) {
      if (r.dead || !touching(ship, r, r.r + SHIP_R * 0.8)) continue
      r.dead = true
      game.hits += 1
      game.combo = 1
      ship.inv = INVULNERABLE_MS
      game.shake = 12
      burst(game, ship.x, ship.y, '#fe5200', 18)
      popup(game, ship.x, ship.y - 24, 'HIT', '#ff6b6b')
      break
    }
  }

  // Energy.
  for (const o of game.orbs) {
    if (o.dead || !touching(ship, o, o.r + SHIP_R + 4)) continue
    o.dead = true
    game.energy += 1
    const pts = ENERGY_POINTS * game.combo
    game.score += pts
    popup(game, o.x, o.y, game.combo > 1 ? `+${pts} x${game.combo}` : `+${pts}`, '#fde047')
    burst(game, o.x, o.y, '#fde047', 10)
    game.combo = Math.min(MAX_COMBO, game.combo + 1)
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
    p.life -= s * 1.4
  }
  game.shake = Math.max(0, game.shake - 40 * s)

  game.rocks = game.rocks.filter((r) => !r.dead && !outside(game, r))
  game.orbs = game.orbs.filter((o) => !o.dead && !outside(game, o))
  game.bullets = game.bullets.filter((b) => !b.dead && !outside(game, b, 10))
  game.sparks = game.sparks.filter((p) => p.life > 0)
  game.popups = game.popups.filter((p) => p.life > 0)

  if (game.hits >= MAX_HITS || game.t >= ROUND_MS) {
    game.t = Math.min(game.t, ROUND_MS)
    game.over = true
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
  stats: { kills: game.kills, energy: game.energy, hits: game.hits },
})

// ---- Drawing ---------------------------------------------------------------

const ROCK_COLORS = {
  cyan: { fill: '#0e2a3d', edge: '#22d3ee' },
  violet: { fill: '#24154a', edge: '#a78bfa' },
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

export function draw(ctx, game) {
  const { w, h } = game
  const d = DIRS[game.g]
  ctx.save()
  if (game.shake) ctx.translate((game.fx() - 0.5) * game.shake, (game.fx() - 0.5) * game.shake)

  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#070b1f')
  bg.addColorStop(0.6, '#110a2e')
  bg.addColorStop(1, '#1c0b33')
  ctx.fillStyle = bg
  ctx.fillRect(-20, -20, w + 40, h + 40)

  // Stars stream with gravity, nearer ones faster.
  ctx.fillStyle = '#c7d2fe'
  for (const st of game.stars) {
    const x = (((st.x + d.x * game.t * 0.05 * st.z) % w) + w) % w
    const y = (((st.y + d.y * game.t * 0.05 * st.z) % h) + h) % h
    ctx.globalAlpha = 0.25 + st.z * 0.5
    ctx.fillRect(x, y, st.z * 2, st.z * 2)
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
    ctx.fillStyle = '#fde047'
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

  for (const r of game.rocks) {
    const c = ROCK_COLORS[r.hue]
    ctx.save()
    ctx.translate(r.x, r.y)
    ctx.rotate(r.a)
    ctx.beginPath()
    r.shape.forEach((rad, i) => {
      const a = (i / r.shape.length) * Math.PI * 2
      if (i) ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad)
      else ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad)
    })
    ctx.closePath()
    ctx.fillStyle = c.fill
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

  ctx.strokeStyle = '#7df9ff'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (const b of game.bullets) {
    ctx.moveTo(b.x, b.y)
    ctx.lineTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018)
  }
  ctx.stroke()

  // Ship: points against gravity, flame trails with it. Blinks while recovering from a hit.
  const ship = game.ship
  if (!ship.inv || Math.floor(ship.inv / 100) % 2 === 0) {
    ctx.save()
    ctx.translate(ship.x, ship.y)
    ctx.rotate(Math.atan2(-d.y, -d.x) + Math.PI / 2)
    const flame = 10 + game.fx() * 8
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
    ctx.fillStyle = '#e0f2fe'
    ctx.strokeStyle = '#22d3ee'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, -SHIP_R - 4)
    ctx.lineTo(SHIP_R, SHIP_R)
    ctx.lineTo(0, SHIP_R - 5)
    ctx.lineTo(-SHIP_R, SHIP_R)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#a78bfa'
    ctx.beginPath()
    ctx.arc(0, -2, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  for (const p of game.sparks) {
    ctx.globalAlpha = Math.max(0, p.life)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3)
  }
  ctx.textAlign = 'center'
  ctx.font = '700 13px Poppins, system-ui, sans-serif'
  for (const p of game.popups) {
    ctx.globalAlpha = Math.max(0, p.life)
    ctx.fillStyle = p.color
    ctx.fillText(p.text, p.x, p.y)
  }
  ctx.globalAlpha = 1
  ctx.restore()
}
