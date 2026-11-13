// Gives common dishes without a default photo one from TheMealDB or Openverse,
// copied to S3 like an admin-picked one. Two steps, so a person (or a reviewer
// looking at the crops) picks each photo: the top search hit is often another
// dish ("Buttermilk" -> buttermilk scones).
//   node scripts/fill-dish-images.js find <candidates.json>
//     Up to 3 photos per dish whose title or tags hold the dish's whole name,
//     commercial licences only, 400x300 or larger. Saves nothing; re-run to
//     resume (dishes already in the file are skipped, failed ones retried).
//   node scripts/fill-dish-images.js save <picks.json>
//     picks.json: [{ id, name, photo }] with photo one of the candidates.
//     Uploads each to S3 (cropped around the food, see saveDishPhoto) and sets
//     FoodName.image. Every photo's source and licence goes to
//     data/dish_image_credits.json.
// Dishes already covered by a shorter dish's photo ("Plain Dosa" -> Dosa) are skipped.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const FoodName = require('../models/FoodName')
const { defaultImages, dishKey } = require('../utils/dishCandidates')
const { saveDishPhoto } = require('../controllers/dishController')

const [mode, file] = process.argv.slice(2)
const IMAGES = path.join(__dirname, '..', 'data', 'dish_images.json')
const CREDITS = path.join(__dirname, '..', 'data', 'dish_image_credits.json')
// Wikimedia throttles generic agents; it asks clients to say who they are.
const UA = { 'User-Agent': 'GullyEatsDishPhotos/1.0 (https://gullyeats.onrender.com; one-off fetch of CC images for a menu app)' }
const PER_DISH = 3
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** Whether `text` names the dish: its whole name as words ("Vada Pav Recipe" names Vada Pav). */
const names = (text, dish) => ` ${dishKey(text)} `.includes(` ${dishKey(dish)} `)
const readJson = (f, empty) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : empty)

async function getJson(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) })
  if (r.status === 429) throw Object.assign(new Error('rate limited'), { limited: true })
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}`)
  return r.json()
}

async function mealDb(name) {
  const { meals } = await getJson(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(name)}`)
  return (meals || [])
    .filter((x) => dishKey(x.strMeal) === dishKey(name))
    .map((m) => ({ url: m.strMealThumb, source: 'TheMealDB', page: `https://www.themealdb.com/meal/${m.idMeal}`, title: m.strMeal, license: 'TheMealDB' }))
}

// Only licences that allow commercial use and edits (we crop); BY/BY-SA ones need the credit kept.
async function openverse(name) {
  const { results } = await getJson(
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(name)}&license_type=commercial&page_size=20&mature=false`,
  )
  return (results || [])
    .filter((x) => !(x.width < 400 || x.height < 300) && !/nd/.test(x.license))
    .filter((x) => names(x.title || '', name) || (x.tags || []).some((t) => dishKey(t.name) === dishKey(name)))
    .map((o) => ({
      url: o.url, source: 'Openverse', page: o.foreign_landing_url, title: o.title, creator: o.creator,
      license: `${o.license} ${o.license_version || ''}`.trim(),
    }))
}

async function download(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
  if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image/')) throw new Error(`download failed (${r.status})`)
  const raw = Buffer.from(await r.arrayBuffer())
  if (raw.length > 15 * 1024 * 1024) throw new Error('image too large')
  return raw
}

async function find() {
  const imageFor = await defaultImages()
  const todo = (await FoodName.find({ image: null }, { name: 1 }).sort({ popularity: -1 }).lean()).filter((d) => !imageFor(d.name))
  const out = readJson(file, {})
  console.log(`${todo.length} dishes without a photo; ${Object.values(out).filter((d) => !d.error).length} already searched`)
  for (const { _id, name } of todo) {
    if (out[name] && !out[name].error) continue
    const entry = { id: String(_id), name, photos: [] }
    for (const [id, search] of [['mealdb', mealDb], ['openverse', openverse]]) {
      if (entry.photos.length >= PER_DISH) break
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          entry.photos.push(...(await search(name)))
          delete entry.error
          break
        } catch (e) {
          if (e.limited) {
            console.log(`${id} rate-limited us; run again later for the rest`)
            return out
          }
          entry.error = `${id}: ${e.message}`
          await sleep(10000)
        }
      }
      await sleep(id === 'openverse' ? 3500 : 300) // Openverse allows ~20 anonymous requests a minute
    }
    entry.photos = entry.photos.slice(0, PER_DISH)
    out[name] = entry
    fs.writeFileSync(file, JSON.stringify(out, null, 1))
    console.log(`${entry.error ? 'FAILED' : String(entry.photos.length).padStart(6)}  ${name}`)
  }
  return out
}

async function save() {
  const picks = readJson(file, [])
  const images = readJson(IMAGES, {})
  const credits = readJson(CREDITS, {})
  let saved = 0
  for (const { id, name, photo } of picks) {
    try {
      const key = await saveDishPhoto(await download(photo.url), name)
      await FoodName.updateOne({ _id: id }, { $set: { image: key } })
      images[name] = key
      const { url, ...credit } = photo
      credits[name] = { ...credit, image: url }
      saved++
      console.log(`saved ${name}`)
    } catch (e) {
      console.log(`could not save ${name}: ${e.message}`)
    }
    await sleep(500)
  }
  fs.writeFileSync(IMAGES, JSON.stringify(images, null, 1) + '\n')
  fs.writeFileSync(CREDITS, JSON.stringify(credits, null, 1) + '\n')
  console.log(`saved ${saved} of ${picks.length}`)
}

async function main() {
  if (!['find', 'save'].includes(mode) || !file) throw new Error('usage: fill-dish-images.js find|save <file.json>')
  await mongoose.connect(process.env.MONGO_URI)
  await (mode === 'find' ? find() : save())
  await mongoose.disconnect()
}

main().catch(async (e) => {
  console.error(e.message)
  await mongoose.disconnect()
  process.exit(1)
})
