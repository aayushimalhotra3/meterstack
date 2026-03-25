import { Link } from 'react-router-dom'

export default function BillingSuccessPage() {
  return (
    <section className="hero-card result-card">
      <div>
        <p className="eyebrow">Checkout complete</p>
        <h1>Subscription updated</h1>
        <p className="hero-copy">
          Stripe redirected back successfully. MeterStack will reflect the latest subscription state after the webhook
          confirms the checkout session.
        </p>
      </div>
      <div className="page-actions">
        <Link className="button" to="/billing">
          Back to billing
        </Link>
        <Link className="button button--secondary" to="/dashboard">
          Open dashboard
        </Link>
      </div>
    </section>
  )
}
