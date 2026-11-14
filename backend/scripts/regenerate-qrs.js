// Redraws every cart's QR image (S3 carts/<cartId>/qr.png) to open <base>/c/<cartId>,
// e.g. after moving the customer app to a new domain. Posters already printed
// keep their old address, so keep that domain live and allowed.
//   node scripts/regenerate-qrs.js https://gullyeats.in [--dry]
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')
const Cart = require('../models/Cart')
const { uploadCartQr } = require('../utils/cartQr')

async function main() {
  const base = String(process.argv[2] || '').replace(/\/+$/, '')
  if (!/^https:\/\/[^/]+$/.test(base)) throw new Error('Usage: node scripts/regenerate-qrs.js https://<customer-app-domain> [--dry]')
  const dry = process.argv.includes('--dry')

  await mongoose.connect(process.env.MONGO_URI)
  // Only carts that already have a QR: the rest get one when onboarding reaches the poster.
  const carts = await Cart.find({ qrImageUrl: { $nin: [null, ''] } }).select('_id').lean()
  console.log(`${carts.length} carts with a QR → ${base}/c/<cartId>${dry ? ' (dry run)' : ''}`)
  let done = 0
  for (const { _id } of carts) {
    if (!dry) {
      const url = await uploadCartQr(String(_id), base)
      await Cart.updateOne({ _id }, { $set: { qrImageUrl: url } })
    }
    done++
  }
  console.log(`${dry ? 'Would redraw' : 'Redrew'} ${done}`)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
