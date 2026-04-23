import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

const TOUR_STORAGE_KEY = 'meterstack-overview-tour-seen'

const tourSteps = [
  {
    target: '[data-overview-tour="welcome"]',
    label: 'Step 01 of 04',
    title: 'Welcome to MeterStack',
    copy: 'MeterStack shows how a SaaS team can connect plans, feature access, API keys, and usage analytics in one workspace.',
  },
  {
    target: '[data-overview-tour="billing"]',
    label: 'Step 02 of 04',
    title: 'Plan and billing',
    copy: 'Billing starts the workspace period and sets the usage limits the tenant will operate within.',
  },
  {
    target: '[data-overview-tour="integration"]',
    label: 'Step 03 of 04',
    title: 'Access and integration',
    copy: 'Entitlements define what the tenant can use. API keys let services check limits and report usage.',
  },
  {
    target: '[data-overview-tour="analytics"]',
    label: 'Step 04 of 04',
    title: 'Usage and analytics',
    copy: 'Events roll up into totals, trends, daily pace, and stream-level insight for the demo workspace.',
  },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function measureTarget(selector: string) {
  return document.querySelector<HTMLElement>(selector)?.getBoundingClientRect() ?? null
}

export default function OverviewTour({ restartSignal = 0 }: { restartSignal?: number }) {
  const [isActive, setIsActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const autoStartQueued = useRef(false)
  const step = tourSteps[stepIndex]
  const isLastStep = stepIndex === tourSteps.length - 1

  const startTour = useCallback(() => {
    setStepIndex(0)
    setTargetRect(measureTarget(tourSteps[0].target))
    setIsActive(true)
  }, [])

  const closeTour = useCallback(() => {
    sessionStorage.setItem(TOUR_STORAGE_KEY, 'true')
    setIsActive(false)
    setTargetRect(null)
  }, [])

  useEffect(() => {
    if (sessionStorage.getItem(TOUR_STORAGE_KEY) === 'true') return
    if (autoStartQueued.current) return

    const timeout = window.setTimeout(() => {
      if (autoStartQueued.current || sessionStorage.getItem(TOUR_STORAGE_KEY) === 'true') return
      autoStartQueued.current = true
      startTour()
    }, 160)

    return () => window.clearTimeout(timeout)
  }, [startTour])

  useEffect(() => {
    if (restartSignal === 0) return

    const timeout = window.setTimeout(() => {
      startTour()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [restartSignal, startTour])

  useEffect(() => {
    if (!isActive) return

    function updateTarget() {
      setTargetRect(measureTarget(step.target))
    }

    const timeout = window.setTimeout(updateTarget, 0)
    window.addEventListener('resize', updateTarget)

    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('resize', updateTarget)
    }
  }, [isActive, step.target])

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
    const left = clamp(targetRect.left - 8, 8, window.innerWidth - 16)
    const top = clamp(targetRect.top - 8, 8, window.innerHeight - 16)
    return {
      top,
      left,
      width: Math.min(targetRect.width + 16, window.innerWidth - left - 8),
      height: Math.min(targetRect.height + 16, window.innerHeight - top - 8),
    }
  }, [targetRect])

  const cardStyle = useMemo<CSSProperties>(() => {
    const width = Math.min(390, Math.max(300, window.innerWidth - 32))
    if (!targetRect) {
      return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width }
    }

    const estimatedHeight = isLastStep ? 360 : 300
    const rightSpace = window.innerWidth - targetRect.right - 18
    const leftSpace = targetRect.left - 18

    if (rightSpace >= width) {
      return {
        left: targetRect.right + 18,
        top: clamp(targetRect.top, 16, Math.max(16, window.innerHeight - estimatedHeight - 16)),
        width,
      }
    }

    if (leftSpace >= width) {
      return {
        left: targetRect.left - width - 18,
        top: clamp(targetRect.top, 16, Math.max(16, window.innerHeight - estimatedHeight - 16)),
        width,
      }
    }

    const centeredLeft = clamp(targetRect.left + targetRect.width / 2 - width / 2, 16, window.innerWidth - width - 16)
    const belowTop = targetRect.bottom + 16
    const aboveTop = targetRect.top - estimatedHeight - 16

    if (belowTop + estimatedHeight <= window.innerHeight - 16) {
      return { left: centeredLeft, top: belowTop, width }
    }

    if (aboveTop >= 16) {
      return { left: centeredLeft, top: aboveTop, width }
    }

    return {
      left: centeredLeft,
      top: clamp(targetRect.top, 16, Math.max(16, window.innerHeight - estimatedHeight - 16)),
      width,
    }
  }, [isLastStep, targetRect])

  if (!isActive) return null

  function goNext() {
    if (isLastStep) {
      closeTour()
      return
    }
    const nextStepIndex = stepIndex + 1
    setStepIndex(nextStepIndex)
    setTargetRect(measureTarget(tourSteps[nextStepIndex].target))
  }

  const tour = (
    <div className="overview-tour-layer" role="dialog" aria-label="MeterStack overview tour" aria-live="polite">
      {spotlightStyle ? <div className="overview-tour-spotlight" style={spotlightStyle} /> : null}
      <section className="overview-tour-card" style={cardStyle}>
        <div className="overview-tour-card__header">
          <span className="eyebrow">{step.label}</span>
          <button className="overview-tour-card__skip" type="button" onClick={closeTour}>
            Skip
          </button>
        </div>
        <h2>{step.title}</h2>
        <p>{step.copy}</p>
        <div className="overview-tour-progress" aria-hidden="true">
          {tourSteps.map((tourStep, index) => (
            <span
              key={tourStep.title}
              className={`overview-tour-progress__dot${index <= stepIndex ? ' overview-tour-progress__dot--active' : ''}`}
            />
          ))}
        </div>
        {isLastStep ? (
          <div className="overview-tour-links" aria-label="Choose where to go next">
            <Link className="button button--secondary button--compact" to="/billing" onClick={closeTour}>
              Open Billing
            </Link>
            <Link className="button button--secondary button--compact" to="/entitlements" onClick={closeTour}>
              Open Access
            </Link>
            <Link className="button button--secondary button--compact" to="/api-keys" onClick={closeTour}>
              Open API Keys
            </Link>
            <Link className="button button--secondary button--compact" to="/usage" onClick={closeTour}>
              Open Analytics
            </Link>
          </div>
        ) : null}
        <div className="overview-tour-card__actions">
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

  return createPortal(tour, document.body)
}
