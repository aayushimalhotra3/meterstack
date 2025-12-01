import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api/client'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'

type UsageRow = { feature_key: string; total_amount: number }
type Point = { date: string; total_amount: number }

export default function UsagePage() {
  const [summary, setSummary] = useState<{ period_start: string; period_end: string; usage: UsageRow[] } | null>(null)
  const [featureKey, setFeatureKey] = useState<string>('')
  const [points, setPoints] = useState<Point[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiRequest('/analytics/summary').then(setSummary).catch(() => {})
  }, [])

  useEffect(() => {
    async function load() {
      if (!featureKey) return
      setLoading(true)
      setError(null)
      try {
        const res = await apiRequest(`/analytics/timeseries?feature_key=${encodeURIComponent(featureKey)}`)
        setPoints(res.points || [])
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [featureKey])

  const stats = useMemo(() => {
    const total = points.reduce((acc, p) => acc + p.total_amount, 0)
    const max = points.reduce((acc, p) => Math.max(acc, p.total_amount), 0)
    const avg = points.length ? Math.round(total / points.length) : 0
    return { total, max, avg }
  }, [points])

  return (
    <div style={{ padding: 24 }}>
      <h3>Usage</h3>
      <div style={{ marginBottom: 12 }}>
        <select value={featureKey} onChange={(e) => setFeatureKey(e.target.value)}>
          <option value="">Select feature</option>
          {summary?.usage?.map((u) => (
            <option key={u.feature_key} value={u.feature_key}>{u.feature_key}</option>
          ))}
        </select>
      </div>
      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {points.length > 0 && (
        <div>
          <LineChart width={800} height={300} data={points}>
            <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="total_amount" stroke="#8884d8" />
          </LineChart>
          <div style={{ marginTop: 12 }}>Total: {stats.total} | Max/day: {stats.max} | Avg/day: {stats.avg}</div>
        </div>
      )}
    </div>
  )
}
