const asyncHandler = require('../utils/asyncHandler')
const DishCandidate = require('../models/DishCandidate')
const FoodName = require('../models/FoodName')
const translit = require('../utils/transliterate')
const { MIN_CARTS, dishKey, forgetKnown, commonSpellings } = require('../utils/dishCandidates')
const { logAction } = require('../utils/adminLog')
const { s3Client } = require('../utils/s3Client')
const { PutObjectCommand } = require('@aws-sdk/client-s3')
const sharp = require('sharp')

const LANGS = ['hi', 'kn', 'ta']

const fail = (res, status, message) => {
  res.status(status)
  throw new Error(message)
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const flat = (s) => dishKey(s).replace(/ /g, '')

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return d[a.length][b.length]
}

/** A listed dish this name is probably another spelling of ("Pani Poori" -> "Pani Puri"). */
function similarDish(name, dishes) {
  const f = flat(name)
  let best = null
  for (const dish of dishes) {
    const g = flat(dish.name)
    const dist = f === g ? 0 : Math.abs(f.length - g.length) > 2 ? 99 : editDistance(f, g)
    if (dist <= 2 && (!best || dist < best.dist)) best = { name: dish.name, dist }
  }
  return best?.name || null
}

async function pendingCandidate(res, id) {
  const c = await DishCandidate.findById(id)
  if (!c) fail(res, 404, 'Dish not found')
  if (c.status !== 'PENDING') fail(res, 409, `This dish was already ${c.status.toLowerCase()}`)
  return c
}

// GET /admin/dishes: names used by MIN_CARTS+ carts, waiting for review.
exports.list = asyncHandler(async (req, res) => {
  const rows = await DishCandidate.find({ status: 'PENDING', [`carts.${MIN_CARTS - 1}`]: { $exists: true } })
    .sort({ lastSeen: -1 })
    .limit(100)
    .lean()
  const dishes = await FoodName.find({}, { name: 1 }).lean()
  const auto = rows.length ? await translit.transliterate(rows.map((r) => r.name)) : []
  res.json({
    success: true,
    data: rows.map((r, i) => {
      const typed = commonSpellings(r.corrections)
      return {
        id: r._id,
        name: r.name,
        carts: r.carts.length,
        firstSeen: r.firstSeen,
        lastSeen: r.lastSeen,
        similar: similarDish(r.name, dishes),
        // Vendors' own spelling when they typed one, else the automatic one.
        spellings: Object.fromEntries(LANGS.map((l) => [l, typed[l] || auto[i]?.[l] || ''])),
        typed: Object.keys(typed),
      }
    }),
  })
})

// Pixabay searches, kept 24 hours as its API terms require.
const searches = new Map()
async function pixabay(res, name) {
  const hit = searches.get(name)
  if (hit && Date.now() - hit.at < 24 * 3600 * 1000) return hit.images
  if (!process.env.PIXABAY_API_KEY) fail(res, 503, 'Pixabay API key is not configured')
  const url = `https://pixabay.com/api/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(name)}` +
    '&image_type=photo&safesearch=true&per_page=5'
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!r.ok) fail(res, 502, `Pixabay search failed (${r.status})`)
  const images = ((await r.json()).hits || []).map((h) => ({
    id: h.id, preview: h.previewURL, web: h.webformatURL, tags: h.tags, page: h.pageURL,
  }))
  searches.set(name, { at: Date.now(), images })
  return images
}

// GET /admin/dishes/:id/images: 5 Pixabay photos to pick a default from.
exports.images = asyncHandler(async (req, res) => {
  const c = await DishCandidate.findById(req.params.id).lean()
  if (!c) fail(res, 404, 'Dish not found')
  const images = await pixabay(res, c.name)
  res.json({ success: true, data: images.map(({ id, preview, tags, page }) => ({ id, preview, tags, page })) })
})

/** Copies a picked Pixabay photo (from our own search, never a client URL) to S3. */
async function uploadDishImage(res, name, imageId) {
  const image = (await pixabay(res, name)).find((i) => i.id === imageId)
  if (!image) fail(res, 400, 'Pick one of the images shown for this dish')
  const url = new URL(image.web)
  if (!/(^|\.)pixabay\.com$/.test(url.hostname)) fail(res, 400, 'Unexpected image host')
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) })
  const type = r.headers.get('content-type') || ''
  if (!r.ok || !type.startsWith('image/')) fail(res, 502, 'Could not download the image')
  const raw = Buffer.from(await r.arrayBuffer())
  if (raw.length > 3 * 1024 * 1024) fail(res, 502, 'Image too large')
  try {
    return await saveDishPhoto(raw, name)
  } catch (e) {
    if (e.unreadable) fail(res, 502, 'Could not read the image')
    throw e
  }
}

/** Stores a downloaded photo as a dish's default in S3 and returns its key. */
async function saveDishPhoto(raw, name) {
  // Same size as every default photo: 480x400 (the menu thumbnail's shape), ~30 KB.
  // The crop follows the most striking part (the food), not the middle: a dish
  // off to one side of a wide photo would otherwise be cut out of the frame.
  let body
  try {
    body = await sharp(raw)
      .rotate() // honour the camera's orientation tag before cropping
      .resize(480, 400, { fit: 'cover', position: sharp.strategy.attention })
      .jpeg({ quality: 72, progressive: true })
      .toBuffer()
  } catch {
    throw Object.assign(new Error('Could not read the image'), { unreadable: true })
  }
  const key = `dish-images/${slug(name)}.jpg`
  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME, Key: key, Body: body, ContentType: 'image/jpeg', CacheControl: 'public, max-age=31536000',
  }))
  return key
}

// POST /admin/dishes/:id/approve { name, hi, kn, ta, imageId? }
exports.approve = asyncHandler(async (req, res) => {
  const c = await pendingCandidate(res, req.params.id)
  const { name, imageId } = req.body || {}
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) fail(res, 400, 'Name must be 2 to 60 characters')
  const spellings = {}
  for (const l of LANGS) {
    const v = req.body[l]
    if (v === undefined || v === '') continue
    if (typeof v !== 'string' || v.trim().length > 100) fail(res, 400, `Invalid ${l} spelling`)
    spellings[l] = v.trim()
  }
  if (imageId !== undefined && imageId !== null && !Number.isInteger(imageId)) fail(res, 400, 'Invalid image')

  const clean = name.trim()
  const id = clean.toLowerCase()
  if (await FoodName.exists({ _id: id })) fail(res, 409, `${clean} is already in the list. Merge it instead.`)
  const missing = LANGS.filter((l) => !spellings[l])
  if (missing.length) {
    const [auto] = await translit.transliterate([clean])
    for (const l of missing) if (auto?.[l]) spellings[l] = auto[l]
  }
  const image = imageId != null ? await uploadDishImage(res, c.name, imageId) : undefined

  await FoodName.create({ _id: id, name: clean, ...spellings, popularity: c.carts.length, reviewed: true, image })
  c.status = 'APPROVED'
  c.resolvedAt = new Date()
  await c.save()
  forgetKnown()
  await logAction(req, 'APPROVE_DISH', { kind: 'dish', key: c._id, label: clean }, { image: image || null })
  res.json({ success: true, data: { name: clean, ...spellings, image: image || null } })
})

// POST /admin/dishes/:id/merge { into }: another name of an existing dish.
exports.merge = asyncHandler(async (req, res) => {
  const c = await pendingCandidate(res, req.params.id)
  const into = typeof req.body?.into === 'string' ? req.body.into.trim() : ''
  const dish = into && (await FoodName.findById(into.toLowerCase()))
  if (!dish) fail(res, 404, 'Pick a dish from the common list to merge into')
  await FoodName.updateOne({ _id: dish._id }, { $addToSet: { aliases: c._id } })
  c.status = 'MERGED'
  c.mergedInto = dish.name
  c.resolvedAt = new Date()
  await c.save()
  forgetKnown()
  await logAction(req, 'MERGE_DISH', { kind: 'dish', key: c._id, label: c.name }, { into: dish.name })
  res.json({ success: true, data: { name: c.name, into: dish.name } })
})

// POST /admin/dishes/:id/reject: stays each vendor's own item.
exports.reject = asyncHandler(async (req, res) => {
  const c = await pendingCandidate(res, req.params.id)
  c.status = 'REJECTED'
  c.resolvedAt = new Date()
  await c.save()
  await logAction(req, 'REJECT_DISH', { kind: 'dish', key: c._id, label: c.name })
  res.json({ success: true, data: { name: c.name } })
})

exports.MIN_CARTS = MIN_CARTS
exports.saveDishPhoto = saveDishPhoto
