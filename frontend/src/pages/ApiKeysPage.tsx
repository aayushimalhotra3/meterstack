import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api/client'
import { formatDateTime } from '../lib/formatters'

type ApiKeyRecord = {
  id: string
  name: string
  created_at: string | null
  last_used_at: string | null
  active: boolean
}

type CreatedKey = {
  id: string
  name: string
  api_key: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([])
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null)
  const [name, setName] = useState('Production backend')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function loadKeys() {
    try {
      const response = await apiRequest<ApiKeyRecord[]>('/api-keys')
      setKeys(response)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to load API keys'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadKeys()
  }, [])

  const activeKeys = keys.filter((key) => key.active)
  const recentlyUsedKeys = activeKeys.filter((key) => {
    if (!key.last_used_at) return false
    return Date.now() - new Date(key.last_used_at).getTime() <= 1000 * 60 * 60 * 24 * 2
  })
  const revokedKeys = keys.length - activeKeys.length

  async function createKey(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const response = await apiRequest<CreatedKey>('/api-keys', {
        method: 'POST',
        json: { name },
      })
      setCreatedKey(response)
      setNotice('API key created. Copy it now; it will not be shown again.')
      setName('')
      await loadKeys()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to create API key'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function revokeKey(keyId: string) {
    setError(null)
    setNotice(null)
    try {
      await apiRequest(`/api-keys/${keyId}/revoke`, { method: 'POST' })
      setNotice('API key revoked.')
      await loadKeys()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to revoke API key'
      setError(message)
    }
  }

  async function copyKey() {
    if (!createdKey) return
    await navigator.clipboard.writeText(createdKey.api_key)
    setNotice('Copied API key to clipboard.')
  }

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Step 03 of 04</p>
          <h1>Operational API keys for live usage capture.</h1>
          <p className="hero-copy">
            This is where the workspace becomes operational. Create a key for your backend or job runner, then use it
            to check quotas and record usage.
          </p>
          <div className="hero-actions">
            <Link className="button" to="/usage">
              Next: inspect analytics
            </Link>
            <Link className="button button--secondary" to="/entitlements">
              Back: review entitlements
            </Link>
          </div>
        </div>
        <div className="hero-meta">
          <span className="inline-pill">Integration step</span>
          <span className="inline-pill">{keys.filter((key) => key.active).length} active keys</span>
          <span className="inline-pill">One-time secret reveal</span>
        </div>
      </section>

      {error ? <div className="status-banner status-banner--error">{error}</div> : null}
      {notice ? <div className="status-banner status-banner--success">{notice}</div> : null}

      <section className="stats-grid stats-grid--compact api-key-stats-grid">
        <article className="metric-card metric-card--featured">
          <span className="metric-label">Active keys</span>
          <strong>{activeKeys.length}</strong>
          <span className="muted">Services currently allowed to send usage</span>
        </article>
        <article className="metric-card">
          <span className="metric-label">Used in 48h</span>
          <strong>{recentlyUsedKeys.length}</strong>
          <span className="muted">Warm integrations touching the workspace</span>
        </article>
        <article className="metric-card">
          <span className="metric-label">Revoked</span>
          <strong>{revokedKeys}</strong>
          <span className="muted">Archived or retired connections</span>
        </article>
      </section>

      {createdKey ? (
        <section className="card glow-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Copy this now</p>
              <h2>{createdKey.name}</h2>
            </div>
            <button className="button button--secondary" onClick={() => setCreatedKey(null)}>
              Dismiss
            </button>
          </div>
          <code className="secret-block">{createdKey.api_key}</code>
          <div className="page-actions">
            <button className="button" onClick={() => void copyKey()}>
              Copy key
            </button>
          </div>
        </section>
      ) : null}

      <section className="split-grid api-key-layout">
        <div className="card api-key-create-card" data-tour="api-key-create">
          <div className="section-header">
            <div>
              <p className="eyebrow">Create</p>
              <h2>Issue a new key</h2>
            </div>
          </div>
          <form className="form-grid" onSubmit={createKey}>
            <label className="field">
              <span>Key name</span>
              <input
                className="input"
                placeholder="Production backend"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button className="button" type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create API key'}
            </button>
          </form>
        </div>

        <div className="card integration-card">
          <p className="eyebrow">Integration pattern</p>
          <h2>Typical client flow</h2>
          <ol className="steps">
            <li>Call quota check before the user action.</li>
            <li>If allowed, perform the action in your product.</li>
            <li>Record the resulting usage event with the same feature key.</li>
          </ol>
          {keys.length > 0 ? (
            <div className="key-activity-list">
              {keys.slice(0, 3).map((key) => (
                <div key={key.id} className="key-activity-row">
                  <div className="key-activity-row__copy">
                    <strong>{key.name}</strong>
                    <span>{key.last_used_at ? `Last used ${formatDateTime(key.last_used_at)}` : 'No traffic yet'}</span>
                  </div>
                  <span className={`badge ${key.active ? 'badge--success' : 'badge--muted'}`}>
                    {key.active ? 'Connected' : 'Revoked'}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="card key-inventory-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Inventory</p>
            <h2>Existing keys</h2>
          </div>
        </div>
        {loading ? <div className="empty-state">Loading API keys...</div> : null}
        {!loading && keys.length === 0 ? (
          <div className="empty-state">No API keys yet. Create one to connect a backend service.</div>
        ) : null}
        {!loading && keys.length > 0 ? (
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Last used</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id}>
                    <td>{key.name}</td>
                    <td>
                      <span className={`badge ${key.active ? 'badge--success' : 'badge--muted'}`}>
                        {key.active ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td>{formatDateTime(key.created_at)}</td>
                    <td>{formatDateTime(key.last_used_at)}</td>
                    <td>
                      {key.active ? (
                        <button className="button button--ghost button--compact" onClick={() => void revokeKey(key.id)}>
                          Revoke
                        </button>
                      ) : (
                        <span className="muted">Archived</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}
