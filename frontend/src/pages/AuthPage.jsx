import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function getPasswordStrength(pw) {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const labels = ['Weak', 'Fair', 'Good', 'Strong']
  const colors = ['#ef4444', '#f59e0b', '#10b981', '#6366f1']
  return { score, label: labels[score - 1] || '', color: colors[score - 1] || '#ef4444', pct: (score / 4) * 100 }
}

export default function AuthPage() {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') === 'register' ? 'register' : 'login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true })
  }, [user, navigate])

  const strength = getPasswordStrength(password)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let u
      if (tab === 'login') {
        u = await login(email, password)
      } else {
        if (!name.trim()) { setError('Full name is required.'); setLoading(false); return }
        if (password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return }
        u = await register(name, email, password)
      }
      navigate(u.role === 'admin' ? '/admin' : '/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="bg-mesh" />

      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <Link to="/" className="sidebar-logo-mark" style={{ justifyContent: 'center', marginBottom: 4 }}>
            <div className="logo-icon">🎯</div>
            <span className="logo-text">ResumeAI</span>
          </Link>
          <div className="auth-heading" style={{ marginTop: 16 }}>
            {tab === 'login' ? 'Welcome back' : 'Create your account'}
          </div>
          <div className="auth-sub">
            {tab === 'login'
              ? 'Sign in to access your dashboard'
              : 'Join thousands of job seekers using AI to succeed'}
          </div>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError('') }}>
            Sign In
          </button>
          <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setError('') }}>
            Register
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} id="auth-form">
          {tab === 'register' && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                id="auth-name"
                className="form-input"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              id="auth-email"
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus={tab === 'login'}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="auth-password"
              className="form-input"
              type="password"
              placeholder={tab === 'register' ? 'Min. 6 characters' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            {tab === 'register' && password.length > 0 && (
              <div className="password-strength">
                <div className="strength-bar-track">
                  <div className="strength-bar-fill" style={{ width: `${strength.pct}%`, background: strength.color }} />
                </div>
                <div className="strength-label" style={{ color: strength.color }}>{strength.label}</div>
              </div>
            )}
          </div>

          <button id="auth-submit" type="submit" className="btn btn-primary btn-full" style={{ marginTop: 4 }} disabled={loading}>
            {loading ? <><span className="spinner" /> {tab === 'login' ? 'Signing in…' : 'Creating account…'}</> : (tab === 'login' ? '→ Sign In' : '🚀 Create Account')}
          </button>
        </form>

        <div className="auth-footer">
          {tab === 'login' ? (
            <>Don't have an account? <a href="#" onClick={e => { e.preventDefault(); setTab('register'); setError('') }}>Register</a></>
          ) : (
            <>Already have an account? <a href="#" onClick={e => { e.preventDefault(); setTab('login'); setError('') }}>Sign in</a></>
          )}
        </div>
      </div>
    </div>
  )
}
