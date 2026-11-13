// Gives common dishes without a default photo one from TheMealDB or Openverse,
// copied to S3 like an admin-picked one. Only a photo whose name or tags hold
// the dish's whole name is taken (the top search result is often another dish).
// Dishes already covered by a shorter dish's photo ("Plain Dosa" -> Dosa) are
// skipped. Safe to re-run: it only looks at dishes still without a photo.
//   node scripts/fill-dish-images.js --dry    # list what it would take
//   node scripts/fill-dish-images.js          # upload and save
// Every photo's source and licence goes to data/dish_image_credits.json.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const FoodName = require('../models/FoodName')
const { defaultImages, dishKey } = require('../utils/dishCandidates')
const { saveDishPhoto } = require('../controllers/dishController')

const DRY = process.argv.includes('--dry')
const IMAGES = path.join(__dirname, '..', 'data', 'dish_images.json')
const CREDITS = path.join(__dirname, '..', 'data', 'dish_image_credits.json')
const UA = { 'User-Agent': 'GullyEats dish photos' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** Whether `text` names the dish: its whole name as words ("Vada Pav Recipe" names Vada Pav). */
const names = (text, dish) => ` ${dishKey(text)} `.includes(` ${dishKey(dish)} `)

async function getJson(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) })
  if (r.status === 429) throw Object.assign(new Error('rate limited'), { limited: true })
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}`)
  return r.json()
}

async function mealDb(name) {
  const { meals } = await getJson(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(name)}`)
  const m = (meals || []).find((x) => dishKey(x.strMeal) === dishKey(name))
  return m && { url: m.strMealThumb, source: 'TheMealDB', page: `https://www.themealdb.com/meal/${m.idMeal}`, license: 'TheMealDB' }
}

// Only licences that allow commercial use; BY/BY-SA ones need the credit kept.
async function openverse(name) {
  const { results } = await getJson(
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(name)}&license_type=commercial&page_size=20&mature=false`,
  )
  const o = (results || []).find((x) => names(x.title || '', name) || (x.tags || []).some((t) => dishKey(t.name) === dishKey(name)))
  return o && {
    url: o.url, source: 'Openverse', page: o.foreign_landing_url, title: o.title, creator: o.creator,
    license: `${o.license} ${o.license_version || ''}`.trim(),
  }
}

async function download(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
  if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image/')) throw new Error(`download failed (${r.status})`)
  const raw = Buffer.from(await r.arrayBuffer())
  if (raw.length > 15 * 1024 * 1024) throw new Error('image too large')
  return raw
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI)
  const imageFor = await defaultImages()
  const todo = (await FoodName.find({ image: null }, { name: 1 }).sort({ popularity: -1 }).lean()).filter((d) => !imageFor(d.name))
  const images = JSON.parse(fs.readFileSync(IMAGES, 'utf8'))
  const credits = fs.existsSync(CREDITS) ? JSON.parse(fs.readFileSync(CREDITS, 'utf8')) : {}
  const sources = { mealDb, openverse }
  const off = new Set() // sources that rate-limited us this run
  let saved = 0
  console.log(`${todo.length} dishes without a photo${DRY ? ' (dry run)' : ''}`)

  for (const { _id, name } of todo) {
    let found = null
    for (const [id, search] of Object.entries(sources)) {
      if (off.has(id)) continue
      try {
        found = await search(name)
      } catch (e) {
        if (e.limited) {
          off.add(id)
          console.log(`  ${id} rate-limited us; run again later for the rest`)
        } else console.log(`  ${id} failed for ${name}: ${e.message}`)
      }
      await sleep(id === 'openverse' ? 4000 : 300) // Openverse allows ~20 anonymous requests a minute
      if (found) break
    }
    if (off.size === Object.keys(sources).length) break
    if (!found) continue
    console.log(`${found.source.padEnd(9)} ${name}  <-  ${found.title || ''} ${found.page || found.url}`)
    if (DRY) continue
    try {
      const key = await saveDishPhoto(await download(found.url), name)
      await FoodName.updateOne({ _id }, { $set: { image: key } })
      images[name] = key
      const { url, ...credit } = found
      credits[name] = { ...credit, image: url }
      saved++
    } catch (e) {
      console.log(`  could not save ${name}: ${e.message}`)
    }
  }

  if (!DRY) {
    fs.writeFileSync(IMAGES, JSON.stringify(images, null, 1) + '\n')
    fs.writeFileSync(CREDITS, JSON.stringify(credits, null, 1) + '\n')
  }
  console.log(`saved ${saved}`)
  await mongoose.disconnect()
}

main().catch(async (e) => {
  console.error(e.message)
  await mongoose.disconnect()
  process.exit(1)
})
