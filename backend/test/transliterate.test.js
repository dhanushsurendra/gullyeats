// The transliteration lookup: catalog, cache, word table, then Google.
const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const { stub, restoreAll, q } = require('./helpers')
const FoodName = require('../models/FoodName')
const Transliteration = require('../models/Transliteration')
const { transliterate } = require('../utils/transliterate')

afterEach(restoreAll)

// Answers like the real service, in one segment: each line becomes a letter
// of that script plus the line's length, so 'zqx' in Tamil is 'த3'. Made-up
// words are used so none of them is in data/food_words.json.
const MARK = { hi: 'ह', kn: 'ಕ', ta: 'த' }
function fakeService({ maxLines = Infinity, fail = false, answer } = {}) {
  const calls = []
  stub(global, 'fetch', async (url) => {
    const u = new URL(url)
    const lang = u.searchParams.get('itc').slice(0, 2)
    const lines = u.searchParams.get('text').split('\n')
    calls.push({ lang, lines })
    if (fail) throw new Error('network down')
    const out = answer || lines.slice(0, maxLines).map((l) => `${MARK[lang]}${l.length}`).join('\n')
    return { json: async () => ['SUCCESS', [[lines.join('\n'), [out]]]] }
  })
  return calls
}

function emptyDb({ catalog = [], cache = [] } = {}) {
  const saved = []
  stub(FoodName, 'find', () => q(catalog))
  stub(Transliteration, 'find', () => q(cache))
  stub(Transliteration, 'bulkWrite', async (ops) => saved.push(...ops.map((o) => o.updateOne.update.$set)))
  return saved
}

test('catalog and cache answer without calling the service', async () => {
  emptyDb({
    catalog: [{ _id: 'pani puri', hi: 'पानी पूरी', kn: 'ಪಾನಿ ಪುರಿ', ta: 'பானி பூரி' }],
    cache: [{ _id: 'ramesh special', hi: 'र', kn: 'ರ', ta: 'ர' }],
  })
  const calls = fakeService()
  const out = await transliterate(['Pani  Puri', 'RAMESH special'])
  assert.deepStrictEqual(out, [{ hi: 'पानी पूरी', kn: 'ಪಾನಿ ಪುರಿ', ta: 'பானி பூரி' }, { hi: 'र', kn: 'ರ', ta: 'ர' }])
  assert.strictEqual(calls.length, 0)
})

test('known words come from the word table; only unknown words go to the service', async () => {
  const saved = emptyDb()
  const calls = fakeService()
  const [out] = await transliterate(['Chicken Zqx Biryani'])
  assert.deepStrictEqual(calls.map((c) => c.lines), [['zqx'], ['zqx'], ['zqx']])
  assert.strictEqual(out.ta, 'சிக்கன் த3 பிரியாணி')
  assert.strictEqual(out.kn, 'ಚಿಕನ್ ಕ3 ಬಿರಿಯಾನಿ')
  assert.strictEqual(saved[0]._id, 'chicken zqx biryani')
})

test('words are deduped across names and batched under the word cap', async () => {
  emptyDb()
  const calls = fakeService()
  const names = Array.from({ length: 60 }, (_, i) => `zq${i} zz${i % 3}`)
  const out = await transliterate(names)
  assert.strictEqual(out.length, 60)
  // 60 + 3 unique words, 25 per request: 3 requests per language.
  assert.strictEqual(calls.length, 9)
  assert.ok(calls.every((c) => c.lines.length <= 25))
  assert.strictEqual(out[7].hi, 'ह3 ह3')
})

test('cleans digits and escapes; drops answers with English letters; a cut-off reply is retried', async () => {
  emptyDb()
  fakeService({ answer: 'गोबी ६५ &amp; "௯"' })
  assert.strictEqual((await transliterate(['zqgobi']))[0].hi, 'गोबी 65 & "9"')

  restoreAll()
  emptyDb()
  fakeService({ answer: 'ಪ್ರwನ್' })
  assert.deepStrictEqual(await transliterate(['zqprawn']), [{}])

  restoreAll()
  emptyDb()
  const calls = fakeService({ maxLines: 2 })
  const out = await transliterate(['za zb zc zd ze'])
  // 5 words: the full request is cut off, then halves of 3 (cut off too) and 2.
  assert.strictEqual(calls.length, 9)
  assert.deepStrictEqual(out, [{}])

  restoreAll()
  emptyDb()
  fakeService({ fail: true })
  assert.deepStrictEqual(await transliterate(['zqtea']), [{}])
})
