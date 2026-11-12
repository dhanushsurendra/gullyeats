// RCT-xxx: the customer web app, opened the way a QR scan opens it.
import { test, expect } from '@playwright/test'
import { call, customerOrder, state } from './helpers.js'

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

test('RCT-027 the GullyPulse feed loads', async ({ page }) => {
  await page.goto('/confessions')
  await expect(page.getByRole('heading').first()).toBeVisible()
  await expect(page.getByText(/went wrong|Couldn/)).toHaveCount(0)
})
