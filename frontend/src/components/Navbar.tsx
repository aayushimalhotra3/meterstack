import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Navbar() {
  const { user, tenant, logout } = useAuth()
  const nav = useNavigate()
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottom: '1px solid #eee' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <strong>MeterStack</strong>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/usage">Usage</Link>
        <Link to="/billing">Billing</Link>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span>{tenant?.name}</span>
        <span>{user?.email}</span>
        <button onClick={() => { logout(); nav('/login') }}>Logout</button>
      </div>
    </div>
  )
}
