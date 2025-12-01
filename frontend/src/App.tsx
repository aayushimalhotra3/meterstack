import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import DashboardPage from './pages/DashboardPage'
import UsagePage from './pages/UsagePage'
import BillingPage from './pages/BillingPage'
import EntitlementsPage from './pages/EntitlementsPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div>
                <Navbar />
                <DashboardPage />
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/usage"
          element={
            <ProtectedRoute>
              <div>
                <Navbar />
                <UsagePage />
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing"
          element={
            <ProtectedRoute>
              <div>
                <Navbar />
                <BillingPage />
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/entitlements"
          element={
            <ProtectedRoute>
              <div>
                <Navbar />
                <EntitlementsPage />
              </div>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
