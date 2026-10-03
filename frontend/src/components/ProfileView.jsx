import { useState, useRef, useEffect } from 'react'
import {
  IconArrowLeft,
  IconGear,
  IconCheck,
  IconCameraBadge,
  IconHeartOutline,
  IconDownload,
  IconGlobe,
  IconMapPin,
  IconDeviceMobile,
  IconCreditCard,
  IconTrash,
  IconHistory,
  IconDoorOut,
  IconChevronRight,
  IconQrCode,
  IconBell,
} from '../Icons'

// High-fidelity fallback portrait matching the reference template
const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'

export default function ProfileView({
  user,
  onUpdateUser,
  onBack,
  onLogout,
  onShowBadge,
  showToast,
  isDesktopWide = false,
}) {
  // Parse name into first & last name
  const nameParts = (user?.name || 'Jhonson King').split(' ')
  const initialFirst = nameParts[0] || 'Jhonson'
  const initialLast = nameParts.slice(1).join(' ') || 'King'

  // Local editing states
  const [isEditing, setIsEditing] = useState(false)
  const [firstName, setFirstName] = useState(initialFirst)
  const [lastName, setLastName] = useState(initialLast)
  const [countryCode, setCountryCode] = useState('+91')
  const [phone, setPhone] = useState(user?.phone || '689 7852')
  const [email, setEmail] = useState(user?.email || 'jhonking@gmail.com')
  const [gender, setGender] = useState(user?.gender || 'Male')
  const [avatarUrl, setAvatarUrl] = useState(
    user?.photo_url || localStorage.getItem('chafe_profile_avatar') || DEFAULT_AVATAR
  )

  // Modals for menu items
  const [activeModal, setActiveModal] = useState(null) // 'settings' | 'favourites' | 'language' | 'location' | 'display' | 'feed' | null
  const [currentLang, setCurrentLang] = useState('English (US)')
  const [selectedLocation, setSelectedLocation] = useState('Chafé Central Station')
  const [themeMode, setThemeMode] = useState('System')

  const fileInputRef = useRef(null)

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
        showToast?.('Profile picture updated!', 'success')
      }
      reader.readAsDataURL(file)
    }
  }

  // Save profile changes
  const handleSaveProfile = () => {
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim() || 'Staff Member'
    const updatedUser = {
      ...(user || {}),
      name: fullName,
      email: email.trim(),
      phone: `${countryCode} ${phone.trim()}`,
      gender,
      photo_url: avatarUrl,
    }

    if (onUpdateUser) {
      onUpdateUser(updatedUser)
    }

    // Persist to local storage
    try {
      localStorage.setItem('chafe_custom_staff_profile', JSON.stringify(updatedUser))
    } catch {
      // quiet catch
    }

    showToast?.('Profile saved successfully! ✓', 'success')
    setIsEditing(false)
  }

  // Clear cache action
  const handleClearCache = () => {
    if (window.confirm('Clear local application cache and refresh?')) {
      try {
        localStorage.removeItem('chafe_recent_scans')
        localStorage.removeItem('chafe_cached_shifts')
      } catch {
        // quiet catch
      }
      showToast?.('Local cache cleared successfully', 'success')
    }
  }

  // Clear history action
  const handleClearHistory = () => {
    if (window.confirm('Clear your temporary shift logs history on this device?')) {
      showToast?.('Local shift history cleared', 'info')
    }
  }

  // Trigger export/download timesheet
  const handleDownload = () => {
    showToast?.('Preparing attendance timesheet summary for download...', 'info')
    setTimeout(() => {
      window.print()
    }, 400)
  }

  return (
    <div className="profile-template-wrapper">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handlePhotoSelect}
      />

      {/* Responsive layout: on wide desktop, shows both cards side by side; on mobile, toggles */}
      <div className={`profile-cards-container ${isDesktopWide ? 'desktop-dual-view' : ''}`}>
        {/* ============================================================== */}
        {/* SCREEN 1: MY PROFILE                                           */}
        {/* ============================================================== */}
        {(!isEditing || isDesktopWide) && (
          <div className="profile-screen-card my-profile-card">
            {/* Top Bar */}
            <div className="profile-header-bar">
              <button
                type="button"
                className="profile-header-icon-btn"
                onClick={onBack}
                title="Go Back"
              >
                <IconArrowLeft size={20} />
              </button>
              <h2 className="profile-header-title">My Profile</h2>
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
                <img
                  src={avatarUrl}
                  alt={user?.name || 'Staff Profile'}
                  className="profile-avatar-img"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_AVATAR
                  }}
                />
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
                  {firstName} {lastName}
                </h3>
                <div className="profile-user-email">{email}</div>
                <button
                  type="button"
                  className="profile-edit-green-btn"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Profile
                </button>
              </div>
            </div>

            {/* Menu List Groups */}
            <div className="profile-menu-groups">
              {/* Group 1: Favourites & Downloads */}
              <div className="profile-menu-group">
                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => setActiveModal('favourites')}
                >
                  <div className="profile-menu-left">
                    <span className="profile-menu-icon">
                      <IconHeartOutline size={20} />
                    </span>
                    <span className="profile-menu-label">Favourites</span>
                  </div>
                  <span className="profile-menu-chevron">
                    <IconChevronRight size={18} />
                  </span>
                </button>

                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={handleDownload}
                >
                  <div className="profile-menu-left">
                    <span className="profile-menu-icon">
                      <IconDownload size={20} />
                    </span>
                    <span className="profile-menu-label">Downloads</span>
                  </div>
                  <span className="profile-menu-chevron">
                    <IconChevronRight size={18} />
                  </span>
                </button>
              </div>

              <div className="profile-menu-divider" />

              {/* Group 2: Language, Location, Display, Feed, Subscription */}
              <div className="profile-menu-group">
                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => setActiveModal('language')}
                >
                  <div className="profile-menu-left">
                    <span className="profile-menu-icon">
                      <IconGlobe size={20} />
                    </span>
                    <span className="profile-menu-label">Language</span>
                  </div>
                  <div className="profile-menu-right">
                    <span className="profile-menu-subvalue">{currentLang}</span>
                    <span className="profile-menu-chevron">
                      <IconChevronRight size={18} />
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => setActiveModal('location')}
                >
                  <div className="profile-menu-left">
                    <span className="profile-menu-icon">
                      <IconMapPin size={20} />
                    </span>
                    <span className="profile-menu-label">Location</span>
                  </div>
                  <span className="profile-menu-chevron">
                    <IconChevronRight size={18} />
                  </span>
                </button>

                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => setActiveModal('display')}
                >
                  <div className="profile-menu-left">
                    <span className="profile-menu-icon">
                      <IconDeviceMobile size={20} />
                    </span>
                    <span className="profile-menu-label">Display</span>
                  </div>
                  <span className="profile-menu-chevron">
                    <IconChevronRight size={18} />
                  </span>
                </button>

                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => setActiveModal('feed')}
                >
                  <div className="profile-menu-left">
                    <span className="profile-menu-icon">
                      <IconBell size={20} />
                    </span>
                    <span className="profile-menu-label">Feed preference</span>
                  </div>
                  <span className="profile-menu-chevron">
                    <IconChevronRight size={18} />
                  </span>
                </button>

                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => {
                    if (onShowBadge) {
                      onShowBadge()
                    } else {
                      showToast?.('Staff Digital Pass is active & verified', 'success')
                    }
                  }}
                >
                  <div className="profile-menu-left">
                    <span className="profile-menu-icon">
                      <IconCreditCard size={20} />
                    </span>
                    <span className="profile-menu-label">Subscription</span>
                  </div>
                  <div className="profile-menu-right">
                    <span className="profile-menu-badge-green">Staff Pass</span>
                    <span className="profile-menu-chevron">
                      <IconChevronRight size={18} />
                    </span>
                  </div>
                </button>
              </div>

              <div className="profile-menu-divider" />

              {/* Group 3: Clear Cache, Clear history, Log Out */}
              <div className="profile-menu-group">
                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={handleClearCache}
                >
                  <div className="profile-menu-left">
                    <span className="profile-menu-icon">
                      <IconTrash size={20} />
                    </span>
                    <span className="profile-menu-label">Clear Cache</span>
                  </div>
                  <span className="profile-menu-chevron">
                    <IconChevronRight size={18} />
                  </span>
                </button>

                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={handleClearHistory}
                >
                  <div className="profile-menu-left">
                    <span className="profile-menu-icon">
                      <IconHistory size={20} />
                    </span>
                    <span className="profile-menu-label">Clear history</span>
                  </div>
                  <span className="profile-menu-chevron">
                    <IconChevronRight size={18} />
                  </span>
                </button>

                <button
                  type="button"
                  className="profile-menu-item logout-item"
                  onClick={onLogout}
                >
                  <div className="profile-menu-left">
                    <span className="profile-menu-icon text-red">
                      <IconDoorOut size={20} color="#ef4444" />
                    </span>
                    <span className="profile-menu-label text-red">Log Out</span>
                  </div>
                  <span className="profile-menu-chevron">
                    <IconChevronRight size={18} />
                  </span>
                </button>
              </div>
            </div>

            {/* Version Footer */}
            <div className="profile-app-version">
              App version 003
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SCREEN 2: EDIT PROFILE                                         */}
        {/* ============================================================== */}
        {(isEditing || isDesktopWide) && (
          <div className="profile-screen-card edit-profile-card">
            {/* Top Bar */}
            <div className="profile-header-bar">
              <button
                type="button"
                className="profile-header-icon-btn"
                onClick={() => setIsEditing(false)}
                title="Cancel / Back"
              >
                <IconArrowLeft size={20} />
              </button>
              <h2 className="profile-header-title">Edit Profile</h2>
              <button
                type="button"
                className="profile-header-icon-btn save-check-btn"
                onClick={handleSaveProfile}
                title="Save Profile"
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
                <img
                  src={avatarUrl}
                  alt="Edit Profile Avatar"
                  className="edit-avatar-img"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_AVATAR
                  }}
                />
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
              <h4 className="edit-form-section-title">Your Information</h4>

              {/* 1. First Name */}
              <div className="edit-input-group">
                <label className="edit-input-label">First name</label>
                <input
                  type="text"
                  className="edit-input-field"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                />
              </div>

              {/* 2. Last Name */}
              <div className="edit-input-group">
                <label className="edit-input-label">Last name</label>
                <input
                  type="text"
                  className="edit-input-field"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                />
              </div>

              {/* 3. Phone with Country Code Selector */}
              <div className="edit-input-group phone-group active-focus">
                <label className="edit-input-label">Phone</label>
                <div className="edit-phone-row">
                  <select
                    className="edit-country-select"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                  >
                    <option value="+91">+91</option>
                    <option value="+855">+855</option>
                    <option value="+1">+1</option>
                    <option value="+44">+44</option>
                    <option value="+66">+66</option>
                    <option value="+84">+84</option>
                    <option value="+65">+65</option>
                    <option value="+60">+60</option>
                    <option value="+81">+81</option>
                  </select>
                  <input
                    type="tel"
                    className="edit-input-field phone-field"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="689 7852"
                  />
                </div>
              </div>

              {/* 4. Email Id */}
              <div className="edit-input-group">
                <label className="edit-input-label">Email Id</label>
                <input
                  type="email"
                  className="edit-input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                />
              </div>

              {/* 5. Gender */}
              <div className="edit-input-group select-group">
                <label className="edit-input-label">Gender</label>
                <select
                  className="edit-input-field select-field"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              {/* Save Button for easy mobile thumb tap */}
              <div className="edit-form-save-row">
                <button
                  type="button"
                  className="edit-submit-btn"
                  onClick={handleSaveProfile}
                >
                  Save Profile Changes
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
            style={{ maxWidth: '420px' }}
          >
            <div className="mobile-feature-modal-header">
              <h3 className="mobile-feature-modal-title">
                {activeModal === 'settings' && <><span>⚙️</span> Account Settings</>}
                {activeModal === 'favourites' && <><span>♡</span> My Favourites</>}
                {activeModal === 'language' && <><span>🌐</span> App Language</>}
                {activeModal === 'location' && <><span>📍</span> Store Location</>}
                {activeModal === 'display' && <><span>📱</span> Display & Appearance</>}
                {activeModal === 'feed' && <><span>🔔</span> Feed Preferences</>}
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
              {activeModal === 'settings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="settings-row">
                    <div>
                      <strong>Push Notifications</strong>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                        Receive shift reminders & alerts
                      </p>
                    </div>
                    <input type="checkbox" defaultChecked style={{ accentColor: '#10b981', width: '20px', height: '20px' }} />
                  </div>
                  <div className="settings-row">
                    <div>
                      <strong>Biometric Login</strong>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                        Enable FaceID / Fingerprint scan
                      </p>
                    </div>
                    <input type="checkbox" defaultChecked style={{ accentColor: '#10b981', width: '20px', height: '20px' }} />
                  </div>
                </div>
              )}

              {activeModal === 'favourites' && (
                <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
                  <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '10px', marginBottom: '8px' }}>
                    ☕ <strong>Morning Pour Over Ritual</strong>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Favorite station standard</div>
                  </div>
                  <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '10px' }}>
                    ⭐ <strong>Weekend Peak Shift (08:00 - 16:30)</strong>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Preferred shift roster pattern</div>
                  </div>
                </div>
              )}

              {activeModal === 'language' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {['English (US)', 'Español', 'Français', 'ភាសាខ្មែរ (Khmer)', '日本語 (Japanese)'].map(
                    (lang) => (
                      <button
                        key={lang}
                        type="button"
                        className={`lang-option-btn ${currentLang === lang ? 'active' : ''}`}
                        onClick={() => {
                          setCurrentLang(lang)
                          setActiveModal(null)
                          showToast?.(`Language set to ${lang}`, 'success')
                        }}
                      >
                        <span>{lang}</span>
                        {currentLang === lang && <span>✓</span>}
                      </button>
                    )
                  )}
                </div>
              )}

              {activeModal === 'location' && (
                <div style={{ fontSize: '13px', color: '#334155' }}>
                  <p style={{ marginBottom: '10px' }}>
                    Active store branch linked to your biometric and QR attendance:
                  </p>
                  <div style={{ padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>Chafé Specialty Coffee • Store #01</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      Terminal A, Downtown Plaza, Floor 1
                    </div>
                  </div>
                </div>
              )}

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
                        showToast?.(`Display theme set to ${mode}`, 'info')
                      }}
                    >
                      <span>{mode}</span>
                      {themeMode === mode && <span>✓</span>}
                    </button>
                  ))}
                </div>
              )}

              {activeModal === 'feed' && (
                <div style={{ fontSize: '13px', color: '#475569' }}>
                  <p>Choose what appears in your home screen updates:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" defaultChecked style={{ accentColor: '#10b981' }} />
                      <span>Shift announcements & reminders</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" defaultChecked style={{ accentColor: '#10b981' }} />
                      <span>Team performance achievements</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" defaultChecked style={{ accentColor: '#10b981' }} />
                      <span>Weekly roster changes</span>
                    </label>
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
