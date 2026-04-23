import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

describe('public demo tour regression checks', () => {
  it('renders the tour through a body portal above the app stacking context', () => {
    const tour = read('src/components/OverviewTour.tsx')
    const css = read('src/App.css')

    assert.match(tour, /createPortal/)
    assert.match(tour, /document\.body/)

    const topbarZ = Number(css.match(/\.topbar\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1])
    const tourZ = Number(css.match(/\.overview-tour-layer\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1])

    assert.ok(Number.isFinite(topbarZ), 'topbar z-index should be readable')
    assert.ok(Number.isFinite(tourZ), 'tour z-index should be readable')
    assert.ok(tourZ > topbarZ, 'tour must stay above the sticky topbar')
  })

  it('keeps the first tour target in the overview hero instead of the sticky header', () => {
    const dashboard = read('src/pages/DashboardPage.tsx')
    const navbar = read('src/components/Navbar.tsx')

    assert.match(dashboard, /hero-side-panel" data-overview-tour="welcome"/)
    assert.doesNotMatch(navbar, /data-overview-tour="welcome"/)
  })

  it('does not auto-navigate or auto-scroll during onboarding', () => {
    const tour = read('src/components/OverviewTour.tsx')

    assert.doesNotMatch(tour, /useNavigate/)
    assert.doesNotMatch(tour, /navigate\(/)
    assert.doesNotMatch(tour, /scrollIntoView/)
    assert.doesNotMatch(tour, /window\.location/)
  })

  it('does not leave a reachable login screen in the public frontend', () => {
    const app = read('src/App.tsx')

    assert.match(app, /path="\/login" element=\{<Navigate to="\/" replace \/>\}/)
    assert.match(app, /path="\/signup" element=\{<Navigate to="\/" replace \/>\}/)
    assert.doesNotMatch(app, /LoginPage/)
    assert.doesNotMatch(app, /SignupPage/)
    assert.equal(existsSync(join(root, 'src/pages/LoginPage.tsx')), false)
    assert.equal(existsSync(join(root, 'src/pages/SignupPage.tsx')), false)
  })
})
