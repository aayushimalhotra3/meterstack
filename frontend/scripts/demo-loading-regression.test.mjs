import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

describe('demo loading regression checks', () => {
  it('guards demo login with a hard timeout and slow-load hint', () => {
    const gate = read('src/components/DemoSessionGate.tsx')

    assert.match(gate, /Promise\.race\(/)
    assert.match(gate, /controller\.abort\(\)/)
    assert.match(gate, /15_000/)
    assert.match(gate, /8_000/)
    assert.match(gate, /slowLoad/)
    assert.match(gate, /Backend is waking up from sleep - this takes about 60 seconds on Render/)
    assert.match(gate, /Backend timed out or is unavailable/)
  })

  it('lets auth login accept an abort signal', () => {
    const ctx = read('src/context/authCtx.ts')
    const provider = read('src/context/AuthContext.tsx')

    assert.match(ctx, /signal\?: AbortSignal/)
    assert.match(provider, /login = useCallback\(async \(email: string, password: string, signal\?: AbortSignal\)/)
    assert.match(provider, /signal,/)
  })

  it('ships real page metadata instead of the default frontend title', () => {
    const html = read('index.html')

    assert.match(html, /MeterStack - SaaS Billing &amp; Usage Analytics Demo/)
    assert.match(html, /og:title/)
    assert.match(html, /og:description/)
    assert.match(html, /https:\/\/meterstack\.vercel\.app/)
    assert.doesNotMatch(html, /<title>frontend<\/title>/)
  })
})
