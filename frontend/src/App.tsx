import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy, type ReactNode } from 'react'
import AppShell from './components/AppShell'
import DemoSessionGate from './components/DemoSessionGate'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const UsagePage = lazy(() => import('./pages/UsagePage'))
const BillingPage = lazy(() => import('./pages/BillingPage'))
const EntitlementsPage = lazy(() => import('./pages/EntitlementsPage'))
const ApiKeysPage = lazy(() => import('./pages/ApiKeysPage'))
const BillingSuccessPage = lazy(() => import('./pages/BillingSuccessPage'))
const BillingCancelPage = lazy(() => import('./pages/BillingCancelPage'))
const BillingMockSuccessPage = lazy(() => import('./pages/BillingMockSuccessPage'))

function DemoPage({ children }: { children: ReactNode }) {
  return (
    <DemoSessionGate>
      <AppShell>{children}</AppShell>
    </DemoSessionGate>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="page-loading">Loading page...</div>}>
        <Routes>
          <Route
            path="/"
            element={
              <DemoPage>
                <DashboardPage />
              </DemoPage>
            }
          />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/signup" element={<Navigate to="/" replace />} />
          <Route
            path="/dashboard"
            element={
              <DemoPage>
                <DashboardPage />
              </DemoPage>
            }
          />
          <Route
            path="/usage"
            element={
              <DemoPage>
                <UsagePage />
              </DemoPage>
            }
          />
          <Route
            path="/billing"
            element={
              <DemoPage>
                <BillingPage />
              </DemoPage>
            }
          />
          <Route
            path="/billing/success"
            element={
              <DemoPage>
                <BillingSuccessPage />
              </DemoPage>
            }
          />
          <Route
            path="/billing/cancel"
            element={
              <DemoPage>
                <BillingCancelPage />
              </DemoPage>
            }
          />
          <Route
            path="/billing/mock-success"
            element={
              <DemoPage>
                <BillingMockSuccessPage />
              </DemoPage>
            }
          />
          <Route
            path="/api-keys"
            element={
              <DemoPage>
                <ApiKeysPage />
              </DemoPage>
            }
          />
          <Route
            path="/entitlements"
            element={
              <DemoPage>
                <EntitlementsPage />
              </DemoPage>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
