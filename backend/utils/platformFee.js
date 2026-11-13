const Setting = require('../models/Setting')

// Until an admin sets one, the fee GullyEats has always charged.
const DEFAULT_FEE = 2
const MAX_FEE = 100

/** GullyEats' current fee per order, in rupees. */
async function getPlatformFee() {
  const s = await Setting.findById('global').select('platformFee').lean()
  return s?.platformFee ?? DEFAULT_FEE
}

async function setPlatformFee(fee) {
  await Setting.updateOne({ _id: 'global' }, { platformFee: fee }, { upsert: true })
}

module.exports = { getPlatformFee, setPlatformFee, DEFAULT_FEE, MAX_FEE }
