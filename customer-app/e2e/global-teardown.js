import { execFileSync } from 'node:child_process'

// Keep the free cluster small: delete everything this run created.
// Set QA_KEEP=1 to keep the data for a look in the admin dashboard.
export default function globalTeardown() {
  if (process.env.QA_KEEP) return
  execFileSync('node', ['scripts/qa.js', 'cleanup'], { cwd: '../backend', stdio: 'inherit' })
}
