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

test('Tasks & Notifications table includes quick pager & filter short controls (<- 0 1 2 3 ... 10 ->)', () => {
  const appPath = path.resolve('src/App.jsx')
  const content = fs.readFileSync(appPath, 'utf-8')
  assert.match(content, /tablePage/, 'Must maintain tablePage state')
  assert.match(content, /\[0,\s*1,\s*2,\s*3,\s*4,\s*5,\s*6,\s*7,\s*8,\s*9,\s*10\]/, 'Must render quick navigation buttons 0 through 10')
  assert.match(content, /quick-nav-arrow-btn/, 'Must have arrow buttons for previous and next')
  assert.match(content, /paginatedRows/, 'Must render paginated rows')
})

test('Time display uses 12-hour format with AM/PM across formatTime and clocks', () => {
  const appPath = path.resolve('src/App.jsx')
  const content = fs.readFileSync(appPath, 'utf-8')
  assert.match(content, /hour12:\s*true/, 'formatTime in App.jsx must use 12-hour format')
  assert.match(content, /toLocaleTimeString\('en-US',\s*\{\s*hour:\s*'numeric',\s*minute:\s*'2-digit',\s*hour12:\s*true\s*\}\)/, 'Must format using 12-hour with en-US locale')
})

test('Hourly Pay column is removed from staff table in App.jsx', () => {
  const appPath = path.resolve('src/App.jsx')
  const content = fs.readFileSync(appPath, 'utf-8')
  assert.doesNotMatch(content, /<th>Hourly Pay<\/th>/, 'Staff table must not contain Hourly Pay column header')
  assert.doesNotMatch(content, /s\.hourly_rate.*\/hr/, 'Staff table must not render Hourly Pay values')
})

test('Admin branch change automatically sets location and staff cannot change branch/location themselves', () => {
  const appPath = path.resolve('src/App.jsx')
  const appContent = fs.readFileSync(appPath, 'utf-8')
  assert.match(appContent, /location:\s*branchName/, 'Admin changing branch must auto-assign location to branch name')
  assert.match(appContent, /syncStaffCheckinsBranchInFirebase/, 'Must sync staff checkin records with new branch and location')

  const profilePath = path.resolve('src/components/ProfileView.jsx')
  const profileContent = fs.readFileSync(profilePath, 'utf-8')
  assert.doesNotMatch(profileContent, /<select[^>]*value=\{selectedBranchId\}/, 'Staff Profile must not allow staff to select another branch')
  assert.match(profileContent, /locked-branch-box/, 'Staff Profile must display locked branch box')
})

test('Real-time synchronization without refresh is implemented for both checkins and staff', () => {
  const fbPath = path.resolve('src/services/firebaseService.js')
  const fbContent = fs.readFileSync(fbPath, 'utf-8')
  assert.match(fbContent, /export function subscribeToLiveCheckins/, 'Must export subscribeToLiveCheckins')
  assert.match(fbContent, /export function subscribeToStaff/, 'Must export subscribeToStaff')
  assert.match(fbContent, /export async function syncStaffCheckinsBranchInFirebase/, 'Must export syncStaffCheckinsBranchInFirebase')

  const appPath = path.resolve('src/App.jsx')
  const appContent = fs.readFileSync(appPath, 'utf-8')
  assert.match(appContent, /subscribeToStaff/, 'App.jsx must subscribe to live staff roster updates')
  assert.match(appContent, /subscribeToLiveCheckins/, 'App.jsx must subscribe to live checkins updates')
})

test('Camera AbortError bug fix: Silently catches AbortError and DOMException abort during camera initialization', () => {
  const staffPortalPath = path.resolve('src/components/StaffPortal.jsx')
  const staffPortalContent = fs.readFileSync(staffPortalPath, 'utf-8')
  assert.match(staffPortalContent, /err\?\.name === 'AbortError'/, 'StaffPortal must check for AbortError')
  assert.match(staffPortalContent, /isAbortError/, 'StaffPortal must identify isAbortError')
  assert.match(staffPortalContent, /if \(isAbortError\)\s*\{\s*\/\/[^\n]*\s*return\s*\}/, 'StaffPortal must return silently on AbortError without showing toast')

  const userDashboardPath = path.resolve('src/components/UserDashboard.jsx')
  const userDashboardContent = fs.readFileSync(userDashboardPath, 'utf-8')
  assert.match(userDashboardContent, /isAbortError/, 'UserDashboard must identify isAbortError')

  const staffScannerPath = path.resolve('src/components/StaffCameraScanner.jsx')
  const staffScannerContent = fs.readFileSync(staffScannerPath, 'utf-8')
  assert.match(staffScannerContent, /isAbortError/, 'StaffCameraScanner must identify isAbortError')
})

test('Action Modal State bug fix: Clock In button is disabled, styled as disabled, and shows Already on Shift when on shift', () => {
  const staffPortalPath = path.resolve('src/components/StaffPortal.jsx')
  const staffPortalContent = fs.readFileSync(staffPortalPath, 'utf-8')
  assert.match(staffPortalContent, /const isOnShift = Boolean/, 'StaffPortal must declare isOnShift shift status boolean')
  assert.match(staffPortalContent, /!isOnShift \? 'recommended' : 'disabled'/, 'Action Modal Clock In card must use disabled class when on shift')
  assert.match(staffPortalContent, /Already on Shift/, 'Action Modal Clock In card must display Already on Shift when on shift')
  assert.match(staffPortalContent, /Already Clocked In/, 'Action Modal Clock In button must display Already Clocked In when on shift')
  assert.match(staffPortalContent, /disabled=\{isOnShift \|\| processing\}/, 'Action Modal Clock In button must be disabled when on shift')

  const cssPath = path.resolve('src/App.css')
  const cssContent = fs.readFileSync(cssPath, 'utf-8')
  assert.match(cssContent, /\.modal-action-card\.disabled/, 'App.css must have disabled styling for modal-action-card')
  assert.match(cssContent, /cursor:\s*not-allowed/, 'App.css must set cursor: not-allowed on disabled modal-action-card')
})




