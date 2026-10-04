import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('frontend environment variables file exists and defines VITE_API_BASE_URL', () => {
  const envPath = path.resolve('.env')
  assert.ok(fs.existsSync(envPath), '.env file must exist in frontend')
  const content = fs.readFileSync(envPath, 'utf-8')
  assert.match(content, /VITE_API_BASE_URL=http:\/\/localhost:8000\/api/)
})

test('vite build output exists and contains compiled bundle', () => {
  const distHtml = path.resolve('dist/index.html')
  assert.ok(fs.existsSync(distHtml), 'dist/index.html must exist')
  const htmlContent = fs.readFileSync(distHtml, 'utf-8')
  assert.match(htmlContent, /<div id="root"><\/div>/)
})

test('frontend package scripts contain dev, build, and test', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'))
  assert.ok(pkg.scripts.dev, 'dev script must exist')
  assert.ok(pkg.scripts.build, 'build script must exist')
  assert.ok(pkg.scripts.test, 'test script must exist')
})

test('locationService defines multi-branch architecture with Kohke, Watbo, and Hotel', async () => {
  const { DEFAULT_BRANCHES, calculateDistanceMeters, getBranchById } = await import('../src/services/locationService.js')
  assert.ok(Array.isArray(DEFAULT_BRANCHES), 'DEFAULT_BRANCHES must be an array')
  assert.strictEqual(DEFAULT_BRANCHES.length, 3, 'Must have 3 default branches')

  const names = DEFAULT_BRANCHES.map(b => b.name)
  assert.ok(names.some(n => n.includes('Kohke')), 'Kohke branch must exist')
  assert.ok(names.some(n => n.includes('Watbo')), 'Watbo branch must exist')
  assert.ok(names.some(n => n.includes('Hotel')), 'Hotel branch must exist')

  // Verify distance calculation for known GPS coordinates (Siem Reap ~1km)
  const d = calculateDistanceMeters(13.3632967, 103.8623305, 13.3545705, 103.8589937)
  assert.ok(d > 800 && d < 1500, `Distance should be ~1km, was ${d}`)

  // Verify getBranchById handles legacy branch_1 as well as explicit IDs
  const legacy = getBranchById('branch_1')
  assert.ok(legacy, 'Legacy branch_1 must resolve')
  assert.ok(legacy.name.includes('Kohke'), 'Legacy branch_1 must resolve to first branch')
})

