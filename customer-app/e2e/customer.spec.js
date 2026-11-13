// RCT-xxx: the customer web app, opened the way a QR scan opens it.
import { test, expect } from '@playwright/test'
import { call, customerOrder, onboardVendor, paidOrder, state } from './helpers.js'

let v
test.beforeAll(() => { v = state().vendor })
const toggle = (isOpen) => call('PUT', `/carts/toggle-cart-status/${v.cartId}`, { token: v.token, body: { isOpen } })

async function addToBasket(page, names) {
  await page.goto(`/c/${v.cartId}/menu`)
  for (const n of names) await page.getByRole('button', { name: `Add ${n}`, exact: true }).click()
}

test('RCT-001 the QR link opens the cart welcome page', async ({ page }) => {
  await page.goto(`/c/${v.cartId}`)
  await expect(page.getByText('QA-Cart').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start my order' })).toBeVisible()
})

test('RCT-002 an unknown or malformed cart shows an error with retry', async ({ page }) => {
  for (const id of ['000000000000000000000000', 'abc']) {
    await page.goto(`/c/${id}/welcome`)
    await expect(page.getByText("Couldn't open this cart")).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  }
})

test('RCT-003 an unknown route shows the not-found page', async ({ page }) => {
  await page.goto('/definitely/not/here')
  await expect(page.locator('body')).not.toBeEmpty()
  await expect(page).not.toHaveURL(/\/c\//)
})

test('RCT-004 the menu lists items with veg marks', async ({ page }) => {
  await page.goto(`/c/${v.cartId}/menu`)
  for (const n of ['Masala Dosa', 'Pani Puri', 'Chicken Roll']) await expect(page.getByText(n).first()).toBeVisible()
  await expect(page.getByLabel('Non-veg').first()).toBeVisible()
})

test('RCT-005 a menu API failure shows retry', async ({ page }) => {
  await page.route('**/carts/get-menu-items/**', (r) => r.fulfill({ status: 500, body: '{}' }))
  await page.goto(`/c/${v.cartId}/menu`)
  await expect(page.getByText("Couldn't load the menu")).toBeVisible()
  await page.unroute('**/carts/get-menu-items/**')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Masala Dosa').first()).toBeVisible()
})

test('RCT-007/008 basket totals, +/- and reload persistence', async ({ page }) => {
  await addToBasket(page, ['Masala Dosa', 'Pani Puri'])
  await page.getByRole('button', { name: 'Add one more Masala Dosa' }).click()
  await page.getByRole('button', { name: 'Remove one Pani Puri' }).click()
  await page.reload()
  await page.getByRole('button', { name: /View cart/ }).click()
  await expect(page).toHaveURL(/\/cart$/)
  // 2 x 60 + Rs 2 platform fee
  await expect(page.getByRole('button', { name: /Place order · ₹\s?122/ })).toBeVisible()
})

test('RCT-009 an empty cart offers Browse the menu', async ({ page }) => {
  await page.goto(`/c/${v.cartId}/cart`)
  await expect(page.getByRole('button', { name: 'Browse the menu' })).toBeVisible()
})

test('RCT-010 the phone number must be a 10-digit mobile', async ({ page }) => {
  await addToBasket(page, ['Pani Puri'])
  await page.goto(`/c/${v.cartId}/cart`)
  await page.locator('#phone').fill('12345')
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page.getByRole('alert')).toHaveText('Enter a 10-digit mobile number, or leave it empty.')
})

test('RCT-011/012 placing an order once, even on a double click', async ({ page }) => {
  await addToBasket(page, ['Masala Dosa'])
  await page.goto(`/c/${v.cartId}/cart`)
  const posts = []
  page.on('request', (r) => r.url().includes('/orders/create-order') && posts.push(r))
  await page.getByRole('button', { name: /Place order/ }).dblclick()
  await expect(page.getByText('Your token', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/order\/[a-f0-9]{24}$/)
  expect(posts.length).toBe(1)
})

test('RCT-013 a closed cart cannot take the order', async ({ page }) => {
  await addToBasket(page, ['Masala Dosa'])
  await page.goto(`/c/${v.cartId}/cart`)
  await expect(page.getByRole('button', { name: /Place order/ })).toBeEnabled()
  try {
    // Closed while the cart page is open: the server refuses, the page catches up.
    await toggle(false)
    await page.getByRole('button', { name: /Place order/ }).click()
    await expect(page.getByRole('alert')).toHaveText('This cart is not taking orders right now')
    await expect(page.getByRole('button', { name: /Place order/ })).toBeDisabled()
    // Coming back to the cart page later: the closed state is fetched, not cached.
    await page.goto(`/c/${v.cartId}/menu`)
    await page.goto(`/c/${v.cartId}/cart`)
    await expect(page.getByText("This cart is closed right now, so it can't take your order.")).toBeVisible()
    await expect(page.getByRole('button', { name: /Place order/ })).toBeDisabled()
  } finally {
    await toggle(true)
  }
})

test('RCT-014 the token page follows the vendor live to served', async ({ page }) => {
  await addToBasket(page, ['Pani Puri'])
  await page.goto(`/c/${v.cartId}/cart`)
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page.getByText('Your token', { exact: true })).toBeVisible()
  const id = page.url().split('/').pop()
  await expect(page.getByText(/Pay ₹\s?32 at the counter/)).toBeVisible()

  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await expect(page.getByText("Paid. You're in the queue")).toBeVisible()
  await call('PUT', `/orders/preparing/${id}`, { token: v.token, body: { preparing: true } })
  await expect(page.getByText('Your food is being prepared')).toBeVisible()
  await call('PUT', `/orders/serve-order/${id}`, { token: v.token })
  await expect(page).toHaveURL(/\/served$/)
  await expect(page.getByText('Your food is ready!')).toBeVisible()
})

test('RCT-017 adding items to a pending order updates its total', async ({ page }) => {
  await addToBasket(page, ['Pani Puri'])
  await page.goto(`/c/${v.cartId}/cart`)
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page.getByText('Your token', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add or change items' }).click()
  await page.getByRole('button', { name: 'Add Masala Dosa', exact: true }).click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText(/Pay ₹\s?92 at the counter/)).toBeVisible()
})

test('RCT-018 a customer can cancel an unpaid order', async ({ page }) => {
  await addToBasket(page, ['Pani Puri'])
  await page.goto(`/c/${v.cartId}/cart`)
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page.getByText('Your token', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel order' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, cancel order' }).click()
  await expect(page).toHaveURL(/\/cancelled$/)
})

test('RCT-019 a paid order cannot be cancelled by the customer', async () => {
  const o = await customerOrder(v.cartId, [{ menuItemId: v.menu[0]._id, quantity: 1 }])
  await call('PUT', `/orders/mark-order-paid/${o.body.data._id}`, { token: v.token })
  const r = await call('DELETE', `/orders/delete-order/${o.body.data._id}`, { headers: { 'X-Gully-Order': o.key } })
  expect(r.status).toBe(400)
  expect(r.body.message).toBe('This order is already paid. Ask the cart to cancel it.')
})

test('RCT-021 another browser cannot open someone else’s order', async ({ page }) => {
  const o = await customerOrder(v.cartId, [{ menuItemId: v.menu[0]._id, quantity: 1 }])
  await page.goto(`/c/${v.cartId}/order/${o.body.data._id}`)
  await expect(page.getByText("Couldn't load your order")).toBeVisible()
  await expect(page.getByText('Your token', { exact: true })).toHaveCount(0)
})

test('RCT-022 the theme toggle sticks after reload', async ({ page }) => {
  await page.goto(`/c/${v.cartId}/welcome`)
  const toggleBtn = page.getByRole('button', { name: /Switch to (light|dark) theme/ })
  const before = await toggleBtn.getAttribute('aria-label')
  await toggleBtn.click()
  await page.reload()
  await expect(page.getByRole('button', { name: /Switch to (light|dark) theme/ })).not.toHaveAttribute('aria-label', before)
})

for (const width of [320, 375, 768, 1280]) {
  test(`RCT-023 no sideways scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    for (const path of [`/c/${v.cartId}/welcome`, `/c/${v.cartId}/menu`, '/confessions']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0)
    }
  })
}

test('RCT-024 the menu can be used from the keyboard', async ({ page }) => {
  await page.goto(`/c/${v.cartId}/menu`)
  const add = page.getByRole('button', { name: 'Add Pani Puri', exact: true })
  await add.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /View cart/ })).toBeVisible()
})

test('RCT-025 every button has an accessible name', async ({ page }) => {
  for (const path of [`/c/${v.cartId}/welcome`, `/c/${v.cartId}/menu`]) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const unnamed = await page.$$eval('button, a[href], [role=button]', (els) =>
      els.filter((e) => !(e.getAttribute('aria-label') || e.textContent.trim() || e.getAttribute('title'))).map((e) => e.outerHTML.slice(0, 120)))
    expect(unnamed, path).toEqual([])
  }
})

test('RCT-026 placing an order offline shows the offline message', async ({ page, context }) => {
  await addToBasket(page, ['Pani Puri'])
  await page.goto(`/c/${v.cartId}/cart`)
  await context.setOffline(true)
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page.getByRole('alert')).toHaveText('No internet connection. Check your network and try again.')
  await context.setOffline(false)
})

test('RCT-027 GullyPulse without an order shows the locked screen (the feed itself: RCT-076)', async ({ page }) => {
  await page.goto('/confessions')
  await expect(page.getByText('Unlocks with your order')).toBeVisible()
  await expect(page.getByText(/went wrong|Couldn/)).toHaveCount(0)
})

/** Places an order from the browser (so the page holds its key) and returns its id. */
async function placeOrder(page, cartId, names) {
  await page.goto(`/c/${cartId}/menu`)
  for (const n of names) await page.getByRole('button', { name: `Add ${n}`, exact: true }).click()
  await page.goto(`/c/${cartId}/cart`)
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page.getByText('Your token', { exact: true })).toBeVisible()
  return page.url().split('/').pop()
}

test('RCT-006 an out-of-stock item is marked and cannot be added', async ({ page }) => {
  const stock = (isInStock) => call('PATCH', `/carts/update-stock/${v.cartId}/${v.menu[1]._id}`, { token: v.token, body: { isInStock } })
  await stock(false)
  try {
    await page.goto(`/c/${v.cartId}/menu`)
    await expect(page.getByText('Sold out for now')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Pani Puri', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add Masala Dosa', exact: true })).toBeVisible()
  } finally {
    await stock(true)
  }
})

test('RCT-015 the queue shows place in line and only other token numbers', async ({ page }) => {
  // A fresh cart, so the queue holds only this test's orders.
  const q = await onboardVendor({ cartName: `QA-Queue ${Date.now() % 1e5}` })
  const first = await paidOrder(q, 0)
  const second = await paidOrder(q, 1)
  const id = await placeOrder(page, q.cartId, ['Chicken Roll'])
  await expect(page.getByText('2 orders in the queue. Pay at the counter to join it.')).toBeVisible()

  await call('PUT', `/orders/mark-order-paid/${id}`, { token: q.token })
  await expect(page.getByText('2 orders ahead of you.')).toBeVisible()
  await expect(page.getByText(`#${first.body.data.orderNumber}`, { exact: true })).toBeVisible() // next up
  await call('PUT', `/orders/serve-order/${first.body.data._id}`, { token: q.token })
  await expect(page.getByText('1 order ahead of you.')).toBeVisible()
  await call('PUT', `/orders/preparing/${second.body.data._id}`, { token: q.token, body: { preparing: true } })
  await call('PUT', `/orders/serve-order/${second.body.data._id}`, { token: q.token })
  await expect(page.getByText("You're next.")).toBeVisible()

  // The queue API carries token numbers only: no names, phones, items or ids.
  const key = await page.evaluate((orderId) => {
    const root = JSON.parse(localStorage.getItem('persist:gullyeats') || '{}')
    const o = JSON.parse(root.orders || '[]').find((x) => x._id === orderId)
    return o && `${o._id}.${o.accessKey}`
  }, id)
  expect(key, 'order key kept on the phone').toBeTruthy()
  const r = await call('GET', `/orders/queue/${id}`, { headers: { 'X-Gully-Order': key } })
  expect(r.status).toBe(200)
  expect(Object.keys(r.body.data).sort()).toEqual(['ahead', 'isPreparing', 'nextUp', 'preparing', 'waiting'])
  expect(JSON.stringify(r.body.data)).not.toMatch(/[a-f0-9]{24}|phone|name/i)
})

test('RCT-016 back button and a re-scan lead back to the open order', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goBack()
  await page.goBack()
  await page.goto(`/c/${v.cartId}/menu`)
  const link = page.getByRole('button', { name: /Your token #\d+/ })
  await expect(link).toBeVisible()
  // A re-scan opens the QR link fresh: the welcome page links to the order too.
  await page.goto(`/c/${v.cartId}`)
  await expect(page.getByRole('button', { name: /Your token #\d+/ })).toBeVisible()
  await page.getByRole('button', { name: /Your token #\d+/ }).click()
  await expect(page).toHaveURL(new RegExp(`/order/${id}$`))
  await expect(page.getByText('Your token', { exact: true })).toBeVisible()
})

test('RCT-020 rate a served order with stars and text', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Masala Dosa'])
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await call('PUT', `/orders/serve-order/${id}`, { token: v.token })
  await expect(page).toHaveURL(/\/served$/)
  await page.getByRole('radio', { name: '4 stars' }).click()
  const text = `QA rating ${Date.now()}`
  await page.getByLabel('Your feedback').fill(text)
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByText('Thanks for your feedback!')).toBeVisible()
  const o = (await call('GET', `/orders/orders-today/${v.cartId}`, { token: v.token })).body.data
  const saved = (Array.isArray(o) ? o : o.orders || []).find((x) => x._id === id)
  expect(saved).toMatchObject({ rating: 4, feedback: text })
})

test('RCT-028 GullyPulse posting needs an order and refuses blocked words', async ({ page }) => {
  // No order on this phone: the page is locked and the API refuses.
  await page.goto('/confessions/new')
  await expect(page.getByText('Unlocks with your order')).toBeVisible()
  const refused = await call('POST', '/confessions', { body: { text: 'QA no order here, just trying to post this' } })
  expect(refused.status).toBeGreaterThanOrEqual(400)
  expect(refused.status).toBeLessThan(500)

  await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto('/confessions/new')
  const box = page.getByLabel('Your confession')
  await box.fill('QA test: what the fuck is this chutney, honestly amazing')
  await page.getByRole('button', { name: 'Post anonymously' }).click()
  await expect(page.getByRole('alert')).toContainText('Can’t post this')

  const text = `QA confession ${Date.now()}: I eat pani puri every single evening`
  // The box moves the cursor to the end on focus, so clear it by hand before typing.
  await box.focus()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await box.fill(text)
  await page.getByRole('button', { name: 'Post anonymously' }).click()
  await expect(page).toHaveURL(/\/confessions$/)
  await expect(page.getByText(text)).toBeVisible()
})

test('RCT-029 each game opens, plays a round and saves a score', async ({ page }) => {
  test.setTimeout(300_000)
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  for (const game of ['reflex', 'synapse', 'nebula']) {
    await page.goto(`/c/${v.cartId}/order/${id}/play/${game}`)
    await page.getByRole('button', { name: /Launch/ }).click()
    // Nobody taps: the round runs out and the score (0 or more) is still saved.
    const saved = page.waitForResponse((r) => r.url().includes(`/games/${game}/scores`) && r.request().method() === 'POST', { timeout: 90_000 })
    expect((await saved).status(), game).toBeLessThan(300)
    await expect(page.getByRole('button', { name: /Play again/ })).toBeVisible()
    await expect(page.getByText(/You’re #\d+ today/)).toBeVisible()
    await page.getByRole('button', { name: /Leaderboard/ }).first().click()
    const board = page.getByRole('dialog', { name: /Today’s top pilots/ })
    await expect(board.getByRole('listitem').filter({ hasText: 'You' })).toHaveCount(1)
    await page.keyboard.press('Escape')
  }
})
