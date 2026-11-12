import { onboardVendor, saveState, secrets } from './helpers.js'

// One QA vendor with an open cart and a 3-item menu, shared by every spec.
export default async function globalSetup() {
  secrets() // fails early with a clear error if `node scripts/qa.js setup` never ran
  saveState({ vendor: await onboardVendor({ cartName: `QA-Cart ${Date.now() % 1e5}` }) })
}
