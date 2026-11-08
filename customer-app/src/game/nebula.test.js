// Run with: node --test src/game
import { test } from 'node:test'
import assert from 'node:assert'

import { createGame, ENERGY_POINTS, istDay, LIMITS, MAX_COMBO, MAX_HITS, ROUND_MS, result, seedFor, step, SURGE_AT, SURGE_MULTIPLIER } from './nebula.js'

// Play a whole round at 60 fps with a scripted finger; log every rock spawned.
function play(seed, move = () => ({})) {
  const game = createGame(seed, { width: 390, height: 844 })
  const spawns = []
  game.onSpawn = (r, t) => spawns.push(`${Math.round(t)}:${r.x.toFixed(2)},${r.y.toFixed(2)},${r.r.toFixed(2)}`)
  game.log = []
  while (!game.over) {
    step(game, 16.7, move(game))
    game.log.push(...game.events)
    game.events.length = 0
  }
  return { game, spawns }
}

const still = () => ({})
// Steps away from the nearest rock, else heads for power-ups and energy.
const dodger = (g) => {
  const s = g.ship
  let near = null
  let dist = 1e9
  for (const r of g.rocks) {
    const d = Math.hypot(r.x - s.x, r.y - s.y)
    if (d < dist) [dist, near] = [d, r]
  }
  if (near && dist < 70) return { dx: Math.sign(s.x - near.x) * 6, dy: Math.sign(s.y - near.y) * 6 }
  const p = g.powerups[0] || g.orbs[0]
  if (p) return { dx: Math.sign(p.x - s.x) * 3, dy: Math.sign(p.y - s.y) * 3 }
  return near ? { dx: Math.sign(near.x - s.x) * 3, dy: 0 } : {}
}
// A player who chases the nearest orb, else sways.
const weaver = (g) => {
  const o = g.orbs[0]
  if (o) return { dx: Math.sign(o.x - g.ship.x) * 4, dy: Math.sign(o.y - g.ship.y) * 4 }
  return { dx: Math.sin(g.t / 400) * 5, dy: 0 }
}

test('the same day gives everyone the same rocks, whatever they do', () => {
  const day = seedFor('2026-11-09')
  const a = play(day, weaver)
  const b = play(day, still)
  // Compare the rocks both players saw (one round may end early on hits).
  const n = Math.min(a.spawns.length, b.spawns.length)
  assert.ok(n > 20)
  assert.deepStrictEqual(a.spawns.slice(0, n), b.spawns.slice(0, n))
  assert.notDeepStrictEqual(play(seedFor('2026-11-10'), still).spawns.slice(0, 10), a.spawns.slice(0, 10))
})

test('a round ends at 45 s or after three hits', () => {
  for (const mv of [still, weaver]) {
    const { game } = play(seedFor('2026-11-09'), mv)
    assert.ok(game.over)
    assert.ok(game.t <= ROUND_MS)
    assert.ok(game.t === ROUND_MS || game.hits >= MAX_HITS)
  }
})

test('scores stay inside what the server accepts', () => {
  const L = LIMITS
  assert.strictEqual(L.energyPoints, ENERGY_POINTS * MAX_COMBO)
  assert.strictEqual(L.surge, SURGE_MULTIPLIER)
  for (let i = 1; i <= 30; i++) {
    for (const mv of [weaver, dodger]) {
      const { score, durationMs, stats: r } = result(play(seedFor(`2026-12-${i}`), mv).game)
      assert.ok(score > 0)
      assert.ok(score <= L.maxScore)
      assert.ok(r.kills <= L.maxKills && r.drones <= L.maxDrones && r.energy <= L.maxEnergy && r.near <= L.maxNear)
      assert.ok(score <= L.surge * (r.kills * L.killPoints + r.drones * L.dronePoints + r.energy * L.energyPoints + r.near * L.nearPoints))
      assert.ok(durationMs >= 1000 && durationMs <= 47000)
    }
  }
})

test('a careful pilot survives the round and meets drones, comets, power-ups and the Surge', () => {
  const { game } = play(seedFor('2026-11-09'), dodger)
  assert.strictEqual(game.t, ROUND_MS)
  const seen = new Set(game.log.map((e) => e.type))
  for (const type of ['shoot', 'boom', 'comet', 'drone', 'power', 'energy', 'warn', 'shift', 'surge', 'over']) assert.ok(seen.has(type), type)
})

test('the Surge doubles points', () => {
  const g = createGame(1)
  g.t = SURGE_AT + 1
  g.surge = true
  g.orbs.push({ x: g.ship.x, y: g.ship.y, vx: 0, vy: 0, r: 9, a: 0 })
  step(g, 16)
  assert.strictEqual(g.score, ENERGY_POINTS * SURGE_MULTIPLIER)
})

test('a shield soaks one hit', () => {
  const g = createGame(1)
  g.fireAt = 1e9 // no shots, or they'd break the test rock before it lands
  g.ship.shield = true
  const rock = () => ({ kind: 'rock', x: g.ship.x, y: g.ship.y, vx: 0, vy: 0, r: 12, hp: 1, a: 0, spin: 0, shape: [12], hue: 'cyan' })
  g.rocks.push(rock())
  step(g, 16)
  assert.strictEqual(g.hits, 0)
  assert.strictEqual(g.ship.shield, false)
  g.ship.inv = 0
  g.rocks.push(rock())
  step(g, 16)
  assert.strictEqual(g.hits, 1)
})

test('a slow frame does not fast-forward the round', () => {
  const game = createGame(1)
  step(game, 5000)
  assert.ok(game.t < 100.01)
})

test('istDay rolls over at IST midnight', () => {
  assert.strictEqual(istDay(Date.parse('2026-11-08T18:29:00Z')), '2026-11-08')
  assert.strictEqual(istDay(Date.parse('2026-11-08T18:31:00Z')), '2026-11-09')
})
