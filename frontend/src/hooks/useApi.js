import { useAuth } from '../context/AuthContext'

/**
 * Wraps fetch() to automatically inject the Bearer token.
 * Throws on 401 (caller should handle logout).
 */
export function useApi() {
  const { token, logout } = useAuth()

  const fetchWithAuth = async (url, options = {}) => {
    const headers = {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
    const res = await fetch(url, { ...options, headers })
    if (res.status === 401) {
      logout()
      throw new Error('Session expired. Please log in again.')
    }
    return res
  }

  return { fetchWithAuth }
}
