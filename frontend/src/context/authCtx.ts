import { createContext } from 'react'

export type UserInfo = { id: string; email: string; role: string }
export type TenantInfo = { id: string; name: string }

export type AuthState = {
  accessToken: string | null
  user: UserInfo | null
  tenant: TenantInfo | null
  login: (email: string, password: string) => Promise<void>
  signup: (tenantName: string, email: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthState | null>(null)

