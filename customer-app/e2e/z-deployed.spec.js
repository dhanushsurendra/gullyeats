// Runs last: waking the deployed server (main) makes it rebuild the old
// carts.location 2dsphere index, which breaks cart creation on this branch.
import { test, expect } from '@playwright/test'

test('API-030 the deployed backend answers', async () => {
  const r = await fetch('https://gullyeats.onrender.com/api/orders/get-truth-line', { signal: AbortSignal.timeout(40_000) })
  expect(r.status).toBe(200)
})
