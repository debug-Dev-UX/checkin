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
  assert.match(content, /Sort: Security Verified/, 'Must include Security Verified sort option')
  assert.match(content, /Security Request/, 'Must have Security Request column header')
  assert.match(content, /security-tag-badge/, 'Must render security tag badges')
})

test('Tasks & Notifications table has only one pagination bar at bottom with exact screenshot format', () => {
  const appPath = path.resolve('src/App.jsx')
  const content = fs.readFileSync(appPath, 'utf-8')
  assert.match(content, /tablePage/, 'Must maintain tablePage state')
  assert.match(content, /table-pagination-footer/, 'Must render table-pagination-footer at bottom')
  assert.match(content, /table-pagination-info/, 'Must render table-pagination-info with total and current page')
  assert.match(content, /getPaginationItems/, 'Must compute pagination items with ellipsis')
  assert.match(content, /pager-nav-btn/, 'Must have nav buttons for « ‹ › »')
  assert.match(content, /pager-num-btn/, 'Must have numbered page buttons')
  assert.doesNotMatch(content, /table-quick-nav-bar.*table-responsive/, 'Must NOT have quick nav bar above table (only at bottom)')
  assert.match(content, /paginatedRows/, 'Must render paginated rows')
})

test('Staff shift start and end use 12-hour select dropdowns only (no 24-hour inputs)', () => {
  const appPath = path.resolve('src/App.jsx')
  const content = fs.readFileSync(appPath, 'utf-8')
  assert.match(content, /function TimePicker12Hour/, 'Must declare TimePicker12Hour component')
  assert.match(content, /hourOptions.*01.*12/, 'TimePicker12Hour must use 12-hour options (01 to 12)')
  assert.match(content, /<TimePicker12Hour[^>]*staffForm\.shift_start/, 'Create Staff modal must use TimePicker12Hour for shift_start')
  assert.match(content, /<TimePicker12Hour[^>]*staffForm\.shift_end/, 'Create Staff modal must use TimePicker12Hour for shift_end')
  assert.match(content, /<TimePicker12Hour[^>]*editingStaff\.shift_start/, 'Edit Staff modal must use TimePicker12Hour for shift_start')
  assert.match(content, /<TimePicker12Hour[^>]*editingStaff\.shift_end/, 'Edit Staff modal must use TimePicker12Hour for shift_end')
})

test('Role assignment and custom roles can be created and managed by admin', () => {
  const appPath = path.resolve('src/App.jsx')
  const content = fs.readFileSync(appPath, 'utf-8')
  assert.match(content, /handleCreateCustomRole/, 'App.jsx must have handleCreateCustomRole function')
  assert.match(content, /saveCustomRolesToFirebase/, 'App.jsx must persist custom roles to Firebase')
  assert.match(content, /customRoles\.map/, 'App.jsx must map dynamic customRoles in role selects')
  assert.match(content, /\+ Create Role|\+ Add Role/, 'App.jsx must provide create role UI')
})

test('Leave / Day Off Types can be created, edited, deleted, and sorted by admin', () => {
  const dayoffPath = path.resolve('src/components/DayoffCalendar.jsx')
  const content = fs.readFileSync(dayoffPath, 'utf-8')
  assert.match(content, /saveLeaveTypesToFirebase/, 'DayoffCalendar must persist leave types to Firebase')
  assert.match(content, /isManageLeaveModalOpen/, 'DayoffCalendar must have Manage Leave Types modal')
  assert.match(content, /handleMoveLeaveType/, 'DayoffCalendar must allow sorting/reordering leave types')
  assert.match(content, /handleDeleteLeaveType/, 'DayoffCalendar must allow deleting leave types')
  assert.match(content, /handleCreateLeaveType|newLeaveTypeForm/, 'DayoffCalendar must allow creating leave types')
})

test('Store Alerts & Notices are dynamic from admin and synced live to staff workspace', () => {
  const appPath = path.resolve('src/App.jsx')
  const content = fs.readFileSync(appPath, 'utf-8')
  assert.match(content, /saveStoreAlertsToFirebase/, 'App.jsx must save dynamic store alerts')
  assert.match(content, /storeAlertsList/, 'App.jsx must manage store alerts list')

  const fbPath = path.resolve('src/services/firebaseService.js')
  const fbContent = fs.readFileSync(fbPath, 'utf-8')
  assert.match(fbContent, /subscribeToStoreAlerts/, 'firebaseService must export subscribeToStoreAlerts')
})

test('Staff Performance & Punctuality tab renders Weekly & Monthly Tardiness & Clean Record Audit table matching screenshot', () => {
  const appPath = path.resolve('src/App.jsx')
  const content = fs.readFileSync(appPath, 'utf-8')
  assert.match(content, /Weekly & Monthly Tardiness & Clean Record Audit/, 'Must render audit card title')
  assert.match(content, /Filter and inspect who has 0 late records vs how many times each staff member arrived late/, 'Must render audit card subtitle')
  assert.match(content, /auditPeriod/, 'Must maintain auditPeriod state for Weekly and Monthly toggle')
  assert.match(content, /auditStaffFilter/, 'Must maintain auditStaffFilter state')
  assert.match(content, /<th>Barista \/ Staff<\/th>/, 'Must have Barista / Staff table header')
  assert.match(content, /<th>Branch<\/th>/, 'Must have Branch table header')
  assert.match(content, /<th>On-Time Count<\/th>/, 'Must have On-Time Count table header')
  assert.match(content, /<th>Late Count<\/th>/, 'Must have Late Count table header')
  assert.match(content, /<th>Status Classification<\/th>/, 'Must have Status Classification table header')
  assert.match(content, /<th[^>]*>Punctuality Grade<\/th>/, 'Must have Punctuality Grade table header')
  assert.match(content, /Never Late \(0\)/, 'Must render Never Late (0) badge')
  assert.match(content, /Late Record\(s\)/, 'Must render Late Record(s) badge')

  const cssPath = path.resolve('src/App.css')
  const css = fs.readFileSync(cssPath, 'utf-8')
  assert.match(css, /\.audit-panel-card/, 'App.css must define audit-panel-card')
  assert.match(css, /\.audit-badge-clean/, 'App.css must define audit-badge-clean')
  assert.match(css, /\.audit-badge-late/, 'App.css must define audit-badge-late')
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

test('Staff creation fix: createStaffInFirebase sanitizes all fields, provides safe fallbacks, and preserves local records', () => {
  const fbPath = path.resolve('src/services/firebaseService.js')
  const fbContent = fs.readFileSync(fbPath, 'utf-8')
  assert.match(fbContent, /export async function createStaffInFirebase/, 'Must export createStaffInFirebase')
  assert.match(fbContent, /fallbackUsername/, 'Must auto-generate fallback username')
  assert.match(fbContent, /cleanStaff/, 'Must sanitize staff object')
  assert.match(fbContent, /localOnly/, 'Must preserve local staff records')

  const appPath = path.resolve('src/App.jsx')
  const appContent = fs.readFileSync(appPath, 'utf-8')
  assert.match(appContent, /handleCreateStaffSubmit/, 'App.jsx must have handleCreateStaffSubmit')
  assert.match(appContent, /setStaffList\(prev =>/, 'handleCreateStaffSubmit must update staffList state immediately')
})

test('Variable Error fix during Check-Out: activeBranch is properly defined in scope for both Clock In and Clock Out', () => {
  const staffPortalPath = path.resolve('src/components/StaffPortal.jsx')
  const staffPortalContent = fs.readFileSync(staffPortalPath, 'utf-8')
  // Verify activeBranch is declared at function level before if (actionType === 'in')
  const spIndexActiveBranch = staffPortalContent.indexOf('const activeBranch =')
  const spIndexActionIn = staffPortalContent.indexOf("if (actionType === 'in')")
  assert.ok(spIndexActiveBranch > 0, 'StaffPortal must define activeBranch')
  assert.ok(spIndexActiveBranch < spIndexActionIn, 'activeBranch must be declared before if (actionType === in)')
  assert.match(staffPortalContent, /branch_name:\s*activeBranch\?\.name/, 'StaffPortal must reference activeBranch for branch_name')

  const userDashboardPath = path.resolve('src/components/UserDashboard.jsx')
  const userDashboardContent = fs.readFileSync(userDashboardPath, 'utf-8')
  const udIndexActiveBranch = userDashboardContent.indexOf('const activeBranch =')
  const udIndexActionIn = userDashboardContent.indexOf("if (actionType === 'in')")
  assert.ok(udIndexActiveBranch > 0, 'UserDashboard must define activeBranch')
  assert.ok(udIndexActiveBranch < udIndexActionIn, 'activeBranch must be declared before if (actionType === in)')
  assert.match(userDashboardContent, /branch_name:\s*activeBranch\?\.name/, 'UserDashboard must reference activeBranch for branch_name')
})

test('Camera Memory/Hardware Leak fix: stopCamera explicitly stops all video tracks and turns off camera on scan/close', () => {
  const staffPortalPath = path.resolve('src/components/StaffPortal.jsx')
  const staffPortalContent = fs.readFileSync(staffPortalPath, 'utf-8')
  assert.match(staffPortalContent, /track\.stop\(\)/, 'StaffPortal must call track.stop()')
  assert.match(staffPortalContent, /track\.enabled = false/, 'StaffPortal must disable track before stopping')
  assert.match(staffPortalContent, /videoRef\.current\.srcObject/, 'StaffPortal must clean up videoRef.current.srcObject tracks')
  assert.match(staffPortalContent, /cameraSessionIdRef/, 'StaffPortal must use session tracking to prevent orphaned camera streams')

  const userDashboardPath = path.resolve('src/components/UserDashboard.jsx')
  const userDashboardContent = fs.readFileSync(userDashboardPath, 'utf-8')
  assert.match(userDashboardContent, /track\.stop\(\)/, 'UserDashboard must call track.stop()')
  assert.match(userDashboardContent, /track\.enabled = false/, 'UserDashboard must disable track before stopping')
  assert.match(userDashboardContent, /videoRef\.current\.srcObject/, 'UserDashboard must clean up videoRef.current.srcObject tracks')
  assert.match(userDashboardContent, /cameraSessionIdRef/, 'UserDashboard must use session tracking to prevent orphaned camera streams')

  const staffScannerPath = path.resolve('src/components/StaffCameraScanner.jsx')
  const staffScannerContent = fs.readFileSync(staffScannerPath, 'utf-8')
  assert.match(staffScannerContent, /track\.stop\(\)/, 'StaffCameraScanner must call track.stop()')
  assert.match(staffScannerContent, /track\.enabled = false/, 'StaffCameraScanner must disable track before stopping')
  assert.match(staffScannerContent, /cameraSessionIdRef/, 'StaffCameraScanner must use session tracking to prevent orphaned camera streams')
})

test('Staff Performance & Punctuality table uses real staff data without demo or placeholder staff', () => {
  const appPath = path.resolve('src/App.jsx')
  const content = fs.readFileSync(appPath, 'utf-8')
  assert.doesNotMatch(content, /baselineAuditStaff/, 'Must not contain baselineAuditStaff demo data')
  assert.doesNotMatch(content, /Mateo Rossi/, 'Must not contain Mateo Rossi demo staff')
  assert.doesNotMatch(content, /Kenji Sato/, 'Must not contain Kenji Sato demo staff')
  assert.match(content, /\(staffList \|\| \[\]\)\.map\(stf =>/, 'auditRows must strictly derive from registered staffList')
})

test('Telegram Alert Integration: Service, config, and admin customizable features exist', async () => {
  const {
    DEFAULT_TELEGRAM_CONFIG,
    sendTelegramMessage,
    notifyTelegramCheckin,
    notifyTelegramCheckout,
    notifyTelegramLate,
    notifyTelegramLeave,
    notifyTelegramStaffMessage,
    notifyTelegramStoreAlert,
  } = await import('../src/services/telegramService.js')

  // Verify default schema
  assert.strictEqual(typeof DEFAULT_TELEGRAM_CONFIG, 'object')
  assert.strictEqual(DEFAULT_TELEGRAM_CONFIG.enabled, false)
  assert.strictEqual(DEFAULT_TELEGRAM_CONFIG.notify_checkin, true)
  assert.strictEqual(DEFAULT_TELEGRAM_CONFIG.notify_checkout, true)
  assert.strictEqual(DEFAULT_TELEGRAM_CONFIG.notify_late, true)
  assert.strictEqual(DEFAULT_TELEGRAM_CONFIG.notify_leave, true)
  assert.strictEqual(DEFAULT_TELEGRAM_CONFIG.notify_messages, true)
  assert.strictEqual(DEFAULT_TELEGRAM_CONFIG.notify_broadcast, true)
  assert.strictEqual(DEFAULT_TELEGRAM_CONFIG.branch_filter, 'all')

  // Verify validation: when alerts are disabled, returns gracefully without throwing
  const disabledRes = await sendTelegramMessage('test message')
  assert.strictEqual(disabledRes.success, false)
  assert.match(disabledRes.error, /disabled/)

  // Verify validation: when enabled but missing token, reports missing token
  const noTokenRes = await sendTelegramMessage('test message', 'HTML', { enabled: true, bot_token: '', chat_id: '123' })
  assert.strictEqual(noTokenRes.success, false)
  assert.match(noTokenRes.error, /Bot Token is missing/)

  // Verify App.jsx contains Telegram settings panel and toggle
  const appPath = path.resolve('src/App.jsx')
  const appContent = fs.readFileSync(appPath, 'utf-8')
  assert.match(appContent, /telegramConfig/, 'App.jsx must manage telegramConfig state')
  assert.match(appContent, /handleTestTelegram/, 'App.jsx must have test Telegram handler')
  assert.match(appContent, /handleSaveTelegram/, 'App.jsx must have save Telegram handler')
  assert.match(appContent, /IconTelegram/, 'App.jsx must render Telegram icon')

  // Verify StaffPortal integrates telegram alerts
  const staffPortalPath = path.resolve('src/components/StaffPortal.jsx')
  const staffPortalContent = fs.readFileSync(staffPortalPath, 'utf-8')
  assert.match(staffPortalContent, /notifyTelegramCheckin/, 'StaffPortal must dispatch notifyTelegramCheckin')
  assert.match(staffPortalContent, /notifyTelegramCheckout/, 'StaffPortal must dispatch notifyTelegramCheckout')
  assert.match(staffPortalContent, /notifyTelegramStaffMessage/, 'StaffPortal must dispatch notifyTelegramStaffMessage')
})

test('Admin Custom Message Alert & Template Customization: Formats, placeholders, and broadcast are supported', async () => {
  const {
    DEFAULT_TELEGRAM_CONFIG,
    renderTemplate,
    notifyTelegramCustomAlert,
  } = await import('../src/services/telegramService.js')

  // Verify template placeholders in default config
  assert.ok(DEFAULT_TELEGRAM_CONFIG.template_checkin.includes('{name}'))
  assert.ok(DEFAULT_TELEGRAM_CONFIG.template_checkin.includes('{branch}'))
  assert.ok(DEFAULT_TELEGRAM_CONFIG.template_checkout.includes('{duration}'))
  assert.ok(DEFAULT_TELEGRAM_CONFIG.template_late.includes('{late_minutes}'))
  assert.ok(DEFAULT_TELEGRAM_CONFIG.template_leave.includes('{reason}'))
  assert.ok(DEFAULT_TELEGRAM_CONFIG.template_custom.includes('{message}'))

  // Verify renderTemplate correctly substitutes placeholders
  const rendered = renderTemplate('Hello {name} from {branch}!', { name: 'Sophea', branch: 'Kohke' })
  assert.strictEqual(rendered, 'Hello Sophea from Kohke!')

  // Verify notifyTelegramCustomAlert handles disabled mode gracefully
  const customAlertRes = await notifyTelegramCustomAlert({ title: 'Test Alert', message: 'Hello' })
  assert.strictEqual(customAlertRes.success, false)

  // Verify App.jsx includes custom alert broadcaster and template editor
  const appPath = path.resolve('src/App.jsx')
  const appContent = fs.readFileSync(appPath, 'utf-8')
  assert.match(appContent, /customTelegramAlertForm/, 'App.jsx must manage customTelegramAlertForm')
  assert.match(appContent, /handleSendCustomTelegramAlert/, 'App.jsx must have custom alert sender')
  assert.match(appContent, /handleResetTelegramTemplates/, 'App.jsx must have template reset handler')
  assert.match(appContent, /Broadcast Custom Alert to Telegram/, 'App.jsx must render broadcast custom alert UI')
  assert.match(appContent, /Customizable Alert Message Templates/, 'App.jsx must render template customization UI')
})
