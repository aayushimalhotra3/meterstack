import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api/client'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import { formatCompactNumber, formatDate, formatFeatureKey } from '../lib/formatters'

type UsageRow = { feature_key: string; total_amount: number }
type Point = { date: string; total_amount: number }

export default function UsagePage() {
  const [summary, setSummary] = useState<{ period_start: string; period_end: string; usage: UsageRow[] } | null>(null)
  const [featureKey, setFeatureKey] = useState<string>('')
  const [points, setPoints] = useState<Point[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiRequest<{ period_start: string; period_end: string; usage: UsageRow[] }>('/analytics/summary')
      .then((response) => {
        setSummary(response)
        setFeatureKey((currentFeatureKey) => currentFeatureKey || response.usage?.[0]?.feature_key || '')
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    async function load() {
      if (!featureKey) {
        setPoints([])
        return
      }
      setLoading(true)
      setError(null)
      try {
        const res = await apiRequest<{ points: Point[] }>(`/analytics/timeseries?feature_key=${encodeURIComponent(featureKey)}`)
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
    const recentSevenDays = points.slice(-7).reduce((acc, p) => acc + p.total_amount, 0)
    const priorSevenDays = points.slice(-14, -7).reduce((acc, p) => acc + p.total_amount, 0)
    const peakPoint = points.reduce<Point | null>((leader, point) => {
      if (!leader || point.total_amount > leader.total_amount) return point
      return leader
    }, null)
    const trendPercent = priorSevenDays ? Math.round(((recentSevenDays - priorSevenDays) / priorSevenDays) * 100) : null
    return { total, max, avg, recentSevenDays, priorSevenDays, peakPoint, trendPercent }
  }, [points])
  const rankedUsage = useMemo(() => [...(summary?.usage ?? [])].sort((a, b) => b.total_amount - a.total_amount), [summary])
  const selectedUsage = rankedUsage.find((row) => row.feature_key === featureKey) ?? null
  const tenantTotal = rankedUsage.reduce((acc, row) => acc + row.total_amount, 0)
  const streamShare = tenantTotal && selectedUsage ? Math.round((selectedUsage.total_amount / tenantTotal) * 100) : 0
  const trendLabel =
    stats.trendPercent === null
      ? 'Building trend baseline'
      : `${stats.trendPercent >= 0 ? '+' : ''}${stats.trendPercent}% vs prior 7 days`

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Step 04 of 04</p>
          <h1>Daily feature consumption</h1>
          <p className="hero-copy">
            This is the end of the workflow. Once a client starts sending usage events, analytics shows which features
            are active and how volume changes day by day.
          </p>
          <div className="hero-actions">
            <Link className="button button--secondary" to="/api-keys">
              Back: manage API keys
            </Link>
          </div>
        </div>
        <div className="hero-meta">
          <span className="inline-pill">Analytics step</span>
          {summary ? (
            <span className="inline-pill">
              {formatDate(summary.period_start)} → {formatDate(summary.period_end)}
            </span>
          ) : null}
          <span className="inline-pill">{summary?.usage.length ?? 0} active feature streams</span>
          {selectedUsage ? <span className="inline-pill">{formatCompactNumber(selectedUsage.total_amount)} units on selected stream</span> : null}
        </div>
      </section>

      <section className="analytics-grid">
        <section className="card chart-card chart-card--usage">
          <div className="section-header">
            <div>
              <p className="eyebrow">Timeseries</p>
              <h2>{featureKey ? formatFeatureKey(featureKey) : 'Choose a usage stream'}</h2>
            </div>
            {selectedUsage ? (
              <div className="chart-insight">
                <span>Selected stream</span>
                <strong>{formatCompactNumber(selectedUsage.total_amount)}</strong>
                <small>{streamShare}% of tenant volume</small>
              </div>
            ) : null}
          </div>
          <div className="chart-summary-strip">
            <div>
              <span className="metric-label">Peak day</span>
              <strong>{stats.peakPoint ? formatCompactNumber(stats.peakPoint.total_amount) : 'No data'}</strong>
              <small>{stats.peakPoint ? formatDate(stats.peakPoint.date) : 'Waiting for events'}</small>
            </div>
            <div>
              <span className="metric-label">Recent trend</span>
              <strong>{trendLabel}</strong>
              <small>{stats.recentSevenDays.toLocaleString()} units in the last 7 days</small>
            </div>
          </div>
          {loading ? <div className="page-loading">Loading usage chart...</div> : null}
          {error ? <div className="status-banner status-banner--error">{error}</div> : null}
          {!loading && featureKey && points.length > 0 ? (
            <>
              <div className="chart-wrap chart-wrap--usage">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#e5dde4" strokeDasharray="3 7" vertical={false} />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#756876', fontSize: 12 }}
                      tickMargin={10}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#756876', fontSize: 12 }} tickMargin={8} />
                    <Tooltip
                      contentStyle={{
                        background: '#fffaf3',
                        border: '1px solid rgba(111, 59, 104, 0.16)',
                        borderRadius: 14,
                        boxShadow: '0 18px 34px rgba(45, 34, 48, 0.12)',
                      }}
                      labelStyle={{ color: '#302634', fontWeight: 700 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total_amount"
                      stroke="#6f3b68"
                      strokeWidth={3.5}
                      dot={false}
                      activeDot={{ r: 6, fill: '#e89f5b', stroke: '#fffaf3', strokeWidth: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-footnote">
                <span>{points.length} daily points in view</span>
                <span>{streamShare}% of current period volume</span>
                <span>Last 7 days: {stats.recentSevenDays.toLocaleString()} units</span>
              </div>
            </>
          ) : null}
          {!loading && featureKey && points.length === 0 ? (
            <div className="empty-state">No daily points recorded for this feature in the selected period.</div>
          ) : null}
          {!loading && !featureKey && (summary?.usage.length ?? 0) === 0 ? (
            <div className="empty-state">
              No usage data is available yet. Subscribe to a plan and send a usage event to populate analytics.
            </div>
          ) : null}
        </section>

        <aside className="analytics-sidebar">
          <div className="card stream-selector-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Select feature</p>
                <h2>Choose a usage stream</h2>
              </div>
            </div>
            <label className="field">
              <span>Feature key</span>
              <select className="input" value={featureKey} onChange={(e) => setFeatureKey(e.target.value)}>
                <option value="">Select feature</option>
                {summary?.usage?.map((u) => (
                  <option key={u.feature_key} value={u.feature_key}>
                    {formatFeatureKey(u.feature_key)}
                  </option>
                ))}
              </select>
            </label>
            {selectedUsage ? (
              <div className="stream-selector-card__meta">
                <strong>{formatFeatureKey(selectedUsage.feature_key)}</strong>
                <span>{selectedUsage.total_amount.toLocaleString()} units tracked in the current billing cycle.</span>
              </div>
            ) : null}
          </div>

          <div className="card ranked-stream-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Top streams</p>
                <h2>Where usage is concentrating</h2>
              </div>
            </div>
            <div className="stream-list">
              {rankedUsage.map((item, index) => {
                const share = tenantTotal ? Math.round((item.total_amount / tenantTotal) * 100) : 0
                const active = item.feature_key === featureKey
                return (
                  <button
                    key={item.feature_key}
                    className={`stream-option${active ? ' stream-option--active' : ''}`}
                    type="button"
                    onClick={() => setFeatureKey(item.feature_key)}
                  >
                    <span className="stream-option__rank">{String(index + 1).padStart(2, '0')}</span>
                    <div className="stream-option__copy">
                      <strong>{formatFeatureKey(item.feature_key)}</strong>
                      <span>{share}% of current tenant volume</span>
                    </div>
                    <span className="stream-option__value">{formatCompactNumber(item.total_amount)}</span>
                    <span className="stream-option__bar" style={{ width: `${Math.max(share, 8)}%` }} />
                  </button>
                )
              })}
            </div>
          </div>
        </aside>
      </section>

      <section className="stats-grid analytics-stats-grid">
        <article className="metric-card metric-card--featured">
          <span className="metric-label">Total units</span>
          <strong>{stats.total.toLocaleString()}</strong>
          <span className="muted">For the currently selected stream</span>
        </article>
        <article className="metric-card">
          <span className="metric-label">Peak day</span>
          <strong>{stats.max.toLocaleString()}</strong>
          <span className="muted">{stats.peakPoint ? formatDate(stats.peakPoint.date) : 'No data yet'}</span>
        </article>
        <article className="metric-card">
          <span className="metric-label">Daily average</span>
          <strong>{stats.avg.toLocaleString()}</strong>
          <span className="muted">Smoothed over {points.length || 0} observed days</span>
        </article>
        <article className="metric-card">
          <span className="metric-label">Last 7 days</span>
          <strong>{stats.recentSevenDays.toLocaleString()}</strong>
          <span className="muted">{trendLabel}</span>
        </article>
      </section>
    </div>
  )
}
