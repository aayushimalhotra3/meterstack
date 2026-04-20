import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api/client'
import { formatCurrencyCents, formatDate } from '../lib/formatters'

type Subscription = {
  plan?: { name?: string; description?: string }
  status?: string
  current_period_start?: string
  current_period_end?: string
  cancel_at_period_end?: boolean
}
type Plan = {
  id: string
  name: string
  description: string | null
  billing_interval: 'monthly' | 'yearly'
  base_price_cents: number
  is_current: boolean
}

function PlanCard({ plan, onCheckout, checkoutLoading }: { plan: Plan; onCheckout: (planId: string) => void; checkoutLoading: boolean }) {
  const isCurrent = plan.is_current
  return (
    <article className={`plan-card${isCurrent ? ' plan-card--current' : ''}`}>
      <div>
        <div className="plan-card__header">
          <h3>{plan.name}</h3>
          {isCurrent ? <span className="badge badge--success">Current</span> : null}
        </div>
        <p className="muted">{plan.description || 'Usage-aware SaaS billing plan'}</p>
      </div>
      <div className="plan-price">
        <strong>{formatCurrencyCents(plan.base_price_cents)}</strong>
        <span>/{plan.billing_interval === 'yearly' ? 'year' : 'month'}</span>
      </div>
      <button className="button" disabled={isCurrent || checkoutLoading} onClick={() => onCheckout(plan.id)}>
        {isCurrent ? 'Current plan' : checkoutLoading ? 'Redirecting...' : 'Choose plan'}
      </button>
    </article>
  )
}

export default function BillingPage() {
  const [sub, setSub] = useState<Subscription | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  useEffect(() => {
    Promise.all([apiRequest<Subscription>('/billing/subscription'), apiRequest<Plan[]>('/billing/plans')])
      .then(([subscription, planList]) => {
        setSub(subscription)
        setPlans(planList)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function startCheckout(planId: string) {
    setCheckoutLoading(true)
    try {
      const res = await apiRequest<{ url?: string }>('/billing/create-checkout-session', { method: 'POST', json: { plan_id: planId } })
      if (res?.url) window.location.assign(res.url)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unable to start checkout'
      setError(message)
    } finally {
      setCheckoutLoading(false)
    }
  }

  if (loading) return <div className="page-loading">Loading billing details...</div>
  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Step 01 of 04</p>
          <h1>Plans and billing state</h1>
          <p className="hero-copy">
            Start here. Choosing a plan activates the billing period and defines the feature limits the rest of the
            workspace will use.
          </p>
          <div className="hero-actions">
            <Link className="button button--secondary" to="/entitlements">
              Next: review entitlements
            </Link>
          </div>
        </div>
        <div className="hero-meta">
          <span className="inline-pill">First stop in the setup flow</span>
          <span className="inline-pill">{sub?.plan?.name ?? 'No plan selected'}</span>
          <span className="inline-pill">{sub?.status ?? 'No active subscription'}</span>
        </div>
      </section>

      {error ? <div className="status-banner status-banner--error">{error}</div> : null}

      <section className="split-grid">
        <div className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Current subscription</p>
              <h2>Live status</h2>
            </div>
          </div>
          <div className="detail-list">
            <div className="detail-row">
              <span>Plan</span>
              <strong>{sub?.plan?.name ?? 'No plan'}</strong>
            </div>
            <div className="detail-row">
              <span>Status</span>
              <strong>{sub?.status ?? 'No status'}</strong>
            </div>
            <div className="detail-row">
              <span>Period</span>
              <strong>
                {sub?.current_period_start ? `${formatDate(sub.current_period_start)} → ${formatDate(sub.current_period_end)}` : 'No period'}
              </strong>
            </div>
          </div>
          {sub?.cancel_at_period_end ? (
            <div className="status-banner status-banner--warning">This plan will cancel at the end of the current period.</div>
          ) : null}
        </div>

        <div className="card">
          <p className="eyebrow">What comes next</p>
          <h2>Follow the setup path</h2>
          <ol className="steps">
            <li>Choose the plan that matches the limits you want to test.</li>
            <li>Open Entitlements to confirm which features and quotas the plan enables.</li>
            <li>Create an API key so a backend can check quotas and send usage events.</li>
            <li>Open Usage to confirm analytics updates as traffic comes in.</li>
          </ol>
        </div>
      </section>

      <section className="plans-grid" data-tour="billing-plan">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} onCheckout={startCheckout} checkoutLoading={checkoutLoading} />
        ))}
      </section>
      {plans.length === 0 ? <div className="empty-state">No plans are configured yet.</div> : null}
    </div>
  )
}
