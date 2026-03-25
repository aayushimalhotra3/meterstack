import { Link } from 'react-router-dom'

export default function BillingCancelPage() {
  return (
    <section className="hero-card result-card">
      <div>
        <p className="eyebrow">Checkout canceled</p>
        <h1>No subscription changes were made</h1>
        <p className="hero-copy">
          You can return to billing at any time to try a different plan or finish the upgrade flow later.
        </p>
      </div>
      <div className="page-actions">
        <Link className="button" to="/billing">
          Return to billing
        </Link>
      </div>
    </section>
  )
}
