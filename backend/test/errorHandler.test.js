const test = require('node:test')
const assert = require('node:assert')
const errorHandler = require('../middlewares/errorHandler')

function run(err, presetStatus) {
  const res = {
    statusCode: presetStatus || 200,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
  const quiet = console.error
  console.error = () => {}
  try {
    errorHandler(err, { method: 'GET', originalUrl: '/x' }, res)
  } finally {
    console.error = quiet
  }
  return res
}

test('a message the controller chose reaches the client', () => {
  const res = run(new Error('Cart not found'), 404)
  assert.equal(res.statusCode, 404)
  assert.equal(res.body.message, 'Cart not found')
})

test('a 4xx from a library (body too large) keeps its status and message', () => {
  const res = run(Object.assign(new Error('request entity too large'), { status: 413 }))
  assert.equal(res.statusCode, 413)
  assert.equal(res.body.message, 'request entity too large')
})

test('an unexpected error is a 500 with a generic message, never its internals', () => {
  const res = run(new Error("Can't extract geo keys: { _id: ObjectId('abc'), userId: ... }"))
  assert.equal(res.statusCode, 500)
  assert.equal(res.body.message, 'Something went wrong. Please try again.')
})

test('a bad id is a 400', () => {
  const res = run(Object.assign(new Error('Cast to ObjectId failed'), { name: 'CastError' }))
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.message, 'Invalid ID')
})
