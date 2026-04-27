import { useMemo, useState, useEffect, useCallback, type ReactNode } from 'react'
import { apiRequest } from '../api/client'
import { AuthContext, type AuthState, type UserInfo, type TenantInfo } from './authCtx'

const ACCESS_TOKEN_STORAGE_KEY = 'accessToken'
const USER_STORAGE_KEY = 'meterstackUser'
const TENANT_STORAGE_KEY = 'meterstackTenant'

function readStoredJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY))
  const [user, setUser] = useState<UserInfo | null>(() => readStoredJson<UserInfo>(USER_STORAGE_KEY))
  const [tenant, setTenant] = useState<TenantInfo | null>(() => readStoredJson<TenantInfo>(TENANT_STORAGE_KEY))
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(accessToken && (!user || !tenant)))

  const storeIdentity = useCallback((nextUser: UserInfo, nextTenant: TenantInfo) => {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser))
    localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(nextTenant))
    setUser(nextUser)
    setTenant(nextTenant)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
    localStorage.removeItem(USER_STORAGE_KEY)
    localStorage.removeItem(TENANT_STORAGE_KEY)
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
    if (user && tenant) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    ;(async () => {
      try {
        const me = await apiRequest<{ user: UserInfo; tenant: TenantInfo }>('/me')
        if (cancelled) return
        storeIdentity(me.user, me.tenant)
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
  }, [accessToken, logout, storeIdentity, tenant, user])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const res = await apiRequest<{ access_token: string; user?: UserInfo; tenant?: TenantInfo }>('/auth/login', { method: 'POST', json: { email, password } })
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, res.access_token)
      setAccessToken(res.access_token)
      if (res.user && res.tenant) {
        storeIdentity(res.user, res.tenant)
      } else {
        const me = await apiRequest<{ user: UserInfo; tenant: TenantInfo }>('/me')
        storeIdentity(me.user, me.tenant)
      }
    } catch (error) {
      logout()
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [logout, storeIdentity])

  const signup = useCallback(async (tenantName: string, email: string, password: string) => {
    setIsLoading(true)
    try {
      const res = await apiRequest<{ access_token: string; user?: UserInfo; tenant?: TenantInfo }>('/auth/signup', { method: 'POST', json: { tenant_name: tenantName, email, password } })
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, res.access_token)
      setAccessToken(res.access_token)
      if (res.user && res.tenant) {
        storeIdentity(res.user, res.tenant)
      } else {
        const me = await apiRequest<{ user: UserInfo; tenant: TenantInfo }>('/me')
        storeIdentity(me.user, me.tenant)
      }
    } catch (error) {
      logout()
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [logout, storeIdentity])

  const value = useMemo<AuthState>(() => ({ accessToken, user, tenant, isLoading, login, signup, logout }), [accessToken, user, tenant, isLoading, login, signup, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
