import { useMemo, useState, ReactNode, useEffect, useCallback } from 'react'
import { apiRequest } from '../api/client'
import { AuthContext, AuthState, UserInfo, TenantInfo } from './authCtx'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem('accessToken'))
  const [user, setUser] = useState<UserInfo | null>(null)
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    ;(async () => {
      try {
        const me = await apiRequest('/me')
        if (cancelled) return
        setUser(me.user)
        setTenant(me.tenant)
      } catch (e) {
        console.error(e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [accessToken])

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiRequest('/auth/login', { method: 'POST', json: { email, password } })
    localStorage.setItem('accessToken', res.access_token)
    setAccessToken(res.access_token)
    const me = await apiRequest('/me')
    setUser(me.user)
    setTenant(me.tenant)
  }, [])

  const signup = useCallback(async (tenantName: string, email: string, password: string) => {
    const res = await apiRequest('/auth/signup', { method: 'POST', json: { tenant_name: tenantName, email, password } })
    localStorage.setItem('accessToken', res.access_token)
    setAccessToken(res.access_token)
    const me = await apiRequest('/me')
    setUser(me.user)
    setTenant(me.tenant)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken')
    setAccessToken(null)
    setUser(null)
    setTenant(null)
  }, [])

  const value = useMemo<AuthState>(() => ({ accessToken, user, tenant, login, signup, logout }), [accessToken, user, tenant, login, signup, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
