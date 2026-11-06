// Set VITE_API_BASE_URL to test against a local backend.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://gullyeats.onrender.com/api'

export const SOCKET_URL = API_BASE_URL.replace(/\/api$/, '')

// Calls the API and returns its `data`. Throws the server's own message
// (e.g. "This cart is not taking orders right now") so pages can show it.
export async function api(path, { method = 'GET', body } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('No internet connection. Check your network and try again.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'Something went wrong. Please try again.')
  }
  return data.data
}
