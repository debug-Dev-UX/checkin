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

test('branch coordinate sanitization handles raw string inputs and decimals', () => {
  const sanitize = (b) => ({
    ...b,
    lat: typeof b.lat === 'number' ? b.lat : (parseFloat(b.lat) || 0),
    lng: typeof b.lng === 'number' ? b.lng : (parseFloat(b.lng) || 0),
    radiusMeters: typeof b.radiusMeters === 'number' ? b.radiusMeters : (parseInt(b.radiusMeters, 10) || 50),
  })

  const raw = {
    id: 'test_branch',
    name: 'Test Branch',
    lat: '13.3632967',
    lng: '103.8623305',
    radiusMeters: '50'
  }
  const cleaned = sanitize(raw)
  assert.strictEqual(typeof cleaned.lat, 'number')
  assert.strictEqual(cleaned.lat, 13.3632967)
  assert.strictEqual(typeof cleaned.lng, 'number')
  assert.strictEqual(cleaned.lng, 103.8623305)
  assert.strictEqual(cleaned.radiusMeters, 50)
})

test('ScanSuccessModal component file exists and exports default function', () => {
  const filePath = path.resolve('src/components/ScanSuccessModal.jsx')
  assert.ok(fs.existsSync(filePath), 'ScanSuccessModal.jsx must exist')
  const content = fs.readFileSync(filePath, 'utf-8')
  assert.match(content, /export default function ScanSuccessModal/, 'Must export default function ScanSuccessModal')
})

test('LoadingPage component file exists and exports executive loading layout', () => {
  const filePath = path.resolve('src/components/LoadingPage.jsx')
  assert.ok(fs.existsSync(filePath), 'LoadingPage.jsx must exist')
  const content = fs.readFileSync(filePath, 'utf-8')
  assert.match(content, /export default function LoadingPage/, 'Must export default function LoadingPage')
  assert.match(content, /emblem-ring-outer/, 'Must contain outer radiant ring')
  assert.match(content, /emblem-ring-middle/, 'Must contain middle counter-rotating ring')
  assert.match(content, /loading-progress-fill/, 'Must contain animated progress fill')
})

test('Tasks & Notifications table includes sort controls and Security Database Request column', () => {
  const appPath = path.resolve('src/App.jsx')
  assert.ok(fs.existsSync(appPath), 'App.jsx must exist')
  const content = fs.readFileSync(appPath, 'utf-8')
  assert.match(content, /tableSort/, 'Must maintain tableSort state')
  assert.match(content, /Sort: 🛡️ Security Verified/, 'Must include Security Verified sort option')
  assert.match(content, /Security Request/, 'Must have Security Request column header')
  assert.match(content, /security-tag-badge/, 'Must render security tag badges')
})


