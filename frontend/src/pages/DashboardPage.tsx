import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api/client'
import OverviewTour from '../components/OverviewTour'
import { formatCompactNumber, formatDate, formatFeatureKey } from '../lib/formatters'

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
  const [tourRestartSignal, setTourRestartSignal] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        const [b, e, usageResult] = await Promise.allSettled([
          apiRequest<Subscription>('/billing/subscription'),
          apiRequest<Entitlement[]>('/entitlements/'),
          apiRequest<{ period_start: string; period_end: string; usage: UsageRow[] }>('/analytics/summary'),
        ])
        if (b.status === 'fulfilled') setSub(b.value)
        else throw b.reason
        if (e.status === 'fulfilled') setEntitlements(e.value)
        else throw e.reason
        if (usageResult.status === 'fulfilled') {
          setSummary(usageResult.value)
        } else {
          const analyticsMessage = usageResult.reason instanceof Error ? usageResult.reason.message : ''
          if (analyticsMessage !== 'no_active_subscription') throw usageResult.reason
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
  const topFeatureShare = totalUsage && topFeature ? Math.round((topFeature.total_amount / totalUsage) * 100) : 0
  const periodDays = summary
    ? Math.max(
        1,
        Math.round((new Date(summary.period_end).getTime() - new Date(summary.period_start).getTime()) / (1000 * 60 * 60 * 24)) + 1,
      )
    : 0
  const averageDailyUsage = periodDays ? Math.round(totalUsage / periodDays) : 0
  const primaryAction = !hasPlan
    ? { to: '/billing', label: 'Choose a plan' }
    : totalUsage === 0
      ? { to: '/api-keys', label: 'Create an API key' }
      : { to: '/usage', label: 'Open analytics' }
  const journeyMessage = !hasPlan
    ? 'Start with Billing to activate the tenant and set the limits the rest of the workspace runs on.'
    : totalUsage === 0
      ? 'Your plan is live. Next, create an API key and send a usage event so analytics has something to display.'
      : 'This demo workspace is already set up. Start with analytics to see the usage story, then inspect billing, access, and API keys.'
  const quickStats = [
    {
      label: 'Metered volume',
      value: totalUsage.toLocaleString(),
      meta: periodDays ? `${averageDailyUsage.toLocaleString()} units per day on average` : 'Units tracked this billing period',
    },
    {
      label: 'Top feature',
      value: topFeature ? formatFeatureKey(topFeature.feature_key) : 'No usage yet',
      meta: topFeature ? `${topFeatureShare}% of period volume` : 'No usage yet',
    },
    {
      label: 'Active streams',
      value: rankedUsage.length.toLocaleString(),
      meta: entitlements.length ? `${entitlements.length.toLocaleString()} plan-backed capabilities` : 'Plan-backed capability surface',
    },
  ]
  const heroSignals = [
    {
      label: 'Plan state',
      value: sub?.plan?.name ?? 'No plan',
      meta: sub?.status ?? 'Waiting',
    },
    {
      label: 'Daily pace',
      value: averageDailyUsage ? formatCompactNumber(averageDailyUsage) : 'No usage',
      meta: periodDays ? `${periodDays} day period` : 'No period yet',
    },
    {
      label: 'Dominant stream',
      value: topFeature ? formatFeatureKey(topFeature.feature_key) : 'Pending',
      meta: topFeature ? `${topFeatureShare}% share` : 'Needs events',
    },
  ]
  const workflowGuide = [
    {
      step: 'Step 01',
      to: '/billing',
      label: 'Open Billing',
      title: 'Choose a plan',
      copy: 'Activate the workspace period and set the quota model for the tenant.',
    },
    {
      step: 'Step 02',
      to: '/entitlements',
      label: 'Open Access',
      title: 'Review entitlements',
      copy: 'Confirm which features are available and what limits apply.',
    },
    {
      step: 'Step 03',
      to: '/api-keys',
      label: 'Open Integrations',
      title: 'Create an API key',
      copy: 'Connect backend services so they can check limits and report usage.',
    },
    {
      to: '/usage',
      step: 'Step 04',
      label: 'Open Analytics',
      title: 'Inspect usage',
      copy: 'See usage events roll up into trends, totals, and stream-level insight.',
    },
  ]

  if (loading) return <div className="page-loading">Loading workspace overview...</div>
  if (error) return <div className="status-banner status-banner--error">{error}</div>
  return (
    <div className="page-stack dashboard-stack">
      <section className="hero-card hero-card--dashboard">
        <div className="hero-main">
          <div className="hero-kicker-row">
            <p className="eyebrow">Workspace overview</p>
            <span className="inline-pill inline-pill--demo">Seeded sample workspace</span>
          </div>
          <h1>Command center for billing, access, and usage.</h1>
          <p className="hero-copy">{journeyMessage}</p>
          <p className="hero-demo-note">Demo workspace with seeded usage, billing, access, and integration data.</p>
          <div className="hero-actions">
            <Link className="button" to={primaryAction.to}>
              {primaryAction.label}
            </Link>
            <Link className="button button--secondary" to="/api-keys">
              Review API keys
            </Link>
            <button className="button button--ghost" type="button" onClick={() => setTourRestartSignal((value) => value + 1)}>
              Start tour again
            </button>
          </div>
          <div className="hero-signal-grid" aria-label="Workspace signals">
            {heroSignals.map((signal) => (
              <div className="hero-signal-card" key={signal.label}>
                <span className="metric-label">{signal.label}</span>
                <strong>{signal.value}</strong>
                <small>{signal.meta}</small>
              </div>
            ))}
          </div>
        </div>

        <aside className="hero-side-panel" data-overview-tour="welcome">
          <div className="hero-side-panel__header">
            <span className="eyebrow">Live workspace state</span>
            <span className="badge badge--success">{sub?.status ?? 'No plan'}</span>
          </div>
          <div className="hero-side-panel__value">{sub?.plan?.name ?? 'No plan selected'}</div>
          <div className="hero-side-panel__spotlight">
            <span className="metric-label">Top stream</span>
            <strong>{topFeature ? formatFeatureKey(topFeature.feature_key) : 'Waiting for usage'}</strong>
            <span>{topFeature ? `${topFeatureShare}% of current period volume` : 'Usage will appear here after events arrive.'}</span>
          </div>
          <div className="hero-side-panel__details">
            <div>
              <span className="metric-label">Usage streams</span>
              <strong>{rankedUsage.length}</strong>
            </div>
            <div>
              <span className="metric-label">Tracked volume</span>
              <strong>{formatCompactNumber(totalUsage)}</strong>
            </div>
            <div>
              <span className="metric-label">Period</span>
              <strong>{summary ? `${periodDays} days` : 'No billing period'}</strong>
            </div>
          </div>
          <div className="hero-side-panel__signal">
            <span>Demo readiness</span>
            <strong>{hasPlan && totalUsage > 0 ? 'Ready to show' : 'Needs setup'}</strong>
          </div>
        </aside>
      </section>

      <section className="stats-grid stats-grid--compact dashboard-stats-grid">
        {quickStats.map((stat, index) => (
          <article
            key={stat.label}
            className={`metric-card metric-card--dashboard${index === 0 ? ' metric-card--featured' : ''}`}
          >
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
              {rankedUsage.map((item, index) => {
                const share = totalUsage ? Math.round((item.total_amount / totalUsage) * 100) : 0
                return (
                  <div key={item.feature_key} className="usage-rail__item">
                    <div className="usage-rail__row">
                      <div className="usage-rail__label-group">
                        <span className="usage-rail__rank">{String(index + 1).padStart(2, '0')}</span>
                        <div>
                          <strong>{formatFeatureKey(item.feature_key)}</strong>
                          <span>{share}% of total volume</span>
                        </div>
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
                )
              })}
            </div>
          ) : (
            <div className="empty-state">No usage recorded for this billing period yet.</div>
          )}
        </div>

        <div className="card dashboard-guide-card workflow-guide-card" id="demo-workflow">
          <div className="section-header">
            <div>
              <p className="eyebrow">How MeterStack works</p>
              <h2>A four-step usage billing workflow</h2>
            </div>
          </div>
          <p className="workflow-guide-card__intro">
            This overview stays stable. Use the cards below when you are ready to inspect each part of the demo.
          </p>
          <div className="workflow-step-grid">
            {workflowGuide.map((step) => (
              <Link className="workflow-step-card" key={step.to} to={step.to}>
                <span className="workflow-step-card__step">{step.step}</span>
                <strong>{step.title}</strong>
                <small>{step.copy}</small>
                <span className="workflow-step-card__action">{step.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-support-grid">
        <section className="card dashboard-support-card dashboard-support-card--access">
          <div className="section-header">
            <div>
              <p className="eyebrow">Plan access</p>
              <h2>What this tenant can use</h2>
            </div>
            <Link className="button button--secondary" to="/entitlements">
              Details
            </Link>
          </div>
          {entitlements.length === 0 ? (
            <div className="empty-state">No entitlements yet. Choose a plan to activate feature access.</div>
          ) : (
            <div className="entitlement-summary-list">
              {entitlements.slice(0, 5).map((entitlement) => (
                <div key={entitlement.feature_key} className="entitlement-summary-row">
                  <span>{formatFeatureKey(entitlement.feature_key)}</span>
                  <strong>{entitlement.limit_value === null ? 'Unlimited' : `${formatCompactNumber(entitlement.limit_value)} cap`}</strong>
                </div>
              ))}
              {entitlements.length > 5 ? <span className="muted">+{entitlements.length - 5} more entitlements</span> : null}
            </div>
          )}
        </section>
        <section className="card dashboard-support-card dashboard-support-card--billing">
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
              <strong>{sub?.status ?? 'No status'}</strong>
            </div>
            <div className="detail-row">
              <span>Current period</span>
              <strong>
                {summary ? `${formatDate(summary.period_start)} → ${formatDate(summary.period_end)}` : 'No period'}
              </strong>
            </div>
            {sub?.cancel_at_period_end ? (
              <div className="status-banner status-banner--warning">This subscription is scheduled to cancel at period end.</div>
            ) : null}
          </div>
        </section>
      </section>
      <OverviewTour restartSignal={tourRestartSignal} />
    </div>
  )
}
