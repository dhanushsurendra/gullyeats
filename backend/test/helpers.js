// Calls an asyncHandler-wrapped controller with fake req/res and returns
// what errorHandler would send. Models are stubbed per test with stub().
const errorHandler = require('../middlewares/errorHandler')

function call(handler, { params = {}, body = {}, query = {}, user, headers = {} } = {}) {
  const emits = []
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this },
      json(payload) { resolve({ status: this.statusCode, body: payload, emits }); return this },
    }
    const req = {
      params, body, query, user, headers,
      io: { to: (room) => ({ emit: (event, data) => emits.push({ room, event, data }) }) },
    }
    handler(req, res, (err) => {
      if (err) errorHandler(err, req, res)
      else resolve({ status: res.statusCode, next: true, emits, req })
    })
  })
}

// Replaces obj[key] for one test; returns a restore function.
const restores = []
function stub(obj, key, value) {
  const original = obj[key]
  obj[key] = value
  restores.push(() => { obj[key] = original })
}
function restoreAll() {
  while (restores.length) restores.pop()()
}

// A query result that supports .select()/.lean()/.sort() chaining and await.
function q(value) {
  const p = Promise.resolve(value)
  p.select = () => q(value)
  p.lean = () => q(value)
  p.sort = () => q(value)
  return p
}

module.exports = { call, stub, restoreAll, q }
