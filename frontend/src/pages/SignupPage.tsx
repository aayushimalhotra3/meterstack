import { useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function SignupPage() {
  const { signup, accessToken } = useAuth()
  const nav = useNavigate()
  const [tenantName, setTenantName] = useState('')
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
      await signup(tenantName, email, password)
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
      <div className="auth-card">
        <div>
          <p className="eyebrow">Create your own tenant</p>
          <h1>Start a fresh MeterStack workspace</h1>
          <p className="hero-copy">
            Spin up a tenant owner account and test the complete flow from signup to plan selection, API keys, and
            usage analytics.
          </p>
        </div>

        <form className="form-grid" onSubmit={onSubmit}>
          <label className="field">
            <span>Workspace name</span>
            <input className="input" placeholder="Acme Analytics" value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
          </label>
          <label className="field">
            <span>Email</span>
            <input className="input" placeholder="owner@acme.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <input className="input" placeholder="Choose a password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="button" type="submit" disabled={loading}>
            {loading ? 'Creating workspace...' : 'Create account'}
          </button>
        </form>

        {error ? <div className="status-banner status-banner--error">{error}</div> : null}

        <div className="auth-footer">
          <span className="muted">Already have an account?</span>
          <Link to="/login">Back to login</Link>
        </div>
      </div>
    </div>
  )
}
