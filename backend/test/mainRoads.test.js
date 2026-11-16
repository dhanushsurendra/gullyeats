const { test } = require('node:test')
const assert = require('node:assert')
const { mainRoadNear, _load } = require('../utils/mainRoads')

// An east–west main road along latitude 12.9756, an unnamed one going north
// at longitude 77.6200, and nothing else.
_load([
  { n: 'Mahatma Gandhi Road', p: [[12.9756, 77.6000], [12.9756, 77.6100]] },
  { n: '', p: [[12.9700, 77.6200], [12.9800, 77.6200]] },
])
const north = (m) => m / 111320 // degrees of latitude for m metres

test('a spot within 25 m of a main road gets its name', () => {
  assert.strictEqual(mainRoadNear(12.9756, 77.6050), 'Mahatma Gandhi Road')
  assert.strictEqual(mainRoadNear(12.9756 + north(20), 77.6050), 'Mahatma Gandhi Road')
})

test('a spot further away, or past the road\'s end, gets nothing', () => {
  assert.strictEqual(mainRoadNear(12.9756 + north(40), 77.6050), null)
  assert.strictEqual(mainRoadNear(12.9756, 77.6105), null) // ~540 m past the end
})

test('an unnamed main road still counts', () => {
  assert.strictEqual(mainRoadNear(12.9750, 77.6201), '')
})
