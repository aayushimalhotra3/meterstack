import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { TOUR_EVENT } from '../lib/tour'

const tourSteps = [
  {
    path: '/billing',
    target: '[data-tour="billing-plan"]',
    label: 'Step 01 of 04',
    title: 'Choose a plan',
    copy: 'Billing starts the workspace period and sets the quota limits the tenant will use.',
  },
  {
    path: '/entitlements',
    target: '[data-tour="entitlements-review"]',
    label: 'Step 02 of 04',
    title: 'Review entitlements',
    copy: 'This table shows which features are included and the limits attached to each one.',
  },
  {
    path: '/api-keys',
    target: '[data-tour="api-key-create"]',
    label: 'Step 03 of 04',
    title: 'Create an API key',
    copy: 'Backend services use keys to check quotas and report usage back into MeterStack.',
  },
  {
    path: '/usage',
    target: '[data-tour="analytics-chart"]',
    label: 'Step 04 of 04',
    title: 'Inspect analytics',
    copy: 'Usage events roll up into trends, totals, and stream-level insight for the workspace.',
  },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export default function GuidedTour() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isActive, setIsActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  const storageKey = `meterstack-tour-seen:${user?.email ?? 'demo'}`
  const step = tourSteps[stepIndex]

  const startTour = useCallback(() => {
    setStepIndex(0)
    setTargetRect(null)
    setIsActive(true)
    navigate(tourSteps[0].path)
  }, [navigate])

  const closeTour = useCallback(() => {
    sessionStorage.setItem(storageKey, 'true')
    setIsActive(false)
    setTargetRect(null)
  }, [storageKey])

  useEffect(() => {
    if (sessionStorage.getItem(storageKey) === 'true') return
    const timeout = window.setTimeout(() => {
      startTour()
      sessionStorage.setItem(storageKey, 'true')
    }, 450)
    return () => window.clearTimeout(timeout)
  }, [startTour, storageKey])

  useEffect(() => {
    function handleStartTour() {
      startTour()
    }

    window.addEventListener(TOUR_EVENT, handleStartTour)
    return () => window.removeEventListener(TOUR_EVENT, handleStartTour)
  }, [startTour])

  useEffect(() => {
    if (!isActive) return
    if (location.pathname !== step.path) {
      navigate(step.path)
    }
  }, [isActive, location.pathname, navigate, step.path])

  useEffect(() => {
    if (!isActive) return

    let retries = 0
    let timer: number | undefined

    function updateTarget() {
      const target = document.querySelector<HTMLElement>(step.target)
      if (!target) {
        if (retries < 24) {
          retries += 1
          timer = window.setTimeout(updateTarget, 120)
        }
        return
      }

      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      window.setTimeout(() => setTargetRect(target.getBoundingClientRect()), 180)
    }

    function refreshRect() {
      const target = document.querySelector<HTMLElement>(step.target)
      if (target) setTargetRect(target.getBoundingClientRect())
    }

    updateTarget()
    window.addEventListener('resize', refreshRect)
    window.addEventListener('scroll', refreshRect, true)

    return () => {
      if (timer) window.clearTimeout(timer)
      window.removeEventListener('resize', refreshRect)
      window.removeEventListener('scroll', refreshRect, true)
    }
  }, [isActive, location.pathname, step.target])

  useEffect(() => {
    if (!isActive) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeTour()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeTour, isActive])

  const spotlightStyle = useMemo<CSSProperties | undefined>(() => {
    if (!targetRect) return undefined
    return {
      top: targetRect.top - 10,
      left: targetRect.left - 10,
      width: targetRect.width + 20,
      height: targetRect.height + 20,
    }
  }, [targetRect])

  const cardStyle = useMemo<CSSProperties>(() => {
    const width = Math.min(360, Math.max(280, window.innerWidth - 36))
    if (!targetRect) {
      return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width }
    }
    const left = clamp(targetRect.left, 18, window.innerWidth - width - 18)
    const hasSpaceBelow = targetRect.bottom + 250 < window.innerHeight
    const top = hasSpaceBelow ? targetRect.bottom + 20 : clamp(targetRect.top - 238, 18, window.innerHeight - 240)
    return { left, top, width }
  }, [targetRect])

  if (!isActive) return null

  const isLastStep = stepIndex === tourSteps.length - 1

  function goNext() {
    if (isLastStep) {
      closeTour()
      return
    }
    const nextIndex = stepIndex + 1
    setStepIndex(nextIndex)
    setTargetRect(null)
    navigate(tourSteps[nextIndex].path)
  }

  return (
    <div className="tour-layer" role="dialog" aria-label="MeterStack guided tour" aria-live="polite">
      {spotlightStyle ? <div className="tour-spotlight" style={spotlightStyle} /> : null}
      <section className="tour-card" style={cardStyle}>
        <div className="tour-card__header">
          <span className="eyebrow">{step.label}</span>
          <button className="tour-card__skip" type="button" onClick={closeTour}>
            Skip
          </button>
        </div>
        <h2>{step.title}</h2>
        <p>{step.copy}</p>
        <div className="tour-progress" aria-hidden="true">
          {tourSteps.map((tourStep, index) => (
            <span
              key={tourStep.title}
              className={`tour-progress__dot${index <= stepIndex ? ' tour-progress__dot--active' : ''}`}
            />
          ))}
        </div>
        <div className="tour-card__actions">
          <button className="button button--secondary" type="button" onClick={closeTour}>
            Skip tour
          </button>
          <button className="button" type="button" onClick={goNext}>
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
      </section>
    </div>
  )
}
