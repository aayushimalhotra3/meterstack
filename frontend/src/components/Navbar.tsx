import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getNextWorkflowStep, getWorkflowStep, workflowSteps } from '../lib/workflow'
import { startGuidedTour } from '../lib/tour'

export default function Navbar() {
  const { user, tenant, logout } = useAuth()
  const location = useLocation()
  const nav = useNavigate()
  const currentStep = getWorkflowStep(location.pathname)
  const nextStep = getNextWorkflowStep(location.pathname)
  const currentOrder = currentStep?.order ?? 0

  return (
    <header className="topbar">
      <div className="topbar__content">
        <div className="topbar__frame">
          <div className="topbar__primary">
            <div className="brand">
              <div className="brand-mark">M</div>
              <div className="brand-copy">
                <div className="brand-kicker">Revenue systems console</div>
                <div className="brand-name">MeterStack</div>
                <div className="brand-subtitle">A clear path from plan setup to usage analytics.</div>
              </div>
            </div>

            <div className="topbar__summary">
              <span className="eyebrow">{currentStep ? `Step 0${currentStep.order} of 04` : 'Suggested flow'}</span>
              <strong>{currentStep ? currentStep.title : 'Start with Billing, then move left to right through the setup flow.'}</strong>
              <span className="topbar__summary-copy">
                {currentStep
                  ? currentStep.description
                  : 'Overview shows the full workspace state, but the main path is plan setup, access review, integration, then analytics.'}
              </span>
              {nextStep ? (
                <NavLink className="topbar__summary-link" to={nextStep.to}>
                  Next: {nextStep.title}
                </NavLink>
              ) : (
                <NavLink className="topbar__summary-link" to="/dashboard">
                  Back to workspace overview
                </NavLink>
              )}
            </div>

            <div className="workspace-card workspace-card--compact">
              <div className="workspace-card__row">
                <span className="identity-label">Tenant</span>
                <strong>{tenant?.name ?? 'Workspace'}</strong>
              </div>
              <div className="workspace-card__row">
                <span className="identity-label">Signed in</span>
                <strong>{user?.email ?? 'Unknown user'}</strong>
              </div>
              <div className="workspace-card__actions">
                <button className="button button--ghost button--compact" type="button" onClick={startGuidedTour}>
                  Start tour
                </button>
                <button
                  className="button button--ghost button--compact"
                  onClick={() => {
                    logout()
                    nav('/login')
                  }}
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>

          <nav className="nav-strip">
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) => `nav-tab nav-tab--overview${isActive ? ' nav-tab--active' : ''}`}
            >
              <span className="nav-tab__index">00</span>
              <span className="nav-tab__copy">
                <strong>Overview</strong>
                <span>Workspace pulse</span>
              </span>
            </NavLink>

            {workflowSteps.map((step) => (
              <NavLink
                key={step.to}
                to={step.to}
                className={({ isActive }) => {
                  const stepState = isActive ? 'current' : step.order < currentOrder ? 'complete' : 'upcoming'
                  return `nav-tab nav-tab--${stepState}${isActive ? ' nav-tab--active' : ''}`
                }}
              >
                <span className="nav-tab__index">{String(step.order).padStart(2, '0')}</span>
                <span className="nav-tab__copy">
                  <strong>{step.navLabel}</strong>
                  <span>{step.title}</span>
                </span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </header>
  )
}
