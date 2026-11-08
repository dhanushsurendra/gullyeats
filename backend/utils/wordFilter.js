/*
 * Word filter for confessions and comments. check(text) returns
 *   { verdict: 'ALLOW' | 'REVIEW' | 'BLOCK', matches, reason }
 * BLOCK: a severe word, plainly or disguised (leet, repeated letters, letters
 * split by spaces or dots, a spelling variant). REVIEW: mild words, near
 * misspellings, masked words (f**k), and ambiguous words aimed at someone.
 * Lists live in data/blocked_words.json.
 */
const data = require('../data/blocked_words.json')

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's', '!': 'i', '|': 'i', '+': 't', '€': 'e' }
// Endings that turn a severe word into another form of it (fuckers, bolimagane).
const SUFFIXES = ['s', 'es', 'ed', 'er', 'ers', 'ing', 'in', 'y', 'ies', 'a', 'e', 'i', 'o', 'u', 'ne', 'nu', 'ke', 'ki', 'ka', 'ya', 'ye', 'maga', 'magane', 'mone', 'koduku']
const SEVERITY_RANK = { severe: 3, mild: 2, ambiguous: 1 }

const isLatin = (s) => /^[a-z]+$/.test(s)
const squash = (s) => s.replace(/(.)\1+/gu, '$1')
const collapse3 = (s) => s.replace(/(.)\1{2,}/gu, '$1$1')

// Lowercase, fold look-alike characters, drop accents and invisible characters.
function base(s) {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/([a-z])[̀-ͯ]+/g, '$1')
    .normalize('NFC')
    .replace(/[​-‍⁠﻿­]/g, '')
    .replace(/ँ/g, 'ं') // chandrabindu → anusvara (गाँड = गांड)
}

// A sound-alike key, so chootiya/chutia/chutiya and phuck/fuk meet.
function phon(s) {
  return squash(
    s
      .replace(/ph/g, 'f')
      .replace(/ck/g, 'k')
      .replace(/q/g, 'k')
      .replace(/z/g, 's')
      .replace(/w/g, 'v')
      .replace(/([kgbdtcjsp])h/g, '$1')
      .replace(/ee/g, 'i')
      .replace(/oo/g, 'u')
      .replace(/y/g, 'i'),
  )
}
// The consonants only: madarchod and maderchod share "mdrcd".
const skeleton = (s) => squash(phon(s).replace(/[aeiouh]/g, ''))

// Optimal string alignment distance (Levenshtein plus swapped neighbours).
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

// ---- Build the indexes once ----------------------------------------------
const exact = new Map() // word → entry
const squashed = new Map() // latin word with doubled letters squashed → entry
const sounds = new Map() // phon(word) → entry (latin severe/mild, key ≥ 4 letters)
const skeletons = new Map() // skeleton → entry (latin severe, ≥ 4 consonants)
const phrases = [] // { words: ['kill', 'you'], entry }
const fuzzyTerms = [] // latin severe/mild words of 6+ letters
const nativeTerms = [] // non-latin severe words, matched inside longer words

function keep(map, key, entry) {
  const old = map.get(key)
  if (!old || SEVERITY_RANK[entry.severity] > SEVERITY_RANK[old.severity]) map.set(key, entry)
}

for (const severity of ['severe', 'mild', 'ambiguous']) {
  for (const [category, words] of Object.entries(data[severity])) {
    for (const raw of words) {
      const term = base(raw)
      const entry = { term, category, severity }
      if (term.includes(' ')) {
        phrases.push({ words: term.split(' ').map(squash), entry })
        continue
      }
      keep(exact, term, entry)
      if (severity === 'ambiguous') continue
      if (isLatin(term)) {
        if (squash(term).length >= 4) keep(squashed, squash(term), entry)
        if (phon(term).length >= 4) keep(sounds, phon(term), entry)
        if (severity === 'severe' && skeleton(term).length >= 4) keep(skeletons, skeleton(term), entry)
        if (term.length >= 6) fuzzyTerms.push(entry)
      } else if (severity === 'severe' && [...term].length >= 3) {
        nativeTerms.push(entry)
      }
    }
  }
}
const stems = data.stems.map((s) => ({ stem: s, key: phon(s), entry: exact.get(s) || { term: s, category: 'abuse', severity: 'severe' } }))
const allow = new Set(data.allow.map(base))
const targets = new Set(data.targets.map(base))

// ---- Tokenising -------------------------------------------------------------
const LETTERS = /[\p{L}\p{M}]/u
const COMMON = new Set('a i my re is it in on to of as at be by do go he me no so up us we an or am the and for you are was not but can get had has her him his how its let may new now old one our out see she too two who why yes all any day did end few got say'.split(' '))

// Splits text into words, keeping where each came from for the admin view.
function tokenize(text) {
  const words = [] // { t, raw, kind }
  const extra = [] // joined spellings: { t, raw, kind: 'obfuscated' }
  const masked = [] // { pattern, raw }
  const chunks = String(text).split(/\s+/).filter(Boolean)
  let singles = [] // a run of one-letter chunks: f u c k

  const flushSingles = () => {
    if (singles.length >= 3) {
      extra.push({ t: singles.map((s) => s.t).join(''), raw: singles.map((s) => s.raw).join(' '), kind: 'obfuscated' })
    }
    singles = []
  }

  for (const chunk of chunks) {
    // What the admin view highlights: the chunk without surrounding punctuation.
    const raw = chunk.replace(/^[^\p{L}\p{M}\p{N}@$*#]+|[^\p{L}\p{M}\p{N}*#]+$/gu, '') || chunk
    let c = base(raw).replace(/^[^\p{L}\p{M}\p{N}@$]+|[^\p{L}\p{M}\p{N}*#]+$/gu, '')
    if (!c) continue
    const plain = c
    // A lone "5" or "3" in "5 3 x" is a letter too.
    if (LETTERS.test(c) || (c.length === 1 && LEET[c])) c = [...c].map((ch) => LEET[ch] ?? ch).join('')
    const leet = c !== plain

    // Symbols or emoji standing in for a letter (s$x, f@ck, s😀x): leet maps
    // $ to s and @ to a, which is wrong here, so also try "any one letter".
    if (!/[*#]/.test(plain) && !/[^\P{L}a-z]/u.test(plain) && /[a-z][^a-z]+[a-z]/u.test(plain)) {
      const pattern = plain.replace(/[^a-z]+/gu, '[a-z]?')
      if (plain.replace(/[^a-z]/g, '').length >= 2) masked.push({ raw, pattern: new RegExp(`^${pattern}$`), swap: true })
    }
    const parts = c.split(/[^\p{L}\p{M}*#]+/u).filter(Boolean)

    for (const p of parts) {
      if (/[*#]/.test(p)) {
        const letters = p.replace(/[*#]/g, '')
        if (letters.length >= 2 && isLatin(letters)) {
          masked.push({ raw, pattern: new RegExp(`^${p.replace(/[*#]+/g, '[a-z]+')}$`) })
        }
        continue
      }
      words.push({ t: p, raw, leet })
    }

    // f.u.c.k or fu-ck in one chunk: also try the letters joined up.
    const joined = c.replace(/[^\p{L}\p{M}]/gu, '')
    if (parts.length > 1 && joined) extra.push({ t: joined, raw, kind: 'obfuscated' })

    if ([...joined].length === 1) singles.push({ t: joined, raw })
    else flushSingles()
  }
  flushSingles()

  // Two short pieces of one word: "fu ck", "bit ch". Real short words
  // ("my re-entry") don't count as pieces.
  const piece = (t) => t.length <= 4 && !COMMON.has(t) && !allow.has(t)
  for (let i = 0; i + 1 < words.length; i++) {
    const t = words[i].t + words[i + 1].t
    const hit = exact.get(t)
    if (hit && hit.severity === 'severe' && piece(words[i].t) && piece(words[i + 1].t)) {
      extra.push({ t, raw: `${words[i].raw} ${words[i + 1].raw}`, kind: 'obfuscated' })
    }
  }
  return { words, extra, masked }
}

// ---- Matching one word ------------------------------------------------------
function matchWord(t, kindHint) {
  const c3 = collapse3(t)
  const sq = squash(t)
  if (allow.has(t) || allow.has(c3)) return null

  // Exact (or with stretched letters) first: an exact ambiguous word is never
  // treated as a variant of a severe one.
  for (const [form, kind] of [[t, 'exact'], [c3, 'variant'], [sq, 'variant']]) {
    const e = exact.get(form) || (form === sq && squashed.get(sq))
    if (e) return { ...e, kind: kindHint || (form === t ? 'exact' : kind) }
  }
  if (allow.has(sq)) return null

  const latin = isLatin(t)
  if (latin) {
    for (const s of SUFFIXES) {
      if (t.length > s.length && t.endsWith(s)) {
        const e = exact.get(t.slice(0, -s.length)) || exact.get(squash(t.slice(0, -s.length)))
        if (e && e.severity !== 'ambiguous' && e.term.length >= 5) return { ...e, kind: kindHint || 'variant' }
      }
    }
    if (t.length >= 4) {
      const e = sounds.get(phon(t))
      if (e) return { ...e, kind: kindHint || 'phonetic' }
    }
  }

  for (const { stem, key, entry } of stems) {
    if (t.includes(stem) || (latin && key.length >= 5 && phon(t).includes(key))) {
      return { ...entry, kind: kindHint || 'compound' }
    }
  }
  if (!latin) {
    const e = nativeTerms.find((n) => t.includes(n.term))
    return e ? { ...e, kind: kindHint || 'compound' } : null
  }

  // Close misspellings and consonant look-alikes only go to review.
  if (t.length >= 5) {
    const sk = skeleton(t)
    const e = sk.length >= 4 && skeletons.get(sk)
    if (e && Math.abs(t.length - e.term.length) <= 3) return { ...e, severity: 'mild', kind: 'phonetic' }
  }
  if (t.length >= 6) {
    const p = phon(t)
    for (const e of fuzzyTerms) {
      if (e.term[0] !== t[0] || Math.abs(e.term.length - t.length) > 2) continue
      if (distance(p, phon(e.term)) <= (e.term.length >= 9 ? 2 : 1)) {
        return { ...e, severity: 'mild', kind: 'fuzzy' }
      }
    }
  }
  return null
}

const describe = { exact: 'exact word', variant: 'spelling variant', phonetic: 'sounds like', compound: 'inside a word', obfuscated: 'letters split up', masked: 'masked with symbols', fuzzy: 'close misspelling', context: 'aimed at someone' }

function check(text) {
  const { words, extra, masked } = tokenize(text)
  const matches = []
  // One entry per word found; a stronger match for it replaces a weaker one.
  const add = (m, raw) => {
    const entry = { term: m.term, found: raw, category: m.category, severity: m.severity, kind: m.kind }
    const i = matches.findIndex((x) => x.term === m.term && x.found === raw)
    if (i < 0) matches.push(entry)
    else if (SEVERITY_RANK[m.severity] > SEVERITY_RANK[matches[i].severity]) matches[i] = entry
  }

  const ambiguous = []
  words.forEach((w, i) => {
    const m = matchWord(w.t)
    if (!m) return
    if (w.leet && m.kind === 'exact') m.kind = 'variant' // b1tch, @ss
    if (m.severity === 'ambiguous') ambiguous.push({ m, w, i })
    else add(m, w.raw)
  })
  for (const x of extra) {
    const m = matchWord(x.t, x.kind)
    if (m && m.severity !== 'ambiguous') add(m, x.raw)
  }
  for (const { pattern, raw, swap } of masked) {
    const hits = [...exact.values()].filter((v) => v.severity !== 'ambiguous' && isLatin(v.term) && pattern.test(v.term))
    const e = hits.find((v) => v.severity === 'severe') || hits[0]
    if (!e) continue
    // One symbol for one letter of a severe word (f$ck) is as clear as the word;
    // stars (f**k) and mild words still get a human look.
    if (swap && e.severity === 'severe' && e.term.length >= 4) add({ ...e, kind: 'variant' }, raw)
    else add({ ...e, severity: e.severity === 'severe' ? 'mild' : e.severity, kind: 'masked' }, raw)
  }

  // Phrases, on squashed words so "kill youuu" still counts.
  const seq = words.map((w) => squash(w.t))
  for (const { words: pw, entry } of phrases) {
    for (let i = 0; i + pw.length <= seq.length; i++) {
      if (pw.every((p, k) => seq[i + k] === p)) {
        add({ ...entry, kind: 'exact' }, words.slice(i, i + pw.length).map((w) => w.raw).join(' '))
        break
      }
    }
  }

  // An ambiguous word counts only within three words of "you"/"teri"/… or with other hits.
  for (const { m, w, i } of ambiguous) {
    const from = Math.max(0, i - 3)
    const near = words.slice(from, i + 4).some((x, k) => from + k !== i && (targets.has(x.t) || targets.has(squash(x.t))))
    if (near || matches.length) add({ ...m, severity: 'mild', kind: near ? 'context' : m.kind }, w.raw)
  }

  const blocked = matches.filter((m) => m.severity === 'severe')
  const verdict = blocked.length ? 'BLOCK' : matches.length ? 'REVIEW' : 'ALLOW'
  const shown = blocked.length ? blocked : matches
  const reason = shown.length
    ? [...new Set(shown.map((m) => `${m.category}: "${m.term}" (${describe[m.kind] || m.kind})`))].join('; ')
    : ''
  return { verdict, matches, reason }
}

module.exports = { check, _internal: { base, phon, skeleton, distance, tokenize } }
