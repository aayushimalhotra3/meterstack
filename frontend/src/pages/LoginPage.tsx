import { useEffect, useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { warmApi } from '../api/client'

const DEMO_EMAIL = 'demo-owner@meterstack.dev'
const DEMO_PASSWORD = 'DemoPass123!'

export default function LoginPage() {
  const { login, accessToken } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState(DEMO_EMAIL)
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [warming, setWarming] = useState(true)
  const [warmSlow, setWarmSlow] = useState(false)

  useEffect(() => {
    let cancelled = false
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setWarmSlow(true)
    }, 3500)
    warmApi().finally(() => {
      if (cancelled) return
      window.clearTimeout(slowTimer)
      setWarming(false)
    })
    return () => {
      cancelled = true
      window.clearTimeout(slowTimer)
    }
  }, [])

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
            Explore a ready-to-use SaaS billing and usage analytics workspace. No setup needed.
          </p>
          <div className="auth-story">
            <div className="auth-story__card">
              <span className="eyebrow">Demo workspace</span>
              <strong>Plans, entitlements, API keys, and usage analytics are already seeded.</strong>
            </div>
          </div>
        </div>

        <div className="auth-panel">
          <div className="auth-panel__intro">
            <p className="eyebrow">Public demo</p>
            <h2>Open the demo workspace</h2>
            <p>The demo credentials are prefilled. Just click the button below.</p>
          </div>

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
              {loading ? 'Signing in...' : 'Sign in to demo'}
            </button>
          </form>

          {error ? <div className="status-banner status-banner--error">{error}</div> : null}
          {warming && warmSlow ? (
            <div className="status-banner status-banner--warning">
              Free demo hosting may take a moment on the first sign in.
            </div>
          ) : null}

          <div className="auth-footer">
            <span className="muted">Need a fresh tenant?</span>
            <Link to="/signup">Create an account</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
