import { useState, useRef, useEffect } from 'react'
import {
  IconArrowLeft,
  IconGear,
  IconCheck,
  IconCameraBadge,
  IconGlobe,
  IconMapPin,
  IconDeviceMobile,
  IconDoorOut,
  IconChevronRight,
  IconBell,
} from '../Icons'
import { getBranches } from '../services/locationService'

export default function ProfileView({
  user,
  branches = [],
  onUpdateUser,
  onBack,
  onLogout,
  showToast,
}) {
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

  // Language state: ONLY two options: Khmer (kh) and English (en)
  const [appLang, setAppLang] = useState(
    () => localStorage.getItem('chafe_app_lang') || 'en'
  )

  // Interactive menu modals
  const [activeModal, setActiveModal] = useState(null) // 'language' | 'location' | 'display' | 'feed' | 'settings' | null
  const [selectedLocation, setSelectedLocation] = useState('Chafé Central Station')
  const [themeMode, setThemeMode] = useState('System')

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
    const chosenBranch = branchesList.find(b => b.id === selectedBranchId) || branchesList[0]
    const updatedUser = {
      ...(user || {}),
      name: combinedName,
      email: email.trim(),
      phone: phone.trim() ? `${countryCode} ${phone.trim()}` : '',
      gender,
      photo_url: avatarUrl,
      branch_id: chosenBranch?.id || user?.branch_id || 'branch_2',
      branch_name: chosenBranch?.name || user?.branch_name || 'Chafé • Kohke',
      branch_address: chosenBranch?.address || user?.branch_address || 'Siem Reap, Cambodia',
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
      appLang === 'kh' ? 'បានរក្សាទុកព័ត៌មានរួចរាល់! ✓' : 'Profile saved successfully! ✓',
      'success'
    )
    setIsEditing(false)
  }

  const handleSelectLanguage = (langCode) => {
    setAppLang(langCode)
    try {
      localStorage.setItem('chafe_app_lang', langCode)
    } catch {
      // quiet catch
    }
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
    <div className="profile-template-wrapper">
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

                {/* 4. Feed preference */}
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
                      {appLang === 'kh' ? 'ការជូនដំណឹង' : 'Feed preference'}
                    </span>
                  </div>
                  <span className="profile-menu-chevron">
                    <IconChevronRight size={18} />
                  </span>
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

              {/* 6. Store Branch */}
              <div className="edit-input-group select-group">
                <label className="edit-input-label">
                  {appLang === 'kh' ? 'សាខាហាង' : 'Store Branch'}
                </label>
                <select
                  className="edit-input-field select-field"
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                >
                  {branchesList.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.radiusMeters || 50}m scan radius)
                    </option>
                  ))}
                </select>
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
              <h3 className="mobile-feature-modal-title">
                {activeModal === 'language' && (
                  <>
                    <span>🌐</span> {appLang === 'kh' ? 'ជ្រើសរើសភាសា' : 'App Language'}
                  </>
                )}
                {activeModal === 'location' && (
                  <>
                    <span>📍</span> {appLang === 'kh' ? 'ទីតាំងហាង' : 'Store Location'}
                  </>
                )}
                {activeModal === 'display' && (
                  <>
                    <span>📱</span> {appLang === 'kh' ? 'ការបង្ហាញ' : 'Display & Theme'}
                  </>
                )}
                {activeModal === 'feed' && (
                  <>
                    <span>🔔</span> {appLang === 'kh' ? 'ការជូនដំណឹង' : 'Feed Preferences'}
                  </>
                )}
                {activeModal === 'settings' && (
                  <>
                    <span>⚙️</span> {appLang === 'kh' ? 'ការកំណត់គណនី' : 'Account Settings'}
                  </>
                )}
              </h3>
              <button
                type="button"
                className="mobile-feature-modal-close"
                onClick={() => setActiveModal(null)}
              >
                ✕
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
                    {appLang === 'en' && <span>✓</span>}
                  </button>
                  <button
                    type="button"
                    className={`lang-option-btn ${appLang === 'kh' ? 'active' : ''}`}
                    onClick={() => handleSelectLanguage('kh')}
                  >
                    <span>ភាសាខ្មែរ (kh)</span>
                    {appLang === 'kh' && <span>✓</span>}
                  </button>
                </div>
              )}

              {/* LOCATION MODAL */}
              {activeModal === 'location' && (
                <div style={{ fontSize: '13px', color: '#334155' }}>
                  <p style={{ marginBottom: '12px', fontWeight: 600 }}>
                    {appLang === 'kh'
                      ? 'ជ្រើសរើសសាខាហាងសម្រាប់ការស្កេនវត្តមាន៖'
                      : 'Select active store branch for attendance scanning:'}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {branchesList.map(b => {
                      const isSelected = (user?.branch_id === b.id) || (!user?.branch_id && b.id === selectedBranchId)
                      return (
                        <div
                          key={b.id}
                          onClick={() => {
                            const updated = {
                              ...(user || {}),
                              branch_id: b.id,
                              branch_name: b.name,
                              branch_address: b.address || 'Siem Reap, Cambodia',
                            }
                            setSelectedBranchId(b.id)
                            if (onUpdateUser) onUpdateUser(updated)
                            try {
                              localStorage.setItem('chafe_custom_staff_profile', JSON.stringify(updated))
                            } catch { /* quiet */ }
                            showToast?.(
                              appLang === 'kh' ? `បានប្តូរទៅកាន់ ${b.name}` : `Active branch set to ${b.name}`,
                              'success'
                            )
                            setActiveModal(null)
                          }}
                          style={{
                            padding: '12px 14px',
                            background: isSelected ? '#ecfdf5' : '#f8fafc',
                            border: `1.5px solid ${isSelected ? '#10b981' : '#e2e8f0'}`,
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, color: isSelected ? '#065f46' : '#0f172a', fontSize: '13px' }}>
                              {b.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              {b.address || 'Siem Reap'} • {b.radiusMeters || 50}m allowed radius
                            </div>
                          </div>
                          {isSelected && <span style={{ color: '#10b981', fontWeight: 800, fontSize: '16px' }}>✓</span>}
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
                      onClick={() => {
                        setThemeMode(mode)
                        setActiveModal(null)
                        showToast?.(`Display set to ${mode}`, 'info')
                      }}
                    >
                      <span>{mode}</span>
                      {themeMode === mode && <span>✓</span>}
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

              {/* SETTINGS MODAL */}
              {activeModal === 'settings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="settings-row">
                    <div>
                      <strong>Push Notifications</strong>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                        Shift alerts & announcements
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked
                      style={{ accentColor: '#10b981', width: '20px', height: '20px' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
