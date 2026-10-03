import { useState, useEffect, useRef, useCallback } from 'react'
import jsQR from 'jsqr'
import {
  IconCamera,
  IconCheck,
  IconClock,
  IconRefresh,
  IconUserCircle,
  IconGear
} from '../Icons'
import {
  getTodayControlFromFirebase,
  getCheckinsFromFirebase,
  createCheckinInFirebase,
  checkoutInFirebase
} from '../services/firebaseService'

/**
 * Web Audio API chime on successful scan
 */
function playSuccessBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime) // A5
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.12) // D6

    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.25)
  } catch {
    // AudioContext might be restricted until user gesture
  }
}

export default function UserDashboard({
  apiBase,
  staffList = [],
  onShiftUpdated,
  onSwitchToAdmin,
}) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const animFrameIdRef = useRef(null)
  const streamRef = useRef(null)

  // Clock
  const [currentTime, setCurrentTime] = useState(new Date())

  // Scanner state
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraFacing, setCameraFacing] = useState('environment') // 'environment' | 'user'
  const [cameraError, setCameraError] = useState(null)
  const [scanMode, setScanMode] = useState('in') // 'in' = Clock In | 'out' = Clock Out
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState('')

  // Result & logs
  const [scanResult, setScanResult] = useState(null)
  const [lastScannedCode, setLastScannedCode] = useState(null)
  const [todayStaffLogs, setTodayStaffLogs] = useState([])

  // Live digital clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch today's staff logs
  const fetchTodayLogs = useCallback(async () => {
    try {
      const todayControl = await getTodayControlFromFirebase()
      const staffOnly = (todayControl.data || []).filter(item => item.type === 'employee')
      setTodayStaffLogs(staffOnly)
    } catch {
      // quiet catch
    }
  }, [])

  useEffect(() => {
    fetchTodayLogs()
  }, [fetchTodayLogs])

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current)
      animFrameIdRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }, [])

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera()
    setCameraError(null)

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported by your browser. Use the roster below to clock in.')
      return
    }

    try {
      const constraints = {
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraActive(true)
      }
    } catch (err) {
      setCameraError(`Camera error: ${err.message || 'Permission denied'}. Please allow camera access or use the 1-tap roster below.`)
      setCameraActive(false)
    }
  }, [cameraFacing, stopCamera])

  const handleToggleFacing = () => {
    setCameraFacing(prev => (prev === 'environment' ? 'user' : 'environment'))
  }

  useEffect(() => {
    if (cameraActive) {
      startCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraFacing])

  // Execute staff clock-in / clock-out
  const handleExecuteClock = useCallback(async (staffMember, source = 'Camera Scan') => {
    if (!staffMember) return
    setIsProcessing(true)

    try {
      if (scanMode === 'in') {
        const payload = {
          name: staffMember.name,
          email: staffMember.email,
          type: 'employee',
          department: staffMember.role || 'Service',
          badge_no: `STAFF-${staffMember.id || 'ROSTER'}`,
          location: 'Staff Entrance Terminal',
          note: `Clocked in via ${source}`,
        }

        const newRecord = await createCheckinInFirebase(payload)

        playSuccessBeep()
        setScanResult({
          type: 'success',
          action: 'Clocked In',
          name: staffMember.name,
          role: staffMember.role,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: newRecord?.punctuality_status === 'on_time' ? 'On-Time (Good Standing ✓)' : 'Late Arrival ⚠️',
          lateMins: newRecord?.late_minutes || 0,
        })
      } else {
        // Clock Out: find active check-in
        const checkinsData = await getCheckinsFromFirebase()
        const active = (checkinsData || []).find(
          c => c.status === 'checked_in' && (c.email === staffMember.email || c.name === staffMember.name)
        )

        if (!active) {
          throw new Error(`${staffMember.name} is not currently clocked in.`)
        }

        await checkoutInFirebase(active.id)

        playSuccessBeep()
        setScanResult({
          type: 'success',
          action: 'Clocked Out',
          name: staffMember.name,
          role: staffMember.role,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'Shift Completed',
        })
      }

      fetchTodayLogs()
      if (onShiftUpdated) onShiftUpdated()

      setTimeout(() => {
        setScanResult(null)
        setLastScannedCode(null)
      }, 4500)
    } catch (err) {
      setScanResult({
        type: 'error',
        message: err.message,
      })
      setTimeout(() => setScanResult(null), 4500)
    } finally {
      setIsProcessing(false)
    }
  }, [apiBase, fetchTodayLogs, onShiftUpdated, scanMode])

  // Continuous frame loop with jsQR
  useEffect(() => {
    let active = true

    const scanFrame = () => {
      if (!active) return

      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && !isProcessing) {
        const video = videoRef.current
        const canvas = canvasRef.current || document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })

        if (code && code.data && code.data !== lastScannedCode) {
          setLastScannedCode(code.data)
          const text = code.data.toLowerCase()

          let matchedStaff = staffList.find(s =>
            text.includes(s.email.toLowerCase()) ||
            text.includes(s.name.toLowerCase()) ||
            text.includes(`staff-${s.id}`)
          )

          if (!matchedStaff && staffList.length > 0) {
            matchedStaff = staffList.find(s => s.id.toString() === selectedStaffId) || staffList[0]
          }

          if (matchedStaff) {
            handleExecuteClock(matchedStaff, 'Camera QR Scan')
          } else {
            setScanResult({
              type: 'info',
              message: `QR code detected: "${code.data}". Please select staff profile below to complete.`,
            })
            setTimeout(() => setScanResult(null), 4500)
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(scanFrame)
    }

    if (cameraActive) {
      animFrameIdRef.current = requestAnimationFrame(scanFrame)
    }

    return () => {
      active = false
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current)
      }
    }
  }, [cameraActive, isProcessing, lastScannedCode, staffList, selectedStaffId, handleExecuteClock])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  return (
    <div className="user-portal-root">
      {/* Top Navbar for Staff / User */}
      <header className="user-portal-header">
        <div className="user-portal-brand">
          <span className="brand-name">Chafé</span>
          <span className="brand-tag">Staff Portal</span>
        </div>

        {/* Live Digital Clock */}
        <div className="user-portal-clock">
          <div className="live-clock-time">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="live-clock-date">
            {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        {/* Switch to Admin Dashboard Button */}
        <div className="user-portal-actions">
          <button
            className="btn-switch-admin"
            onClick={onSwitchToAdmin}
            title="Switch to Admin Dashboard"
          >
            <IconGear size={15} />
            <span>Admin Dashboard</span>
          </button>
        </div>
      </header>

      {/* Main Staff Container */}
      <main className="user-portal-content">
        {/* Welcome Banner */}
        <div className="user-welcome-card">
          <div>
            <h1 className="user-welcome-title">Staff Attendance & Camera Check-In</h1>
            <p className="user-welcome-subtitle">
              Open your camera to scan your QR badge, or tap your name below to clock in / out.
            </p>
          </div>

          {/* Quick Mode Toggle */}
          <div className="portal-mode-toggle">
            <button
              className={`portal-mode-btn ${scanMode === 'in' ? 'active-in' : ''}`}
              onClick={() => setScanMode('in')}
            >
              ☀️ Clock In (Start Shift)
            </button>
            <button
              className={`portal-mode-btn ${scanMode === 'out' ? 'active-out' : ''}`}
              onClick={() => setScanMode('out')}
            >
              🌙 Clock Out (End Shift)
            </button>
          </div>
        </div>

        {/* Scan Result Notification */}
        {scanResult && (
          <div className={`scan-feedback-banner ${scanResult.type}`} style={{ marginBottom: '20px' }}>
            {scanResult.type === 'success' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconCheck size={20} color="#ffffff" />
                  </div>
                  <div>
                    <strong style={{ fontSize: '15px' }}>{scanResult.action} Confirmed!</strong>
                    <div style={{ fontSize: '13px', marginTop: '2px' }}>
                      {scanResult.name} ({scanResult.role}) • {scanResult.time}
                    </div>
                  </div>
                </div>
                <span className="badge-status-pill green" style={{ fontSize: '12px', padding: '4px 10px' }}>
                  {scanResult.status}
                </span>
              </div>
            )}

            {scanResult.type === 'error' && (
              <div>
                <strong>Clock Error:</strong> {scanResult.message}
              </div>
            )}

            {scanResult.type === 'info' && (
              <div>{scanResult.message}</div>
            )}
          </div>
        )}

        {/* Central Grid: Camera Scanner & Staff Quick Clock */}
        <div className="user-portal-grid">
          {/* Left Column: Live Camera Box */}
          <div className="user-panel camera-card">
            <div className="user-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconCamera size={18} color="#f97316" />
                <span style={{ fontWeight: 800 }}>CAMERA QR SCANNER</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className={`status-indicator-dot ${cameraActive ? 'active' : ''}`} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: cameraActive ? '#10b981' : '#94a3b8' }}>
                  {cameraActive ? 'Camera Live' : 'Camera Stopped'}
                </span>
              </div>
            </div>

            {/* Video Box */}
            <div className="camera-viewfinder-box">
              <video
                ref={videoRef}
                className="camera-video-element"
                playsInline
                muted
              />

              {/* Glowing Corner Target Overlay */}
              <div className="scanner-reticle-overlay">
                <div className="reticle-corner top-left" />
                <div className="reticle-corner top-right" />
                <div className="reticle-corner bottom-left" />
                <div className="reticle-corner bottom-right" />
                {cameraActive && <div className="scanning-laser-line" />}
              </div>

              {/* Overlay Prompt when Camera is Off */}
              {!cameraActive && (
                <div className="camera-off-overlay">
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>📷</div>
                  <strong style={{ fontSize: '15px', color: '#1e293b' }}>Camera is Offline</strong>
                  <p style={{ fontSize: '12px', color: '#64748b', maxWidth: '280px', marginTop: '6px' }}>
                    Open your camera to scan your physical badge or QR card.
                  </p>
                  <button
                    className="btn-primary"
                    style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '13px' }}
                    onClick={startCamera}
                  >
                    <IconCamera size={16} color="#ffffff" />
                    <span>Open Camera</span>
                  </button>
                </div>
              )}
            </div>

            {/* Camera Error */}
            {cameraError && (
              <div className="camera-error-banner">
                ⚠️ {cameraError}
              </div>
            )}

            {/* Controls */}
            <div className="camera-control-bar">
              {cameraActive ? (
                <button className="btn-secondary" onClick={stopCamera}>
                  Stop Camera
                </button>
              ) : (
                <button className="btn-primary" onClick={startCamera}>
                  Start Camera
                </button>
              )}

              <button
                className="btn-secondary"
                onClick={handleToggleFacing}
                title="Switch camera"
              >
                <IconRefresh size={14} />
                <span>Flip ({cameraFacing === 'environment' ? 'Rear' : 'Front'})</span>
              </button>

              <button
                className="btn-secondary"
                onClick={() => {
                  const staff = staffList.find(s => s.id.toString() === selectedStaffId) || staffList[0]
                  if (staff) {
                    handleExecuteClock(staff, 'Terminal Quick Scan')
                  } else {
                    alert('Please create staff members first in the Admin Dashboard.')
                  }
                }}
                disabled={staffList.length === 0}
              >
                ⚡ Quick Scan
              </button>
            </div>
          </div>

          {/* Right Column: 1-Tap Staff Roster & Today Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Staff 1-Tap Clock In */}
            <div className="user-panel" style={{ padding: '20px' }}>
              <div className="user-panel-header" style={{ marginBottom: '14px' }}>
                <span style={{ fontWeight: 800 }}>TAP YOUR NAME TO {scanMode === 'in' ? 'CLOCK IN' : 'CLOCK OUT'}</span>
              </div>

              {staffList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px' }}>
                  No staff members created yet.
                  <div style={{ marginTop: '10px' }}>
                    <button className="btn-secondary" onClick={onSwitchToAdmin}>
                      Go to Admin Dashboard to add staff
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {staffList.map((s) => {
                    const isCheckedIn = todayStaffLogs.some(l => l.name === s.name && l.status === 'checked_in')
                    return (
                      <div key={s.id} className="user-staff-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="user-avatar-circle" style={{ width: '38px', height: '38px' }}>
                            <IconUserCircle size={22} color="#475569" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>{s.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {s.role} • Shift: ⏰ {s.shift_start} - {s.shift_end}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`badge-status-pill ${isCheckedIn ? 'green' : 'blue'}`}>
                            {isCheckedIn ? 'On Shift' : 'Off Duty'}
                          </span>

                          <button
                            className={scanMode === 'in' ? 'btn-primary' : 'btn-secondary'}
                            style={{ fontSize: '11px', padding: '6px 12px' }}
                            onClick={() => handleExecuteClock(s, 'Manual Click')}
                            disabled={isProcessing}
                          >
                            {scanMode === 'in' ? 'Clock In' : 'Clock Out'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Today's Recent Clock-Ins */}
            <div className="user-panel" style={{ padding: '20px' }}>
              <div className="user-panel-header" style={{ marginBottom: '12px' }}>
                <span style={{ fontWeight: 800 }}>TODAY&apos;S SHIFT ACTIVITY</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{todayStaffLogs.length} shifts logged</span>
              </div>

              {todayStaffLogs.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '16px' }}>
                  No staff members have clocked in today yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {todayStaffLogs.map(log => (
                    <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                      <div>
                        <strong>{log.name}</strong>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                          {log.department} • In: {log.check_in_at ? new Date(log.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </div>
                      </div>

                      <span className={`badge-status-pill ${log.status === 'checked_in' ? 'green' : 'blue'}`}>
                        {log.status === 'checked_in' ? 'Active On Shift' : 'Checked Out'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
