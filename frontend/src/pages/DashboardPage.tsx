import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api/client'
import { formatCompactNumber, formatDate, formatFeatureKey } from '../lib/formatters'
import { workflowSteps } from '../lib/workflow'

type UsageRow = { feature_key: string; total_amount: number }
type Subscription = {
  plan?: { name?: string; description?: string }
  status?: string
  current_period_start?: string
  current_period_end?: string
  cancel_at_period_end?: boolean
}
type Entitlement = { feature_key: string; name: string; limit_value: number | null; included: boolean }

export default function DashboardPage() {
  const [summary, setSummary] = useState<{ period_start: string; period_end: string; usage: UsageRow[] } | null>(null)
  const [sub, setSub] = useState<Subscription | null>(null)
  const [entitlements, setEntitlements] = useState<Entitlement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [b, e] = await Promise.all([
          apiRequest<Subscription>('/billing/subscription'),
          apiRequest<Entitlement[]>('/entitlements/'),
        ])
        setSub(b)
        setEntitlements(e)
        try {
          const usageSummary = await apiRequest<{ period_start: string; period_end: string; usage: UsageRow[] }>('/analytics/summary')
          setSummary(usageSummary)
        } catch (analyticsError: unknown) {
          const analyticsMessage = analyticsError instanceof Error ? analyticsError.message : ''
          if (analyticsMessage !== 'no_active_subscription') {
            throw analyticsError
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalUsage = summary?.usage.reduce((total, row) => total + row.total_amount, 0) ?? 0
  const hasPlan = Boolean(sub?.plan?.name)
  const topFeature = summary?.usage.reduce<UsageRow | null>((leader, row) => {
    if (!leader || row.total_amount > leader.total_amount) return row
    return leader
  }, null)
  const rankedUsage = [...(summary?.usage ?? [])].sort((a, b) => b.total_amount - a.total_amount)
  const usageMax = rankedUsage[0]?.total_amount ?? 1
  const periodDays = summary
    ? Math.max(
        1,
        Math.round((new Date(summary.period_end).getTime() - new Date(summary.period_start).getTime()) / (1000 * 60 * 60 * 24)) + 1,
      )
    : 0
  const primaryAction = !hasPlan
    ? { to: '/billing', label: 'Choose a plan' }
    : totalUsage === 0
      ? { to: '/api-keys', label: 'Create an API key' }
      : { to: '/usage', label: 'Open analytics' }
  const secondaryAction = !hasPlan
    ? { to: '/entitlements', label: 'See what plans unlock' }
    : totalUsage === 0
      ? { to: '/entitlements', label: 'Review plan access' }
      : { to: '/api-keys', label: 'Manage API keys' }
  const journeyMessage = !hasPlan
    ? 'Start with Billing to activate the tenant and set the limits the rest of the workspace runs on.'
    : totalUsage === 0
      ? 'Your plan is live. Next, create an API key and send a usage event so analytics has something to display.'
      : 'Traffic is flowing. Use the overview to monitor the workspace, then jump into analytics when something changes.'
  const quickStats = [
    {
      label: 'Current plan',
      value: sub?.plan?.name ?? '—',
      meta: sub?.status ?? 'No active subscription',
    },
    {
      label: 'Metered volume',
      value: totalUsage.toLocaleString(),
      meta: periodDays ? `About ${Math.round(totalUsage / periodDays).toLocaleString()} units per day` : 'Units tracked this billing period',
    },
    {
      label: 'Top feature',
      value: topFeature ? formatFeatureKey(topFeature.feature_key) : '—',
      meta: topFeature ? `${formatCompactNumber(topFeature.total_amount)} units this period` : 'No usage yet',
    },
    {
      label: 'Active streams',
      value: rankedUsage.length.toLocaleString(),
      meta: entitlements.length ? `${entitlements.length.toLocaleString()} plan-backed capabilities` : 'Plan-backed capability surface',
    },
  ]

  if (loading) return <div className="page-loading">Loading workspace overview...</div>
  if (error) return <div className="status-banner status-banner--error">{error}</div>
  return (
    <div className="page-stack dashboard-stack">
      <section className="hero-card hero-card--dashboard">
        <div className="hero-main">
          <p className="eyebrow">Workspace overview</p>
          <h1>Run the commercial layer of your product from one place.</h1>
          <p className="hero-copy">{journeyMessage}</p>
          <div className="hero-actions">
            <Link className="button" to={primaryAction.to}>
              {primaryAction.label}
            </Link>
            <Link className="button button--secondary" to={secondaryAction.to}>
              {secondaryAction.label}
            </Link>
          </div>
        </div>

        <aside className="hero-side-panel">
          <div className="hero-side-panel__header">
            <span className="eyebrow">Live workspace state</span>
            <span className="badge badge--success">{sub?.status ?? 'No plan'}</span>
          </div>
          <div className="hero-side-panel__value">{sub?.plan?.name ?? 'No plan selected'}</div>
          <div className="hero-side-panel__details">
            <div>
              <span className="metric-label">Period</span>
              <strong>{summary ? `${periodDays} day cycle` : 'No billing period'}</strong>
            </div>
            <div>
              <span className="metric-label">Feature streams</span>
              <strong>{rankedUsage.length}</strong>
            </div>
            <div>
              <span className="metric-label">Tracked volume</span>
              <strong>{formatCompactNumber(totalUsage)}</strong>
            </div>
            <div>
              <span className="metric-label">Peak stream</span>
              <strong>{topFeature ? formatFeatureKey(topFeature.feature_key) : '—'}</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="workflow-grid">
        {workflowSteps.map((step) => (
          <Link
            key={step.to}
            className={`workflow-card${primaryAction.to === step.to ? ' workflow-card--recommended' : ''}`}
            to={step.to}
          >
            <span className="eyebrow">Step {String(step.order).padStart(2, '0')}</span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            <span className="workflow-card__cta">{primaryAction.to === step.to ? 'Recommended next step' : 'Open page'}</span>
          </Link>
        ))}
      </section>

      <section className="stats-grid">
        {quickStats.map((stat) => (
          <article key={stat.label} className="metric-card metric-card--dashboard">
            <span className="metric-label">{stat.label}</span>
            <strong>{stat.value}</strong>
            <span className="muted">{stat.meta}</span>
          </article>
        ))}
      </section>

      <section className="dashboard-overview-grid">
        <div className="card feature-volume-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Usage profile</p>
              <h2>Feature load this period</h2>
            </div>
            <Link className="button button--secondary" to="/usage">
              Deep dive
            </Link>
          </div>
          {rankedUsage.length > 0 ? (
            <div className="usage-rail">
              {rankedUsage.map((item) => (
                <div key={item.feature_key} className="usage-rail__item">
                  <div className="usage-rail__row">
                    <div className="usage-rail__label-group">
                      <strong>{formatFeatureKey(item.feature_key)}</strong>
                      <span>{item.feature_key}</span>
                    </div>
                    <span className="usage-rail__value">{item.total_amount.toLocaleString()}</span>
                  </div>
                  <div className="usage-rail__track">
                    <div
                      className="usage-rail__fill"
                      style={{ width: `${Math.max((item.total_amount / usageMax) * 100, 8)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No usage recorded for this billing period yet.</div>
          )}
        </div>

        <div className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Coverage</p>
              <h2>Entitlement footprint</h2>
            </div>
            <Link className="button button--secondary" to="/entitlements">
              View entitlements
            </Link>
          </div>
          {entitlements.length === 0 ? (
            <div className="empty-state">No entitlements yet. Choose a plan to activate feature access.</div>
          ) : (
            <div className="chip-grid chip-grid--dashboard">
              {entitlements.map((entitlement) => (
                <div key={entitlement.feature_key} className="feature-chip">
                  <strong>{formatFeatureKey(entitlement.feature_key)}</strong>
                  <small>{entitlement.feature_key}</small>
                  <span>{entitlement.limit_value === null ? 'Unlimited' : `${entitlement.limit_value.toLocaleString()} cap`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-lower-grid">
        <section className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Subscription</p>
              <h2>Plan and billing period</h2>
            </div>
            <Link className="button button--secondary" to="/billing">
              Manage billing
            </Link>
          </div>
          <div className="detail-list">
            <div className="detail-row">
              <span>Plan</span>
              <strong>{sub?.plan?.name ?? 'Not subscribed'}</strong>
            </div>
            <div className="detail-row">
              <span>Status</span>
              <strong>{sub?.status ?? '—'}</strong>
            </div>
            <div className="detail-row">
              <span>Current period</span>
              <strong>
                {summary ? `${formatDate(summary.period_start)} → ${formatDate(summary.period_end)}` : '—'}
              </strong>
            </div>
            {sub?.cancel_at_period_end ? (
              <div className="status-banner status-banner--warning">This subscription is scheduled to cancel at period end.</div>
            ) : null}
          </div>
        </section>

        <section className="card quick-actions-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Shortcuts</p>
              <h2>What operators usually do next</h2>
            </div>
          </div>
          <div className="action-grid">
            <Link className="action-tile" to="/usage">
              <span className="eyebrow">Analytics</span>
              <strong>Inspect daily usage</strong>
              <span>Track spikes, heavy features, and period totals.</span>
            </Link>
            <Link className="action-tile" to="/api-keys">
              <span className="eyebrow">Integration</span>
              <strong>Issue service keys</strong>
              <span>Connect a backend, worker, or scheduled job.</span>
            </Link>
            <Link className="action-tile" to="/entitlements">
              <span className="eyebrow">Access</span>
              <strong>Review plan limits</strong>
              <span>See exactly what the tenant can and cannot do.</span>
            </Link>
          </div>
        </section>
      </section>
    </div>
  )
}
