// Run with: node --test "src/game/*.test.js"
import { test } from 'node:test'
import assert from 'node:assert'

import { createGame, currentRule, LIMITS, result, ROUND_MS, seedFor, step, SURGE_AT, tap, TWISTS, twistFor, wanted } from './reflex.js'

// Play a round at 60 fps. `player(game)` returns taps [{ x, y }] for this frame.
function play(seed, player = () => []) {
  const game = createGame(seed, { width: 390, height: 844 })
  while (!game.over) {
    step(game, 16.7)
    for (const t of player(game)) tap(game, t.x, t.y)
  }
  return game
}

// The first day from 2027-01-01 with this twist.
function dayWith(twist) {
  for (let i = 0; i < 400; i++) {
    const day = new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10)
    if (twistFor(seedFor(day)) === twist) return seedFor(day)
  }
  throw new Error(`no ${twist} day`)
}

// Taps every right target (golden stars too) once it has been up `delay` ms; never taps in a freeze.
const pro = (delay) => (g) =>
  g.targets.filter((t) => wanted(currentRule(g), t) && g.t - t.born >= delay).map((t) => ({ x: t.x, y: t.y }))
// Taps everything it sees, at a human 300 ms.
const masher = (g) => g.targets.filter((t) => g.t - t.born >= 300).map((t) => ({ x: t.x, y: t.y }))

test('the same day gives everyone the same rules and twist', () => {
  const a = createGame(seedFor('2026-11-09'))
  const b = createGame(seedFor('2026-11-09'))
  const c = createGame(seedFor('2026-11-10'))
  assert.deepStrictEqual([a.rules, a.twist], [b.rules, b.twist])
  assert.notDeepStrictEqual(a.rules, c.rules)
  assert.ok(a.rules.at(-1).end === ROUND_MS)
  assert.ok(a.rules[0].kind !== 'freeze')
  const twists = new Set()
  const kinds = new Set()
  for (let i = 1; i < 60; i++) {
    const g = createGame(seedFor(`2027-02-${i}`))
    twists.add(g.twist)
    const { rules } = g
    rules.forEach((r) => kinds.add(r.kind))
    rules.slice(1).forEach((r, k) => {
      const p = rules[k]
      assert.ok(!(r.kind === p.kind && r.color === p.color && r.shape === p.shape), 'a rule repeats')
    })
    // The harder rules wait until the player has warmed up.
    assert.ok(rules.filter((r) => r.start < 8000).every((r) => !['both', 'notShape'].includes(r.kind)))
    assert.ok(rules.at(-1).end - rules.at(-1).start >= 1500, 'a sliver of a rule at the end')
  }
  assert.deepStrictEqual([...twists].sort(), Object.keys(TWISTS).sort())
  assert.deepStrictEqual([...kinds].sort(), ['both', 'color', 'freeze', 'not', 'notShape', 'shape'])
})

test('"both" rules need the colour and the shape; "anything but" a shape works too', () => {
  assert.ok(wanted({ kind: 'both', color: 'cyan', shape: 'triangle' }, { color: 'cyan', shape: 'triangle' }))
  assert.ok(!wanted({ kind: 'both', color: 'cyan', shape: 'triangle' }, { color: 'cyan', shape: 'circle' }))
  assert.ok(!wanted({ kind: 'both', color: 'cyan', shape: 'triangle' }, { color: 'orange', shape: 'triangle' }))
  assert.ok(wanted({ kind: 'notShape', shape: 'square' }, { color: 'cyan', shape: 'circle' }))
  assert.ok(!wanted({ kind: 'notShape', shape: 'square' }, { color: 'cyan', shape: 'square' }))
  assert.ok(wanted({ kind: 'color', color: 'cyan' }, { gold: true }))
  assert.ok(!wanted({ kind: 'freeze' }, { gold: true }))
})

test('a fast, careful player scores well, holds every freeze and catches golden stars', () => {
  for (let i = 1; i <= 20; i++) {
    const g = play(seedFor(`2026-12-${i}`), pro(300))
    const r = result(g)
    assert.ok(g.over && r.durationMs === ROUND_MS)
    assert.strictEqual(r.stats.wrong, 0)
    assert.strictEqual(r.stats.missed, 0)
    assert.strictEqual(r.stats.holds, g.rules.filter((x) => x.kind === 'freeze').length)
    assert.strictEqual(r.stats.golds, g.rules.filter((x) => x.goldAt).length)
    assert.ok(r.stats.hits > 20)
    assert.ok(r.stats.avgMs >= 300 && r.stats.avgMs < 340)
  }
})

test('slower taps score less; tapping everything at the same speed scores less too', () => {
  for (const twist of Object.keys(TWISTS)) {
    const seed = dayWith(twist)
    const fast = result(play(seed, pro(300))).score
    const slow = result(play(seed, pro(550))).score
    const mash = result(play(seed, masher))
    assert.ok(fast > slow, `${twist}: ${fast} > ${slow}`)
    assert.ok(fast > mash.score * 1.3, `${twist}: ${fast} > ${mash.score}`)
    assert.ok(mash.stats.wrong > 5)
  }
})

test('the Surge doubles points in the last 5 seconds', () => {
  const g = createGame(seedFor('2026-11-09'))
  const player = pro(300)
  let checked = 0
  while (!g.over) {
    step(g, 16.7)
    for (const t of player(g)) {
      const before = g.score
      if (tap(g, t.x, t.y) !== 'right') continue
      const ms = g.reactions.at(-1)
      const mult = g.streak >= 10 ? 3 : g.streak >= 5 ? 2 : 1
      const base = 50 + Math.min(100, Math.max(0, (850 - ms) / 6))
      assert.strictEqual(g.score - before, Math.round(base * mult * (g.surge ? 2 : 1)))
      if (g.surge) checked += 1
    }
  }
  assert.ok(checked > 3 && SURGE_AT === ROUND_MS - 5000)
})

test('twists: tiny targets, faster rush, drifting targets', () => {
  assert.ok(createGame(dayWith('tiny')).r < createGame(dayWith('rush')).r)
  const rush = result(play(dayWith('rush'), pro(300)))
  const plain = result(play(dayWith('blackout'), pro(300)))
  assert.ok(rush.stats.hits > plain.stats.hits)

  const g = createGame(dayWith('drift'))
  while (!g.targets.length) step(g, 16.7)
  const tg = g.targets[0]
  const from = { x: tg.x, y: tg.y }
  step(g, 100)
  assert.ok(Math.hypot(tg.x - from.x, tg.y - from.y) > 2)
})

test('doing nothing misses targets and only earns the freeze bonuses', () => {
  const g = play(seedFor('2026-11-09'))
  const r = result(g)
  assert.strictEqual(r.stats.hits, 0)
  assert.strictEqual(r.stats.golds, 0)
  assert.ok(r.stats.missed > 10)
  assert.strictEqual(r.score, r.points.holds)
})

test('scores stay inside what the server accepts', () => {
  for (let i = 1; i <= 30; i++) {
    for (const player of [pro(120), pro(400), masher]) {
      const { score, durationMs, stats } = result(play(seedFor(`2027-01-${i}`), player))
      assert.ok(score <= LIMITS.maxScore)
      assert.ok(stats.hits <= LIMITS.maxHits)
      assert.ok(stats.holds <= LIMITS.maxHolds)
      assert.ok(stats.golds <= LIMITS.maxGolds)
      assert.ok(score <= stats.hits * LIMITS.hitPoints + stats.holds * LIMITS.holdPoints + stats.golds * LIMITS.goldPoints)
      assert.ok(durationMs <= 32000)
    }
  }
})

test('tapping in a freeze costs points and the bonus', () => {
  let g
  let freeze
  for (let i = 1; !freeze; i++) {
    g = createGame(seedFor(`2026-11-${i}`))
    freeze = g.rules.find((x) => x.kind === 'freeze' && x.end < SURGE_AT)
  }
  while (g.t < freeze.start + 1000) step(g, 16.7)
  g.score = 500
  assert.strictEqual(tap(g, 10, 10), 'wrong')
  assert.strictEqual(g.score, 440)
  while (g.t < freeze.end + 20) step(g, 16.7)
  assert.strictEqual(g.holds, 0)
})
