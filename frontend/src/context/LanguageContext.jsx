import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export const TRANSLATIONS = {
  en: {
    // Header & Workspace
    appName: 'Chafé',
    staffWorkspace: 'Chafé • Staff Workspace',
    workspaceSubtitle: 'Attendance, Daily Shift Rosters, Stations & Performance Operations',
    terminalActive: 'Terminal Active',
    readyToScan: 'Ready to Scan',
    adminPortal: 'Switch to Admin',
    switchStaff: 'Switch to Staff',
    goodMorning: 'Good Morning',
    goodAfternoon: 'Good Afternoon',
    goodEvening: 'Good Evening',

    // Navigation & Tabs
    home: 'Home',
    schedule: 'Schedule',
    scan: 'Scan',
    badge: 'Badge',
    profile: 'Profile',
    myProfile: 'My Profile',
    switchAdminShort: 'Admin',

    // Search
    searchPlaceholder: 'Search staff, station, tools...',
    searchShifts: 'Search shifts, staff name, date...',
    searchTable: 'Search by staff, branch, or security tag...',

    // 3x3 Hub Items
    shiftRoster: 'Shift Roster',
    dayOff: 'Day Off',
    performance: 'Performance',
    shiftLogs: 'Shift Logs',
    station: 'Station',
    idBadge: 'ID Badge',
    storeAlerts: 'Store Alerts',
    support: 'Support',
    typeOfVisit: 'Type of Visit',
    todayLogs: 'Today',
    viewAllTimesheets: 'View All Timesheets →',
    recentShiftActivity: 'RECENT SHIFT ACTIVITY',
    noRecentLogs: 'No recent shift logs recorded yet.',

    // Attendance Actions
    clockIn: 'Clock In',
    clockOut: 'Clock Out',
    readyToStart: 'Ready to Start',
    alreadyOnShift: 'Already on Shift',
    onTime: 'On-Time (Good Standing)',
    lateArrival: 'Late Arrival',
    shiftActive: 'Shift Active',
    noShift: 'No Active Shift',
    startShift: 'Start your shift arrival time. Punctuality is automatically verified.',
    completeShift: 'Complete working hours & finalize shift on timesheet.',
    confirmIn: 'Confirm In',
    confirmOut: 'Confirm Out',
    scanToIn: 'Scan to In →',
    scanToOut: 'Scan to Out →',

    // Profile Menu
    language: 'Language',
    location: 'Branch Location',
    display: 'Display',
    feedPreference: 'Store Alerts & Notices',
    passwordAndSecurity: 'Password & Security',
    changePassword: 'Change Password',
    logOut: 'Log Out',
    editProfile: 'Edit Profile',
    saveProfile: 'Save Profile',
    cancel: 'Cancel',

    // Password Modal
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    currentPassword: 'Current Password',
    passwordRequirements: 'Password must be at least 4 characters.',
    passwordMismatch: 'Passwords do not match.',
    passwordSuccess: 'Password changed successfully!',

    // Table & Pagination
    total: 'Total',
    page: 'Page',
    of: 'of',
    showing: 'Showing',
    records: 'records',
    entries: 'entries',
    firstPage: 'First Page',
    prevPage: 'Previous Page',
    nextPage: 'Next Page',
    lastPage: 'Last Page',
    allRecords: 'All Records',

    // Store Alerts & Announcements
    announcements: 'Store Announcements & Notices',
    noAlerts: 'No active announcements at this time.',
    priorityHigh: 'High Priority',
    priorityNormal: 'Normal',

    // Roles & Admin
    roles: 'Roles',
    assignRole: 'Assign Role',
    addRole: 'Add New Role',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
  },
  kh: {
    // Header & Workspace
    appName: 'Chafé',
    staffWorkspace: 'Chafé • កន្លែងធ្វើការបុគ្គលិក',
    workspaceSubtitle: 'ការចុះវត្តមាន វេនការងារប្រចាំថ្ងៃ ស្ថានីយ និងប្រតិបត្តិការការងារ',
    terminalActive: 'ស្ថានីយដំណើរការ',
    readyToScan: 'រួចរាល់ដើម្បីស្កេន',
    adminPortal: 'ប្តូរទៅកាន់ អភិបាល (Admin)',
    switchStaff: 'ប្តូរទៅកាន់ បុគ្គលិក',
    goodMorning: 'អរុណសួស្តី',
    goodAfternoon: 'ទិវាសួស្តី',
    goodEvening: 'សាយណ្ហសួស្តី',

    // Navigation & Tabs
    home: 'ទំព័រដើម',
    schedule: 'កាលវិភាគ',
    scan: 'ស្កេន',
    badge: 'កាតសម្គាល់',
    profile: 'ព័ត៌មានផ្ទាល់ខ្លួន',
    myProfile: 'ព័ត៌មានផ្ទាល់ខ្លួន',
    switchAdminShort: 'អភិបាល',

    // Search
    searchPlaceholder: 'ស្វែងរកបុគ្គលិក ស្ថានីយ ឧបករណ៍...',
    searchShifts: 'ស្វែងរកវេនការងារ ឈ្មោះ កាលបរិច្ឆេទ...',
    searchTable: 'ស្វែងរកតាមឈ្មោះ សាខា ឬស្លាកសុវត្ថិភាព...',

    // 3x3 Hub Items
    shiftRoster: 'វេនការងារ',
    dayOff: 'ថ្ងៃឈប់សម្រាក',
    performance: 'ការអនុវត្តការងារ',
    shiftLogs: 'កំណត់ត្រាវេន',
    station: 'ស្ថានីយ',
    idBadge: 'កាតសម្គាល់',
    storeAlerts: 'ការជូនដំណឹងហាង',
    support: 'ជំនួយ',
    typeOfVisit: 'ប្រភេទនៃទស្សនកិច្ច / មុខងារ',
    todayLogs: 'ថ្ងៃនេះ',
    viewAllTimesheets: 'មើលតារាងវត្តមានទាំងអស់ →',
    recentShiftActivity: 'សកម្មភាពវេនការងារថ្មីៗ',
    noRecentLogs: 'មិនទាន់មានកំណត់ត្រាវេនការងារថ្មីៗនៅឡើយទេ។',

    // Attendance Actions
    clockIn: 'ចុះវត្តមានចូល',
    clockOut: 'ចុះវត្តមានចេញ',
    readyToStart: 'រួចរាល់ដើម្បីចាប់ផ្តើម',
    alreadyOnShift: 'កំពុងស្ថិតក្នុងវេនការងារ',
    onTime: 'ទាន់ពេលវេលា (ល្អប្រសើរ)',
    lateArrival: 'មកយឺត',
    shiftActive: 'វេនកំពុងដំណើរការ',
    noShift: 'គ្មានវេនសកម្ម',
    startShift: 'ចាប់ផ្តើមម៉ោងមកដល់វេនការងាររបស់អ្នក។ ភាពទាន់ពេលវេលាត្រូវបានផ្ទៀងផ្ទាត់ដោយស្វ័យប្រវត្តិ។',
    completeShift: 'បញ្ចប់ម៉ោងធ្វើការ និងកត់ត្រាការងារចូលតារាងម៉ោង។',
    confirmIn: 'បញ្ជាក់ចូល',
    confirmOut: 'បញ្ជាក់ចេញ',
    scanToIn: 'ស្កេនដើម្បីចូល →',
    scanToOut: 'ស្កេនដើម្បីចេញ →',

    // Profile Menu
    language: 'ភាសា',
    location: 'ទីតាំងសាខា',
    display: 'ការបង្ហាញ',
    feedPreference: 'ការជូនដំណឹងហាង & សេចក្តីជូនដំណឹង',
    passwordAndSecurity: 'ពាក្យសម្ងាត់ & សុវត្ថិភាព',
    changePassword: 'ប្តូរពាក្យសម្ងាត់',
    logOut: 'ចាកចេញ',
    editProfile: 'កែប្រែព័ត៌មាន',
    saveProfile: 'រក្សាទុកព័ត៌មាន',
    cancel: 'បោះបង់',

    // Password Modal
    newPassword: 'ពាក្យសម្ងាត់ថ្មី',
    confirmPassword: 'បញ្ជាក់ពាក្យសម្ងាត់ថ្មី',
    currentPassword: 'ពាក្យសម្ងាត់បច្ចុប្បន្ន',
    passwordRequirements: 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ ៤ តួអក្សរ។',
    passwordMismatch: 'ពាក្យសម្ងាត់ទាំងពីរមិនដូចគ្នាទេ។',
    passwordSuccess: 'ប្តូរពាក្យសម្ងាត់បានជោគជ័យ!',

    // Table & Pagination
    total: 'សរុប',
    page: 'ទំព័រ',
    of: 'នៃ',
    showing: 'បង្ហាញ',
    records: 'កំណត់ត្រា',
    entries: 'ធាតុ',
    firstPage: 'ទំព័រដំបូង',
    prevPage: 'ទំព័រមុន',
    nextPage: 'ទំព័របន្ទាប់',
    lastPage: 'ទំព័រចុងក្រោយ',
    allRecords: 'កំណត់ត្រាទាំងអស់',

    // Store Alerts & Announcements
    announcements: 'សេចក្តីជូនដំណឹង និងការប្រកាសរបស់ហាង',
    noAlerts: 'គ្មានការជូនដំណឹងសកម្មនៅពេលនេះទេ។',
    priorityHigh: 'អាទិភាពខ្ពស់',
    priorityNormal: 'ធម្មតា',

    // Roles & Admin
    roles: 'តួនាទី',
    assignRole: 'ចាត់តាំងតួនាទី',
    addRole: 'បន្ថែមតួនាទីថ្មី',
    save: 'រក្សាទុក',
    delete: 'លុប',
    edit: 'កែប្រែ',
  }
}

export const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
})

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem('chafe_app_lang') || 'en'
    } catch {
      return 'en'
    }
  })

  const setLang = useCallback((newLang) => {
    const validLang = newLang === 'kh' ? 'kh' : 'en'
    setLangState(validLang)
    try {
      localStorage.setItem('chafe_app_lang', validLang)
      // Dispatch storage event to notify other instances/tabs
      window.dispatchEvent(new Event('storage'))
    } catch {
      // quiet catch
    }
  }, [])

  // Listen for storage changes from other windows/components
  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem('chafe_app_lang')
        if (saved && (saved === 'en' || saved === 'kh') && saved !== lang) {
          setLangState(saved)
        }
      } catch {
        // quiet catch
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [lang])

  const t = useCallback((key, fallback) => {
    const currentDict = TRANSLATIONS[lang] || TRANSLATIONS.en
    if (currentDict && currentDict[key] !== undefined) {
      return currentDict[key]
    }
    const defaultDict = TRANSLATIONS.en
    if (defaultDict && defaultDict[key] !== undefined) {
      return defaultDict[key]
    }
    return fallback !== undefined ? fallback : key
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    return {
      lang: 'en',
      setLang: () => {},
      t: (key, fallback) => fallback !== undefined ? fallback : key
    }
  }
  return context
}
