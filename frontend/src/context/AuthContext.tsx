import { useMemo, useState, useEffect, useCallback, type ReactNode } from 'react'
import { apiRequest } from '../api/client'
import { AuthContext, type AuthState, type UserInfo, type TenantInfo } from './authCtx'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem('accessToken'))
  const [user, setUser] = useState<UserInfo | null>(null)
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(accessToken))

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken')
    setAccessToken(null)
    setUser(null)
    setTenant(null)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (!accessToken) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    ;(async () => {
      try {
        const me = await apiRequest<{ user: UserInfo; tenant: TenantInfo }>('/me')
        if (cancelled) return
        setUser(me.user)
        setTenant(me.tenant)
      } catch (e) {
        console.error(e)
        if (!cancelled) logout()
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [accessToken, logout])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const res = await apiRequest<{ access_token: string }>('/auth/login', { method: 'POST', json: { email, password } })
      localStorage.setItem('accessToken', res.access_token)
      setAccessToken(res.access_token)
      const me = await apiRequest<{ user: UserInfo; tenant: TenantInfo }>('/me')
      setUser(me.user)
      setTenant(me.tenant)
    } catch (error) {
      logout()
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [logout])

  const signup = useCallback(async (tenantName: string, email: string, password: string) => {
    setIsLoading(true)
    try {
      const res = await apiRequest<{ access_token: string }>('/auth/signup', { method: 'POST', json: { tenant_name: tenantName, email, password } })
      localStorage.setItem('accessToken', res.access_token)
      setAccessToken(res.access_token)
      const me = await apiRequest<{ user: UserInfo; tenant: TenantInfo }>('/me')
      setUser(me.user)
      setTenant(me.tenant)
    } catch (error) {
      logout()
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [logout])

  const value = useMemo<AuthState>(() => ({ accessToken, user, tenant, isLoading, login, signup, logout }), [accessToken, user, tenant, isLoading, login, signup, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
