import { useContext } from 'react'
import { AuthContext } from '../context/authCtx'

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthContext missing')
  return ctx
}

