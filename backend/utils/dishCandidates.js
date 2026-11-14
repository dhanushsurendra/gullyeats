const DishCandidate = require('../models/DishCandidate')
const FoodName = require('../models/FoodName')
const { notifyAdmins } = require('./adminNotify')

// A name enters the admin's review list once this many different carts use it.
const MIN_CARTS = 3

// Words vendors add around a dish name that don't change the dish.
const EXTRA = /\b(spl|special|half|full|jumbo|mini|regular|plate|pcs|pc|piece|pieces|combo|\d+)\b/g

/** The comparable form of a dish name: "Spl Masala Dosa (Half)" -> "masala dosa". */
function dishKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(EXTRA, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Keys of every listed dish and alias, and which have a default photo; reloaded
// every 10 minutes and after an admin changes the list.
let known = null
let images = null
let knownAt = 0
async function load() {
  if (!known || Date.now() - knownAt > 10 * 60 * 1000) {
    const all = await FoodName.find({}, { name: 1, aliases: 1, image: 1 }).lean()
    known = new Set(all.flatMap((f) => [dishKey(f.name), ...(f.aliases || [])]))
    images = new Map(all.filter((f) => f.image).flatMap((f) => [dishKey(f.name), ...(f.aliases || [])].map((k) => [k, f.image])))
    knownAt = Date.now()
  }
}
async function knownKeys() {
  await load()
  return known
}
const forgetKnown = () => (known = null)

// S3 now; set IMAGE_BASE_URL to the CloudFront domain to serve from there.
const imageBase = () => process.env.IMAGE_BASE_URL || `https://${process.env.BUCKET_NAME}.s3.amazonaws.com`

/**
 * A function giving the default photo URL for an item name, or null: the
 * dish with that exact name or alias, else the longest listed dish whose name
 * appears as whole words in it ("Butter Masala Dosa" -> Masala Dosa).
 */
async function defaultImages() {
  await load()
  const byLength = [...images.keys()].sort((a, b) => b.length - a.length)
  return (name) => {
    const key = dishKey(name)
    const hit = images.get(key) || images.get(byLength.find((k) => ` ${key} `.includes(` ${k} `)))
    return hit ? `${imageBase()}/${hit}` : null
  }
}

/**
 * Records dish names a cart saved that aren't in the common list. `items` is
 * [{ name, names? }], names being spellings the vendor typed themselves.
 * Never throws: a failure here must not block saving a menu.
 */
async function trackDishes(cartId, items) {
  try {
    const keys = await knownKeys()
    for (const { name, names } of items) {
      const key = dishKey(name)
      if (key.length < 3 || keys.has(key)) continue
      const dish = await DishCandidate.findOneAndUpdate(
        { _id: key },
        {
          $setOnInsert: { name: String(name).trim(), firstSeen: new Date() },
          $addToSet: { carts: cartId },
          $set: { lastSeen: new Date() },
        },
        { upsert: true, returnDocument: 'after', projection: { name: 1, carts: 1, status: 1 } },
      ).lean()
      if (dish.status === 'PENDING' && dish.carts.length >= MIN_CARTS) {
        notifyAdmins({
          type: 'dish',
          title: `New dish to review · ${dish.name}`,
          text: `${dish.carts.length} carts sell it. Check its spellings and photo.`,
          to: '/dishes',
          key: `dish:${key}`,
        })
      }
      const typed = Object.fromEntries(['hi', 'kn', 'ta'].filter((l) => names?.[l]).map((l) => [l, names[l]]))
      if (Object.keys(typed).length) {
        await DishCandidate.updateOne({ _id: key }, { $pull: { corrections: { cartId } } })
        await DishCandidate.updateOne({ _id: key }, { $push: { corrections: { cartId, ...typed } } })
      }
    }
  } catch (e) {
    console.error('Could not track dish names:', e.message)
  }
}

/** The spelling most carts typed for each language, or undefined. */
function commonSpellings(corrections = []) {
  const out = {}
  for (const lang of ['hi', 'kn', 'ta']) {
    const counts = {}
    for (const c of corrections) if (c[lang]) counts[c[lang]] = (counts[c[lang]] || 0) + 1
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    if (best) out[lang] = best[0]
  }
  return out
}

module.exports = { MIN_CARTS, dishKey, trackDishes, knownKeys, forgetKnown, commonSpellings, defaultImages }
