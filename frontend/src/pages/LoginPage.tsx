import { useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { login, accessToken } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  if (accessToken) return <Navigate to="/dashboard" replace />

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
      nav('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="auth-shell">
      <div className="auth-card auth-card--split">
        <div className="auth-lead">
          <h1>Sign in to MeterStack</h1>
          <p className="hero-copy">
            Tenant billing, entitlements, usage metering, analytics, and API-key workflows in one operating console.
          </p>
          <div className="auth-story">
            <div className="auth-story__card">
              <span className="eyebrow">What you can explore</span>
              <strong>Plan state, live usage, quotas, and backend integrations</strong>
            </div>
            <div className="auth-story__card auth-story__card--accent">
              <span className="eyebrow">Public demo mode</span>
              <strong>Switch plans instantly without leaving the app</strong>
            </div>
          </div>
        </div>

        <div className="auth-panel">
          <form className="form-grid" onSubmit={onSubmit}>
            <label className="field">
              <span>Email</span>
              <input className="input" placeholder="demo-owner@meterstack.dev" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              <span>Password</span>
              <input className="input" placeholder="DemoPass123!" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <button className="button" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>

          {error ? <div className="status-banner status-banner--error">{error}</div> : null}

          <div className="card auth-subcard">
            <p className="eyebrow">Demo login</p>
            <div className="demo-credentials">
              <span>Email: demo-owner@meterstack.dev</span>
              <span>Password: DemoPass123!</span>
            </div>
          </div>

          <div className="auth-footer">
            <span className="muted">Need a fresh tenant?</span>
            <Link to="/signup">Create an account</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
