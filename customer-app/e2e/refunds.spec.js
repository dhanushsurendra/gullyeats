// RCT-112..117, ADM-058..060: refunds on paid orders that were cancelled or made
// smaller. The vendor app's "Mark refunded" (owner or staff) is driven through its API;
// the customer and admin sides in the browser.
import { test, expect } from '@playwright/test'
import { adminLogin, call, onboardVendor, placeOrder, qaPhone, secrets, vendorOrder } from './helpers.js'
import { ADMIN } from './urls.js'

let v, admin, staffToken
test.beforeAll(async () => {
  v = await onboardVendor({ cartName: `QA-Refund ${Date.now() % 1e5}` })
  admin = await adminLogin()
  const s = await call('POST', `/carts/add-staff/${v.cartId}`, { token: v.token, body: { name: 'QA-Staff', phoneNumber: qaPhone() } })
  staffToken = (await call('POST', '/vendors/login', { body: { vendorIdentifier: s.body.data.phoneNumber, pin: s.body.data.pinHash } })).body.token
})
const item = (name) => v.menu.find((m) => m.name === name)
const paidInBrowser = async (page, names) => {
  const id = await placeOrder(page, v.cartId, names)
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await expect(page.getByText("Paid. You're in the queue")).toBeVisible()
  return id
}

test('RCT-112 a vendor cancels a paid order: owed, then marked refunded by staff, live on the customer page', async ({ page }) => {
  const id = await paidInBrowser(page, ['Masala Dosa'])
  await call('DELETE', `/orders/delete-order/${id}`, { token: v.token })
  await expect(page).toHaveURL(/\/cancelled$/)
  await expect(page.getByText('Collect your money back from the vendor')).toBeVisible()
  await expect(page.getByText(/₹\s?62/)).toBeVisible()

  const r = await call('PUT', `/orders/mark-refunded/${id}`, { token: staffToken })
  expect(r.status, r.body.message).toBe(200)
  await expect(page.getByText(/₹\s?62 refunded/)).toBeVisible()
  await expect(page.getByText('The cart says it handed this back.')).toBeVisible()
  const saved = (await vendorOrder(v, id)).refunds
  expect(saved).toHaveLength(1)
  expect(saved[0]).toMatchObject({ amount: 62, reason: 'CANCELLED' })
  expect(saved[0].refundedBy.role).toBe('staff')
  // Nothing left to refund.
  expect((await call('PUT', `/orders/mark-refunded/${id}`, { token: v.token })).status).toBe(400)
})

test('RCT-113 the vendor takes items off a paid order: owed on the token page, then refunded by the owner', async ({ page }) => {
  const id = await paidInBrowser(page, ['Masala Dosa', 'Pani Puri'])
  await call('PUT', `/orders/update-order/${id}`, { token: v.token, body: { orderItems: [{ menuItemId: item('Masala Dosa')._id, quantity: 1 }] } })
  await expect(page.getByText(/Collect ₹\s?30 back from the vendor/)).toBeVisible()
  await call('PUT', `/orders/mark-refunded/${id}`, { token: v.token })
  await expect(page.getByText(/₹\s?30 refunded/)).toBeVisible()
  expect((await vendorOrder(v, id)).refunds[0]).toMatchObject({ amount: 30, reason: 'EDITED', refundedBy: { role: 'vendor' } })
})

test('RCT-114 two cuts on the same order are both kept, and one Mark refunded settles both', async ({ page }) => {
  const id = await paidInBrowser(page, ['Masala Dosa', 'Pani Puri', 'Chicken Roll'])
  const set = (items) => call('PUT', `/orders/update-order/${id}`, { token: v.token, body: { orderItems: items } })
  await set([{ menuItemId: item('Masala Dosa')._id, quantity: 1 }, { menuItemId: item('Pani Puri')._id, quantity: 1 }])
  await set([{ menuItemId: item('Masala Dosa')._id, quantity: 1 }])
  const before = (await vendorOrder(v, id)).refunds
  expect(before.map((r) => r.amount)).toEqual([90, 30])
  await expect(page.getByText(/Collect ₹\s?120 back from the vendor/)).toBeVisible()
  await call('PUT', `/orders/mark-refunded/${id}`, { token: v.token })
  expect((await vendorOrder(v, id)).refunds.every((r) => r.refundedAt)).toBe(true)
})

test('RCT-115 "Didn\'t get it?" flags the refund once; another phone cannot flag it', async ({ page }) => {
  const id = await paidInBrowser(page, ['Pani Puri'])
  await call('DELETE', `/orders/delete-order/${id}`, { token: v.token })
  await call('PUT', `/orders/mark-refunded/${id}`, { token: v.token })
  await expect(page.getByText(/₹\s?32 refunded/)).toBeVisible()
  // Another order's key can't flag this one.
  const other = await call('POST', '/orders/create-order', { body: { cartId: v.cartId, orderItems: [{ menuItemId: item('Pani Puri')._id, quantity: 1 }] } })
  const otherKey = `${other.body.data._id}.${other.body.data.accessKey}`
  expect([401, 403, 404]).toContain((await call('POST', `/orders/flag-refund/${id}`, { headers: { 'X-Gully-Order': otherKey } })).status)

  await page.getByRole('button', { name: "Didn't get it?" }).click()
  await expect(page.getByText("You told us you didn't get it. GullyEats is checking with the cart.")).toBeVisible()
  await page.reload()
  await expect(page.getByText("You told us you didn't get it. GullyEats is checking with the cart.")).toBeVisible()
  expect((await vendorOrder(v, id)).refunds[0].flaggedAt).toBeTruthy()
})

test('RCT-116 nothing to flag before a refund is marked', async ({ page }) => {
  const id = await paidInBrowser(page, ['Pani Puri'])
  await call('DELETE', `/orders/delete-order/${id}`, { token: v.token })
  await expect(page.getByRole('button', { name: "Didn't get it?" })).toHaveCount(0)
  const key = await page.evaluate((oid) => {
    const o = JSON.parse(JSON.parse(localStorage.getItem('persist:gullyeats')).orders).find((x) => x._id === oid)
    return `${o._id}.${o.accessKey}`
  }, id)
  expect((await call('POST', `/orders/flag-refund/${id}`, { headers: { 'X-Gully-Order': key } })).status).toBe(400)
})

test('RCT-117 undoing a cancel: an unrefunded refund disappears; a refunded one must be paid again', async () => {
  const pay = async () => {
    const o = await call('POST', '/orders/create-order', { body: { cartId: v.cartId, orderItems: [{ menuItemId: item('Pani Puri')._id, quantity: 1 }] } })
    await call('PUT', `/orders/mark-order-paid/${o.body.data._id}`, { token: v.token })
    return o.body.data._id
  }
  const a = await pay()
  await call('DELETE', `/orders/delete-order/${a}`, { token: v.token })
  const undoA = (await call('PUT', `/orders/delete-order-undo/${a}`, { token: v.token })).body.data
  expect(undoA).toMatchObject({ status: 'PAID', refunds: [] })

  const b = await pay()
  await call('DELETE', `/orders/delete-order/${b}`, { token: v.token })
  await call('PUT', `/orders/mark-refunded/${b}`, { token: v.token })
  const undoB = (await call('PUT', `/orders/delete-order-undo/${b}`, { token: v.token })).body.data
  expect(undoB.status).toBe('PENDING') // the money went back, so it's owed again
  expect(undoB.paidAmount).toBe(0)
})

test('RCT-118 only the cart\'s owner and staff can mark refunds', async () => {
  const o = await call('POST', '/orders/create-order', { body: { cartId: v.cartId, orderItems: [{ menuItemId: item('Pani Puri')._id, quantity: 1 }] } })
  const id = o.body.data._id
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await call('DELETE', `/orders/delete-order/${id}`, { token: v.token })
  const stranger = await onboardVendor({ cartName: `QA-Stranger ${Date.now() % 1e5}`, open: false })
  expect([403, 404]).toContain((await call('PUT', `/orders/mark-refunded/${id}`, { token: stranger.token })).status)
  expect((await call('PUT', `/orders/mark-refunded/${id}`)).status).toBe(401)
  expect((await call('PUT', `/orders/mark-refunded/${id}`, { headers: { 'X-Gully-Order': `${id}.${o.body.data.accessKey}` } })).status).toBe(401)
})

test.describe('admin', () => {
  test.use({ baseURL: ADMIN, viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false })
  async function signIn(page) {
    const { adminEmail, adminPassword } = secrets()
    await page.goto('/login')
    await page.locator('input[type=email]').fill(adminEmail)
    await page.locator('input[type=password]').fill(adminPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).not.toHaveURL(/\/login/)
  }
  const cancelledPaid = async () => {
    const o = await call('POST', '/orders/create-order', { body: { cartId: v.cartId, orderItems: [{ menuItemId: item('Masala Dosa')._id, quantity: 1 }] } })
    const id = o.body.data._id
    await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
    await call('DELETE', `/orders/delete-order/${id}`, { token: v.token })
    return { id, number: o.body.data.orderNumber, key: `${id}.${o.body.data.accessKey}` }
  }

  test('ADM-058 Collections > Refunds lists refunds not handed back; they leave once marked', async ({ page }) => {
    const o = await cancelledPaid()
    await signIn(page)
    await page.goto('/collections?refunds=owed')
    await page.getByPlaceholder('Filter tables…').fill(v.cartName)
    const row = page.getByRole('row').filter({ hasText: `#${o.number}` })
    await expect(row).toContainText('₹62')
    await expect(row).toContainText('Cancelled')
    await call('PUT', `/orders/mark-refunded/${o.id}`, { token: staffToken })
    await page.reload()
    await page.getByPlaceholder('Filter tables…').fill(v.cartName)
    await expect(page.getByRole('row').filter({ hasText: `#${o.number}` })).toHaveCount(0)
  })

  test('ADM-059 a customer flag shows under "Customer says not refunded" with who marked it; Resolve logs it', async ({ page }) => {
    const o = await cancelledPaid()
    await call('PUT', `/orders/mark-refunded/${o.id}`, { token: staffToken })
    expect((await call('POST', `/orders/flag-refund/${o.id}`, { headers: { 'X-Gully-Order': o.key } })).status).toBe(200)
    expect((await call('POST', `/orders/flag-refund/${o.id}`, { headers: { 'X-Gully-Order': o.key } })).status).toBe(409)
    await signIn(page)
    await page.goto('/collections')
    await page.getByRole('button', { name: 'Customer says not refunded' }).click()
    await expect(page).toHaveURL(/refunds=flagged/)
    await page.getByPlaceholder('Filter tables…').fill(v.cartName)
    const row = page.getByRole('row').filter({ hasText: `#${o.number}` })
    await expect(row).toContainText('₹62')
    await expect(row).toContainText('QA-Staff (staff)')
    await row.getByRole('button', { name: 'Resolve' }).click()
    await page.getByRole('dialog').getByRole('textbox').fill('QA called the cart, paid in cash')
    await page.getByRole('dialog').getByRole('button', { name: 'Resolved' }).click()
    await expect(row).toContainText('Resolved')
    const log = (await call('GET', '/admin/actions?action=RESOLVE_REFUND_FLAG&limit=10', { token: admin })).body.data.items
    expect(log.find((a) => a.target.startsWith(`#${o.number} `))).toMatchObject({ by: 'QA Admin', details: { reason: 'QA called the cart, paid in cash' } })
    await page.reload()
    await page.getByPlaceholder('Filter tables…').fill(v.cartName)
    await expect(page.getByRole('row').filter({ hasText: `#${o.number}` })).toHaveCount(0)
  })

  test('ADM-060 the dashboard raises flagged refunds and opens the list from Attention Required', async ({ page }) => {
    const o = await cancelledPaid()
    await call('PUT', `/orders/mark-refunded/${o.id}`, { token: v.token })
    await call('POST', `/orders/flag-refund/${o.id}`, { headers: { 'X-Gully-Order': o.key } })
    await signIn(page)
    const card = page.locator('div.rise.rounded-2xl').filter({ has: page.getByRole('heading', { name: 'Attention Required', exact: true }) })
    const item = card.getByText('Customers say they were not refunded', { exact: true })
    await expect(item).toBeVisible({ timeout: 30_000 })
    await item.locator('xpath=ancestor::div[.//button[normalize-space()="Review"]][1]').getByRole('button', { name: 'Review' }).click()
    await expect(page).toHaveURL(/\/collections\?refunds=flagged$/)
    await call('POST', `/admin/refunds/${o.id}/resolve`, { token: admin, body: { reason: 'QA' } })
  })
})
