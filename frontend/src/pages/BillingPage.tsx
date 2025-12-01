import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client'

type Subscription = { plan?: { name?: string; description?: string }; status?: string; current_period_start?: string; current_period_end?: string; cancel_at_period_end?: boolean }

const STARTER_PLAN_ID = import.meta.env.VITE_STARTER_PLAN_ID || ''
const PRO_PLAN_ID = import.meta.env.VITE_PRO_PLAN_ID || ''

function PlanCard({ name, desc, price, planId, currentPlanName, onCheckout }: { name: string; desc: string; price: string; planId: string; currentPlanName?: string | null; onCheckout: (planId: string) => void }) {
  const isCurrent = currentPlanName === name
  return (
    <div style={{ border: '1px solid #eee', padding: 16 }}>
      <h4>{name}</h4>
      <div>{desc}</div>
      <div style={{ margin: '8px 0' }}>{price}</div>
      <button disabled={!planId || isCurrent} onClick={() => onCheckout(planId)}>{isCurrent ? 'Current plan' : 'Upgrade'}</button>
      {!planId && <div style={{ color: '#999', marginTop: 6 }}>Set VITE_STARTER_PLAN_ID / VITE_PRO_PLAN_ID</div>}
    </div>
  )
}

export default function BillingPage() {
  const [sub, setSub] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    apiRequest('/billing/subscription').then(setSub).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [])

  async function startCheckout(planId: string) {
    const res = await apiRequest('/billing/create-checkout-session', { method: 'POST', json: { plan_id: planId } })
    if (res?.url) window.location.assign(res.url)
  }

  const currentPlanName = sub?.plan?.name || null

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>
  if (error) return <div style={{ padding: 24, color: 'red' }}>{error}</div>
  return (
    <div style={{ padding: 24 }}>
      <h3>Billing</h3>
      <div style={{ marginBottom: 12 }}>Plan: {sub?.plan?.name || '—'} | Status: {sub?.status || '—'}</div>
      <div>Period: {sub?.current_period_start} → {sub?.current_period_end}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
        <PlanCard name="Starter" desc="Starter plan" price="$0/mo" planId={STARTER_PLAN_ID} currentPlanName={currentPlanName} onCheckout={startCheckout} />
        <PlanCard name="Pro" desc="Pro plan" price="$29/mo" planId={PRO_PLAN_ID} currentPlanName={currentPlanName} onCheckout={startCheckout} />
      </div>
    </div>
  )
}
