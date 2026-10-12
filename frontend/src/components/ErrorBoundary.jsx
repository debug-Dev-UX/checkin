import React, { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.hash = ''
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #0b0f19 0%, #111827 100%)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '480px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            padding: '32px 24px',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '24px',
              fontWeight: 800
            }}>
              !
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px', color: '#f8fafc' }}>
              Interface Reload Required
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.5, marginBottom: '24px' }}>
              An unexpected render issue was safely caught. Click below to refresh your workspace.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
              }}
            >
              Reload Chafé Portal
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
