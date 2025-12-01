import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client'

type UsageRow = { feature_key: string; total_amount: number }

export default function DashboardPage() {
  const [summary, setSummary] = useState<{ period_start: string; period_end: string; usage: UsageRow[] } | null>(null)
  const [sub, setSub] = useState<{ plan?: { name?: string; description?: string }; status?: string; current_period_start?: string; current_period_end?: string; cancel_at_period_end?: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const s = await apiRequest('/analytics/summary')
        const b = await apiRequest('/billing/subscription')
        setSummary(s)
        setSub(b)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>
  if (error) return <div style={{ padding: 24, color: 'red' }}>{error}</div>
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ border: '1px solid #eee', padding: 16 }}>
          <h3>Plan & Billing Period</h3>
          <div>Plan: {sub?.plan?.name || '—'}</div>
          <div>Status: {sub?.status || '—'}</div>
          <div>Period: {summary?.period_start} → {summary?.period_end}</div>
          {sub?.cancel_at_period_end ? <div>Cancel at period end</div> : null}
        </div>
        <div style={{ border: '1px solid #eee', padding: 16 }}>
          <h3>Feature Usage</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Feature</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {summary?.usage?.map((u) => (
                <tr key={u.feature_key}>
                  <td style={{ padding: '6px 0' }}>{u.feature_key}</td>
                  <td style={{ textAlign: 'right' }}>{u.total_amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
