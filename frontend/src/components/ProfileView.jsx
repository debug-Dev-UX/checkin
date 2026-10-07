import { useState, useRef, useEffect } from 'react'
import {
  IconArrowLeft,
  IconGear,
  IconCheck,
  IconCheckCircle,
  IconCameraBadge,
  IconCamera,
  IconGlobe,
  IconMapPin,
  IconDeviceMobile,
  IconDoorOut,
  IconChevronRight,
  IconBell,
  IconLock,
  IconEye,
  IconEyeOff,
  IconX,
  IconShield,
  IconRefresh,
  IconTrash,
  IconRotateCw,
} from '../Icons'
import { getBranches } from '../services/locationService'
import { useLanguage } from '../context/LanguageContext'
import { updateStaffInFirebase } from '../services/firebaseService'
import { getAccountPermissions, saveAccountPermissions } from '../services/cookieService'

export default function ProfileView({
  user,
  branches = [],
  onUpdateUser,
  onBack,
  onLogout,
  showToast,
  initialModal = null,
  activeAdminNotifs = [],
  activeStoreAlerts = [],
  dismissedAlertIds = [],
  onDeleteAlert,
  onDeleteAllAlerts,
  onRestoreDismissedAlerts,
}) {
  const { lang: appLang, setLang, t } = useLanguage()
  const branchesList = (branches && branches.length > 0) ? branches : getBranches()
  const [selectedBranchId, setSelectedBranchId] = useState(user?.branch_id || branchesList[0]?.id || 'branch_2')

  useEffect(() => {
    if (user?.branch_id) {
      setSelectedBranchId(user.branch_id)
    }
  }, [user?.branch_id])

  // Parse name into first & last name without demo defaults
  const fullName = user?.name || ''
  const nameParts = fullName.trim() ? fullName.trim().split(' ') : []
  const initialFirst = nameParts[0] || ''
  const initialLast = nameParts.slice(1).join(' ') || ''

  // Screen toggle: false = "My Profile", true = "Edit Profile" (NO popup modal, smooth in-place toggle)
  const [isEditing, setIsEditing] = useState(false)
  const [firstName, setFirstName] = useState(initialFirst)
  const [lastName, setLastName] = useState(initialLast)
  const [countryCode, setCountryCode] = useState('+855')
  const [phone, setPhone] = useState(user?.phone || '')
  const [email, setEmail] = useState(user?.email || '')
  const [gender, setGender] = useState(user?.gender || 'Male')
  const [avatarUrl, setAvatarUrl] = useState(
    user?.photo_url || localStorage.getItem('chafe_profile_avatar') || ''
  )

  // Interactive menu modals: 'language' | 'location' | 'display' | 'feed' | 'settings' | 'alerts' | 'password' | null
  const [activeModal, setActiveModal] = useState(initialModal)

  useEffect(() => {
    if (initialModal) {
      setActiveModal(initialModal)
    }
  }, [initialModal])

  const [themeMode, setThemeMode] = useState(() => {
    try {
      const saved = localStorage.getItem('chafe_theme_mode')
      if (saved === 'dark') return 'Dark Mode'
      return 'Light Theme'
    } catch {
      return 'Light Theme'
    }
  })

  // Theme selection handler with persistence and custom event dispatch
  const handleSelectTheme = (mode) => {
    setThemeMode(mode)
    let isDark = mode === 'Dark Mode'
    if (mode === 'System Default' && typeof window !== 'undefined') {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    const themeVal = isDark ? 'dark' : 'light'
    try {
      localStorage.setItem('chafe_theme_mode', themeVal)
      localStorage.setItem('chafe_theme_preference', mode)
      if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark')
      } else {
        document.documentElement.removeAttribute('data-theme')
      }
      window.dispatchEvent(new Event('chafe_theme_updated'))
      if (user?.id) {
        updateStaffInFirebase(user.id, { theme_mode: themeVal }).catch(() => {})
      }
    } catch {}
    setActiveModal(null)
    showToast?.(
      appLang === 'kh' ? `បានប្តូរផ្ទៃបង្ហាញទៅ ${mode}` : `Display theme set to ${mode}`,
      'success'
    )
  }

  // Account-specific Cookie Storage for Auto Camera & GPS Location permissions
  const [accountPerms, setAccountPerms] = useState(() => getAccountPermissions(user?.id))
  const [testingPerms, setTestingPerms] = useState(false)
  const [permTestMessage, setPermTestMessage] = useState('')

  useEffect(() => {
    setAccountPerms(getAccountPermissions(user?.id))
  }, [user?.id])

  const handleToggleCameraPerm = async (checked) => {
    saveAccountPermissions(user?.id, {
      camera: checked,
      location: accountPerms.location,
    })
    setAccountPerms(prev => ({ ...prev, camera: checked }))
    if (checked && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach(t => t.stop())
        showToast?.('Camera auto-allow cookie active! Access saved for your account.', 'success')
      } catch (err) {
        showToast?.('Cookie saved! Please click Allow if browser prompts for camera.', 'info')
      }
    } else {
      showToast?.('Camera auto-allow cookie disabled for your account.', 'info')
    }
  }

  const handleToggleLocationPerm = (checked) => {
    saveAccountPermissions(user?.id, {
      camera: accountPerms.camera,
      location: checked,
    })
    setAccountPerms(prev => ({ ...prev, location: checked }))
    if (checked && navigator.geolocation?.getCurrentPosition) {
      navigator.geolocation.getCurrentPosition(
        () => {
          showToast?.('Location auto-allow cookie active! Store GPS access saved.', 'success')
        },
        () => {
          showToast?.('Cookie saved! Please enable device location if prompted.', 'info')
        },
        { enableHighAccuracy: true, timeout: 6000 }
      )
    } else {
      showToast?.('Location auto-allow cookie disabled for your account.', 'info')
    }
  }

  const handleVerifyBothPermissionsNow = async () => {
    setTestingPerms(true)
    setPermTestMessage('Requesting browser permissions...')
    let camOk = false
    let locOk = false

    // Test Camera
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const s = await navigator.mediaDevices.getUserMedia({ video: true })
        s.getTracks().forEach(t => t.stop())
        camOk = true
      }
    } catch {
      camOk = false
    }

    // Test Geolocation
    await new Promise(resolve => {
      if (navigator.geolocation?.getCurrentPosition) {
        navigator.geolocation.getCurrentPosition(
          () => { locOk = true; resolve() },
          () => { locOk = false; resolve() },
          { enableHighAccuracy: true, timeout: 6000 }
        )
      } else {
        resolve()
      }
    })

    // Store persistent cookies for 1 year
    saveAccountPermissions(user?.id, { camera: true, location: true })
    setAccountPerms({ camera: true, location: true, cookieActive: true, userId: user?.id })
    setTestingPerms(false)
    setPermTestMessage(camOk && locOk
      ? '✅ Both Camera & GPS permissions confirmed and stored to account cookie!'
      : '🍪 Account cookies active! Permissions set to auto-allow on visit.'
    )
    showToast?.('Camera and Location permissions saved to account cookie!', 'success')
  }

  const fileInputRef = useRef(null)

  // Sync state if user prop changes
  useEffect(() => {
    if (user?.name) {
      const parts = user.name.trim().split(' ')
      setFirstName(parts[0] || '')
      setLastName(parts.slice(1).join(' ') || '')
    }
    if (user?.email) setEmail(user.email)
    if (user?.phone) setPhone(user.phone)
    if (user?.photo_url) setAvatarUrl(user.photo_url)
    if (user?.gender) setGender(user.gender)
  }, [user])

  // Handle avatar upload via file picker
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        showToast?.('Image size should be less than 3MB', 'error')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        setAvatarUrl(result)
        localStorage.setItem('chafe_profile_avatar', result)
        try {
          const saved = localStorage.getItem('chafe_custom_staff_profile')
          const existing = saved ? JSON.parse(saved) : {}
          localStorage.setItem('chafe_custom_staff_profile', JSON.stringify({ ...existing, ...(user || {}), photo_url: result }))
        } catch { /* quiet */ }
        if (onUpdateUser) {
          onUpdateUser({
            ...(user || {}),
            photo_url: result,
          })
        }
        showToast?.(
          appLang === 'kh' ? 'រូបភាពកម្រងព័ត៌មានត្រូវបានធ្វើបច្ចុប្បន្នភាព!' : 'Profile picture updated!',
          'success'
        )
      }
      reader.readAsDataURL(file)
    }
  }

  // Save profile changes
  const handleSaveProfile = () => {
    const combinedName = `${firstName.trim()} ${lastName.trim()}`.trim() || user?.name || 'Staff Member'
    const updatedUser = {
      ...(user || {}),
      name: combinedName,
      email: email.trim(),
      phone: phone.trim() ? `${countryCode} ${phone.trim()}` : '',
      gender,
      photo_url: avatarUrl,
      // Strictly maintain admin-assigned branch & location (cannot be changed by staff)
      branch_id: user?.branch_id || 'branch_2',
      branch_name: user?.branch_name || 'Chafé • Kohke',
      branch_address: user?.branch_address || 'Siem Reap, Cambodia',
      location: user?.location || user?.branch_name || 'Chafé • Kohke',
    }

    if (onUpdateUser) {
      onUpdateUser(updatedUser)
    }

    try {
      localStorage.setItem('chafe_custom_staff_profile', JSON.stringify(updatedUser))
    } catch {
      // quiet catch
    }

    showToast?.(
      appLang === 'kh' ? 'បានរក្សាទុកព័ត៌មានរួចរាល់!' : 'Profile saved successfully!',
      'success'
    )
    setIsEditing(false)
  }

  const handleSelectLanguage = (langCode) => {
    setLang(langCode)
    try {
      localStorage.setItem('chafe_app_lang', langCode)
      if (user?.id) {
        updateStaffInFirebase(user.id, { preferred_lang: langCode }).catch(() => {})
      }
      window.dispatchEvent(new Event('chafe_lang_updated'))
    } catch {}
    setActiveModal(null)
    showToast?.(
      langCode === 'kh' ? 'បានប្តូរភាសាទៅជា ភាសាខ្មែរ (kh)' : 'Language switched to English (en)',
      'success'
    )
  }

  // Get user initials for avatar fallback
  const userInitials = (user?.name || firstName || 'U')
    .split(' ')
    .map(p => p[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  return (
    <div className={`profile-template-wrapper ${themeMode === 'Dark Mode' || (themeMode === 'System Default' && typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark-theme' : ''}`}>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handlePhotoSelect}
      />

      <div className="profile-cards-container single-screen-container">
        {/* ============================================================== */}
        {/* SCREEN 1: MY PROFILE (VISIBLE WHEN NOT EDITING)                */}
        {/* ============================================================== */}
        {!isEditing ? (
          <div className="profile-screen-card my-profile-card">
            {/* Top Bar */}
            <div className="profile-header-bar">
              <button
                type="button"
                className="profile-header-icon-btn"
                onClick={onBack}
                title={appLang === 'kh' ? 'ត្រឡប់ក្រោយ' : 'Go Back'}
              >
                <IconArrowLeft size={20} />
              </button>
              <h2 className="profile-header-title">
                {appLang === 'kh' ? 'ព័ត៌មានផ្ទាល់ខ្លួន' : 'My Profile'}
              </h2>
              <button
                type="button"
                className="profile-header-icon-btn"
                onClick={() => setActiveModal('settings')}
                title="Settings"
              >
                <IconGear size={20} />
              </button>
            </div>

            {/* Profile User Info Card */}
            <div className="profile-user-hero">
              <div
                className="profile-avatar-container"
                onClick={() => fileInputRef.current?.click()}
                title="Click to change photo"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={user?.name || 'Staff Profile'}
                    className="profile-avatar-img"
                    onError={() => setAvatarUrl('')}
                  />
                ) : (
                  <div className="profile-avatar-placeholder">
                    {userInitials}
                  </div>
                )}
                <button
                  type="button"
                  className="profile-avatar-camera-badge"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  title="Upload Photo"
                >
                  <IconCameraBadge size={13} color="#0f172a" />
                </button>
              </div>

              <div className="profile-user-meta">
                <h3 className="profile-user-name">
                  {user?.name || `${firstName} ${lastName}`.trim() || 'Staff Member'}
                </h3>
                <div className="profile-user-email">
                  {user?.email || email || 'staff@chafe.internal'}
                </div>
                <button
                  type="button"
                  className="profile-edit-green-btn"
                  onClick={() => setIsEditing(true)}
                >
                  {appLang === 'kh' ? 'កែប្រែព័ត៌មាន' : 'Edit Profile'}
                </button>
              </div>
            </div>

            {/* Menu List Groups (Clean: Favourites, Downloads, Subscription, Clear Cache, Clear history REMOVED) */}
            <div className="profile-menu-groups">
              <div className="profile-menu-group">
                {/* 1. Language (ONLY two options: kh and en) */}
                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => setActiveModal('language')}
                >
                  <div className="profile-menu-left">
                    <span className="profile-menu-icon">
                      <IconGlobe size={20} />
                    </span>
                    <span className="profile-menu-label">
                      {appLang === 'kh' ? 'ភាសា' : 'Language'}
                    </span>
                  </div>
                  <div className="profile-menu-right">
                    <span className="profile-menu-subvalue">
                      {appLang === 'kh' ? 'ភាសាខ្មែរ (kh)' : 'English (en)'}
                    </span>
                    <span className="profile-menu-chevron">
                      <IconChevronRight size={18} />
                    </span>
                  </div>
                </button>

                {/* 2. Location */}
                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => setActiveModal('location')}
                >
                  <div className="profile-menu-left">
                    <span className="profile-menu-icon">
                      <IconMapPin size={20} />
                    </span>
                    <span className="profile-menu-label">
                      {appLang === 'kh' ? 'ទីតាំងសាខា' : 'Location'}
                    </span>
                  </div>
                  <span className="profile-menu-chevron">
                    <IconChevronRight size={18} />
                  </span>
                </button>

                {/* 3. Display */}
                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => setActiveModal('display')}
                >
                  <div className="profile-menu-left">
                    <span className="profile-menu-icon">
                      <IconDeviceMobile size={20} />
                    </span>
                    <span className="profile-menu-label">
                      {appLang === 'kh' ? 'ការបង្ហាញ' : 'Display'}
                    </span>
                  </div>
                  <span className="profile-menu-chevron">
                    <IconChevronRight size={18} />
                  </span>
                </button>

                {/* 4. Store Alerts & Notices (Read & Delete in Setting) */}
                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => setActiveModal('alerts')}
                >
                  <div className="profile-menu-left">
                    <span className="profile-menu-icon" style={{ color: '#ec4899' }}>
                      <IconBell size={20} color="#ec4899" />
                    </span>
                    <span className="profile-menu-label">
                      {appLang === 'kh' ? 'ការជូនដំណឹង & សេចក្តីប្រកាស' : 'Store Alerts & Notices'}
                    </span>
                  </div>
                  <div className="profile-menu-right">
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: (activeAdminNotifs.length + activeStoreAlerts.length) > 0 ? '#ea580c' : '#10b981',
                      background: (activeAdminNotifs.length + activeStoreAlerts.length) > 0 ? '#fff7ed' : '#ecfdf5',
                      border: `1px solid ${(activeAdminNotifs.length + activeStoreAlerts.length) > 0 ? '#ffedd5' : '#a7f3d0'}`,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <IconBell size={11} />
                      <span>{(activeAdminNotifs.length + activeStoreAlerts.length) > 0 ? `${activeAdminNotifs.length + activeStoreAlerts.length} Active` : 'All Clear'}</span>
                    </span>
                    <span className="profile-menu-chevron">
                      <IconChevronRight size={18} />
                    </span>
                  </div>
                </button>

                {/* 5. Device Permissions & Cookies Settings */}
                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => setActiveModal('settings')}
                >
                  <div className="profile-menu-left">
                    <span className="profile-menu-icon" style={{ color: '#0284c7' }}>
                      <IconShield size={20} color="#0284c7" />
                    </span>
                    <span className="profile-menu-label">
                      {appLang === 'kh' ? 'សិទ្ធិកាមេរ៉ា & ទីតាំង (Cookies)' : 'Camera & Location Permissions (Cookies)'}
                    </span>
                  </div>
                  <div className="profile-menu-right">
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <IconShield size={11} color="#0284c7" />
                      <span>{accountPerms.camera && accountPerms.location ? 'Auto-Allow Active' : '365-Day Cookie'}</span>
                    </span>
                    <span className="profile-menu-chevron">
                      <IconChevronRight size={18} />
                    </span>
                  </div>
                </button>

                {/* 6. Feed preference */}
                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => setActiveModal('feed')}
                >
                  <div className="profile-menu-left">
                    <span className="profile-menu-icon">
                      <IconBell size={20} />
                    </span>
                    <span className="profile-menu-label">
                      {appLang === 'kh' ? 'ចំណូលចិត្តការជូនដំណឹង' : 'Feed preference'}
                    </span>
                  </div>
                  <span className="profile-menu-chevron">
                    <IconChevronRight size={18} />
                  </span>
                </button>

                {/* 6. Password & Security (Admin Managed) */}
                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => setActiveModal('password')}
                >
                  <div className="profile-menu-left">
                    <span className="profile-menu-icon" style={{ color: '#ea580c' }}>
                      <IconLock size={20} color="#ea580c" />
                    </span>
                    <span className="profile-menu-label">
                      {appLang === 'kh' ? 'ពាក្យសម្ងាត់គណនី' : 'Account Password'}
                    </span>
                  </div>
                  <div className="profile-menu-right">
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#ea580c', background: '#fff7ed', border: '1px solid #ffedd5', padding: '2px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <IconLock size={11} color="#ea580c" />
                      <span>{appLang === 'kh' ? 'គ្រប់គ្រងដោយ Admin' : 'Admin Managed'}</span>
                    </span>
                    <span className="profile-menu-chevron">
                      <IconChevronRight size={18} />
                    </span>
                  </div>
                </button>
              </div>

              <div className="profile-menu-divider" />

              {/* 5. Log Out */}
              <div className="profile-menu-group">
                <button
                  type="button"
                  className="profile-menu-item logout-item"
                  onClick={onLogout}
                >
                  <div className="profile-menu-left">
                    <span className="profile-menu-icon text-red">
                      <IconDoorOut size={20} color="#ef4444" />
                    </span>
                    <span className="profile-menu-label text-red">
                      {appLang === 'kh' ? 'ចាកចេញ' : 'Log Out'}
                    </span>
                  </div>
                  <span className="profile-menu-chevron">
                    <IconChevronRight size={18} />
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* SCREEN 2: EDIT PROFILE (VISIBLE WHEN isEditing IS TRUE)        */
          /* ============================================================== */
          <div className="profile-screen-card edit-profile-card">
            {/* Top Bar */}
            <div className="profile-header-bar">
              <button
                type="button"
                className="profile-header-icon-btn"
                onClick={() => setIsEditing(false)}
                title={appLang === 'kh' ? 'ត្រឡប់ក្រោយ' : 'Cancel / Back'}
              >
                <IconArrowLeft size={20} />
              </button>
              <h2 className="profile-header-title">
                {appLang === 'kh' ? 'កែប្រែព័ត៌មាន' : 'Edit Profile'}
              </h2>
              <button
                type="button"
                className="profile-header-icon-btn save-check-btn"
                onClick={handleSaveProfile}
                title={appLang === 'kh' ? 'រក្សាទុក' : 'Save Profile'}
              >
                <IconCheck size={22} color="#10b981" />
              </button>
            </div>

            {/* Centered Avatar */}
            <div className="edit-avatar-hero">
              <div
                className="edit-avatar-wrapper"
                onClick={() => fileInputRef.current?.click()}
                title="Change Photo"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Edit Profile Avatar"
                    className="edit-avatar-img"
                    onError={() => setAvatarUrl('')}
                  />
                ) : (
                  <div className="edit-avatar-placeholder">
                    {userInitials}
                  </div>
                )}
                <button
                  type="button"
                  className="edit-avatar-camera-badge"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  title="Upload Photo"
                >
                  <IconCameraBadge size={13} color="#0f172a" />
                </button>
              </div>
            </div>

            {/* Form Section */}
            <div className="edit-profile-form">
              <h4 className="edit-form-section-title">
                {appLang === 'kh' ? 'ព័ត៌មានរបស់អ្នក' : 'Your Information'}
              </h4>

              {/* 1. First Name */}
              <div className="edit-input-group">
                <label className="edit-input-label">
                  {appLang === 'kh' ? 'នាមខ្លួន' : 'First name'}
                </label>
                <input
                  type="text"
                  className="edit-input-field"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={appLang === 'kh' ? 'បញ្ចូលនាមខ្លួន' : 'Enter first name'}
                />
              </div>

              {/* 2. Last Name */}
              <div className="edit-input-group">
                <label className="edit-input-label">
                  {appLang === 'kh' ? 'គោត្តនាម' : 'Last name'}
                </label>
                <input
                  type="text"
                  className="edit-input-field"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={appLang === 'kh' ? 'បញ្ចូលគោត្តនាម' : 'Enter last name'}
                />
              </div>

              {/* 3. Phone with Country Code Selector */}
              <div className="edit-input-group phone-group active-focus">
                <label className="edit-input-label">
                  {appLang === 'kh' ? 'លេខទូរស័ព្ទ' : 'Phone'}
                </label>
                <div className="edit-phone-row">
                  <select
                    className="edit-country-select"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                  >
                    <option value="+855">+855</option>
                    <option value="+1">+1</option>
                    <option value="+44">+44</option>
                    <option value="+66">+66</option>
                    <option value="+84">+84</option>
                    <option value="+65">+65</option>
                    <option value="+91">+91</option>
                  </select>
                  <input
                    type="tel"
                    className="edit-input-field phone-field"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="12 345 678"
                  />
                </div>
              </div>

              {/* 4. Email Id */}
              <div className="edit-input-group">
                <label className="edit-input-label">
                  {appLang === 'kh' ? 'អ៊ីមែល' : 'Email Id'}
                </label>
                <input
                  type="email"
                  className="edit-input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@chafe.com"
                />
              </div>

              {/* 5. Gender */}
              <div className="edit-input-group select-group">
                <label className="edit-input-label">
                  {appLang === 'kh' ? 'ភេទ' : 'Gender'}
                </label>
                <select
                  className="edit-input-field select-field"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="Male">{appLang === 'kh' ? 'ប្រុស (Male)' : 'Male'}</option>
                  <option value="Female">{appLang === 'kh' ? 'ស្រី (Female)' : 'Female'}</option>
                  <option value="Other">{appLang === 'kh' ? 'ផ្សេងៗ (Other)' : 'Other'}</option>
                  <option value="Prefer not to say">
                    {appLang === 'kh' ? 'មិនបញ្ជាក់' : 'Prefer not to say'}
                  </option>
                </select>
              </div>

              {/* 6. Store Branch (Assigned by Admin - Locked) */}
              <div className="edit-input-group">
                <label className="edit-input-label">
                  {appLang === 'kh' ? 'សាខាហាង (ចាត់តាំងដោយ Admin)' : 'Store Branch (Assigned by Admin)'}
                </label>
                <div className="locked-branch-box">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IconMapPin size={16} color="#059669" />
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                        {user?.branch_name || 'Chafé Store'}
                      </strong>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#ea580c', background: '#fff7ed', border: '1px solid #ffedd5', padding: '2px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <IconLock size={12} color="#ea580c" />
                      <span>{appLang === 'kh' ? 'ចាក់សោ' : 'Locked'}</span>
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {appLang === 'kh'
                      ? 'ទីតាំងសាខាត្រូវបានចាត់តាំងដោយ Admin។ បុគ្គលិកមិនអាចផ្លាស់ប្តូរដោយខ្លួនឯងបានទេ។'
                      : 'Store branch & location are automatically assigned by Admin and cannot be changed by staff.'}
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="edit-form-save-row">
                <button
                  type="button"
                  className="edit-submit-btn"
                  onClick={handleSaveProfile}
                >
                  {appLang === 'kh' ? 'រក្សាទុកការផ្លាស់ប្តូរ' : 'Save Profile Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* POPUP SUB-MODALS                                               */}
      {/* ============================================================== */}
      {activeModal && (
        <div
          className="mobile-feature-modal-backdrop"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="mobile-feature-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '400px' }}
          >
            <div className="mobile-feature-modal-header">
              <h3 className="mobile-feature-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeModal === 'language' && (
                  <>
                    <IconGlobe size={18} color="#0284c7" /> <span>{appLang === 'kh' ? 'ជ្រើសរើសភាសា' : 'App Language'}</span>
                  </>
                )}
                {activeModal === 'location' && (
                  <>
                    <IconMapPin size={18} color="#059669" /> <span>{appLang === 'kh' ? 'ទីតាំងហាង' : 'Store Location'}</span>
                  </>
                )}
                {activeModal === 'display' && (
                  <>
                    <IconDeviceMobile size={18} color="#7c3aed" /> <span>{appLang === 'kh' ? 'ការបង្ហាញ' : 'Display & Theme'}</span>
                  </>
                )}
                {activeModal === 'feed' && (
                  <>
                    <IconBell size={18} color="#d97706" /> <span>{appLang === 'kh' ? 'ការជូនដំណឹង' : 'Feed Preferences'}</span>
                  </>
                )}
                {activeModal === 'settings' && (
                  <>
                    <IconGear size={18} color="#0f172a" /> <span>{appLang === 'kh' ? 'ការកំណត់គណនី' : 'Account Settings'}</span>
                  </>
                )}
                {activeModal === 'alerts' && (
                  <>
                    <IconBell size={18} color="#ec4899" /> <span>{appLang === 'kh' ? 'ការជូនដំណឹង & សេចក្តីប្រកាស' : 'Store Alerts & Notices'}</span>
                  </>
                )}
                {activeModal === 'password' && (
                  <>
                    <IconLock size={18} color="#dc2626" /> <span>{appLang === 'kh' ? 'ប្តូរពាក្យសម្ងាត់' : 'Change Password'}</span>
                  </>
                )}
              </h3>
              <button
                type="button"
                className="mobile-feature-modal-close"
                onClick={() => setActiveModal(null)}
              >
                <IconX size={16} />
              </button>
            </div>

            <div className="mobile-feature-modal-body">
              {/* LANGUAGE MODAL: ONLY TWO LANGUAGES (kh and en) */}
              {activeModal === 'language' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    className={`lang-option-btn ${appLang === 'en' ? 'active' : ''}`}
                    onClick={() => handleSelectLanguage('en')}
                  >
                    <span>English (en)</span>
                    {appLang === 'en' && <IconCheck size={16} color="#059669" />}
                  </button>
                  <button
                    type="button"
                    className={`lang-option-btn ${appLang === 'kh' ? 'active' : ''}`}
                    onClick={() => handleSelectLanguage('kh')}
                  >
                    <span>ភាសាខ្មែរ (kh)</span>
                    {appLang === 'kh' && <IconCheck size={16} color="#059669" />}
                  </button>
                </div>
              )}

              {/* LOCATION MODAL (Admin assigned - Locked) */}
              {activeModal === 'location' && (
                <div style={{ fontSize: '13px', color: '#334155' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', marginBottom: '12px' }}>
                    <IconLock size={16} color="#dc2626" />
                    <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600 }}>
                      {appLang === 'kh'
                        ? 'ទីតាំងត្រូវបានចាត់តាំងដោយ Admin។ បុគ្គលិកមិនអាចផ្លាស់ប្តូរដោយខ្លួនឯងបានទេ។'
                        : 'Store location is set by Admin and cannot be changed by staff.'}
                    </div>
                  </div>
                  <p style={{ marginBottom: '10px', fontWeight: 600, color: '#475569', fontSize: '12px' }}>
                    {appLang === 'kh' ? 'សាខាដែលបានចាត់តាំងបច្ចុប្បន្ន៖' : 'Your Currently Assigned Branch:'}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {branchesList.map(b => {
                      const isAssigned = (user?.branch_id === b.id) || (!user?.branch_id && b.id === branchesList[0]?.id)
                      return (
                        <div
                          key={b.id}
                          style={{
                            padding: '12px 14px',
                            background: isAssigned ? '#ecfdf5' : '#f8fafc',
                            border: `1.5px solid ${isAssigned ? '#10b981' : '#e2e8f0'}`,
                            borderRadius: '10px',
                            opacity: isAssigned ? 1 : 0.6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, color: isAssigned ? '#065f46' : '#64748b', fontSize: '13px' }}>
                              {b.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              {b.address || 'Siem Reap'} • {b.radiusMeters || 50}m allowed radius
                            </div>
                          </div>
                          {isAssigned ? (
                            <span style={{ color: '#10b981', fontWeight: 800, fontSize: '12px', background: '#d1fae5', padding: '3px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <IconCheck size={12} color="#10b981" />
                              <span>{appLang === 'kh' ? 'សាខារបស់អ្នក' : 'Your Branch'}</span>
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <IconLock size={11} color="#94a3b8" />
                              <span>{appLang === 'kh' ? 'ចាក់សោ' : 'Locked'}</span>
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* DISPLAY MODAL */}
              {activeModal === 'display' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {['Light Theme', 'Dark Mode', 'System Default'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`lang-option-btn ${themeMode === mode ? 'active' : ''}`}
                      onClick={() => handleSelectTheme(mode)}
                    >
                      <span>{mode}</span>
                      {themeMode === mode && <IconCheck size={16} color="#059669" />}
                    </button>
                  ))}
                </div>
              )}

              {/* FEED MODAL */}
              {activeModal === 'feed' && (
                <div style={{ fontSize: '13px', color: '#475569' }}>
                  <p>
                    {appLang === 'kh'
                      ? 'ជ្រើសរើសព័ត៌មានដែលត្រូវបង្ហាញ៖'
                      : 'Choose updates for your home screen:'}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      marginTop: '10px',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        defaultChecked
                        style={{ accentColor: '#10b981' }}
                      />
                      <span>Shift reminders & counter updates</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        defaultChecked
                        style={{ accentColor: '#10b981' }}
                      />
                      <span>Store announcements</span>
                    </label>
                  </div>
                </div>
              )}

              {/* SETTINGS MODAL: Own Account Cookie Storage for Camera & Location */}
              {activeModal === 'settings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Account Cookie Info Card */}
                  <div style={{
                    background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
                    border: '1.5px solid #a7f3d0',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    fontSize: '12.5px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 800, color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <IconShield size={16} color="#059669" />
                        <span>Account Cookie Storage</span>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 800, background: '#d1fae5', color: '#047857', padding: '2px 7px', borderRadius: '4px' }}>
                        365-DAY COOKIE
                      </span>
                    </div>
                    <div style={{ color: '#047857', fontSize: '11.5px', lineHeight: 1.4 }}>
                      Persistent cookies stored for <strong>@{user?.username || user?.name || 'staff'}</strong> to automatically grant camera and GPS location verification when visiting this site.
                    </div>
                  </div>

                  {/* Cookie Option 1: Auto-Allow Camera on Visit */}
                  <div className="settings-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ flex: 1, paddingRight: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <IconCamera size={16} color="#0284c7" />
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>Auto-Allow Camera on Visit</strong>
                      </div>
                      <p style={{ fontSize: '11.5px', color: '#64748b', margin: '3px 0 0' }}>
                        Store cookie for account to open QR camera scanner without permission prompts.
                      </p>
                    </div>
                    <label className="settings-switch" style={{ cursor: 'pointer', position: 'relative', display: 'inline-block', width: '42px', height: '24px' }}>
                      <input
                        type="checkbox"
                        checked={!!accountPerms.camera}
                        onChange={(e) => handleToggleCameraPerm(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: accountPerms.camera ? '#10b981' : '#cbd5e1',
                        transition: '0.2s', borderRadius: '24px'
                      }}>
                        <span style={{
                          position: 'absolute', content: '""', height: '18px', width: '18px',
                          left: accountPerms.camera ? '21px' : '3px', bottom: '3px',
                          backgroundColor: '#ffffff', transition: '0.2s', borderRadius: '50%',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }} />
                      </span>
                    </label>
                  </div>

                  {/* Cookie Option 2: Auto-Allow Location on Visit */}
                  <div className="settings-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ flex: 1, paddingRight: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <IconMapPin size={16} color="#059669" />
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>Auto-Allow Store GPS Location</strong>
                      </div>
                      <p style={{ fontSize: '11.5px', color: '#64748b', margin: '3px 0 0' }}>
                        Store cookie to verify café store distance instantly for 1-tap Check-In.
                      </p>
                    </div>
                    <label className="settings-switch" style={{ cursor: 'pointer', position: 'relative', display: 'inline-block', width: '42px', height: '24px' }}>
                      <input
                        type="checkbox"
                        checked={!!accountPerms.location}
                        onChange={(e) => handleToggleLocationPerm(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: accountPerms.location ? '#10b981' : '#cbd5e1',
                        transition: '0.2s', borderRadius: '24px'
                      }}>
                        <span style={{
                          position: 'absolute', content: '""', height: '18px', width: '18px',
                          left: accountPerms.location ? '21px' : '3px', bottom: '3px',
                          backgroundColor: '#ffffff', transition: '0.2s', borderRadius: '50%',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }} />
                      </span>
                    </label>
                  </div>

                  {/* Test & Save All Permissions Action Button */}
                  <div style={{ marginTop: '2px' }}>
                    <button
                      type="button"
                      onClick={handleVerifyBothPermissionsNow}
                      disabled={testingPerms}
                      style={{
                        width: '100%',
                        padding: '11px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 800,
                        fontSize: '12.5px',
                        cursor: testingPerms ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)'
                      }}
                    >
                      <IconRefresh size={15} color="#ffffff" className={testingPerms ? 'spinning' : ''} />
                      <span>{testingPerms ? 'Verifying Hardware & Storing Cookies...' : 'Verify & Store Permissions to Cookie Now'}</span>
                    </button>
                    {permTestMessage && (
                      <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#059669', textAlign: 'center', fontWeight: 600 }}>
                        {permTestMessage}
                      </div>
                    )}
                  </div>

                  {/* Standard Notifications Row */}
                  <div className="settings-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>Push Notifications</strong>
                      <p style={{ fontSize: '11.5px', color: '#64748b', margin: '2px 0 0' }}>
                        Shift alerts & announcements
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked
                      style={{ accentColor: '#10b981', width: '18px', height: '18px' }}
                    />
                  </div>
                </div>
              )}

              {/* STORE ALERTS & NOTICES MODAL (Read & Delete inside Settings) */}
              {activeModal === 'alerts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '8px',
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                      Active Notices: <strong>{activeAdminNotifs.length + activeStoreAlerts.length}</strong>
                    </span>
                    {(activeAdminNotifs.length > 0 || activeStoreAlerts.length > 0) && (
                      <button
                        type="button"
                        onClick={onDeleteAllAlerts}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        <IconTrash size={12} color="#ef4444" />
                        <span>Dismiss All</span>
                      </button>
                    )}
                  </div>

                  {/* Active Notices List */}
                  {(activeAdminNotifs.length > 0 || activeStoreAlerts.length > 0) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
                      {/* Admin Management Notifications */}
                      {activeAdminNotifs.map(n => (
                        <div
                          key={n.id}
                          style={{
                            background: n.priority === 'urgent' ? '#fff7ed' : '#eff6ff',
                            border: `1px solid ${n.priority === 'urgent' ? '#fed7aa' : '#bfdbfe'}`,
                            borderRadius: '12px',
                            padding: '12px',
                            fontSize: '12.5px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <div style={{ fontWeight: 800, color: n.priority === 'urgent' ? '#9a3412' : '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{n.priority === 'urgent' ? '🚨' : '🔔'}</span>
                              <span>{n.title || 'Notice from Management'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: n.priority === 'urgent' ? '#ea580c' : '#0284c7',
                                color: '#ffffff'
                              }}>
                                {n.priority === 'urgent' ? 'URGENT' : 'NOTICE'}
                              </span>
                              <button
                                type="button"
                                onClick={() => onDeleteAlert?.(n.id)}
                                title="Delete notice"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '4px'
                                }}
                              >
                                <IconTrash size={14} color="#ef4444" />
                              </button>
                            </div>
                          </div>
                          <div style={{ color: '#334155', lineHeight: 1.4 }}>
                            {n.message}
                          </div>
                        </div>
                      ))}

                      {/* Store Announcements */}
                      {activeStoreAlerts.map(alert => (
                        <div
                          key={alert.id}
                          style={{
                            background: alert.priority === 'high' ? '#eff6ff' : '#f0fdf4',
                            border: `1px solid ${alert.priority === 'high' ? '#bfdbfe' : '#bbf7d0'}`,
                            borderRadius: '12px',
                            padding: '12px',
                            fontSize: '12.5px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <div style={{ fontWeight: 800, color: alert.priority === 'high' ? '#1e40af' : '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <IconBell size={13} />
                              <span>{alert.title}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {alert.priority === 'high' && (
                                <span style={{ fontSize: '10px', fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px' }}>
                                  High Priority
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => onDeleteAlert?.(alert.id)}
                                title="Delete notice"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '4px'
                                }}
                              >
                                <IconTrash size={14} color="#ef4444" />
                              </button>
                            </div>
                          </div>
                          <div style={{ color: '#334155', lineHeight: 1.4 }}>
                            {alert.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px 10px', color: '#64748b', fontSize: '13px' }}>
                      <div style={{ marginBottom: '8px' }}>
                        <IconCheckCircle size={36} color="#10b981" />
                      </div>
                      <strong style={{ display: 'block', fontSize: '14px', color: '#0f172a', marginBottom: '4px' }}>
                        No active announcements
                      </strong>
                      <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#94a3b8' }}>
                        You have read or dismissed all store alerts.
                      </p>
                      {dismissedAlertIds && dismissedAlertIds.length > 0 && (
                        <button
                          type="button"
                          onClick={onRestoreDismissedAlerts}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 14px',
                            borderRadius: '8px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            color: '#0284c7',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <IconRotateCw size={13} />
                          <span>Restore Cleared Notices ({dismissedAlertIds.length})</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* PASSWORD MODAL (Locked: Staff cannot change password) */}
              {activeModal === 'password' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center', padding: '10px 4px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fff7ed', border: '2px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                    <IconLock size={26} color="#ea580c" />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: '#0f172a', fontWeight: 800 }}>
                      {appLang === 'kh' ? 'ពាក្យសម្ងាត់គ្រប់គ្រងដោយ Admin' : 'Password Managed by Admin'}
                    </h4>
                    <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b', lineHeight: 1.5 }}>
                      {appLang === 'kh'
                        ? 'ដើម្បីសុវត្ថិភាពនិងការគ្រប់គ្រងប្រព័ន្ធ បុគ្គលិកមិនអាចផ្លាស់ប្តូរពាក្យសម្ងាត់ដោយខ្លួនឯងបានទេ។ ប្រសិនបើលោកអ្នកត្រូវការផ្លាស់ប្តូរ ឬភ្លេចពាក្យសម្ងាត់ សូមទាក់ទង Admin ឬអ្នកគ្រប់គ្រងហាងផ្ទាល់។'
                        : 'For security and system compliance, staff cannot change account passwords directly. All credentials are administered by store management. Please contact your manager or admin to request a credential update.'}
                    </p>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px', fontSize: '12px', color: '#334155', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#64748b' }}>Account:</span>
                      <strong>{user?.name || 'Staff Member'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Role:</span>
                      <strong style={{ color: '#059669' }}>{user?.role || 'Barista'}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="edit-submit-btn"
                    onClick={() => setActiveModal(null)}
                    style={{ width: '100%', padding: '10px', borderRadius: '10px' }}
                  >
                    {appLang === 'kh' ? 'យល់ព្រម' : 'Understood'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
