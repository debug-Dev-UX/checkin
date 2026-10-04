import { useState, useEffect, useRef, useCallback } from 'react'
import jsQR from 'jsqr'
import {
  IconCamera,
  IconCheck,
  IconClock,
  IconRefresh,
  IconUsers,
  IconArrowPointer
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

    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.25)
  } catch {
    // AudioContext might be restricted until user gesture
  }
}

export default function StaffCameraScanner({
  apiBase,
  staffList = [],
  onCheckinSuccess,
  onBackToDashboard,
}) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const animFrameIdRef = useRef(null)
  const streamRef = useRef(null)

  // Scanner state
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraFacing, setCameraFacing] = useState('environment') // 'environment' | 'user'
  const [cameraError, setCameraError] = useState(null)
  const [scanMode, setScanMode] = useState('in') // 'in' = Clock In | 'out' = Clock Out
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState('')

  // Feedback result
  const [scanResult, setScanResult] = useState(null)
  const [lastScannedCode, setLastScannedCode] = useState(null)
  const [recentLogs, setRecentLogs] = useState([])

  // Fetch today's staff logs for confirmation
  const fetchTodayStaffLogs = useCallback(async () => {
    try {
      const todayControl = await getTodayControlFromFirebase()
      const staffOnly = (todayControl.data || []).filter(item => item.type === 'employee')
      setRecentLogs(staffOnly)
    } catch {
      // quiet catch
    }
  }, [])

  useEffect(() => {
    fetchTodayStaffLogs()
  }, [fetchTodayStaffLogs])

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
      setCameraError('Camera access is not supported by this browser. You can still use manual selection below.')
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
        // Wait for video metadata to load
        await videoRef.current.play()
        setCameraActive(true)
      }
    } catch (err) {
      setCameraError(`Camera error: ${err.message || 'Permission denied'}. Please allow camera access or use the manual roster below.`)
      setCameraActive(false)
    }
  }, [cameraFacing, stopCamera])

  // Toggle camera direction
  const handleToggleFacing = () => {
    setCameraFacing(prev => (prev === 'environment' ? 'user' : 'environment'))
  }

  // Effect to restart camera when facingMode changes
  useEffect(() => {
    if (cameraActive) {
      startCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraFacing])

  // Handle staff check-in/out submission
  const executeStaffAction = useCallback(async (staffMember, sourceCode = 'QR Scan') => {
    if (!staffMember) return
    setIsProcessing(true)

    try {
      if (scanMode === 'in') {
        // Clock In
        const payload = {
          staff_id: staffMember.id,
          name: staffMember.name,
          email: staffMember.email,
          type: 'employee',
          department: staffMember.role || 'Service',
          badge_no: `STAFF-${staffMember.id || 'ROSTER'}`,
          branch_id: staffMember.branch_id || 'branch_2',
          branch_name: staffMember.branch_name || 'Chafé • Kohke',
          location: staffMember.branch_name || 'Counter Camera Station',
          note: `Clocked in via ${sourceCode}`,
        }

        const newRecord = await createCheckinInFirebase(payload)

        playSuccessBeep()
        setScanResult({
          type: 'success',
          action: 'Clocked In',
          name: staffMember.name,
          role: staffMember.role,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: newRecord?.punctuality_status === 'on_time' ? 'On-Time (Good Standing)' : 'Late Arrival',
          lateMins: newRecord?.late_minutes || 0,
        })
      } else {
        // Clock Out: find active check-in
        const checkinsData = await getCheckinsFromFirebase()
        const active = (checkinsData || []).find(
          c => c.status === 'checked_in' && (c.email === staffMember.email || c.name === staffMember.name)
        )

        if (!active) {
          throw new Error(`${staffMember.name} has no active check-in to clock out.`)
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

      fetchTodayStaffLogs()
      if (onCheckinSuccess) onCheckinSuccess()

      // Auto dismiss success card after 4 seconds
      setTimeout(() => {
        setScanResult(null)
        setLastScannedCode(null)
      }, 4000)
    } catch (err) {
      setScanResult({
        type: 'error',
        message: err.message,
      })
      setTimeout(() => setScanResult(null), 4000)
    } finally {
      setIsProcessing(false)
    }
  }, [apiBase, fetchTodayStaffLogs, onCheckinSuccess, scanMode])

  // Continuous frame loop using requestAnimationFrame + jsQR
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

          // Match staff from QR content
          const text = code.data.toLowerCase()
          let matchedStaff = staffList.find(s =>
            text.includes(s.email.toLowerCase()) ||
            text.includes(s.name.toLowerCase()) ||
            text.includes(`staff-${s.id}`)
          )

          // If it is a generic Chafé staff QR, use selected or first staff
          if (!matchedStaff && staffList.length > 0) {
            matchedStaff = staffList.find(s => s.id.toString() === selectedStaffId) || staffList[0]
          }

          if (matchedStaff) {
            executeStaffAction(matchedStaff, 'Camera QR')
          } else {
            setScanResult({
              type: 'info',
              message: `QR Scanned: "${code.data}". Please select staff member from the list to assign.`,
            })
            setTimeout(() => setScanResult(null), 4000)
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
  }, [cameraActive, isProcessing, lastScannedCode, staffList, selectedStaffId, executeStaffAction])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // Trigger manual or simulated QR check-in
  const handleManualClockIn = (staff) => {
    executeStaffAction(staff, 'Manual Click')
  }

  return (
    <div className="staff-scanner-container">
      {/* Top Header Row */}
      <div className="scanner-header-bar">
        <div>
          <h1 className="scanner-title">
            Chafé • Staff Camera Check-In
          </h1>
          <p className="scanner-subtitle">
            Scan your staff QR code or badge using the camera to clock in or out.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {onBackToDashboard && (
            <button
              className="btn-secondary"
              onClick={onBackToDashboard}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>← Back to Dashboard</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Layout: Camera Viewfinder on Left, Controls & Logs on Right */}
      <div className="scanner-grid">
        {/* Left Column: Live Camera Box */}
        <div className="content-panel scanner-viewfinder-panel">
          <div className="panel-header-bar">
            <div className="panel-heading-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconCamera size={18} color="#ea580c" />
              <span>LIVE CAMERA SCANNER</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`status-indicator-dot ${cameraActive ? 'active' : ''}`} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: cameraActive ? '#10b981' : '#94a3b8' }}>
                {cameraActive ? 'Camera Live' : 'Camera Off'}
              </span>
            </div>
          </div>

          <div className="viewfinder-body">
            {/* Viewfinder Screen */}
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

                {/* Animated Laser Scanning Line */}
                {cameraActive && <div className="scanning-laser-line" />}
              </div>

              {/* Overlay Prompt when Camera is Off */}
              {!cameraActive && (
                <div className="camera-off-overlay">
                  <div style={{ fontSize: '42px', marginBottom: '8px' }}>📷</div>
                  <strong style={{ fontSize: '14px', color: '#1e293b' }}>Camera is currently stopped</strong>
                  <p style={{ fontSize: '12px', color: '#64748b', maxWidth: '280px', marginTop: '4px' }}>
                    Click &quot;Start Camera&quot; to begin scanning staff QR badges.
                  </p>
                  <button
                    className="btn-primary"
                    style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    onClick={startCamera}
                  >
                    <IconCamera size={16} color="#ffffff" />
                    <span>Open Camera</span>
                  </button>
                </div>
              )}
            </div>

            {/* Error Message */}
            {cameraError && (
              <div className="camera-error-banner">
                ⚠️ {cameraError}
              </div>
            )}

            {/* Camera Control Bar */}
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
                title="Switch between front and back camera"
              >
                <IconRefresh size={14} />
                <span>Switch ({cameraFacing === 'environment' ? 'Back' : 'Front'})</span>
              </button>

              <button
                className="btn-secondary"
                onClick={() => {
                  // Simulate QR scan for the selected or first staff member
                  const staff = staffList.find(s => s.id.toString() === selectedStaffId) || staffList[0]
                  if (staff) {
                    executeStaffAction(staff, 'Simulated Scan')
                  } else {
                    alert('Please add a staff member in Staff Roster first.')
                  }
                }}
                disabled={staffList.length === 0}
              >
                ⚡ Test Scan Simulation
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Mode Toggle, Quick Check-in & Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Action Mode Toggle: Clock In vs Clock Out */}
          <div className="content-panel" style={{ padding: '20px' }}>
            <div className="panel-heading-title" style={{ marginBottom: '14px' }}>
              SHIFT ACTION MODE
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                className={`mode-toggle-card ${scanMode === 'in' ? 'active-in' : ''}`}
                onClick={() => setScanMode('in')}
              >
                <div style={{ fontSize: '20px' }}>☀️</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px' }}>CLOCK IN</div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>Start Work Shift</div>
                </div>
              </button>

              <button
                className={`mode-toggle-card ${scanMode === 'out' ? 'active-out' : ''}`}
                onClick={() => setScanMode('out')}
              >
                <div style={{ fontSize: '20px' }}>🌙</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px' }}>CLOCK OUT</div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>End Work Shift</div>
                </div>
              </button>
            </div>
          </div>

          {/* Instant Scan Result Feedback Card */}
          {scanResult && (
            <div className={`scan-feedback-banner ${scanResult.type}`}>
              {scanResult.type === 'success' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800 }}>
                    <IconCheck size={18} color="#10b981" />
                    <span>{scanResult.action} Confirmed!</span>
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '13px', fontWeight: 700 }}>
                    {scanResult.name} • <span style={{ opacity: 0.85 }}>{scanResult.role}</span>
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '4px', display: 'flex', gap: '12px' }}>
                    <span>⏰ {scanResult.time}</span>
                    <span className="badge-tag-pill completed">{scanResult.status}</span>
                  </div>
                </div>
              )}

              {scanResult.type === 'error' && (
                <div>
                  <strong>Error:</strong> {scanResult.message}
                </div>
              )}

              {scanResult.type === 'info' && (
                <div>{scanResult.message}</div>
              )}
            </div>
          )}

          {/* Quick Staff Roster 1-Tap Clock In */}
          <div className="content-panel" style={{ padding: '20px' }}>
            <div className="panel-heading-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <IconUsers size={16} color="#64748b" />
              <span>STAFF ROSTER DIRECT CLOCK-IN</span>
            </div>

            {staffList.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '16px' }}>
                No staff members created yet. Go to <strong>Staff Roster</strong> in the sidebar to add your baristas!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ fontSize: '11px', color: '#64748b' }}>
                  Select staff to simulate or tap to clock in immediately:
                </p>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <select
                    className="form-select"
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    style={{ fontSize: '12px' }}
                  >
                    <option value="">-- Active Staff Selection --</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role} • Shift: {s.shift_start})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="staff-quick-grid">
                  {staffList.map(s => (
                    <div key={s.id} className="staff-quick-card">
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>{s.name}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{s.role} (⏰ {s.shift_start})</div>
                      </div>
                      <button
                        className="btn-primary"
                        style={{ fontSize: '10px', padding: '4px 10px' }}
                        onClick={() => handleManualClockIn(s)}
                        disabled={isProcessing}
                      >
                        {scanMode === 'in' ? 'Clock In' : 'Clock Out'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Today's Short Attendance Feed */}
          <div className="content-panel" style={{ padding: '20px' }}>
            <div className="panel-heading-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <IconClock size={16} color="#64748b" />
              <span>TODAY&apos;S STAFF CLOCK-IN LOGS</span>
            </div>

            {recentLogs.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '12px' }}>
                No staff shifts clocked in today yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recentLogs.slice(0, 5).map(log => (
                  <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                    <div>
                      <strong>{log.name}</strong>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>{log.department || 'Barista'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`badge-status-pill ${log.status === 'checked_in' ? 'green' : 'blue'}`}>
                        {log.status === 'checked_in' ? 'On Shift' : 'Completed'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
