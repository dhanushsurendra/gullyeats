// Run with: node --test src/game
import { test } from 'node:test'
import assert from 'node:assert'

import { createGame, istDay, LIMITS, MAX_HITS, ROUND_MS, result, seedFor, step } from './nebula.js'

// Play a whole round at 60 fps with a scripted finger; log every rock spawned.
function play(seed, move = () => ({})) {
  const game = createGame(seed, { width: 390, height: 844 })
  const spawns = []
  game.onSpawn = (r, t) => spawns.push(`${Math.round(t)}:${r.x.toFixed(2)},${r.y.toFixed(2)},${r.r.toFixed(2)}`)
  while (!game.over) step(game, 16.7, move(game))
  return { game, spawns }
}

const still = () => ({})
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
  for (let i = 1; i <= 30; i++) {
    const r = result(play(seedFor(`2026-12-${i}`), weaver).game)
    assert.ok(r.score > 0)
    assert.ok(r.score <= LIMITS.maxScore)
    assert.ok(r.kills <= LIMITS.maxKills)
    assert.ok(r.energy <= LIMITS.maxEnergy)
    assert.ok(r.score <= r.kills * LIMITS.killPoints + r.energy * LIMITS.energyPoints)
    assert.ok(r.durationMs >= 1000 && r.durationMs <= 47000)
  }
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
