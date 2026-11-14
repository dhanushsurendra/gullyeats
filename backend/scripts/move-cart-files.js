// One-off (2026-11): moves cart files from the old S3 layout to carts/<cartId>/
//   uploads/<cartId>.<ext>             -> carts/<cartId>/photo
//   uploads/<cartId>/menu/<file>       -> carts/<cartId>/menu/<file>
//   qrs/<cartId>.png                   -> carts/<cartId>/qr.png
// For each file: copy, point the database at the copy, then delete the old file.
// dish-images/ is not touched. Safe to re-run: only old-layout URLs match.
//   node scripts/move-cart-files.js [--dry]
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')
const { CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { s3Client } = require('../utils/s3Client')
const Cart = require('../models/Cart')
const MenuItem = require('../models/Menu')

const dry = process.argv.includes('--dry')
const Bucket = process.env.BUCKET_NAME
const base = `https://${Bucket}.s3.amazonaws.com/`

// Old URL -> new key, or null when it isn't an old-layout file of this cart.
function newKey(url, cartId) {
  if (typeof url !== 'string' || !url.startsWith(base)) return null
  const key = decodeURIComponent(url.slice(base.length).split('?')[0])
  let m
  if ((m = key.match(/^uploads\/([^/]+)\.(jpe?g|png|webp)$/)) && m[1] === cartId) return [key, `carts/${cartId}/photo`]
  if ((m = key.match(/^uploads\/([^/]+)\/menu\/([\w-]+\.\w+)$/)) && m[1] === cartId) return [key, `carts/${cartId}/menu/${m[2]}`]
  if ((m = key.match(/^qrs\/([^/]+)\.png$/)) && m[1] === cartId) return [key, `carts/${cartId}/qr.png`]
  return null
}

let moved = 0
let failed = 0
async function move(url, cartId, save) {
  const keys = newKey(url, cartId)
  if (!keys) return
  const [from, to] = keys
  console.log(`${dry ? 'would move' : 'move'} ${from} -> ${to}`)
  if (dry) return void moved++
  try {
    await s3Client.send(new CopyObjectCommand({ Bucket, CopySource: `${Bucket}/${encodeURI(from)}`, Key: to }))
    await save(base + to + (to.endsWith('/photo') ? `?v=${Date.now()}` : ''))
    await s3Client.send(new DeleteObjectCommand({ Bucket, Key: from }))
    moved++
  } catch (e) {
    // The database keeps the old URL until the copy worked, so nothing breaks.
    failed++
    console.error(`  failed: ${e.message}`)
  }
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log(`db ${mongoose.connection.db.databaseName}, bucket ${Bucket}${dry ? ' (dry run)' : ''}`)
  for (const c of await Cart.find().select('cartImageUrl qrImageUrl').lean()) {
    const id = String(c._id)
    await move(c.cartImageUrl, id, (u) => Cart.updateOne({ _id: c._id }, { $set: { cartImageUrl: u } }))
    await move(c.qrImageUrl, id, (u) => Cart.updateOne({ _id: c._id }, { $set: { qrImageUrl: u } }))
  }
  for (const i of await MenuItem.find({ imageUrl: { $regex: '/uploads/' } }).select('cartId imageUrl').lean()) {
    await move(i.imageUrl, String(i.cartId), (u) => MenuItem.updateOne({ _id: i._id }, { $set: { imageUrl: u } }))
  }
  console.log(`${dry ? 'would move' : 'moved'} ${moved}, failed ${failed}`)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
