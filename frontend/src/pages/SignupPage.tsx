import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function SignupPage() {
  const { signup } = useAuth()
  const nav = useNavigate()
  const [tenantName, setTenantName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
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
    <div style={{ maxWidth: 400, margin: '48px auto' }}>
      <h2>Sign Up</h2>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <input placeholder="Tenant Name" value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit" disabled={loading}>{loading ? 'Loading...' : 'Create Account'}</button>
      </form>
      {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}
      <div style={{ marginTop: 12 }}>
        <Link to="/login">Back to login</Link>
      </div>
    </div>
  )
}
