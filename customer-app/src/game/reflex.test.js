// Run with: node --test "src/game/*.test.js"
import { test } from 'node:test'
import assert from 'node:assert'

import { createGame, currentRule, LIMITS, result, ROUND_MS, seedFor, step, tap, wanted } from './reflex.js'

// Play a round at 60 fps. `player(game)` returns taps [{ x, y }] for this frame.
function play(seed, player = () => []) {
  const game = createGame(seed, { width: 390, height: 844 })
  while (!game.over) {
    step(game, 16.7)
    for (const t of player(game)) tap(game, t.x, t.y)
  }
  return game
}

// Taps every right target once it has been up `delay` ms; never taps in a freeze.
const pro = (delay) => (g) =>
  g.targets.filter((t) => wanted(currentRule(g), t) && g.t - t.born >= delay).map((t) => ({ x: t.x, y: t.y }))
// Taps everything it sees.
const masher = (g) => g.targets.map((t) => ({ x: t.x, y: t.y }))

test('the same day gives everyone the same rules', () => {
  const a = createGame(seedFor('2026-11-09'))
  const b = createGame(seedFor('2026-11-09'))
  const c = createGame(seedFor('2026-11-10'))
  assert.deepStrictEqual(a.rules, b.rules)
  assert.notDeepStrictEqual(a.rules, c.rules)
  assert.ok(a.rules.at(-1).end === ROUND_MS)
  assert.ok(a.rules[0].kind !== 'freeze')
  for (let i = 1; i < 60; i++) {
    const { rules } = createGame(seedFor(`2027-02-${i}`))
    rules.slice(1).forEach((r, k) => {
      const p = rules[k]
      assert.ok(!(r.kind === p.kind && r.color === p.color && r.shape === p.shape), 'a rule repeats')
    })
    assert.ok(rules.at(-1).end - rules.at(-1).start >= 1500, 'a sliver of a rule at the end')
  }
})

test('a fast, careful player scores well and holds every freeze', () => {
  for (let i = 1; i <= 20; i++) {
    const g = play(seedFor(`2026-12-${i}`), pro(300))
    const r = result(g)
    assert.ok(g.over && r.durationMs === ROUND_MS)
    assert.strictEqual(r.stats.wrong, 0)
    assert.strictEqual(r.stats.missed, 0)
    assert.strictEqual(r.stats.holds, g.rules.filter((x) => x.kind === 'freeze').length)
    assert.ok(r.stats.hits > 10)
    assert.ok(r.stats.avgMs >= 300 && r.stats.avgMs < 340)
  }
})

test('slower taps score less; tapping everything scores least', () => {
  const seed = seedFor('2026-11-09')
  const fast = result(play(seed, pro(300))).score
  const slow = result(play(seed, pro(700))).score
  const mash = result(play(seed, masher))
  assert.ok(fast > slow, `${fast} > ${slow}`)
  assert.ok(slow > mash.score, `${slow} > ${mash.score}`)
  assert.ok(mash.stats.wrong > 5)
})

test('doing nothing misses targets and only earns the freeze bonuses', () => {
  const g = play(seedFor('2026-11-09'))
  const r = result(g)
  assert.strictEqual(r.stats.hits, 0)
  assert.ok(r.stats.missed > 10)
  assert.strictEqual(r.score, r.stats.holds * 100)
})

test('scores stay inside what the server accepts', () => {
  for (let i = 1; i <= 30; i++) {
    for (const player of [pro(120), pro(400), masher]) {
      const { score, durationMs, stats } = result(play(seedFor(`2027-01-${i}`), player))
      assert.ok(score <= LIMITS.maxScore)
      assert.ok(stats.hits <= LIMITS.maxHits)
      assert.ok(stats.holds <= LIMITS.maxHolds)
      assert.ok(score <= stats.hits * LIMITS.hitPoints + stats.holds * LIMITS.holdPoints)
      assert.ok(durationMs <= 22000)
    }
  }
})

test('tapping in a freeze costs points and the bonus', () => {
  const g = createGame(seedFor('2026-11-09'))
  const freeze = g.rules.find((x) => x.kind === 'freeze')
  assert.ok(freeze, 'this seed has a freeze')
  while (g.t < freeze.start + 1000) step(g, 16.7)
  g.score = 500
  assert.strictEqual(tap(g, 10, 10), 'wrong')
  assert.strictEqual(g.score, 440)
  while (g.t < freeze.end + 20) step(g, 16.7)
  assert.strictEqual(g.holds, 0)
})
