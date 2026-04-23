import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api/client'
import { formatFeatureKey } from '../lib/formatters'

type EntRow = { feature_key: string; name: string; limit_value: number | null; included: boolean }
type Subscription = { plan?: { name?: string } }

export default function EntitlementsPage() {
  const [rows, setRows] = useState<EntRow[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    Promise.all([apiRequest<EntRow[]>('/entitlements/'), apiRequest<Subscription>('/billing/subscription')])
      .then(([entitlements, sub]) => {
        setRows(entitlements)
        setSubscription(sub)
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : 'Unable to load entitlements'
        setError(message)
      })
      .finally(() => setLoading(false))
  }, [])
  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Step 02 of 04</p>
          <h1>Entitlements by plan</h1>
          <p className="hero-copy">
            Use this page right after plan selection. It translates the plan into a concrete list of features and quota
            limits so you know exactly what the tenant can do.
          </p>
          <div className="hero-actions">
            <Link className="button" to="/api-keys">
              Next: create an API key
            </Link>
            <Link className="button button--secondary" to="/billing">
              Back: change plan
            </Link>
          </div>
        </div>
        <div className="hero-meta">
          <span className="inline-pill">Access review step</span>
          <span className="inline-pill">{subscription?.plan?.name ?? 'No active plan'}</span>
          <span className="inline-pill">{rows.length} included features</span>
        </div>
      </section>

      {loading ? <div className="page-loading">Loading entitlements...</div> : null}
      {error ? <div className="status-banner status-banner--error">{error}</div> : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="empty-state">No entitlements available yet. Subscribe to a plan to unlock feature checks.</div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <section className="card">
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Internal key</th>
                  <th>Included</th>
                  <th>Limit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.feature_key}>
                    <td>{r.name || formatFeatureKey(r.feature_key)}</td>
                    <td>{r.feature_key}</td>
                    <td>
                      <span className={`badge ${r.included ? 'badge--success' : 'badge--muted'}`}>
                        {r.included ? 'Included' : 'Excluded'}
                      </span>
                    </td>
                    <td>{r.limit_value ?? 'Unlimited'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}
