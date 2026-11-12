// CSV export for accounting. Opens cleanly in Excel and Google Sheets.

// Text a vendor typed (cart names, owner names) could start with = + - @ and
// run as a formula in Excel, so such cells are prefixed with a quote.
const cell = (v) => {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// IST date and time as "2026-11-07 14:05", which spreadsheets read as a date.
export const istStamp = (d) =>
  d
    ? new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(d))
    : ''
export const istDay = (d) => istStamp(d).slice(0, 10)

// The days a fee payment covers: one payment can settle several unpaid days
// (fromDate through billingDate). "2026-11-07", or "2026-11-06 – 2026-11-07".
export const billingDays = (from, to) =>
  from && istDay(from) !== istDay(to) ? `${istDay(from)} – ${istDay(to)}` : istDay(to)

// columns: [{ label, value: (row) => any }]
export function downloadCsv(filename, columns, rows) {
  const lines = [
    columns.map((c) => cell(c.label)).join(','),
    ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(',')),
  ]
  // The BOM makes Excel read ₹ and Indian-language names as UTF-8.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// Every row of a cursor-paged endpoint, up to max. fetchPage(cursor) resolves
// to { items, pagination: { hasMore, nextCursor } }.
export async function fetchAll(fetchPage, max = 20000) {
  const rows = []
  let cursor = null
  do {
    const d = await fetchPage(cursor)
    rows.push(...d.items)
    cursor = d.pagination?.hasMore ? d.pagination.nextCursor : null
  } while (cursor && rows.length < max)
  return { rows: rows.slice(0, max), truncated: Boolean(cursor) || rows.length > max }
}

export const today = () => istDay(new Date())
