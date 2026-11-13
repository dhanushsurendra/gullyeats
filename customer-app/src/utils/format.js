export const rupees = (amount) =>
  `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

// "12, MG Road, Indiranagar, Bengaluru, 560038" -> "Indiranagar, Bengaluru"
export function shortAddress(address = '') {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  return parts.length >= 4 ? parts.slice(2, 4).join(', ') : address
}

export const itemCount = (quantities) =>
  Object.values(quantities).reduce((sum, q) => sum + Number(q || 0), 0)

export const itemsTotal = (menuItems, quantities) =>
  menuItems.reduce((sum, item) => sum + item.price * (quantities[item._id] || 0), 0)

