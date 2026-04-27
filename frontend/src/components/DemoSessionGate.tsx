import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'

const DEMO_EMAIL = 'demo-owner@meterstack.dev'
const DEMO_PASSWORD = 'DemoPass123!'
const DEMO_TIMEOUT_MESSAGE = "Backend is waking up - this takes about 60 seconds on Render's free tier"

function DemoWorkspaceLoading({
  error,
  onRetry,
  slowLoad,
}: {
  error: string | null
  onRetry: () => void
  slowLoad: boolean
}) {
  return (
    <div className="demo-loading-shell">
      <section className="demo-loading-card">
        <p className="eyebrow">Public demo workspace</p>
        <h1>Preparing MeterStack Demo</h1>
        <p>
          Loading seeded billing, access, integration, and usage data so you can explore the product immediately.
        </p>
        {slowLoad && !error ? (
          <p className="demo-loading-hint">
            Backend is waking up from sleep - this takes about 60 seconds on Render&apos;s free tier. Hang tight.
          </p>
        ) : (
          <div className="demo-loading-steps" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
        {error ? (
          <div className="status-banner status-banner--warning">
            Backend timed out or is unavailable (Render free tier sleeps after 15 min of inactivity and the free
            Postgres expires after 30 days). Click "Try again" - if it just spun up, the next attempt will work.
            <button className="button button--secondary button--compact" type="button" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default function DemoSessionGate({ children }: { children: ReactNode }) {
  const { accessToken, isLoading, login } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [slowLoad, setSlowLoad] = useState(false)
  const startedAttempt = useRef<number | null>(null)

  useEffect(() => {
    if (accessToken || isLoading) return
    if (startedAttempt.current === attempt) return

    let cancelled = false
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 15_000)
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setSlowLoad(true)
    }, 8_000)
    let wakeTimeoutId: number | undefined
    startedAttempt.current = attempt

    const wakeTimeoutPromise = new Promise<never>((_, reject) => {
      wakeTimeoutId = window.setTimeout(() => reject(new Error(DEMO_TIMEOUT_MESSAGE)), 15_000)
    })

    Promise.race([
      login(DEMO_EMAIL, DEMO_PASSWORD, controller.signal),
      wakeTimeoutPromise,
    ])
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err instanceof DOMException && err.name === 'AbortError'
            ? DEMO_TIMEOUT_MESSAGE
            : err instanceof Error
              ? err.message
              : 'Demo workspace unavailable'
        setError(message)
      })
      .finally(() => {
        window.clearTimeout(timeoutId)
        window.clearTimeout(slowTimer)
        if (wakeTimeoutId) window.clearTimeout(wakeTimeoutId)
        if (!cancelled) setSlowLoad(false)
      })

    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timeoutId)
      window.clearTimeout(slowTimer)
      if (wakeTimeoutId) window.clearTimeout(wakeTimeoutId)
    }
  }, [accessToken, attempt, isLoading, login])

  if (accessToken && !isLoading) return children

  return (
    <DemoWorkspaceLoading
      error={error}
      slowLoad={slowLoad}
      onRetry={() => {
        setError(null)
        setSlowLoad(false)
        setAttempt((value) => value + 1)
      }}
    />
  )
}
