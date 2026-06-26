import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }, [])

  // Validate token on mount / token change
  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error('Invalid token')
        return r.json()
      })
      .then(u => setUser(u))
      .catch(() => logout())
      .finally(() => setLoading(false))
  }, [token, logout])

  const login = async (email, password) => {
    const form = new FormData()
    form.append('email', email)
    form.append('password', password)
    const res = await fetch('/api/auth/login', { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Login failed')
    localStorage.setItem('token', data.access_token)
    setToken(data.access_token)
    setUser(data.user)
    return data.user
  }

  const register = async (name, email, password) => {
    const form = new FormData()
    form.append('name', name)
    form.append('email', email)
    form.append('password', password)
    const res = await fetch('/api/auth/register', { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Registration failed')
    localStorage.setItem('token', data.access_token)
    setToken(data.access_token)
    setUser(data.user)
    return data.user
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
