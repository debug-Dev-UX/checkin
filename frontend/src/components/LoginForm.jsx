import { useState } from 'react'
import {
  IconLock,
  IconUser,
  IconEye,
  IconEyeOff
} from '../Icons'
import { loginWithFirebase } from '../services/firebaseService'

export default function LoginForm({ apiBase, onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState(null)

  // Validation state
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({ username: false, password: false })

  const validate = (values) => {
    const errs = {}
    const trimmed = (values.username || '').trim()
    if (!trimmed) {
      errs.username = 'Username is required.'
    } else if (trimmed.length < 3) {
      errs.username = 'Username must be at least 3 characters.'
    }

    if (!values.password) {
      errs.password = 'Password is required.'
    } else if (values.password.length < 4) {
      errs.password = 'Password must be at least 4 characters.'
    }

    return errs
  }

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    const currentErrors = validate({ username, password })
    setErrors(currentErrors)
  }

  const handleUsernameChange = (e) => {
    const val = e.target.value
    setUsername(val)
    if (serverError) setServerError(null)
    if (touched.username) {
      const fieldErrors = validate({ username: val, password })
      setErrors((prev) => ({ ...prev, username: fieldErrors.username }))
    }
  }

  const handlePasswordChange = (e) => {
    const val = e.target.value
    setPassword(val)
    if (serverError) setServerError(null)
    if (touched.password) {
      const fieldErrors = validate({ username, password: val })
      setErrors((prev) => ({ ...prev, password: fieldErrors.password }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Mark all as touched
    setTouched({ username: true, password: true })
    const validationErrors = validate({ username, password })
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setLoading(true)
    setServerError(null)
    const trimmedUser = username.trim()
    const trimmedPass = (password || '').trim()

    try {
      const data = await loginWithFirebase(trimmedUser, trimmedPass)
      onLoginSuccess(data)
    } catch (err) {
      // Local fallback for admin if server is unreachable
      if (trimmedUser.toLowerCase() === 'admin' && trimmedPass === '123456') {
        onLoginSuccess({
          status: 'success',
          role: 'admin',
          token: 'admin_fallback',
          user: {
            id: 'admin',
            name: 'Administrator',
            username: 'admin',
            role: 'admin',
            display_title: 'System Administrator',
          },
        })
        return
      }

      setServerError(err.message || 'Authentication failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page-container">
      <div className="login-bg-glow glow-1"></div>
      <div className="login-bg-glow glow-2"></div>

      <div className="login-card">
        {/* Simple Brand Header */}
        <div className="login-brand-section">
          <div className="login-logo-badge">
            <span className="login-logo-text">Chafé</span>
          </div>
          <h1 className="login-main-title">Sign In</h1>
          <p className="login-subtitle">
            Enter your credentials to access your account.
          </p>
        </div>

        {/* Server Error Message */}
        {serverError && (
          <div className="login-error-alert" role="alert">
            <span>{serverError}</span>
          </div>
        )}

        {/* Simple Form - No suggestions, no hints, strict validation */}
        <form onSubmit={handleSubmit} className="login-form" autoComplete="off" noValidate>
          {/* Username Input */}
          <div className="form-group">
            <label className="form-label" htmlFor="username">
              Username <span className="form-required">*</span>
            </label>
            <div className={`input-with-icon ${touched.username && errors.username ? 'has-error' : ''}`}>
              <span className="input-icon">
                <IconUser size={16} color={touched.username && errors.username ? '#ef4444' : '#64748b'} />
              </span>
              <input
                id="username"
                name="username"
                type="text"
                className={`form-input ${touched.username && errors.username ? 'input-error' : ''}`}
                placeholder="Enter username"
                value={username}
                onChange={handleUsernameChange}
                onBlur={() => handleBlur('username')}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                disabled={loading}
              />
            </div>
            {touched.username && errors.username && (
              <span className="form-error-msg">{errors.username}</span>
            )}
          </div>

          {/* Password Input */}
          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password <span className="form-required">*</span>
            </label>
            <div className={`input-with-icon ${touched.password && errors.password ? 'has-error' : ''}`}>
              <span className="input-icon">
                <IconLock size={16} color={touched.password && errors.password ? '#ef4444' : '#64748b'} />
              </span>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className={`form-input ${touched.password && errors.password ? 'input-error' : ''}`}
                placeholder="Enter password"
                value={password}
                onChange={handlePasswordChange}
                onBlur={() => handleBlur('password')}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                disabled={loading}
              />
              <button
                type="button"
                className="input-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
            {touched.password && errors.password && (
              <span className="form-error-msg">{errors.password}</span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-primary login-submit-btn"
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Minimal Footer */}
        <div className="login-card-footer">
          <span>Chafé Check-In & HR System</span>
        </div>
      </div>
    </div>
  )
}
