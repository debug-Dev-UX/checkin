import React, { useState, useEffect } from 'react'
import { useLanguage } from '../context/LanguageContext'

/**
 * InstallModal - Smart 1-Tap Home Screen Install Guide & Prompt
 * Detects standalone status, listens to beforeinstallprompt (Android/Desktop),
 * and provides animated step-by-step guidance for iOS Safari.
 */
export default function InstallModal({ onClose, forceShow = false }) {
  const { lang } = useLanguage()
  const isKh = lang === 'kh'

  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isOpen, setIsOpen] = useState(forceShow)

  useEffect(() => {
    // 1. Detect standalone (already installed)
    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    setIsStandalone(standaloneMode)

    // 2. Detect iOS
    const userAgent = window.navigator.userAgent || ''
    const isAppleDevice = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream
    setIsIOS(isAppleDevice)

    // 3. Auto-open if URL has #install or ?install
    const hasInstallHash =
      window.location.hash.includes('install') ||
      window.location.search.includes('install')
    if (hasInstallHash && !standaloneMode) {
      setIsOpen(true)
    }

    // 4. Capture native beforeinstallprompt (Chrome / Android / Edge)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      if (hasInstallHash || forceShow) {
        setIsOpen(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // If app installed event fires, close modal
    const handleAppInstalled = () => {
      setIsOpen(false)
      setDeferredPrompt(null)
    }
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [forceShow])

  // Don't render if already in standalone mode and not forced
  if (isStandalone && !forceShow) return null
  if (!isOpen) return null

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setIsOpen(false)
      }
      setDeferredPrompt(null)
    }
  }

  const handleCopyLink = () => {
    const installUrl = `${window.location.origin}/#install`
    navigator.clipboard.writeText(installUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }).catch(() => {})
  }

  const handleClose = () => {
    setIsOpen(false)
    if (onClose) onClose()
  }

  return (
    <div className="install-modal-backdrop" onClick={handleClose}>
      <div className="install-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Top Close Button */}
        <button
          type="button"
          className="install-modal-close-btn"
          onClick={handleClose}
          aria-label="Close"
        >
          ✕
        </button>

        {/* Brand Coin & Header */}
        <div className="install-modal-header">
          <div className="install-modal-logo-wrap">
            <img src="/png-logo.png" alt="Chafé" className="install-modal-logo-img" />
          </div>
          <div className="install-modal-badge">
            {isKh ? '● កម្មវិធីផ្លូវការ' : '● OFFICIAL APP'}
          </div>
          <h3 className="install-modal-title">
            {isKh ? 'ដំឡើង Chafé លើទូរស័ព្ទ' : 'Install Chafé App'}
          </h3>
          <p className="install-modal-desc">
            {isKh
              ? 'ដាក់រូបសញ្ញា Chafé លើអេក្រង់ដើមទូរស័ព្ទ ដើម្បីចុះវត្តមាន ស្កេន និងពិនិត្យវេនការងារបានរហ័ស 1-Tap'
              : 'Add Chafé directly to your Home Screen for instant 1-tap staff workspace access.'}
          </p>
        </div>

        {/* Content Section: Android (1-Tap button) vs iOS (Step guide) */}
        {isIOS ? (
          <div className="install-modal-ios-steps">
            <div className="install-ios-step-item">
              <div className="install-ios-step-num">1</div>
              <div className="install-ios-step-text">
                {isKh ? (
                  <>ចុចប៊ូតុង <strong>Share</strong> (រូប <span className="ios-icon-share">⎋</span> ឬ <span className="ios-icon-share">⎙</span>) នៅខាងក្រោមនៃកម្មវិធី Safari</>
                ) : (
                  <>Tap the <strong>Share</strong> icon (<span className="ios-icon-share">⎋</span>) at the bottom bar in Safari</>
                )}
              </div>
            </div>

            <div className="install-ios-step-item">
              <div className="install-ios-step-num">2</div>
              <div className="install-ios-step-text">
                {isKh ? (
                  <>រំកិលចុះក្រោម រួចជ្រើសរើស <strong>"Add to Home Screen"</strong> (រូប <strong>[+]</strong>)</>
                ) : (
                  <>Scroll down and tap <strong>"Add to Home Screen"</strong> (icon <strong>[+]</strong>)</>
                )}
              </div>
            </div>

            <div className="install-ios-step-item">
              <div className="install-ios-step-num">3</div>
              <div className="install-ios-step-text">
                {isKh ? (
                  <>ចុចពាក្យ <strong>"Add"</strong> នៅជ្រុងខាងស្តាំខាងលើ។ រួចរាល់!</>
                ) : (
                  <>Tap <strong>"Add"</strong> in the top right corner. Done!</>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="install-modal-android-block">
            {deferredPrompt ? (
              <button
                type="button"
                className="install-modal-primary-btn"
                onClick={handleInstallClick}
              >
                <span>📲</span>
                <span>{isKh ? 'ដំឡើងឥឡូវនេះ (Install Now)' : 'Install to Home Screen'}</span>
              </button>
            ) : (
              <div className="install-modal-chrome-guide">
                <p>
                  {isKh
                    ? 'ចុចសញ្ញាចុចបី (⋮) នៅជ្រុងខាងលើ Chrome → ជ្រើសរើស "Install App" ឬ "Add to Home screen"'
                    : 'Tap the (⋮) menu in Chrome → Select "Install App" or "Add to Home screen"'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Share/Copy Link Bar for Managers to send to staff */}
        <div className="install-modal-copy-box">
          <span className="install-copy-label">
            {isKh ? 'តំណភ្ជាប់ផ្ញើទៅបុគ្គលិក (Staff Link):' : 'Share Install Link to Staff:'}
          </span>
          <button
            type="button"
            className="install-copy-btn"
            onClick={handleCopyLink}
          >
            {copied ? (
              <span style={{ color: '#10b981' }}>✓ {isKh ? 'បានចម្លងរួចរាល់' : 'Link Copied!'}</span>
            ) : (
              <span>📋 {isKh ? 'ចម្លងតំណភ្ជាប់ (Copy Link)' : 'Copy Staff Link'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
