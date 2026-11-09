/*
 * Sets a new dashboard password for an existing admin. Asks for it at the
 * prompt, so it never lands in shell history.
 *
 *   node scripts/set-admin-password.js admin@example.com
 */
require('dotenv').config({ quiet: true })
const readline = require('readline')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const email = (process.argv[2] || '').trim().toLowerCase()
if (!email) {
  console.error('Usage: node scripts/set-admin-password.js <admin email>')
  process.exit(1)
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.question('New password (at least 8 characters): ', async (password) => {
  rl.close()
  if (password.length < 8) {
    console.error('Too short, nothing changed.')
    process.exit(1)
  }
  await mongoose.connect(process.env.MONGO_URI)
  const r = await mongoose.connection.db
    .collection('users')
    .updateOne({ email, role: 'admin' }, { $set: { pinHash: await bcrypt.hash(password, 10) } })
  console.log(r.matchedCount ? `Password updated for ${email}.` : `No admin with email ${email}, nothing changed.`)
  await mongoose.disconnect()
  process.exit(r.matchedCount ? 0 : 1)
})
