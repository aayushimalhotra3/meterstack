import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy, type ReactNode } from 'react'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/AppShell'
import { useAuth } from './hooks/useAuth'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const UsagePage = lazy(() => import('./pages/UsagePage'))
const BillingPage = lazy(() => import('./pages/BillingPage'))
const EntitlementsPage = lazy(() => import('./pages/EntitlementsPage'))
const ApiKeysPage = lazy(() => import('./pages/ApiKeysPage'))
const BillingSuccessPage = lazy(() => import('./pages/BillingSuccessPage'))
const BillingCancelPage = lazy(() => import('./pages/BillingCancelPage'))
const BillingMockSuccessPage = lazy(() => import('./pages/BillingMockSuccessPage'))

function ProtectedPage({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  )
}

function LandingPage() {
  const { accessToken } = useAuth()
  return <Navigate to={accessToken ? '/dashboard' : '/login'} replace />
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="page-loading">Loading page...</div>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedPage>
                <DashboardPage />
              </ProtectedPage>
            }
          />
          <Route
            path="/usage"
            element={
              <ProtectedPage>
                <UsagePage />
              </ProtectedPage>
            }
          />
          <Route
            path="/billing"
            element={
              <ProtectedPage>
                <BillingPage />
              </ProtectedPage>
            }
          />
          <Route
            path="/billing/success"
            element={
              <ProtectedPage>
                <BillingSuccessPage />
              </ProtectedPage>
            }
          />
          <Route
            path="/billing/cancel"
            element={
              <ProtectedPage>
                <BillingCancelPage />
              </ProtectedPage>
            }
          />
          <Route
            path="/billing/mock-success"
            element={
              <ProtectedPage>
                <BillingMockSuccessPage />
              </ProtectedPage>
            }
          />
          <Route
            path="/api-keys"
            element={
              <ProtectedPage>
                <ApiKeysPage />
              </ProtectedPage>
            }
          />
          <Route
            path="/entitlements"
            element={
              <ProtectedPage>
                <EntitlementsPage />
              </ProtectedPage>
            }
          />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
