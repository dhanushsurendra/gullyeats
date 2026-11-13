import { test } from 'node:test'
import assert from 'node:assert'
import { nextPhone, phoneError } from './phone.js'

test('an 11th digit is refused; a pasted +91 or 0 prefix is dropped', () => {
  assert.strictEqual(nextPhone('98765 4321'), '987654321')
  assert.strictEqual(nextPhone('98765432101'), null)
  assert.strictEqual(nextPhone('+91 98765 43210'), '9876543210')
  assert.strictEqual(nextPhone('09876543210'), '9876543210')
  assert.strictEqual(nextPhone('919876543210'), '9876543210')
  assert.strictEqual(nextPhone('1919876543210'), null)
})

test('short or wrongly started numbers are invalid; empty and valid are not', () => {
  assert.strictEqual(phoneError(''), '')
  assert.strictEqual(phoneError('9876543210'), '')
  assert.match(phoneError('98765'), /5\/10/)
  assert.match(phoneError('1234567890'), /start with 6, 7, 8 or 9/)
})
