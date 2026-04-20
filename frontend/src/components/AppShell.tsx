import type { ReactNode } from 'react'
import Navbar from './Navbar'
import GuidedTour from './GuidedTour'

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="page-shell">{children}</main>
      <GuidedTour />
    </div>
  )
}
