// Run with: node --test src/game
import { test } from 'node:test'
import assert from 'node:assert'

import { ANOMALIES, anomalyFor, BOSS_AT, BOSS_HP, BOSS_POINTS, createGame, ENERGY_POINTS, istDay, LIMITS, MAX_COMBO, MAX_HITS, ROUND_MS, result, seedFor, step, SURGE_AT, SURGE_MULTIPLIER } from './nebula.js'

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
  for (const r of [...g.rocks, ...g.shots, ...(g.boss ? [g.boss] : [])]) {
    const d = Math.hypot(r.x - s.x, r.y - s.y) - (r.r || 0)
    if (d < dist) [dist, near] = [d, r]
  }
  const bomb = g.bomb && (g.boss || g.rocks.length > 7)
  if (near && dist < 60) return { dx: Math.sign(s.x - near.x) * 6, dy: Math.sign(s.y - near.y) * 6, bomb }
  const p = g.powerups[0] || g.orbs[0]
  if (p) return { dx: Math.sign(p.x - s.x) * 3, dy: Math.sign(p.y - s.y) * 3, bomb }
  return near ? { dx: Math.sign(near.x - s.x) * 3, dy: 0, bomb } : { bomb }
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
  const b = play(day, dodger)
  // Compare the rocks both players saw (one round may end early on hits).
  const n = Math.min(a.spawns.length, b.spawns.length)
  assert.ok(n > 15)
  assert.deepStrictEqual(a.spawns.slice(0, n), b.spawns.slice(0, n))
  assert.notDeepStrictEqual(play(seedFor('2026-11-10'), still).spawns.slice(0, 10), a.spawns.slice(0, 10))
})

test('a round ends at 55 s or after three hits', () => {
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
  assert.strictEqual(L.maxBossHits, BOSS_HP)
  assert.strictEqual(L.bossPoints, BOSS_POINTS)
  let top = 0
  for (let i = 1; i <= 30; i++) {
    for (const mv of [weaver, dodger]) {
      const { score, durationMs, stats: r } = result(play(seedFor(`2026-12-${i}`), mv).game)
      assert.ok(score > 0)
      assert.ok(score <= L.maxScore)
      assert.ok(r.kills <= L.maxKills && r.drones <= L.maxDrones && r.energy <= L.maxEnergy && r.near <= L.maxNear)
      assert.ok(r.boss <= 1 && r.bossHits <= L.maxBossHits)
      assert.ok(score <= L.surge * (r.kills * L.killPoints + r.drones * L.dronePoints + r.energy * L.energyPoints + r.near * L.nearPoints + r.bossHits * L.bossHitPoints + r.boss * L.bossPoints))
      assert.ok(durationMs >= 1000 && durationMs <= 57000)
      top = Math.max(top, score)
    }
  }
  console.log(`best bot score over 60 rounds: ${top}`)
})

test('a careful pilot reaches the Mothership and meets everything on the way', () => {
  const seen = new Set()
  let reached = 0
  for (let i = 1; i <= 10; i++) {
    const { game } = play(seedFor(`2026-11-${10 + i}`), dodger)
    if (game.t >= BOSS_AT + 3000) reached += 1
    for (const e of game.log) seen.add(e.type)
  }
  assert.ok(reached >= 5, `reached the boss in ${reached}/10`)
  for (const type of ['shoot', 'boom', 'comet', 'drone', 'enemyShot', 'power', 'energy', 'bombReady', 'bomb', 'warn', 'shift', 'sector', 'surge', 'bossIn', 'laserWarn', 'over'])
    assert.ok(seen.has(type), type)
})

test('every anomaly turns up, the same for everyone on a day', () => {
  const seen = new Set()
  for (let i = 0; i < 200; i++) seen.add(anomalyFor(seedFor(`day-${i}`)))
  assert.deepStrictEqual([...seen].sort(), Object.keys(ANOMALIES).sort())
  assert.strictEqual(createGame(seedFor('2026-11-09')).anomaly, anomalyFor(seedFor('2026-11-09')))
})

test('the Mothership arrives on time, stops gravity turning, and pays for a kill', () => {
  const g = createGame(1)
  g.fireAt = 1e9
  g.ship.inv = 1e9 // can't be hit in this test
  while (g.t < BOSS_AT + 100) step(g, 16, { dx: 0, dy: 0 })
  assert.ok(g.boss)
  const turnsBefore = g.g
  while (g.t < ROUND_MS - 100 && g.boss) step(g, 16)
  assert.strictEqual(g.g, turnsBefore)
  assert.strictEqual(g.nextG, null)

  const k = createGame(2)
  k.t = BOSS_AT - 1
  k.fireAt = 1e9
  k.flipAt = 1e9 // jumped past the turns
  step(k, 16)
  k.boss.enter = 1
  k.boss.hp = 1
  step(k, 1) // moves it into place
  const before = k.score
  k.bullets.push({ x: k.boss.x, y: k.boss.y, vx: 0, vy: 0 })
  step(k, 16)
  assert.strictEqual(k.boss, null)
  assert.strictEqual(k.bossDown, 1)
  assert.strictEqual(k.score - before, (BOSS_POINTS + 5) * SURGE_MULTIPLIER)
  assert.strictEqual(k.shots.length, 0)
})

test('a Nova bomb clears enemy fire, destroys rocks and dents the boss', () => {
  const g = createGame(3)
  g.t = BOSS_AT - 1
  g.fireAt = 1e9
  g.flipAt = 1e9 // jumped past the turns
  step(g, 16)
  g.boss.enter = 1
  g.bomb = 1
  g.ship.inv = 1e9
  const hp = g.boss.hp
  g.shots.push({ x: g.ship.x + 40, y: g.ship.y, vx: 0, vy: 0, r: 5 })
  g.rocks.push({ kind: 'rock', x: g.ship.x - 60, y: g.ship.y, vx: 0, vy: 0, r: 12, hp: 1, a: 0, spin: 0, shape: [12], hue: 'cyan' })
  for (let i = 0; i < 60; i++) step(g, 16, { bomb: i === 0 })
  assert.strictEqual(g.bomb, 0)
  assert.strictEqual(g.bombs, 1)
  assert.strictEqual(g.shots.filter((b) => Math.hypot(b.x - g.ship.x, b.y - g.ship.y) < 50 && b.vx === 0).length, 0)
  assert.ok(g.kills >= 1)
  assert.ok(g.boss.hp <= hp - 25)
  // No bomb held: a double-tap does nothing.
  step(g, 16, { bomb: true })
  assert.strictEqual(g.bombs, 1)
})

test('eight energy charges a bomb', () => {
  const g = createGame(4)
  g.fireAt = 1e9
  for (let i = 0; i < 8; i++) {
    g.orbs.push({ x: g.ship.x, y: g.ship.y, vx: 0, vy: 0, r: 9, a: 0 })
    step(g, 16)
  }
  assert.strictEqual(g.bomb, 1)
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
