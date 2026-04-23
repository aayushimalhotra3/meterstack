import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'

const DEMO_EMAIL = 'demo-owner@meterstack.dev'
const DEMO_PASSWORD = 'DemoPass123!'

function DemoWorkspaceLoading({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="demo-loading-shell">
      <section className="demo-loading-card">
        <p className="eyebrow">Public demo workspace</p>
        <h1>Preparing MeterStack Demo</h1>
        <p>
          Loading seeded billing, access, integration, and usage data so you can explore the product immediately.
        </p>
        <div className="demo-loading-steps" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        {error ? (
          <div className="status-banner status-banner--warning">
            Demo data is still waking up. Refresh in a moment or try again.
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
  const startedAttempt = useRef<number | null>(null)

  useEffect(() => {
    if (accessToken || isLoading) return
    if (startedAttempt.current === attempt) return

    let cancelled = false
    startedAttempt.current = attempt

    login(DEMO_EMAIL, DEMO_PASSWORD)
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Demo workspace unavailable'
        setError(message)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, attempt, isLoading, login])

  if (accessToken && !isLoading) return children

  return (
    <DemoWorkspaceLoading
      error={error}
      onRetry={() => {
        setError(null)
        setAttempt((value) => value + 1)
      }}
    />
  )
}
