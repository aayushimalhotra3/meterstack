import { Link } from 'react-router-dom'

export default function BillingMockSuccessPage() {
  return (
    <section className="hero-card result-card">
      <div>
        <p className="eyebrow">Mock billing mode</p>
        <h1>Plan updated instantly</h1>
        <p className="hero-copy">
          This public demo uses mock billing so reviewers can change plans without leaving the app or needing a Stripe
          account.
        </p>
      </div>
      <div className="page-actions">
        <Link className="button" to="/billing">
          Review billing details
        </Link>
        <Link className="button button--secondary" to="/dashboard">
          View dashboard
        </Link>
      </div>
    </section>
  )
}
