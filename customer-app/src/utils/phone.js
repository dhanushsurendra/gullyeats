// Indian mobile numbers, as typed or pasted. A pasted +91 or 0 prefix is dropped
// (only when exactly 10 digits follow), so "+91 98765 43210" still fits.
export const phoneDigits = (value) => value.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '')

export const isMobile = (phone) => /^[6-9]\d{9}$/.test(phone)

// What's wrong with a partly typed number, or '' when it's empty or valid.
export const phoneError = (phone) =>
  !phone || isMobile(phone)
    ? ''
    : phone.length < 10
      ? `Invalid number: enter all 10 digits (${phone.length}/10)`
      : 'Invalid number: mobile numbers start with 6, 7, 8 or 9'

// For a phone input's onChange: the new value, or null to refuse it (an 11th digit).
export const nextPhone = (value) => {
  const digits = phoneDigits(value)
  return digits.length <= 10 ? digits : null
}
