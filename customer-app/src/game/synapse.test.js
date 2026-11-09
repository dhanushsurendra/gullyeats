// Run with: node --test "src/game/*.test.js"
import { test } from 'node:test'
import assert from 'node:assert'

import {
  createGame, expectedOrder, INPUT_MS, isReverse, LIMITS, MAX_MISSES, posOf, result, ROUND_MS, seedFor, step, tap, TWISTS, twistFor,
} from './synapse.js'

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

const turn = (g, delay) => g.phase === 'input' && g.t - g.lastTapAt >= delay
// Taps the right neuron `delay` ms after its turn starts or its last tap.
const pro = (delay) => (g) => (turn(g, delay) ? [posOf(g, expectedOrder(g)[g.next])] : [])
// Taps the neuron that fired, ignoring REVERSE and MIRROR.
const literal = (g) => (turn(g, 250) ? [posOf(g, g.seq[g.next])] : [])
// Always taps a wrong neuron.
const wrong = (g) => (turn(g, 250) ? [posOf(g, (expectedOrder(g)[g.next] + 1) % 8)] : [])
// Plays well but fluffs one tap at the start of chain `n` (once).
const fluffAt = (n) => {
  let done = false
  return (g) => {
    if (!turn(g, 250)) return []
    if (!done && g.length === n && g.next === 0) {
      done = true
      return [posOf(g, (expectedOrder(g)[0] + 1) % 8)]
    }
    return [posOf(g, expectedOrder(g)[g.next])]
  }
}

test('the same day gives everyone the same neurons, chain and twist', () => {
  const a = createGame(seedFor('2026-11-09'))
  const b = createGame(seedFor('2026-11-09'))
  const c = createGame(seedFor('2026-11-10'))
  assert.deepStrictEqual([a.slots, a.seq, a.twist], [b.slots, b.seq, b.twist])
  assert.notDeepStrictEqual(a.seq, c.seq)
  const seen = new Set()
  for (let i = 1; i <= 60; i++) {
    const g = createGame(seedFor(`2027-03-${i}`))
    seen.add(g.twist)
    g.seq.slice(1).forEach((n, k) => assert.notStrictEqual(n, g.seq[k], 'a neuron fires twice in a row'))
    // Neurons never overlap, and stay on screen.
    const pos = g.nodes.map((_, n) => posOf(g, n))
    for (const [p, a] of pos.entries()) {
      assert.ok(a.x > 30 && a.x < g.w - 30 && a.y > 120 && a.y < g.h - 30)
      for (const b of pos.slice(p + 1)) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 70)
    }
  }
  assert.deepStrictEqual([...seen].sort(), Object.keys(TWISTS).sort())
})

test('only the new link fires, except on the first chain, reverse chains and after a miss', () => {
  const g = createGame(dayWith('silent'))
  const shown = {} // chain length -> neurons fired
  const player = fluffAt(7)
  while (!g.over && g.chains < 6) {
    const before = g.fired
    step(g, 16.7)
    if (g.phase === 'show' && g.fired > before) shown[g.length] = g.fired
    for (const t of player(g)) tap(g, t.x, t.y)
  }
  assert.strictEqual(shown[3], 3) // first chain: all of it
  assert.strictEqual(shown[4], 1)
  assert.strictEqual(shown[5], 1)
  assert.strictEqual(shown[6], 6) // reverse: all of it
  assert.strictEqual(shown[7], 7) // replayed after the miss
})

test('a sharp player goes far on every twist, with no misses', () => {
  for (const twist of Object.keys(TWISTS)) {
    const r = result(play(dayWith(twist), pro(300)))
    assert.strictEqual(r.durationMs, ROUND_MS, twist)
    assert.strictEqual(r.stats.misses, 0, twist)
    assert.ok(r.stats.chains >= 9, `${twist}: only ${r.stats.chains} chains`)
    assert.strictEqual(r.stats.longest, r.stats.chains + 2)
    assert.ok(r.stats.reverses >= 2)
    assert.ok(r.points.speed > 0)
  }
})

test('quicker hands get further and earn the speed bonus', () => {
  const seed = seedFor('2026-11-09')
  const fast = result(play(seed, pro(250)))
  const slow = result(play(seed, pro(950)))
  assert.ok(fast.stats.chains > slow.stats.chains)
  assert.ok(fast.score > slow.score)
  assert.ok(fast.points.speed > 0)
  assert.strictEqual(slow.points.speed, 0)
})

test('reverse chains go backwards, and mirror day taps the opposite neuron', () => {
  assert.deepStrictEqual([3, 4, 5, 6, 7, 10, 14].map(isReverse), [false, false, false, true, false, true, true])
  const plain = result(play(dayWith('silent'), literal))
  // Gets 3, 4 and 5 right, then trips on the reverse 6 (a shield saves one).
  assert.strictEqual(plain.stats.chains, 3)
  assert.strictEqual(plain.stats.misses, MAX_MISSES)
  assert.strictEqual(plain.stats.saves, 1)
  // On mirror day, tapping what fired is wrong from the start.
  const mirror = result(play(dayWith('mirror'), literal))
  assert.strictEqual(mirror.stats.chains, 0)
  assert.strictEqual(mirror.stats.misses, MAX_MISSES)
})

test('three clean chains earn a shield that takes the next miss', () => {
  const g = createGame(dayWith('silent'))
  const player = fluffAt(7)
  while (!g.over && g.length < 8) {
    step(g, 16.7)
    for (const t of player(g)) tap(g, t.x, t.y)
  }
  assert.strictEqual(g.misses, 0)
  assert.strictEqual(g.saves, 1)
  assert.strictEqual(g.chains, 5)
})

test('shuffle day turns the ring after each chain; ghost day hides the new link', () => {
  const s = createGame(dayWith('shuffle'))
  const before = posOf(s, 0)
  const p = pro(250)
  while (s.chains < 1) {
    step(s, 16.7)
    for (const t of p(s)) tap(s, t.x, t.y)
  }
  for (let i = 0; i < 60; i++) step(s, 16.7) // past the turn
  const after = posOf(s, 0)
  assert.ok(Math.hypot(before.x - after.x, before.y - after.y) > 50)

  const g = createGame(dayWith('ghost'))
  const q = pro(250)
  while (g.length < 5) {
    step(g, 16.7)
    for (const t of q(g)) tap(g, t.x, t.y)
  }
  const fires = []
  g.events.length = 0
  while (g.phase !== 'input') {
    step(g, 16.7)
    fires.push(...g.events.filter((e) => e.type === 'fire'))
    g.events.length = 0
  }
  assert.deepStrictEqual(fires.map((e) => e.ghost), [true])
  assert.ok(g.lit.every((until) => until < g.t)) // nothing lit up
})

test('the Surge doubles points in the last 10 seconds', () => {
  const linkPoints = []
  const h = createGame(seedFor('2026-11-09'))
  const p = pro(300)
  while (!h.over) {
    step(h, 16.7)
    for (const t of p(h)) {
      const before = h.score
      const len = h.length
      const res = tap(h, t.x, t.y)
      if (res === 'right' && h.next > 0) linkPoints.push({ surge: h.surge, pts: h.score - before, len, rev: isReverse(len) })
    }
  }
  const late = linkPoints.find((l) => l.surge && !l.rev)
  assert.ok(late && late.pts === 10 * late.len * 2)
})

test('three misses overload and end the round early; waiting too long is a miss', () => {
  const g = play(seedFor('2026-11-09'), wrong)
  assert.strictEqual(g.misses, MAX_MISSES)
  assert.ok(g.t < ROUND_MS)
  assert.strictEqual(result(g).score, 0)

  const idle = play(seedFor('2026-11-09'))
  assert.strictEqual(idle.misses, MAX_MISSES)
  assert.ok(idle.t < 3 * (INPUT_MS + 3000))

  const h = createGame(seedFor('2026-11-09'))
  step(h, 50)
  assert.strictEqual(tap(h, posOf(h, h.seq[0]).x, posOf(h, h.seq[0]).y), null) // still showing
})

test('scores stay inside what the server accepts', () => {
  for (let i = 1; i <= 30; i++) {
    for (const player of [pro(85), pro(400), literal, wrong, fluffAt(5)]) {
      const { score, durationMs, stats: s } = result(play(seedFor(`2027-01-${i}`), player))
      assert.ok(score <= LIMITS.maxScore, `${score}`)
      assert.ok(s.links <= LIMITS.maxLinks && s.chains <= LIMITS.maxChains && s.longest <= LIMITS.maxLength, JSON.stringify(s))
      assert.ok(s.misses <= LIMITS.maxMisses && s.reverses <= s.chains)
      assert.strictEqual(s.longest, s.chains ? s.chains + 2 : 0)
      assert.ok(s.links >= (s.chains * (s.longest + 3)) / 2)
      assert.ok(s.saves <= Math.floor(s.chains / 3))
      assert.ok(s.chains ? s.fastMs >= LIMITS.minTapMs : s.fastMs === 0, `${s.fastMs}`)
      const l = LIMITS
      assert.ok(score <= l.reverse * l.surge * (s.links * l.linkPoints * (s.chains + 3) + l.speed * s.chains * l.chainPoints * s.longest))
      assert.ok(durationMs <= 47000)
    }
  }
})
