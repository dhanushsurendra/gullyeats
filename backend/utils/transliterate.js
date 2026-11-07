// Writes English menu names in Hindi, Kannada and Tamil script by sound
// ("Chicken Biryani" -> "चिकन बिरयानी"), never by meaning. Never throws: a name
// it can't do comes back without that language, and the app shows English.
//
// Order of lookup, cheapest first:
//   1. FoodName: about 1,200 common items with checked spellings.
//   2. Transliteration: names worked out before.
//   3. Word by word, from data/food_words.json (common words, hand-corrected
//      where Google is wrong) and Google Input Tools for the remaining words.
const FoodName = require('../models/FoodName')
const Transliteration = require('../models/Transliteration')
const WORDS = require('../data/food_words.json')

const LANGS = ['hi', 'kn', 'ta']
// The service silently drops everything after about 30 words.
const MAX_WORDS = 25
const ENTITIES = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' }

function clean(text) {
  return text
    .replace(/&(amp|quot|#39|lt|gt);/g, (e) => ENTITIES[e])
    // Native digits back to 0-9 ("Gobi 65"). Each script's zero ends in hex 6.
    .replace(/[०-९೦-೯௦-௯]/g, (d) => String((d.codePointAt(0) & 0xf) - 6))
    .trim()
    .slice(0, 100)
}

async function request(lang, lines) {
  const url =
    `https://inputtools.google.com/request?itc=${lang}-t-i0-und&num=1&ie=utf-8&oe=utf-8` +
    `&text=${encodeURIComponent(lines.join('\n'))}`
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
  const body = await res.json()
  if (body[0] !== 'SUCCESS') throw new Error(`service said ${body[0]}`)
  return body[1].map((segment) => segment[1][0]).join('').split('\n').map(clean)
}

// One chunk; if the answer has the wrong number of lines, split it in half
// and try each half once. A result still holding English letters is dropped.
async function chunk(lang, lines, retry = true) {
  try {
    const out = await request(lang, lines)
    if (out.length === lines.length) return out.map((t) => (/[A-Za-z]/.test(t) ? '' : t))
  } catch (e) {
    console.error(`transliterate ${lang}:`, e.message)
  }
  if (!retry || lines.length === 1) return lines.map(() => '')
  const mid = Math.ceil(lines.length / 2)
  return [...(await chunk(lang, lines.slice(0, mid), false)), ...(await chunk(lang, lines.slice(mid), false))]
}

function chunksOf(lines) {
  const chunks = []
  let words = MAX_WORDS
  for (const line of lines) {
    const count = line.split(' ').length
    if (words + count > MAX_WORDS) {
      chunks.push([])
      words = 0
    }
    chunks.at(-1).push(line)
    words += count
  }
  return chunks
}

async function oneLanguage(lang, lines) {
  const out = []
  for (const part of chunksOf(lines)) out.push(...(await chunk(lang, part)))
  return out
}

// Spells each name from its words: known words from the table, the rest from
// Google, one request batch per language for all of them.
async function byWords(names) {
  const split = names.map((n) => n.split(' '))
  const unknown = [...new Set(split.flat())].filter((w) => !WORDS[w])
  const fetched = {}
  if (unknown.length) {
    const byLang = await Promise.all(LANGS.map((lang) => oneLanguage(lang, unknown)))
    unknown.forEach((w, i) => (fetched[w] = Object.fromEntries(LANGS.map((l, j) => [l, byLang[j][i]]))))
  }
  return names.map((name, i) => {
    const doc = { _id: name }
    for (const l of LANGS) {
      const parts = split[i].map((w) => (WORDS[w] || fetched[w])?.[l])
      if (parts.every(Boolean)) doc[l] = parts.join(' ')
    }
    return doc
  })
}

// names: English strings. Returns [{ hi, kn, ta }] in the same order; a
// language that failed is left out.
async function transliterate(names) {
  const keys = names.map((n) => String(n).trim().replace(/\s+/g, ' ').toLowerCase())
  const found = new Map()
  try {
    const unique = [...new Set(keys)].filter(Boolean)
    for (const model of [FoodName, Transliteration]) {
      const missing = unique.filter((k) => !found.has(k))
      if (!missing.length) break
      for (const doc of await model.find({ _id: { $in: missing } }).lean()) found.set(doc._id, doc)
    }

    const missing = unique.filter((k) => !found.has(k))
    if (missing.length) {
      const fresh = await byWords(missing)
      fresh.forEach((d) => found.set(d._id, d))
      const complete = fresh.filter((d) => LANGS.every((l) => d[l]))
      if (complete.length) {
        await Transliteration.bulkWrite(
          complete.map((d) => ({ updateOne: { filter: { _id: d._id }, update: { $set: d }, upsert: true } })),
        )
      }
    }
  } catch (e) {
    console.error('transliterate:', e.message)
  }
  return keys.map((k) => Object.fromEntries(LANGS.filter((l) => found.get(k)?.[l]).map((l) => [l, found.get(k)[l]])))
}

module.exports = { transliterate, LANGS }
